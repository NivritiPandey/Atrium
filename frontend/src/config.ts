import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { normalizeHex32 } from './lib/validation';

export type NetworkId = 'preview' | 'preprod';
export const NETWORKS: readonly NetworkId[] = ['preview', 'preprod'];
export const DEFAULT_NETWORK: NetworkId = 'preview';
export const CONFIG_EVENT = 'atrium:configuration';
const NETWORK_KEY = 'ATRIUM_NETWORK_V1';
const addressKey = (network: NetworkId) => `ATRIUM_CONTRACT_V1:${network}`;
export function normalizeContractAddress(value: string): string {
  // Midnight.js expects ledger contract addresses, NOT mn_addr wallet addresses.
  return normalizeHex32(value, 'Contract address');
}

export function isNetworkId(value: unknown): value is NetworkId {
  return value === 'preview' || value === 'preprod';
}
function readStorage(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
}
const savedNetwork = readStorage(NETWORK_KEY);
let selectedNetwork: NetworkId = isNetworkId(savedNetwork) ? savedNetwork : DEFAULT_NETWORK;
let networkLocks = 0;
const addresses = new Map<NetworkId, string>();
setNetworkId(selectedNetwork);

export const getNetwork = (): NetworkId => selectedNetwork;
export const getSelectedNetwork = getNetwork;
export const isNetworkLocked = () => networkLocks > 0;
export function getNetworkConfig(network: NetworkId = getNetwork()) {
  return {
    networkId: network,
    label: network === 'preview' ? 'Preview' : 'Preprod',
    indexerUrl: `https://indexer.${network}.midnight.network/api/v4/graphql`,
    indexerWsUrl: `wss://indexer.${network}.midnight.network/api/v4/graphql/ws`,
    nodeUrl: `https://rpc.${network}.midnight.network`,
  };
}
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONFIG_EVENT));
}
export function setNetwork(network: NetworkId) {
  if (!isNetworkId(network)) throw new Error('Choose Preview or Preprod.');
  if (network !== selectedNetwork && isNetworkLocked()) throw new Error('Disconnect your wallet before switching networks.');
  selectedNetwork = network;
  setNetworkId(network);
  try { window.localStorage.setItem(NETWORK_KEY, network); } catch { /* Memory-only selection remains usable. */ }
  notify();
}
export const setSelectedNetwork = setNetwork;
/** Held while a connection or transaction is live, including wallet prompts. */
export function lockNetwork(): () => void {
  networkLocks += 1;
  let released = false;
  return () => { if (!released) { released = true; networkLocks -= 1; } };
}

/** No legacy address or unscoped environment fallback is intentionally supported. */
export function getContractAddress(network: NetworkId = getNetwork()): string {
  if (addresses.has(network)) return addresses.get(network)!;
  const saved = readStorage(addressKey(network));
  try {
    if (saved) return normalizeContractAddress(saved);
    const configured = String(import.meta.env.VITE_CONTRACT_ADDRESS || '').trim();
    if (configured) {
      const candidate = normalizeContractAddress(configured);
      return candidate.toLowerCase().startsWith(`mn_addr_${network}1`) ? candidate : '';
    }
  } catch { /* Invalid or wrong-network build-time values are ignored. */ }
  return '';
}
/** Returns false when storage is unavailable; the address still works in this tab. */
export function setContractAddress(address: string, network: NetworkId = getNetwork()): boolean {
  const normalized = address.trim() ? normalizeContractAddress(address) : '';
  addresses.set(network, normalized);
  let persisted = true;
  try {
    if (normalized) window.localStorage.setItem(addressKey(network), normalized);
    else window.localStorage.removeItem(addressKey(network));
  } catch { persisted = false; }
  notify();
  return persisted;
}
export function subscribeConfig(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith('ATRIUM_CONTRACT_V1:')) {
      addresses.clear();
      listener();
    }
    // Deliberately do not switch an active tab's network from another tab.
  };
  window.addEventListener(CONFIG_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(CONFIG_EVENT, listener); window.removeEventListener('storage', onStorage); };
}
export const getExplorerContractUrl = (address = getContractAddress(), network: NetworkId = getNetwork()) =>
  address ? `https://explorer.1am.xyz/contract/${encodeURIComponent(address)}?network=${network}` : `https://explorer.1am.xyz/?network=${network}`;
export const getExplorerTxUrl = (txId: string, network: NetworkId = getNetwork()) =>
  `https://explorer.1am.xyz/tx/${encodeURIComponent(txId)}?network=${network}`;

export const DEFAULT_GATE_THRESHOLD = 72n;
export const DEFAULT_ENTRY_LIMIT = 144n;
