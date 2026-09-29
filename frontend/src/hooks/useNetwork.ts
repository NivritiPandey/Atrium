import { useCallback, useEffect, useState } from 'react';
import { getNetwork, getNetworkConfig, isNetworkLocked, setNetwork, subscribeConfig, type NetworkId } from '../config';

export function useNetwork() {
  const [network, setNetworkState] = useState<NetworkId>(getNetwork());
  useEffect(() => subscribeConfig(() => setNetworkState(getNetwork())), []);
  const chooseNetwork = useCallback((next: NetworkId) => {
    if (isNetworkLocked()) throw new Error('Disconnect your wallet before switching networks.');
    setNetwork(next); setNetworkState(next);
  }, []);
  return { network, networkConfig: getNetworkConfig(network), chooseNetwork, isLocked: isNetworkLocked() };
}
