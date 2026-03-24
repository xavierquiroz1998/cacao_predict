const API_BASE = '/api';
const BACKEND_DIRECT = 'http://localhost:8000/api';

export async function fetchCurrentPrice(babaRatio: number = 0.40) {
  const res = await fetch(`${API_BASE}/prices/current?baba_ratio=${babaRatio}`);
  if (!res.ok) throw new Error('Error al obtener precio actual');
  return res.json();
}

export async function fetchHistoricalPrices(
  years: number = 10,
  interval: string = 'daily',
  babaRatio: number = 0.40
) {
  const res = await fetch(
    `${API_BASE}/prices/historical?years=${years}&interval=${interval}&baba_ratio=${babaRatio}`
  );
  if (!res.ok) throw new Error('Error al obtener precios históricos');
  return res.json();
}

export async function fetchPrediction(
  horizonDays: number = 30,
  babaRatio: number = 0.40,
  historyYears: number = 10
) {
  // Llamada directa al backend para evitar timeout del proxy de Next.js
  // (el entrenamiento de modelos puede tardar >30s)
  const res = await fetch(`${BACKEND_DIRECT}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      horizon_days: horizonDays,
      baba_ratio: babaRatio,
      history_years: historyYears,
    }),
  });
  if (!res.ok) throw new Error('Error al generar predicción');
  return res.json();
}

export async function fetchAnalysis(years: number = 5) {
  const res = await fetch(`${BACKEND_DIRECT}/analysis?years=${years}`);
  if (!res.ok) throw new Error('Error al obtener análisis');
  return res.json();
}

export async function fetchShapAnalysis() {
  const res = await fetch(`${BACKEND_DIRECT}/analysis/shap`);
  if (!res.ok) throw new Error('Error al obtener análisis SHAP');
  return res.json();
}

export async function fetchFactors(years: number = 5) {
  const res = await fetch(`${API_BASE}/factors?years=${years}`);
  if (!res.ok) throw new Error('Error al obtener factores');
  return res.json();
}

export async function fetchRegionalPrices(babaRatio: number = 0.40) {
  const res = await fetch(`${API_BASE}/prices/regional?baba_ratio=${babaRatio}`);
  if (!res.ok) throw new Error('Error al obtener precios regionales');
  return res.json();
}

export async function fetchNews(lang: string = 'en', maxArticles: number = 15) {
  const res = await fetch(`${BACKEND_DIRECT}/news?lang=${lang}&max_articles=${maxArticles}`);
  if (!res.ok) throw new Error('Error al obtener noticias');
  return res.json();
}
