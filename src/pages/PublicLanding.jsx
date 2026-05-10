import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Zap, ShieldCheck, Crown, Car, Users, BarChart3, Calendar, Star, CheckCircle, ArrowRight, Globe, Phone, Mail } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import { useCurrency, currencies } from '../contexts/CurrencyContext';

const getTranslatedPlans = (t) => ({
  basic: {
    name: t('plan_basic', 'Basic'), icon: Zap, color: '#10b981', basePrice: 19,
    features: [
      t('feat_dashboard', 'Dashboard'), 
      t('feat_booking', 'Booking Management'), 
      t('feat_calendar', 'Calendar View'), 
      t('feat_services', 'Services Catalog'), 
      t('feat_customers', 'Customer Records'), 
      t('feat_settings', 'Settings')
    ],
    userLimit: 5
  },
  standard: {
    name: t('plan_standard', 'Standard'), icon: ShieldCheck, color: '#3b82f6', basePrice: 49,
    features: [
      t('feat_everything_basic', 'Everything in Basic'), 
      t('feat_invoicing', 'Invoicing & Finance'), 
      t('feat_expenses', 'Expense Tracking'), 
      t('feat_analytics', 'Analytics & Reports'), 
      t('feat_amc', 'AMC Plans'), 
      t('feat_user_limit_15', 'Up to 15 users')
    ],
    userLimit: 15
  },
  premium: {
    name: t('plan_premium', 'Premium'), icon: Crown, color: '#f59e0b', basePrice: 99,
    features: [
      t('feat_everything_standard', 'Everything in Standard'), 
      t('feat_payroll', 'Payroll Management'), 
      t('feat_attendance', 'Attendance System'), 
      t('feat_inventory', 'Inventory & Materials'), 
      t('feat_crm', 'CRM & History'), 
      t('feat_audit', 'Audit Logs'), 
      t('feat_user_limit_50', 'Up to 50 users')
    ],
    userLimit: 50
  }
});

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

