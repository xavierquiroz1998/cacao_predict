"""Generador de datos de demostración realistas para el precio del cacao.

Se usa como fallback cuando no hay conexión a las APIs externas (ej: red corporativa).
Los datos simulan patrones reales basados en el comportamiento histórico del cacao:
- 2016-2022: rango estable ~$2,000-$2,800 USD/ton
- 2023: subida fuerte a ~$4,000
- 2024 (pico histórico): ~$10,000-$12,000
- 2025: corrección a ~$5,000-$7,000
- Mar 2026: estabilización ~$3,000-$3,300
"""

from datetime import datetime, timedelta

import numpy as np
import pandas as pd


def _build_price_curve(n: int, years: int) -> np.ndarray:
    """Construye una curva de precios basada en el historial real del cacao."""
    np.random.seed(42)
    t = np.linspace(0, 1, n)

    # Definir fases del mercado basadas en años reales
    # Calcular qué fracción del rango temporal corresponde a cada fase
    end_year = 2026.22  # Mar 2026
    start_year = end_year - years

    price = np.zeros(n)
    for i in range(n):
        year = start_year + (end_year - start_year) * t[i]

        if year < 2020:
            # 2016-2019: Rango estable $2,000-$2,600
            base = 2300 + 200 * np.sin(2 * np.pi * (year - 2016) / 3)
        elif year < 2022:
            # 2020-2021: Leve subida por pandemia, $2,200-$2,800
            base = 2500 + 300 * (year - 2020) / 2
        elif year < 2023:
            # 2022: Inicio de subida, $2,500-$3,200
            base = 2800 + 400 * (year - 2022)
        elif year < 2023.75:
            # 2023 Q1-Q3: Subida acelerada a $4,000
            base = 3200 + 1200 * (year - 2023) / 0.75
        elif year < 2024.25:
            # 2023 Q4 - 2024 Q1: Explosión a $10,000+
            progress = (year - 2023.75) / 0.5
            base = 4400 + 7000 * progress ** 1.5
        elif year < 2024.75:
            # 2024 Q2-Q3: Pico y meseta $10,000-$12,000
            base = 11000 + 1000 * np.sin(2 * np.pi * (year - 2024.25) * 4)
        elif year < 2025.25:
            # 2024 Q4 - 2025 Q1: Inicio corrección $12,000 → $7,000
            progress = (year - 2024.75) / 0.5
            base = 11500 - 4500 * progress
        elif year < 2025.75:
            # 2025 Q2-Q3: Corrección continuada $7,000 → $4,500
            progress = (year - 2025.25) / 0.5
            base = 7000 - 2500 * progress
        elif year < 2026.0:
            # 2025 Q4: Corrección final $4,500 → $3,500
            progress = (year - 2025.75) / 0.25
            base = 4500 - 1000 * progress
        else:
            # 2026 Q1 (actual): Estabilización $3,000-$3,300
            base = 3150 + 100 * np.sin(2 * np.pi * (year - 2026.0) * 12)

        price[i] = base

    return price


def generate_cacao_prices(years: int = 10) -> pd.DataFrame:
    """Genera precios históricos simulados del cacao con patrones realistas.

    Basado en el comportamiento real del mercado 2016-2026.
    Precio actual (Mar 2026): ~$3,000-$3,300 USD/ton.
    """
    np.random.seed(42)

    end = datetime.now()
    start = end - timedelta(days=years * 365)
    dates = pd.bdate_range(start=start, end=end)
    n = len(dates)

    # Curva base de precios
    price = _build_price_curve(n, years)

    # Estacionalidad anual (cosechas en Oct-Mar principal, May-Jul secundaria)
    seasonal = np.zeros(n)
    for i, d in enumerate(dates):
        month = d.month
        # Precios suben antes de cosecha principal (Jul-Sep), bajan después (Nov-Jan)
        seasonal[i] = 80 * np.sin(2 * np.pi * (month - 3) / 12)

    price = price + seasonal

    # Ruido diario realista (volatilidad ~1.5% diario)
    daily_noise = np.cumsum(np.random.normal(0, 0.008, n))
    price = price * (1 + daily_noise * 0.15)

    # Clip a rango realista
    price = np.clip(price, 1600, 13000)

    # OHLCV
    daily_vol = np.abs(np.random.normal(0, 0.015, n))
    df = pd.DataFrame({
        "Date": dates[:n],
        "Open": price * (1 + np.random.normal(0, 0.004, n)),
        "High": price * (1 + daily_vol),
        "Low": price * (1 - daily_vol),
        "Close": price,
        "Volume": np.random.randint(5000, 50000, n),
    })

    return df.sort_values("Date").reset_index(drop=True)


