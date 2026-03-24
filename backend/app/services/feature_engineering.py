"""Feature engineering para los modelos de predicción."""

import numpy as np
import pandas as pd


def add_technical_indicators(df: pd.DataFrame, price_col: str = "Close_Seco") -> pd.DataFrame:
    """Agrega indicadores técnicos al dataset.

    - Medias móviles (7, 14, 30, 90 días)
    - RSI (14 días)
    - MACD
    - Volatilidad (desviación estándar rolling)
    - Retornos logarítmicos
    - Bandas de Bollinger
    """
    df = df.copy()

    # Medias móviles
    for window in [7, 14, 30, 90]:
        df[f"ma_{window}"] = df[price_col].rolling(window=window).mean()
        df[f"ma_ratio_{window}"] = df[price_col] / df[f"ma_{window}"]

    # RSI (Relative Strength Index)
    delta = df[price_col].diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, 1e-10)
    df["rsi_14"] = 100 - (100 / (1 + rs))
    df["rsi_14"] = df["rsi_14"].fillna(50)

    # MACD
    ema_12 = df[price_col].ewm(span=12).mean()
    ema_26 = df[price_col].ewm(span=26).mean()
    df["macd"] = ema_12 - ema_26
    df["macd_signal"] = df["macd"].ewm(span=9).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]

    # Volatilidad
    df["volatility_7"] = df[price_col].rolling(window=7).std()
    df["volatility_30"] = df[price_col].rolling(window=30).std()

    # Retornos logarítmicos
    df["log_return_1"] = np.log(df[price_col] / df[price_col].shift(1))
    df["log_return_7"] = np.log(df[price_col] / df[price_col].shift(7))
    df["log_return_30"] = np.log(df[price_col] / df[price_col].shift(30))

    # Bandas de Bollinger
    df["bb_middle"] = df[price_col].rolling(window=20).mean()
    bb_std = df[price_col].rolling(window=20).std()
    df["bb_upper"] = df["bb_middle"] + 2 * bb_std
    df["bb_lower"] = df["bb_middle"] - 2 * bb_std
    bb_range = (df["bb_upper"] - df["bb_lower"]).replace(0, 1e-10)
    df["bb_position"] = (df[price_col] - df["bb_lower"]) / bb_range
    df["bb_position"] = df["bb_position"].fillna(0.5)

    return df


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega features temporales (día de semana, mes, trimestre, etc.)."""
    df = df.copy()

    df["day_of_week"] = df["Date"].dt.dayofweek
    df["month"] = df["Date"].dt.month
    df["quarter"] = df["Date"].dt.quarter
    df["day_of_year"] = df["Date"].dt.dayofyear
    df["week_of_year"] = df["Date"].dt.isocalendar().week.astype(int)

    # Features cíclicos (seno/coseno para capturar estacionalidad)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

    return df


def add_lag_features(
    df: pd.DataFrame, price_col: str = "Close_Seco", lags: list[int] = None
) -> pd.DataFrame:
    """Agrega features de lag (valores pasados del precio)."""
    df = df.copy()

    if lags is None:
        lags = [1, 2, 3, 5, 7, 14, 21, 30]

    for lag in lags:
        df[f"lag_{lag}"] = df[price_col].shift(lag)

    return df


def prepare_features(df: pd.DataFrame, price_col: str = "Close_Seco") -> pd.DataFrame:
    """Pipeline completo de feature engineering."""
    df = add_technical_indicators(df, price_col)
    df = add_temporal_features(df)
    df = add_lag_features(df, price_col)

    # Eliminar filas con NaN generados por los indicadores
    df = df.dropna().reset_index(drop=True)

    return df
