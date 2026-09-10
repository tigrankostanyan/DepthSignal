// ============================================================
// FORMATTING UTILITIES
// Shared by all views so number/price/time formatting stays
// consistent across the terminal.
// ============================================================

/** Price display: >= 1 uses 2 decimals with grouping, < 1 stays raw (e.g. 0.00001234). */
export function formatPrice(value: number): string {
  return value >= 1
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
}

/** Always 2 decimals with grouping (no `$` prefix). */
export function formatPriceMin(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

/** 2-decimal USD price with `$` prefix. */
export function formatUsd(value: number): string {
  return `$${formatPriceMin(value)}`;
}

/** USD price with `$` prefix that preserves precision for values < 1 (e.g. $0.00001234). */
export function formatUsdPrice(value: number): string {
  return `$${formatPrice(value)}`;
}

/**
 * Compact USD magnitude: 1.2B / 340.5M / 45.0k / 123.
 * digits controls decimals of the scaled unit.
 */
export function formatCompact(value: number, digits = 1): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(digits)}k`;
  return value.toLocaleString();
}

/** Compact USD magnitude with `$` prefix, e.g. "$1.2M". */
export function formatUsdCompact(value: number, digits = 1): string {
  return `$${formatCompact(value, digits)}`;
}

/** Volume display: >= 1B -> "1.25B", >= 1M -> "340.50M", otherwise locale number. */
export function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString();
}

/** Percentage with optional `+` sign for non-negative values. */
export function formatPercent(value: number, digits = 2, signed = false): string {
  return `${signed && value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

/** Signed percentage: +1.25% / -0.50%. */
export function formatSignedPercent(value: number, digits = 2): string {
  return formatPercent(value, digits, true);
}

/** Fixed-decimal amount (order book size, base volume). */
export function formatAmount(value: number, digits = 3): string {
  return value.toFixed(digits);
}

/** Locale timestamp string (accepts number or ISO string). */
export function formatTime(timestamp: number | string): string {
  return new Date(timestamp).toLocaleString();
}

/** 24h high/low compact: >= 1000 -> "12.5k", otherwise raw. */
export function formatCompactPrice(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
