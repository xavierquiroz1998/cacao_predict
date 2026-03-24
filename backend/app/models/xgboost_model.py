"""Modelo XGBoost para predicción del precio del cacao."""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error


class XGBoostPredictor:
    """Predictor basado en XGBoost para series temporales."""

    def __init__(self, params: dict = None):
        self.params = params or {
            "n_estimators": 500,
            "max_depth": 6,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "random_state": 42,
        }
        self.model = None
        self.feature_names = None

    def fit(self, X: pd.DataFrame, y: pd.Series):
        """Entrena el modelo XGBoost."""
        self.feature_names = X.columns.tolist()
        self.model = xgb.XGBRegressor(**self.params)
        self.model.fit(
            X,
            y,
            eval_set=[(X, y)],
            verbose=False,
        )
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Genera predicciones."""
        if self.model is None:
            raise ValueError("El modelo no ha sido entrenado.")
        return self.model.predict(X)

    def predict_recursive(
        self, last_features: pd.DataFrame, horizon: int, price_col_idx: int = 0
    ) -> list[float]:
        """Predicción recursiva: usa la predicción anterior como input para la siguiente.

        Para predicciones multi-step en series temporales.
        """
        predictions = []
        current_features = last_features.copy()

        for _ in range(horizon):
            pred = self.model.predict(current_features)[0]
            predictions.append(float(pred))

            # Shift lag features
            current_row = current_features.iloc[0].copy()
            lag_cols = [c for c in current_features.columns if c.startswith("lag_")]
            lag_cols_sorted = sorted(lag_cols, key=lambda x: int(x.split("_")[1]))

            for i in range(len(lag_cols_sorted) - 1, 0, -1):
                current_row[lag_cols_sorted[i]] = current_row[lag_cols_sorted[i - 1]]
            if lag_cols_sorted:
                current_row[lag_cols_sorted[0]] = pred

            current_features = pd.DataFrame([current_row])

        return predictions

    def get_feature_importance(self) -> dict[str, float]:
        """Retorna la importancia de cada feature."""
        if self.model is None:
            raise ValueError("El modelo no ha sido entrenado.")

        importance = self.model.feature_importances_
        feature_imp = dict(zip(self.feature_names, importance.tolist()))
        return dict(sorted(feature_imp.items(), key=lambda x: x[1], reverse=True))

    def get_metrics(
        self, X: pd.DataFrame, y: pd.Series, test_size: int = 30
    ) -> dict:
        """Calcula métricas de rendimiento."""
        X_train, X_test = X[:-test_size], X[-test_size:]
        y_train, y_test = y[:-test_size], y[-test_size:]

        temp_model = xgb.XGBRegressor(**self.params)
        temp_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        predictions = temp_model.predict(X_test)

        mse = mean_squared_error(y_test, predictions)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_test, predictions)
        mape = np.mean(np.abs((y_test.values - predictions) / y_test.values)) * 100

        return {"mse": mse, "rmse": rmse, "mae": mae, "mape": mape}
