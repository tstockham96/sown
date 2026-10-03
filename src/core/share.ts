import type { Puzzle } from './puzzle';

/** Game display name. (Repo/URL stay `sown` so existing links keep working.) */
export const NAME = 'FOURS';
/** One square per move: how many tiles that move cleared. */
export const GLYPHS = ['⬛', '🟨', '🟧', '🟥'];
export const glyph = (clears: number) => GLYPHS[Math.max(0, Math.min(3, clears))];
export const rowText = (row: readonly number[]) => row.map(glyph).join('');

export interface Tier { key: string; name: string; min: number; mark: string }
/** Tiers are relative to the best line our solver found for the day. Plain text + dot marks. */
export const TIERS: Tier[] = [
  { key: 'low', name: 'Warm-up', min: 0, mark: '○○○○' },
  { key: 'fair', name: 'Fair', min: 0.5, mark: '●○○○' },
  { key: 'good', name: 'Good', min: 0.7, mark: '●●○○' },
  { key: 'great', name: 'Great', min: 0.85, mark: '●●●○' },
  { key: 'max', name: 'Max', min: 1, mark: '●●●●' },
];
export function tierIndex(score: number, best: number): number {
  const f = best > 0 ? score / best : 1;
  let k = 0;
  for (let i = 0; i < TIERS.length; i++) if (f >= TIERS[i].min) k = i;
  return k;
}
export const tierFor = (score: number, best: number) => TIERS[tierIndex(score, best)];

/** Spoiler-free: no board, no positions, just the score and how many tiles each move cleared. */
export function shareText(p: Puzzle, score: number, row: readonly number[], link: string, streak = 0): string {
  const t = tierFor(score, p.best);
  const lines = [
    `${NAME} #${p.n} · ${score} / ${p.best}`,
    rowText(row),
    `${t.name} ${t.mark}${streak > 1 ? ` · streak ${streak}` : ''}`,
  ];
  if (link) lines.push(link);
  return lines.join('\n');
}
