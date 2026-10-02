// Precompute each day's board choice + best-known harvest. Usage: tsx scripts/par.ts <from> <to> <out.json>
// A board is accepted only if planning clearly pays: best >= 1.3 x greedy, best >= 1.1 x two-ply, best >= 56.
import { writeFileSync } from 'node:fs';
import { genBoard } from '../src/core/puzzle';
import { beam, playGreedy, playTwoPly, playRandom } from '../src/core/solver';
import { encodeLine } from '../src/core/rules';
import { mulberry32 } from './util';
const [from, to, out] = [Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 10), process.argv[4] ?? 'par-part.json'];
const WIDTH = Number(process.env.WIDTH ?? 1000);
const res: Record<number, any> = {};
for (let n = from; n <= to; n++) {
  let chosen: any = null, fallback: any = null;
  for (let a = 0; a < 8 && !chosen; a++) {
    const b = genBoard(n, a); const rnd = mulberry32(n * 1000 + a);
    const ex = beam(b, WIDTH);
    const g = Array.from({ length: 8 }, () => playGreedy(b, rnd).score).reduce((x, y) => x + y) / 8;
    const t = Array.from({ length: 3 }, () => playTwoPly(b, rnd).score).reduce((x, y) => x + y) / 3;
    const r = Array.from({ length: 40 }, () => playRandom(b, rnd).score).reduce((x, y) => x + y) / 40;
    const e = { a, b: ex.score, l: encodeLine(ex.moves), g: +g.toFixed(1), t: +t.toFixed(1), r: +r.toFixed(1) };
    if (ex.score >= 1.3 * g && ex.score >= 1.1 * t && ex.score >= 56) chosen = e;
    if (!fallback || ex.score / g > fallback.b / fallback.g) fallback = e;
  }
  res[n] = chosen ?? fallback;
  if (n % 10 === 0) console.log(n, JSON.stringify(res[n]));
}
writeFileSync(out, JSON.stringify(res));
