'use client';

import { useState } from 'react';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  BarChart3,
  RefreshCw,
  Loader2,
  Globe,
} from 'lucide-react';

interface SentimentData {
  score: number;
  label: string;
  impact: string;
  confidence: number;
}

interface Article {
  title: string;
  description: string;
  source: string;
  url: string;
  published: string;
  published_relative: string;
  sentiment: SentimentData;
}

interface SentimentSummary {
  overall_score: number;
  overall_label: string;
  signal: string;
  distribution: {
    positivo: number;
    neutro: number;
    negativo: number;
  };
  total_articles: number;
  summary: string;
}

interface NewsPanelProps {
  articles: Article[];
  sentimentSummary: SentimentSummary;
  onRefresh: () => void;
  loading: boolean;
}

const sentimentConfig = {
  positivo: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/30',
    border: 'border-emerald-800',
    icon: TrendingUp,
    label: 'Alcista',
  },
  negativo: {
    color: 'text-red-400',
    bg: 'bg-red-900/30',
    border: 'border-red-800',
    icon: TrendingDown,
    label: 'Bajista',
  },
  neutro: {
    color: 'text-slate-400',
    bg: 'bg-slate-800/50',
    border: 'border-slate-700',
    icon: Minus,
    label: 'Neutral',
  },
};

function SentimentBadge({ sentiment }: { sentiment: SentimentData }) {
  const config = sentimentConfig[sentiment.label as keyof typeof sentimentConfig] || sentimentConfig.neutro;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} border ${config.border}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function SentimentBar({ distribution, total }: { distribution: SentimentSummary['distribution']; total: number }) {
  if (total === 0) return null;
  const posPct = (distribution.positivo / total) * 100;
  const neuPct = (distribution.neutro / total) * 100;
  const negPct = (distribution.negativo / total) * 100;

  return (
    <div className="w-full">
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-800">
        {posPct > 0 && (
          <div className="bg-emerald-500 transition-all" style={{ width: `${posPct}%` }} />
        )}
        {neuPct > 0 && (
          <div className="bg-slate-500 transition-all" style={{ width: `${neuPct}%` }} />
        )}
        {negPct > 0 && (
          <div className="bg-red-500 transition-all" style={{ width: `${negPct}%` }} />
        )}
      </div>
      <div className="flex justify-between mt-1 text-xs text-slate-500">
        <span className="text-emerald-500">{distribution.positivo} positivas</span>
        <span>{distribution.neutro} neutras</span>
        <span className="text-red-500">{distribution.negativo} negativas</span>
      </div>
    </div>
  );
}

export default function NewsPanel({ articles, sentimentSummary, onRefresh, loading }: NewsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const displayArticles = showAll ? articles : articles.slice(0, 6);

  const overallConfig = sentimentSummary.signal === 'alcista'
    ? sentimentConfig.positivo
    : sentimentSummary.signal === 'bajista'
    ? sentimentConfig.negativo
    : sentimentConfig.neutro;
  const OverallIcon = overallConfig.icon;

  return (
    <div className="space-y-4">
      {/* Resumen de sentimiento */}
      <div className={`rounded-xl border p-5 ${overallConfig.bg} ${overallConfig.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${overallConfig.bg} flex items-center justify-center`}>
              <OverallIcon className={`w-5 h-5 ${overallConfig.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Sentimiento: {sentimentSummary.overall_label}
              </h3>
              <p className="text-xs text-slate-400">
                Basado en {sentimentSummary.total_articles} noticias recientes
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Actualizar
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-3">{sentimentSummary.summary}</p>

        <SentimentBar
          distribution={sentimentSummary.distribution}
          total={sentimentSummary.total_articles}
        />

        {/* Score */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50">
          <div>
            <span className="text-xs text-slate-500">Score</span>
            <p className={`text-lg font-bold ${overallConfig.color}`}>
              {sentimentSummary.overall_score > 0 ? '+' : ''}
              {sentimentSummary.overall_score.toFixed(3)}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Senal para el precio</span>
            <p className={`text-sm font-semibold ${overallConfig.color}`}>
              {sentimentSummary.signal === 'alcista'
                ? 'Presion al alza'
                : sentimentSummary.signal === 'bajista'
                ? 'Presion a la baja'
                : 'Sin presion clara'}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de noticias */}
      <div className="space-y-2">
        {displayArticles.map((article, i) => (
          <div
            key={i}
            className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SentimentBadge sentiment={article.sentiment} />
                  <span className="text-xs text-slate-600">{article.published_relative}</span>
                </div>
                <h4 className="text-sm font-medium text-white leading-snug mb-1">
                  {article.title}
                </h4>
                {article.description && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {article.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {article.source && (
                    <span className="text-xs text-slate-600">{article.source}</span>
                  )}
                </div>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-cacao-400 transition-colors flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {articles.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center text-sm text-cacao-400 hover:text-cacao-300 py-2"
        >
          {showAll ? 'Mostrar menos' : `Ver todas (${articles.length} noticias)`}
        </button>
      )}
    </div>
  );
}
