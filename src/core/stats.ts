import { tierIndex, TIERS } from './share';
export interface DayResult { score: number; best: number; row: number[]; moves?: number[]; secs: number; at: number }
export interface Stats {
  played: number;
  streak: number;
  maxStreak: number;
  bestPct: number; // best score as % of that day's best-known
  avgPct: number;
  bumper: number; // days you matched or beat the solver
  dist: number[]; // per tier
}
/** Streak = consecutive puzzle numbers played, ending today (or yesterday if today isn't played yet). */
export function computeStats(results: Record<string, DayResult>, today: number): Stats {
  const nums = Object.keys(results).map(Number).sort((a, b) => a - b);
  const dist = new Array(TIERS.length).fill(0);
  let maxStreak = 0, run = 0, prev = -10, sumPct = 0, bestPct = 0, bumper = 0;
  for (const n of nums) {
    const r = results[n];
    const pct = r.best ? (r.score / r.best) * 100 : 100;
    sumPct += pct;
    bestPct = Math.max(bestPct, pct);
    const t = tierIndex(r.score, r.best);
    dist[t]++;
    if (t === TIERS.length - 1) bumper++;
    run = n === prev + 1 ? run + 1 : 1;
    prev = n;
    maxStreak = Math.max(maxStreak, run);
  }
  let streak = 0;
  let k = results[today] ? today : today - 1;
  while (results[k]) { streak++; k--; }
  return { played: nums.length, streak, maxStreak, bestPct: Math.round(bestPct), avgPct: nums.length ? Math.round(sumPct / nums.length) : 0, bumper, dist };
}
