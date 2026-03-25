# CacaoPredict

Aplicacion web de prediccion inteligente del precio del cacao, que combina modelos de Machine Learning y Deep Learning para proyectar precios, explicar las causas de las variaciones y mostrar precios regionales para productores.

## Que hace este proyecto?

### 1. Dashboard de Precios
- Precio actual del cacao (seco y en baba) a nivel internacional (ICE Futures NY)
- Precios estimados al productor en **Ecuador**, **Costa de Marfil** y **Ghana**, con conversion a moneda local
- Conversion de unidades: tonelada, quintal (46kg), arroba (12.5kg), kilogramo, libra
- Grafico historico interactivo con filtros de periodo (1, 2, 3, 5, 10 anos) e intervalo (diario, semanal, mensual)
- Exportar datos historicos en CSV

### 2. Prediccion de Precios
Usa un **ensemble de 3 modelos** calibrados para predecir el precio del cacao:
- **SARIMA**: modelo estadistico con auto-seleccion de parametros via ADF test + AIC
- **XGBoost**: gradient boosting con seleccion de features por mutual information y early stopping
- **LSTM**: red neuronal recurrente con BatchNormalization, Huber loss y early stopping

El sistema indica claramente si el precio **SUBE** o **BAJA**, con:
- Precio actual vs proyectado
- Porcentaje de variacion
- Nivel de confianza (Alta/Moderada/Baja) calibrado con errores reales
- Rango proyectado (min-max)
- Tendencia a mitad de periodo
- Precios proyectados por region (Ecuador, Costa de Marfil, Ghana)
- Horizontes configurables: 7 dias, 14 dias, 1-6 meses, 1 ano

**Panel explicativo expandible** — haz clic en "Ver por que" para ver:
- Consenso de modelos (cuantos predicen alza vs baja)
- Modelo dominante y su precision historica (MAPE)
- Analisis de tendencia (sostenida o con cambio de direccion)
- Explicacion del nivel de confianza
- Barras de contribucion de cada modelo con % de peso
- Prediccion individual de SARIMA, XGBoost y LSTM

### 3. Analisis de Factores (Por que subio o bajo?)
Analiza automaticamente las causas de los movimientos de precio:
- **Indicadores tecnicos**: RSI, MACD, Bandas de Bollinger, medias moviles
- **Commodities relacionados**: cafe, azucar, petroleo, indice del dolar
- **Clima**: temperatura, precipitacion y humedad en Costa de Marfil, Ghana y Ecuador
- **Tipos de cambio**: USD/GHS (Ghana Cedi), USD/XOF (Franco CFA)
- **Explicabilidad SHAP**: importancia de cada variable en la prediccion

### 4. Noticias y Sentimiento del Mercado
- Noticias en tiempo real de Google News sobre cacao/cocoa
- Analisis de sentimiento automatico (NLP con VADER + lexico financiero)
- Resumen del sentimiento general: alcista, bajista o neutral
- Distribucion de noticias positivas/negativas/neutras
- Senal de impacto en el precio

### 5. Comparacion Interactiva de Modelos
- Toggle para activar/desactivar cada modelo (SARIMA, XGBoost, LSTM)
- Grafico superpuesto con prediccion individual de cada modelo vs ensemble
- Tabla de metricas (RMSE, MAE, MAPE) y pesos del ensemble
- Visualizacion del intervalo de confianza

### 6. Modo Claro / Oscuro
- Toggle de tema con transicion suave
- Modo oscuro por defecto (fondo slate-900)
- Modo claro con contraste optimizado (UX/UI revisado)
- Todos los componentes adaptados: cards, graficos, badges, tablas, paneles

### 7. Multi-idioma
- Espanol (por defecto)
- Ingles
- Frances (por Costa de Marfil)
- Selector de idioma en el header

### 8. Exportar Datos
- Exportar precios historicos en CSV
- Exportar predicciones en CSV
- Exportar analisis de factores en CSV

## Precision de los Modelos

Los modelos estan calibrados para maximizar la precision:

| Aspecto | Detalle |
|---------|---------|
| **Ensemble MAPE** | ~1.4-1.8% (error promedio ponderado) |
| **XGBoost MAPE** | ~0.7% (modelo dominante) |
| **LSTM MAPE** | ~1.9% |
| **SARIMA MAPE** | ~8.4% |
| **Reproducibilidad** | Semilla fija para resultados consistentes |
| **Intervalos de confianza** | Calibrados con errores reales de walk-forward validation |
| **Post-procesamiento** | Anclaje al precio actual, limites diarios ±1.5%, acumulado sqrt(t) |
| **Seleccion de features** | Mutual information (top 30 de ~57 features) |

