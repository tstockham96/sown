/**
 * Puzzle numbering. Like other daily games, the puzzle flips at the player's
 * LOCAL midnight, but the puzzle NUMBER (and therefore the seed, map, twist and
 * crowd) is global: puzzle #N is identical for everyone, wherever they are.
 */
export const EPOCH = { y: 2026, m: 10, d: 2 }; // SOWN #1 = Fri Oct 2, 2026
const DAY_MS = 86_400_000;

function epochUtc(): number {
  return Date.UTC(EPOCH.y, EPOCH.m - 1, EPOCH.d);
}

/** Puzzle number for the given instant, using the player's local calendar date. */
export function puzzleNumberFor(date: Date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((local - epochUtc()) / DAY_MS) + 1;
}

/** The calendar date a puzzle number belongs to (as a UTC-midnight Date, use UTC getters). */
export function dateForPuzzle(n: number): Date {
  return new Date(epochUtc() + (n - 1) * DAY_MS);
}

export function formatPuzzleDate(n: number): string {
  const d = dateForPuzzle(n);
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Fraction of the local day elapsed, 0..1. */
export function dayFraction(now: Date = new Date()): number {
  return 1 - msUntilLocalMidnight(now) / DAY_MS;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
