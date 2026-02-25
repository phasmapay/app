import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { APP_IDENTITY } from '../utils/constants';
import { saveAuthToken, loadAuthToken, clearAuthToken } from '../services/storage';

type WalletState = {
  publicKey: PublicKey | null;
  authToken: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletState>({
  publicKey: null,
  authToken: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore session on mount
  useEffect(() => {
    loadAuthToken().then((stored) => {
      if (stored) {
        setPublicKey(new PublicKey(stored.address));
        setAuthToken(stored.token);
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await transact(async (wallet) => {
        const auth = await wallet.authorize({
          cluster: 'solana:devnet',
          identity: APP_IDENTITY,
        });
        const address = auth.accounts[0].address;
        const token = auth.auth_token;

        setPublicKey(new PublicKey(address));
        setAuthToken(token);
        await saveAuthToken(token, address);
      });
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setPublicKey(null);
    setAuthToken(null);
    await clearAuthToken();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        authToken,
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
