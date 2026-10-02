// Depth audit on the shipped game module. Usage: tsx scripts/depth.ts [days=60]
// Fresh RNG seeds (not the ones used to build par.json) for random / greedy / two-ply; beam widths 10 and 100 live; "best" = par table (beam 1000).
import { puzzleFor, genBoard } from '../src/core/puzzle';
import { playRandom, playGreedy, playTwoPly, beam } from '../src/core/solver';
import { sow, legalMoves, SCOOPS, DIR_NAMES, cellOf, dirOf, SIZE, replay } from '../src/core/rules';
import { mulberry32 } from './util';
import PAR from '../src/core/par.json';
const DAYS = Number(process.argv[2] ?? 60);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
/** "Tidy" heuristic player: immediate points + 0.5 per ripe pot left (a one-step player with board sense). */
function playTidy(start: number[], rnd: () => number) {
  let b = start, score = 0;
  for (let i = 0; i < SCOOPS; i++) {
    const ms = legalMoves(b); if (!ms.length) break;
    let bv = -1, pick: number[] = [];
    for (const m of ms) { const r = sow(b, m); const v = r.points + 0.5 * r.board.filter((x) => x === 3).length - 0.3 * r.lost; if (v > bv + 1e-9) { bv = v; pick = [m]; } else if (Math.abs(v - bv) < 1e-9) pick.push(m); }
    const r = sow(b, pick[Math.floor(rnd() * pick.length)]); b = r.board; score += r.points;
  }
  return score;
}
const rows: any[] = [];
for (let n = 1; n <= DAYS; n++) {
  const p = puzzleFor(n); const rnd = mulberry32(0xbeef + n * 31);
  const r = mean(Array.from({ length: 50 }, () => playRandom(p.board, rnd).score));
  const g = mean(Array.from({ length: 20 }, () => playGreedy(p.board, rnd).score));
  const td = mean(Array.from({ length: 10 }, () => playTidy(p.board, rnd)));
  const t = mean(Array.from({ length: 5 }, () => playTwoPly(p.board, rnd).score));
  const b10 = beam(p.board, 10).score, b100 = beam(p.board, 100).score;
  rows.push({ n, r, g, td, t, b10, b100, best: p.best, moves: legalMoves(p.board).length, seeds: p.board.reduce((a, b) => a + b, 0), ripe: p.board.filter((x) => x === 3).length });
}
const col = (k: string) => rows.map((x) => x[k]);
const G = mean(col('g'));
const line = (name: string, k: string) => `| ${name} | ${mean(col(k)).toFixed(1)} | ${sd(col(k)).toFixed(1)} | ${Math.min(...col(k)).toFixed(0)}–${Math.max(...col(k)).toFixed(0)} | ${(mean(col(k)) / G).toFixed(2)}× |`;
console.log(`## Game-module ladder, days 1–${DAYS} (5x5, 10 scoops)\n`);
console.log('| player | mean | sd | range | vs greedy |\n|---|---|---|---|---|');
console.log(line('random (50 games/day)', 'r'));
console.log(line('greedy: max points now (20/day)', 'g'));
console.log(line('tidy: points now + ripe pots kept (10/day)', 'td'));
console.log(line('two-ply: max points now + next (5/day)', 't'));
console.log(line('beam search width 10', 'b10'));
console.log(line('beam search width 100', 'b100'));
console.log(line('best known (beam 1000, par table)', 'best'));
const cnt = (f: (x: any) => boolean) => rows.filter(f).length;
console.log(`\nPer-day consistency (of ${DAYS}): greedy > 2x random: ${cnt((x) => x.g > 2 * x.r)}; two-ply > greedy: ${cnt((x) => x.t > x.g)}; beam10 > two-ply: ${cnt((x) => x.b10 > x.t)}; beam100 > beam10: ${cnt((x) => x.b100 > x.b10)}; best >= 1.3x greedy: ${cnt((x) => x.best >= 1.3 * x.g)}; best >= 1.5x greedy: ${cnt((x) => x.best >= 1.5 * x.g)}`);
console.log(`Opening position: legal moves ${Math.min(...col('moves'))}–${Math.max(...col('moves'))} (mean ${mean(col('moves')).toFixed(0)}), seeds ${Math.min(...col('seeds'))}–${Math.max(...col('seeds'))}, ripe pots ${Math.min(...col('ripe'))}–${Math.max(...col('ripe'))}`);

