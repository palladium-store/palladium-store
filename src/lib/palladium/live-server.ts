import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { audit } from '@/lib/audit';
import { confirmOrderAsSystem } from '@/lib/orders';
import { issueQuote } from '@/lib/pricing';
import { formatUnits, isTxHash, sameAddress } from '@/lib/chain-config';
import type { PaymentProvider } from '@/lib/payments';
import { getLivePaymentConfig, livePaymentEnabled, type LivePaymentConfig } from './live-config';
import { evaluateReceipt, type RpcReceipt, type VerifyResult } from './verify';

/**
 * Server side of real $PALLADIUM payments on Robinhood Chain.
 *
 * Flow: placing a PALLADIUM order locks a token amount from server-side pricing (initiate). The customer's wallet sends
 * an ERC-20 transfer to Palladium's wallet; the browser hands us only the transaction hash. We read the receipt from our
 * own RPC, check the Transfer events (contract, recipient, amount, confirmations) and only then mark the order paid, the
 * same way a QR Ph payment is confirmed. The browser is never the source of truth for anything.
 *
 * State lives on the order's Payment row (`rawPayload`, like QR Ph keeps its intents) plus the order's own txId and
 * walletAddress columns, so no schema change is needed. A transaction hash can pay one order only: the application checks,
 * and migration 0010 adds a unique index as the hard guarantee.
 */
export const PAYMENT_MODE_LIVE = 'LIVE';
export const LIVE_PROVIDER = 'robinhood-chain';
/** How long a locked amount stays payable. A wallet round-trip takes minutes, not seconds. */
const ORDER_QUOTE_TTL_SECONDS = 900;

export interface TokenPaymentRecord {
  mode: 'LIVE';
  chainId: number;
  contract: string;
  decimals: number;
  symbol: string;
  to: string;
  /** Smallest units, decimal string. */
  tokenAmount: string;
  /** PHP per token, scaled by 1e18, decimal string. */
  rateScaled: string;
  rate: string;
  source: string;
  quoteId: string;
  quotedAt: number;
  expiresAt: number;
  txHash: string | null;
  from: string | null;
  /** Amount actually received, smallest units, once a receipt was read. */
  received: string | null;
  blockNumber: string | null;
  verifiedAt: string | null;
  /** The last verification outcome, for the UI. */
  state: 'AWAITING_TX' | 'PENDING' | 'CONFIRMING' | 'PAID' | 'FAILED' | 'REJECTED' | 'REVIEW';
  note: string | null;
  /** Every hash ever submitted for this order (a failed transaction can be replaced). */
  txHashes: string[];
}

export const LIVE_INSTRUCTIONS = 'Pay with $PALLADIUM from your crypto wallet on Robinhood Chain. The token amount is locked for 15 minutes when you place the order.';

// ---------- RPC ----------

