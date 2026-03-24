'use client';

import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { PriceUnit, convertPrice } from '@/lib/units';

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
}

interface PredictionSummaryProps {
  prediction: PredictionData;
  currentPrice: number; // precio actual seco en USD/ton
  unit: PriceUnit;
  showBaba: boolean;
}

export default function PredictionSummary({
  prediction,
  currentPrice,
  unit,
  showBaba,
}: PredictionSummaryProps) {
  const forecast = prediction.seco.forecast;
  const lastForecast = forecast[forecast.length - 1];
  const midForecast = forecast[Math.floor(forecast.length / 2)];

  const change = lastForecast - currentPrice;
  const changePct = (change / currentPrice) * 100;
  const isUp = change > 0;

  const changeMid = midForecast - currentPrice;
  const changeMidPct = (changeMid / currentPrice) * 100;
  const isMidUp = changeMid > 0;

  // Tendencia: comparar promedio primera mitad vs segunda mitad
  const firstHalf = forecast.slice(0, Math.floor(forecast.length / 2));
  const secondHalf = forecast.slice(Math.floor(forecast.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendUp = avgSecond > avgFirst;

  // Volatilidad: diferencia entre CI superior e inferior al final
  const lastUpper = prediction.seco.upper_ci[forecast.length - 1];
  const lastLower = prediction.seco.lower_ci[forecast.length - 1];
  const uncertainty = ((lastUpper - lastLower) / lastForecast) * 100;

  // Confianza basada en la dispersión
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

  // Min y max del forecast
  const minForecast = Math.min(...forecast);
  const maxForecast = Math.max(...forecast);

  return (
    <div className="space-y-4">
      {/* Veredicto principal */}
      <div className={`rounded-xl border p-6 ${
        isUp
          ? 'bg-emerald-900/20 border-emerald-800'
          : 'bg-red-900/20 border-red-800'
      }`}>
        <div className="flex items-center gap-3 mb-3">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {/* Precio actual */}
          <div>
            <span className="text-xs text-slate-500 block">Precio actual</span>
            <span className="text-lg font-semibold text-white">
              ${convertPrice(currentPrice, unit).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 block">{unit.suffix}</span>
          </div>

          {/* Precio proyectado */}
          <div>
            <span className="text-xs text-slate-500 block">Precio proyectado</span>
            <span className={`text-lg font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              ${convertPrice(lastForecast, unit).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 block">{unit.suffix}</span>
          </div>

          {/* Cambio */}
          <div>
            <span className="text-xs text-slate-500 block">Variacion</span>
            <span className={`text-lg font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{changePct.toFixed(1)}%
            </span>
            <span className={`text-xs ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
              {isUp ? '+' : ''}${convertPrice(Math.abs(change), unit).toFixed(2)} {unit.shortLabel}
            </span>
          </div>

          {/* Confianza */}
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

      {/* Detalle de la proyeccion */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Rango de precios */}
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

        {/* Tendencia a mitad de periodo */}
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

        {/* Tendencia general */}
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
