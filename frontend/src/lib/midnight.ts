import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI, Configuration } from '@midnight-ntwrk/dapp-connector-api';
import { getNetworkConfig, type NetworkId } from '../config';
import { toHex as encodeHex, fromHex as decodeHex } from './validation';

export const toHex = encodeHex;
export const fromHex = decodeHex;

export function createPrivateStateProvider() {
  let scope = '';
  const state = new Map<string, unknown>();
  const signingKeys = new Map<string, unknown>();
  const key = (id: string) => `${scope}:${id}`;
  return {
    setContractAddress(address: string) { scope = address; },
    async set(id: string, value: unknown) { state.set(key(id), value); },
    async get(id: string) { return state.get(key(id)) ?? null; },
    async remove(id: string) { state.delete(key(id)); },
    async clear() { state.clear(); },
    async setSigningKey(address: string, value: unknown) { signingKeys.set(address, value); },
    async getSigningKey(address: string) { return signingKeys.get(address) ?? null; },
    async removeSigningKey(address: string) { signingKeys.delete(address); },
    async clearSigningKeys() { signingKeys.clear(); },
    async exportPrivateStates() { throw new Error('Private state export is not enabled in this browser session.'); },
    async importPrivateStates() { throw new Error('Private state import is not enabled in this browser session.'); },
    async exportSigningKeys() { throw new Error('Signing key export is not enabled in this browser session.'); },
    async importSigningKeys() { throw new Error('Signing key import is not enabled in this browser session.'); },
  };
}

export function createPatchedPublicDataProvider(indexerUrl: string, subscriptionUrl: string) {
  // Keep the SDK's provider intact: it uses the selected network's GraphQL schema,
  // including transaction watches needed to distinguish submitted from confirmed.
  return indexerPublicDataProvider(indexerUrl, subscriptionUrl);
}

export type ConnectedSession = {
  api: ConnectedAPI;
  config: Configuration;
  network: NetworkId;
  unshieldedAddress: string;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider<any>;
    proofProvider: any;
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  dispose: () => void;
};

function getAddress(value: unknown, key: string): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as any)[key] === 'string') return (value as any)[key];
  throw new Error(`Wallet did not return a ${key}.`);
}

export async function createConnectedSession(api: ConnectedAPI, requestedNetwork?: NetworkId): Promise<ConnectedSession> {
  const [config, unshielded, shielded] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);
  if (requestedNetwork && config.networkId !== requestedNetwork) {
    throw new Error(`Wallet connected to ${config.networkId}, but Atrium requested ${requestedNetwork}. Disconnect it and choose the matching network.`);
  }
  if (config.networkId !== 'preview' && config.networkId !== 'preprod') {
    throw new Error(`Unsupported Midnight network returned by wallet: ${config.networkId}.`);
  }
  const network = config.networkId as NetworkId;
  setNetworkId(network);
  const expected = getNetworkConfig(network);
  const zkConfigProvider = new FetchZkConfigProvider(
    new URL('/managed', window.location.origin).toString(),
    window.fetch.bind(window),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider.asKeyMaterialProvider());
  const proofProvider = createProofProvider(provingProvider as any);
  const unshieldedAddress = getAddress(unshielded, 'unshieldedAddress');
  const shieldedData = shielded as any;
  const privateStateProvider = createPrivateStateProvider();
  const publicDataProvider = createPatchedPublicDataProvider(expected.indexerUrl, expected.indexerWsUrl);
  const walletProvider: WalletProvider = {
    // DApp Connector returns Bech32m keys; Midnight.js parses these for the active network.
    getCoinPublicKey: () => shieldedData.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedData.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any, ttl?: Date) => {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!balanced?.tx || typeof balanced.tx !== 'string') throw new Error('Wallet did not return a balanced transaction.');
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };
  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const identifiers = typeof tx.identifiers === 'function' ? tx.identifiers() : [];
      const txId = identifiers.find((value: unknown) => typeof value === 'string' && value.length > 0);
      if (typeof txId !== 'string') throw new Error('Wallet transaction has no identifier; it was not submitted.');
      await api.submitTransaction(toHex(tx.serialize()));
      // The ID is derived from the finalized transaction, never invented from a UI status.
      return txId as any;
    },
  };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    void privateStateProvider.clear();
    void privateStateProvider.clearSigningKeys();
    try { (provingProvider as any).dispose?.(); } catch { /* provider may not expose dispose */ }
  };
  return { api, config, network, unshieldedAddress, providers: { privateStateProvider, publicDataProvider, zkConfigProvider, proofProvider, walletProvider, midnightProvider }, dispose };
}
