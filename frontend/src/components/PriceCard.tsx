'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceCardProps {
  title: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  type: 'seco' | 'baba';
}

export default function PriceCard({ title, price, change, changePct, currency, type }: PriceCardProps) {
  const isUp = change >= 0;
  const bgGradient = type === 'seco'
    ? 'from-cacao-900/50 to-cacao-800/30'
    : 'from-amber-900/50 to-amber-800/30';
  const borderColor = type === 'seco' ? 'border-cacao-700' : 'border-amber-700';

  return (
    <div className={`bg-gradient-to-br ${bgGradient} rounded-xl border ${borderColor} p-6 shadow-lg`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">{title}</h3>
        <span className="text-white/60 text-xs">
          {currency}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className="text-3xl font-bold text-white">
          ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isUp ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
        <span className={isUp ? 'badge-up' : 'badge-down'}>
          {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
