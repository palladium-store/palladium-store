import 'server-only';
import { AppError } from '@/lib/errors';
import type { ChainPreset } from '@/lib/chain-config';

/**
 * Server-side JSON-RPC to Robinhood Chain with fallbacks.
 *
 * Endpoints come from TOKEN_RPC_URL (comma-separated, https only, tried in order) followed by the chain's public RPC.
 * Before an endpoint is trusted, its eth_chainId must equal the configured chain, so a wrong or tampered URL can never make
 * a testnet transaction count as a mainnet one (or the other way round). The check is cached per endpoint for the process.
 */
export function rpcUrlsFor(chain: ChainPreset): string[] {
  const extra = (process.env.TOKEN_RPC_URL ?? '').split(',').map((s) => s.trim()).filter((s) => /^https:\/\/[^\s]+$/.test(s));
  return Array.from(new Set([...extra, chain.rpcUrl]));
}

const verified = new Map<string, number>();
const unavailable = () => new AppError(502, 'CHAIN_UNAVAILABLE', 'The blockchain could not be reached. Please try again in a moment.');

async function post<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as { result?: T; error?: { code?: number; message?: string } } | null;
  if (!json) throw new Error('Bad JSON');
  if (json.error) throw Object.assign(new Error(json.error.message ?? 'RPC error'), { rpc: true, code: json.error.code });
  return json.result as T;
}

/**
 * Calls `method` on the first endpoint that is reachable and on the right chain. An error the node itself returns for the
 * request (for example "range too large") is not retried elsewhere: it would fail the same way.
 */
export async function chainRpc<T>(urls: string[], chainId: number, method: string, params: unknown[]): Promise<T> {
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      if (verified.get(url) !== chainId) {
        const id = parseInt(String(await post<string>(url, 'eth_chainId', [])), 16);
        if (id !== chainId) { console.error('[robinhood-chain] RPC on the wrong chain, skipped', new URL(url).host, id, chainId); continue; }
        verified.set(url, chainId);
      }
      return await post<T>(url, method, params);
    } catch (e) {
      if ((e as { rpc?: boolean }).rpc) throw e;
      lastErr = e;
      console.error('[robinhood-chain] RPC endpoint failed, trying the next one', new URL(url).host, method, String((e as Error)?.message ?? e));
    }
  }
  if (lastErr) console.error('[robinhood-chain] every RPC endpoint failed', method);
  throw unavailable();
}
