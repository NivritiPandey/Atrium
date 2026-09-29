import { useCallback, useEffect, useRef, useState } from 'react';
import { ledger } from '../managed/contract/index.js';
import { getContractAddress, getNetwork, getNetworkConfig, subscribeConfig, type NetworkId } from '../config';
import { createPatchedPublicDataProvider } from '../lib/midnight';

const providers = new Map<NetworkId, ReturnType<typeof createPatchedPublicDataProvider>>();
function getProvider(network: NetworkId) {
  let provider = providers.get(network);
  if (!provider) {
    const config = getNetworkConfig(network);
    provider = createPatchedPublicDataProvider(config.indexerUrl, config.indexerWsUrl);
    providers.set(network, provider);
  }
  return provider;
}

export function useContractState(interval = 5000, requestedAddress?: string) {
  const [ledgerState, setLedgerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [network, setNetworkState] = useState<NetworkId>(getNetwork());
  const sequence = useRef(0);
  const address = requestedAddress === undefined ? getContractAddress(network) : requestedAddress.trim();

  useEffect(() => subscribeConfig(() => setNetworkState(getNetwork())), []);
  const refetch = useCallback(async () => {
    const request = ++sequence.current;
    const targetNetwork = network;
    const targetAddress = requestedAddress === undefined ? getContractAddress(targetNetwork) : requestedAddress.trim();
    if (!targetAddress) {
      if (request === sequence.current) { setIsLoading(false); setLedgerState(null); setError(null); }
      return;
    }
    if (request === sequence.current) setIsLoading(true);
    try {
      const state = await getProvider(targetNetwork).queryContractState(targetAddress);
      if (request !== sequence.current || targetNetwork !== getNetwork()) return;
      setLedgerState(state?.data ? ledger(state.data) : null);
      setError(null); setLastUpdate(new Date());
    } catch (cause: any) {
      if (request === sequence.current && targetNetwork === getNetwork()) setError(cause?.message || 'Unable to read the Midnight indexer.');
    } finally {
      if (request === sequence.current) setIsLoading(false);
    }
  }, [network, requestedAddress]);
  useEffect(() => {
    void refetch();
    const timer = window.setInterval(() => void refetch(), interval);
    return () => { sequence.current += 1; window.clearInterval(timer); };
  }, [refetch, interval]);
  return { ledgerState, isLoading, error, lastUpdate, refetch, address, network };
}
