"""Motor de explicabilidad: analiza por qué el precio sube o baja."""

import numpy as np
import pandas as pd

from app.services.feature_engineering import prepare_features


def analyze_price_movement(df: pd.DataFrame, target_col: str = "Close_Seco") -> dict:
    """Analiza el movimiento reciente del precio y sus posibles causas.

    Examina correlaciones, cambios en variables explicativas y
    genera una explicación legible.
    """
    df_feat = prepare_features(df, target_col)

    if len(df_feat) < 30:
        return {"error": "No hay suficientes datos para el análisis."}

    recent = df_feat.tail(30)
    previous = df_feat.iloc[-60:-30] if len(df_feat) >= 60 else df_feat.head(30)

    current_price = recent[target_col].iloc[-1]
    prev_price = recent[target_col].iloc[0]
    price_change = current_price - prev_price
    price_change_pct = (price_change / prev_price) * 100

    direction = "subió" if price_change > 0 else "bajó"

    # Analizar factores
    factors = []

    # 1. Indicadores técnicos
    rsi = recent["rsi_14"].iloc[-1]
    if rsi > 70:
        factors.append({
            "factor": "RSI (Sobrecompra)",
            "value": round(rsi, 1),
            "impact": "negativo",
            "description": "El RSI indica sobrecompra (>70), lo que sugiere una posible corrección a la baja.",
        })
    elif rsi < 30:
        factors.append({
            "factor": "RSI (Sobreventa)",
            "value": round(rsi, 1),
            "impact": "positivo",
            "description": "El RSI indica sobreventa (<30), lo que sugiere un posible rebote al alza.",
        })

    # 2. Tendencia (MA)
    ma_30 = recent["ma_30"].iloc[-1]
    if current_price > ma_30:
        factors.append({
            "factor": "Tendencia (MA 30)",
            "value": round(ma_30, 2),
            "impact": "positivo",
            "description": f"El precio (${current_price:.2f}) está por encima de la media de 30 días (${ma_30:.2f}), indicando tendencia alcista.",
        })
    else:
        factors.append({
            "factor": "Tendencia (MA 30)",
            "value": round(ma_30, 2),
            "impact": "negativo",
            "description": f"El precio (${current_price:.2f}) está por debajo de la media de 30 días (${ma_30:.2f}), indicando tendencia bajista.",
        })

    # 3. MACD
    macd = recent["macd"].iloc[-1]
    macd_signal = recent["macd_signal"].iloc[-1]
    if macd > macd_signal:
        factors.append({
            "factor": "MACD",
            "value": round(macd, 2),
            "impact": "positivo",
            "description": "El MACD está por encima de la señal, indicando momentum alcista.",
        })
    else:
        factors.append({
            "factor": "MACD",
            "value": round(macd, 2),
            "impact": "negativo",
            "description": "El MACD está por debajo de la señal, indicando momentum bajista.",
        })

    # 4. Volatilidad
    vol_current = recent["volatility_30"].iloc[-1]
    vol_previous = previous["volatility_30"].iloc[-1] if "volatility_30" in previous.columns else vol_current
    vol_change = ((vol_current - vol_previous) / max(vol_previous, 0.01)) * 100
    if abs(vol_change) > 20:
        factors.append({
            "factor": "Volatilidad",
            "value": round(vol_current, 2),
            "impact": "neutral",
            "description": f"La volatilidad {'aumentó' if vol_change > 0 else 'disminuyó'} un {abs(vol_change):.1f}% respecto al período anterior.",
        })

    # 5. Commodities relacionados
    commodity_cols = {
        "coffee_close": "Café",
        "sugar_close": "Azúcar",
        "oil_close": "Petróleo",
        "dollar_index_close": "Índice del Dólar",
    }
    for col, name in commodity_cols.items():
        if col in recent.columns and col in previous.columns:
            curr = recent[col].iloc[-1]
            prev = previous[col].iloc[-1]
            if pd.notna(curr) and pd.notna(prev) and prev != 0:
                change = ((curr - prev) / prev) * 100
                if abs(change) > 5:
                    factors.append({
                        "factor": name,
                        "value": round(curr, 2),
                        "impact": "positivo" if (change > 0 and name != "Índice del Dólar") else "negativo",
                        "description": f"{name} {'subió' if change > 0 else 'bajó'} un {abs(change):.1f}%. "
                        + (
                            "Un dólar más fuerte tiende a presionar los precios del cacao a la baja."
                            if name == "Índice del Dólar" and change > 0
                            else f"Los movimientos en {name.lower()} suelen correlacionarse con el cacao."
                        ),
                    })

    # 6. Factores climáticos
    climate_cols = [c for c in recent.columns if c.startswith(("temp_", "precip_", "humidity_"))]
    for col in climate_cols:
        if col in previous.columns:
            curr_mean = recent[col].mean()
            prev_mean = previous[col].mean()
            if pd.notna(curr_mean) and pd.notna(prev_mean) and prev_mean != 0:
                change = ((curr_mean - prev_mean) / abs(prev_mean)) * 100
                if abs(change) > 15:
                    region = col.split("_", 1)[1] if "_" in col else col
                    metric = col.split("_")[0]
                    metric_name = {
                        "temp": "Temperatura",
                        "precip": "Precipitación",
                        "humidity": "Humedad",
                    }.get(metric, metric)

                    factors.append({
                        "factor": f"{metric_name} ({region.replace('_', ' ').title()})",
                        "value": round(curr_mean, 1),
                        "impact": "negativo" if (metric == "precip" and change > 0) else "neutral",
                        "description": f"{metric_name} en {region.replace('_', ' ').title()} cambió un {change:.1f}%. "
                        "Condiciones climáticas extremas pueden afectar la producción y los precios.",
                    })

    # Bandas de Bollinger
    bb_pos = recent["bb_position"].iloc[-1]
    if pd.notna(bb_pos):
        if bb_pos > 0.9:
            factors.append({
                "factor": "Bandas de Bollinger",
                "value": round(bb_pos, 2),
                "impact": "negativo",
                "description": "El precio está cerca de la banda superior de Bollinger, sugiriendo posible retroceso.",
            })
        elif bb_pos < 0.1:
            factors.append({
                "factor": "Bandas de Bollinger",
                "value": round(bb_pos, 2),
                "impact": "positivo",
                "description": "El precio está cerca de la banda inferior de Bollinger, sugiriendo posible rebote.",
            })

    return {
        "current_price_seco": round(current_price, 2),
        "price_change": round(price_change, 2),
        "price_change_pct": round(price_change_pct, 2),
        "direction": direction,
        "period": "últimos 30 días",
        "factors": factors,
        "summary": f"El precio del cacao {direction} ${abs(price_change):.2f} ({abs(price_change_pct):.1f}%) "
        f"en los últimos 30 días. Se identificaron {len(factors)} factores relevantes.",
    }


