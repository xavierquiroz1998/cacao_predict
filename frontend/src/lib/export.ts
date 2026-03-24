/**
 * Utilidades para exportar datos en CSV y PDF.
 */

export function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          // Escapar comillas y valores con comas
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? '';
        })
        .join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportHistoricalCSV(data: any[]) {
  const rows = data.map((d: any) => ({
    Fecha: d.date,
    'Apertura (USD/ton)': d.open_seco,
    'Maximo (USD/ton)': d.high_seco,
    'Minimo (USD/ton)': d.low_seco,
    'Cierre Seco (USD/ton)': d.close_seco,
    'Cierre Baba (USD/ton)': d.close_baba,
    Volumen: d.volume,
  }));
  downloadCSV(rows, `cacao_historico_${new Date().toISOString().split('T')[0]}`);
}

export function exportPredictionCSV(prediction: any) {
  const rows = prediction.dates.map((date: string, i: number) => ({
    Fecha: date,
    'Prediccion Seco (USD/ton)': prediction.seco.forecast[i]?.toFixed(2),
    'IC Inferior Seco': prediction.seco.lower_ci[i]?.toFixed(2),
    'IC Superior Seco': prediction.seco.upper_ci[i]?.toFixed(2),
    'Prediccion Baba (USD/ton)': prediction.baba.forecast[i]?.toFixed(2),
    SARIMA: prediction.individual_predictions?.sarima[i]?.toFixed(2),
    XGBoost: prediction.individual_predictions?.xgboost[i]?.toFixed(2),
    LSTM: prediction.individual_predictions?.lstm[i]?.toFixed(2),
  }));
  downloadCSV(rows, `cacao_prediccion_${new Date().toISOString().split('T')[0]}`);
}

export function exportAnalysisCSV(analysis: any) {
  const rows = analysis.factors.map((f: any) => ({
    Factor: f.factor,
    Valor: f.value,
    Impacto: f.impact,
    Descripcion: f.description,
  }));

  // Agregar resumen al inicio
  rows.unshift({
    Factor: 'RESUMEN',
    Valor: analysis.current_price_seco,
    Impacto: analysis.direction,
    Descripcion: analysis.summary,
  });

  downloadCSV(rows, `cacao_analisis_${new Date().toISOString().split('T')[0]}`);
}

export function generatePDFContent(title: string, sections: { heading: string; content: string }[]) {
  // Genera un HTML simple que se puede imprimir como PDF via window.print()
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { color: #b86420; border-bottom: 2px solid #b86420; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .up { color: #16a34a; } .down { color: #dc2626; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p style="color:#999;">Generado el ${new Date().toLocaleDateString()}</p>
      ${sections.map((s) => `<h2>${s.heading}</h2>${s.content}`).join('')}
      <div class="footer">CacaoPredict | Generado automaticamente</div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

export function exportPredictionPDF(prediction: any, currentPrice: number) {
  const lastForecast = prediction.seco.forecast[prediction.seco.forecast.length - 1];
  const change = lastForecast - currentPrice;
  const changePct = (change / currentPrice) * 100;
  const isUp = change > 0;

  const tableRows = prediction.dates
    .map(
      (date: string, i: number) => `
    <tr>
      <td>${date}</td>
      <td>$${prediction.seco.forecast[i]?.toFixed(2)}</td>
      <td>$${prediction.seco.lower_ci[i]?.toFixed(2)}</td>
      <td>$${prediction.seco.upper_ci[i]?.toFixed(2)}</td>
      <td>$${prediction.baba?.forecast[i]?.toFixed(2) || '-'}</td>
    </tr>`
    )
    .join('');

  generatePDFContent('CacaoPredict - Reporte de Prediccion', [
    {
      heading: 'Resumen',
      content: `
        <p>El precio del cacao <span class="${isUp ? 'up' : 'down'}">${isUp ? 'SUBE' : 'BAJA'}</span>
        un <strong>${Math.abs(changePct).toFixed(1)}%</strong> en el periodo proyectado.</p>
        <p>Precio actual: <strong>$${currentPrice.toFixed(2)} USD/ton</strong></p>
        <p>Precio proyectado: <strong class="${isUp ? 'up' : 'down'}">$${lastForecast.toFixed(2)} USD/ton</strong></p>
      `,
    },
    {
      heading: 'Pesos del Ensemble',
      content: `
        <table>
          <tr><th>Modelo</th><th>Peso</th><th>MAPE</th></tr>
          ${Object.entries(prediction.weights)
            .map(
              ([model, weight]: [string, any]) =>
                `<tr><td>${model.toUpperCase()}</td><td>${(weight * 100).toFixed(1)}%</td>
                <td>${prediction.metrics?.[model]?.mape?.toFixed(1) || '-'}%</td></tr>`
            )
            .join('')}
        </table>
      `,
    },
    {
      heading: 'Predicciones Detalladas',
      content: `
        <table>
          <tr><th>Fecha</th><th>Seco (USD/ton)</th><th>IC Inferior</th><th>IC Superior</th><th>Baba (USD/ton)</th></tr>
          ${tableRows}
        </table>
      `,
    },
  ]);
}
