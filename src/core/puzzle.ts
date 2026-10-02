import { makeRng, hashStr } from './rng';
import { CELLS, SCOOPS, Move, decodeLine } from './rules';
import { beam } from './solver';
import PAR from './par.json';

/** Bump when the generator changes so saved progress from an older generator is discarded. */
export const GEN = 1;
export interface Puzzle {
  n: number;
  board: number[];
  scoops: number;
  /** Best harvest our solver found (beam search, width 1000). Humans can beat it. */
  best: number;
  bestLine: Move[];
}
type ParEntry = { a: number; b: number; l: string; g: number };
const TABLE = PAR as unknown as Record<string, ParEntry>;

/** Seeds per pot: 12% empty, 25% one, 29% two, 34% three. Never 4 (that would already be harvested). */
export function genBoard(n: number, attempt = 0): number[] {
  const r = makeRng(hashStr(`sown:${n}:${attempt}`));
  const b: number[] = [];
  for (let i = 0; i < CELLS; i++) { const x = r.next(); b.push(x < 0.12 ? 0 : x < 0.37 ? 1 : x < 0.66 ? 2 : 3); }
  return b;
}
const cache = new Map<number, Puzzle>();
export function puzzleFor(n: number): Puzzle {
  const hit = cache.get(n);
  if (hit) return hit;
  const e = TABLE[n];
  let p: Puzzle;
  if (e) p = { n, board: genBoard(n, e.a), scoops: SCOOPS, best: e.b, bestLine: decodeLine(e.l) };
  else {
    // Beyond the precomputed table: attempt 0, and a smaller live search for the best-known line.
    const board = genBoard(n, 0);
    const bl = beam(board, 250);
    p = { n, board, scoops: SCOOPS, best: bl.score, bestLine: bl.moves };
  }
  cache.set(n, p);
  return p;
}
export const tableSize = () => Object.keys(TABLE).length;