def get_shap_explanation(model, X: pd.DataFrame, top_n: int = 10) -> dict:
    """Genera explicaciones SHAP para el modelo XGBoost.

    Returns:
        Dict con los top_n features más importantes y sus valores SHAP.
    """
    try:
        import shap

        explainer = shap.TreeExplainer(model.model)
        shap_values = explainer.shap_values(X)

        mean_abs_shap = np.abs(shap_values).mean(axis=0)
        feature_importance = dict(zip(X.columns, mean_abs_shap.tolist()))
        sorted_features = sorted(
            feature_importance.items(), key=lambda x: x[1], reverse=True
        )[:top_n]

        # SHAP del último punto (predicción más reciente)
        last_shap = shap_values[-1]
        last_explanation = dict(zip(X.columns, last_shap.tolist()))
        sorted_last = sorted(
            last_explanation.items(), key=lambda x: abs(x[1]), reverse=True
        )[:top_n]

        return {
            "global_importance": [
                {"feature": f, "importance": round(v, 4)} for f, v in sorted_features
            ],
            "last_prediction_explanation": [
                {
                    "feature": f,
                    "shap_value": round(v, 4),
                    "direction": "sube" if v > 0 else "baja",
                }
                for f, v in sorted_last
            ],
        }
    except Exception as e:
        return {"error": str(e)}
