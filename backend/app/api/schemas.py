"""Schemas Pydantic para la API."""

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    horizon_days: int = Field(default=30, ge=1, le=365, description="Días a predecir")
    baba_ratio: float = Field(
        default=0.40, ge=0.1, le=1.0, description="Ratio precio baba/seco"
    )
    history_years: int = Field(
        default=10, ge=1, le=30, description="Años de historia para entrenar"
    )


class HistoricalRequest(BaseModel):
    years: int = Field(default=10, ge=1, le=30, description="Años de historia")
    interval: str = Field(
        default="daily",
        description="Intervalo: daily, weekly, monthly",
    )


class PricePoint(BaseModel):
    date: str
    seco: float
    baba: float


class PredictionResponse(BaseModel):
    dates: list[str]
    seco: dict
    baba: dict
    individual_predictions: dict
    weights: dict
    metrics: dict


class AnalysisResponse(BaseModel):
    current_price_seco: float
    price_change: float
    price_change_pct: float
    direction: str
    period: str
    factors: list[dict]
    summary: str
