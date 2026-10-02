import type { DayResult } from '../core/stats';
export interface Progress { n: number; gen: number; moves: number[]; startedAt: number; elapsed: number }
export interface Store {
  v: 1;
  results: Record<string, DayResult>;
  progress?: Progress;
  sound: boolean;
  haptics: boolean;
  seenHint: boolean;
  name: string;
  plus: boolean; // premium stub
}
const KEY = 'sown:v1';
let mem: Store | null = null;
const fresh = (): Store => ({ v: 1, results: {}, sound: true, haptics: true, seenHint: false, name: '', plus: false });
export function load(): Store {
  if (mem) return mem;
  try { const raw = localStorage.getItem(KEY); mem = raw ? { ...fresh(), ...(JSON.parse(raw) as Store) } : fresh(); } catch { mem = fresh(); }
  return mem!;
}
export function save(): void { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* private mode */ } }
export function reset(): void { mem = fresh(); save(); }
