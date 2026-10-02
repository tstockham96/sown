/**
 * Offline crowd estimate ("Today's players (est.)"): a deterministic pool of simulated players for the day.
 * The mix is a guess at a real audience: beginners who take any harvest they see, greedy players who take the
 * biggest scoop on offer, planners who look one scoop ahead, and a few deep planners (beam search).
 * A backend with real results would replace this.
 */
import { makeRng } from './rng';
import { sow, legalMoves, SCOOPS } from './rules';
import { playGreedy, playTwoPly, beam } from './solver';
import type { Puzzle } from './puzzle';
import { TIERS, tierIndex } from './share';

export interface Crowd { n: number; scores: number[]; tiers: number[]; mean: number }

function beginner(board: number[], rnd: () => number): number {
  let b = board, score = 0;
  for (let i = 0; i < SCOOPS; i++) {
    const ms = legalMoves(b); if (!ms.length) break;
    const good = ms.filter((m) => sow(b, m).points > 0);
    const pool = good.length && rnd() < 0.75 ? good : ms;
    const r = sow(b, pool[Math.floor(rnd() * pool.length)]); b = r.board; score += r.points;
  }
  return score;
}
const cache = new Map<number, Crowd>();
export function crowdFor(p: Puzzle): Crowd {
  const hit = cache.get(p.n); if (hit) return hit;
  const r = makeRng(p.n * 7919 + 17); const rnd = () => r.next();
  const scores: number[] = [];
  for (let i = 0; i < 90; i++) scores.push(beginner(p.board, rnd));
  for (let i = 0; i < 110; i++) scores.push(playGreedy(p.board, rnd).score);
  for (let i = 0; i < 60; i++) scores.push(playTwoPly(p.board, rnd).score);
  const b10 = beam(p.board, 10).score, b40 = beam(p.board, 40).score;
  for (let i = 0; i < 25; i++) scores.push(b10);
  for (let i = 0; i < 15; i++) scores.push(b40);
  const tiers = new Array(TIERS.length).fill(0);
  for (const s of scores) tiers[tierIndex(s, p.best)]++;
  const c = { n: scores.length, scores, tiers, mean: scores.reduce((a, b) => a + b, 0) / scores.length };
  cache.set(p.n, c);
  return c;
}
/** Share of the crowd you beat (ties count half), 0-100. */
export function percentile(c: Crowd, score: number): number {
  let below = 0, tie = 0;
  for (const s of c.scores) { if (s < score) below++; else if (s === score) tie++; }
  return Math.round(((below + tie / 2) / c.n) * 100);
}
