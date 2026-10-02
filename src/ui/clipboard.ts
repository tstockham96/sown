export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Web Share on devices that have it (mostly mobile); returns false to signal "copy instead". */
export async function nativeShare(text: string): Promise<'shared' | 'cancelled' | false> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (!nav.share || !coarse) return false;
  try {
    await nav.share({ text });
    return 'shared';
  } catch (e) {
    return (e as Error)?.name === 'AbortError' ? 'cancelled' : false;
  }
}
