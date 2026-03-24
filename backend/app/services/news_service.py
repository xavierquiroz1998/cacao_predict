"""Servicio de noticias: obtiene noticias del cacao y analiza su sentimiento."""

import logging
import re
from datetime import datetime, timedelta
from html import unescape

import feedparser
import numpy as np

logger = logging.getLogger(__name__)

# Keywords para buscar noticias relevantes
SEARCH_QUERIES = [
    "cocoa price",
    "cocoa futures",
    "cacao market",
    "chocolate demand supply",
    "ICCO cocoa",
    "Ghana cocoa production",
    "Ivory Coast cocoa",
    "Ecuador cacao",
]

# Keywords en español
SEARCH_QUERIES_ES = [
    "precio cacao",
    "cacao Ecuador",
    "cacao mercado",
    "chocolate demanda",
]


def _clean_html(text: str) -> str:
    """Elimina tags HTML y decodifica entidades."""
    text = unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _analyze_sentiment_vader(text: str) -> dict:
    """Analiza el sentimiento usando VADER (ligero, basado en reglas).

    Aumentado con léxico financiero básico para mejorar precisión en noticias de commodities.
    """
    try:
        from nltk.sentiment.vader import SentimentIntensityAnalyzer
        import nltk

        try:
            nltk.data.find("sentiment/vader_lexicon.zip")
        except LookupError:
            nltk.download("vader_lexicon", quiet=True)

        sid = SentimentIntensityAnalyzer()

        # Agregar léxico financiero
        financial_lexicon = {
            "surge": 2.5,
            "surged": 2.5,
            "rally": 2.0,
            "rallied": 2.0,
            "soar": 2.5,
            "soared": 2.5,
            "jump": 1.5,
            "jumped": 1.5,
            "gain": 1.5,
            "gains": 1.5,
            "bull": 1.5,
            "bullish": 2.0,
            "boom": 2.0,
            "record high": 3.0,
            "upbeat": 1.5,
            "optimistic": 1.5,
            "recovery": 1.5,
            "shortage": 1.0,  # shortage = precios suben
            "deficit": 1.0,
            "plunge": -2.5,
            "plunged": -2.5,
            "crash": -3.0,
            "crashed": -3.0,
            "slump": -2.0,
            "slumped": -2.0,
            "drop": -1.5,
            "dropped": -1.5,
            "decline": -1.5,
            "declined": -1.5,
            "fall": -1.5,
            "fell": -1.5,
            "bear": -1.5,
            "bearish": -2.0,
            "downturn": -2.0,
            "record low": -3.0,
            "surplus": -1.0,  # surplus = precios bajan
            "oversupply": -1.5,
            "weak": -1.5,
            "weakened": -1.5,
        }
        sid.lexicon.update(financial_lexicon)

        scores = sid.polarity_scores(text)

        compound = scores["compound"]
        if compound >= 0.15:
            label = "positivo"
            impact = "alcista"
        elif compound <= -0.15:
            label = "negativo"
            impact = "bajista"
        else:
            label = "neutro"
            impact = "neutral"

        return {
            "score": round(compound, 3),
            "label": label,
            "impact": impact,
            "confidence": round(abs(compound), 2),
        }
    except ImportError:
        return _analyze_sentiment_basic(text)


def _analyze_sentiment_basic(text: str) -> dict:
    """Análisis de sentimiento básico por keywords (sin dependencias extra)."""
    text_lower = text.lower()

    positive_words = [
        "surge", "surged", "rally", "rallied", "soar", "soared", "jump",
        "jumped", "gain", "gains", "rise", "rises", "rising", "higher",
        "high", "record", "boom", "bullish", "optimistic", "shortage",
        "deficit", "strong", "demand", "sube", "subió", "alza", "récord",
    ]
    negative_words = [
        "plunge", "plunged", "crash", "crashed", "slump", "slumped",
        "drop", "dropped", "decline", "declined", "fall", "fell", "lower",
        "low", "weak", "bearish", "surplus", "oversupply", "downturn",
        "baja", "bajó", "caída", "desplome",
    ]

    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)

    total = pos_count + neg_count
    if total == 0:
        return {"score": 0.0, "label": "neutro", "impact": "neutral", "confidence": 0.0}

    score = (pos_count - neg_count) / total
    if score > 0.2:
        label, impact = "positivo", "alcista"
    elif score < -0.2:
        label, impact = "negativo", "bajista"
    else:
        label, impact = "neutro", "neutral"

    return {
        "score": round(score, 3),
        "label": label,
        "impact": impact,
        "confidence": round(abs(score), 2),
    }


