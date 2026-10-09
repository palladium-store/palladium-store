'use client';
import { useState } from 'react';
import { shortAddress } from '@/lib/chain-config';
import { useLiveWallet } from './live-wallet';

/**
 * The official $PALLADIUM contract address, in two rows, for the header: a label, then the address. Clicking copies it,
 * so customers never have to retype (or trust a copy from somewhere else). Full address on wide screens, shortened below.
 */
export function ContractAddress({ className = '' }: { className?: string }) {
  const { config } = useLiveWallet();
  const [copied, setCopied] = useState(false);
  const address = config.wallet.contract;
  if (!address) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={() => void copy()} title={`${address} (click to copy)`} aria-label={`Contract address ${address}. Copy`}
      className={`flex-col items-start justify-center px-2 text-left leading-tight transition hover:text-gold-deep ${className}`}>
      <span className="k-mono text-[9.5px] uppercase tracking-[0.16em] text-mute">{copied ? 'Copied' : 'Contract address'}</span>
      <span className="font-mono text-[11px] font-semibold text-ink">
        <span className="2xl:hidden">{shortAddress(address)}</span>
        <span className="hidden 2xl:inline">{address}</span>
      </span>
    </button>
  );
}
