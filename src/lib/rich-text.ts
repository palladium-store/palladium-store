// Tiny allow-list HTML sanitizer for product descriptions (no dependencies, runs in browser and server).
// Allowed: p, br, strong, em, h2, h3, ul, ol, li, a. Everything else is removed but its text is kept.
// Links must be http(s), mailto, tel or site-relative. All attributes except a safe href are dropped.

const ALIASES: Record<string, string> = { b: 'strong', i: 'em', div: 'p', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3' };
const ALLOWED = new Set(['p', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'a']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n' };
const decodeEntities = (s: string) =>
  s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));?/g, (m, dec, hex, name) => {
    if (dec || hex) { const n = dec ? parseInt(dec, 10) : parseInt(hex, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return NAMED[String(name).toLowerCase()] ?? m;
  });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Keeps entities the editor produces (&amp; &lt; &gt; &quot; &#39; &nbsp;) and escapes any other stray ampersand or angle bracket in text.
const escText = (s: string) => s.replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function safeHref(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = decodeEntities(raw).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]+/g, '');
  if (!v || v.length > 2000) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v) || /^\/(?!\/)/.test(v) || /^#/.test(v)) return v;
  return null;
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  const src = String(input).replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack: string[] = [];
  let out = '', last = 0, m: RegExpExecArray | null;
  const closeTo = (name: string) => { const i = stack.lastIndexOf(name); if (i < 0) return; while (stack.length > i) out += `</${stack.pop()}>`; };
  while ((m = tagRe.exec(src))) {
    out += escText(src.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === '/';
    const raw = m[2].toLowerCase();
    if (raw === 'br') { if (!closing) out += '<br>'; continue; }
    const name = ALIASES[raw] ?? raw;
    if (!ALLOWED.has(name)) continue;
    if (closing) { closeTo(name); continue; }
    if (name === 'li' && !stack.includes('ul') && !stack.includes('ol')) { out += '<ul>'; stack.push('ul'); }
    if (name === 'li' && stack[stack.length - 1] === 'li') closeTo('li');
    if (name === 'p' || name.startsWith('h') || name === 'ul' || name === 'ol') { // block elements cannot sit inside inline formatting or paragraphs
      while (stack.length && ['strong', 'em', 'a', 'p', 'h2', 'h3'].includes(stack[stack.length - 1])) out += `</${stack.pop()}>`;
    }
    if (name === 'a') {
      const hm = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[3] ?? '');
      const href = safeHref(hm ? (hm[1] ?? hm[2] ?? hm[3]) : undefined);
      if (!href) continue;
      if (stack.includes('a')) closeTo('a');
      out += /^https?:/i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">` : `<a href="${esc(href)}">`;
      stack.push('a'); continue;
    }
    out += `<${name}>`; stack.push(name);
  }
  out += escText(src.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  return out.replace(/<(p|strong|em|h2|h3|li|a)>(?:\s|<br>|&nbsp;)*<\/\1>/g, '').replace(/<(ul|ol)>\s*<\/\1>/g, '').trim();
}

const looksLikeHtml = (s: string) => /<\/?(p|br|strong|em|b|i|h[1-6]|ul|ol|li|a|div)\b/i.test(s);

/** Turns older plain-text descriptions into paragraphs, and sanitizes anything that already is HTML. */
export function toHtml(s: string | null | undefined): string {
  if (!s) return '';
  if (looksLikeHtml(s)) return sanitizeHtml(s);
  return s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escText(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export function htmlToText(s: string | null | undefined): string {
  if (!s) return '';
  return decodeEntities(String(s).replace(/<\/(p|h2|h3|li)>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}
