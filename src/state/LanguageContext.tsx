/**
 * Global language toggle (en-US <-> fr-FR), persisted to AsyncStorage so the
 * choice survives app restarts.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguageCode } from '../config/env';

const KEY = 'bold-ai:language';

interface Ctx {
  language: LanguageCode;
  setLanguage: (l: LanguageCode) => void;
  ready: boolean;
}

const LanguageContext = createContext<Ctx>({
  language: 'en-US',
  setLanguage: () => {},
  ready: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<LanguageCode>('en-US');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'en-US' || v === 'fr-FR') setLang(v);
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback((l: LanguageCode) => {
    setLang(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, ready }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
