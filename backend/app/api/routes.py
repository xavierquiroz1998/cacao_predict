"""Endpoints de la API CacaoPredict."""

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import (
    PredictionRequest,
    PredictionResponse,
    AnalysisResponse,
)
from app.config import settings
from app.services.data_pipeline import (
    build_master_dataset,
    fetch_cacao_prices,
    calculate_baba_price,
    is_using_demo_data,
)
from app.services.explainability import analyze_price_movement, get_shap_explanation
from app.services.news_service import fetch_news, get_sentiment_summary
from app.services.feature_engineering import prepare_features
from app.models.ensemble import EnsemblePredictor

router = APIRouter()

# Cache del modelo entrenado (se renueva al llamar /predict)
_cached_ensemble: EnsemblePredictor | None = None
_cached_dataset = None


@router.get("/prices/current")
async def get_current_price(baba_ratio: float = Query(default=0.40, ge=0.1, le=1.0)):
    """Obtiene el precio actual del cacao (seco y baba)."""
    try:
        df = fetch_cacao_prices(years=1)
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest

        current_seco = float(latest["Close"])
        prev_seco = float(prev["Close"])
        change = current_seco - prev_seco
        change_pct = (change / prev_seco) * 100 if prev_seco != 0 else 0

        return {
            "date": latest["Date"].strftime("%Y-%m-%d"),
            "is_demo": is_using_demo_data(),
            "seco": {
                "price": round(current_seco, 2),
                "change": round(change, 2),
                "change_pct": round(change_pct, 2),
                "currency": "USD/ton",
            },
            "baba": {
                "price": round(calculate_baba_price(current_seco, baba_ratio), 2),
                "change": round(calculate_baba_price(change, baba_ratio), 2),
                "change_pct": round(change_pct, 2),
                "currency": "USD/ton",
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prices/historical")
async def get_historical_prices(
    years: int = Query(default=10, ge=1, le=30),
    interval: str = Query(default="daily"),
    baba_ratio: float = Query(default=0.40, ge=0.1, le=1.0),
):
    """Obtiene precios históricos del cacao."""
    try:
        df = fetch_cacao_prices(years)

        # Resamplear si se pide intervalo semanal o mensual
        if interval == "weekly":
            df = df.set_index("Date").resample("W").agg(
                {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}
            ).dropna().reset_index()
        elif interval == "monthly":
            df = df.set_index("Date").resample("ME").agg(
                {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}
            ).dropna().reset_index()

        records = []
        for _, row in df.iterrows():
            records.append({
                "date": row["Date"].strftime("%Y-%m-%d"),
                "open_seco": round(float(row["Open"]), 2),
                "high_seco": round(float(row["High"]), 2),
                "low_seco": round(float(row["Low"]), 2),
                "close_seco": round(float(row["Close"]), 2),
                "close_baba": round(calculate_baba_price(float(row["Close"]), baba_ratio), 2),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })

        return {
            "count": len(records),
            "interval": interval,
            "baba_ratio": baba_ratio,
            "data": records,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict", response_model=PredictionResponse)
async def predict_price(request: PredictionRequest):
    """Genera predicciones del precio del cacao usando el ensemble de modelos."""
    global _cached_ensemble, _cached_dataset

    try:
        # Construir dataset maestro
        df = build_master_dataset(request.history_years)
        _cached_dataset = df

        # Entrenar ensemble
        ensemble = EnsemblePredictor()
        ensemble.fit(df)
        _cached_ensemble = ensemble

        # Generar predicciones
        result = ensemble.predict(request.horizon_days, request.baba_ratio)

        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis", response_model=AnalysisResponse)
async def get_analysis(years: int = Query(default=5, ge=1, le=30)):
    """Analiza por qué el precio subió o bajó recientemente."""
    try:
        df = build_master_dataset(years)
        analysis = analyze_price_movement(df)

        if "error" in analysis:
            raise HTTPException(status_code=400, detail=analysis["error"])

        return AnalysisResponse(**analysis)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/shap")
async def get_shap_analysis():
    """Obtiene explicaciones SHAP del modelo XGBoost (requiere haber llamado /predict primero)."""
    global _cached_ensemble, _cached_dataset

    if _cached_ensemble is None or _cached_dataset is None:
        raise HTTPException(
            status_code=400,
            detail="Primero debes llamar a /api/predict para entrenar el modelo.",
        )

    try:
        df_feat = prepare_features(_cached_dataset)
        exclude = ["Date", "Close_Seco"] + [
            c for c in df_feat.columns if c.endswith("_Baba")
        ]
        feature_cols = [
            c
            for c in df_feat.columns
            if c not in exclude and df_feat[c].dtype in ["float64", "int64"]
        ]
        X = df_feat[feature_cols]

        shap_result = get_shap_explanation(_cached_ensemble.xgboost, X)
        return shap_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/factors")
async def get_factors(years: int = Query(default=5, ge=1, le=30)):
    """Obtiene datos de los factores explicativos (clima, commodities, FX)."""
    try:
        df = build_master_dataset(years)

        # Últimos 30 datos
        recent = df.tail(30)

        factors = {}

        # Commodities
        commodity_cols = {
            "coffee_close": "Café",
            "sugar_close": "Azúcar",
            "oil_close": "Petróleo",
            "dollar_index_close": "Índice del Dólar",
        }
        commodities = {}
        for col, name in commodity_cols.items():
            if col in recent.columns:
                values = recent[["Date", col]].dropna()
                commodities[name] = [
                    {"date": r["Date"].strftime("%Y-%m-%d"), "value": round(float(r[col]), 2)}
                    for _, r in values.iterrows()
                ]
        factors["commodities"] = commodities

        # Clima
        climate_data = {}
        climate_cols = [c for c in recent.columns if c.startswith(("temp_", "precip_", "humidity_"))]
        for col in climate_cols:
            values = recent[["Date", col]].dropna()
            climate_data[col] = [
                {"date": r["Date"].strftime("%Y-%m-%d"), "value": round(float(r[col]), 2)}
                for _, r in values.iterrows()
            ]
        factors["climate"] = climate_data

        # Tipo de cambio
        fx_data = {}
        fx_cols = [c for c in recent.columns if c.startswith("fx_")]
        for col in fx_cols:
            values = recent[["Date", col]].dropna()
            fx_data[col] = [
                {"date": r["Date"].strftime("%Y-%m-%d"), "value": round(float(r[col]), 4)}
                for _, r in values.iterrows()
            ]
        factors["exchange_rates"] = fx_data

        return factors
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prices/regional")
async def get_regional_prices(baba_ratio: float = Query(default=0.40, ge=0.1, le=1.0)):
    """Obtiene precios estimados para productores en cada región."""
    try:
        df = fetch_cacao_prices(years=1)
        latest = df.iloc[-1]
        international_price = float(latest["Close"])
        date = latest["Date"].strftime("%Y-%m-%d")

        # Obtener tipos de cambio reales si están disponibles
        fx_rates = {}
        try:
            from app.services.data_pipeline import fetch_exchange_rates
            fx_df = fetch_exchange_rates(years=1)
            if not fx_df.empty:
                last_fx = fx_df.iloc[-1]
                if "fx_usdghs" in last_fx:
                    fx_rates["ghana"] = float(last_fx["fx_usdghs"])
                if "fx_usdxof" in last_fx:
                    fx_rates["costa_de_marfil"] = float(last_fx["fx_usdxof"])
        except Exception:
            pass

        regions = []
        for region_key, config in settings.PRODUCER_PRICE_FACTORS.items():
            producer_price_usd = international_price * config["factor"]
            producer_baba_usd = producer_price_usd * baba_ratio

            region_data = {
                "region": config["label"],
                "region_key": region_key,
                "currency": config["currency"],
                "currency_symbol": config["currency_symbol"],
                "factor": config["factor"],
                "factor_pct": round(config["factor"] * 100, 0),
                "description": config["description"],
                "seco_usd": round(producer_price_usd, 2),
                "baba_usd": round(producer_baba_usd, 2),
                "seco_local": None,
                "baba_local": None,
                "fx_rate": None,
            }

            # Convertir a moneda local si hay tipo de cambio
            if config["currency"] != "USD":
                fx = fx_rates.get(region_key, config.get("fx_rate_fallback"))
                if fx:
                    region_data["seco_local"] = round(producer_price_usd * fx, 2)
                    region_data["baba_local"] = round(producer_baba_usd * fx, 2)
                    region_data["fx_rate"] = round(fx, 2)

            regions.append(region_data)

        return {
            "date": date,
            "is_demo": is_using_demo_data(),
            "international_price_usd": round(international_price, 2),
            "regions": regions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news")
async def get_news(
    max_articles: int = Query(default=15, ge=1, le=50),
    lang: str = Query(default="en"),
):
    """Obtiene noticias recientes del cacao con análisis de sentimiento."""
    try:
        articles = fetch_news(max_articles=max_articles, lang=lang)
        summary = get_sentiment_summary(articles)

        return {
            "articles": articles,
            "sentiment_summary": summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
