// Computes the percentage of unused CSS selectors out of all selectors
// defined (unused / total * 100), with total === 0 treated as 0% rather
// than a NaN from 0 / 0.
//
// This is deliberately the ONLY place that percentage is computed.
// src/cli.ts's --threshold gate and src/report/text.ts's summary display
// both call it instead of each recomputing it inline. The original
// --threshold bug was exactly this class of drift: the ratio was computed
// over the wrong denominator (discovered files, not selectors defined) in
// one place, with nothing to catch it because nothing else needed to
// agree with it. A single shared function means a future edit to the
// formula can't silently apply to only one caller.
export function unusedRatio(unused: number, total: number): number {
  return total > 0 ? (unused / total) * 100 : 0
}
