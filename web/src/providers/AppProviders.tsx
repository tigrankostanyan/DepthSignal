import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserDTO } from '../types/api.js';
import { getMe } from '../lib/api/auth.js';

interface AppContextType {
  user: UserDTO | null;
  setUser: (user: UserDTO | null) => void;
  activeExchange: string;
  setActiveExchange: (exchange: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [activeExchange, setActiveExchange] = useState<string>('BINANCE');

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <AppContext.Provider value={{ user, setUser, activeExchange, setActiveExchange }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProviders');
  }
  return context;
}
