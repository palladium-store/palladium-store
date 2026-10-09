'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { encodeDeployData, encodeFunctionData, type Abi, type Hex } from 'viem';
import { api } from '@/components/ui/api-client';
import { explorerAddressUrl, explorerTxUrl, isAddress, parseUnits, sameAddress, shortAddress, transferData, type ChainPreset } from '@/lib/chain-config';
import { parsePrice } from '@/lib/token-math';
import type { SaleOverview } from '@/lib/palladium/sale-admin';
import type { TokenSaleSettings } from '@/lib/settings';
import { useLiveWallet } from '@/components/store/palladium/live-wallet';
import artifact from '@/lib/palladium/sale-artifact.json';

/**
 * Admin > Token. Settings are saved by the server (audited). Contract actions (deploy, fund, pause, withdraw, limits) are
 * signed by the owner's own wallet in the browser: the store never holds a key that can move tokens or ETH.
 */
const ABI = artifact.abi as Abi;
const chainOf = (o: SaleOverview): ChainPreset => ({ chainId: o.chainId, name: o.network, explorerUrl: o.explorerUrl, rpcUrl: '', testnet: o.chainId !== 4663 });

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-2.5 text-sm">
      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'border border-line'}`} aria-hidden="true" />
      <span><span className={ok ? '' : 'text-mute'}>{label}</span>{detail && <span className="block text-xs text-mute">{detail}</span>}</span>
      <span className="sr-only">{ok ? 'done' : 'not done'}</span>
    </li>
  );
}

export function TokenAdmin({ o }: { o: SaleOverview }) {
  const s = o.state;
  const chain = chainOf(o);
  const signerMatches = !!s && !!o.signerAddress && sameAddress(s.quoteSigner, o.signerAddress);
  const tokenMatches = !!s && !!o.token && sameAddress(s.token, o.token);
  const hasInventory = !!s && Number(s.inventory.replace(/,/g, '')) > 0;
  const open = !!o.token && !!o.price && !!o.ethPhp && !!o.signerAddress && !!s && signerMatches && tokenMatches && hasInventory && !s.paused && o.masterSwitch && o.settings.saleEnabled;
  const p = o.payments;
  return (
    <div className="space-y-8">
      <section className="card p-5" aria-label="Checkout payments">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="k-h3 text-xl">Pay with {o.symbol} at checkout</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.live ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}>{p.live ? 'Customers can pay' : 'Off'}</span>
        </div>
        <ul className="mt-3 divide-y divide-line">
          <Check ok={!!o.token} label={`Token contract on ${o.network}`} detail={o.token ?? 'Not set.'} />
          <Check ok={!!p.wallet} label="Palladium payment wallet" detail={p.wallet ? <a className="underline" href={explorerAddressUrl(chain, p.wallet)} target="_blank" rel="noopener noreferrer">{p.wallet}</a> : 'Set PALLADIUM_PAYMENT_WALLET_ADDRESS in Vercel: the wallet customers pay into. A multisig wallet you control is safest. The store never needs its key.'} />
          <Check ok={!!o.price} label="Token price" detail={o.price ? `₱${o.price.php} per token (${o.price.label}). Product prices stay in pesos; customers pay the matching amount of ${o.symbol}.` : `${o.priceProblem ?? ''} Use TOKEN_PRICE_SOURCE=admin in Vercel and set the price below.`} />
          <Check ok={p.masterSwitch} label="Master switch" detail={p.masterSwitch ? 'TOKEN_CHECKOUT_ENABLED=true' : 'Set TOKEN_CHECKOUT_ENABLED=true in Vercel.'} />
          <Check ok={o.settings.paymentsEnabled} label="Payments switched on below" detail="Untick it to stop token payments immediately, without a redeploy." />
        </ul>
        <p className="mt-3 text-xs text-mute">An order is marked paid only after the server reads the transfer on {o.network}: right token, Palladium&apos;s wallet, at least the locked amount, {p.confirmations} confirmations, made after the order was placed. A transaction can pay one order only. Anything unusual (underpaid, too early or too late) waits for you under Orders.</p>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="k-h3 text-xl">Sale status</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${open ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}>{open ? 'Customers can buy' : 'Closed'}</span>
        </div>
        <ul className="mt-3 divide-y divide-line">
          <Check ok={!!o.token} label={`Token contract on ${o.network}`} detail={o.token ? <a className="underline" href={`${o.explorerUrl}/token/${o.token}`} target="_blank" rel="noopener noreferrer">{o.token}</a> : 'Set TOKEN_CONTRACT_ADDRESS in Vercel.'} />
          <Check ok={!!o.price} label="Reference price" detail={o.price ? `₱${o.price.php} per token (${o.price.label})` : `${o.priceProblem ?? ''} To set it here, use TOKEN_PRICE_SOURCE=admin in Vercel and fill in the price below.`} />
          <Check ok={!!o.ethPhp} label="ETH exchange rate" detail={o.ethPhp ? `₱${o.ethPhp.rate} per ETH from ${o.ethPhp.sources.join(' and ')}` : 'CoinGecko and Coinbase could not be reached or disagree. Buying pauses until they agree.'} />
          <Check ok={!!o.signerAddress} label="Quote-signing key" detail={o.signerAddress ? `Signs as ${o.signerAddress}` : 'Set TOKEN_SALE_SIGNER_KEY in Vercel (see docs/TOKEN-SALE.md).'} />
          <Check ok={!!s} label="Sale contract deployed" detail={o.saleContract ? (o.stateError ?? <a className="underline" href={explorerAddressUrl(chain, o.saleContract)} target="_blank" rel="noopener noreferrer">{o.saleContract}</a>) : 'Deploy it below, then set TOKEN_SALE_CONTRACT_ADDRESS in Vercel.'} />
          {s && <Check ok={signerMatches && tokenMatches} label="Contract matches this store" detail={!tokenMatches ? 'It sells a different token.' : !signerMatches ? `It trusts ${s.quoteSigner}, not this store's key. Use "Set signing key" below.` : 'Same token and signing key.'} />}
          {s && <Check ok={hasInventory} label="Tokens for sale in the contract" detail={`${s.inventory} ${o.symbol}`} />}
          {s && <Check ok={!s.paused} label="Contract unpaused" />}
          <Check ok={o.masterSwitch} label="Master switch" detail={o.masterSwitch ? 'TOKEN_SALE_ENABLED=true' : 'Set TOKEN_SALE_ENABLED=true in Vercel only after legal review.'} />
          <Check ok={o.settings.saleEnabled} label="Sale switched on below" />
        </ul>
      </section>

      <SettingsForm initial={o.settings} symbol={o.symbol} />
      {o.saleContract && s ? <ContractPanel o={o} /> : o.token && o.signerAddress ? <DeployPanel o={o} /> : null}

      {o.totals && (
        <section className="card p-5">
          <h2 className="k-h3 text-xl">Purchases</h2>
          <p className="mt-1 text-sm text-mute">{o.totals.count} purchases · {o.totals.tokens} {o.symbol} sold · {o.totals.eth} ETH received by the treasury. Read from the blockchain.</p>
          {o.purchases.length > 0 && (
            <div className="table-wrap mt-4 overflow-x-auto"><table className="tbl w-full min-w-[36rem] text-sm">
              <thead><tr><th>Buyer</th><th className="text-right">{o.symbol}</th><th className="text-right">ETH</th><th>Block</th><th /></tr></thead>
              <tbody>{o.purchases.map((p) => (
                <tr key={p.hash}><td className="font-mono text-xs">{shortAddress(p.buyer)}</td><td className="text-right tabular-nums">{p.tokens}</td><td className="text-right tabular-nums">{p.eth}</td><td className="tabular-nums">{p.block.toLocaleString('en-PH')}</td><td><a className="k-link !text-[11px]" href={explorerTxUrl(chain, p.hash)} target="_blank" rel="noopener noreferrer">View</a></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}
      <p className="text-xs text-mute">Contract source: contracts/contracts/PalladiumTokenSale.sol (sha256 {o.artifact.sourceSha256.slice(0, 16)}…, {o.artifact.compiler}).</p>
    </div>
  );
}

function SettingsForm({ initial, symbol }: { initial: TokenSaleSettings; symbol: string }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TokenSaleSettings>(k: K, v: TokenSaleSettings[K]) => setF((x) => ({ ...x, [k]: v }));
  const unit = (() => { try { return f.referencePricePhp ? Number(f.referencePricePhp) * (1 + f.spreadPct / 100) : null; } catch { return null; } })();
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await api('/api/admin/token/settings', { method: 'PUT', body: f }); setMsg({ ok: true, text: 'Saved.' }); router.refresh(); }
    catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' }); }
    finally { setBusy(false); }
  }
  const num = (k: 'spreadPct' | 'minPurchasePhp' | 'maxPurchasePhp' | 'quoteTtlSeconds', label: string, step = '1') => (
    <div><label className="label" htmlFor={`ts-${k}`}>{label}</label><input id={`ts-${k}`} className="input" type="number" step={step} value={f[k]} onChange={(e) => set(k, Number(e.target.value))} /></div>
  );
  return (
    <form className="card space-y-4 p-5" onSubmit={(e) => void save(e)} aria-label="Sale settings">
      <h2 className="k-h3 text-xl">Settings</h2>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={f.paymentsEnabled} onChange={(e) => set('paymentsEnabled', e.target.checked)} /> Payments switched on: customers can pay for orders with {symbol}</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={f.saleEnabled} onChange={(e) => set('saleEnabled', e.target.checked)} /> Sale switched on: customers can buy {symbol} (the master switch and the contract must also allow it)</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="ts-ref">Reference price (₱ per token)</label><input id="ts-ref" className="input" inputMode="decimal" placeholder="2.00" value={f.referencePricePhp} onChange={(e) => set('referencePricePhp', e.target.value)} /><p className="mt-1 text-xs text-mute">A fixed rate you set, shown to customers as such. Checkout payments use it as is; the sale adds the spread.</p></div>
        {num('spreadPct', 'Buy spread (%)', '0.1')}
        {num('minPurchasePhp', 'Smallest purchase (₱)')}
        {num('maxPurchasePhp', 'Largest purchase (₱)')}
        {num('quoteTtlSeconds', 'Price valid for (seconds)')}
      </div>
      {unit != null && Number.isFinite(unit) && <p className="text-sm text-mute">Customers pay ₱{unit.toFixed(4)} per {symbol}. Example: ₱1,000 buys {(1000 / unit).toLocaleString('en-PH', { maximumFractionDigits: 4 })} {symbol}.</p>}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <button type="submit" className="btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Saving...' : 'Save settings'}</button>
    </form>
  );
}

/** Sends one owner transaction from the connected wallet and waits for it to be mined. */
function useOwnerTx() {
  const w = useLiveWallet();
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean; hash: string | null }>({ busy: false, msg: null, ok: false, hash: null });
  async function run(label: string, to: string | null, data: string, value = 0n): Promise<{ contractAddress: string | null } | null> {
    if (!w.address) { setState({ busy: false, ok: false, msg: 'Connect the owner wallet first.', hash: null }); return null; }
    setState({ busy: true, ok: false, msg: `${label}: confirm in your wallet...`, hash: null });
    try {
      const hash = await w.sendContractCall(to, data, value);
      setState({ busy: true, ok: false, msg: `${label}: waiting for the network...`, hash });
      for (let i = 0; i < 120; i++) {
        const r = await w.read<{ status: string; contractAddress: string | null } | null>('eth_getTransactionReceipt', [hash]);
        if (r) {
          const ok = BigInt(r.status) === 1n;
          setState({ busy: false, ok, msg: ok ? `${label}: done.` : `${label}: the transaction failed on the blockchain.`, hash });
          return ok ? { contractAddress: r.contractAddress } : null;
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
      setState({ busy: false, ok: false, msg: `${label}: still not mined. Check the explorer.`, hash });
    } catch (e) { setState({ busy: false, ok: false, msg: e instanceof Error ? e.message : 'The wallet refused.', hash: null }); }
    return null;
  }
  return { ...state, run, w };
}

function TxStatus({ t, chain }: { t: ReturnType<typeof useOwnerTx>; chain: ChainPreset }) {
  if (!t.msg) return null;
  return <p className={`text-sm ${t.ok ? 'text-emerald-700' : t.busy ? 'text-mute' : 'text-red-600'}`} role="status">{t.msg} {t.hash && <a className="underline" href={explorerTxUrl(chain, t.hash)} target="_blank" rel="noopener noreferrer">View</a>}</p>;
}

function WalletGate({ owner, chain, children }: { owner: string | null; chain: ChainPreset; children: React.ReactNode }) {
  const w = useLiveWallet();
  if (!w.address) return <button type="button" className="btn-primary btn-sm" onClick={() => void w.connect()}>Connect the owner wallet</button>;
  if (!w.onChain) return <button type="button" className="btn-primary btn-sm" onClick={() => void w.switchNetwork()}>Switch wallet to {chain.name}</button>;
  if (owner && !sameAddress(owner, w.address)) return <p className="text-sm text-mute">Connected as {shortAddress(w.address)}. Contract actions need the owner wallet {shortAddress(owner)}. <button type="button" className="underline" onClick={() => void w.changeAccount()}>Change wallet</button></p>;
  return <>{children}</>;
}

/** Converts a PHP-per-token floor to wei per whole token at the current ETH rate. */
const floorWei = (floorPhp: string, ethPhp: string | undefined): bigint | null => {
  try { if (!ethPhp) return null; const v = (parsePrice(floorPhp) * 10n ** 18n) / parsePrice(ethPhp.replace(/,/g, '')); return v > 0n ? v : null; } catch { return null; }
};

function ContractPanel({ o }: { o: SaleOverview }) {
  const s = o.state!;
  const chain = chainOf(o);
  const router = useRouter();
  const t = useOwnerTx();
  const [fund, setFund] = useState('');
  const [wTo, setWTo] = useState('');
  const [wAmt, setWAmt] = useState('');
  const [lim, setLim] = useState({ floorPhp: '', perPurchase: s.maxTokensPerPurchase.replace(/,/g, ''), perDay: s.maxTokensPerDay.replace(/,/g, '') });
  const contract = o.saleContract!;
  const after = async (p: Promise<unknown>) => { if (await p) router.refresh(); };
  const floorEthPerToken = Number(s.minWeiPerToken) / 1e18;
  const floorPhpNow = o.ethPhp ? floorEthPerToken * Number(o.ethPhp.rate.replace(/,/g, '')) : null;
  return (
    <section className="card space-y-5 p-5" aria-label="Sale contract">
      <h2 className="k-h3 text-xl">Sale contract</h2>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {[
          ['Status', s.paused ? 'Paused' : 'Open'], ['For sale', `${s.inventory} ${o.symbol}`], ['Sold today', `${s.soldToday} ${o.symbol}`],
          ['Owner', s.owner], ['Treasury (receives ETH)', s.treasury], ['Signing key', s.quoteSigner],
          ['Price floor', `${floorEthPerToken.toFixed(10).replace(/0+$/, '')} ETH per token${floorPhpNow != null ? ` (about ₱${floorPhpNow.toFixed(4)} today)` : ''}`],
          ['Max per purchase', `${s.maxTokensPerPurchase} ${o.symbol}`], ['Max per day', `${s.maxTokensPerDay} ${o.symbol}`],
        ].map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd className="break-all">{v}</dd></div>)}
      </dl>
      <WalletGate owner={s.owner} chain={chain}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="label">Add tokens for sale</p>
            <div className="flex gap-2"><input className="input" inputMode="decimal" placeholder={`Amount of ${o.symbol}`} value={fund} onChange={(e) => setFund(e.target.value)} />
              <button type="button" className="btn-outline btn-sm" disabled={t.busy} onClick={() => { const a = parseUnits(fund, o.decimals); if (!a || !o.token) return; void after(t.run('Add tokens', o.token, transferData(contract, a))); }}>Send</button></div>
            <p className="text-xs text-mute">Moves tokens from your wallet into the sale contract.</p>
          </div>
          <div className="space-y-2">
            <p className="label">{s.paused ? 'Open the sale' : 'Emergency stop'}</p>
            <button type="button" className={s.paused ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} disabled={t.busy} onClick={() => void after(t.run(s.paused ? 'Unpause' : 'Pause', contract, encodeFunctionData({ abi: ABI, functionName: s.paused ? 'unpause' : 'pause' })))}>{s.paused ? 'Unpause contract' : 'Pause contract'}</button>
            <p className="text-xs text-mute">Pausing stops every purchase immediately.</p>
          </div>
          <div className="space-y-2">
            <p className="label">Take unsold tokens back</p>
            <input className="input font-mono" placeholder="To address (0x...)" value={wTo} onChange={(e) => setWTo(e.target.value)} />
            <div className="flex gap-2"><input className="input" inputMode="decimal" placeholder={`Amount of ${o.symbol}`} value={wAmt} onChange={(e) => setWAmt(e.target.value)} />
              <button type="button" className="btn-outline btn-sm" disabled={t.busy} onClick={() => { const a = parseUnits(wAmt, o.decimals); if (!a || !isAddress(wTo.trim())) return; void after(t.run('Withdraw', contract, encodeFunctionData({ abi: ABI, functionName: 'withdrawInventory', args: [wTo.trim() as Hex, a] }))); }}>Withdraw</button></div>
          </div>
          <div className="space-y-2">
            <p className="label">Limits</p>
            <input className="input" inputMode="decimal" placeholder="Price floor (₱ per token)" value={lim.floorPhp} onChange={(e) => setLim({ ...lim, floorPhp: e.target.value })} />
            <div className="flex gap-2"><input className="input" inputMode="numeric" aria-label="Max tokens per purchase" value={lim.perPurchase} onChange={(e) => setLim({ ...lim, perPurchase: e.target.value })} /><input className="input" inputMode="numeric" aria-label="Max tokens per day" value={lim.perDay} onChange={(e) => setLim({ ...lim, perDay: e.target.value })} /></div>
            <button type="button" className="btn-outline btn-sm" disabled={t.busy} onClick={() => {
              const fw = floorWei(lim.floorPhp, o.ethPhp?.rate); const pp = parseUnits(lim.perPurchase, o.decimals); const pd = parseUnits(lim.perDay, o.decimals);
              if (!fw || !pp || !pd) return; void after(t.run('Update limits', contract, encodeFunctionData({ abi: ABI, functionName: 'setLimits', args: [fw, pp, pd, BigInt(s.maxQuoteLifetime)] })));
            }}>Update limits</button>
            <p className="text-xs text-mute">The floor is stored in ETH at today&apos;s rate. If ETH rises a lot, lower it, or purchases are refused.</p>
          </div>
          {o.signerAddress && !sameAddress(s.quoteSigner, o.signerAddress) && (
            <div className="space-y-2"><p className="label">Signing key</p>
              <button type="button" className="btn-primary btn-sm" disabled={t.busy} onClick={() => void after(t.run('Set signing key', contract, encodeFunctionData({ abi: ABI, functionName: 'setQuoteSigner', args: [o.signerAddress as Hex] })))}>Trust this store&apos;s key ({shortAddress(o.signerAddress)})</button></div>
          )}
        </div>
        <TxStatus t={t} chain={chain} />
      </WalletGate>
    </section>
  );
}

function DeployPanel({ o }: { o: SaleOverview }) {
  const chain = chainOf(o);
  const t = useOwnerTx();
  const [f, setF] = useState({ treasury: '', floorPhp: o.price ? (Number(o.price.php.replace(/,/g, '')) / 2).toString() : '', perPurchase: '100000', perDay: '1000000' });
  const [deployed, setDeployed] = useState<string | null>(null);
  async function deploy() {
    const treasury = (f.treasury.trim() || t.w.address || '').trim();
    const fw = floorWei(f.floorPhp, o.ethPhp?.rate); const pp = parseUnits(f.perPurchase, o.decimals); const pd = parseUnits(f.perDay, o.decimals);
    if (!isAddress(treasury) || !fw || !pp || !pd || !o.token || !o.signerAddress || !t.w.address) return;
    const data = encodeDeployData({ abi: ABI, bytecode: artifact.bytecode as Hex, args: [o.token as Hex, o.decimals, treasury as Hex, o.signerAddress as Hex, t.w.address as Hex, fw, pp, pd, 600n] });
    const r = await t.run('Deploy sale contract', null, data);
    if (r?.contractAddress) setDeployed(r.contractAddress);
  }
  return (
    <section className="card space-y-4 p-5" aria-label="Deploy sale contract">
      <h2 className="k-h3 text-xl">Deploy the sale contract</h2>
      <p className="text-sm text-mute">Deploys from your connected wallet, which becomes the contract owner. It starts paused and empty. Test on Robinhood Chain Testnet first.</p>
      <WalletGate owner={null} chain={chain}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="d-tr">Treasury (receives the ETH)</label><input id="d-tr" className="input font-mono" placeholder={t.w.address ?? '0x...'} value={f.treasury} onChange={(e) => setF({ ...f, treasury: e.target.value })} /><p className="mt-1 text-xs text-mute">Leave empty to use your connected wallet. A multisig wallet is safest.</p></div>
          <div><label className="label" htmlFor="d-fl">Price floor (₱ per token)</label><input id="d-fl" className="input" inputMode="decimal" value={f.floorPhp} onChange={(e) => setF({ ...f, floorPhp: e.target.value })} /><p className="mt-1 text-xs text-mute">The contract never sells below this, whatever a quote says. Stored in ETH at today&apos;s rate (₱{o.ethPhp?.rate ?? '?'} per ETH).</p></div>
          <div><label className="label" htmlFor="d-pp">Max tokens per purchase</label><input id="d-pp" className="input" inputMode="numeric" value={f.perPurchase} onChange={(e) => setF({ ...f, perPurchase: e.target.value })} /></div>
          <div><label className="label" htmlFor="d-pd">Max tokens per day</label><input id="d-pd" className="input" inputMode="numeric" value={f.perDay} onChange={(e) => setF({ ...f, perDay: e.target.value })} /></div>
        </div>
        <p className="text-xs text-mute">Token {o.token} · signing key {o.signerAddress} · quotes valid at most 10 minutes.</p>
        <button type="button" className="btn-primary" disabled={t.busy || !o.ethPhp} aria-busy={t.busy} onClick={() => void deploy()}>Deploy from my wallet</button>
        {!o.ethPhp && <p className="text-sm text-red-600">The ETH rate is unavailable, so the floor cannot be converted. Try again shortly.</p>}
        <TxStatus t={t} chain={chain} />
        {deployed && <p className="border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Deployed at <span className="break-all font-mono">{deployed}</span>. Next: set TOKEN_SALE_CONTRACT_ADDRESS to this address in Vercel and redeploy the store, then come back here to add tokens and unpause.</p>}
      </WalletGate>
    </section>
  );
}
