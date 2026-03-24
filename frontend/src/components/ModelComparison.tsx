'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Eye, EyeOff } from 'lucide-react';
import { PriceUnit, convertPrice } from '@/lib/units';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface ModelComparisonProps {
  prediction: {
    dates: string[];
    seco: { forecast: number[]; lower_ci: number[]; upper_ci: number[] };
    individual_predictions: {
      sarima: number[];
      xgboost: number[];
      lstm: number[];
    };
    weights: Record<string, number>;
    metrics: Record<string, { rmse: number; mae: number; mape: number }>;
  };
  historicalDates: string[];
  historicalPrices: number[];
  unit: PriceUnit;
}

const modelConfig = {
  sarima: {
    name: 'SARIMA',
    color: '#f59e0b',
    description: 'Modelo estadistico de series temporales con estacionalidad',
  },
  xgboost: {
    name: 'XGBoost',
    color: '#10b981',
    description: 'Gradient boosting con indicadores tecnicos y datos externos',
  },
  lstm: {
    name: 'LSTM',
    color: '#8b5cf6',
    description: 'Red neuronal recurrente (Deep Learning)',
  },
  ensemble: {
    name: 'Ensemble',
    color: '#ef4444',
    description: 'Combinacion ponderada de los 3 modelos',
  },
};

