export interface PriceUnit {
  id: string;
  label: string;
  shortLabel: string;
  divisor: number; // Factor para convertir desde USD/tonelada
  suffix: string;
}

export const PRICE_UNITS: PriceUnit[] = [
  { id: 'ton', label: 'Tonelada', shortLabel: 'ton', divisor: 1, suffix: 'USD/ton' },
  { id: 'qq', label: 'Quintal (46kg)', shortLabel: 'qq', divisor: 1000 / 46, suffix: 'USD/qq' },
  { id: 'arroba', label: 'Arroba (12.5kg)', shortLabel: '@', divisor: 1000 / 12.5, suffix: 'USD/@' },
  { id: 'kg', label: 'Kilogramo', shortLabel: 'kg', divisor: 1000, suffix: 'USD/kg' },
  { id: 'lb', label: 'Libra (0.4536kg)', shortLabel: 'lb', divisor: 1000 / 0.4536, suffix: 'USD/lb' },
];

export function convertPrice(pricePerTon: number, unit: PriceUnit): number {
  return pricePerTon / unit.divisor;
}

export function getUnit(id: string): PriceUnit {
  return PRICE_UNITS.find((u) => u.id === id) || PRICE_UNITS[0];
}
