'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  ZERO_ADDRESS, explorerAddressUrl, explorerTxUrl, formatUnits, isAddress, parseUnits, sameAddress, shortAddress, transferData,
} from '@/lib/chain-config';
import { encodeFunctionData, type Hex } from 'viem';
import { useLiveWallet, walletMessage } from './live-wallet';

/**
 * The /wallet page: balances, Send, Receive and Activity for the connected wallet, all read from Robinhood Chain.
 * Nothing here holds keys or signs on the customer's behalf: every transfer is signed in their own wallet, and a transfer
 * is shown as confirmed only once its receipt is mined with the required confirmations.
 */
export interface DashboardPrice { phpPerToken: string; fixed: boolean }

type Tab = 'buy' | 'send' | 'receive' | 'activity';

const php = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Display-only peso estimate. Never used for payments, which are priced on the server. */
function phpEstimate(units: bigint, decimals: number, price: DashboardPrice | null): string | null {
  if (!price) return null;
  const tokens = Number(formatUnits(units, decimals, 6).replace(/,/g, ''));
  const rate = Number(price.phpPerToken.replace(/,/g, ''));
  return Number.isFinite(tokens * rate) ? php(tokens * rate) : null;
}

function Copy({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="k-link !text-[11px]" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}>
      {done ? 'Copied' : label}
    </button>
  );
}

