import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowRight, Building2, TrendingUp, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const { user, userProfile, loading, error, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    if (user && userProfile && !userProfile.needsOnboarding) navigate('/');
  }, [user, userProfile, navigate]);

  if (user && userProfile?.needsOnboarding) return <OnboardingForm />;

  return (
    <div style={s.page}>
      <style>{css}</style>
      
      {/* ── Left Panel (Brand & Info) ── */}
      <div style={s.left}>
        {/* Subtle geometric background pattern */}
        <div style={s.pattern} />
        
        <div style={s.leftInner}>
          <div style={s.logoRow}>
            <img src="/detail.png" alt="Zwash" style={s.logo} />
            <span style={s.logoText}>Zwash Demo</span>
          </div>

          <h1 style={s.headline}>
            Enterprise Management for Modern Car Washes.
          </h1>
          <p style={s.subhead}>
            Streamline your operations, manage bookings, and grow your revenue with our all-in-one platform.
          </p>

          <div style={s.featureList}>
            {[
              { icon: Building2, title: 'Multi-Branch Support', desc: 'Manage operations across multiple locations effortlessly.' },
              { icon: TrendingUp, title: 'Advanced Analytics', desc: 'Real-time insights into revenue, inventory, and staff.' },
              { icon: Shield, title: 'Enterprise Security', desc: 'Role-based access control and secure data isolation.' }
            ].map((feat, i) => (
              <div key={i} style={s.featItem}>
                <div style={s.featIconWrap}><feat.icon size={20} style={{ color: '#3b82f6' }} /></div>
                <div>
                  <h4 style={s.featTitle}>{feat.title}</h4>
                  <p style={s.featDesc}>{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel (Login Form) ── */}
      <div style={s.right}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Sign in to your account</h2>
            <p style={s.cardSub}>Welcome back! Please enter your details.</p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>Corporate Access</span>
            <div style={s.dividerLine} />
          </div>

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
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
            {!loading && <ArrowRight size={18} style={{ marginLeft: 'auto', color: '#94a3b8' }} />}
          </button>

          <p style={s.termsText}>
            By signing in, you agree to our <a href="#" style={s.link}>Terms of Service</a> and <a href="#" style={s.link}>Privacy Policy</a>.
          </p>
        </div>
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
    <div style={{ ...s.page, justifyContent: 'center', background: '#f8fafc' }}>
      <style>{css}</style>
      <div style={{ ...s.card, maxWidth: 440, width: '100%', margin: '0 20px', padding: '40px' }} className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/detail.png" alt="Zwash" style={{ height: 48, filter: 'invert(1)' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 16 }}>Complete Profile</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 8 }}>Please verify your details to continue</p>
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
  left: { flex: 1.2, background: '#0f172a', position: 'relative', display: 'flex', alignItems: 'center', padding: '60px 8%', overflow: 'hidden' },
  pattern: { position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' },
  leftInner: { position: 'relative', zIndex: 2, maxWidth: 600 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 60 },
  logo: { height: 32, filter: 'brightness(0) invert(1)' },
  logoText: { color: '#ffffff', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
  headline: { color: '#ffffff', fontSize: '3rem', fontWeight: 700, lineHeight: 1.15, marginBottom: 24, letterSpacing: '-0.03em' },
  subhead: { color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1.6, marginBottom: 48, maxWidth: '90%' },
  featureList: { display: 'flex', flexDirection: 'column', gap: 32 },
  featItem: { display: 'flex', alignItems: 'flex-start', gap: 20 },
  featIconWrap: { width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featTitle: { color: '#ffffff', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px 0' },
  featDesc: { color: '#94a3b8', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 },
  right: { flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
  card: { width: '100%', maxWidth: 440, background: '#ffffff', borderRadius: 24, padding: '48px 40px', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  cardHeader: { marginBottom: 32, textAlign: 'center' },
  cardTitle: { fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' },
  cardSub: { fontSize: '0.95rem', color: '#64748b', margin: 0 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 24, color: '#ef4444', fontSize: '0.85rem', fontWeight: 500 },
  divider: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 },
  dividerLine: { flex: 1, height: 1, background: '#e2e8f0' },
  dividerText: { fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  googleBtn: { display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '14px 20px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, color: '#0f172a', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  googleBtnHover: { borderColor: '#94a3b8', background: '#f8fafc', transform: 'translateY(-1px)', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' },
  spinner: { width: 20, height: 20, border: '2px solid #e2e8f0', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  termsText: { marginTop: 32, textAlign: 'center', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 },
  link: { color: '#3b82f6', textDecoration: 'none', fontWeight: 500 },
  inputLabel: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 },
  input: { width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, color: '#0f172a', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' },
  submitBtn: { width: '100%', padding: '14px', background: '#2563eb', border: 'none', borderRadius: 10, color: '#ffffff', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', marginTop: 12, transition: 'background 0.2s' },
  logoutLink: { display: 'block', margin: '20px auto 0', background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .login-card { animation: fadeUp 0.5s ease both; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .google-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .submit-btn:hover { background: #1d4ed8 !important; }
  input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
  
  @media (max-width: 992px) {
    body > div > div { flex-direction: column !important; }
    body > div > div > div:first-child { 
      padding: 40px 24px !important;
      flex: none !important;
    }
    body > div > div > div:first-child h1 { font-size: 2.2rem !important; }
    body > div > div > div:last-child { 
      padding: 24px !important; 
    }
    .login-card { padding: 32px 24px !important; }
  }
`;

export default Login;
