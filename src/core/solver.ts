/** Bots: random, greedy (best immediate points), two-ply, and beam search. Used for par, the crowd estimate and the depth audit. */
import { sow, legalMoves, Move, SCOOPS } from './rules';

export type Rand = () => number;
export interface Line { score: number; moves: Move[] }

export function playRandom(start: number[], rnd: Rand, scoops = SCOOPS): Line {
  let b = start, score = 0; const moves: Move[] = [];
  for (let i = 0; i < scoops; i++) { const ms = legalMoves(b); if (!ms.length) break; const m = ms[Math.floor(rnd() * ms.length)]; const r = sow(b, m); b = r.board; score += r.points; moves.push(m); }
  return { score, moves };
}
/** Always takes the scoop worth the most points right now (ties broken at random). */
export function playGreedy(start: number[], rnd: Rand, scoops = SCOOPS): Line {
  let b = start, score = 0; const moves: Move[] = [];
  for (let i = 0; i < scoops; i++) {
    const ms = legalMoves(b); if (!ms.length) break;
    let best = -1, pick: Move[] = [];
    for (const m of ms) { const p = sow(b, m).points; if (p > best) { best = p; pick = [m]; } else if (p === best) pick.push(m); }
    const m = pick[Math.floor(rnd() * pick.length)]; const r = sow(b, m); b = r.board; score += r.points; moves.push(m);
  }
  return { score, moves };
}
/** Looks one scoop further: maximises points now + the best points available next scoop. */
export function playTwoPly(start: number[], rnd: Rand, scoops = SCOOPS): Line {
  let b = start, score = 0; const moves: Move[] = [];
  for (let i = 0; i < scoops; i++) {
    const ms = legalMoves(b); if (!ms.length) break;
    const last = i === scoops - 1;
    let best = -1, pick: Move[] = [];
    for (const m of ms) {
      const r = sow(b, m); let nx = 0;
      if (!last) for (const m2 of legalMoves(r.board)) { const p = sow(r.board, m2).points; if (p > nx) nx = p; }
      const v = r.points + nx;
      if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m);
    }
    const m = pick[Math.floor(rnd() * pick.length)]; const r = sow(b, m); b = r.board; score += r.points; moves.push(m);
  }
  return { score, moves };
}
/** Beam search over all scoops. Ranking = points so far + 0.5 per ripe (3-seed) pot. */
export function beam(start: number[], width: number, scoops = SCOOPS): Line {
  type N = { b: number[]; score: number; moves: Move[]; v: number };
  let layer: N[] = [{ b: start, score: 0, moves: [], v: 0 }];
  let best: Line = { score: 0, moves: [] };
  for (let i = 0; i < scoops; i++) {
    const next: N[] = []; const seen = new Set<string>();
    for (const n of layer) for (const m of legalMoves(n.b)) {
      const r = sow(n.b, m); const score = n.score + r.points;
      const k = r.board.join('') + score; if (seen.has(k)) continue; seen.add(k);
      let ripe = 0; for (const v of r.board) if (v === 3) ripe++;
      next.push({ b: r.board, score, moves: [...n.moves, m], v: score + 0.5 * ripe });
    }
    if (!next.length) break;
    next.sort((a, b) => b.v - a.v);
    layer = next.slice(0, width);
    for (const n of layer) if (n.score > best.score || (n.score === best.score && n.moves.length > best.moves.length)) best = { score: n.score, moves: n.moves };
  }
  // pad to a full line (any remaining scoops score nothing extra but keep the replay complete)
  return best;
}
