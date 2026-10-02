import { describe, it, expect } from 'vitest';
import { puzzleFor, genBoard, tableSize } from '../src/core/puzzle';
import { replay, legalMoves } from '../src/core/rules';
import { playGreedy, playRandom, playTwoPly, beam } from '../src/core/solver';
import { mulberry32 } from '../src/core/rng';
import PAR from '../src/core/par.json';

const T = PAR as unknown as Record<string, { a: number; b: number; l: string; g: number; t: number; r: number }>;

describe('daily puzzles', () => {
  it('has a precomputed table for days 1-400', () => {
    expect(tableSize()).toBe(400);
  });
  it('is deterministic and varies by day', () => {
    expect(genBoard(5)).toEqual(genBoard(5));
    expect(puzzleFor(5).board).toEqual(puzzleFor(5).board);
    const boards = new Set(Array.from({ length: 50 }, (_, i) => puzzleFor(i + 1).board.join('')));
    expect(boards.size).toBe(50);
  });
  it('every stored best line replays to the stored best score in 10 scoops', () => {
    for (let n = 1; n <= 400; n++) {
      const p = puzzleFor(n);
      expect(p.bestLine.length).toBeLessThanOrEqual(10);
      expect(replay(p.board, p.bestLine).score).toBe(p.best);
      expect(Math.max(...p.board)).toBeLessThanOrEqual(3);
    }
  });
  it('every day passes the depth gate: best >= 1.3x greedy, >= 1.1x two-ply, >= 56', () => {
    for (const [n, e] of Object.entries(T)) {
      expect(e.b, `day ${n}`).toBeGreaterThanOrEqual(56);
      expect(e.b / e.g, `day ${n}`).toBeGreaterThanOrEqual(1.3);
      expect(e.b / e.t, `day ${n}`).toBeGreaterThanOrEqual(1.1);
    }
  });
  it('random < greedy < two-ply < beam on a sample of days', () => {
    let r = 0, g = 0, t = 0, bm = 0;
    for (let n = 1; n <= 12; n++) {
      const p = puzzleFor(n);
      const rnd = mulberry32(n);
      for (let k = 0; k < 5; k++) { r += playRandom(p.board, rnd).score / 5; g += playGreedy(p.board, rnd).score / 5; }
      t += playTwoPly(p.board, rnd).score;
      bm += beam(p.board, 60).score;
    }
    expect(g).toBeGreaterThan(r * 2);
    expect(t).toBeGreaterThan(g * 1.1);
    expect(bm).toBeGreaterThan(g * 1.3);
  });
  it('day 1 opens with plenty of choice', () => {
    expect(legalMoves(puzzleFor(1).board).length).toBeGreaterThan(60);
  });
});
