import type { NetworkId } from '../config';
import { assertTransactionId } from './validation';

export async function queryIndexer<T>(url: string, query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15_000);
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ query, variables }), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Indexer request failed (${response.status}).`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error('The indexer could not complete this query. Please try again later.');
    if (!payload.data) throw new Error('The indexer returned no data.');
    return payload.data as T;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export type IndexedTransaction = {
  txId: string;
  status: 'SucceedEntirely' | 'FailEntirely' | 'FailFallible';
  blockHeight: number;
  blockHash: string;
  contractAddresses: string[];
};
export type IndexerTransaction = {
  identifiers?: string[];
  transactionResult?: { status?: string };
  block?: { height?: number; hash?: string };
  contractActions?: { address: string }[];
};
export function parseIndexedTransaction(transactions: IndexerTransaction[], txId: string): IndexedTransaction | null {
  const normalized = assertTransactionId(txId);
  const matched = transactions.filter((item) => item.identifiers?.some((id) => id.toLowerCase() === normalized));
  if (matched.length !== 1) return null;
  const tx = matched[0];
  const status = tx.transactionResult?.status;
  if (!['SUCCESS', 'FAILURE', 'PARTIAL_SUCCESS'].includes(status ?? '')) return null;
  if (typeof tx.block?.height !== 'number' || !Number.isSafeInteger(tx.block.height) || tx.block.height < 0 || !tx.block.hash) return null;
  return {
    txId: normalized,
    status: status === 'SUCCESS' ? 'SucceedEntirely' : status === 'PARTIAL_SUCCESS' ? 'FailFallible' : 'FailEntirely',
    blockHeight: tx.block.height, blockHash: tx.block.hash,
    contractAddresses: (tx.contractActions ?? []).map((action) => action.address.toLowerCase()),
  };
}
export async function queryTransactionStatus(url: string, txId: string, signal?: AbortSignal): Promise<IndexedTransaction | null> {
  const data = await queryIndexer<{ transactions: IndexerTransaction[] }>(url, `
    query AtriumTransaction($offset: TransactionOffset!) {
      transactions(offset: $offset) {
        block { height hash }
        contractActions { address }
        ... on RegularTransaction { identifiers transactionResult { status } }
      }
    }`, { offset: { identifier: assertTransactionId(txId) } }, signal);
  return parseIndexedTransaction(data.transactions ?? [], txId);
}
export type TransactionReceipt = { txId: string; network: NetworkId; contractAddress: string };
