import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import en from '../locales/en';
import te from '../locales/te';
import hi from '../locales/hi';

const SUPPORTED_LANGUAGES = ['en', 'te', 'hi'];
const STORAGE_KEY = 'neuroscan_language';

const DICTIONARIES = {
  en,
  te,
  hi,
};

const LOCALE_MAP = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
};

// Safe language validator adhering to Requirement 1
function validateLanguage(lang) {
  if (lang && SUPPORTED_LANGUAGES.includes(lang)) {
    return lang;
  }
  return 'en';
}

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  translateClass: (cls) => cls,
  translateStage: (num) => `Stage ${num}`,
  formatDate: (d) => String(d),
  formatNumber: (n) => String(n),
  locale: 'en-IN',
  isRTL: false,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return validateLanguage(stored);
    } catch {
      return 'en';
    }
  });

  const setLanguage = useCallback((newLang) => {
    const valid = validateLanguage(newLang);
    setLanguageState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, valid);
      document.documentElement.lang = valid;
    } catch {
      // Storage unavailable fallback
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /**
   * Helper to retrieve nested keys like 'nav.dashboard'
   */
  const resolveKey = useCallback((dict, keyPath) => {
    if (!dict || !keyPath) return undefined;
    const parts = keyPath.split('.');
    let curr = dict;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        return undefined;
      }
    }
    return curr;
  }, []);

  /**
   * Translation function with strict fallback cascade:
   * 1. Active language dictionary
   * 2. English dictionary
   * 3. Fallback string / Key itself
   * Interpolates {param} placeholders.
   */
  const t = useCallback((key, params = {}, defaultVal = null) => {
    if (!key) return '';

    const activeDict = DICTIONARIES[language] || DICTIONARIES.en;
    let text = resolveKey(activeDict, key);

    // Fallback to English if missing or empty in active language
    if ((text === undefined || text === null || text === '') && language !== 'en') {
      text = resolveKey(DICTIONARIES.en, key);
    }

    // Final fallback to defaultVal or key
    if (text === undefined || text === null) {
      text = defaultVal !== null ? defaultVal : key;
    }

    if (typeof text !== 'string') {
      return text;
    }

    // Interpolate {key} parameters
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((pKey) => {
        text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), params[pKey]);
      });
    }

    return text;
  }, [language, resolveKey]);

  /**
   * Translates canonical ML classes for presentation while preserving the model identifier
   */
  const translateClass = useCallback((canonicalClass) => {
    if (!canonicalClass) return '';
    const key = `prediction.classes.${canonicalClass}`;
    return t(key, {}, canonicalClass);
  }, [t]);

  /**
   * Translates Stage numbers (1 to 4)
   */
  const translateStage = useCallback((stageNum) => {
    return t('prediction.stage_badge', { number: stageNum }, `Stage ${stageNum}`);
  }, [t]);

  /**
   * Locale-aware date formatting
   */
  const formatDate = useCallback((date, options = {}) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const loc = LOCALE_MAP[language] || 'en-IN';
    try {
      return new Intl.DateTimeFormat(loc, options).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  }, [language]);

  /**
   * Locale-aware number formatting
   */
  const formatNumber = useCallback((number, options = {}) => {
    if (typeof number !== 'number' && isNaN(Number(number))) return String(number);
    const loc = LOCALE_MAP[language] || 'en-IN';
    try {
      return new Intl.NumberFormat(loc, options).format(Number(number));
    } catch {
      return String(number);
    }
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    translateClass,
    translateStage,
    formatDate,
    formatNumber,
    locale: LOCALE_MAP[language] || 'en-IN',
    isRTL: false,
  }), [language, setLanguage, t, translateClass, translateStage, formatDate, formatNumber]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