export default function PublicLanding() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  const { currency, changeCurrency, formatPlanPrice } = useCurrency();
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);

  const handleLanguageChange = (e) => {
    const code = e.target.value;
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    document.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  useEffect(() => {
    fetchActiveTenants();
    // Animate counters
    animateCounters();
  }, []);

  const fetchActiveTenants = async () => {
    try {
      const q = query(collection(db, 'demoClients'), where('active', '==', true));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => {
        if (t.expiresAt && new Date(t.expiresAt) < new Date()) return false;
        return true;
      });
      setTenants(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const animateCounters = () => {
    const counters = document.querySelectorAll('.counter-val');
    counters.forEach(counter => {
      const target = parseInt(counter.dataset.target || 0);
      let current = 0;
      const step = Math.ceil(target / 40);
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        counter.textContent = current + (counter.dataset.suffix || '');
        if (current >= target) clearInterval(timer);
      }, 30);
    });
  };

  const hasBooking = (tenant) =>
    tenant.permissions?.bookings === true ||
    (Array.isArray(tenant.features) && tenant.features.includes('bookings'));

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '0 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Zwash" style={{ height: 36 }} onError={e => e.target.style.display = 'none'} />
          <span style={{ fontWeight: 900, fontSize: '1.3rem', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ZWASH</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="#about" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>{t('about', 'About')}</a>
          <a href="#plans" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>{t('plans', 'Plans')}</a>
          <a href="#tenants" style={{ color: '#475569', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>{t('partners', 'Our Partners')}</a>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f1f5f9', padding: '4px 10px', borderRadius: 20 }}>
            <select value={i18n.language?.split('-')[0] || 'en'} onChange={handleLanguageChange} style={{ background: 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#334155', outline: 'none', cursor: 'pointer' }}>
              {languages.map(l => <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>)}
            </select>
            <div style={{ width: 1, height: 14, background: '#cbd5e1' }} />
            <select value={currency} onChange={e => changeCurrency(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#334155', outline: 'none', cursor: 'pointer' }}>
              {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>

          <Link to="/contact" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: 'white', padding: '8px 20px', borderRadius: 24, textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}>
            {t('enquiries', 'Enquiries')}
          </Link>
        </div>
      </nav>

      {/* HERO — full-screen background video */}
      <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 5% 80px', overflow: 'hidden' }}>

        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 0,
          }}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay so text stays readable */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.82) 0%, rgba(30,27,75,0.78) 50%, rgba(12,74,110,0.80) 100%)', zIndex: 1 }} />

        {/* Floating colour blobs on top of video */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 2, pointerEvents: 'none' }}>
          {[{ top: '10%', left: '5%', s: 400, c: '#6366f1' }, { top: '50%', right: '5%', s: 300, c: '#0ea5e9' }, { bottom: '10%', left: '30%', s: 350, c: '#8b5cf6' }].map((b, i) => (
            <div key={i} style={{ position: 'absolute', top: b.top, left: b.left, right: b.right, bottom: b.bottom, width: b.s, height: b.s, borderRadius: '50%', background: b.c, opacity: 0.08, filter: 'blur(80px)', animation: `float ${3 + i}s ease-in-out infinite alternate` }} />
          ))}
        </div>

        {/* Stats Section */}
      <section style={{ padding: '60px 20px', background: '#0f172a', color: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: 8, background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>0+</div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('active_businesses', 'Active Businesses')}</div>
          </div>
          <div>
            <div style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: 8, background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>98%</div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('uptime', 'Uptime')}</div>
          </div>
          <div>
            <div style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: 8, background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>15min</div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('setup_time', 'Setup Time')}</div>
          </div>
        </div>
      </section>

      {/* Why Zwash Section */}
      <section id="about" style={{ padding: '100px 20px', background: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div className="why-zwash-content">
            <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '6px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, display: 'inline-block', marginBottom: 20 }}>
              {t('about_the_platform', 'ABOUT THE PLATFORM')}
            </span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 24, lineHeight: 1.2 }}>
              {t('why_zwash_title', 'Why Zwash is the #1 Choice for Car Wash Owners')}
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
              {t('why_zwash_desc', 'Running a car wash is chaotic. Between managing staff, dealing with customer disputes over pre-existing damage, and preventing inventory theft, it\'s hard to focus on growth.')}
            </p>
            <p style={{ fontSize: '1.1rem', color: '#64748b', lineHeight: 1.6, marginBottom: 32 }}>
              {t('why_zwash_solution', 'Zwash ERP solves this. From our Pre-Wash Vehicle Inspection module that logs damage before you touch a car, to an automated payroll and booking engine, Zwash brings enterprise-grade management to your local wash.')}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                'feature_inspection',
                'feature_leak',
                'feature_booking',
                'feature_multi'
              ].map((key, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
                    <CheckCircle size={20} />
                  </div>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: -20, left: -20, right: 20, bottom: 20, background: '#eef2ff', borderRadius: 40, zIndex: 0 }}></div>
            <img 
              src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=1200" 
              alt="Zwash Platform" 
              style={{ width: '100%', borderRadius: 32, position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
            />
          </div>
        </div>
      </section>

      {/* Plans Section */}
        <div style={{ position: 'relative', zIndex: 3, maxWidth: 800 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.45)', borderRadius: 24, padding: '6px 16px', marginBottom: 24 }}>
            <Star size={14} color="#a78bfa" />
            <span style={{ color: '#a78bfa', fontSize: '0.82rem', fontWeight: 600 }}>{t('hero_badge', 'Multi-Tenant Car Wash ERP Platform')}</span>
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem,6vw,4.5rem)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px', textShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
            {t('hero_title_1', 'Run Your Car Wash')}<br />
            <span style={{ background: 'linear-gradient(90deg,#38bdf8,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('hero_title_2', 'Like a Pro Business')}</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', lineHeight: 1.7, margin: '0 auto 40px', maxWidth: 600, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            {t('hero_desc', 'Complete ERP with bookings, payroll, inventory and more. Multi-tenant, fully isolated — one platform for every car wash business.')}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#tenants" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: 'white', padding: '14px 32px', borderRadius: 32, textDecoration: 'none', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
              {t('book_now', 'Book a Car Wash')} <ArrowRight size={18} />
            </a>
            <a href="#plans" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '14px 32px', borderRadius: 32, textDecoration: 'none', fontWeight: 600, fontSize: '1rem', backdropFilter: 'blur(12px)' }}>
              {t('view_plans', 'View Plans')}
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 64, flexWrap: 'wrap' }}>
            {[{ val: tenants.length, suffix: '+', label: 'Active Businesses' }, { val: 98, suffix: '%', label: 'Uptime' }, { val: 15, suffix: 'min', label: 'Setup Time' }].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                  <span className="counter-val" data-target={s.val} data-suffix={s.suffix}>{s.val}{s.suffix}</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT ZWASH ERP */}
      <section id="about" style={{ padding: '100px 5%', background: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 500px' }}>
            <div style={{ display: 'inline-block', background: '#e0e7ff', color: '#4f46e5', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem', marginBottom: 16 }}>ABOUT THE PLATFORM</div>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#0f172a', marginBottom: 24, lineHeight: 1.2 }}>Why Zwash is the #1 Choice for Car Wash Owners</h2>
            <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 24 }}>
              Running a car wash is chaotic. Between managing staff, dealing with customer disputes over pre-existing damage, and preventing inventory theft, it's hard to focus on growth.
            </p>
            <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 32 }}>
              Zwash ERP solves this. From our <strong>Pre-Wash Vehicle Inspection module</strong> that logs damage before you touch a car, to an automated payroll and booking engine, Zwash brings enterprise-grade management to your local wash. 
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Prevent liability claims with detailed damage inspections', 'Stop revenue leaks with automated material tracking', 'Get your own customized public booking page', 'Manage multiple locations and employees from one dashboard'].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: '#334155', fontWeight: 600 }}>
                  <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: '1 1 500px', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -20, background: 'linear-gradient(135deg,#e0e7ff,#dbeafe)', borderRadius: 32, transform: 'rotate(-3deg)', zIndex: 0 }}></div>
            <img src="/about-erp.png" alt="Car wash owner using Zwash ERP" style={{ width: '100%', borderRadius: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.12)', position: 'relative', zIndex: 1, objectFit: 'cover', aspectRatio: '1/1' }} />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '100px 5%', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#0f172a' }}>{t('features_title', 'Everything You Need to Manage Your Car Wash')}</h2>
          <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: 12 }}>{t('features_subtitle', 'One platform, every feature — from booking to payroll')}</p>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {[
            { icon: Calendar, color: '#0ea5e9', title: t('feat_booking_title', 'Smart Booking Calendar'), desc: t('feat_booking_desc', 'Real-time slot management with automatic conflict detection and duration-based scheduling') },
            { icon: BarChart3, color: '#6366f1', title: t('feat_analytics_title', 'Analytics & Reports'), desc: t('feat_analytics_desc', 'Daily, weekly revenue charts, employee performance, material usage — fully visual') },
            { icon: Users, color: '#8b5cf6', title: t('feat_team_title', 'Team Management'), desc: t('feat_team_desc', 'Role-based access, payroll, attendance tracking, performance scoring') },
            { icon: Car, color: '#f59e0b', title: t('feat_vehicle_title', 'Multi-Vehicle Support'), desc: t('feat_vehicle_desc', 'Hatchback to superbike — per-vehicle pricing with AMC subscription plans') },
            { icon: ShieldCheck, color: '#10b981', title: t('feat_isolation_title', 'Tenant Isolation'), desc: t('feat_isolation_desc', 'Every company\'s data is 100% isolated. No cross-contamination, ever') },
            { icon: Globe, color: '#ec4899', title: t('feat_public_title', 'Public Booking Page'), desc: t('feat_public_desc', 'Each company gets their own branded booking page customers can use directly') },
          ].map((f, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', transition: 'all 0.3s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: f.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <f.icon size={24} color={f.color} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANS */}
      <section id="plans" style={{ padding: '100px 5%', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: 'white' }}>{t('pricing_title', 'Simple, Transparent Pricing')}</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.05rem', marginTop: 12 }}>{t('pricing_subtitle', 'Choose the plan that fits your car wash business')}</p>
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
          {Object.entries(getTranslatedPlans(t)).map(([key, plan]) => {
            const isPopular = key === 'standard';
            return (
              <div key={key} style={{ background: isPopular ? 'linear-gradient(135deg,#6366f1,#0ea5e9)' : 'rgba(255,255,255,0.05)', border: isPopular ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 36, position: 'relative', transform: isPopular ? 'scale(1.04)' : 'none' }}>
                {isPopular && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', fontSize: '0.72rem', fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>MOST POPULAR</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <plan.icon size={22} color={isPopular ? 'white' : plan.color} />
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>{plan.name}</span>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>{formatPlanPrice(plan.basePrice)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>/{t('month', 'month')}</span>
                </div>
                <div style={{ marginBottom: 8, color: isPopular ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Up to {plan.userLimit} users</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 28px' }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: isPopular ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginBottom: 10 }}>
                      <CheckCircle size={15} color={isPopular ? 'white' : plan.color} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setShowEnquiryModal(true)} style={{ display: 'block', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'center', padding: '12px', borderRadius: 14, background: isPopular ? 'rgba(255,255,255,0.25)' : plan.color, color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                  {t('get_started', 'Get Started')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* LIVE TENANTS */}
      <section id="tenants" style={{ padding: '100px 5%', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#0f172a' }}>{t('partner_washes_title', 'Book at Our Partner Car Washes')}</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: 12 }}>{t('partner_washes_subtitle', 'Real businesses running on Zwash — book directly online')}</p>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading partners...</div>
          ) : tenants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <Car size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No partners listed yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>
              {tenants.map(tenant => {
                const canBook = hasBooking(tenant);
                const planColors = { basic: '#10b981', standard: '#3b82f6', premium: '#f59e0b' };
                const planColor = planColors[tenant.plan] || '#10b981';
                return (
                  <div key={tenant.id} style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1px solid #e2e8f0', transition: 'all 0.3s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}>
                    {/* Header band */}
                    <div style={{ height: 6, background: `linear-gradient(90deg,${planColor},${planColor}88)` }} />
                    <div style={{ padding: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        {tenant.logoURL ? (
                          <img src={tenant.logoURL} alt={tenant.companyName} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'contain', border: '1px solid #e2e8f0', padding: 4 }} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg,${planColor},${planColor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.3rem' }}>
                            {tenant.companyName?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{tenant.companyName}</div>
                          {tenant.country && <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Globe size={12} />{tenant.country}</div>}
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize', background: planColor + '18', color: planColor, padding: '3px 10px', borderRadius: 20 }}>{tenant.plan || 'basic'}</span>
                      </div>
                      {canBook ? (
                        <Link to={`/book/${tenant.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: `linear-gradient(135deg,${planColor},${planColor}cc)`, color: 'white', padding: '11px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem' }}>
                          <Calendar size={15} /> {t('book_now', 'Book Now')} <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '11px', borderRadius: 12, background: '#f1f5f9', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 500 }}>
                          {t('online_booking_soon', 'Online Booking Coming Soon')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0f172a', padding: '60px 5%', textAlign: 'center' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
            <span style={{ fontWeight: 900, fontSize: '1.5rem', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('brand_name', 'ZWASH ERP')}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ background: 'white', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
                  <path fill="#34A853" d="M22 6v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6l10 7 10-7z"/>
                  <path fill="#EA4335" d="M2 6l10 7 10-7V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v0z"/>
                  <path fill="#FBBC05" d="M2 18l7.5-5.25L2 6v12z"/>
                  <path fill="#FBBC05" d="M22 6l-7.5 6.75L22 18V6z"/>
                </svg>
              </div>
              <a href="mailto:Zwash.office@gmail.com" style={{ color: 'white', textDecoration: 'none', fontSize: '1.1rem', fontWeight: 600 }}>Zwash.office@gmail.com</a>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '50%', color: '#38bdf8' }}>
                <Phone size={18} />
              </div>
              <a href="tel:8838157898" style={{ color: 'white', textDecoration: 'none', fontSize: '1.1rem', fontWeight: 600 }}>8838157898</a>
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', margin: 0, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            © {new Date().getFullYear()} {t('footer_tagline', 'Zwash. All-in-one car wash management platform.')}
          </p>
        </div>
      </footer>

      {showEnquiryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 40, maxWidth: 500, width: '100%', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowEnquiryModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            <div style={{ width: 64, height: 64, background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#3b82f6' }}>
              <Mail size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>{t('enquiry_title', 'Start Your 14-Day Free Trial')}</h2>
            <p style={{ color: '#64748b', marginBottom: 32 }}>{t('enquiry_desc', 'Join 50+ car wash businesses using Zwash to scale their operations. No credit card required.')}</p>
            
            <form onSubmit={(e) => { e.preventDefault(); alert(t('enquiry_sent', 'Thank you! Our team will contact you shortly.')); setShowEnquiryModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" required placeholder={t('name_placeholder', 'Full Name')} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} />
              <input type="email" required placeholder={t('email_placeholder', 'Work Email')} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} />
              <input type="tel" required placeholder={t('phone_placeholder', 'Phone Number')} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} />
              <button type="submit" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: 'white', padding: '14px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 8 }}>
                {t('submit_enquiry', 'Submit Enquiry')}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float { from { transform: translateY(0) scale(1); } to { transform: translateY(-20px) scale(1.05); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}
