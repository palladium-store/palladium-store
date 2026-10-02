'use client';
import { useEffect, useRef, useState } from 'react';
import { sanitizeHtml, toHtml } from '@/lib/rich-text';

type Cmd = { label: string; title: string; run: () => void; active?: string };

/** Small rich-text editor (bold, italic, headings, lists, links). Output is sanitized HTML; the server sanitizes again on save. */
export function RichTextEditor({ value, onChange, invalid, id }: { value: string; onChange: (html: string) => void; invalid?: boolean; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('https://');
  const saved = useRef<Range | null>(null);
  const lastEmitted = useRef<string | null>(null);

  // Load the initial value once (and when it changes from outside, e.g. a reset), without clobbering the caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (el && value !== lastEmitted.current) { el.innerHTML = toHtml(value); lastEmitted.current = value; }
  }, [value]);

  const emit = () => {
    const el = ref.current; if (!el) return;
    const html = sanitizeHtml(el.innerHTML);
    lastEmitted.current = html; onChange(html);
  };
  const exec = (cmd: string, arg?: string) => { ref.current?.focus(); document.execCommand(cmd, false, arg); emit(); };
  const block = (tag: string) => exec('formatBlock', tag);

  function openLink() {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    setUrl('https://'); setLinkOpen(true);
  }
  function applyLink(e: React.FormEvent) {
    e.preventDefault();
    const sel = window.getSelection();
    ref.current?.focus();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
    const href = url.trim();
    if (href && href !== 'https://') document.execCommand('createLink', false, href);
    setLinkOpen(false); emit();
  }

  const btns: Cmd[] = [
    { label: 'B', title: 'Bold', run: () => exec('bold') },
    { label: 'I', title: 'Italic', run: () => exec('italic') },
    { label: 'H2', title: 'Heading', run: () => block('h2') },
    { label: 'H3', title: 'Subheading', run: () => block('h3') },
    { label: 'Text', title: 'Normal paragraph', run: () => block('p') },
    { label: '• List', title: 'Bulleted list', run: () => exec('insertUnorderedList') },
    { label: '1. List', title: 'Numbered list', run: () => exec('insertOrderedList') },
    { label: 'Link', title: 'Add link to selected text', run: openLink },
    { label: 'Unlink', title: 'Remove link', run: () => exec('unlink') },
  ];
  const btnCls = 'border border-line bg-white px-2.5 py-1 text-xs font-semibold hover:bg-ink hover:text-white';

  return (
    <div className={`border ${invalid ? 'border-red-500' : 'border-line'}`}>
      <div className="flex flex-wrap gap-1 border-b border-line bg-bone p-2" role="toolbar" aria-label="Formatting">
        {btns.map((b) => (
          // onMouseDown preventDefault keeps the text selection while a toolbar button is pressed.
          <button key={b.title} type="button" title={b.title} aria-label={b.title} className={`${btnCls} ${b.label === 'B' ? 'font-bold' : b.label === 'I' ? 'italic' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={b.run}>{b.label}</button>
        ))}
      </div>
      {linkOpen && (
        <form onSubmit={applyLink} className="flex flex-wrap items-center gap-2 border-b border-line bg-gold-soft p-2">
          <label className="text-xs font-semibold" htmlFor={`${id ?? 'rte'}-url`}>Link address</label>
          <input id={`${id ?? 'rte'}-url`} className="input h-9 min-w-[220px] flex-1" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus placeholder="https://..." />
          <button className="btn-primary btn-sm">Add link</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setLinkOpen(false)}>Cancel</button>
        </form>
      )}
      <div ref={ref} id={id} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Description"
        className="rte min-h-[180px] max-h-[480px] overflow-y-auto bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
        onInput={emit} onBlur={emit}
        onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); }} />
    </div>
  );
}