export default function ModelComparison({
  prediction,
  historicalDates,
  historicalPrices,
  unit,
}: ModelComparisonProps) {
  const [activeModels, setActiveModels] = useState<Record<string, boolean>>({
    sarima: true,
    xgboost: true,
    lstm: true,
    ensemble: true,
  });

  const toggleModel = (model: string) => {
    setActiveModels((prev) => ({ ...prev, [model]: !prev[model] }));
  };

  // Últimos N puntos históricos para contexto
  const histContext = 30;
  const recentDates = historicalDates.slice(-histContext);
  const recentPrices = historicalPrices.slice(-histContext);

  const traces: any[] = [];

  // Histórico
  traces.push({
    x: recentDates,
    y: recentPrices.map((p) => convertPrice(p, unit)),
    type: 'scatter',
    mode: 'lines',
    name: 'Historico',
    line: { color: '#94a3b8', width: 2 },
  });

  // Cada modelo individual
  if (activeModels.sarima) {
    traces.push({
      x: prediction.dates,
      y: prediction.individual_predictions.sarima.map((p) => convertPrice(p, unit)),
      type: 'scatter',
      mode: 'lines',
      name: 'SARIMA',
      line: { color: modelConfig.sarima.color, width: 2, dash: 'dot' },
    });
  }
  if (activeModels.xgboost) {
    traces.push({
      x: prediction.dates,
      y: prediction.individual_predictions.xgboost.map((p) => convertPrice(p, unit)),
      type: 'scatter',
      mode: 'lines',
      name: 'XGBoost',
      line: { color: modelConfig.xgboost.color, width: 2, dash: 'dot' },
    });
  }
  if (activeModels.lstm) {
    traces.push({
      x: prediction.dates,
      y: prediction.individual_predictions.lstm.map((p) => convertPrice(p, unit)),
      type: 'scatter',
      mode: 'lines',
      name: 'LSTM',
      line: { color: modelConfig.lstm.color, width: 2, dash: 'dot' },
    });
  }

  // Ensemble
  if (activeModels.ensemble) {
    traces.push({
      x: prediction.dates,
      y: prediction.seco.forecast.map((p) => convertPrice(p, unit)),
      type: 'scatter',
      mode: 'lines',
      name: 'Ensemble',
      line: { color: modelConfig.ensemble.color, width: 3 },
    });

    // Intervalo de confianza
    traces.push({
      x: [...prediction.dates, ...prediction.dates.slice().reverse()],
      y: [
        ...prediction.seco.upper_ci.map((p) => convertPrice(p, unit)),
        ...prediction.seco.lower_ci.slice().reverse().map((p) => convertPrice(p, unit)),
      ],
      fill: 'toself',
      fillcolor: 'rgba(239, 68, 68, 0.08)',
      line: { color: 'transparent' },
      type: 'scatter',
      name: 'IC 95% Ensemble',
      showlegend: false,
    });
  }

  // Línea vertical de separación
  const lastHistDate = recentDates[recentDates.length - 1];

  return (
    <div className="space-y-4">
      {/* Toggles de modelos */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(modelConfig).map(([key, config]) => {
          const isActive = activeModels[key];
          const weight = key !== 'ensemble' ? prediction.weights[key] : null;
          const metrics = key !== 'ensemble' ? prediction.metrics[key] : null;

          return (
            <button
              key={key}
              onClick={() => toggleModel(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                isActive
                  ? 'border-slate-600 bg-slate-800'
                  : 'border-slate-800 bg-slate-900/50 opacity-50'
              }`}
            >
              {/* Indicador de color */}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: isActive ? config.color : '#475569' }}
              />

              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {config.name}
                  </span>
                  {isActive ? (
                    <Eye className="w-3 h-3 text-slate-500" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-slate-600" />
                  )}
                </div>
                {weight != null && (
                  <span className="text-xs text-slate-500">
                    Peso: {(weight * 100).toFixed(1)}%
                    {metrics && ` | MAPE: ${metrics.mape.toFixed(1)}%`}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Gráfico */}
      <Plot
        data={traces}
        layout={{
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#94a3b8', size: 11 },
          margin: { l: 60, r: 20, t: 20, b: 40 },
          height: 450,
          xaxis: {
            gridcolor: '#1e293b',
            tickformat: '%b %d',
          },
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
          shapes: [
            {
              type: 'line',
              x0: lastHistDate,
              x1: lastHistDate,
              y0: 0,
              y1: 1,
              yref: 'paper',
              line: { color: '#475569', width: 1, dash: 'dot' },
            },
          ],
          annotations: [
            {
              x: lastHistDate,
              y: 1,
              yref: 'paper',
              text: 'Inicio prediccion',
              showarrow: false,
              font: { size: 10, color: '#64748b' },
              yanchor: 'bottom',
            },
          ],
          hovermode: 'x unified',
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />

      {/* Tabla de métricas */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-500 font-medium">Modelo</th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">Peso</th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">RMSE</th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">MAE</th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">MAPE</th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">Ultimo precio</th>
            </tr>
          </thead>
          <tbody>
            {(['sarima', 'xgboost', 'lstm'] as const).map((key) => {
              const config = modelConfig[key];
              const metrics = prediction.metrics[key];
              const weight = prediction.weights[key];
              const lastPrice = prediction.individual_predictions[key].slice(-1)[0];

              return (
                <tr key={key} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                      <span className="text-white font-medium">{config.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">
                    {(weight * 100).toFixed(1)}%
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">
                    ${convertPrice(metrics.rmse, unit).toFixed(2)}
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">
                    ${convertPrice(metrics.mae, unit).toFixed(2)}
                  </td>
                  <td className="text-right py-2 px-3">
                    <span className={`${metrics.mape < 5 ? 'text-emerald-400' : metrics.mape < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {metrics.mape.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">
                    ${convertPrice(lastPrice, unit).toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {/* Ensemble row */}
            <tr className="bg-slate-800/30 font-semibold">
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: modelConfig.ensemble.color }} />
                  <span className="text-white">Ensemble</span>
                </div>
              </td>
              <td className="text-right py-2 px-3 text-white">100%</td>
              <td className="text-right py-2 px-3 text-slate-400" colSpan={2}>
                Combinacion ponderada
              </td>
              <td className="text-right py-2 px-3 text-slate-400">-</td>
              <td className="text-right py-2 px-3 text-white">
                ${convertPrice(prediction.seco.forecast.slice(-1)[0], unit).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Descripciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['sarima', 'xgboost', 'lstm'] as const).map((key) => {
          const config = modelConfig[key];
          return (
            <div key={key} className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                <span className="text-sm font-medium text-white">{config.name}</span>
              </div>
              <p className="text-xs text-slate-500">{config.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
