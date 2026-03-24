# CacaoPredict

Aplicacion web de prediccion inteligente del precio del cacao, que combina modelos de Machine Learning y Deep Learning para proyectar precios, explicar las causas de las variaciones y mostrar precios regionales para productores.

## Que hace este proyecto?

### 1. Dashboard de Precios
- Precio actual del cacao (seco y en baba) a nivel internacional (ICE Futures NY)
- Precios estimados al productor en **Ecuador**, **Costa de Marfil** y **Ghana**, con conversion a moneda local
- Conversion de unidades: tonelada, quintal (46kg), arroba (12.5kg), kilogramo, libra
- Grafico historico interactivo con filtros de periodo (1, 2, 3, 5, 10 anos) e intervalo (diario, semanal, mensual)

### 2. Prediccion de Precios
Usa un **ensemble de 3 modelos** para predecir el precio del cacao:
- **SARIMA**: modelo estadistico de series temporales con estacionalidad
- **XGBoost**: gradient boosting con features de indicadores tecnicos y datos externos
- **LSTM**: red neuronal recurrente (Deep Learning) para capturar patrones complejos

El sistema indica claramente si el precio **SUBE** o **BAJA**, con:
- Precio actual vs proyectado
- Porcentaje de variacion
- Nivel de confianza (Alta/Moderada/Baja)
- Rango proyectado (min-max)
- Tendencia a mitad de periodo
- Precios proyectados por region (Ecuador, Costa de Marfil, Ghana)
- Horizontes configurables: 7 dias, 14 dias, 1-6 meses, 1 ano

### 3. Analisis de Factores (Por que subio o bajo?)
Analiza automaticamente las causas de los movimientos de precio:
- **Indicadores tecnicos**: RSI, MACD, Bandas de Bollinger, medias moviles
- **Commodities relacionados**: cafe, azucar, petroleo, indice del dolar
- **Clima**: temperatura, precipitacion y humedad en Costa de Marfil, Ghana y Ecuador
- **Tipos de cambio**: USD/GHS (Ghana Cedi), USD/XOF (Franco CFA)
- **Explicabilidad SHAP**: importancia de cada variable en la prediccion

## Arquitectura

```
cacao_predict/
├── backend/                  # API Python (FastAPI)
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes.py     # Endpoints REST
│   │   │   └── schemas.py    # Modelos Pydantic
│   │   ├── models/
│   │   │   ├── sarima_model.py
│   │   │   ├── xgboost_model.py
│   │   │   ├── lstm_model.py
│   │   │   └── ensemble.py   # Combinacion ponderada de modelos
│   │   ├── services/
│   │   │   ├── data_pipeline.py       # Descarga de datos (Yahoo Finance, Open-Meteo)
│   │   │   ├── demo_data.py           # Datos de demostracion (fallback sin internet)
│   │   │   ├── feature_engineering.py # Indicadores tecnicos, lags, features temporales
│   │   │   └── explainability.py      # Motor de analisis + SHAP
│   │   ├── config.py
│   │   └── main.py
│   └── requirements.txt
│
└── frontend/                 # App web (Next.js + React + Tailwind)
    └── src/
        ├── app/
        │   └── page.tsx      # Pagina principal (Dashboard, Prediccion, Analisis)
        ├── components/
        │   ├── HistoricalChart.tsx
        │   ├── PredictionChart.tsx
        │   ├── PredictionSummary.tsx
        │   ├── PredictionRegionalPrices.tsx
        │   ├── RegionalPrices.tsx
        │   ├── AnalysisPanel.tsx
        │   ├── ModelMetrics.tsx
        │   └── PriceCard.tsx
        └── lib/
            ├── api.ts        # Cliente HTTP para el backend
            └── units.ts      # Conversion de unidades de medida
```

## Fuentes de Datos

| Fuente | Datos | Frecuencia |
|--------|-------|------------|
| Yahoo Finance (`CC=F`) | Precio del cacao (futuros ICE) | Diaria |
| Yahoo Finance (`KC=F`, `SB=F`, `CL=F`) | Cafe, azucar, petroleo | Diaria |
| Yahoo Finance (`DX-Y.NYB`) | Indice del dolar | Diaria |
| Open-Meteo | Clima en regiones productoras | Diaria |
| Yahoo Finance (`USDGHS=X`, `USDXOF=X`) | Tipos de cambio | Diaria |

> Si no hay conexion a las APIs (ej: red corporativa), la app usa automaticamente datos de demostracion calibrados con precios reales de marzo 2026.

## Tecnologias

**Backend:**
- Python 3.10+
- FastAPI
- pandas, NumPy, SciPy
- scikit-learn, XGBoost, TensorFlow/Keras
- statsmodels (SARIMA), Prophet
- SHAP (explicabilidad)
- yfinance

**Frontend:**
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- Plotly.js (graficos interactivos)
- Lucide React (iconos)

## Instalacion y Ejecucion

### Requisitos
- Python 3.10+
- Node.js 18+

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

La documentacion de la API esta disponible en [http://localhost:8000/docs](http://localhost:8000/docs).

## API Endpoints

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/prices/current` | Precio actual (seco + baba) |
| GET | `/api/prices/historical` | Precios historicos con filtros |
| GET | `/api/prices/regional` | Precios por region (Ecuador, Ghana, Costa de Marfil) |
| POST | `/api/predict` | Generar prediccion (entrena modelos) |
| GET | `/api/analysis` | Analisis de factores (por que subio/bajo) |
| GET | `/api/analysis/shap` | Explicabilidad SHAP |

## Precios Regionales

El precio internacional se ajusta por pais segun el porcentaje que tipicamente recibe el productor:

| Pais | Factor | Moneda | Notas |
|------|--------|--------|-------|
| Ecuador | 62% | USD | Quintal ~$80-$100 en centros de acopio (Mar 2026) |
| Costa de Marfil | 60% | Franco CFA (XOF) | Regulado por Conseil du Cafe-Cacao |
| Ghana | 65% | Cedi (GHS) | Regulado por COCOBOD |

## Autor

Xavier Quiroz - [@xavierquiroz1998](https://github.com/xavierquiroz1998)
