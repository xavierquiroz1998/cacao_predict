'use client';

import dynamic from 'next/dynamic';
import { PriceUnit, convertPrice } from '@/lib/units';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface RegionInfo {
  name: string;
  lat: number;
  lon: number;
  flag: string;
  production: string;
  climate: string;
  currency: string;
  factor: number;
}

interface ProducerMapProps {
  internationalPrice: number;
  unit: PriceUnit;
  babaRatio: number;
}

const regions: RegionInfo[] = [
  {
    name: 'Costa de Marfil',
    lat: 6.83,
    lon: -5.55,
    flag: '🇨🇮',
    production: '~2.2M ton/ano (40% mundial)',
    climate: 'Tropical humedo, 25-30°C',
    currency: 'XOF',
    factor: 0.60,
  },
  {
    name: 'Ghana',
    lat: 7.95,
    lon: -1.02,
    flag: '🇬🇭',
    production: '~800K ton/ano (15% mundial)',
    climate: 'Tropical, 24-28°C',
    currency: 'GHS',
    factor: 0.65,
  },
  {
    name: 'Ecuador',
    lat: -1.83,
    lon: -78.18,
    flag: '🇪🇨',
    production: '~380K ton/ano (7% mundial)',
    climate: 'Subtropical costeno, 24-28°C',
    currency: 'USD',
    factor: 0.62,
  },
  {
    name: 'Camerun',
    lat: 5.95,
    lon: 10.15,
    flag: '🇨🇲',
    production: '~290K ton/ano (5% mundial)',
    climate: 'Tropical humedo, 23-28°C',
    currency: 'XAF',
    factor: 0.55,
  },
  {
    name: 'Nigeria',
    lat: 7.49,
    lon: 3.38,
    flag: '🇳🇬',
    production: '~270K ton/ano (5% mundial)',
    climate: 'Tropical, 25-30°C',
    currency: 'NGN',
    factor: 0.50,
  },
  {
    name: 'Indonesia',
    lat: -2.55,
    lon: 118.01,
    flag: '🇮🇩',
    production: '~200K ton/ano (4% mundial)',
    climate: 'Tropical ecuatorial, 26-30°C',
    currency: 'IDR',
    factor: 0.55,
  },
  {
    name: 'Brasil',
    lat: -14.24,
    lon: -40.23,
    flag: '🇧🇷',
    production: '~200K ton/ano (4% mundial)',
    climate: 'Tropical costeno, 24-28°C',
    currency: 'BRL',
    factor: 0.58,
  },
];

export default function ProducerMap({ internationalPrice, unit, babaRatio }: ProducerMapProps) {
  const regionsWithPrice = regions.map((r) => ({
    ...r,
    priceUsd: internationalPrice * r.factor,
  }));

  const sizes = regionsWithPrice.map((r) => {
    const pct = parseFloat(r.production.match(/(\d+)/)?.[0] || '100');
    return Math.max(20, Math.min(60, pct / 40));
  });

  return (
    <div className="space-y-4">
      <Plot
        data={[
          {
            type: 'scattergeo',
            lat: regionsWithPrice.map((r) => r.lat),
            lon: regionsWithPrice.map((r) => r.lon),
            text: regionsWithPrice.map(
              (r) =>
                `<b>${r.flag} ${r.name}</b><br>` +
                `Produccion: ${r.production}<br>` +
                `Clima: ${r.climate}<br>` +
                `Precio productor: $${convertPrice(r.priceUsd, unit).toFixed(2)} ${unit.suffix}<br>` +
                `Baba: $${convertPrice(r.priceUsd * babaRatio, unit).toFixed(2)} ${unit.suffix}<br>` +
                `Factor: ${(r.factor * 100).toFixed(0)}% del precio intl.`
            ),
            hoverinfo: 'text',
            marker: {
              size: sizes,
              color: regionsWithPrice.map((r) => r.priceUsd),
              colorscale: [
                [0, '#b86420'],
                [0.5, '#d4802a'],
                [1, '#f9eddb'],
              ],
              showscale: true,
              colorbar: {
                title: { text: `Precio (${unit.suffix})`, font: { color: '#94a3b8', size: 11 } },
                tickfont: { color: '#94a3b8' },
                bgcolor: 'transparent',
              },
              line: { width: 1, color: '#475569' },
            },
            mode: 'markers',
          },
        ]}
        layout={{
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#94a3b8' },
          margin: { l: 0, r: 0, t: 0, b: 0 },
          height: 450,
          geo: {
            scope: 'world',
            showframe: false,
            showcoastlines: true,
            coastlinecolor: '#334155',
            showland: true,
            landcolor: '#1e293b',
            showocean: true,
            oceancolor: '#0f172a',
            showcountries: true,
            countrycolor: '#334155',
            showlakes: false,
            projection: { type: 'natural earth' },
            center: { lat: 5, lon: 0 },
            lataxis: { range: [-35, 35] },
            lonaxis: { range: [-100, 140] },
            bgcolor: 'transparent',
          },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%' }}
      />

      {/* Grid de regiones */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {regionsWithPrice.map((r) => (
          <div key={r.name} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 text-center">
            <span className="text-xl">{r.flag}</span>
            <p className="text-xs font-medium text-white mt-1">{r.name}</p>
            <p className="text-xs text-cacao-400 font-semibold">
              ${convertPrice(r.priceUsd, unit).toFixed(2)}
            </p>
            <p className="text-xs text-slate-600">{unit.suffix}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
