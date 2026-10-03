import { describe, it, expect } from 'vitest';
import { shareText, rowText, tierFor } from '../src/core/share';
import { encodeChallenge, decodeChallenge } from '../src/core/challenge';
import { computeStats, DayResult } from '../src/core/stats';
import { crowdFor, percentile } from '../src/core/crowd';
import { puzzleFor } from '../src/core/puzzle';
import { puzzleNumberFor, dateForPuzzle } from '../src/core/date';

describe('share', () => {
  it('is spoiler-free and number-flavoured: FOURS #n · score / best, one square per move, text tier', () => {
    const p = puzzleFor(1);
    const row = [1, 2, 0, 0, 2, 3, 0, 0, 0, 0];
    const t = shareText(p, 64, row, 'https://tstockham96.github.io/sown/', 3);
    const lines = t.split('\n');
    expect(lines[0]).toBe(`FOURS #1 · 64 / ${p.best}`);
    expect(lines[1]).toBe('🟨🟧⬛⬛🟧🟥⬛⬛⬛⬛');
    expect(lines[1]).toBe(rowText(row));
    expect(lines[2]).toMatch(/^(Warm-up|Fair|Good|Great|Max) [●○]{4} · streak 3$/);
    expect(lines[3]).toBe('https://tstockham96.github.io/sown/');
    expect(t).not.toMatch(/right|left|up|down|[A-E][1-5]/);
    expect(lines.slice(0, 3).join(' ')).not.toMatch(/seed|harvest|scoop|field|pot|ripe|SOWN|[🌱🌿🌻🥀🌾🧺✨🏆]/iu);
    expect(tierFor(p.best, p.best).name).toBe('Max');
    expect(tierFor(0, p.best).name).toBe('Warm-up');
  });
});
describe('challenge', () => {
  it('round-trips and rejects junk', () => {
    const c = { n: 12, score: 88, row: [1, 2, 3, 0, 0, 1, 1, 0, 2, 0], by: 'Thomas' };
    expect(decodeChallenge(encodeChallenge(c))).toEqual(c);
    expect(decodeChallenge('not-a-code')).toBeNull();
  });
  it('still opens challenge links made by the SOWN build', () => {
    expect(decodeChallenge('czF8MXw4NHwwMjAzMDIwMjAwfFRob21hcw')).toEqual({ n: 1, score: 84, row: [0, 2, 0, 3, 0, 2, 0, 2, 0, 0], by: 'Thomas' });
  });
});
describe('stats', () => {
  it('computes streaks and percentages', () => {
    const r = (score: number, best = 80): DayResult => ({ score, best, row: [], secs: 60, at: 0 });
    const s = computeStats({ 1: r(40), 2: r(80), 3: r(60), 5: r(70) }, 5);
    expect(s.played).toBe(4);
    expect(s.streak).toBe(1);
    expect(s.maxStreak).toBe(3);
    expect(s.bumper).toBe(1);
    expect(computeStats({ 3: r(1), 4: r(1) }, 5).streak).toBe(2);
    expect(computeStats({ 3: r(1) }, 5).streak).toBe(0);
  });
});
describe('crowd + dates', () => {
  it('crowd estimate is deterministic and percentile is monotone', () => {
    const p = puzzleFor(3);
    const c = crowdFor(p);
    expect(c.n).toBe(300);
    expect(percentile(c, 0)).toBeLessThan(percentile(c, p.best));
    expect(percentile(c, p.best)).toBeGreaterThan(90);
  });
  it('puzzle #1 is Oct 2 2026', () => {
    expect(puzzleNumberFor(new Date(2026, 9, 2, 12))).toBe(1);
    const d = dateForPuzzle(30); // UTC-midnight date; read with UTC getters
    expect(puzzleNumberFor(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9))).toBe(30);
    expect(puzzleNumberFor(new Date(2026, 10, 1, 23, 30))).toBe(31); // across the DST change
  });
});
describe('config', () => {
  it('share/challenge links default to the published GitHub Pages URL', async () => {
    const { baseUrl, DEFAULT_PUBLIC_URL } = await import('../src/config');
    expect(DEFAULT_PUBLIC_URL).toBe('https://tstockham96.github.io/sown/');
    expect(baseUrl()).toBe('https://tstockham96.github.io/sown/');
  });
});