async function rpc<T>(cfg: LivePaymentConfig, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(cfg.rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new AppError(502, 'CHAIN_UNAVAILABLE', 'The blockchain could not be reached. Please try again in a moment.');
  const json = (await res.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!json || json.error) { console.error('[robinhood-chain rpc]', method, json?.error); throw new AppError(502, 'CHAIN_UNAVAILABLE', 'The blockchain could not be reached. Please try again in a moment.'); }
  return json.result as T;
}

let chainChecked: number | null = null;
/** Makes sure the RPC we verify with really is the configured chain (once per process). */
async function assertChain(cfg: LivePaymentConfig) {
  if (chainChecked === cfg.chainId) return;
  const id = parseInt(String(await rpc<string>(cfg, 'eth_chainId', [])), 16);
  if (id !== cfg.chainId) { console.error('[robinhood-chain] RPC chain mismatch', id, cfg.chainId); throw new AppError(503, 'CHAIN_MISCONFIGURED', 'Token payments are temporarily unavailable.'); }
  chainChecked = cfg.chainId;
}

// ---------- records ----------

const latestPayment = (orderId: string) => prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
const recordOf = (raw: Prisma.JsonValue | null | undefined): TokenPaymentRecord | null => {
  const r = raw as { mode?: string } | null;
  return r && r.mode === 'LIVE' ? (r as unknown as TokenPaymentRecord) : null;
};

async function saveRecord(paymentId: string, rec: TokenPaymentRecord) {
  await prisma.payment.update({ where: { id: paymentId }, data: { provider: LIVE_PROVIDER, providerRef: rec.txHash ?? undefined, rawPayload: rec as unknown as Prisma.InputJsonObject } });
}

/** Locks the token amount for an order from server-side pricing. The browser never supplies an amount. */
async function lockQuote(orderId: string, totalCentavos: number, prev?: TokenPaymentRecord): Promise<TokenPaymentRecord> {
  const cfg = getLivePaymentConfig();
  if (!cfg || !(await livePaymentEnabled())) throw new AppError(503, 'TOKEN_UNAVAILABLE', 'Token payments are not available right now.');
  const q = await issueQuote(totalCentavos);
  const rec: TokenPaymentRecord = {
    mode: 'LIVE', chainId: cfg.chainId, contract: cfg.contract, decimals: cfg.decimals, symbol: cfg.symbol, to: cfg.paymentWallet,
    tokenAmount: q.tokenAmount, rateScaled: (() => { try { return JSON.parse(Buffer.from(q.token.split('.')[0], 'base64url').toString('utf8')).rateScaled as string; } catch { return '0'; } })(),
    rate: q.rate, source: q.source, quoteId: q.id, quotedAt: q.quotedAt, expiresAt: q.quotedAt + ORDER_QUOTE_TTL_SECONDS * 1000,
    txHash: prev?.txHash ?? null, from: prev?.from ?? null, received: null, blockNumber: null, verifiedAt: null,
    state: prev?.txHash ? prev.state : 'AWAITING_TX', note: null, txHashes: prev?.txHashes ?? [],
  };
  const payment = await latestPayment(orderId);
  if (!payment) throw new AppError(500, 'NO_PAYMENT_ROW', 'Order has no payment record.');
  await saveRecord(payment.id, rec);
  // The order columns mirror the key facts for the admin list and reports. tokenAmountMinor (hundredths) only when it fits.
  const minor = (BigInt(q.tokenAmount) * 100n) / 10n ** BigInt(cfg.decimals);
  const price = Math.round(Number(q.rate) * 100);
  await prisma.$executeRaw`UPDATE orders SET "paymentMode"=${PAYMENT_MODE_LIVE}, "tokenAmountMinor"=${minor <= 2147483647n ? Number(minor) : null}, "tokenPriceCentavos"=${Number.isFinite(price) ? price : null} WHERE id=${orderId}`;
  return rec;
}

/** Payment provider hook: called right after a PALLADIUM order is created. */
export const palladiumLiveProvider: PaymentProvider = {
  id: LIVE_PROVIDER,
  methods: ['PALLADIUM'],
  async initiate(order) {
    await lockQuote(order.id, order.totalCentavos);
    return { instructions: LIVE_INSTRUCTIONS, reference: order.orderNumber };
  },
};

// ---------- view ----------

export interface TokenPaymentView {
  orderNumber: string;
  totalCentavos: number;
  paymentStatus: string;
  orderStatus: string;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  contract: string;
  decimals: number;
  symbol: string;
  to: string;
  tokenAmount: string;
  tokenAmountDisplay: string;
  rate: string;
  expiresAt: number;
  expired: boolean;
  txHash: string | null;
  from: string | null;
  received: string | null;
  receivedDisplay: string | null;
  state: TokenPaymentRecord['state'];
  note: string | null;
  confirmations?: { have: number; need: number };
}

type OrderRow = { id: string; orderNumber: string; totalCentavos: number; status: string; paymentStatus: string; paymentMethod: string };

export async function tokenPaymentView(order: OrderRow, rec: TokenPaymentRecord, confirmations?: { have: number; need: number }): Promise<TokenPaymentView> {
  const cfg = getLivePaymentConfig();
  const chainName = cfg?.chainName ?? 'Robinhood Chain';
  const explorerUrl = cfg?.explorerUrl ?? '';
  return {
    orderNumber: order.orderNumber, totalCentavos: order.totalCentavos, paymentStatus: order.paymentStatus, orderStatus: order.status,
    chainId: rec.chainId, chainName, explorerUrl, contract: rec.contract, decimals: rec.decimals, symbol: rec.symbol, to: rec.to,
    tokenAmount: rec.tokenAmount, tokenAmountDisplay: formatUnits(BigInt(rec.tokenAmount), rec.decimals, 6), rate: rec.rate,
    expiresAt: rec.expiresAt, expired: order.paymentStatus !== 'PAID' && !rec.txHash && Date.now() >= rec.expiresAt,
    txHash: rec.txHash, from: rec.from, received: rec.received, receivedDisplay: rec.received ? formatUnits(BigInt(rec.received), rec.decimals, 6) : null,
    state: order.paymentStatus === 'PAID' ? 'PAID' : rec.state, note: rec.note, confirmations,
  };
}

/** The live token record of an order, if it has one. */
export async function loadTokenPayment(orderId: string): Promise<{ paymentId: string; rec: TokenPaymentRecord } | null> {
  const p = await latestPayment(orderId);
  const rec = recordOf(p?.rawPayload);
  return p && rec ? { paymentId: p.id, rec } : null;
}

// ---------- actions ----------

/** Re-locks the amount at the current price when the previous lock expired before a transaction was sent. */
export async function requoteOrder(order: OrderRow): Promise<TokenPaymentRecord> {
  const cur = await loadTokenPayment(order.id);
  if (!cur) throw new AppError(409, 'NOT_TOKEN_ORDER', 'This order has no token payment.');
  if (cur.rec.txHash) throw new AppError(409, 'TX_PENDING', 'A payment for this order is already being confirmed.');
  if (order.paymentStatus === 'PAID') throw new AppError(409, 'ALREADY_PAID', 'This order is already paid.');
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') throw new AppError(409, 'INVALID_STATE', 'This order can no longer be paid.');
  return lockQuote(order.id, order.totalCentavos, cur.rec);
}

/** Records the hash the wallet returned, then verifies it. The same hash can never be attached to two orders. */
export async function attachTransaction(order: OrderRow, txHashRaw: string): Promise<{ view: TokenPaymentView }> {
  if (!isTxHash(txHashRaw)) throw new AppError(422, 'BAD_TX', 'That is not a valid transaction hash.');
  const txHash = txHashRaw.toLowerCase();
  const cur = await loadTokenPayment(order.id);
  if (!cur) throw new AppError(409, 'NOT_TOKEN_ORDER', 'This order has no token payment.');
  if (order.paymentStatus === 'PAID') {
    if (cur.rec.txHash === txHash) return { view: await tokenPaymentView(order, cur.rec) };
    throw new AppError(409, 'ALREADY_PAID', 'This order is already paid.');
  }
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') throw new AppError(409, 'INVALID_STATE', 'This order can no longer be paid.');
  if (cur.rec.txHash && cur.rec.txHash !== txHash && (cur.rec.state === 'PENDING' || cur.rec.state === 'CONFIRMING' || cur.rec.state === 'REVIEW')) {
    throw new AppError(409, 'TX_PENDING', 'A payment for this order is already being confirmed.');
  }
  const used = await prisma.order.findFirst({ where: { txId: txHash, NOT: { id: order.id } }, select: { id: true } });
  if (used) throw new AppError(409, 'TX_USED', 'This transaction was already used for another order.');

  const rec: TokenPaymentRecord = { ...cur.rec, txHash, from: null, received: null, blockNumber: null, verifiedAt: null, state: 'PENDING', note: null, txHashes: Array.from(new Set([...(cur.rec.txHashes ?? []), txHash])) };
  await saveRecord(cur.paymentId, rec);
  try {
    await prisma.$executeRaw`UPDATE orders SET "txId"=${txHash} WHERE id=${order.id}`;
  } catch (e) {
    // The unique index (migration 0010) caught a race with another order using the same hash.
    if (/23505|unique/i.test(String((e as Error)?.message ?? e))) { await saveRecord(cur.paymentId, { ...cur.rec, state: cur.rec.txHash ? cur.rec.state : 'AWAITING_TX' }); throw new AppError(409, 'TX_USED', 'This transaction was already used for another order.'); }
    throw e;
  }
  return verifyOrderPayment(order);
}

/**
 * Reads the receipt and settles the order when the payment checks out. Safe to call repeatedly (the order page polls it).
 * Never throws on a chain problem during a poll: the record keeps its last state and the caller sees it.
 */
export async function verifyOrderPayment(order: OrderRow): Promise<{ view: TokenPaymentView }> {
  const cur = await loadTokenPayment(order.id);
  if (!cur) throw new AppError(409, 'NOT_TOKEN_ORDER', 'This order has no token payment.');
  const { paymentId } = cur;
  let rec = cur.rec;
  if (order.paymentStatus === 'PAID' || !rec.txHash || rec.state === 'FAILED' || rec.state === 'REJECTED') return { view: await tokenPaymentView(order, rec) };
  const cfg = getLivePaymentConfig();
  if (!cfg) return { view: await tokenPaymentView(order, rec) };

  let result: VerifyResult;
  try {
    await assertChain(cfg);
    const [receipt, latestHex] = await Promise.all([rpc<RpcReceipt | null>(cfg, 'eth_getTransactionReceipt', [rec.txHash]), rpc<string>(cfg, 'eth_blockNumber', [])]);
    result = evaluateReceipt({ receipt, latestBlock: BigInt(latestHex), contract: rec.contract, paymentWallet: rec.to, expectedAmount: BigInt(rec.tokenAmount), confirmations: cfg.confirmations });
  } catch (e) {
    console.error('[robinhood-chain verify]', order.orderNumber, e);
    return { view: await tokenPaymentView(order, rec) };
  }

  const stamp = new Date().toISOString();
  let confirmations: { have: number; need: number } | undefined;
  switch (result.kind) {
    case 'pending':
      rec = { ...rec, state: 'PENDING' };
      break;
    case 'confirming':
      rec = { ...rec, state: 'CONFIRMING', from: result.from, received: result.received.toString(), blockNumber: result.blockNumber.toString() };
      confirmations = { have: result.have, need: result.need };
      break;
    case 'failed':
      // The wallet's transaction reverted. Free the order so the customer can try again.
      rec = { ...rec, state: 'FAILED', txHash: null, note: 'The transaction failed on the blockchain. Nothing was charged.', verifiedAt: stamp };
      await prisma.$executeRaw`UPDATE orders SET "txId"=NULL WHERE id=${order.id}`;
      break;
    case 'rejected':
      rec = { ...rec, state: 'REJECTED', txHash: null, note: result.reason, verifiedAt: stamp };
      await prisma.$executeRaw`UPDATE orders SET "txId"=NULL WHERE id=${order.id}`;
      await audit(null, 'TOKEN_PAYMENT_REJECTED', 'Order', order.id, `Transaction ${cur.rec.txHash} for ${order.orderNumber} did not pay Palladium in ${rec.symbol}.`);
      break;
    case 'underpaid':
      rec = { ...rec, state: 'REVIEW', from: result.from, received: result.received.toString(), blockNumber: result.blockNumber.toString(), verifiedAt: stamp, note: `Received ${formatUnits(result.received, rec.decimals, 6)} of ${formatUnits(BigInt(rec.tokenAmount), rec.decimals, 6)} ${rec.symbol}. Palladium will contact you.` };
      await prisma.$executeRaw`UPDATE orders SET "walletAddress"=${result.from} WHERE id=${order.id}`;
      await audit(null, 'TOKEN_PAYMENT_NEEDS_REVIEW', 'Order', order.id, `Underpaid: ${order.orderNumber} received ${formatUnits(result.received, rec.decimals, 6)} of ${formatUnits(BigInt(rec.tokenAmount), rec.decimals, 6)} ${rec.symbol} in ${rec.txHash}. Review or refund.`);
      break;
    case 'ok': {
      rec = { ...rec, state: 'PAID', from: result.from, received: result.received.toString(), blockNumber: result.blockNumber.toString(), verifiedAt: stamp, note: null };
      await prisma.$executeRaw`UPDATE orders SET "walletAddress"=${result.from} WHERE id=${order.id}`;
      await saveRecord(paymentId, rec);
      try {
        await confirmOrderAsSystem(order.id, rec.txHash!, `${rec.symbol} payment ${rec.txHash}`);
      } catch (e) {
        // Paid on-chain but the order can no longer be confirmed (cancelled, out of stock): needs a human.
        console.error('[robinhood-chain] could not confirm paid order', order.id, e);
        rec = { ...rec, state: 'REVIEW', note: 'Your payment arrived but the order needs a manual check. Palladium will contact you.' };
        await saveRecord(paymentId, rec);
        await audit(null, 'TOKEN_PAYMENT_NEEDS_REVIEW', 'Order', order.id, `${rec.symbol} payment ${rec.txHash} was received for ${order.orderNumber} but the order could not be confirmed. Review or refund.`);
        return { view: await tokenPaymentView(order, rec) };
      }
      const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { id: true, orderNumber: true, totalCentavos: true, status: true, paymentStatus: true, paymentMethod: true } });
      return { view: await tokenPaymentView(fresh, rec) };
    }
  }
  await saveRecord(paymentId, rec);
  return { view: await tokenPaymentView(order, rec, confirmations) };
}

/** For the expiry job: true when an unpaid PALLADIUM order must be left alone (a transaction is still being confirmed or needs review). */
export async function tokenPaymentInFlight(order: OrderRow): Promise<boolean> {
  const cur = await loadTokenPayment(order.id);
  if (!cur?.rec.txHash) return false;
  try {
    const { view } = await verifyOrderPayment(order);
    return view.state === 'PAID' || view.state === 'PENDING' || view.state === 'CONFIRMING' || view.state === 'REVIEW';
  } catch { return true; }
}

/** Admin display helper: a human-readable summary of a live record. */
export const describeTokenPayment = (rec: TokenPaymentRecord) => ({
  amount: `${formatUnits(BigInt(rec.tokenAmount), rec.decimals, 6)} ${rec.symbol}`,
  received: rec.received ? `${formatUnits(BigInt(rec.received), rec.decimals, 6)} ${rec.symbol}` : null,
  rate: `₱${rec.rate} per token (${rec.source})`,
  sameRecipient: (to: string) => sameAddress(rec.to, to),
});
