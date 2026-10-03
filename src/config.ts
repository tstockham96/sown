/**
 * Runtime config. Override at build time with VITE_* env vars, or at runtime by defining
 * `window.FOURS_CONFIG = {...}` (legacy `SOWN_CONFIG` also works) before the app script runs.
 */
export interface FoursConfig {
  publicUrl: string; // canonical URL for share/challenge links ('' = current page)
  features: {
    premium: boolean; // FOURS+ upsell: archive of past boards
    ads: boolean; // ad slot on the results sheet
  };
}
declare global {
  interface Window {
    FOURS_CONFIG?: Partial<FoursConfig>;
    SOWN_CONFIG?: Partial<FoursConfig>;
  }
}
/** Where FOURS is published (the repo is still called `sown`, so old links keep working). Share and challenge links always point here unless overridden. */
export const DEFAULT_PUBLIC_URL = 'https://tstockham96.github.io/sown/';
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const runtime = (typeof window !== 'undefined' && (window.FOURS_CONFIG ?? window.SOWN_CONFIG)) || {};
export const CONFIG: FoursConfig = {
  publicUrl: runtime.publicUrl ?? env.VITE_PUBLIC_URL ?? DEFAULT_PUBLIC_URL,
  features: {
    premium: runtime.features?.premium ?? env.VITE_FEATURE_PREMIUM !== '0',
    ads: runtime.features?.ads ?? env.VITE_FEATURE_ADS !== '0',
  },
};
export function baseUrl(): string {
  if (CONFIG.publicUrl) return CONFIG.publicUrl.replace(/#.*$/, '');
  if (typeof location === 'undefined' || location.protocol === 'file:') return DEFAULT_PUBLIC_URL;
  return location.href.replace(/[?#].*$/, '');
}
