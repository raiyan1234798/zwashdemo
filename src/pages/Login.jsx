import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowRight, Globe, Star, Zap, Users, BarChart3, CheckCircle } from 'lucide-react';

/* ─── Particle background ─── */
const ParticleCanvas = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.5 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > W) p.dx *= -1;
        if (p.y < 0 || p.y > H) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${p.o})`;
        ctx.fill();
      });
      // draw connections
      particles.forEach((a, i) => particles.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(212,175,55,${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }));
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }} />;
};

/* ─── Luxury car SVG ─── */
const LuxuryCar = () => (
  <svg viewBox="0 0 520 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 480, filter: 'drop-shadow(0 0 40px rgba(212,175,55,0.25))' }}>
    {/* body */}
    <path d="M 30 120 Q 30 85 60 78 L 130 60 Q 160 30 220 22 L 320 20 Q 375 22 410 55 L 460 78 Q 490 85 490 120 Z" fill="url(#carBody)" />
    {/* roof */}
    <path d="M 140 78 Q 170 34 230 24 L 320 22 Q 368 24 398 55 L 440 78 Z" fill="url(#carRoof)" />
    {/* windshield */}
    <path d="M 150 76 Q 180 36 235 27 L 318 25 Q 338 27 360 46 L 390 74 Z" fill="rgba(180,220,255,0.18)" stroke="rgba(212,175,55,0.3)" strokeWidth="1" />
    {/* rear glass */}
    <path d="M 155 76 L 188 40 L 245 28 L 240 76 Z" fill="rgba(180,220,255,0.1)" />
    {/* side window */}
    <path d="M 245 76 L 248 28 L 318 26 L 362 44 L 388 74 Z" fill="rgba(180,220,255,0.12)" />
    {/* chrome strip */}
    <line x1="65" y1="100" x2="455" y2="100" stroke="url(#chrome)" strokeWidth="1.5" />
    {/* door lines */}
    <line x1="270" y1="80" x2="268" y2="118" stroke="rgba(212,175,55,0.25)" strokeWidth="1" />
    {/* front wheel arch */}
    <ellipse cx="130" cy="124" rx="42" ry="42" fill="#0d0d12" stroke="rgba(212,175,55,0.4)" strokeWidth="1.5" />
    <ellipse cx="130" cy="124" rx="30" ry="30" fill="#111" stroke="rgba(212,175,55,0.6)" strokeWidth="2" />
    <ellipse cx="130" cy="124" rx="14" ry="14" fill="url(#wheel)" />
    <ellipse cx="130" cy="124" rx="5" ry="5" fill="#d4af37" />
    {/* rear wheel arch */}
    <ellipse cx="385" cy="124" rx="42" ry="42" fill="#0d0d12" stroke="rgba(212,175,55,0.4)" strokeWidth="1.5" />
    <ellipse cx="385" cy="124" rx="30" ry="30" fill="#111" stroke="rgba(212,175,55,0.6)" strokeWidth="2" />
    <ellipse cx="385" cy="124" rx="14" ry="14" fill="url(#wheel)" />
    <ellipse cx="385" cy="124" rx="5" ry="5" fill="#d4af37" />
    {/* headlight */}
    <path d="M 38 90 Q 42 84 52 82 L 68 80 Q 58 86 56 94 Z" fill="rgba(255,255,220,0.7)" />
    <line x1="28" y1="92" x2="5" y2="95" stroke="rgba(255,255,200,0.6)" strokeWidth="2" strokeDasharray="2,3" />
    {/* tail light */}
    <path d="M 482 90 Q 488 84 488 95 L 482 100 Z" fill="rgba(255,60,60,0.7)" />
    {/* ground shadow */}
    <ellipse cx="258" cy="165" rx="230" ry="10" fill="rgba(0,0,0,0.5)" />
    <defs>
      <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e1e28" />
        <stop offset="40%" stopColor="#16161f" />
        <stop offset="100%" stopColor="#0a0a10" />
      </linearGradient>
      <linearGradient id="carRoof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#242430" />
        <stop offset="100%" stopColor="#18181f" />
      </linearGradient>
      <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="20%" stopColor="#d4af37" stopOpacity="0.4" />
        <stop offset="50%" stopColor="#d4af37" stopOpacity="0.8" />
        <stop offset="80%" stopColor="#d4af37" stopOpacity="0.4" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
      <radialGradient id="wheel" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#2a2a2a" />
        <stop offset="100%" stopColor="#0a0a0a" />
      </radialGradient>
    </defs>
  </svg>
);

const STATS = [
  { icon: Globe, value: '12+', label: 'Countries' },
  { icon: Users, value: '500+', label: 'Businesses' },
  { icon: Star, value: '4.9', label: 'Rating' },
  { icon: BarChart3, value: '99.9%', label: 'Uptime' },
];

const FEATURES = [
  'Real-time Booking & Scheduling',
  'Customer & Vehicle CRM',
  'Employee & Payroll Management',
  'GST Invoicing & Analytics',
  'WhatsApp Automation',
  'Multi-role Access Control',
];

// ─── Main Login ───
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
      <ParticleCanvas />

      {/* ── Left Panel ── */}
      <div style={s.left}>
        <div style={s.leftInner}>
          {/* Logo */}
          <div style={s.logoRow}>
            <img src="/detail.png" alt="Zwash" style={s.logo} />
            <span style={s.logoText}>ZWASH</span>
          </div>

          <div style={s.tagline}>The Operating System for<br /><span style={s.taglineAccent}>Premium Car Wash Businesses</span></div>

          {/* Car illustration */}
          <div style={s.carWrap}>
            <div style={s.carGlow} />
            <LuxuryCar />
          </div>

          {/* Stats */}
          <div style={s.statsRow}>
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} style={s.stat}>
                <div style={s.statVal}>{value}</div>
                <div style={s.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div style={s.right}>
        <div style={s.card} className="login-card">
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={s.cardBadge}><Shield size={12} /> Secure Access Portal</div>
            <h1 style={s.cardTitle}>Welcome back</h1>
            <p style={s.cardSub}>Sign in to access your Zwash dashboard</p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span style={{ fontSize: 18 }}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google button */}
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
            <span>{loading ? 'Authenticating...' : 'Continue with Google'}</span>
            {!loading && <ArrowRight size={16} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* Features */}
          <div style={s.featureSection}>
            <div style={s.featureDivider}>
              <div style={s.featureLine} />
              <span style={s.featureDivText}>EVERYTHING YOU NEED</span>
              <div style={s.featureLine} />
            </div>
            <div style={s.featureGrid}>
              {FEATURES.map(f => (
                <div key={f} style={s.featureItem}>
                  <CheckCircle size={13} style={{ color: '#d4af37', flexShrink: 0 }} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={s.footer}>
            <div style={s.footerDots}>
              <div style={{ ...s.dot, background: '#d4af37' }} />
              <div style={s.dot} />
              <div style={s.dot} />
            </div>
            <span>© 2025 Zwash · Enterprise Car Wash Software</span>
          </div>
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
    <div style={{ ...s.page, justifyContent: 'center' }}>
      <style>{css}</style>
      <ParticleCanvas />
      <div style={{ ...s.card, maxWidth: 440, width: '100%', margin: '0 20px' }} className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/detail.png" alt="Zwash" style={{ height: 48, filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.4))' }} />
          <h2 style={{ ...s.cardTitle, fontSize: '1.4rem', marginTop: 16 }}>Complete Your Profile</h2>
          <p style={s.cardSub}>A few details to get you started</p>
        </div>
        <form onSubmit={handleSubmit}>
          {[['displayName', 'Full Name', 'text', true, userProfile?.displayName], ['phone', 'Phone Number', 'tel', true, ''], ['address', 'Address (Optional)', 'text', false, '']].map(([name, label, type, req, def]) => (
            <div key={name} style={{ marginBottom: 18 }}>
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
  page: { display: 'flex', minHeight: '100vh', width: '100%', background: '#08080f', fontFamily: "'Inter', -apple-system, sans-serif", overflow: 'hidden', position: 'relative', flexDirection: 'row' },
  left: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 48px', position: 'relative', zIndex: 2, borderRight: '1px solid rgba(212,175,55,0.1)' },
  leftInner: { maxWidth: 540, width: '100%' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 },
  logo: { height: 36, width: 'auto', filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.4))' },
  logoText: { fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.25em', color: '#d4af37', fontFamily: "'Inter', sans-serif" },
  tagline: { fontSize: '2rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.35, marginBottom: 48, letterSpacing: '-0.02em' },
  taglineAccent: { color: '#d4af37', display: 'block' },
  carWrap: { position: 'relative', marginBottom: 48 },
  carGlow: { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 60, background: 'radial-gradient(ellipse, rgba(212,175,55,0.15) 0%, transparent 70%)', filter: 'blur(20px)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid rgba(212,175,55,0.12)', borderLeft: '1px solid rgba(212,175,55,0.12)' },
  stat: { padding: '20px 0', textAlign: 'center', borderRight: '1px solid rgba(212,175,55,0.12)', borderBottom: '1px solid rgba(212,175,55,0.12)' },
  statVal: { fontSize: '1.5rem', fontWeight: 700, color: '#d4af37', marginBottom: 4 },
  statLabel: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' },
  right: { width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative', zIndex: 2 },
  card: { width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '44px 40px', backdropFilter: 'blur(20px)' },
  cardBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 20, padding: '5px 14px', fontSize: '0.7rem', color: '#d4af37', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 },
  cardTitle: { fontSize: '1.8rem', fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' },
  cardSub: { fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: '0.85rem' },
  googleBtn: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '0.93rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif", marginBottom: 32 },
  googleBtnHover: { background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.35)', transform: 'translateY(-1px)', boxShadow: '0 8px 24px rgba(212,175,55,0.1)' },
  spinner: { width: 20, height: 20, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  featureSection: { marginBottom: 28 },
  featureDivider: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  featureLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' },
  featureDivText: { fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', whiteSpace: 'nowrap' },
  featureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' },
  footer: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' },
  footerDots: { display: 'flex', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' },
  inputLabel: { display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.05em' },
  input: { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" },
  submitBtn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #d4af37, #b8962e)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 700, fontSize: '0.93rem', cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 8 },
  logoutLink: { display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .login-card { animation: fadeUp 0.5s ease both; }
  .google-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .submit-btn:hover { filter: brightness(1.08); }
  @media (max-width: 860px) {
    /* Instead of hiding first child, we stack them */
    body > div > div { flex-direction: column !important; overflow-y: auto !important; }
    body > div > div > div:first-child { 
      width: 100% !important; 
      padding: 40px 20px 20px !important; 
      border-right: none !important; 
      border-bottom: 1px solid rgba(212,175,55,0.1) !important;
      min-height: auto !important;
    }
    body > div > div > div:first-child > div { max-width: 100% !important; }
    body > div > div > div:last-child { width: 100% !important; padding: 20px !important; }
    .login-card { padding: 32px 24px !important; }
    /* Adjust text sizes for mobile */
    body > div > div > div:first-child > div > div:nth-child(2) { font-size: 1.5rem !important; margin-bottom: 24px !important; }
    /* Hide some particles on mobile to improve performance */
    canvas { opacity: 0.5; }
  }
`;

export default Login;
