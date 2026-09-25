/**
 * Qayyim statistics — the swarm's arithmetic.
 *
 * Why this file exists: the models behind the swarm are free-tier and bad at
 * maths. Left alone they will state a confident p-value they invented, call a
 * 3-visitor experiment "decisive", or extrapolate next month's revenue from two
 * orders. Every number the owner is shown now comes from here, and the model is
 * only allowed to explain it.
 *
 * Pure functions only: no database, no network, no npm dependency. A wrong
 * number is a failing unit test, never a wrong page.
 */

const MIN_POINTS_FOR_STD = 2;

function finite(xs: number[]): number[] {
  return xs.filter((v) => typeof v === "number" && Number.isFinite(v));
}

export function mean(xs: number[]): number | null {
  const v = finite(xs);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Standard deviation. A window that IS the whole observation (daily counts for
 * the last 30 days) is a population, so ddof stays 0 unless asked otherwise. */
export function std(xs: number[], sample = false): number | null {
  const v = finite(xs);
  if (v.length < MIN_POINTS_FOR_STD) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const divisor = sample ? v.length - 1 : v.length;
  const variance = v.reduce((acc, x) => acc + (x - m) * (x - m), 0) / divisor;
  return Math.sqrt(variance);
}

/** How far one value sits from its own series, in sigmas. Null when the series
 * cannot be spread (one point, or every point identical). */
export function zScore(value: number, xs: number[]): number | null {
  const s = std(xs);
  if (s === null || s === 0 || !Number.isFinite(value)) return null;
  const m = mean(xs);
  if (m === null) return null;
  return (value - m) / s;
}

/** Abramowitz & Stegun 7.1.26 — |error| < 1.5e-7, plenty for a p-value. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Inverse standard normal by bisection — no magic coefficients to mistrust, and
 * it is only ever called twice per sample-size computation. */
export function normalQuantile(probability: number): number {
  if (!(probability > 0 && probability < 1)) return NaN;
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < probability) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type ProportionVerdict = "measured" | "no-data" | "no-conversions" | "invalid";

export interface ProportionTest {
  verdict: ProportionVerdict;
  controlRate: number;
  treatmentRate: number;
  z: number | null;
  /** Two-tailed probability that the difference is noise. */
  p: number | null;
  significant: boolean;
  /** null = the data cannot say who won. */
  treatmentWins: boolean | null;
}

function counts(n: number, x: number): boolean {
  return Number.isFinite(n) && Number.isFinite(x) && n >= 0 && x >= 0 && x <= n;
}

/**
 * Two-proportion z-test (pooled), the standard read for an A/B test where the
 * metric is a rate: conversion per visitor, click per impression.
 *
 * The normal approximation is not trustworthy on a handful of visitors, so an
 * arm with fewer than `minPerArm` impressions is reported as no-data rather than
 * as a tie — a small shop's traffic must not be given a verdict it cannot carry.
 */
export function twoProportionZTest(
  nControl: number,
  xControl: number,
  nTreatment: number,
  xTreatment: number,
  opts: { minPerArm?: number } = {},
): ProportionTest {
  const { minPerArm = 30 } = opts;
  const invalid = !counts(nControl, xControl) || !counts(nTreatment, xTreatment);
  if (invalid) {
    return { verdict: "invalid", controlRate: 0, treatmentRate: 0, z: null, p: null, significant: false, treatmentWins: null };
  }

  const controlRate = nControl > 0 ? xControl / nControl : 0;
  const treatmentRate = nTreatment > 0 ? xTreatment / nTreatment : 0;
  const base = { controlRate, treatmentRate, significant: false, treatmentWins: null } as const;

  if (nControl < minPerArm || nTreatment < minPerArm) {
    return { ...base, verdict: "no-data", z: null, p: null };
  }
  if (xControl <= 0 && xTreatment <= 0) {
    return { ...base, verdict: "no-conversions", z: null, p: null };
  }

  const pooled = (xControl + xTreatment) / (nControl + nTreatment);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nControl + 1 / nTreatment));
  if (se === 0) {
    return { ...base, verdict: "no-conversions", z: null, p: null };
  }

  const z = (treatmentRate - controlRate) / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const significant = p < 0.05;
  return {
    verdict: "measured",
    controlRate,
    treatmentRate,
    z,
    p,
    significant,
    treatmentWins: significant ? treatmentRate > controlRate : null,
  };
}

/**
 * Visitors per arm needed before a change can be *seen* at all, so " inconclusive"
 * can be answered with a number instead of a shrug. Normal approximation, equal
 * arms — the usual textbook sample-size formula for two proportions.
 */
export function requiredVisitorsPerArm(opts: {
  baselineRate: number;
  relativeLift: number;
  alpha?: number;
  power?: number;
}): number | null {
  const { baselineRate, relativeLift, alpha = 0.05, power = 0.8 } = opts;
  if (!Number.isFinite(baselineRate) || baselineRate <= 0 || baselineRate >= 1) return null;
  if (!Number.isFinite(relativeLift) || relativeLift === 0) return null;

  const p1 = baselineRate;
  const p2 = baselineRate * (1 + relativeLift);
  if (p2 <= 0 || p2 >= 1) return null;

  const diff = Math.abs(p2 - p1);
  if (diff === 0) return null;

  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const n = ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (diff * diff);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.ceil(n);
}

export interface Anomaly {
  index: number;
  value: number;
  z: number;
}

