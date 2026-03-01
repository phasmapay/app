import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadMerchantConfig, saveMerchantConfig } from '../services/storage';

type AppMode = 'customer' | 'merchant';

type ModeContextType = {
  mode: AppMode;
  toggleMode: () => void;
  setMode: (mode: AppMode) => void;
  businessName: string;
  setBusinessName: (name: string) => void;
};

const ModeContext = createContext<ModeContextType>({
  mode: 'customer',
  toggleMode: () => {},
  setMode: () => {},
  businessName: '',
  setBusinessName: () => {},
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('customer');
  const [businessName, setBusinessNameState] = useState('');

  useEffect(() => {
    loadMerchantConfig().then(config => {
      if (config.enabled) setModeState('merchant');
      if (config.businessName) setBusinessNameState(config.businessName);
    });
  }, []);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    saveMerchantConfig({ enabled: newMode === 'merchant', businessName }).catch(() => {});
  };

  const toggleMode = () => {
    const newMode = mode === 'customer' ? 'merchant' : 'customer';
    setMode(newMode);
  };

  const setBusinessName = (name: string) => {
    setBusinessNameState(name);
    saveMerchantConfig({ enabled: mode === 'merchant', businessName: name }).catch(() => {});
  };

  return (
    <ModeContext.Provider value={{ mode, toggleMode, setMode, businessName, setBusinessName }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
