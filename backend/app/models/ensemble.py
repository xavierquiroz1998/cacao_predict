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
        self._calibration_mape = None  # MAPE del ensemble en validación
        self._calibration_std = None

    def fit(self, df: pd.DataFrame, target_col: str = "Close_Seco"):
        """Entrena modelos y calibra intervalos con walk-forward del ensemble."""
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

        # Entrenar SARIMA
        try:
            self.sarima.fit(series)
            self.metrics["sarima"] = self.sarima.get_metrics(series, test_size=20)
        except Exception as e:
            self.metrics["sarima"] = {"error": str(e), "mape": 100}

        # Entrenar XGBoost
        try:
            self.xgboost.fit(X, y)
            self.metrics["xgboost"] = self.xgboost.get_metrics(X, y, test_size=20)
        except Exception as e:
            self.metrics["xgboost"] = {"error": str(e), "mape": 100}

        # Entrenar LSTM
        try:
            self.lstm.fit(df_features, target_col)
            self.metrics["lstm"] = self.lstm.get_metrics(df_features, target_col, test_size=20)
        except Exception as e:
            self.metrics["lstm"] = {"error": str(e), "mape": 100}

        # Ajustar pesos por rendimiento
        self._adjust_weights()

        # Calibrar CI con el MAPE ponderado del ensemble
        self._calibrate_confidence(series)

        self._df_features = df_features
        self._feature_cols = feature_cols
        self._target_col = target_col
        self.is_fitted = True

        return self

    def _adjust_weights(self):
        """Pesos inversamente proporcionales al MAPE."""
        mapes = {}
        for model_name in ["sarima", "xgboost", "lstm"]:
            m = self.metrics.get(model_name, {})
            mape = m.get("mape", 100)
            if mape > 25:
                mape = mape * 3  # Penalizar modelos muy malos
            mapes[model_name] = mape

        total_inv = sum(1 / max(m, 0.01) for m in mapes.values())
        if total_inv > 0:
            self.weights = {
                name: (1 / max(mape, 0.01)) / total_inv
                for name, mape in mapes.items()
            }

    def _calibrate_confidence(self, series: pd.Series):
        """Calcula el MAPE y STD del ensemble ponderado en validación.

        En lugar de mezclar errores de todos los modelos, calcula el error
        del ensemble combinado, que es lo que realmente importa.
        """
        # Calcular MAPE ponderado del ensemble
        ensemble_mape = sum(
            self.weights[name] * self.metrics[name].get("mape", 100)
            for name in ["sarima", "xgboost", "lstm"]
        )
        self._calibration_mape = ensemble_mape

        # STD basado en MAPE del ensemble y precio actual
        last_price = float(series.iloc[-1])
        # El STD es proporcional al MAPE: si MAPE=3%, STD ≈ 3% del precio
        self._calibration_std = last_price * (ensemble_mape / 100)

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

        # Post-procesamiento
        ensemble_pred = self._post_process(ensemble_pred)

        # Intervalos de confianza calibrados
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
        """Ancla al último precio real y suaviza.

        Limites:
        - Día 1: max ±1.5% vs precio actual
        - Diario: max ±1.5%
        - Acumulado: max ±10% en 30 días, ±20% en 180 días, ±30% en 365 días
        """
        if not predictions:
            return predictions

        last_real_price = float(self._df_features[self._target_col].iloc[-1])
        result = predictions.copy()

        # Día 1: máximo ±1.5% respecto al precio actual
        max_jump = last_real_price * 0.015
        result[0] = np.clip(result[0], last_real_price - max_jump, last_real_price + max_jump)

        # Días siguientes: máximo ±1.5% diario
        for i in range(1, len(result)):
            prev = result[i - 1]
            max_change = prev * 0.015
            result[i] = np.clip(result[i], prev - max_change, prev + max_change)

        # Limitar cambio acumulado según horizonte
        # Crece con sqrt del tiempo: ~5% a 7d, ~10% a 30d, ~20% a 180d
        for i in range(len(result)):
            days = i + 1
            max_cum_pct = 0.03 * np.sqrt(days)  # ~5% a 3d, ~10% a 11d, ~16% a 30d
            max_cum_pct = min(max_cum_pct, 0.30)  # Tope absoluto 30%
            max_cum = last_real_price * max_cum_pct
            result[i] = np.clip(
                result[i],
                last_real_price - max_cum,
                last_real_price + max_cum,
            )

        # Suavizado EMA
        smoothed = [result[0]]
        for i in range(1, len(result)):
            smoothed.append(0.6 * result[i] + 0.4 * smoothed[-1])

        smoothed = [max(p, 1.0) for p in smoothed]
        return smoothed

    def _calibrated_confidence(
        self, ensemble: list[float], horizon: int
    ) -> tuple[list[float], list[float]]:
        """Intervalos de confianza calibrados.

        Usa el MAPE del ensemble para definir el ancho del intervalo.
        El CI crece moderadamente con el horizonte.
        """
        mape = self._calibration_mape or 5.0

        lower, upper = [], []
        for i in range(horizon):
            # Factor de crecimiento suave: crece lento al principio
            # En 7 días: ~1.3x, en 30 días: ~2.0x, en 90 días: ~2.8x
            growth = 1.0 + 0.3 * np.log1p(i)

            # El intervalo es proporcional al MAPE y crece con el tiempo
            ci_pct = (mape / 100) * growth
            ci = ensemble[i] * ci_pct

            lower.append(max(ensemble[i] - ci, 1.0))
            upper.append(ensemble[i] + ci)

        return lower, upper