/**
 * Anything in the series sitting more than k sigmas from its own mean. Below
 * `minPoints` the window is too small to call anything strange — a shop with
 * four days of history should never be told it has an anomaly.
 */
export function detectAnomalies(series: number[], opts: { k?: number; minPoints?: number } = {}): Anomaly[] {
  const { k = 3, minPoints = 8 } = opts;
  const values = finite(series);
  if (values.length < minPoints) return [];
  const m = mean(values);
  const s = std(values);
  if (m === null || s === null || s === 0) return [];
  const hits: Anomaly[] = [];
  values.forEach((value, index) => {
    const z = (value - m) / s;
    if (Math.abs(z) > k) hits.push({ index, value, z });
  });
  return hits;
}

export type ForecastMethod = "holt-winters" | "double-exponential" | "insufficient-data";

export interface Forecast {
  method: ForecastMethod;
  forecast: number[];
  /** Mean absolute percentage error of one-step-ahead fits on the history
   * (in-sample, so it flatters the model a little). Null when it cannot be
   * computed — fewer than two fitted points, or a series of zeros. */
  mape: number | null;
  /** Season length actually used; 1 for the non-seasonal fallback. */
  seasonLength: number;
}

/** Least-squares line over the index — the seasonal decomposition's starting point. */
function linearFit(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

/** Mean absolute percentage error, skipping zero actuals (where the percentage
 * has no meaning). Null when fewer than two comparable points. */
export function meanAbsolutePercentageError(actual: number[], fitted: number[]): number | null {
  const terms: number[] = [];
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const f = fitted[i];
    if (!Number.isFinite(a) || !Number.isFinite(f) || a === 0) continue;
    terms.push(Math.abs((a - f) / a));
  }
  if (terms.length < 2) return null;
  return (terms.reduce((x, y) => x + y, 0) / terms.length) * 100;
}

/** Holt's linear (double exponential) method — trend, no seasonality. */
function doubleExponential(values: number[], alpha: number, beta: number, horizon: number) {
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  const fitted: number[] = [level];
  for (let i = 1; i < values.length; i++) {
    const step = level + trend;
    fitted.push(step);
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * step;
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast = Array.from({ length: horizon }, (_, h) => level + trend * (h + 1));
  return { fitted, forecast };
}

/**
 * Additive Holt-Winters: level + trend + a repeating seasonal shape.
 *
 * Needs at least two full seasons or the "seasonal shape" is just noise, so
 * below `2 * seasonLength` points it falls back to Holt's linear method and says
 * so in `method`. The seasonal indices start from a detrended least-squares fit,
 * which keeps a purely trending series (a shop growing, not cycling) from having
 * its trend mistaken for a weekly pattern.
 */
export function holtWinters(
  series: number[],
  opts: { alpha?: number; beta?: number; gamma?: number; seasonLength?: number; horizon?: number } = {},
): Forecast {
  const { alpha = 0.3, beta = 0.05, gamma = 0.3, horizon = 7 } = opts;
  const seasonLength = opts.seasonLength ?? 7;
  const values = finite(series);

  // Never project further ahead than there is history behind you. A three-point
  // series asked for a month is not a forecast, it is one slope compounded thirty
  // times — the arithmetic that once handed the owner a 4.2M ج.م month built from
  // two orders. The caller can still say "I have more days than that", here it
  // stays honest.
  if (values.length < 2 || horizon <= 0 || values.length < horizon) {
    return { method: "insufficient-data", forecast: [], mape: null, seasonLength: Math.max(1, seasonLength) };
  }
  if (seasonLength < 2 || values.length < 2 * seasonLength) {
    const { fitted, forecast } = doubleExponential(values, alpha, beta, horizon);
    return {
      method: "double-exponential",
      forecast,
      mape: meanAbsolutePercentageError(values, fitted),
      seasonLength: 1,
    };
  }

  const m = Math.floor(seasonLength);
  const { slope, intercept } = linearFit(values);
  const seasonal = new Array(m).fill(0);
  const residualCounts = new Array(m).fill(0);
  for (let t = 0; t < values.length; t++) {
    const position = t % m;
    seasonal[position] += values[t] - (intercept + slope * t);
    residualCounts[position]++;
  }
  for (let i = 0; i < m; i++) {
    seasonal[i] = residualCounts[i] > 0 ? seasonal[i] / residualCounts[i] : 0;
  }
  // A seasonal shape is a deviation, not a level: it must sum to zero.
  const centre = seasonal.reduce((a, b) => a + b, 0) / m;
  for (let i = 0; i < m; i++) seasonal[i] -= centre;

  let level = values[0] - seasonal[0];
  let trend = slope;
  const fitted: number[] = [];

  for (let t = 0; t < values.length; t++) {
    const position = t % m;
    const step = level + trend + seasonal[position];
    fitted.push(step);
    const observed = values[t];
    const prevLevel = level;
    level = alpha * (observed - seasonal[position]) + (1 - alpha) * step;
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[position] = gamma * (observed - level) + (1 - gamma) * seasonal[position];
  }

  const forecast = Array.from({ length: horizon }, (_, h) => {
    const position = (values.length + h) % m;
    return level + trend * (h + 1) + seasonal[position];
  });

  return {
    method: "holt-winters",
    forecast,
    mape: meanAbsolutePercentageError(values, fitted),
    seasonLength: m,
  };
}
