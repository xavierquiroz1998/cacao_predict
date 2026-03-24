'use client';

interface ModelMetricsProps {
  weights: Record<string, number>;
  metrics: Record<string, Record<string, number>>;
}

export default function ModelMetrics({ weights, metrics }: ModelMetricsProps) {
  const modelNames: Record<string, string> = {
    sarima: 'SARIMA',
    xgboost: 'XGBoost',
    lstm: 'LSTM',
  };

  const modelColors: Record<string, string> = {
    sarima: 'bg-blue-500',
    xgboost: 'bg-emerald-500',
    lstm: 'bg-purple-500',
  };

  return (
    <div className="space-y-4">
      {/* Pesos del ensemble */}
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-3">Pesos del Ensemble</h4>
        <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-slate-700">
          {Object.entries(weights).map(([model, weight]) => (
            <div
              key={model}
              className={`${modelColors[model]} transition-all duration-500`}
              style={{ width: `${weight * 100}%` }}
              title={`${modelNames[model]}: ${(weight * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          {Object.entries(weights).map(([model, weight]) => (
            <span key={model} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${modelColors[model]}`} />
              {modelNames[model]}: {(weight * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      </div>

      {/* Métricas por modelo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(metrics).map(([model, m]) => (
          <div key={model} className="bg-slate-700/50 rounded-lg p-3">
            <h5 className="text-sm font-medium text-slate-300 mb-2">
              {modelNames[model] || model}
            </h5>
            {'error' in m ? (
              <p className="text-xs text-red-400">{m.error}</p>
            ) : (
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>RMSE:</span>
                  <span className="text-slate-300">{m.rmse?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>MAE:</span>
                  <span className="text-slate-300">{m.mae?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>MAPE:</span>
                  <span className="text-slate-300">{m.mape?.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
