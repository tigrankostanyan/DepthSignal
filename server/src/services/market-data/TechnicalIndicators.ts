//  bollinger bands result
export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  widthPercent: number;
}

//  m a c d result
export interface MACDResult {
  value: number;
  signal: number;
  histogram: number;
}

//  candle like
export interface CandleLike {
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Calculate s m a
export function calculateSMA(closes: number[], period: number): number | undefined {
  if (!closes || closes.length < period || period <= 0) return undefined;
  const slice = closes.slice(-period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return +(sum / period).toFixed(4);
}

// Calculate e m a
export function calculateEMA(closes: number[], period: number): number | undefined {
  if (!closes || closes.length < period || period <= 0) return undefined;
  const k = 2 / (period + 1);
  // Initial SMA as seed
  let ema = closes.slice(0, period).reduce((acc, v) => acc + v, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return +ema.toFixed(4);
}

// Calculate r s i
export function calculateRSI(closes: number[], period = 14): number | undefined {
  if (!closes || closes.length < period + 1) return undefined;

  let gains = 0;
  let losses = 0;

  // First period average gain & loss
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smoothed averages for subsequent prices
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return +rsi.toFixed(1);
}

// Calculate a t r
export function calculateATR(candles: CandleLike[], period = 14): number | undefined {
  if (!candles || candles.length < period + 1) return undefined;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return undefined;

  // Initial average true range
  let atr = trueRanges.slice(0, period).reduce((acc, v) => acc + v, 0) / period;

  // Wilder's smoothing for subsequent true ranges
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return +atr.toFixed(4);
}

// Calculate bollinger bands
export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2): BollingerBandsResult | undefined {
  if (!closes || closes.length < period) return undefined;

  const slice = closes.slice(-period);
  const sma = slice.reduce((acc, v) => acc + v, 0) / period;

  const variance = slice.reduce((acc, v) => acc + Math.pow(v - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = +(sma + multiplier * stdDev).toFixed(4);
  const lower = +(sma - multiplier * stdDev).toFixed(4);
  const middle = +sma.toFixed(4);
  const widthPercent = middle > 0 ? +(((upper - lower) / middle) * 100).toFixed(2) : 0;

  return { upper, middle, lower, widthPercent };
}

// Calculate m a c d
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult | undefined {
  if (!closes || closes.length < slowPeriod + signalPeriod) return undefined;

  const macdLine: number[] = [];
  const kFast = 2 / (fastPeriod + 1);
  const kSlow = 2 / (slowPeriod + 1);

  // Compute EMAs across window
  let emaFast = closes.slice(0, fastPeriod).reduce((acc, v) => acc + v, 0) / fastPeriod;
  let emaSlow = closes.slice(0, slowPeriod).reduce((acc, v) => acc + v, 0) / slowPeriod;

  // Advance fast EMA up to slowPeriod start
  for (let i = fastPeriod; i < slowPeriod; i++) {
    emaFast = closes[i] * kFast + emaFast * (1 - kFast);
  }

  macdLine.push(emaFast - emaSlow);

  for (let i = slowPeriod; i < closes.length; i++) {
    emaFast = closes[i] * kFast + emaFast * (1 - kFast);
    emaSlow = closes[i] * kSlow + emaSlow * (1 - kSlow);
    macdLine.push(emaFast - emaSlow);
  }

  if (macdLine.length < signalPeriod) return undefined;

  // Compute Signal line (EMA of MACD line)
  const kSignal = 2 / (signalPeriod + 1);
  let signal = macdLine.slice(0, signalPeriod).reduce((acc, v) => acc + v, 0) / signalPeriod;
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = macdLine[i] * kSignal + signal * (1 - kSignal);
  }

  const latestMacd = macdLine[macdLine.length - 1];
  const histogram = latestMacd - signal;

  return {
    value: +latestMacd.toFixed(4),
    signal: +signal.toFixed(4),
    histogram: +histogram.toFixed(4)
  };
}
