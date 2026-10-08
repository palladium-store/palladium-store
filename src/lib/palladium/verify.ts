import { TRANSFER_TOPIC, hexToBigInt, sameAddress, topicToAddress } from '@/lib/chain-config';

/**
 * Pure verification of an ERC-20 payment from a transaction receipt. No network access, so it is fully unit tested.
 *
 * A payment counts when, in one mined and successful transaction, Transfer events emitted by the $PALLADIUM contract
 * moved at least the expected amount to Palladium's receiving wallet, and enough blocks have followed. Which wallet or
 * contract sent it does not matter: only what the token contract itself recorded.
 */
export interface RpcLog { address: string; topics: string[]; data: string }
export interface RpcReceipt { status: string; blockNumber: string; transactionHash: string; from: string; to: string | null; logs: RpcLog[] }

export interface VerifyInput {
  receipt: RpcReceipt | null;
  /** Latest block number of the chain, as reported by the same RPC. */
  latestBlock: bigint;
  contract: string;
  paymentWallet: string;
  /** Smallest units, from the order's locked quote. */
  expectedAmount: bigint;
  confirmations: number;
}

export type VerifyResult =
  | { kind: 'pending' }                                                     // not mined yet
  | { kind: 'failed' }                                                      // mined, but the transaction reverted
  | { kind: 'rejected'; reason: string }                                    // mined fine, but it did not pay Palladium in $PALLADIUM
  | { kind: 'underpaid'; received: bigint; from: string; blockNumber: bigint }
  | { kind: 'confirming'; received: bigint; from: string; blockNumber: bigint; have: number; need: number }
  | { kind: 'ok'; received: bigint; from: string; blockNumber: bigint; confirmations: number };

export function evaluateReceipt(i: VerifyInput): VerifyResult {
  const r = i.receipt;
  if (!r || !r.blockNumber) return { kind: 'pending' };
  if (hexToBigInt(r.status) !== 1n) return { kind: 'failed' };

  let received = 0n;
  let from: string | null = null;
  for (const log of r.logs ?? []) {
    if (!sameAddress(log.address, i.contract)) continue;
    if (!log.topics || log.topics.length < 3 || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
    if (!sameAddress(topicToAddress(log.topics[2]), i.paymentWallet)) continue;
    received += hexToBigInt(log.data);
    from ??= topicToAddress(log.topics[1]);
  }
  if (received === 0n || !from) return { kind: 'rejected', reason: 'The transaction did not transfer $PALLADIUM to the Palladium wallet.' };

  const blockNumber = hexToBigInt(r.blockNumber);
  if (received < i.expectedAmount) return { kind: 'underpaid', received, from, blockNumber };

  const have = Number(i.latestBlock - blockNumber + 1n);
  if (have < i.confirmations) return { kind: 'confirming', received, from, blockNumber, have: Math.max(0, have), need: i.confirmations };
  return { kind: 'ok', received, from, blockNumber, confirmations: have };
}
