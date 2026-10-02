// Tighten the best-known line: for every opening scoop, beam-search the remaining 9 scoops; keep any strictly better line.
// Usage: tsx scripts/improve.ts <from> <to> <out.json>   (board choice is unchanged; only b/l can go up)
import { writeFileSync } from 'node:fs';
import { genBoard } from '../src/core/puzzle';
import { beam } from '../src/core/solver';
import { sow, legalMoves, encodeLine, SCOOPS } from '../src/core/rules';
import PAR from '../src/core/par.json';
const [from, to, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const W = Number(process.env.WIDTH ?? 250);
const T = PAR as any;
const res: Record<number, any> = {};
for (let n = from; n <= to; n++) {
  const e = { ...T[n] }; const b = genBoard(n, e.a);
  for (const m of legalMoves(b)) {
    const r = sow(b, m); const c = beam(r.board, W, SCOOPS - 1);
    if (r.points + c.score > e.b) { e.b = r.points + c.score; e.l = encodeLine([m, ...c.moves]); }
  }
  if (e.b > T[n].b) e.prev = T[n].b;
  res[n] = e;
  if (n % 5 === 0) console.log(n, T[n].b, '->', e.b);
}
writeFileSync(out, JSON.stringify(res));
