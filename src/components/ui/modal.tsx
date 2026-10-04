'use client';
import { useEffect, useRef } from 'react';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto bg-paper p-6 shadow-2xl outline-none ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl tracking-tightest">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 px-2 text-2xl leading-none text-mute hover:text-ink">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose, children }: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void; children?: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-mute">{message}</div>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost btn-sm" onClick={onClose} aria-busy={busy} disabled={busy}>Cancel</button>
        <button className={`${danger ? 'btn-danger' : 'btn-primary'} btn-sm`} onClick={onConfirm} aria-busy={busy} disabled={busy}>{busy ? 'Working...' : confirmLabel}</button>
      </div>
    </Modal>
  );
}
