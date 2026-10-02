/** Friend challenge links: `#c=<code>`. The code carries the puzzle number and the sender's result only (no moves). */
export interface Challenge { n: number; score: number; row: number[]; by: string }

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bytes = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
export function encodeChallenge(c: Challenge): string {
  const name = c.by.replace(/[|]/g, '').slice(0, 16);
  return b64url(`s1|${c.n}|${c.score}|${c.row.join('')}|${name}`);
}
export function decodeChallenge(code: string): Challenge | null {
  try {
    const [v, n, score, row, ...name] = unb64url(code).split('|');
    if (v !== 's1' || !/^\d{1,5}$/.test(n) || !/^\d{1,4}$/.test(score) || !/^[0-3]{0,10}$/.test(row)) return null;
    return { n: Number(n), score: Number(score), row: [...row].map(Number), by: name.join('|').slice(0, 16) };
  } catch {
    return null;
  }
}
