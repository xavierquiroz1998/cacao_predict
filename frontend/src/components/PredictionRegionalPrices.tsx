'use client';

import { TrendingUp, TrendingDown, Globe, MapPin } from 'lucide-react';
import { PriceUnit, convertPrice } from '@/lib/units';

interface PredictionRegionalPricesProps {
  currentPrice: number;   // precio actual internacional seco USD/ton
  projectedPrice: number; // precio proyectado internacional seco USD/ton
  unit: PriceUnit;
  showBaba: boolean;
  babaRatio: number;
}

const regions = [
  {
    key: 'ecuador',
    label: 'Ecuador',
    flag: '\uD83C\uDDEA\uD83C\uDDE8',
    factor: 0.62,
    currency: 'USD',
    currencySymbol: '$',
    fxRate: null,
    color: 'border-blue-700 bg-blue-900/20',
  },
  {
    key: 'costa_de_marfil',
    label: 'Costa de Marfil',
    flag: '\uD83C\uDDE8\uD83C\uDDEE',
    factor: 0.60,
    currency: 'XOF',
    currencySymbol: 'FCFA',
    fxRate: 615.0,
    color: 'border-orange-700 bg-orange-900/20',
  },
  {
    key: 'ghana',
    label: 'Ghana',
    flag: '\uD83C\uDDEC\uD83C\uDDED',
    factor: 0.65,
    currency: 'GHS',
    currencySymbol: 'GH\u20B5',
    fxRate: 15.5,
    color: 'border-green-700 bg-green-900/20',
  },
];

export default function PredictionRegionalPrices({
  currentPrice,
  projectedPrice,
  unit,
  showBaba,
  babaRatio,
}: PredictionRegionalPricesProps) {
  const change = projectedPrice - currentPrice;
  const changePct = (change / currentPrice) * 100;
  const isUp = change > 0;

  return (
    <div className="space-y-4">
      {/* Internacional */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <Globe className="w-5 h-5 text-cacao-400" />
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Precio Internacional (ICE NY) - Proyectado
          </span>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-xs text-slate-500">Actual</span>
            <p className="text-lg font-bold text-white">
              ${convertPrice(currentPrice, unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-400 ml-1">{unit.suffix}</span>
            </p>
          </div>
          <div className="text-slate-600">{'\u2192'}</div>
          <div>
            <span className="text-xs text-slate-500">Proyectado</span>
            <p className={`text-lg font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              ${convertPrice(projectedPrice, unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-400 ml-1">{unit.suffix}</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isUp ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{changePct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Por region */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {regions.map((region) => {
          const currentRegional = currentPrice * region.factor;
          const projectedRegional = projectedPrice * region.factor;
          const regionalChange = projectedRegional - currentRegional;
          const regionalChangePct = (regionalChange / currentRegional) * 100;
          const regionalIsUp = regionalChange > 0;

          const currentBaba = currentRegional * babaRatio;
          const projectedBaba = projectedRegional * babaRatio;

          return (
            <div
              key={region.key}
              className={`rounded-xl border p-5 ${region.color}`}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{region.flag}</span>
                <div>
                  <h4 className="font-semibold text-white">{region.label}</h4>
                  <span className="text-xs text-slate-400">
                    Productor recibe ~{Math.round(region.factor * 100)}%
                  </span>
                </div>
              </div>

              {/* Precio seco */}
              <div className="mb-3">
                <span className="text-xs text-slate-500">Cacao Seco</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-400">
                    ${convertPrice(currentRegional, unit).toFixed(2)}
                  </span>
                  <span className="text-slate-600">{'\u2192'}</span>
                  <span className={`text-lg font-bold ${regionalIsUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${convertPrice(projectedRegional, unit).toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">{unit.suffix}</span>
                </div>
                {/* Moneda local */}
                {region.fxRate && (
                  <p className="text-sm text-slate-500 mt-1">
                    {region.currencySymbol} {convertPrice(projectedRegional * region.fxRate, unit).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    <span className="text-xs text-slate-600 ml-1">{region.currency}/{unit.shortLabel}</span>
                  </p>
                )}
              </div>

              {/* Precio baba */}
              {showBaba && (
                <div className="mb-3">
                  <span className="text-xs text-slate-500">Cacao en Baba</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-500">
                      ${convertPrice(currentBaba, unit).toFixed(2)}
                    </span>
                    <span className="text-slate-600">{'\u2192'}</span>
                    <span className="text-md font-semibold text-amber-400">
                      ${convertPrice(projectedBaba, unit).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500">{unit.suffix}</span>
                  </div>
                </div>
              )}

              {/* Cambio */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50">
                {regionalIsUp ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={`text-sm font-medium ${regionalIsUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {regionalIsUp ? '+' : ''}{regionalChangePct.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">
                  ({regionalIsUp ? '+' : ''}${convertPrice(Math.abs(regionalChange), unit).toFixed(2)} {unit.shortLabel})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
