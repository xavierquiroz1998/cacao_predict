'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Activity,
  Brain,
  Loader2,
  RefreshCw,
  ChevronDown,
  Newspaper,
  Sun,
  Moon,
  Download,
  Globe,
  History,
  Map,
} from 'lucide-react';
import PriceCard from '@/components/PriceCard';
import HistoricalChart from '@/components/HistoricalChart';
import PredictionChart from '@/components/PredictionChart';
import AnalysisPanel from '@/components/AnalysisPanel';
import ModelMetrics from '@/components/ModelMetrics';
import ModelComparison from '@/components/ModelComparison';
import PredictionSummary from '@/components/PredictionSummary';
import RegionalPrices from '@/components/RegionalPrices';
import PredictionRegionalPrices from '@/components/PredictionRegionalPrices';
import NewsPanel from '@/components/NewsPanel';
import ProducerMap from '@/components/ProducerMap';
import BacktestPanel from '@/components/BacktestPanel';
import {
  fetchCurrentPrice,
  fetchHistoricalPrices,
  fetchPrediction,
  fetchAnalysis,
  fetchRegionalPrices,
  fetchNews,
  fetchBacktest,
} from '@/lib/api';
import { PRICE_UNITS, getUnit, convertPrice } from '@/lib/units';
import { Locale, LOCALES, t } from '@/lib/i18n';
import {
  exportHistoricalCSV,
  exportPredictionCSV,
  exportPredictionPDF,
  exportAnalysisCSV,
} from '@/lib/export';

type Tab = 'dashboard' | 'prediction' | 'analysis' | 'news';

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
  const [news, setNews] = useState<any>(null);
  const [backtest, setBacktest] = useState<any>(null);

  // Settings
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [locale, setLocale] = useState<Locale>('es');
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

  const loadNews = useCallback(async () => {
    setLoadingKey('news', true);
    try {
      const data = await fetchNews('en', 15);
      setNews(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKey('news', false);
    }
  }, []);

  // Theme toggle
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [theme]);

  const loadBacktest = async (horizonDays: number) => {
    setLoadingKey('backtest', true);
    try {
      const data = await fetchBacktest(horizonDays, historyYears);
      setBacktest(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingKey('backtest', false);
    }
  };

  useEffect(() => {
    loadCurrentPrice();
    loadHistorical();
  }, [loadCurrentPrice, loadHistorical]);

  const tabs = [
    { id: 'dashboard' as Tab, label: t('nav.dashboard', locale), icon: BarChart3 },
    { id: 'prediction' as Tab, label: t('nav.prediction', locale), icon: Brain },
    { id: 'analysis' as Tab, label: t('nav.analysis', locale), icon: Activity },
    { id: 'news' as Tab, label: t('nav.news', locale), icon: Newspaper },
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

            <div className="flex items-center gap-2 flex-wrap">
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Language selector */}
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="select-custom text-xs py-1"
              >
                {LOCALES.map((l) => (
                  <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                ))}
              </select>

              {/* Toggle Baba/Seco */}
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBaba}
                  onChange={(e) => setShowBaba(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                {t('header.showBaba', locale)}
              </label>

              {/* Unit selector */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">{t('header.unit', locale)}:</span>
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
                <span className="text-xs text-slate-500">{t('header.ratio', locale)}:</span>
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
                  <h2 className="card-header mb-0">{t('dashboard.historicPrice', locale)}</h2>
                  <div className="flex gap-2">
                    {historical?.data && (
                      <button
                        onClick={() => exportHistoricalCSV(historical.data)}
                        className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        CSV
                      </button>
                    )}
                    <button onClick={loadHistorical} className="btn-secondary text-xs py-1 px-2">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
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
                    <span className="text-xs text-slate-500 mr-1">{t('dashboard.interval', locale)}:</span>
                    {[
                      { value: 'daily', label: t('dashboard.daily', locale) },
                      { value: 'weekly', label: t('dashboard.weekly', locale) },
                      { value: 'monthly', label: t('dashboard.monthly', locale) },
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

            {/* Mapa de productores */}
            {currentPrice && (
              <div className="card">
                <h2 className="card-header flex items-center gap-2">
                  <Map className="w-5 h-5 text-cacao-400" />
                  {t('map.title', locale)}
                </h2>
                <ProducerMap
                  internationalPrice={currentPrice.seco.price}
                  unit={unit}
                  babaRatio={babaRatio}
                />
              </div>
            )}
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

                {/* Exportar prediccion */}
                <div className="flex gap-2">
                  <button
                    onClick={() => exportPredictionCSV(prediction)}
                    className="btn-secondary text-xs flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {t('export.csv', locale)}
                  </button>
                  <button
                    onClick={() => exportPredictionPDF(prediction, currentPrice?.seco?.price || prediction.seco.forecast[0])}
                    className="btn-secondary text-xs flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {t('export.pdf', locale)}
                  </button>
                </div>

                {/* Comparacion interactiva de modelos */}
                <div className="card">
                  <h2 className="card-header">{t('prediction.comparison', locale)}</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    {t('prediction.comparisonDesc', locale)}
                  </p>
                  <ModelComparison
                    prediction={prediction}
                    historicalDates={historical?.data?.map((d: any) => d.date) || []}
                    historicalPrices={historical?.data?.map((d: any) => d.close_seco) || []}
                    unit={unit}
                  />
                </div>

                {/* Backtesting */}
                <div className="card">
                  <h2 className="card-header flex items-center gap-2">
                    <History className="w-5 h-5 text-cacao-400" />
                    {t('backtesting.title', locale)}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    {t('backtesting.desc', locale)}
                  </p>
                  <BacktestPanel
                    data={backtest}
                    onRun={loadBacktest}
                    loading={loading.backtest || false}
                    unit={unit}
                  />
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
                <h2 className="card-header mb-0">{t('analysis.title', locale)}</h2>
                <div className="flex gap-2">
                  {analysis && (
                    <button
                      onClick={() => exportAnalysisCSV(analysis)}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      CSV
                    </button>
                  )}
                </div>
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

        {/* ===== NEWS ===== */}
        {activeTab === 'news' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="card-header">Noticias del Cacao y Sentimiento del Mercado</h2>
              <p className="text-xs text-slate-500 mb-4">
                Noticias recientes sobre el cacao con analisis automatico de sentimiento.
                El sentimiento de las noticias puede influir en los movimientos del precio.
              </p>
              {loading.news ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-cacao-500 animate-spin" />
                </div>
              ) : news ? (
                <NewsPanel
                  articles={news.articles}
                  sentimentSummary={news.sentiment_summary}
                  onRefresh={loadNews}
                  loading={loading.news || false}
                />
              ) : (
                <div className="text-center py-16">
                  <Newspaper className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 mb-4">Carga las noticias mas recientes del mercado del cacao</p>
                  <button
                    onClick={loadNews}
                    disabled={loading.news}
                    className="btn-primary flex items-center gap-2 mx-auto"
                  >
                    {loading.news ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Newspaper className="w-4 h-4" />
                    )}
                    Cargar Noticias
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-600">
          {t('footer.text', locale)}
        </div>
      </footer>
    </div>
  );
}
