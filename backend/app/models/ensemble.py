"""Modelo ensemble mejorado: combina SARIMA, XGBoost y LSTM con calibración."""

import numpy as np
import pandas as pd

from app.models.sarima_model import SARIMAPredictor
from app.models.xgboost_model import XGBoostPredictor
from app.models.lstm_model import LSTMPredictor
from app.services.feature_engineering import prepare_features
from app.config import settings


class EnsemblePredictor:
    """Ensemble con pesos calibrados, intervalos realistas y post-procesamiento."""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.sarima = SARIMAPredictor()
        self.xgboost = XGBoostPredictor(seed=seed)
        self.lstm = LSTMPredictor(seed=seed)
        self.weights = {"sarima": 0.3, "xgboost": 0.4, "lstm": 0.3}
        self.is_fitted = False
        self.metrics = {}
        self._calibration_std = None  # Error estándar real de validación

    def fit(self, df: pd.DataFrame, target_col: str = "Close_Seco"):
        """Entrena modelos con walk-forward validation y calibra intervalos."""
        np.random.seed(self.seed)

        df_features = prepare_features(df, target_col)

        exclude = ["Date", target_col] + [
            c for c in df_features.columns if c.endswith("_Baba")
        ]
        feature_cols = [
            c for c in df_features.columns
            if c not in exclude and df_features[c].dtype in [np.float64, np.int64, np.int32, np.float32]
        ]

        X = df_features[feature_cols]
        y = df_features[target_col]
        series = df_features[target_col]

        all_validation_errors = []

        # Entrenar SARIMA
        try:
            self.sarima.fit(series)
            self.metrics["sarima"] = self.sarima.get_metrics(series)
            if self.sarima._validation_errors:
                all_validation_errors.extend(self.sarima._validation_errors)
        except Exception as e:
            self.metrics["sarima"] = {"error": str(e), "mape": 100}

        # Entrenar XGBoost
        try:
            self.xgboost.fit(X, y)
            self.metrics["xgboost"] = self.xgboost.get_metrics(X, y)
            if self.xgboost._validation_errors:
                all_validation_errors.extend(self.xgboost._validation_errors)
        except Exception as e:
            self.metrics["xgboost"] = {"error": str(e), "mape": 100}

        # Entrenar LSTM
        try:
            self.lstm.fit(df_features, target_col)
            self.metrics["lstm"] = self.lstm.get_metrics(df_features, target_col)
            if self.lstm._validation_errors:
                all_validation_errors.extend(self.lstm._validation_errors)
        except Exception as e:
            self.metrics["lstm"] = {"error": str(e), "mape": 100}

        # Calibrar intervalos de confianza con errores reales
        if all_validation_errors:
            self._calibration_std = float(np.std(all_validation_errors))
        else:
            last_price = series.iloc[-1]
            self._calibration_std = last_price * 0.02  # Fallback: 2%

        # Ajustar pesos
        self._adjust_weights()

        self._df_features = df_features
        self._feature_cols = feature_cols
        self._target_col = target_col
        self.is_fitted = True

        return self

    def _adjust_weights(self):
        """Pesos inversamente proporcionales al MAPE, con suavizado."""
        mapes = {}
        for model_name in ["sarima", "xgboost", "lstm"]:
            m = self.metrics.get(model_name, {})
            mape = m.get("mape", 100)
            # Penalizar modelos con MAPE > 20% más agresivamente
            if mape > 20:
                mape = mape * 2
            mapes[model_name] = mape

        total_inv = sum(1 / max(m, 0.01) for m in mapes.values())
        if total_inv > 0:
            self.weights = {
                name: (1 / max(mape, 0.01)) / total_inv
                for name, mape in mapes.items()
            }

    def predict(self, horizon: int, baba_ratio: float = None) -> dict:
        """Genera predicciones ensemble con intervalos calibrados."""
        if not self.is_fitted:
            raise ValueError("El ensemble no ha sido entrenado.")

        np.random.seed(self.seed)

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
            last_row = self._df_features[self.xgboost._selected_features].iloc[[-1]]
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

        # Post-procesamiento: suavizar predicciones extremas
        ensemble_pred = self._post_process(ensemble_pred)

        # Intervalos de confianza calibrados con errores reales
        lower_ci, upper_ci = self._calibrated_confidence(ensemble_pred, horizon)

        # Fechas futuras
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
        """Promedio ponderado de predicciones disponibles."""
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

    def _post_process(self, predictions: list[float]) -> list[float]:
        """Post-procesamiento: ancla al último precio real y suaviza.

        - Ancla el primer día al precio actual (máximo ±2% de salto)
        - Limita cambios diarios a ±2%
        - Suaviza con EMA
        - Asegura valores positivos
        """
        if not predictions:
            return predictions

        # Anclar al último precio real
        last_real_price = float(self._df_features[self._target_col].iloc[-1])
        result = predictions.copy()

        # El día 1 no puede saltar más del 2% respecto al precio actual
        max_jump = last_real_price * 0.02
        result[0] = np.clip(result[0], last_real_price - max_jump, last_real_price + max_jump)

        # Limitar cambios diarios a ±2%
        for i in range(1, len(result)):
            prev = result[i - 1]
            max_change = prev * 0.02
            result[i] = np.clip(result[i], prev - max_change, prev + max_change)

        # Suavizado EMA (alpha=0.6)
        smoothed = [result[0]]
        for i in range(1, len(result)):
            smoothed.append(0.6 * result[i] + 0.4 * smoothed[-1])

        smoothed = [max(p, 1.0) for p in smoothed]

        return smoothed

    def _calibrated_confidence(
        self, ensemble: list[float], horizon: int
    ) -> tuple[list[float], list[float]]:
        """Intervalos de confianza calibrados con errores reales de validación.

        El intervalo crece con el horizonte (más incertidumbre a futuro).
        """
        base_std = self._calibration_std or (ensemble[0] * 0.02)

        lower, upper = [], []
        for i in range(horizon):
            # La incertidumbre crece con sqrt del tiempo (random walk)
            growth_factor = np.sqrt(1 + i * 0.5)
            ci = 1.96 * base_std * growth_factor

            lower.append(max(ensemble[i] - ci, 1.0))
            upper.append(ensemble[i] + ci)

        return lower, upper
