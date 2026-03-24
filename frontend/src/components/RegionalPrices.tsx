'use client';

import { Globe, MapPin, ArrowDown } from 'lucide-react';
import { PriceUnit, convertPrice } from '@/lib/units';

interface RegionData {
  region: string;
  region_key: string;
  currency: string;
  currency_symbol: string;
  factor: number;
  factor_pct: number;
  description: string;
  seco_usd: number;
  baba_usd: number;
  seco_local: number | null;
  baba_local: number | null;
  fx_rate: number | null;
}

interface RegionalPricesData {
  date: string;
  is_demo: boolean;
  international_price_usd: number;
  regions: RegionData[];
}

interface RegionalPricesProps {
  data: RegionalPricesData;
  unit: PriceUnit;
  showBaba: boolean;
}

const regionFlags: Record<string, string> = {
  ecuador: '\uD83C\uDDEA\uD83C\uDDE8',
  costa_de_marfil: '\uD83C\uDDE8\uD83C\uDDEE',
  ghana: '\uD83C\uDDEC\uD83C\uDDED',
};

const regionColors: Record<string, string> = {
  ecuador: 'border-blue-700 bg-blue-900/20',
  costa_de_marfil: 'border-orange-700 bg-orange-900/20',
  ghana: 'border-green-700 bg-green-900/20',
};

export default function RegionalPrices({ data, unit, showBaba }: RegionalPricesProps) {
  return (
    <div className="space-y-4">
      {/* Precio internacional de referencia */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-cacao-400" />
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Precio Internacional (ICE NY)</span>
            <p className="text-xl font-bold text-white">
              ${convertPrice(data.international_price_usd, unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-400 ml-1">{unit.suffix}</span>
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500">{data.date}</span>
      </div>

      <div className="flex items-center justify-center">
        <ArrowDown className="w-4 h-4 text-slate-600" />
        <span className="text-xs text-slate-600 ml-2">Precio estimado al productor</span>
        <ArrowDown className="w-4 h-4 text-slate-600 ml-2" />
      </div>

      {/* Precios por región */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.regions.map((region) => (
          <div
            key={region.region_key}
            className={`rounded-xl border p-5 ${regionColors[region.region_key] || 'border-slate-700 bg-slate-800/50'}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{regionFlags[region.region_key] || ''}</span>
              <div>
                <h4 className="font-semibold text-white">{region.region}</h4>
                <span className="text-xs text-slate-400">
                  Productor recibe ~{region.factor_pct}%
                </span>
              </div>
            </div>

            {/* Precio seco en USD */}
            <div className="mb-3">
              <span className="text-xs text-slate-500">Cacao Seco</span>
              <p className="text-lg font-bold text-white">
                ${convertPrice(region.seco_usd, unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs text-slate-400 ml-1">{unit.suffix}</span>
              </p>
              {/* Precio en moneda local */}
              {region.seco_local != null && region.currency !== 'USD' && (
                <p className="text-sm text-slate-400">
                  {region.currency_symbol} {convertPrice(region.seco_local, unit).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  <span className="text-xs text-slate-500 ml-1">{region.currency}/{unit.shortLabel}</span>
                </p>
              )}
            </div>

            {/* Precio baba en USD */}
            {showBaba && (
              <div className="mb-3">
                <span className="text-xs text-slate-500">Cacao en Baba</span>
                <p className="text-md font-semibold text-amber-400">
                  ${convertPrice(region.baba_usd, unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs text-slate-500 ml-1">{unit.suffix}</span>
                </p>
                {region.baba_local != null && region.currency !== 'USD' && (
                  <p className="text-sm text-slate-500">
                    {region.currency_symbol} {convertPrice(region.baba_local, unit).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    <span className="text-xs text-slate-600 ml-1">{region.currency}/{unit.shortLabel}</span>
                  </p>
                )}
              </div>
            )}

            {/* Tipo de cambio */}
            {region.fx_rate != null && region.currency !== 'USD' && (
              <div className="text-xs text-slate-600 border-t border-slate-700 pt-2 mt-2">
                TC: 1 USD = {region.fx_rate} {region.currency}
              </div>
            )}

            {/* Descripción */}
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{region.description}</p>
          </div>
        ))}
      </div>

      {data.is_demo && (
        <p className="text-xs text-slate-600 text-center">
          * Datos de demostracion. Los precios reales se cargan automaticamente con conexion a internet.
        </p>
      )}
    </div>
  );
}
