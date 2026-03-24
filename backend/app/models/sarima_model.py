"""Modelo SARIMA para predicción de series temporales del cacao."""

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX


class SARIMAPredictor:
    """Predictor basado en SARIMA (Seasonal ARIMA)."""

    def __init__(self, order=(1, 1, 1), seasonal_order=(1, 1, 1, 30)):
        self.order = order
        self.seasonal_order = seasonal_order
        self.model = None
        self.fitted = None

    def fit(self, series: pd.Series):
        """Entrena el modelo SARIMA con la serie de precios."""
        self.model = SARIMAX(
            series,
            order=self.order,
            seasonal_order=self.seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        self.fitted = self.model.fit(disp=False, maxiter=200)
        return self

    def predict(self, horizon: int) -> dict:
        """Genera predicciones para el horizonte especificado.

        Returns:
            Dict con 'forecast', 'lower_ci', 'upper_ci' como listas.
        """
        if self.fitted is None:
            raise ValueError("El modelo no ha sido entrenado. Llama a fit() primero.")

        forecast = self.fitted.get_forecast(steps=horizon)
        mean = forecast.predicted_mean
        ci = forecast.conf_int(alpha=0.05)

        return {
            "forecast": mean.values.tolist(),
            "lower_ci": ci.iloc[:, 0].values.tolist(),
            "upper_ci": ci.iloc[:, 1].values.tolist(),
        }

    def get_metrics(self, series: pd.Series, test_size: int = 30) -> dict:
        """Calcula métricas de rendimiento usando los últimos test_size días."""
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

        mse = np.mean((test.values - predictions.values) ** 2)
        rmse = np.sqrt(mse)
        mae = np.mean(np.abs(test.values - predictions.values))
        mape = np.mean(np.abs((test.values - predictions.values) / test.values)) * 100

        return {"mse": mse, "rmse": rmse, "mae": mae, "mape": mape}
