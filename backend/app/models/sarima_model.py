"""Modelo SARIMA mejorado para predicción de series temporales del cacao."""

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller


class SARIMAPredictor:
    """Predictor SARIMA con auto-selección de parámetros y walk-forward validation."""

    def __init__(self, order=None, seasonal_order=None):
        self.order = order
        self.seasonal_order = seasonal_order
        self.model = None
        self.fitted = None
        self._validation_errors = []

    def _auto_select_order(self, series: pd.Series):
        """Selecciona automáticamente los mejores parámetros (p,d,q) y estacionales."""
        # Determinar d (orden de diferenciación)
        d = 0
        test_series = series.copy()
        for i in range(3):
            result = adfuller(test_series.dropna(), autolag="AIC")
            if result[1] < 0.05:
                break
            d += 1
            test_series = test_series.diff().dropna()

        # Probar combinaciones simples y elegir la de menor AIC
        best_aic = np.inf
        best_order = (1, d, 1)
        best_seasonal = (0, 0, 0, 0)

        candidates = [
            ((1, d, 1), (0, 0, 0, 0)),
            ((2, d, 1), (0, 0, 0, 0)),
            ((1, d, 2), (0, 0, 0, 0)),
            ((2, d, 2), (0, 0, 0, 0)),
            ((1, d, 1), (1, 0, 1, 5)),
            ((1, d, 1), (1, 0, 0, 5)),
        ]

        for order, seasonal in candidates:
            try:
                model = SARIMAX(
                    series[-500:],  # Usar últimos 500 puntos para velocidad
                    order=order,
                    seasonal_order=seasonal,
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
                fit = model.fit(disp=False, maxiter=100)
                if fit.aic < best_aic:
                    best_aic = fit.aic
                    best_order = order
                    best_seasonal = seasonal
            except Exception:
                continue

        self.order = best_order
        self.seasonal_order = best_seasonal

    def fit(self, series: pd.Series):
        """Entrena el modelo SARIMA con auto-selección de parámetros."""
        if self.order is None:
            self._auto_select_order(series)

        self.model = SARIMAX(
            series,
            order=self.order,
            seasonal_order=self.seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        self.fitted = self.model.fit(disp=False, maxiter=300)
        return self

    def predict(self, horizon: int) -> dict:
        """Genera predicciones con intervalos de confianza."""
        if self.fitted is None:
            raise ValueError("El modelo no ha sido entrenado.")

        forecast = self.fitted.get_forecast(steps=horizon)
        mean = forecast.predicted_mean
        ci = forecast.conf_int(alpha=0.05)

        return {
            "forecast": mean.values.tolist(),
            "lower_ci": ci.iloc[:, 0].values.tolist(),
            "upper_ci": ci.iloc[:, 1].values.tolist(),
        }

    def get_metrics(self, series: pd.Series, test_size: int = 30) -> dict:
        """Walk-forward validation: entrena con datos pasados, valida con recientes."""
        train = series[:-test_size]
        test = series[-test_size:]

        temp_model = SARIMAX(
            train,
            order=self.order,
            seasonal_order=self.seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        temp_fitted = temp_model.fit(disp=False, maxiter=200)
        predictions = temp_fitted.get_forecast(steps=test_size).predicted_mean

        errors = test.values - predictions.values
        self._validation_errors = errors.tolist()

        mse = float(np.mean(errors ** 2))
        rmse = float(np.sqrt(mse))
        mae = float(np.mean(np.abs(errors)))
        mape = float(np.mean(np.abs(errors / test.values)) * 100)

        return {"mse": mse, "rmse": rmse, "mae": mae, "mape": mape}
