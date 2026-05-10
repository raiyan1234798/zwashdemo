import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency, currencies } from '../../contexts/CurrencyContext';
import { Globe, DollarSign } from 'lucide-react';

export const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' }
];

const LanguageCurrencySelector = () => {
  const { i18n } = useTranslation();
  const { currency, changeCurrency } = useCurrency();

  const handleLanguageChange = (e) => {
    const code = e.target.value;
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    document.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];
  const currentCurr = currencies.find(c => c.code === currency) || currencies[0];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '10px',
      padding: '8px 10px',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Language Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{currentLang.flag}</span>
        <Globe size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
        <select
          value={i18n.language?.split('-')[0] || 'en'}
          onChange={handleLanguageChange}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            outline: 'none',
            flex: 1,
            appearance: 'none',
            WebkitAppearance: 'none'
          }}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code} style={{ background: '#1e2640', color: '#fff' }}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />

      {/* Currency Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#34d399', minWidth: '18px', textAlign: 'center' }}>
          {currentCurr.symbol}
        </span>
        <DollarSign size={14} style={{ color: '#34d399', flexShrink: 0 }} />
        <select
          value={currency}
          onChange={(e) => changeCurrency(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            outline: 'none',
            flex: 1,
            appearance: 'none',
            WebkitAppearance: 'none'
          }}
        >
          {currencies.map((curr) => (
            <option key={curr.code} value={curr.code} style={{ background: '#1e2640', color: '#fff' }}>
              {curr.code} — {curr.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LanguageCurrencySelector;
