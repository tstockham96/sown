import type { Puzzle } from './puzzle';

/** One emoji per scoop: how many pots that scoop harvested. */
export const GLYPHS = ['▫️', '🌱', '🌿', '🌻'];
export const glyph = (pots: number) => GLYPHS[Math.max(0, Math.min(3, pots))];
export const rowText = (row: readonly number[]) => row.map(glyph).join('');

export interface Tier { key: string; name: string; min: number; emoji: string }
/** Tiers are relative to the best harvest our solver found for the day. */
export const TIERS: Tier[] = [
  { key: 'thin', name: 'Thin harvest', min: 0, emoji: '🥀' },
  { key: 'fair', name: 'Fair harvest', min: 0.5, emoji: '🌾' },
  { key: 'good', name: 'Good harvest', min: 0.7, emoji: '🧺' },
  { key: 'gold', name: 'Golden harvest', min: 0.85, emoji: '✨' },
  { key: 'bumper', name: 'Bumper crop', min: 1, emoji: '🏆' },
];
export function tierIndex(score: number, best: number): number {
  const f = best > 0 ? score / best : 1;
  let k = 0;
  for (let i = 0; i < TIERS.length; i++) if (f >= TIERS[i].min) k = i;
  return k;
}
export const tierFor = (score: number, best: number) => TIERS[tierIndex(score, best)];

/** Spoiler-free: no board, no positions — just the score and how each scoop went. */
export function shareText(p: Puzzle, score: number, row: readonly number[], link: string, streak = 0): string {
  const t = tierFor(score, p.best);
  const lines = [
    `SOWN #${p.n} 🌱`,
    `${score} / ${p.best} seeds · ${t.name} ${t.emoji}${streak > 1 ? ` · 🔥${streak}` : ''}`,
    rowText(row),
  ];
  if (link) lines.push(link);
  return lines.join('\n');
}