export function WalletDashboard({ price }: { price: DashboardPrice | null }) {
  const w = useLiveWallet();
  const [tab, setTab] = useState<Tab>('activity');
  const [activityKey, setActivityKey] = useState(0);
  const { chain, contract, decimals, symbol } = w.config.wallet;

  if (!w.ready) return <div className="card p-6 text-sm text-mute">Looking for a wallet...</div>;

  if (!w.hasWallet) {
    return (
      <div className="card max-w-2xl p-6">
        <p className="text-sm text-mute">No crypto wallet found in this browser. On a computer, install MetaMask or another EVM wallet and reload. On a phone, open this page inside your wallet app.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {w.deepLink && <a href={w.deepLink} className="btn-primary btn-sm">Open in MetaMask app</a>}
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Get MetaMask</a>
        </div>
      </div>
    );
  }

  if (!w.address) {
    return (
      <div className="card max-w-2xl p-6">
        <p className="text-sm text-mute">Connect your wallet to see your {symbol} balance, send and receive tokens, and view your activity on {chain.name}.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => void w.connect()} disabled={w.busy} aria-busy={w.busy}>{w.busy ? 'Check your wallet...' : 'Connect wallet'}</button>
        {w.error && <p className="mt-3 text-sm text-red-600" role="alert">{w.error}</p>}
        <p className="mt-4 text-xs text-mute">Connecting only shares your public address. Palladium never asks for your seed phrase or private key.</p>
      </div>
    );
  }

  const est = w.balance != null ? phpEstimate(w.balance, decimals, price) : null;
  const tabs: { id: Tab; label: string; off?: boolean }[] = [
    ...(w.config.sale && contract ? [{ id: 'buy' as Tab, label: 'Buy' }] : []),
    { id: 'send', label: 'Send', off: !contract },
    { id: 'receive', label: 'Receive' },
    { id: 'activity', label: 'Activity', off: !contract },
  ];

  return (
    <div className="space-y-6">
      {!w.onChain && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <span>Your wallet is on another network{w.chainId ? ` (chain ${w.chainId})` : ''}. Switch to {chain.name} to see balances and send.</span>
          <button type="button" className="btn-primary btn-sm" onClick={() => void w.switchNetwork()} disabled={w.busy} aria-busy={w.busy}>{w.busy ? 'Check your wallet...' : `Switch to ${chain.name}`}</button>
        </div>
      )}

      <section className="card grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]" aria-label="Balances">
        <div>
          <p className="label">{symbol} balance</p>
          {!contract ? (
            <p className="mt-2 text-sm text-mute">The token is not live yet. Your balance appears here once {symbol} launches on {chain.name}.</p>
          ) : (
            <>
              <p className="mt-2 font-display text-4xl tracking-tightest sm:text-5xl" aria-live="polite">{!w.onChain ? '—' : w.balance == null ? '...' : formatUnits(w.balance, decimals, 4)}</p>
              {est && w.onChain && <p className="mt-1 text-sm text-mute">About {est} <span className="text-xs">at ₱{price!.phpPerToken} per token{price!.fixed ? ', a fixed rate set by Palladium, not a market price' : ', an estimate'}</span></p>}
            </>
          )}
          <p className="mt-5 label">ETH for network fees</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{!w.onChain ? '—' : w.ethBalance == null ? '...' : `${formatUnits(w.ethBalance, 18, 6)} ETH`}</p>
          {w.onChain && w.ethBalance === 0n && <p className="mt-1 text-xs text-mute">Sending tokens needs a small amount of ETH on {chain.name} to pay the network fee.</p>}
        </div>
        <dl className="space-y-3 text-sm">
          <div><dt className="label">Wallet</dt><dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-mono" title={w.address}>{shortAddress(w.address)}</span>{w.walletName && <span className="text-xs text-mute">{w.walletName}</span>}<Copy text={w.address} /><a className="k-link !text-[11px]" href={explorerAddressUrl(chain, w.address)} target="_blank" rel="noopener noreferrer">Explorer</a></dd></div>
          <div><dt className="label">Network</dt><dd className="mt-1">{w.onChain ? chain.name : <span className="text-red-600">Wrong network</span>}</dd></div>
          {contract && <div><dt className="label">Token contract</dt><dd className="mt-1 flex flex-wrap items-center gap-x-3"><span className="font-mono">{shortAddress(contract)}</span><Copy text={contract} /></dd></div>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-outline btn-sm" onClick={() => void w.refreshBalance()} disabled={!w.onChain}>Refresh</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => void w.changeAccount()}>Change wallet</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => void w.disconnect()}>Disconnect</button>
          </div>
          {w.error && <p className="text-sm text-red-600" role="alert">{w.error}</p>}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Wallet actions">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-current={tab === t.id ? 'true' : undefined} disabled={t.off}
            className="k-tab disabled:opacity-40" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <Link href="/shop" className="k-tab">Pay</Link>
      </div>

      {tab === 'buy' && w.config.sale && contract && <BuyPanel onBought={() => setActivityKey((k) => k + 1)} />}
      {tab === 'send' && contract && <SendPanel onSent={() => setActivityKey((k) => k + 1)} />}
      {tab === 'receive' && <ReceivePanel />}
      {tab === 'activity' && contract && <ActivityPanel key={`${w.address}-${activityKey}`} price={price} />}
      <PendingTransfers onSettled={() => { void w.refreshBalance(); setActivityKey((k) => k + 1); }} />

      <section className="grid gap-px border border-line bg-line sm:grid-cols-3" aria-label="Coming next">
        {[
          ...(w.config.sale ? [] : [['Buy', `Buying ${symbol} on Palladium is not open yet.`]]),
          ['Rewards', `Earning ${symbol} on purchases is planned. Rewards will appear here once the program opens.`],
          ['Airdrops', 'Airdrop campaigns are planned. Any you are eligible for will appear here.'],
        ].map(([h, p]) => (
          <div key={h} className="bg-paper p-5"><p className="label">{h} · not open yet</p><p className="mt-2 text-sm text-mute">{p}</p></div>
        ))}
      </section>
    </div>
  );
}

/**
 * "Buy $PALLADIUM" on its own (the account page). Same purchase flow as the wallet page's Buy tab, with the connection
 * steps in front of it and an honest message while the sale is not open.
 */
