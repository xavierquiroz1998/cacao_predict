"""Pipeline de datos: descarga y procesamiento de datos históricos del cacao.

Intenta obtener datos reales de Yahoo Finance y Open-Meteo.
Si no hay conexión (ej: red corporativa con SSL bloqueado), usa datos de demostración.
"""

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests
import yfinance as yf

from app.config import settings
from app.services.demo_data import (
    generate_cacao_prices,
    generate_climate_data,
    generate_exchange_rates,
    generate_related_commodities,
)

logger = logging.getLogger(__name__)

_using_demo_data = False


def is_using_demo_data() -> bool:
    """Retorna True si se están usando datos de demostración."""
    return _using_demo_data


def fetch_cacao_prices(years: int = None) -> pd.DataFrame:
    """Descarga precios históricos del cacao desde Yahoo Finance.

    Si falla la conexión, usa datos de demostración.
    """
    global _using_demo_data

    if years is None:
        years = settings.DEFAULT_HISTORY_YEARS

    end = datetime.now()
    start = end - timedelta(days=years * 365)

    try:
        ticker = yf.Ticker(settings.CACAO_TICKER)
        df = ticker.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))

        if df.empty:
            raise ValueError("DataFrame vacío")

        df = df.reset_index()
        df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
        df = df[["Date", "Open", "High", "Low", "Close", "Volume"]].copy()
        df = df.sort_values("Date").reset_index(drop=True)
        _using_demo_data = False
        return df
    except Exception as e:
        logger.warning(f"No se pudo conectar a Yahoo Finance: {e}. Usando datos de demostración.")
        _using_demo_data = True
        return generate_cacao_prices(years)


def fetch_related_commodities(years: int = None) -> pd.DataFrame:
    """Descarga precios de commodities relacionados. Fallback a demo data."""
    if years is None:
        years = settings.DEFAULT_HISTORY_YEARS

    end = datetime.now()
    start = end - timedelta(days=years * 365)

    tickers = {
        "coffee": settings.COFFEE_TICKER,
        "sugar": settings.SUGAR_TICKER,
        "oil": settings.OIL_TICKER,
        "dollar_index": settings.DOLLAR_INDEX_TICKER,
    }

    all_data = {}
    for name, ticker in tickers.items():
        try:
            t = yf.Ticker(ticker)
            df = t.history(
                start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d")
            )
            if not df.empty:
                df = df.reset_index()
                df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
                all_data[name] = df[["Date", "Close"]].rename(
                    columns={"Close": f"{name}_close"}
                )
        except Exception:
            continue

    if not all_data:
        logger.warning("No se pudieron obtener commodities. Usando datos demo.")
        return generate_related_commodities(years)

    result = None
    for name, df in all_data.items():
        if result is None:
            result = df
        else:
            result = pd.merge(result, df, on="Date", how="outer")

    result = result.sort_values("Date").reset_index(drop=True)
    return result


def fetch_exchange_rates(years: int = None) -> pd.DataFrame:
    """Descarga tipos de cambio USD. Fallback a demo data."""
    if years is None:
        years = settings.DEFAULT_HISTORY_YEARS

    end = datetime.now()
    start = end - timedelta(days=years * 365)

    all_data = {}
    for ticker in settings.FX_TICKERS:
        try:
            t = yf.Ticker(ticker)
            df = t.history(
                start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d")
            )
            if not df.empty:
                df = df.reset_index()
                df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
                name = ticker.replace("=X", "").lower()
                all_data[name] = df[["Date", "Close"]].rename(
                    columns={"Close": f"fx_{name}"}
                )
        except Exception:
            continue

    if not all_data:
        logger.warning("No se pudieron obtener tipos de cambio. Usando datos demo.")
        return generate_exchange_rates(years)

    result = None
    for name, df in all_data.items():
        if result is None:
            result = df
        else:
            result = pd.merge(result, df, on="Date", how="outer")

    return result.sort_values("Date").reset_index(drop=True)


def fetch_climate_data(years: int = None) -> pd.DataFrame:
    """Descarga datos climáticos de Open-Meteo. Fallback a demo data."""
    if years is None:
        years = min(settings.DEFAULT_HISTORY_YEARS, 30)

    end = datetime.now()
    start = end - timedelta(days=years * 365)

    all_climate = []

    for region, coords in settings.CLIMATE_LOCATIONS.items():
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": coords["lat"],
            "longitude": coords["lon"],
            "start_date": start.strftime("%Y-%m-%d"),
            "end_date": end.strftime("%Y-%m-%d"),
            "daily": "temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean",
            "timezone": "auto",
        }

        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            daily = data.get("daily", {})
            if not daily or not daily.get("time"):
                continue

            region_key = region.split("(")[0].strip().lower().replace(" ", "_")
            df = pd.DataFrame(
                {
                    "Date": pd.to_datetime(daily["time"]),
                    f"temp_{region_key}": daily.get("temperature_2m_mean"),
                    f"precip_{region_key}": daily.get("precipitation_sum"),
                    f"humidity_{region_key}": daily.get(
                        "relative_humidity_2m_mean"
                    ),
                }
            )
            all_climate.append(df)
        except Exception:
            continue

    if not all_climate:
        logger.warning("No se pudieron obtener datos climáticos. Usando datos demo.")
        return generate_climate_data(years)

    result = all_climate[0]
    for df in all_climate[1:]:
        result = pd.merge(result, df, on="Date", how="outer")

    return result.sort_values("Date").reset_index(drop=True)


def calculate_baba_price(
    seco_price: float | pd.Series, ratio: float = None
) -> float | pd.Series:
    """Calcula el precio del cacao en baba a partir del precio seco."""
    if ratio is None:
        ratio = settings.BABA_TO_SECO_RATIO_DEFAULT
    return seco_price * ratio


def build_master_dataset(years: int = None) -> pd.DataFrame:
    """Construye el dataset maestro combinando todas las fuentes de datos."""
    # Datos principales del cacao
    cacao = fetch_cacao_prices(years)

    # Agregar precio en baba
    cacao["Close_Baba"] = calculate_baba_price(cacao["Close"])
    cacao["Open_Baba"] = calculate_baba_price(cacao["Open"])
    cacao["High_Baba"] = calculate_baba_price(cacao["High"])
    cacao["Low_Baba"] = calculate_baba_price(cacao["Low"])

    # Renombrar columnas de precio seco
    cacao = cacao.rename(
        columns={
            "Close": "Close_Seco",
            "Open": "Open_Seco",
            "High": "High_Seco",
            "Low": "Low_Seco",
        }
    )

    # Commodities relacionados
    try:
        commodities = fetch_related_commodities(years)
        if not commodities.empty:
            cacao = pd.merge(cacao, commodities, on="Date", how="left")
    except Exception:
        pass

    # Tipos de cambio
    try:
        fx = fetch_exchange_rates(years)
        if not fx.empty:
            cacao = pd.merge(cacao, fx, on="Date", how="left")
    except Exception:
        pass

    # Datos climáticos
    try:
        climate = fetch_climate_data(years)
        if not climate.empty:
            cacao = pd.merge(cacao, climate, on="Date", how="left")
    except Exception:
        pass

    # Rellenar valores faltantes con interpolación
    numeric_cols = cacao.select_dtypes(include=[np.number]).columns
    cacao[numeric_cols] = cacao[numeric_cols].interpolate(method="linear")
    cacao = cacao.dropna(subset=["Close_Seco"])

    return cacao.sort_values("Date").reset_index(drop=True)
