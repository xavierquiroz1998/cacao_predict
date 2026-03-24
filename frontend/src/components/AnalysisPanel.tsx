'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Factor {
  factor: string;
  value: number;
  impact: string;
  description: string;
}

interface AnalysisData {
  current_price_seco: number;
  price_change: number;
  price_change_pct: number;
  direction: string;
  period: string;
  factors: Factor[];
  summary: string;
}

interface AnalysisPanelProps {
  analysis: AnalysisData;
}

export default function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positivo':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'negativo':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'positivo':
        return 'badge-up';
      case 'negativo':
        return 'badge-down';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="bg-slate-700/50 rounded-lg p-4">
        <p className="text-slate-300 text-sm leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Factores */}
      <div className="space-y-3">
        {analysis.factors.map((factor, idx) => (
          <div
            key={idx}
            className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getImpactIcon(factor.impact)}
                <span className="font-medium text-slate-200">{factor.factor}</span>
              </div>
              <span className={getImpactBadge(factor.impact)}>
                {factor.impact === 'positivo' ? 'Alcista' : factor.impact === 'negativo' ? 'Bajista' : 'Neutral'}
              </span>
            </div>
            <p className="text-sm text-slate-400">{factor.description}</p>
            <div className="mt-2 text-xs text-slate-500">
              Valor: {factor.value}
            </div>
          </div>
        ))}
      </div>

      {analysis.factors.length === 0 && (
        <div className="text-center text-slate-500 py-8">
          No se identificaron factores significativos en este periodo.
        </div>
      )}
    </div>
  );
}