def generate_related_commodities(years: int = 10) -> pd.DataFrame:
    """Genera precios simulados de commodities relacionados."""
    np.random.seed(123)

    end = datetime.now()
    start = end - timedelta(days=years * 365)
    dates = pd.bdate_range(start=start, end=end)
    n = len(dates)
    t = np.linspace(0, 1, n)

    # Café: rango $100-$400
    coffee = 180 + 80 * t + 30 * np.sin(2 * np.pi * t * 3) + np.cumsum(np.random.normal(0, 2, n))
    coffee = np.clip(coffee, 100, 450)

    # Azúcar: rango $10-$30
    sugar = 15 + 5 * t + 3 * np.sin(2 * np.pi * t * 2) + np.cumsum(np.random.normal(0, 0.3, n))
    sugar = np.clip(sugar, 8, 35)

    # Petróleo: rango $40-$120
    oil = 65 + 20 * np.sin(2 * np.pi * t * 1.5) + np.cumsum(np.random.normal(0, 1, n))
    oil = np.clip(oil, 30, 130)

    # Índice del dólar: rango 90-110
    dollar = 100 + 5 * np.sin(2 * np.pi * t * 2) + np.cumsum(np.random.normal(0, 0.2, n))
    dollar = np.clip(dollar, 88, 115)

    return pd.DataFrame({
        "Date": dates[:n],
        "coffee_close": coffee,
        "sugar_close": sugar,
        "oil_close": oil,
        "dollar_index_close": dollar,
    })


def generate_exchange_rates(years: int = 10) -> pd.DataFrame:
    """Genera tipos de cambio simulados."""
    np.random.seed(456)

    end = datetime.now()
    start = end - timedelta(days=years * 365)
    dates = pd.bdate_range(start=start, end=end)
    n = len(dates)
    t = np.linspace(0, 1, n)

    # USD/GHS (Ghana Cedi): rango 4-16 (depreciación continua)
    usdghs = 5 + 10 * t + np.cumsum(np.random.normal(0, 0.03, n))
    usdghs = np.clip(usdghs, 3, 20)

    # USD/XOF (Franco CFA): rango 550-650 (relativamente estable, pegado al EUR)
    usdxof = 590 + 20 * np.sin(2 * np.pi * t) + np.cumsum(np.random.normal(0, 0.5, n))
    usdxof = np.clip(usdxof, 520, 680)

    return pd.DataFrame({
        "Date": dates[:n],
        "fx_usdghs": usdghs,
        "fx_usdxof": usdxof,
    })


def generate_climate_data(years: int = 10) -> pd.DataFrame:
    """Genera datos climáticos simulados para las regiones productoras."""
    np.random.seed(789)

    end = datetime.now()
    start = end - timedelta(days=years * 365)
    dates = pd.date_range(start=start, end=end, freq="D")
    n = len(dates)

    day_of_year = dates.dayofyear.values

    regions = {
        "costa_de_marfil": {"temp_base": 27, "precip_base": 5, "humidity_base": 80},
        "ghana": {"temp_base": 26, "precip_base": 4.5, "humidity_base": 75},
        "ecuador": {"temp_base": 25, "precip_base": 6, "humidity_base": 85},
    }

    data = {"Date": dates}

    for region, params in regions.items():
        # Temperatura con estacionalidad
        temp_seasonal = 3 * np.sin(2 * np.pi * day_of_year / 365)
        data[f"temp_{region}"] = (
            params["temp_base"] + temp_seasonal + np.random.normal(0, 1.5, n)
        )

        # Precipitación con estación lluviosa/seca
        precip_seasonal = np.maximum(0, 8 * np.sin(2 * np.pi * (day_of_year - 90) / 365))
        data[f"precip_{region}"] = np.maximum(
            0, params["precip_base"] + precip_seasonal + np.random.exponential(2, n)
        )

        # Humedad
        humidity_seasonal = 10 * np.sin(2 * np.pi * (day_of_year - 90) / 365)
        data[f"humidity_{region}"] = np.clip(
            params["humidity_base"] + humidity_seasonal + np.random.normal(0, 5, n),
            40,
            100,
        )

    return pd.DataFrame(data)
