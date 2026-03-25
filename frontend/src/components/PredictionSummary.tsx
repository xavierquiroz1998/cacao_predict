'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight, ChevronDown, ChevronUp, Info, Brain, BarChart3, Activity } from 'lucide-react';
import { PriceUnit, convertPrice } from '@/lib/units';

interface ModelMetrics {
  mse?: number;
  rmse?: number;
  mae?: number;
  mape?: number;
  error?: string;
}

interface PredictionData {
  dates: string[];
  seco: {
    forecast: number[];
    lower_ci: number[];
    upper_ci: number[];
  };
  baba: {
    forecast: number[];
    lower_ci: number[];
    upper_ci: number[];
  };
  weights: Record<string, number>;
  metrics?: Record<string, ModelMetrics>;
  individual_predictions?: Record<string, number[]>;
}

interface PredictionSummaryProps {
  prediction: PredictionData;
  currentPrice: number;
  unit: PriceUnit;
  showBaba: boolean;
}

export default function PredictionSummary({
  prediction,
  currentPrice,
  unit,
  showBaba,
}: PredictionSummaryProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const forecast = prediction.seco.forecast;
  const lastForecast = forecast[forecast.length - 1];
  const midForecast = forecast[Math.floor(forecast.length / 2)];

  const change = lastForecast - currentPrice;
  const changePct = (change / currentPrice) * 100;
  const isUp = change > 0;

  const changeMid = midForecast - currentPrice;
  const changeMidPct = (changeMid / currentPrice) * 100;
  const isMidUp = changeMid > 0;

  const firstHalf = forecast.slice(0, Math.floor(forecast.length / 2));
  const secondHalf = forecast.slice(Math.floor(forecast.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendUp = avgSecond > avgFirst;

  const lastUpper = prediction.seco.upper_ci[forecast.length - 1];
  const lastLower = prediction.seco.lower_ci[forecast.length - 1];
  const uncertainty = ((lastUpper - lastLower) / lastForecast) * 100;

  let confidence: string;
  let confidenceColor: string;
  if (uncertainty < 10) {
    confidence = 'Alta';
    confidenceColor = 'text-emerald-400';
  } else if (uncertainty < 25) {
    confidence = 'Moderada';
    confidenceColor = 'text-yellow-400';
  } else {
    confidence = 'Baja';
    confidenceColor = 'text-red-400';
  }

  const horizonLabel = forecast.length <= 7 ? `${forecast.length} dias` :
    forecast.length <= 14 ? `${forecast.length} dias` :
    forecast.length <= 21 ? '3 semanas' :
    forecast.length <= 30 ? '1 mes' :
    forecast.length <= 60 ? '2 meses' :
    forecast.length <= 90 ? '3 meses' :
    forecast.length <= 180 ? '6 meses' : '1 ano';

  const minForecast = Math.min(...forecast);
  const maxForecast = Math.max(...forecast);

  // Datos para el panel explicativo
  const weights = prediction.weights || {};
  const metrics = prediction.metrics || {};
  const individual = prediction.individual_predictions || {};

  // Calcular MAPE del ensemble ponderado
  const ensembleMape = Object.entries(weights).reduce((sum, [name, w]) => {
    const mape = metrics[name]?.mape || 100;
    return sum + w * mape;
  }, 0);

  // Generar explicación de por qué sube/baja
  const explanations: { icon: string; title: string; detail: string; impact: 'positive' | 'negative' | 'neutral' }[] = [];

  // 1. Consenso de modelos
  const modelDirections = Object.entries(individual).map(([name, preds]) => {
    const last = preds[preds.length - 1];
    return { name, direction: last > currentPrice ? 'sube' : 'baja', change: ((last - currentPrice) / currentPrice) * 100 };
  });
  const modelsUp = modelDirections.filter(m => m.direction === 'sube').length;
  const modelsDown = modelDirections.filter(m => m.direction === 'baja').length;

  if (modelsUp > modelsDown) {
    explanations.push({
      icon: '🤝',
      title: `${modelsUp} de ${modelsUp + modelsDown} modelos predicen alza`,
      detail: modelDirections.map(m => `${m.name.toUpperCase()}: ${m.direction === 'sube' ? '+' : ''}${m.change.toFixed(1)}%`).join(' | '),
      impact: 'positive',
    });
  } else if (modelsDown > modelsUp) {
    explanations.push({
      icon: '🤝',
      title: `${modelsDown} de ${modelsUp + modelsDown} modelos predicen baja`,
      detail: modelDirections.map(m => `${m.name.toUpperCase()}: ${m.direction === 'sube' ? '+' : ''}${m.change.toFixed(1)}%`).join(' | '),
      impact: 'negative',
    });
  } else {
    explanations.push({
      icon: '⚖️',
      title: 'Los modelos no tienen consenso claro',
      detail: modelDirections.map(m => `${m.name.toUpperCase()}: ${m.direction === 'sube' ? '+' : ''}${m.change.toFixed(1)}%`).join(' | '),
      impact: 'neutral',
    });
  }

  // 2. Modelo dominante
  const dominantModel = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
  if (dominantModel) {
    const [name, w] = dominantModel;
    const mape = metrics[name]?.mape;
    explanations.push({
      icon: '🏆',
      title: `${name.toUpperCase()} domina la prediccion (${(w * 100).toFixed(0)}% del peso)`,
      detail: mape ? `Precision historica: ${mape.toFixed(1)}% de error promedio (MAPE)` : 'Sin metricas disponibles',
      impact: 'neutral',
    });
  }

  // 3. Tendencia
  if (trendUp !== isUp) {
    explanations.push({
      icon: '🔄',
      title: 'Cambio de tendencia en la segunda mitad',
      detail: `La primera mitad ${avgFirst > currentPrice ? 'sube' : 'baja'} pero la segunda mitad ${trendUp ? 'se recupera' : 'se debilita'}`,
      impact: 'neutral',
    });
  } else {
    explanations.push({
      icon: isUp ? '📈' : '📉',
      title: `Tendencia ${isUp ? 'alcista' : 'bajista'} sostenida durante todo el periodo`,
      detail: `Promedio primera mitad: $${convertPrice(avgFirst, unit).toFixed(2)} → segunda mitad: $${convertPrice(avgSecond, unit).toFixed(2)}`,
      impact: isUp ? 'positive' : 'negative',
    });
  }

  // 4. Volatilidad / confianza
  explanations.push({
    icon: confidence === 'Alta' ? '🎯' : confidence === 'Moderada' ? '🔮' : '⚠️',
    title: `Confianza ${confidence} (rango ±${(uncertainty / 2).toFixed(1)}%)`,
    detail: `Error promedio del ensemble: ${ensembleMape.toFixed(1)}%. ${
      confidence === 'Alta'
        ? 'Los modelos coinciden y tienen buen historial — la prediccion es fiable.'
        : confidence === 'Moderada'
        ? 'Hay algo de dispersion entre modelos — usar como referencia, no como certeza.'
        : 'Los modelos divergen mucho — tomar con precaucion.'
    }`,
    impact: confidence === 'Alta' ? 'positive' : confidence === 'Baja' ? 'negative' : 'neutral',
  });

  return (
    <div className="space-y-4">
      {/* Veredicto principal — clickeable */}
      <div
        className={`rounded-xl border p-6 cursor-pointer transition-all ${
          isUp
            ? 'bg-emerald-900/20 border-emerald-800 hover:bg-emerald-900/30'
            : 'bg-red-900/20 border-red-800 hover:bg-red-900/30'
        }`}
        onClick={() => setShowExplanation(!showExplanation)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {isUp ? (
              <div className="w-12 h-12 rounded-full bg-emerald-900/50 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-white">
                El precio {isUp ? 'SUBE' : 'BAJA'}
              </h3>
              <p className="text-sm text-slate-400">
                Proyeccion a {horizonLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Ver por que</span>
            {showExplanation ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <span className="text-xs text-slate-500 block">Precio actual</span>
            <span className="text-lg font-semibold text-white">
              ${convertPrice(currentPrice, unit).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 block">{unit.suffix}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Precio proyectado</span>
            <span className={`text-lg font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              ${convertPrice(lastForecast, unit).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 block">{unit.suffix}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Variacion</span>
            <span className={`text-lg font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{changePct.toFixed(1)}%
            </span>
            <span className={`text-xs ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
              {isUp ? '+' : ''}${convertPrice(Math.abs(change), unit).toFixed(2)} {unit.shortLabel}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Confianza</span>
            <span className={`text-lg font-semibold ${confidenceColor}`}>
              {confidence}
            </span>
            <span className="text-xs text-slate-500 block">
              Rango: {'\u00B1'}{(uncertainty / 2).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Panel explicativo expandible */}
      {showExplanation && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 space-y-4 animate-in">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-cacao-400" />
            ¿Por que {isUp ? 'sube' : 'baja'} el precio?
          </h4>

          <div className="space-y-3">
            {explanations.map((exp, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 border ${
                  exp.impact === 'positive'
                    ? 'bg-emerald-900/10 border-emerald-800/50'
                    : exp.impact === 'negative'
                    ? 'bg-red-900/10 border-red-800/50'
                    : 'bg-slate-800/30 border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{exp.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{exp.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{exp.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pesos y métricas de cada modelo */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h5 className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 className="w-3 h-3" />
              Contribucion de cada modelo
            </h5>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(weights).map(([name, weight]) => {
                const m = metrics[name];
                const mape = m?.mape;
                const indivPred = individual[name];
                const indivLast = indivPred ? indivPred[indivPred.length - 1] : null;
                const indivChange = indivLast ? ((indivLast - currentPrice) / currentPrice) * 100 : 0;
                const indivUp = indivChange > 0;

                return (
                  <div key={name} className="bg-slate-800/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white uppercase">{name}</span>
                      <span className="text-xs text-cacao-400 font-semibold">{(weight * 100).toFixed(0)}%</span>
                    </div>
                    {/* Barra de peso */}
                    <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                      <div
                        className="bg-cacao-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${weight * 100}%` }}
                      />
                    </div>
                    {mape !== undefined && (
                      <p className="text-xs text-slate-500">
                        Error: {mape.toFixed(1)}% MAPE
                      </p>
                    )}
                    {indivLast && (
                      <p className={`text-xs font-medium ${indivUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        Predice: {indivUp ? '+' : ''}{indivChange.toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nota */}
          <p className="text-xs text-slate-600 italic mt-3">
            La prediccion combina 3 modelos (SARIMA, XGBoost, LSTM) ponderados por su precision historica.
            El modelo con menor error tiene mayor influencia en el resultado final.
          </p>
        </div>
      )}

      {/* Detalle de la proyeccion */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Rango proyectado</h4>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500">Min</span>
              <p className="text-sm font-medium text-slate-300">
                ${convertPrice(minForecast, unit).toFixed(2)}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <div className="text-right">
              <span className="text-xs text-slate-500">Max</span>
              <p className="text-sm font-medium text-slate-300">
                ${convertPrice(maxForecast, unit).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            A mitad de periodo
          </h4>
          <div className="flex items-center gap-2">
            {isMidUp ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${isMidUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isMidUp ? '+' : ''}{changeMidPct.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">
              (${convertPrice(midForecast, unit).toFixed(2)})
            </span>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tendencia</h4>
          <div className="flex items-center gap-2">
            {trendUp ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trendUp ? 'Alcista' : 'Bajista'}
            </span>
            <span className="text-xs text-slate-500">
              en la segunda mitad del periodo
            </span>
          </div>
        </div>
      </div>

      {/* Baba */}
      {showBaba && (
        <div className="bg-amber-900/10 border border-amber-800/50 rounded-lg p-4">
          <h4 className="text-xs text-amber-500 uppercase tracking-wider mb-2">Proyeccion Cacao en Baba</h4>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-xs text-slate-500">Actual</span>
              <p className="text-sm font-medium text-amber-400">
                ${convertPrice(currentPrice * 0.4, unit).toFixed(2)} {unit.shortLabel}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <div>
              <span className="text-xs text-slate-500">Proyectado</span>
              <p className="text-sm font-medium text-amber-400">
                ${convertPrice(prediction.baba.forecast[prediction.baba.forecast.length - 1], unit).toFixed(2)} {unit.shortLabel}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Variacion</span>
              <p className={`text-sm font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{changePct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
