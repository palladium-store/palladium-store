'use client';
import { useRef } from 'react';

const OPTIONS: [string, string][] = [['featured', 'Featured'], ['newest', 'Newest'], ['best', 'Best selling'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];

/** GET form with a sort dropdown. Auto-submits with JS, shows an Apply button without it. */
export function SortSelect({ action, value, hidden }: { action: string; value: string; hidden: Record<string, string | undefined> }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} method="get" className="flex items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor={`sort-${action}`} className="text-xs font-semibold uppercase tracking-wider text-mute">Sort</label>
      <select id={`sort-${action}`} name="sort" defaultValue={value} onChange={() => form.current?.requestSubmit()} className="input w-auto py-2 pr-8">
        {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <noscript><button type="submit" className="btn-outline btn-sm">Apply</button></noscript>
    </form>
  );
}
