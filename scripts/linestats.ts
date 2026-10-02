// Shape of the best-known lines: how points are distributed across the 10 scoops.
import PAR from '../src/core/par.json';
import { genBoard } from '../src/core/puzzle';
import { replay, decodeLine, sow, legalMoves } from '../src/core/rules';
const T = PAR as any;
const pos = new Array(10).fill(0), zero = new Array(10).fill(0), triples = { n: 0 }, setup = { n: 0, of: 0 };
let deadTail = 0, n = 0, alive10 = 0;
for (const k of Object.keys(T)) {
  const e = T[k]; const b0 = genBoard(Number(k), e.a); const line = decodeLine(e.l);
  let b = b0;
  line.forEach((m, i) => {
    const r = sow(b, m);
    pos[i] += r.points; if (!r.points) zero[i]++; if (r.harvested.length === 3) triples.n++;
    // "sacrifice" = a zero-point scoop played while a scoring scoop was available
    if (!r.points) { setup.of++; if (legalMoves(b).some((x) => sow(b, x).points > 0)) setup.n++; }
    b = r.board;
  });
  if (line.length === 10 && legalMoves(b).length) alive10++;
  const row = replay(b0, line).row; if (row[8] === 0 && row[9] === 0) deadTail++;
  n++;
}
console.log('mean points by scoop:', pos.map((x) => (x / n).toFixed(1)).join(' '));
console.log('share of days where scoop i scores 0:', zero.map((x) => Math.round((x / n) * 100) + '%').join(' '));
console.log(`zero-point scoops in best lines: ${setup.of} (${(setup.of / n).toFixed(1)}/day); of those, ${setup.n} (${Math.round((100 * setup.n) / setup.of)}%) were deliberate setups (a scoring scoop was available)`);
console.log(`triple harvests in best lines: ${triples.n} (${(triples.n / n).toFixed(2)}/day); days with last two scoops both empty: ${deadTail}/${n}`);