## Arquitectura

```
cacao_predict/
├── backend/                  # API Python (FastAPI)
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes.py     # Endpoints REST
│   │   │   └── schemas.py    # Modelos Pydantic
│   │   ├── models/
│   │   │   ├── sarima_model.py    # Auto-seleccion de parametros
│   │   │   ├── xgboost_model.py   # Feature selection + early stopping
│   │   │   ├── lstm_model.py      # BatchNorm + Huber loss
│   │   │   └── ensemble.py        # Pesos calibrados + CI realistas
│   │   ├── services/
│   │   │   ├── data_pipeline.py       # Yahoo Finance + Open-Meteo (con fallback demo)
│   │   │   ├── demo_data.py           # Datos calibrados Mar 2026
│   │   │   ├── feature_engineering.py # Indicadores tecnicos, lags, features
│   │   │   ├── explainability.py      # Motor de analisis + SHAP
│   │   │   └── news_service.py        # Google News RSS + sentimiento VADER
│   │   ├── config.py
│   │   └── main.py
│   └── requirements.txt
│
└── frontend/                 # App web (Next.js + React + Tailwind)
    └── src/
        ├── app/
        │   ├── page.tsx      # Pagina principal con tabs
        │   ├── layout.tsx
        │   └── globals.css   # Tema claro/oscuro con CSS variables
        ├── components/
        │   ├── HistoricalChart.tsx
        │   ├── PredictionChart.tsx
        │   ├── PredictionSummary.tsx      # Panel expandible "Ver por que"
        │   ├── PredictionRegionalPrices.tsx
        │   ├── RegionalPrices.tsx
        │   ├── AnalysisPanel.tsx
        │   ├── ModelMetrics.tsx
        │   ├── NewsPanel.tsx
        │   └── PriceCard.tsx
        └── lib/
            ├── api.ts        # Cliente HTTP para el backend
            ├── units.ts      # Conversion de unidades
            └── i18n.ts       # Traducciones ES/EN/FR
```

## Fuentes de Datos

| Fuente | Datos | Frecuencia |
|--------|-------|------------|
| Yahoo Finance (`CC=F`) | Precio del cacao (futuros ICE) | Diaria |
| Yahoo Finance (`KC=F`, `SB=F`, `CL=F`) | Cafe, azucar, petroleo | Diaria |
| Yahoo Finance (`DX-Y.NYB`) | Indice del dolar | Diaria |
| Open-Meteo | Clima en regiones productoras | Diaria |
| Yahoo Finance (`USDGHS=X`, `USDXOF=X`) | Tipos de cambio | Diaria |
| Google News RSS | Noticias sobre cacao/cocoa | Tiempo real |

> Si no hay conexion a las APIs (ej: red corporativa), la app usa automaticamente datos de demostracion calibrados con precios reales de marzo 2026.

## Tecnologias

**Backend:**
- Python 3.10+
- FastAPI
- pandas, NumPy, SciPy
- scikit-learn, XGBoost, TensorFlow/Keras
- statsmodels (SARIMA)
- SHAP (explicabilidad)
- NLTK/VADER (sentimiento)
- yfinance, feedparser

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
| GET | `/api/news` | Noticias con sentimiento |
| POST | `/api/backtest` | Backtesting visual de predicciones |

## Precios Regionales

El precio internacional se ajusta por pais segun el porcentaje que tipicamente recibe el productor:

| Pais | Factor | Moneda | Notas |
|------|--------|--------|-------|
| Ecuador | 62% | USD | Quintal ~$80-$100 en centros de acopio (Mar 2026) |
| Costa de Marfil | 60% | Franco CFA (XOF) | Regulado por Conseil du Cafe-Cacao |
| Ghana | 65% | Cedi (GHS) | Regulado por COCOBOD |

## Screenshots

### Dashboard (Modo Oscuro)
Dashboard con precio actual, precios regionales y grafico historico interactivo.

### Prediccion con Panel Explicativo
Prediccion con indicador SUBE/BAJA, confianza Alta, y panel expandible "Ver por que" mostrando consenso de modelos, modelo dominante, tendencia y contribucion de cada modelo.

### Modo Claro
Todos los componentes adaptados con contraste optimizado para modo claro.

## Autor

Xavier Quiroz - [@xavierquiroz1998](https://github.com/xavierquiroz1998)
