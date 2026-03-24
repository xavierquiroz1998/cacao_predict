'use client';

import dynamic from 'next/dynamic';
import { PriceUnit, convertPrice } from '@/lib/units';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

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
}

interface PredictionChartProps {
  prediction: PredictionData;
  historicalDates: string[];
  historicalPrices: number[];
  showBaba: boolean;
  unit: PriceUnit;
}

export default function PredictionChart({
  prediction,
  historicalDates,
  historicalPrices,
  showBaba,
  unit,
}: PredictionChartProps) {
  const lastHistorical = historicalPrices.length > 60 ? 60 : historicalPrices.length;

  const conv = (values: number[]) => values.map((v) => convertPrice(v, unit));

  const traces: any[] = [
    // Histórico reciente
    {
      x: historicalDates.slice(-lastHistorical),
      y: conv(historicalPrices.slice(-lastHistorical)),
      type: 'scatter',
      mode: 'lines',
      name: 'Historico (Seco)',
      line: { color: '#d4802a', width: 2 },
    },
    // Predicción seco
    {
      x: prediction.dates,
      y: conv(prediction.seco.forecast),
      type: 'scatter',
      mode: 'lines',
      name: 'Prediccion (Seco)',
      line: { color: '#22c55e', width: 2, dash: 'dash' },
    },
    // Intervalo de confianza seco
    {
      x: [...prediction.dates, ...prediction.dates.slice().reverse()],
      y: [...conv(prediction.seco.upper_ci), ...conv(prediction.seco.lower_ci).reverse()],
      type: 'scatter',
      fill: 'toself',
      fillcolor: 'rgba(34, 197, 94, 0.1)',
      line: { color: 'transparent' },
      name: 'IC 95% (Seco)',
      showlegend: true,
      hoverinfo: 'skip',
    },
  ];

  if (showBaba) {
    traces.push(
      {
        x: prediction.dates,
        y: conv(prediction.baba.forecast),
        type: 'scatter',
        mode: 'lines',
        name: 'Prediccion (Baba)',
        line: { color: '#f59e0b', width: 2, dash: 'dot' },
      },
      {
        x: [...prediction.dates, ...prediction.dates.slice().reverse()],
        y: [...conv(prediction.baba.upper_ci), ...conv(prediction.baba.lower_ci).reverse()],
        type: 'scatter',
        fill: 'toself',
        fillcolor: 'rgba(245, 158, 11, 0.1)',
        line: { color: 'transparent' },
        name: 'IC 95% (Baba)',
        showlegend: true,
        hoverinfo: 'skip',
      }
    );
  }

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#94a3b8' },
        xaxis: { gridcolor: '#334155' },
        yaxis: { gridcolor: '#334155', title: `Precio (${unit.suffix})` },
        legend: { x: 0, y: 1.15, orientation: 'h' },
        margin: { l: 60, r: 20, t: 10, b: 40 },
        shapes: [
          {
            type: 'line',
            x0: prediction.dates[0],
            x1: prediction.dates[0],
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { color: '#64748b', width: 1, dash: 'dot' },
          },
        ],
        annotations: [
          {
            x: prediction.dates[0],
            y: 1.05,
            yref: 'paper',
            text: 'Inicio prediccion',
            showarrow: false,
            font: { color: '#94a3b8', size: 11 },
          },
        ],
        hovermode: 'x unified',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height: '450px' }}
    />
  );
}
