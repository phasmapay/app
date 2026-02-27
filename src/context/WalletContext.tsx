import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  connect as signerConnect,
  disconnect as signerDisconnect,
  getPublicKey as signerPubkey,
  getSignerType,
  restoreFromStorage,
  SignerType,
} from '../services/signer';
import { loadAuthToken, clearAuthToken } from '../services/storage';
import { initTorque } from '../services/torque';

type WalletState = {
  publicKey: PublicKey | null;
  authToken: string | null;
  signerType: SignerType | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletState>({
  publicKey: null,
  authToken: null,
  signerType: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [signerType, setSignerType] = useState<SignerType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore session on mount — populate cachedSigner without opening wallet
  useEffect(() => {
    loadAuthToken().then((stored) => {
      if (stored) {
        setPublicKey(new PublicKey(stored.address));
        setAuthToken(stored.token);
        setSignerType('mwa');
        restoreFromStorage(stored.address, stored.token);
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Tries Seed Vault first (in-process, no app switch), falls back to MWA
      const result = await signerConnect();
      console.log(`[Wallet] Connected via ${result.type}: ${result.publicKey.toBase58()}`);
      setPublicKey(result.publicKey);
      setSignerType(result.type);
      setAuthToken('connected'); // placeholder — signer manages its own auth
      // Init Torque loyalty tracking in background (non-blocking)
      initTorque().catch(() => {});
    } catch (e) {
      console.warn('[Wallet] Connect error:', String(e));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    signerDisconnect();
    setPublicKey(null);
    setAuthToken(null);
    setSignerType(null);
    await clearAuthToken();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        authToken,
        signerType,
        isConnected: !!publicKey,
        isConnecting,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
