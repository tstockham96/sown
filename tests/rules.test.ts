import { describe, it, expect } from 'vitest';
import { sow, mv, legalMoves, replay, encodeLine, decodeLine, pointsFor, SIZE, CELLS } from '../src/core/rules';
import { makeRng } from '../src/core/rng';

const blank = () => new Array(CELLS).fill(0);

describe('sow', () => {
  it('matches the onboarding example: [2,3,3,1] sow the 2 right -> two pots harvested, +16', () => {
    const b = blank(); b[0] = 2; b[1] = 3; b[2] = 3; b[3] = 1;
    const r = sow(b, mv(0, 0));
    expect(r.path).toEqual([1, 2]);
    expect(r.harvested).toEqual([1, 2]);
    expect(r.points).toBe(16);
    expect(r.board.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(r.lost).toBe(0);
  });
  it('sows one per pot in each direction, starting with the next pot', () => {
    const b = blank(); const c = 2 * SIZE + 2; b[c] = 2;
    expect(sow(b, mv(c, 0)).path).toEqual([c + 1, c + 2]);
    expect(sow(b, mv(c, 1)).path).toEqual([c - 1, c - 2]);
    expect(sow(b, mv(c, 2)).path).toEqual([c + SIZE, c + 2 * SIZE]);
    expect(sow(b, mv(c, 3)).path).toEqual([c - SIZE, c - 2 * SIZE]);
  });
  it('loses seeds off the edge', () => {
    const b = blank(); b[3] = 3;
    const r = sow(b, mv(3, 0));
    expect(r.path).toEqual([4]);
    expect(r.lost).toBe(2);
    expect(r.board[4]).toBe(1);
  });
  it('only exactly 4 harvests; 1 pot = 4, 2 = 16, 3 = 36', () => {
    expect([1, 2, 3].map(pointsFor)).toEqual([4, 16, 36]);
    const b = blank(); b[0] = 3; b[1] = 3; b[2] = 2; b[3] = 3;
    const r = sow(b, mv(0, 0));
    expect(r.harvested).toEqual([1, 3]);
    expect(r.board[2]).toBe(3);
    expect(r.points).toBe(16);
  });
  it('pots never exceed 3 under random play (so every sow is 1-3 long)', () => {
    const rnd = makeRng(42);
    for (let g = 0; g < 200; g++) {
      let b = Array.from({ length: CELLS }, () => Math.floor(rnd.next() * 4));
      for (let i = 0; i < 10; i++) {
        const ms = legalMoves(b); if (!ms.length) break;
        b = sow(b, ms[Math.floor(rnd.next() * ms.length)]).board;
        expect(Math.max(...b)).toBeLessThanOrEqual(3);
      }
    }
  });
  it('empty pots have no legal moves; each filled pot has 4', () => {
    const b = blank(); b[7] = 1; b[8] = 3;
    expect(legalMoves(b)).toEqual([28, 29, 30, 31, 32, 33, 34, 35]);
  });
  it('replay accumulates score and row; lines round-trip', () => {
    const b = blank(); b[0] = 2; b[1] = 3; b[2] = 3; b[3] = 1;
    const r = replay(b, [mv(0, 0), mv(3, 1)]);
    expect(r.score).toBe(16);
    expect(r.row).toEqual([2, 0]);
    const line = [0, 5, 37, 99, 12];
    expect(decodeLine(encodeLine(line))).toEqual(line);
  });
});