export function BuyPalladium() {
  const w = useLiveWallet();
  const { chain, contract, decimals, symbol } = w.config.wallet;
  if (!w.config.sale || !contract) {
    return (
      <div className="card max-w-2xl p-6">
        <p className="label">Not open yet</p>
        <p className="mt-2 text-sm text-mute">Buying {symbol} on Palladium opens soon. When it does, you will be able to buy it here with ETH from your own wallet, and see the exact price, Palladium&apos;s spread and the exchange rate before you confirm.</p>
        <p className="mt-4 text-sm"><Link href="/wallet" className="underline underline-offset-4">Open your wallet</Link> to connect it and see your balance in the meantime.</p>
      </div>
    );
  }
  if (!w.ready) return <div className="card p-6 text-sm text-mute">Looking for a wallet...</div>;
  if (!w.hasWallet) {
    return (
      <div className="card max-w-2xl p-6">
        <p className="text-sm text-mute">To buy {symbol} you need a crypto wallet. On a computer, install MetaMask and reload this page. On a phone, open this page inside your wallet app.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {w.deepLink && <a href={w.deepLink} className="btn-primary btn-sm">Open in MetaMask app</a>}
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Get MetaMask</a>
        </div>
      </div>
    );
  }
  if (!w.address) {
    return (
      <div className="card max-w-2xl p-6">
        <p className="text-sm text-mute">Connect the wallet you want your {symbol} sent to. You pay with ETH on {chain.name} from that same wallet.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => void w.connect()} disabled={w.busy} aria-busy={w.busy}>{w.busy ? 'Check your wallet...' : 'Connect wallet'}</button>
        {w.error && <p className="mt-3 text-sm text-red-600" role="alert">{w.error}</p>}
        <p className="mt-4 text-xs text-mute">Connecting only shares your public address. Palladium never asks for your seed phrase or private key.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
        <span>
          <span className="font-mono" title={w.address}>{shortAddress(w.address)}</span>{w.walletName && <span className="text-mute"> · {w.walletName}</span>}
          {w.onChain && <span className="block text-mute">{w.balance != null ? `${formatUnits(w.balance, decimals, 4)} ${symbol}` : '...'} · {w.ethBalance != null ? `${formatUnits(w.ethBalance, 18, 6)} ETH` : '...'}</span>}
        </span>
        <span className="flex gap-2">
          {!w.onChain && <button type="button" className="btn-primary btn-sm" onClick={() => void w.switchNetwork()} disabled={w.busy} aria-busy={w.busy}>{w.busy ? 'Check your wallet...' : `Switch to ${chain.name}`}</button>}
          <button type="button" className="btn-outline btn-sm" onClick={() => void w.changeAccount()}>Change wallet</button>
        </span>
      </div>
      {w.error && <p className="text-sm text-red-600" role="alert">{w.error}</p>}
      {w.onChain
        ? <BuyPanel onBought={() => void w.refreshBalance()} />
        : <p className="text-sm text-mute">Your wallet is on another network. Switch to {chain.name} to buy.</p>}
      <PendingTransfers onSettled={() => void w.refreshBalance()} />
    </div>
  );
}

// ---------------- Buy (sale contract; the server only signs a short-lived quote) ----------------

interface QuoteResp {
  contract: string; chainId: number; buyer: string; tokenAmount: string; weiAmount: string; deadline: number; quoteId: Hex; signature: Hex;
  breakdown: { phpAmount: string; referencePricePhp: string; spreadPct: number; unitPricePhp: string; tokens: string; eth: string; ethPhp: string; rateSources: string[]; priceLabel: string; expiresAt: number };
}
const BUY_ABI = [{ type: 'function', name: 'buy', stateMutability: 'payable', outputs: [], inputs: [
  { name: 'tokenAmount', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'quoteId', type: 'bytes32' }, { name: 'signature', type: 'bytes' },
] }] as const;

