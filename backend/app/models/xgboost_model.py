"""Modelo XGBoost mejorado para predicción del precio del cacao."""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.feature_selection import mutual_info_regression


class XGBoostPredictor:
    """Predictor XGBoost con selección de features, validación temporal y semilla fija."""

    def __init__(self, params: dict = None, seed: int = 42):
        self.seed = seed
        self.params = params or {
            "n_estimators": 800,
            "max_depth": 5,
            "learning_rate": 0.03,
            "subsample": 0.8,
            "colsample_bytree": 0.7,
            "min_child_weight": 5,
            "reg_alpha": 0.5,
            "reg_lambda": 2.0,
            "random_state": seed,
            "gamma": 0.1,
        }
        self.model = None
        self.feature_names = None
        self._selected_features = None
        self._validation_errors = []

    def _select_features(self, X: pd.DataFrame, y: pd.Series, max_features: int = 30) -> list[str]:
        """Selecciona las features más relevantes usando mutual information."""
        # Eliminar features constantes o con muy baja varianza
        valid_cols = []
        for col in X.columns:
            if X[col].std() > 1e-8 and X[col].nunique() > 5:
                valid_cols.append(col)

        if len(valid_cols) <= max_features:
            return valid_cols

        X_valid = X[valid_cols].fillna(0)

        try:
            mi_scores = mutual_info_regression(X_valid, y, random_state=self.seed)
            mi_ranking = pd.Series(mi_scores, index=valid_cols).sort_values(ascending=False)
            selected = mi_ranking.head(max_features).index.tolist()
        except Exception:
            selected = valid_cols[:max_features]

        return selected

    def fit(self, X: pd.DataFrame, y: pd.Series, select_features: bool = True):
        """Entrena XGBoost con selección de features y early stopping."""
        np.random.seed(self.seed)

        if select_features:
            self._selected_features = self._select_features(X, y)
            X_sel = X[self._selected_features]
        else:
            self._selected_features = X.columns.tolist()
            X_sel = X

        self.feature_names = self._selected_features

        # Split temporal para early stopping
        split_idx = int(len(X_sel) * 0.85)
        X_train, X_val = X_sel[:split_idx], X_sel[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]

        self.model = xgb.XGBRegressor(**self.params)
        self.model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Genera predicciones."""
        if self.model is None:
            raise ValueError("El modelo no ha sido entrenado.")
        X_sel = X[self._selected_features] if self._selected_features else X
        return self.model.predict(X_sel)

    def predict_recursive(
        self, last_features: pd.DataFrame, horizon: int
    ) -> list[float]:
        """Predicción recursiva multi-step con suavizado."""
        np.random.seed(self.seed)
        predictions = []
        current_features = last_features[self._selected_features].copy()

        for step in range(horizon):
            pred = float(self.model.predict(current_features)[0])

            # Suavizado: limitar cambio diario a ±3% respecto al anterior
            if predictions:
                max_change = predictions[-1] * 0.03
                pred = np.clip(pred, predictions[-1] - max_change, predictions[-1] + max_change)

            predictions.append(pred)

            # Shift lag features
            current_row = current_features.iloc[0].copy()
            lag_cols = sorted(
                [c for c in current_features.columns if c.startswith("lag_")],
                key=lambda x: int(x.split("_")[1]),
            )

            for i in range(len(lag_cols) - 1, 0, -1):
                current_row[lag_cols[i]] = current_row[lag_cols[i - 1]]
            if lag_cols:
                current_row[lag_cols[0]] = pred

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
        self, X: pd.DataFrame, y: pd.Series, test_size: int = 60
    ) -> dict:
        """Walk-forward validation con TimeSeriesSplit."""
        np.random.seed(self.seed)
        X_sel = X[self._selected_features] if self._selected_features else X

        # Usar los últimos test_size días como test
        X_train, X_test = X_sel[:-test_size], X_sel[-test_size:]
        y_train, y_test = y[:-test_size], y[-test_size:]

        temp_model = xgb.XGBRegressor(**self.params)
        temp_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        predictions = temp_model.predict(X_test)

        errors = y_test.values - predictions
        self._validation_errors = errors.tolist()

        mse = float(mean_squared_error(y_test, predictions))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_test, predictions))
        mape = float(np.mean(np.abs(errors / y_test.values)) * 100)

        return {"mse": mse, "rmse": rmse, "mae": mae, "mape": mape}
