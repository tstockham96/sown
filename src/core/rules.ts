/**
 * SOWN rules. The whole game is these few lines:
 * - The field is a 5x5 grid of pots. Every pot holds 0-3 seeds.
 * - A scoop takes ALL the seeds from one pot and sows them one per pot in a straight line
 *   (right, left, down or up), starting with the next pot. Seeds that run off the edge are lost.
 * - Every pot that reaches exactly 4 is harvested (emptied into your basket).
 * - Points for a scoop = seeds harvested x pots harvested, so 1 pot = 4, 2 pots = 16, 3 pots = 36.
 * - You get 10 scoops. Because a pot that reaches 4 is emptied at once, pots never hold more than 3.
 */
export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const SCOOPS = 10;
export const RIPE = 4;
export type Dir = 0 | 1 | 2 | 3; // right, left, down, up
export const DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIR_NAMES = ['right', 'left', 'down', 'up'] as const;
/** A move is encoded as cell * 4 + dir (0..99). */
export type Move = number;
export const mv = (cell: number, dir: Dir): Move => cell * 4 + dir;
export const cellOf = (m: Move) => m >> 2;
export const dirOf = (m: Move) => (m & 3) as Dir;

export interface Sow {
  board: number[];
  path: number[]; // pots that received a seed, in order
  harvested: number[]; // pots that hit exactly 4 (now empty)
  lost: number; // seeds that ran off the edge
  points: number;
}
export const pointsFor = (pots: number) => RIPE * pots * pots;

export function sow(board: readonly number[], m: Move): Sow {
  const cell = cellOf(m), [dx, dy] = DIRS[dirOf(m)];
  const b = board.slice();
  let n = b[cell];
  b[cell] = 0;
  let x = cell % SIZE, y = (cell / SIZE) | 0;
  const path: number[] = [];
  let lost = 0;
  while (n > 0) {
    x += dx; y += dy;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) { lost = n; break; }
    const c = y * SIZE + x;
    b[c]++;
    path.push(c);
    n--;
  }
  const harvested = path.filter((c) => b[c] === RIPE);
  for (const c of harvested) b[c] = 0;
  return { board: b, path, harvested, lost, points: pointsFor(harvested.length) };
}
export function legalMoves(board: readonly number[]): Move[] {
  const out: Move[] = [];
  for (let c = 0; c < CELLS; c++) if (board[c] > 0) for (let d = 0; d < 4; d++) out.push(c * 4 + d);
  return out;
}
/** Replays a list of moves from a start board. */
export function replay(start: readonly number[], moves: readonly Move[]) {
  let board = start.slice();
  let score = 0;
  const row: number[] = [];
  for (const m of moves) {
    const r = sow(board, m);
    board = r.board;
    score += r.points;
    row.push(r.harvested.length);
  }
  return { board, score, row };
}
export const encodeLine = (ms: readonly Move[]) => ms.map((m) => m.toString(36).padStart(2, '0')).join('');
export const decodeLine = (s: string): Move[] => (s.match(/.{2}/g) ?? []).map((x) => parseInt(x, 36));
