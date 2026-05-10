import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const CurrencyContext = createContext();

export const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Rial' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
  { code: 'COP', symbol: '$', name: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' }
];

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState(localStorage.getItem('currency') || 'INR');
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchRates = async () => {
    try {
      // Using a reliable free exchange rate API
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/USD`);
      setRates(response.data.rates);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching currency rates:', error);
      // Fallback rates if API fails
      setRates({
        USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.3, AED: 3.67, SAR: 3.75, KWD: 0.31
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // Update rates every 1 hour
    const interval = setInterval(fetchRates, 3600000);
    return () => clearInterval(interval);
  }, []);

  const changeCurrency = (code) => {
    setCurrency(code);
    localStorage.setItem('currency', code);
  };

  const convert = (amount, from = 'INR') => {
    if (loading || !rates[currency] || !rates[from]) return amount;
    // Convert from 'from' to USD first, then to target currency
    const amountInUSD = amount / rates[from];
    return amountInUSD * rates[currency];
  };

  const formatCurrency = (amount, from = 'INR') => {
    const converted = convert(amount, from);
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(converted);
  };

  const formatPlanPrice = (usdPrice) => {
    const rates = {
      USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.3, AED: 3.67, SAR: 3.75, 
      JPY: 151.4, CNY: 7.23, KWD: 0.31, QAR: 3.64, AUD: 1.52, CAD: 1.36, 
      CHF: 0.90, TRY: 32.2, SGD: 1.35, HKD: 7.82, BRL: 5.06, RUB: 92.5, 
      ZAR: 18.8, MXN: 16.5, MYR: 4.74, THB: 36.4, IDR: 15890, PHP: 56.2, 
      VND: 24800, NZD: 1.66, KRW: 1350, EGP: 47.3, BHD: 0.38, OMR: 0.38,
      SEK: 10.6, NOK: 10.7, DKK: 6.9, PLN: 3.9, ILS: 3.7, HUF: 360, 
      CZK: 23.4, RON: 4.6, CLP: 940, COP: 3800, PEN: 3.7, PKR: 278, BDT: 110
    };

    // PPP Adjustment Factors to keep prices "premium" across different markets
    const pppFactors = {
      // Tier 1: Advanced Economies
      USD: 1.0, EUR: 1.0, GBP: 1.0, AUD: 1.0, CAD: 1.0, CHF: 1.1, JPY: 0.9, SGD: 1.1, HKD: 1.0, NZD: 1.0,
      SEK: 1.0, NOK: 1.1, DKK: 1.0, ILS: 1.1,
      // Tier 2: Emerging/Gulf (High Value)
      AED: 1.0, SAR: 0.95, KWD: 1.0, QAR: 1.0, BHD: 0.95, OMR: 0.95,
      // Tier 3: Developing (Higher adjustment to avoid "too low" prices)
      INR: 0.8, TRY: 0.75, BRL: 0.8, RUB: 0.8, ZAR: 0.8, MXN: 0.85, MYR: 0.8, THB: 0.8, 
      IDR: 0.7, PHP: 0.7, VND: 0.7, EGP: 0.65, PKR: 0.6, BDT: 0.6, 
      PLN: 0.85, HUF: 0.8, CZK: 0.85, RON: 0.8, CLP: 0.8, COP: 0.75, PEN: 0.8
    };
    
    const rate = rates[currency] || 1;
    const factor = pppFactors[currency] || 1.0;
    
    // We multiply by the factor to adjust the base USD price for that market
    // If factor is 0.8, it means we charge 80% of the USD equivalent, but never too low.
    const adjustedUsdPrice = usdPrice * factor;
    const converted = adjustedUsdPrice * rate;
    
    const symbol = currencies.find(c => c.code === currency)?.symbol || '$';
    
    // Round to clean numbers (not too specific)
    let finalPrice;
    if (converted < 10) finalPrice = Math.round(converted * 10) / 10;
    else if (converted < 100) finalPrice = Math.round(converted);
    else if (converted < 1000) finalPrice = Math.floor(converted / 5) * 5;
    else if (converted < 10000) finalPrice = Math.floor(converted / 50) * 50;
    else finalPrice = Math.floor(converted / 100) * 100;

    return `${symbol}${finalPrice.toLocaleString()}`;
  };

  const currentCurrency = currencies.find(c => c.code === currency) || currencies[0];
  
  const value = {
    currency,
    currentCurrency,
    rates,
    changeCurrency,
    formatCurrency,
    formatPlanPrice,
    convert,
    loading
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};
