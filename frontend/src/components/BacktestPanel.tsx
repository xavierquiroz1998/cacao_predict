'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, CheckCircle, XCircle, History } from 'lucide-react';
import { PriceUnit, convertPrice } from '@/lib/units';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface BacktestResult {
  origin_date: string;
  dates: string[];
  actual_prices: number[];
  predicted_prices: number[];
  mae: number;
  mape: number;
  direction_correct: boolean;
}

interface BacktestData {
  results: BacktestResult[];
  global_metrics: {
    avg_mape: number;
    direction_accuracy: number;
    n_backtests: number;
    horizon_days: number;
  };
}

interface BacktestPanelProps {
  data: BacktestData | null;
  onRun: (horizonDays: number) => void;
  loading: boolean;
  unit: PriceUnit;
}

export default function BacktestPanel({ data, onRun, loading, unit }: BacktestPanelProps) {
  const [horizon, setHorizon] = useState(30);
  const [selectedTest, setSelectedTest] = useState(0);

  if (!data) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 mb-2">
          Comprueba como hubiera predicho el modelo en el pasado
        </p>
        <p className="text-xs text-slate-600 mb-4">
          Se ejecutaran multiples predicciones desde puntos pasados y se compararan con el precio real
        </p>
        <div className="flex items-center justify-center gap-3">
          <select
            value={horizon}
            onChange={(e) => setHorizon(parseInt(e.target.value))}
            className="select-custom text-sm"
          >
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <button
            onClick={() => onRun(horizon)}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <History className="w-4 h-4" />
                Ejecutar Backtesting
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const { results, global_metrics } = data;
  const selected = results[selectedTest];

  // Construir trazas del gráfico
  const traces: any[] = [];

  results.forEach((result, i) => {
    const isSelected = i === selectedTest;
    // Precio real
    traces.push({
      x: result.dates,
      y: result.actual_prices.map((p) => convertPrice(p, unit)),
      type: 'scatter',
      mode: 'lines',
      name: `Real (${result.origin_date})`,
      line: { color: '#94a3b8', width: isSelected ? 2.5 : 1, dash: 'solid' },
      opacity: isSelected ? 1 : 0.3,
      showlegend: isSelected,
    });
    // Predicción
    traces.push({
      x: result.dates,
      y: result.predicted_prices.map((p) => convertPrice(p, unit)),
      type: 'scatter',
      mode: 'lines',
      name: `Prediccion (${result.origin_date})`,
      line: {
        color: result.direction_correct ? '#10b981' : '#ef4444',
        width: isSelected ? 2.5 : 1,
        dash: 'dot',
      },
      opacity: isSelected ? 1 : 0.3,
      showlegend: isSelected,
    });
  });

  return (
    <div className="space-y-4">
      {/* Métricas globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
          <span className="text-xs text-slate-500 uppercase">MAPE Promedio</span>
          <p className={`text-2xl font-bold ${global_metrics.avg_mape < 5 ? 'text-emerald-400' : global_metrics.avg_mape < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
            {global_metrics.avg_mape.toFixed(1)}%
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
          <span className="text-xs text-slate-500 uppercase">Acierto Direccion</span>
          <p className={`text-2xl font-bold ${global_metrics.direction_accuracy >= 60 ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {global_metrics.direction_accuracy.toFixed(0)}%
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
          <span className="text-xs text-slate-500 uppercase">Tests realizados</span>
          <p className="text-2xl font-bold text-white">{global_metrics.n_backtests}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
          <span className="text-xs text-slate-500 uppercase">Horizonte</span>
          <p className="text-2xl font-bold text-white">{global_metrics.horizon_days}d</p>
        </div>
      </div>

      {/* Selector de test */}
      <div className="flex gap-2 flex-wrap">
        {results.map((result, i) => (
          <button
            key={i}
            onClick={() => setSelectedTest(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              i === selectedTest
                ? 'bg-slate-700 border-slate-500 text-white'
                : 'bg-slate-800/30 border-slate-800 text-slate-500 hover:border-slate-600'
            }`}
          >
            {result.direction_correct ? (
              <CheckCircle className="w-3 h-3 text-emerald-400" />
            ) : (
              <XCircle className="w-3 h-3 text-red-400" />
            )}
            {result.origin_date}
            <span className="text-slate-600">MAPE: {result.mape.toFixed(1)}%</span>
          </button>
        ))}
      </div>

      {/* Gráfico */}
      <Plot
        data={traces}
        layout={{
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#94a3b8', size: 11 },
          margin: { l: 60, r: 20, t: 20, b: 40 },
          height: 400,
          xaxis: { gridcolor: '#1e293b', tickformat: '%b %d' },
          yaxis: {
            gridcolor: '#1e293b',
            title: { text: `Precio (${unit.suffix})`, font: { size: 11 } },
          },
          legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: 1.02,
            xanchor: 'left',
            x: 0,
            font: { size: 10 },
          },
          hovermode: 'x unified',
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />

      {/* Detalle del test seleccionado */}
      {selected && (
        <div className={`rounded-lg border p-4 ${selected.direction_correct ? 'bg-emerald-900/10 border-emerald-800/50' : 'bg-red-900/10 border-red-800/50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {selected.direction_correct ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm font-medium text-white">
              Prediccion desde {selected.origin_date}
            </span>
            <span className={`text-xs ${selected.direction_correct ? 'text-emerald-500' : 'text-red-500'}`}>
              Direccion {selected.direction_correct ? 'correcta' : 'incorrecta'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500">Precio real final</span>
              <p className="text-white font-medium">
                ${convertPrice(selected.actual_prices[selected.actual_prices.length - 1], unit).toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Precio predicho</span>
              <p className="text-white font-medium">
                ${convertPrice(selected.predicted_prices[selected.predicted_prices.length - 1], unit).toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Error (MAPE)</span>
              <p className={`font-medium ${selected.mape < 5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {selected.mape.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botón para re-ejecutar */}
      <div className="flex justify-center">
        <button
          onClick={() => onRun(horizon)}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
          Re-ejecutar
        </button>
      </div>
    </div>
  );
}
