'use client';

import dynamic from 'next/dynamic';
import { PriceUnit, convertPrice } from '@/lib/units';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface HistoricalData {
  date: string;
  close_seco: number;
  close_baba: number;
}

interface HistoricalChartProps {
  data: HistoricalData[];
  showBaba: boolean;
  unit: PriceUnit;
}

export default function HistoricalChart({ data, showBaba, unit }: HistoricalChartProps) {
  const dates = data.map((d) => d.date);
  const secoValues = data.map((d) => convertPrice(d.close_seco, unit));
  const babaValues = data.map((d) => convertPrice(d.close_baba, unit));

  const traces: any[] = [
    {
      x: dates,
      y: secoValues,
      type: 'scatter',
      mode: 'lines',
      name: 'Cacao Seco',
      line: { color: '#d4802a', width: 2 },
      hovertemplate: `Fecha: %{x}<br>Seco: $%{y:.2f} ${unit.shortLabel}<extra></extra>`,
    },
  ];

  if (showBaba) {
    traces.push({
      x: dates,
      y: babaValues,
      type: 'scatter',
      mode: 'lines',
      name: 'Cacao en Baba',
      line: { color: '#f59e0b', width: 2, dash: 'dot' },
      hovertemplate: `Fecha: %{x}<br>Baba: $%{y:.2f} ${unit.shortLabel}<extra></extra>`,
    });
  }

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#94a3b8' },
        xaxis: {
          gridcolor: '#334155',
          rangeslider: { visible: true },
        },
        yaxis: {
          gridcolor: '#334155',
          title: `Precio (${unit.suffix})`,
        },
        legend: {
          x: 0,
          y: 1.1,
          orientation: 'h',
        },
        margin: { l: 60, r: 20, t: 10, b: 40 },
        hovermode: 'x unified',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '400px' }}
    />
  );
}