function BuyPanel({ onBought }: { onBought: () => void }) {
  const w = useLiveWallet();
  const { chain, symbol } = w.config.wallet;
  const sale = w.config.sale!;
  const [phpText, setPhpText] = useState('');
  const [quote, setQuote] = useState<QuoteResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);

  useEffect(() => { if (!quote) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [quote]);
  const left = quote ? Math.max(0, Math.floor((quote.breakdown.expiresAt - now) / 1000)) : 0;

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!w.onChain) { setErr(`Switch your wallet to ${chain.name} first.`); return; }
    const php = Number(phpText.replace(/,/g, ''));
    if (!Number.isFinite(php) || php <= 0) { setErr('Enter how many pesos you want to spend.'); return; }
    setWorking(true);
    try {
      const r = await fetch('/api/token/sale/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: w.address, phpAmount: php }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Could not get a price.');
      setQuote(j as QuoteResp); setNow(Date.now());
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not get a price.'); }
    finally { setWorking(false); }
  }

  async function confirm() {
    if (!quote || busyRef.current) return;
    // The quote is bound to this wallet, network and contract. If anything changed, get a new one.
    if (left < 5) { setErr('This price expired. Get a new one.'); return; }
    if (!w.address || !sameAddress(quote.buyer, w.address)) { setErr('Your wallet account changed. Get a new price for this account.'); return; }
    if (quote.chainId !== chain.chainId || !sameAddress(quote.contract, sale.contract)) { setErr('This price is for a different network. Get a new one.'); return; }
    busyRef.current = true; setWorking(true); setErr(null);
    try {
      const value = BigInt(quote.weiAmount);
      const data = encodeFunctionData({ abi: BUY_ABI, functionName: 'buy', args: [BigInt(quote.tokenAmount), BigInt(quote.deadline), quote.quoteId, quote.signature] });
      let fee = 0n;
      try {
        const [gas, gasPrice] = await Promise.all([w.read<string>('eth_estimateGas', [{ from: w.address, to: sale.contract, data, value: `0x${value.toString(16)}` }]), w.read<string>('eth_gasPrice', [])]);
        fee = BigInt(gas) * BigInt(gasPrice);
      } catch {
        throw new Error('The sale contract would refuse this purchase right now (sold out, paused or the price expired). Nothing was charged. Get a new price.');
      }
      if (w.ethBalance != null && w.ethBalance < value + fee) throw new Error(`You need ${formatUnits(value + fee, 18, 8)} ETH (price plus network fee) and have ${formatUnits(w.ethBalance, 18, 8)} ETH.`);
      const hash = await w.sendContractCall(sale.contract, data, value);
      addPending({ hash: hash.toLowerCase(), to: sale.contract, amount: quote.tokenAmount, at: Date.now(), label: `Buying ${quote.breakdown.tokens} ${symbol}` }, chain.chainId, w.address);
      setQuote(null); setPhpText('');
      onBought();
    } catch (e) { setErr(e instanceof Error ? e.message : walletMessage(e)); }
    finally { busyRef.current = false; setWorking(false); }
  }

  if (quote) {
    const b = quote.breakdown;
    const rows: [string, React.ReactNode][] = [
      ['You spend', `₱${Number(b.phpAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
      ['Reference price', <span key="r">₱{b.referencePricePhp} per token <span className="text-xs text-mute">({b.priceLabel})</span></span>],
      ['Palladium spread', `${b.spreadPct}%`],
      ['Your price', `₱${b.unitPricePhp} per token`],
      ['You receive', <b key="t">{b.tokens} {symbol}</b>],
      ['You pay', <span key="e">{b.eth} ETH <span className="text-xs text-mute">at ₱{b.ethPhp} per ETH ({b.rateSources.join(' and ')})</span></span>],
      ['Network fee', 'a small amount of ETH, shown in your wallet'],
      ['Price valid for', left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : <span key="x" className="text-red-600">expired</span>],
    ];
    return (
      <section className="card max-w-2xl p-6" aria-label="Review purchase">
        <h2 className="k-h3 text-2xl">Check your purchase</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
          {rows.map(([k, v]) => <div key={k} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="label">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <p className="mt-4 text-xs text-mute">The tokens come from Palladium&apos;s sale contract on {chain.name} in the same transaction as your payment: you either get the tokens or keep your ETH. Blockchain transactions cannot be reversed. The value of {symbol} can go down; buy only what you are comfortable holding.</p>
        {err && <p className="mt-3 text-sm text-red-600" role="alert">{err}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {left > 0
            ? <button type="button" className="btn-primary" onClick={() => void confirm()} disabled={working} aria-busy={working}>{working ? 'Confirm in your wallet...' : `Buy ${b.tokens} ${symbol}`}</button>
            : <button type="button" className="btn-primary" onClick={() => { setQuote(null); setErr(null); }}>Get a new price</button>}
          <button type="button" className="btn-outline" onClick={() => { setQuote(null); setErr(null); }} disabled={working}>Back</button>
        </div>
      </section>
    );
  }

  return (
    <form className="card max-w-2xl space-y-4 p-6" onSubmit={(e) => void getQuote(e)} noValidate aria-label={`Buy ${symbol}`}>
      <div>
        <label className="label" htmlFor="buy-php">Amount to spend (₱)</label>
        <input id="buy-php" className="input" inputMode="decimal" placeholder="1,000" autoComplete="off" value={phpText} onChange={(e) => setPhpText(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      <button type="submit" className="btn-primary" disabled={working || !w.onChain} aria-busy={working}>{working ? 'Getting a price...' : 'See price'}</button>
      <p className="text-xs text-mute">You pay in ETH on {chain.name} from your own wallet. You will see the exact amounts, Palladium&apos;s spread and the exchange rate before you confirm.</p>
    </form>
  );
}

// ---------------- Send ----------------

interface Draft { to: string; amount: bigint; fee: bigint | null }

function SendPanel({ onSent }: { onSent: () => void }) {
  const w = useLiveWallet();
  const { chain, contract, decimals, symbol } = w.config.wallet;
  const [to, setTo] = useState('');
  const [amountText, setAmountText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [review, setReview] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const busyRef = useRef(false);

  const check = (): { to: string; amount: bigint } | string => {
    const t = to.trim();
    if (!isAddress(t)) return 'Enter a wallet address that starts with 0x and has 42 characters.';
    if (sameAddress(t, ZERO_ADDRESS)) return 'That address burns tokens. Choose another one.';
    if (contract && sameAddress(t, contract)) return 'That is the token contract itself. Tokens sent there are lost.';
    if (w.address && sameAddress(t, w.address)) return 'That is your own wallet.';
    const amount = parseUnits(amountText, decimals);
    if (amount == null || amount <= 0n) return `Enter an amount of ${symbol}, for example 25 or 12.5.`;
    if (w.balance != null && amount > w.balance) return `You have ${formatUnits(w.balance, decimals, 6)} ${symbol}.`;
    return { to: t, amount };
  };

  async function toReview(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!w.onChain) { setErr(`Switch your wallet to ${chain.name} first.`); return; }
    const c = check();
    if (typeof c === 'string') { setErr(c); return; }
    setWorking(true);
    let fee: bigint | null = null;
    try {
      const data = transferData(c.to, c.amount);
      const [gas, gasPrice] = await Promise.all([
        w.read<string>('eth_estimateGas', [{ from: w.address, to: contract, data, value: '0x0' }]),
        w.read<string>('eth_gasPrice', []),
      ]);
      fee = BigInt(gas) * BigInt(gasPrice);
    } catch (e2) {
      setWorking(false);
      setErr(/exceeds balance|insufficient/i.test(String((e2 as Error)?.message)) ? `Your wallet does not hold enough ${symbol} for this transfer.` : 'This transfer would fail on the blockchain, so it was not sent. Check the address and amount.');
      return;
    }
    setWorking(false);
    if (w.ethBalance != null && fee != null && w.ethBalance < fee) { setErr(`You need about ${formatUnits(fee, 18, 10)} ETH on ${chain.name} for the network fee and have ${formatUnits(w.ethBalance, 18, 10)} ETH.`); return; }
    setReview({ ...c, fee });
  }

  async function confirm() {
    if (!review || busyRef.current) return;
    busyRef.current = true; setWorking(true); setErr(null);
    try {
      const hash = await w.sendTransfer(review.to, review.amount);
      addPending({ hash: hash.toLowerCase(), to: review.to, amount: review.amount.toString(), at: Date.now() }, chain.chainId, w.address!);
      setReview(null); setTo(''); setAmountText('');
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : walletMessage(e));
    } finally { busyRef.current = false; setWorking(false); }
  }

  if (review) {
    const isPalladium = w.config.paymentWallet && sameAddress(review.to, w.config.paymentWallet);
    return (
      <section className="card max-w-2xl p-6" aria-label="Review transfer">
        <h2 className="k-h3 text-2xl">Check before you send</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
          {[
            ['To', <span key="to" className="break-all font-mono text-xs">{review.to}</span>],
            ['Amount', `${formatUnits(review.amount, decimals, 6)} ${symbol}`],
            ['Network', `${chain.name} (chain ${chain.chainId})`],
            ['Token contract', <span key="c" className="break-all font-mono text-xs">{contract}</span>],
            ['Network fee', review.fee != null ? `about ${formatUnits(review.fee, 18, 8)} ETH, paid from your wallet` : 'shown in your wallet'],
          ].map(([k, v]) => <div key={String(k)} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]"><dt className="label">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {isPalladium && <p className="mt-4 border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">This is Palladium&apos;s payment wallet. To pay for an order, use &quot;Pay with {symbol}&quot; at checkout: a direct transfer is not linked to any order.</p>}
        <p className="mt-4 text-xs text-mute">Blockchain transfers cannot be reversed. Make sure the address belongs to the person you are paying.</p>
        {err && <p className="mt-3 text-sm text-red-600" role="alert">{err}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void confirm()} disabled={working} aria-busy={working}>{working ? 'Confirm in your wallet...' : `Send ${formatUnits(review.amount, decimals, 6)} ${symbol}`}</button>
          <button type="button" className="btn-outline" onClick={() => { setReview(null); setErr(null); }} disabled={working}>Back</button>
        </div>
      </section>
    );
  }

  return (
    <form className="card max-w-2xl space-y-4 p-6" onSubmit={(e) => void toReview(e)} noValidate aria-label={`Send ${symbol}`}>
      <div>
        <label className="label" htmlFor="send-to">Recipient wallet address</label>
        <input id="send-to" className="input font-mono" placeholder="0x..." autoComplete="off" spellCheck={false} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="send-amount">Amount ({symbol})</label>
          {w.balance != null && <button type="button" className="k-link !text-[11px]" onClick={() => setAmountText(formatUnits(w.balance!, decimals, decimals).replace(/,/g, ''))}>Max {formatUnits(w.balance, decimals, 4)}</button>}
        </div>
        <input id="send-amount" className="input" inputMode="decimal" placeholder="0.00" autoComplete="off" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      <button type="submit" className="btn-primary" disabled={working || !w.onChain} aria-busy={working}>{working ? 'Checking...' : 'Review transfer'}</button>
      <p className="text-xs text-mute">You will see the fee and confirm in your own wallet. Palladium never holds your tokens or keys.</p>
    </form>
  );
}

// ---------------- Pending transfers (survive reloads; the chain decides the outcome) ----------------

interface Pending { hash: string; to: string; amount: string; at: number; /** Shown instead of "amount to address", e.g. for purchases. */ label?: string }
const pendingKey = (chainId: number, address: string) => `pal-pending:${chainId}:${address.toLowerCase()}`;
function readPending(chainId: number, address: string): Pending[] {
  try { const v = JSON.parse(localStorage.getItem(pendingKey(chainId, address)) ?? '[]'); return Array.isArray(v) ? v.filter((p) => typeof p?.hash === 'string') : []; } catch { return []; }
}
function writePending(chainId: number, address: string, list: Pending[]) {
  try { localStorage.setItem(pendingKey(chainId, address), JSON.stringify(list.slice(-20))); window.dispatchEvent(new Event('pal-pending')); } catch { /* storage unavailable */ }
}
function addPending(p: Pending, chainId: number, address: string) { writePending(chainId, address, [...readPending(chainId, address).filter((x) => x.hash !== p.hash), p]); }

type TxState = { kind: 'submitted' } | { kind: 'confirming'; have: number } | { kind: 'confirmed' } | { kind: 'failed' };

function PendingTransfers({ onSettled }: { onSettled: () => void }) {
  const w = useLiveWallet();
  const { chain, decimals, symbol } = w.config.wallet;
  const need = w.config.confirmations;
  const [list, setList] = useState<Pending[]>([]);
  const [states, setStates] = useState<Record<string, TxState>>({});
  const settledRef = useRef(onSettled); settledRef.current = onSettled;
  const wRef = useRef(w); wRef.current = w;
  const statesRef = useRef(states); statesRef.current = states;

  useEffect(() => {
    if (!w.address) return;
    const load = () => setList(readPending(chain.chainId, w.address!));
    load();
    window.addEventListener('pal-pending', load);
    return () => window.removeEventListener('pal-pending', load);
  }, [w.address, chain.chainId]);

  const poll = useCallback(async () => {
    const w = wRef.current;
    if (!w.address || !w.onChain || !list.length) return;
    let latest: bigint;
    try { latest = BigInt(await w.read<string>('eth_blockNumber', [])); } catch { return; }
    const next: Record<string, TxState> = {};
    let settled = false;
    for (const p of list) {
      try {
        const r = await w.read<{ status: string; blockNumber: string } | null>('eth_getTransactionReceipt', [p.hash]);
        if (!r || !r.blockNumber) { next[p.hash] = { kind: 'submitted' }; continue; }
        if (BigInt(r.status) !== 1n) { next[p.hash] = { kind: 'failed' }; settled = true; continue; }
        const have = Number(latest - BigInt(r.blockNumber) + 1n);
        if (have >= need) { next[p.hash] = { kind: 'confirmed' }; settled = true; } else next[p.hash] = { kind: 'confirming', have };
      } catch { next[p.hash] = statesRef.current[p.hash] ?? { kind: 'submitted' }; }
    }
    setStates(next);
    if (settled) {
      // Finished transfers leave local storage; they now live in the on-chain activity list.
      writePending(chain.chainId, w.address, list.filter((p) => { const s = next[p.hash]; return !(s?.kind === 'confirmed' || s?.kind === 'failed') || Date.now() - p.at < 60_000; }));
      settledRef.current();
    }
  }, [list, need, chain.chainId]);

  useEffect(() => {
    if (!list.length || !w.onChain) return;
    void poll();
    const t = setInterval(() => void poll(), 3000);
    return () => clearInterval(t);
  }, [list, poll, w.onChain]);

  if (!list.length) return null;
  return (
    <section className="card p-5" aria-live="polite" aria-label="Transfers in progress">
      <p className="label">Your recent transfers</p>
      <ul className="mt-3 divide-y divide-line">
        {list.slice().reverse().map((p) => {
          const s = states[p.hash] ?? { kind: 'submitted' as const };
          const slow = s.kind === 'submitted' && Date.now() - p.at > 20 * 60_000;
          return (
            <li key={p.hash} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>{p.label ?? <>{formatUnits(BigInt(p.amount), decimals, 6)} {symbol} to <span className="font-mono">{shortAddress(p.to)}</span></>}</span>
              <span className="flex items-center gap-3">
                <span className={s.kind === 'confirmed' ? 'text-emerald-700' : s.kind === 'failed' ? 'text-red-600' : 'text-mute'}>
                  {s.kind === 'submitted' ? (slow ? 'Not mined yet. Check the explorer' : 'Waiting for the network...') : s.kind === 'confirming' ? `Confirming ${s.have}/${need}` : s.kind === 'confirmed' ? 'Confirmed' : 'Failed. Nothing was sent'}
                </span>
                <a className="k-link !text-[11px]" href={explorerTxUrl(chain, p.hash)} target="_blank" rel="noopener noreferrer">View</a>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------- Receive ----------------

function ReceivePanel() {
  const w = useLiveWallet();
  const { chain, contract, symbol } = w.config.wallet;
  const [svg, setSvg] = useState<string | null>(null);
  const address = w.address!;

  useEffect(() => {
    let live = true;
    if (!isAddress(address)) return;
    void import('qrcode').then((QR) => QR.toString(address, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } }))
      .then((s) => { if (live) setSvg(s); }).catch(() => setSvg(null));
    return () => { live = false; };
  }, [address]);

  return (
    <section className="card grid max-w-3xl gap-6 p-6 sm:grid-cols-[13rem_1fr]" aria-label={`Receive ${symbol}`}>
      <div className="plate aspect-square w-52 max-w-full p-2">
        {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={`QR code of your wallet address ${address}`} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="flex h-full items-center justify-center text-xs text-mute">QR code</div>}
      </div>
      <div className="min-w-0 space-y-4 text-sm">
        <div><p className="label">Your address</p><p className="mt-1 break-all font-mono text-xs">{address}</p><div className="mt-2"><Copy text={address} label="Copy address" /></div></div>
        <div><p className="label">Network</p><p className="mt-1">{chain.name} (chain {chain.chainId})</p></div>
        <div><p className="label">Token</p><p className="mt-1">{symbol}{contract ? <> · <span className="font-mono text-xs">{shortAddress(contract)}</span> <Copy text={contract} /></> : <span className="text-mute"> · not live yet</span>}</p></div>
        <p className="text-xs text-mute">Only send {symbol} or ETH on {chain.name} to this address. Tokens sent on another network can be lost. Incoming transfers show in Activity once the network confirms them.</p>
      </div>
    </section>
  );
}

// ---------------- Activity (from the blockchain via /api/wallet/activity) ----------------

interface Entry { hash: string; logIndex: number; block: number; time: number | null; kind: 'received' | 'sent' | 'paid-palladium' | 'from-palladium' | 'bought' | 'self'; counterparty: string; amount: string; confirmations: number }
interface ActivityResponse { configured: boolean; entries: Entry[]; decimals: number; symbol: string; confirmationsRequired: number; partial: boolean }
const KIND: Record<Entry['kind'], string> = { bought: 'Bought', received: 'Received', sent: 'Sent', 'paid-palladium': 'Paid Palladium', 'from-palladium': 'From Palladium', self: 'To yourself' };

function ActivityPanel({ price }: { price: DashboardPrice | null }) {
  const w = useLiveWallet();
  const { toast } = useToast();
  const { chain } = w.config.wallet;
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);
  const wRef = useRef(w); wRef.current = w;
  const toastRef = useRef(toast); toastRef.current = toast;
  const address = w.address;

  const load = useCallback(async () => {
    if (!address) return;
    try {
      const r = await fetch(`/api/wallet/activity?address=${address}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Could not load activity.');
      const d = j as ActivityResponse;
      setData(d); setErr(null);
      // Tell the customer about tokens that arrived while the page was open (only confirmed ones).
      const ids = new Set(d.entries.map((e) => `${e.hash}:${e.logIndex}`));
      if (known.current) {
        for (const e of d.entries) {
          if (!known.current.has(`${e.hash}:${e.logIndex}`) && (e.kind === 'received' || e.kind === 'from-palladium' || e.kind === 'bought') && e.confirmations >= d.confirmationsRequired) {
            toastRef.current(`Received ${formatUnits(BigInt(e.amount), d.decimals, 6)} ${d.symbol}`);
            void wRef.current.refreshBalance();
          }
        }
      }
      known.current = ids;
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load activity.'); }
  }, [address]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (err && !data) return <div className="card p-6 text-sm text-mute">{err} <button type="button" className="k-link" onClick={() => void load()}>Try again</button></div>;
  if (!data) return <div className="card p-6 text-sm text-mute">Reading your activity from {chain.name}...</div>;
  if (!data.entries.length) return <div className="card p-6 text-sm text-mute">No {data.symbol} transfers yet for this wallet.</div>;

  return (
    <section className="table-wrap card overflow-x-auto p-0" aria-label="Activity">
      <table className="tbl w-full min-w-[40rem] text-sm">
        <thead><tr><th>Type</th><th>Date</th><th className="text-right">Amount</th><th>With</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data.entries.map((e) => {
            const out = e.kind === 'sent' || e.kind === 'paid-palladium';
            const amt = formatUnits(BigInt(e.amount), data.decimals, 6);
            const est = phpEstimate(BigInt(e.amount), data.decimals, price);
            return (
              <tr key={`${e.hash}:${e.logIndex}`}>
                <td className="font-medium">{KIND[e.kind]}</td>
                <td className="whitespace-nowrap text-mute">{e.time ? new Date(e.time * 1000).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : `Block ${e.block.toLocaleString('en-PH')}`}</td>
                <td className={`whitespace-nowrap text-right tabular-nums ${out ? '' : 'text-emerald-700'}`}>{out ? '−' : '+'}{amt} {data.symbol}{est && <span className="block text-[11px] text-mute">about {est}</span>}</td>
                <td className="font-mono text-xs">{shortAddress(e.counterparty)}</td>
                <td className="whitespace-nowrap">{e.confirmations >= data.confirmationsRequired ? <span className="text-emerald-700">Confirmed</span> : <span className="text-mute">Confirming {e.confirmations}/{data.confirmationsRequired}</span>}</td>
                <td><a className="k-link !text-[11px]" href={explorerTxUrl(chain, e.hash)} target="_blank" rel="noopener noreferrer">View</a></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.partial && <p className="border-t border-line px-4 py-3 text-xs text-mute">Showing recent activity. <a className="underline underline-offset-4" href={`${explorerAddressUrl(chain, w.address!)}?tab=token_transfers`} target="_blank" rel="noopener noreferrer">Full history on the explorer</a>.</p>}
    </section>
  );
}
