let on = true;
export const setHaptics = (v: boolean) => (on = v);
export function buzz(p: number | number[]) {
  if (!on) return;
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(p);
  } catch {
    /* unsupported */
  }
}
