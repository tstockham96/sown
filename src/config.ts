/**
 * Runtime config. Override at build time with VITE_* env vars, or at runtime by defining
 * `window.SOWN_CONFIG = {...}` before the app script runs.
 */
export interface SownConfig {
  publicUrl: string; // canonical URL for share/challenge links ('' = current page)
  features: {
    premium: boolean; // SOWN+ upsell: archive of past fields
    ads: boolean; // ad slot on the results sheet
  };
}
declare global {
  interface Window {
    SOWN_CONFIG?: Partial<SownConfig>;
  }
}
/** Where SOWN is published. Share and challenge links always point here unless overridden. */
export const DEFAULT_PUBLIC_URL = 'https://tstockham96.github.io/sown/';
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const runtime = (typeof window !== 'undefined' && window.SOWN_CONFIG) || {};
export const CONFIG: SownConfig = {
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
