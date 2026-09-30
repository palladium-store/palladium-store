'use client';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return <button type="button" className="no-print btn-primary btn-sm" onClick={() => window.print()}>{label}</button>;
}
