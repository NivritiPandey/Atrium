import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import '@midnight-ntwrk/dapp-connector-api';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { getNetwork, lockNetwork, setNetwork, type NetworkId } from '../config';
import { createConnectedSession, type ConnectedSession } from '../lib/midnight';
import { userFacingError } from '../lib/validation';
import { clearPrivateMemory } from '../lib/private-memory';

export type WalletStatus = 'checking' | 'detected' | 'not-found';
export type WalletType = '1am' | 'lace' | 'other' | null;
export type WalletEntry = { id: string; name: string; api: InitialAPI };
export type WalletContextValue = {
  address: string | null;
  isConnected: boolean;
  walletType: WalletType;
  walletName: string | null;
  walletStatus: WalletStatus;
  network: NetworkId;
  isConnecting: boolean;
  session: ConnectedSession | null;
  availableWallets: WalletEntry[];
  error: string | null;
  clearError: () => void;
  connect: (network?: NetworkId, walletId?: string) => Promise<ConnectedSession | undefined>;
  disconnect: () => void;
};
const WalletContext = createContext<WalletContextValue | null>(null);

export function listInjectedWallets(): WalletEntry[] {
  if (typeof window === 'undefined' || !window.midnight) return [];
  return Object.entries(window.midnight)
    .filter(([, api]) => api && typeof api.connect === 'function')
    .map(([id, api]) => ({ id, api, name: api.name || (id.toLowerCase().includes('lace') ? 'Lace Wallet' : id === '1am' ? '1AM Wallet' : id) }));
}

function classifyWallet(id: string): WalletType {
  const normalized = id.toLowerCase();
  return normalized.includes('lace') ? 'lace' : normalized === '1am' || normalized.includes('1am') ? '1am' : 'other';
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('checking');
  const [availableWallets, setAvailableWallets] = useState<WalletEntry[]>([]);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [network, setNetworkState] = useState<NetworkId>(getNetwork());
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connecting = useRef(false);
  const networkRelease = useRef<(() => void) | null>(null);
  const sessionRef = useRef<ConnectedSession | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const detect = useCallback((timeout = 6000) => {
    if (typeof window === 'undefined') return () => {};
    const started = Date.now();
    const check = () => {
      const wallets = listInjectedWallets();
      if (wallets.length) {
        setAvailableWallets(wallets); setWalletStatus('detected'); return true;
      }
      if (Date.now() - started >= timeout) { setAvailableWallets([]); setWalletStatus('not-found'); return true; }
      return false;
    };
    if (check()) return () => {};
    const id = window.setInterval(() => { if (check()) window.clearInterval(id); }, 250);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => detect(), [detect]);
  useEffect(() => {
    const onConfig = () => setNetworkState(getNetwork());
    window.addEventListener('atrium:configuration', onConfig);
    return () => window.removeEventListener('atrium:configuration', onConfig);
  }, []);

  const disconnect = useCallback(() => {
    sessionRef.current?.dispose();
    clearPrivateMemory();
    sessionRef.current = null;
    setSession(null); setAddress(null); setWalletName(null); setWalletType(null);
    networkRelease.current?.(); networkRelease.current = null;
    setError(null); setWalletStatus('checking');
    detect(3000);
  }, [detect]);

  const connect = useCallback(async (requested: NetworkId = getNetwork(), walletId?: string) => {
    if (connecting.current) return undefined;
    if (sessionRef.current) {
      if (sessionRef.current.network === requested) return sessionRef.current;
      setError('Disconnect your wallet before switching networks.');
      return undefined;
    }
    connecting.current = true; setIsConnecting(true); setError(null);
    const release = lockNetwork();
    try {
      setNetwork(requested);
      setNetworkState(requested);
      const wallets = listInjectedWallets();
      if (!wallets.length) throw new Error('Install a Midnight-compatible wallet such as Lace or 1AM first.');
      const chosen = wallets.find((item) => item.id === walletId) || wallets.find((item) => classifyWallet(item.id) === 'lace') || wallets[0];
      const api: ConnectedAPI = await chosen.api.connect(requested);
      const connected = await createConnectedSession(api, requested);
      sessionRef.current = connected;
      networkRelease.current = release;
      setSession(connected); setAddress(connected.unshieldedAddress); setWalletName(chosen.name); setWalletType(classifyWallet(chosen.id));
      setError(null);
      return connected;
    } catch (cause) {
      release();
      setError(userFacingError(cause, 'Wallet connection failed. Verify the selected network in your wallet and try again.'));
      return undefined;
    } finally {
      connecting.current = false; setIsConnecting(false);
    }
  }, []);

  return <WalletContext.Provider value={{ address, isConnected: Boolean(session), walletType, walletName, walletStatus, network, isConnecting, session, availableWallets, error, clearError, connect, disconnect }}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
}