// Unfiltered generator (attempt 0 for every day, no acceptance gate) to show the gap is not only selection.
const raw: any[] = [];
for (let n = 1; n <= DAYS; n++) {
  const b = genBoard(n, 0); const rnd = mulberry32(0xabc + n);
  raw.push({ g: mean(Array.from({ length: 20 }, () => playGreedy(b, rnd).score)), t: mean(Array.from({ length: 5 }, () => playTwoPly(b, rnd).score)), b100: beam(b, 100).score, r: mean(Array.from({ length: 50 }, () => playRandom(b, rnd).score)) });
}
const rm = (k: string) => mean(raw.map((x) => x[k]));
console.log(`\nUnfiltered attempt-0 boards (no acceptance gate), days 1–${DAYS}: random ${rm('r').toFixed(1)}, greedy ${rm('g').toFixed(1)}, two-ply ${rm('t').toFixed(1)}, beam100 ${rm('b100').toFixed(1)} (beam100/greedy ${(rm('b100') / rm('g')).toFixed(2)}×)`);

// Par table summary (all 400 days)
const T = Object.values(PAR as any) as any[];
const tb = T.map((e) => e.b), tg = T.map((e) => e.g);
console.log(`\nPar table (400 days): best ${mean(tb).toFixed(1)} (range ${Math.min(...tb)}–${Math.max(...tb)}), greedy ${mean(tg).toFixed(1)}, two-ply ${mean(T.map((e) => e.t)).toFixed(1)}, random ${mean(T.map((e) => e.r)).toFixed(1)}; best/greedy ${Math.min(...T.map((e) => e.b / e.g)).toFixed(2)}–${Math.max(...T.map((e) => e.b / e.g)).toFixed(2)}; boards needing a re-roll: ${T.filter((e) => e.a > 0).length}/400 (max attempt ${Math.max(...T.map((e) => e.a))})`);

// Example decision on puzzle #1
const p = puzzleFor(1);
const name = (m: number) => { const c = cellOf(m); return `${'ABCDE'[c % SIZE]}${((c / SIZE) | 0) + 1} (${p.board[c]} seeds) ${DIR_NAMES[dirOf(m)]}`; };
console.log('\n## Puzzle #1 board (rows 1-5, columns A-E)');
for (let y = 0; y < SIZE; y++) console.log('   ' + p.board.slice(y * SIZE, y * SIZE + SIZE).join(' '));
const ms = legalMoves(p.board).map((m) => ({ m, pts: sow(p.board, m).points }));
const top = Math.max(...ms.map((x) => x.pts));
const greedyOpen = ms.filter((x) => x.pts === top);
console.log(`Opening: ${ms.length} legal scoops; ${ms.filter((x) => x.pts > 0).length} harvest something now; max now = +${top} (${greedyOpen.length} scoops: ${greedyOpen.map((x) => name(x.m)).join('; ')})`);
for (const x of greedyOpen) { const r = sow(p.board, x.m); const cont = beam(r.board, 1000, SCOOPS - 1); console.log(`  open ${name(x.m)}: +${x.pts}, best continuation found ${cont.score} -> total ${x.pts + cont.score}`); }
const b0 = p.bestLine[0];
const rb = replay(p.board, p.bestLine);
console.log(`  best line opens ${name(b0)}: +${sow(p.board, b0).points}; line total ${rb.score}; per-scoop pots ${rb.row.join(',')}`);
console.log(`  best line: ${p.bestLine.map((m, i) => `${i + 1}. ${'ABCDE'[cellOf(m) % SIZE]}${((cellOf(m) / SIZE) | 0) + 1}${'→←↓↑'[dirOf(m)]}`).join(' ')}`);
