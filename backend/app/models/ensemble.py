"""Modelo ensemble que combina SARIMA, XGBoost y LSTM."""

import numpy as np
import pandas as pd

from app.models.sarima_model import SARIMAPredictor
from app.models.xgboost_model import XGBoostPredictor
from app.models.lstm_model import LSTMPredictor
from app.services.feature_engineering import prepare_features
from app.config import settings


class EnsemblePredictor:
    """Combina predicciones de SARIMA, XGBoost y LSTM con pesos adaptativos."""

    def __init__(self):
        self.sarima = SARIMAPredictor()
        self.xgboost = XGBoostPredictor()
        self.lstm = LSTMPredictor()
        self.weights = {"sarima": 0.3, "xgboost": 0.4, "lstm": 0.3}
        self.is_fitted = False
        self.metrics = {}

    def fit(self, df: pd.DataFrame, target_col: str = "Close_Seco"):
        """Entrena los 3 modelos y ajusta pesos según rendimiento."""
        df_features = prepare_features(df, target_col)

        # Columnas de features (excluir Date, target, y columnas Baba)
        exclude = ["Date", target_col] + [
            c for c in df_features.columns if c.endswith("_Baba")
        ]
        feature_cols = [c for c in df_features.columns if c not in exclude and df_features[c].dtype in [np.float64, np.int64, np.int32, np.float32]]

        X = df_features[feature_cols]
        y = df_features[target_col]
        series = df_features[target_col]

        # Entrenar SARIMA
        try:
            self.sarima.fit(series)
            self.metrics["sarima"] = self.sarima.get_metrics(series)
        except Exception as e:
            self.metrics["sarima"] = {"error": str(e), "mape": 100}

        # Entrenar XGBoost
        try:
            self.xgboost.fit(X, y)
            self.metrics["xgboost"] = self.xgboost.get_metrics(X, y)
        except Exception as e:
            self.metrics["xgboost"] = {"error": str(e), "mape": 100}

        # Entrenar LSTM
        try:
            self.lstm.fit(df_features, target_col)
            self.metrics["lstm"] = self.lstm.get_metrics(df_features, target_col)
        except Exception as e:
            self.metrics["lstm"] = {"error": str(e), "mape": 100}

        # Ajustar pesos inversamente proporcionales al MAPE
        self._adjust_weights()

        self._df_features = df_features
        self._feature_cols = feature_cols
        self._target_col = target_col
        self.is_fitted = True

        return self

    def _adjust_weights(self):
        """Ajusta los pesos del ensemble según el rendimiento de cada modelo."""
        mapes = {}
        for model_name in ["sarima", "xgboost", "lstm"]:
            m = self.metrics.get(model_name, {})
            mapes[model_name] = m.get("mape", 100)

        # Peso inversamente proporcional al MAPE
        total_inv = sum(1 / max(m, 0.01) for m in mapes.values())
        if total_inv > 0:
            self.weights = {
                name: (1 / max(mape, 0.01)) / total_inv
                for name, mape in mapes.items()
            }

    def predict(self, horizon: int, baba_ratio: float = None) -> dict:
        """Genera predicciones ensemble para el horizonte dado.

        Returns:
            Dict con predicciones seco, baba, intervalos de confianza,
            pesos del ensemble y métricas individuales.
        """
        if not self.is_fitted:
            raise ValueError("El ensemble no ha sido entrenado.")

        if baba_ratio is None:
            baba_ratio = settings.BABA_TO_SECO_RATIO_DEFAULT

        predictions = {}

        # SARIMA
        try:
            sarima_pred = self.sarima.predict(horizon)
            predictions["sarima"] = sarima_pred["forecast"]
        except Exception:
            predictions["sarima"] = None

        # XGBoost
        try:
            last_row = self._df_features[self._feature_cols].iloc[[-1]]
            xgb_pred = self.xgboost.predict_recursive(last_row, horizon)
            predictions["xgboost"] = xgb_pred
        except Exception:
            predictions["xgboost"] = None

        # LSTM
        try:
            lstm_pred = self.lstm.predict(self._df_features, horizon)
            predictions["lstm"] = lstm_pred
        except Exception:
            predictions["lstm"] = None

        # Ensemble ponderado
        ensemble_pred = self._weighted_average(predictions, horizon)

        # Intervalos de confianza basados en la dispersión entre modelos
        lower_ci, upper_ci = self._calculate_confidence(predictions, ensemble_pred, horizon)

        # Generar fechas futuras
        last_date = self._df_features["Date"].iloc[-1]
        future_dates = pd.bdate_range(start=last_date + pd.Timedelta(days=1), periods=horizon)

        return {
            "dates": [d.strftime("%Y-%m-%d") for d in future_dates],
            "seco": {
                "forecast": ensemble_pred,
                "lower_ci": lower_ci,
                "upper_ci": upper_ci,
            },
            "baba": {
                "forecast": [p * baba_ratio for p in ensemble_pred],
                "lower_ci": [p * baba_ratio for p in lower_ci],
                "upper_ci": [p * baba_ratio for p in upper_ci],
            },
            "individual_predictions": {
                k: v for k, v in predictions.items() if v is not None
            },
            "weights": self.weights,
            "metrics": self.metrics,
        }

    def _weighted_average(self, predictions: dict, horizon: int) -> list[float]:
        """Calcula el promedio ponderado de las predicciones disponibles."""
        result = [0.0] * horizon
        total_weight = 0.0

        for model_name, preds in predictions.items():
            if preds is None:
                continue
            w = self.weights.get(model_name, 0)
            total_weight += w
            for i in range(min(len(preds), horizon)):
                result[i] += preds[i] * w

        if total_weight > 0:
            result = [r / total_weight for r in result]

        return result

    def _calculate_confidence(
        self, predictions: dict, ensemble: list[float], horizon: int
    ) -> tuple[list[float], list[float]]:
        """Calcula intervalos de confianza basados en la dispersión entre modelos."""
        available = [v for v in predictions.values() if v is not None]

        if len(available) < 2:
            # Si solo hay un modelo, usar ±5% como CI
            lower = [p * 0.95 for p in ensemble]
            upper = [p * 1.05 for p in ensemble]
            return lower, upper

        lower, upper = [], []
        for i in range(horizon):
            values = [preds[i] for preds in available if i < len(preds)]
            if values:
                std = np.std(values)
                lower.append(ensemble[i] - 1.96 * std)
                upper.append(ensemble[i] + 1.96 * std)
            else:
                lower.append(ensemble[i] * 0.95)
                upper.append(ensemble[i] * 1.05)

        return lower, upper
