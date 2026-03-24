'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Activity,
  Brain,
  Loader2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import PriceCard from '@/components/PriceCard';
import HistoricalChart from '@/components/HistoricalChart';
import PredictionChart from '@/components/PredictionChart';
import AnalysisPanel from '@/components/AnalysisPanel';
import ModelMetrics from '@/components/ModelMetrics';
import PredictionSummary from '@/components/PredictionSummary';
import RegionalPrices from '@/components/RegionalPrices';
import PredictionRegionalPrices from '@/components/PredictionRegionalPrices';
import {
  fetchCurrentPrice,
  fetchHistoricalPrices,
  fetchPrediction,
  fetchAnalysis,
  fetchRegionalPrices,
} from '@/lib/api';
import { PRICE_UNITS, getUnit, convertPrice } from '@/lib/units';

type Tab = 'dashboard' | 'prediction' | 'analysis';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // State
  const [currentPrice, setCurrentPrice] = useState<any>(null);
  const [historical, setHistorical] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [regionalPrices, setRegionalPrices] = useState<any>(null);

  // Settings
  const [babaRatio, setBabaRatio] = useState(0.40);
  const [showBaba, setShowBaba] = useState(true);
  const [historyYears, setHistoryYears] = useState(5);
  const [horizonDays, setHorizonDays] = useState(30);
  const [interval, setInterval] = useState('daily');
  const [unitId, setUnitId] = useState('ton');
  const unit = getUnit(unitId);

  const setLoadingKey = (key: string, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  const loadCurrentPrice = useCallback(async () => {
    setLoadingKey('price', true);
    try {
      const [priceData, regionalData] = await Promise.all([
        fetchCurrentPrice(babaRatio),
        fetchRegionalPrices(babaRatio),
      ]);
      setCurrentPrice(priceData);
      setRegionalPrices(regionalData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKey('price', false);
    }
  }, [babaRatio]);

  const loadHistorical = useCallback(async () => {
    setLoadingKey('historical', true);
    try {
      const data = await fetchHistoricalPrices(historyYears, interval, babaRatio);
      setHistorical(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKey('historical', false);
    }
  }, [historyYears, interval, babaRatio]);

  const loadPrediction = async () => {
    setLoadingKey('prediction', true);
    setError(null);
    try {
      const data = await fetchPrediction(horizonDays, babaRatio, historyYears);
      setPrediction(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKey('prediction', false);
    }
  };

  const loadAnalysis = useCallback(async () => {
    setLoadingKey('analysis', true);
    try {
      const data = await fetchAnalysis(historyYears);
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKey('analysis', false);
    }
  }, [historyYears]);

  useEffect(() => {
    loadCurrentPrice();
    loadHistorical();
  }, [loadCurrentPrice, loadHistorical]);

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
    { id: 'prediction' as Tab, label: 'Prediccion', icon: Brain },
    { id: 'analysis' as Tab, label: 'Analisis', icon: Activity },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cacao-600 rounded-lg flex items-center justify-center">
                <span className="text-xl">🫘</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">CacaoPredict</h1>
                <p className="text-xs text-slate-400">
                  Prediccion inteligente del precio del cacao
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Baba/Seco */}
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBaba}
                  onChange={(e) => setShowBaba(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                Mostrar Baba
              </label>

              {/* Unit selector */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Unidad:</span>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="select-custom text-xs py-1"
                >
                  {PRICE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </div>

              {/* Ratio selector */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Ratio B/S:</span>
                <select
                  value={babaRatio}
                  onChange={(e) => setBabaRatio(parseFloat(e.target.value))}
                  className="select-custom text-xs py-1"
                >
                  <option value={0.35}>35%</option>
                  <option value={0.40}>40%</option>
                  <option value={0.45}>45%</option>
                  <option value={0.50}>50%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'analysis' && !analysis) loadAnalysis();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cacao-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 text-xs mt-1 underline">
              Cerrar
            </button>
          </div>
        )}

        {/* ===== DASHBOARD ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Price Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading.price ? (
                <div className="card flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 text-cacao-500 animate-spin" />
                </div>
              ) : currentPrice ? (
                <>
                  <PriceCard
                    title="Cacao Seco"
                    price={convertPrice(currentPrice.seco.price, unit)}
                    change={convertPrice(currentPrice.seco.change, unit)}
                    changePct={currentPrice.seco.change_pct}
                    currency={unit.suffix}
                    type="seco"
                  />
                  {showBaba && (
                    <PriceCard
                      title="Cacao en Baba"
                      price={convertPrice(currentPrice.baba.price, unit)}
                      change={convertPrice(currentPrice.baba.change, unit)}
                      changePct={currentPrice.baba.change_pct}
                      currency={unit.suffix}
                      type="baba"
                    />
                  )}
                </>
              ) : null}
            </div>

            {/* Regional Prices */}
            {regionalPrices && (
              <div className="card">
                <h2 className="card-header">Precios por Region Productora</h2>
                <RegionalPrices data={regionalPrices} unit={unit} showBaba={showBaba} />
              </div>
            )}

            {/* Historical Chart */}
            <div className="card">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between">
                  <h2 className="card-header mb-0">Precio Historico</h2>
                  <button onClick={loadHistorical} className="btn-secondary text-xs py-1 px-2">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {/* Filtros de periodo */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 mr-1">Periodo:</span>
                    {[
                      { value: 1, label: '1A' },
                      { value: 2, label: '2A' },
                      { value: 3, label: '3A' },
                      { value: 5, label: '5A' },
                      { value: 10, label: '10A' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setHistoryYears(opt.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          historyYears === opt.value
                            ? 'bg-cacao-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 mr-1">Intervalo:</span>
                    {[
                      { value: 'daily', label: 'Diario' },
                      { value: 'weekly', label: 'Semanal' },
                      { value: 'monthly', label: 'Mensual' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setInterval(opt.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          interval === opt.value
                            ? 'bg-cacao-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {loading.historical ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="w-8 h-8 text-cacao-500 animate-spin" />
                </div>
              ) : historical?.data ? (
                <HistoricalChart data={historical.data} showBaba={showBaba} unit={unit} />
              ) : (
                <div className="text-center text-slate-500 py-16">
                  No hay datos historicos disponibles
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== PREDICTION ===== */}
        {activeTab === 'prediction' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="card">
              <h2 className="card-header">Configuracion de Prediccion</h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Horizonte</label>
                  <select
                    value={horizonDays}
                    onChange={(e) => setHorizonDays(parseInt(e.target.value))}
                    className="select-custom"
                  >
                    <option value={7}>7 dias</option>
                    <option value={14}>14 dias</option>
                    <option value={30}>1 mes</option>
                    <option value={60}>2 meses</option>
                    <option value={90}>3 meses</option>
                    <option value={180}>6 meses</option>
                    <option value={365}>1 ano</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Datos de entrenamiento
                  </label>
                  <select
                    value={historyYears}
                    onChange={(e) => setHistoryYears(parseInt(e.target.value))}
                    className="select-custom"
                  >
                    <option value={3}>3 anos</option>
                    <option value={5}>5 anos</option>
                    <option value={10}>10 anos</option>
                  </select>
                </div>
                <button
                  onClick={loadPrediction}
                  disabled={loading.prediction}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading.prediction ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrenando modelos...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Generar Prediccion
                    </>
                  )}
                </button>
              </div>
              {loading.prediction && (
                <p className="text-xs text-slate-500 mt-3">
                  Esto puede tardar unos minutos. Se estan entrenando 3 modelos (SARIMA, XGBoost, LSTM)...
                </p>
              )}
            </div>

            {/* Prediction Results */}
            {prediction && (
              <>
                {/* Resumen: sube o baja */}
                <PredictionSummary
                  prediction={prediction}
                  currentPrice={currentPrice?.seco?.price || prediction.seco.forecast[0]}
                  unit={unit}
                  showBaba={showBaba}
                />

                {/* Grafico */}
                <div className="card">
                  <h2 className="card-header">Prediccion del Precio</h2>
                  <PredictionChart
                    prediction={prediction}
                    historicalDates={historical?.data?.map((d: any) => d.date) || []}
                    historicalPrices={historical?.data?.map((d: any) => d.close_seco) || []}
                    showBaba={showBaba}
                    unit={unit}
                  />
                </div>

                {/* Precios regionales proyectados */}
                <div className="card">
                  <h2 className="card-header">Precio Proyectado por Region</h2>
                  <PredictionRegionalPrices
                    currentPrice={currentPrice?.seco?.price || prediction.seco.forecast[0]}
                    projectedPrice={prediction.seco.forecast[prediction.seco.forecast.length - 1]}
                    unit={unit}
                    showBaba={showBaba}
                    babaRatio={babaRatio}
                  />
                </div>

                {/* Metricas */}
                <div className="card">
                  <h2 className="card-header">Rendimiento de los Modelos</h2>
                  <ModelMetrics weights={prediction.weights} metrics={prediction.metrics} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== ANALYSIS ===== */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-header mb-0">Analisis: Por que subio o bajo?</h2>
                <button
                  onClick={loadAnalysis}
                  disabled={loading.analysis}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  {loading.analysis ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Actualizar
                </button>
              </div>
              {loading.analysis ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-cacao-500 animate-spin" />
                </div>
              ) : analysis ? (
                <AnalysisPanel analysis={analysis} />
              ) : (
                <div className="text-center text-slate-500 py-16">
                  Haz clic en &quot;Actualizar&quot; para cargar el analisis
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-600">
          CacaoPredict v1.0 | Modelos: SARIMA + XGBoost + LSTM | Datos: Yahoo Finance, Open-Meteo
        </div>
      </footer>
    </div>
  );
}