def fetch_news(max_articles: int = 20, lang: str = "en") -> list[dict]:
    """Obtiene noticias del cacao desde Google News RSS.

    Args:
        max_articles: Número máximo de artículos a retornar.
        lang: Idioma ("en" para inglés, "es" para español).

    Returns:
        Lista de noticias con título, descripción, fuente, fecha y sentimiento.
    """
    queries = SEARCH_QUERIES if lang == "en" else SEARCH_QUERIES_ES
    hl = "en-US" if lang == "en" else "es-419"
    gl = "US" if lang == "en" else "EC"
    ceid = f"{gl}:{lang}"

    all_articles = []
    seen_titles = set()

    for query in queries:
        try:
            url = (
                f"https://news.google.com/rss/search?"
                f"q={query.replace(' ', '+')}&hl={hl}&gl={gl}&ceid={ceid}"
            )
            feed = feedparser.parse(url)

            for entry in feed.entries[:5]:
                title = _clean_html(entry.get("title", ""))

                # Deduplicar por título similar
                title_key = title.lower()[:60]
                if title_key in seen_titles:
                    continue
                seen_titles.add(title_key)

                description = _clean_html(entry.get("summary", entry.get("description", "")))
                published = entry.get("published", "")
                source = entry.get("source", {}).get("title", "")
                link = entry.get("link", "")

                # Parsear fecha
                try:
                    pub_date = datetime(*entry.published_parsed[:6]) if entry.get("published_parsed") else None
                except Exception:
                    pub_date = None

                # Analizar sentimiento del título + descripción
                full_text = f"{title}. {description}"
                sentiment = _analyze_sentiment_vader(full_text)

                all_articles.append({
                    "title": title,
                    "description": description[:300] if description else "",
                    "source": source,
                    "url": link,
                    "published": pub_date.isoformat() if pub_date else published,
                    "published_relative": _relative_time(pub_date) if pub_date else "",
                    "sentiment": sentiment,
                })
        except Exception as e:
            logger.warning(f"Error obteniendo noticias para '{query}': {e}")
            continue

    # Ordenar por fecha (más recientes primero)
    all_articles.sort(
        key=lambda x: x.get("published", ""),
        reverse=True,
    )

    return all_articles[:max_articles]


def _relative_time(dt: datetime) -> str:
    """Convierte una fecha a tiempo relativo (ej: 'hace 2 horas')."""
    if dt is None:
        return ""
    now = datetime.utcnow()
    diff = now - dt

    if diff.days > 30:
        return f"hace {diff.days // 30} meses"
    elif diff.days > 0:
        return f"hace {diff.days} dias"
    elif diff.seconds > 3600:
        return f"hace {diff.seconds // 3600} horas"
    elif diff.seconds > 60:
        return f"hace {diff.seconds // 60} minutos"
    else:
        return "hace un momento"


def get_sentiment_summary(articles: list[dict]) -> dict:
    """Genera un resumen del sentimiento general de las noticias.

    Returns:
        Dict con sentimiento promedio, distribución y señal para el precio.
    """
    if not articles:
        return {
            "overall_score": 0,
            "overall_label": "Sin datos",
            "signal": "neutral",
            "distribution": {"positivo": 0, "neutro": 0, "negativo": 0},
            "total_articles": 0,
            "summary": "No se encontraron noticias recientes sobre el cacao.",
        }

    scores = [a["sentiment"]["score"] for a in articles]
    labels = [a["sentiment"]["label"] for a in articles]

    avg_score = float(np.mean(scores))
    distribution = {
        "positivo": labels.count("positivo"),
        "neutro": labels.count("neutro"),
        "negativo": labels.count("negativo"),
    }

    if avg_score >= 0.15:
        overall_label = "Positivo"
        signal = "alcista"
        emoji = "subir"
    elif avg_score <= -0.15:
        overall_label = "Negativo"
        signal = "bajista"
        emoji = "bajar"
    else:
        overall_label = "Neutro"
        signal = "neutral"
        emoji = "mantenerse estable"

    total = len(articles)
    pos_pct = round(distribution["positivo"] / total * 100)
    neg_pct = round(distribution["negativo"] / total * 100)

    summary = (
        f"De {total} noticias analizadas, {pos_pct}% son positivas y {neg_pct}% negativas. "
        f"El sentimiento general es {overall_label.lower()}, "
        f"lo que sugiere que el precio podria {emoji} en el corto plazo."
    )

    return {
        "overall_score": round(avg_score, 3),
        "overall_label": overall_label,
        "signal": signal,
        "distribution": distribution,
        "total_articles": total,
        "summary": summary,
    }
