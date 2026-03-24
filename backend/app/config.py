"""Configuración central de la aplicación CacaoPredict."""

from pydantic import BaseModel


class Settings(BaseModel):
    """Configuración de la aplicación."""

    APP_NAME: str = "CacaoPredict"
    APP_VERSION: str = "1.0.0"

    # Tickers de yfinance
    CACAO_TICKER: str = "CC=F"
    COFFEE_TICKER: str = "KC=F"
    SUGAR_TICKER: str = "SB=F"
    OIL_TICKER: str = "CL=F"
    DOLLAR_INDEX_TICKER: str = "DX-Y.NYB"

    # Tipos de cambio relevantes (USD vs monedas de países productores)
    FX_TICKERS: list[str] = ["USDGHS=X", "USDXOF=X"]

    # Coordenadas de regiones productoras para datos climáticos
    CLIMATE_LOCATIONS: dict[str, dict[str, float]] = {
        "Costa de Marfil (Abidjan)": {"lat": 5.36, "lon": -4.01},
        "Ghana (Kumasi)": {"lat": 6.69, "lon": -1.62},
        "Ecuador (Guayaquil)": {"lat": -2.19, "lon": -79.89},
    }

    # Factor de conversión baba → seco
    # Se necesitan aprox 2.5 kg de cacao en baba para 1 kg de seco
    # Por lo tanto, el precio del cacao en baba es ~40% del precio seco
    BABA_TO_SECO_RATIO_DEFAULT: float = 0.40

    # Precios regionales: factor que recibe el productor respecto al precio internacional
    # Incluye descuentos por calidad, transporte, intermediarios, impuestos, etc.
    PRODUCER_PRICE_FACTORS: dict[str, dict] = {
        "ecuador": {
            "label": "Ecuador",
            "currency": "USD",
            "currency_symbol": "$",
            "factor": 0.62,  # Productor recibe ~62% del precio internacional
            "description": "Ecuador usa USD. Quintal (46kg) entre $80-$100 en centros de acopio (Mar 2026). Varía por zona, calidad (CCN-51 vs Nacional) e intermediarios.",
        },
        "costa_de_marfil": {
            "label": "Costa de Marfil",
            "currency": "XOF",
            "currency_symbol": "FCFA",
            "factor": 0.60,  # Regulado por el Conseil du Café-Cacao
            "fx_rate_fallback": 615.0,  # USD → XOF aprox
            "description": "Precio regulado por el Conseil du Café-Cacao. El productor recibe ~60% del precio FOB.",
        },
        "ghana": {
            "label": "Ghana",
            "currency": "GHS",
            "currency_symbol": "GH₵",
            "factor": 0.65,  # Regulado por COCOBOD
            "fx_rate_fallback": 15.5,  # USD → GHS aprox
            "description": "Precio regulado por COCOBOD (Ghana Cocoa Board). El productor recibe ~65% del precio FOB.",
        },
    }

    # Período histórico por defecto (años)
    DEFAULT_HISTORY_YEARS: int = 10

    # Horizonte de predicción por defecto (días)
    DEFAULT_PREDICTION_HORIZON_DAYS: int = 30

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


settings = Settings()
