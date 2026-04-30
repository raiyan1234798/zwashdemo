import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowRight, Building2, TrendingUp, Users, Zap, Globe, CheckCircle } from 'lucide-react';

/* ── Animated counter hook ── */
const useCounter = (target, duration = 2000) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
          start += step;
          if (start >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(start));
        }, 16);
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return [count, ref];
};

const Login = () => {
  const { user, userProfile, loading, error, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [btnHover, setBtnHover] = useState(false);

  const [countBiz, refBiz] = useCounter(500, 1800);
  const [countCountries, refCountries] = useCounter(12, 1400);
  const [countUptime, refUptime] = useCounter(99, 1600);

  useEffect(() => {
    if (user && userProfile && !userProfile.needsOnboarding) navigate('/');
  }, [user, userProfile, navigate]);

  if (user && userProfile?.needsOnboarding) return <OnboardingForm />;

  return (
    <div className="login-page" style={s.page}>
      <style>{css}</style>

      {/* ── Left Panel ── */}
      <div className="login-left" style={s.left}>
        {/* Animated gradient orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        {/* Grid overlay */}
        <div style={s.gridOverlay} />

        <div style={s.leftInner}>
          {/* Logo */}
          <div style={s.logoRow}>
            <div style={s.logoContainer}>
              <img src="/detail.png" alt="Zwash" style={s.logo} />
            </div>
            <div>
              <div style={s.logoText}>ZWASH</div>
              <div style={s.logoSub}>Enterprise Platform</div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="login-headline" style={s.headline}>
            The Operating System for <span style={s.headlineAccent}>Premium Car Care</span>
          </h1>
          <p style={s.subhead}>
            Trusted by leading automotive care brands worldwide. Manage bookings, staff, inventory, and analytics — all from one powerful dashboard.
          </p>

          {/* Stats bar */}
          <div className="stats-bar" style={s.statsBar}>
            <div ref={refCountries} style={s.statItem}>
              <div style={s.statNum}>{countCountries}+</div>
              <div style={s.statLabel}>Countries</div>
            </div>
            <div style={s.statDivider} />
            <div ref={refBiz} style={s.statItem}>
              <div style={s.statNum}>{countBiz}+</div>
              <div style={s.statLabel}>Businesses</div>
            </div>
            <div style={s.statDivider} />
            <div ref={refUptime} style={s.statItem}>
              <div style={s.statNum}>{countUptime}.9%</div>
              <div style={s.statLabel}>Uptime</div>
            </div>
          </div>

          {/* Feature pills */}
          <div style={s.featureList}>
            {[
              { icon: Building2, text: 'Multi-Location Management' },
              { icon: TrendingUp, text: 'Revenue Analytics' },
              { icon: Users, text: 'Team & Payroll' },
              { icon: Zap, text: 'Real-time Scheduling' },
              { icon: Globe, text: 'Global Deployment' },
              { icon: Shield, text: 'Enterprise Security' },
            ].map((f, i) => (
              <div key={i} className="feat-pill" style={s.featPill}>
                <f.icon size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="login-right" style={s.right}>
        <div className="login-card" style={s.card}>
          {/* Card logo */}
          <div style={s.cardLogo}>
            <img src="/detail.png" alt="Zwash" style={{ height: 36, objectFit: 'contain' }} />
          </div>

          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Welcome back</h2>
            <p style={s.cardSub}>Sign in to access your Zwash dashboard</p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            style={{ ...s.googleBtn, ...(btnHover ? s.googleBtnHover : {}) }}
            onClick={signInWithGoogle}
            disabled={loading}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            className="google-btn"
          >
            {loading ? (
              <div style={s.spinner} className="spinner" />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span style={{ flex: 1, textAlign: 'left' }}>{loading ? 'Authenticating…' : 'Continue with Google'}</span>
            {!loading && <ArrowRight size={18} style={{ color: '#94a3b8' }} />}
          </button>

          {/* Divider */}
          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>Secure Access</span>
            <div style={s.dividerLine} />
          </div>

          {/* Trust badges */}
          <div style={s.trustRow}>
            {[
              { icon: Shield, text: 'SSL Encrypted' },
              { icon: CheckCircle, text: 'SOC 2 Ready' },
              { icon: Globe, text: 'GDPR Compliant' },
            ].map((t, i) => (
              <div key={i} style={s.trustItem}>
                <t.icon size={13} style={{ color: '#3b82f6' }} />
                <span>{t.text}</span>
              </div>
            ))}
          </div>

          <p style={s.termsText}>
            By continuing, you agree to our <a href="#" style={s.link}>Terms</a> & <a href="#" style={s.link}>Privacy Policy</a>.
          </p>
        </div>

        {/* Bottom copyright */}
        <div style={s.copyright}>© 2025 Zwash Technologies · Enterprise Car Wash Software</div>
      </div>
    </div>
  );
};

// ─── Onboarding ───
const OnboardingForm = () => {
  const { userProfile, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await updateProfile({ displayName: fd.get('displayName'), phone: fd.get('phone'), address: fd.get('address') || '' });
      navigate('/');
    } catch {}
  };
  return (
    <div className="login-page" style={{ ...s.page, justifyContent: 'center', background: '#f1f5f9' }}>
      <style>{css}</style>
      <div className="login-card" style={{ ...s.card, maxWidth: 440, width: '100%', margin: '0 20px', padding: '44px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ ...s.cardLogo, marginBottom: 16 }}>
            <img src="/detail.png" alt="Zwash" style={{ height: 40, objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Complete Your Profile</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>Just a few details to get you started</p>
        </div>
        <form onSubmit={handleSubmit}>
          {[['displayName', 'Full Name', 'text', true, userProfile?.displayName], ['phone', 'Phone Number', 'tel', true, ''], ['address', 'Address (Optional)', 'text', false, '']].map(([name, label, type, req, def]) => (
            <div key={name} style={{ marginBottom: 20 }}>
              <label style={s.inputLabel}>{label}</label>
              <input name={name} type={type} required={req} defaultValue={def} style={s.input} placeholder={label} />
            </div>
          ))}
          <button type="submit" style={s.submitBtn} className="submit-btn">Complete Setup</button>
        </form>
        <button onClick={logout} style={s.logoutLink}>← Use a different account</button>
      </div>
    </div>
  );
};

// ─── Styles ───
const s = {
  page: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: "'Inter', sans-serif", flexDirection: 'row' },

  // LEFT
  left: { flex: 1.15, background: '#060b18', position: 'relative', display: 'flex', alignItems: 'center', padding: '60px 7%', overflow: 'hidden' },
  gridOverlay: { position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' },
  leftInner: { position: 'relative', zIndex: 2, maxWidth: 560 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 52 },
  logoContainer: { background: '#ffffff', padding: 10, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' },
  logo: { height: 34, objectFit: 'contain' },
  logoText: { color: '#ffffff', fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.08em' },
  logoSub: { color: '#64748b', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.04em', marginTop: 2 },
  headline: { color: '#ffffff', fontSize: '2.75rem', fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.03em' },
  headlineAccent: { background: 'linear-gradient(135deg, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subhead: { color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: 40, maxWidth: '95%' },

  // Stats bar
  statsBar: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 28px', gap: 0, marginBottom: 40 },
  statItem: { flex: 1, textAlign: 'center' },
  statNum: { fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 },
  statLabel: { fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 },
  statDivider: { width: 1, height: 36, background: 'rgba(255,255,255,0.08)', flexShrink: 0 },

  // Feature pills
  featureList: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  featPill: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 40, padding: '8px 16px', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 500 },

  // RIGHT
  right: { flex: 1, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative', flexDirection: 'column' },
  card: { width: '100%', maxWidth: 440, background: '#ffffff', borderRadius: 24, padding: '44px 36px', boxShadow: '0 25px 50px -12px rgba(15,23,42,0.08)', border: '1px solid #e2e8f0', position: 'relative', zIndex: 1 },
  cardLogo: { width: 56, height: 56, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' },
  cardHeader: { marginBottom: 32, textAlign: 'center' },
  cardTitle: { fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' },
  cardSub: { fontSize: '0.92rem', color: '#64748b', margin: 0 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#ef4444', fontSize: '0.85rem', fontWeight: 500 },
  googleBtn: { display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 20px', background: '#ffffff', border: '2px solid #e2e8f0', borderRadius: 14, color: '#0f172a', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.25s ease', marginBottom: 24 },
  googleBtnHover: { borderColor: '#3b82f6', background: '#f8fafc', transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(59,130,246,0.12)' },
  spinner: { width: 22, height: 22, border: '2.5px solid #e2e8f0', borderTop: '2.5px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  divider: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, background: '#e2e8f0' },
  dividerText: { fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' },
  trustRow: { display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  trustItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b', fontWeight: 500 },
  termsText: { textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 },
  link: { color: '#3b82f6', textDecoration: 'none', fontWeight: 500 },
  copyright: { position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' },

  // Form inputs
  inputLabel: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 },
  input: { width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, color: '#0f172a', fontSize: '1rem', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', borderRadius: 12, color: '#ffffff', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', marginTop: 12, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' },
  logoutLink: { display: 'block', margin: '20px auto 0', background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; }
  body { margin: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.1); } }
  @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,30px) scale(1.15); } }
  @keyframes float3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(15px,25px) scale(1.05); } }

  /* Animated gradient orbs */
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 1;
  }
  .orb-1 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(37,99,235,0.25), transparent 70%);
    top: 10%; left: 5%;
    animation: float1 8s ease-in-out infinite;
  }
  .orb-2 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(129,140,248,0.2), transparent 70%);
    bottom: 15%; right: 10%;
    animation: float2 10s ease-in-out infinite;
  }
  .orb-3 {
    width: 250px; height: 250px;
    background: radial-gradient(circle, rgba(56,189,248,0.15), transparent 70%);
    top: 60%; left: 40%;
    animation: float3 12s ease-in-out infinite;
  }

  .login-card { animation: fadeUp 0.6s ease both; }
  .login-headline { animation: fadeUp 0.6s ease 0.1s both; }
  .stats-bar { animation: fadeUp 0.6s ease 0.2s both; }

  .feat-pill { transition: all 0.2s ease; }
  .feat-pill:hover { background: rgba(59,130,246,0.1) !important; border-color: rgba(59,130,246,0.3) !important; color: #93c5fd !important; }

  .google-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .google-btn:active:not(:disabled) { transform: scale(0.98) !important; }
  .submit-btn:hover { filter: brightness(1.1); box-shadow: 0 6px 20px rgba(37,99,235,0.3) !important; }
  input:focus { border-color: #3b82f6 !important; background: #ffffff !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.08); }

  /* Responsive */
  @media (max-width: 1024px) {
    .login-page { flex-direction: column !important; }
    .login-left { flex: none !important; padding: 48px 24px 36px !important; }
    .login-left h1 { font-size: 2rem !important; }
    .login-right { flex: none !important; padding: 24px 20px 40px !important; min-height: auto !important; }
    .login-card { max-width: 100% !important; }
  }
  @media (max-width: 480px) {
    .login-left h1 { font-size: 1.6rem !important; }
    .stats-bar { flex-direction: column !important; gap: 12px !important; padding: 16px !important; }
    .stats-bar > div:nth-child(2), .stats-bar > div:nth-child(4) { display: none; }
  }
`;

export default Login;
