import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowRight, Building2, TrendingUp, Users, Zap, Globe, CheckCircle, Lock, Layout } from 'lucide-react';

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

  const [countBiz, refBiz] = useCounter(1200, 1800);
  const [countCountries, refCountries] = useCounter(24, 1400);
  const [countUptime, refUptime] = useCounter(99, 1600);

  useEffect(() => {
    if (user && userProfile && !userProfile.needsOnboarding) navigate('/');
  }, [user, userProfile, navigate]);

  if (user && userProfile?.needsOnboarding) return <OnboardingForm />;

  return (
    <div className="login-page" style={s.page}>
      <style>{css}</style>

      {/* ── Left Side: Visual Experience ── */}
      <div className="login-visual" style={s.visualSide}>
        <div className="visual-bg" style={s.visualBg} />
        <div style={s.visualOverlay} />
        
        {/* Animated Orbs for Depth */}
        <div className="orb orb-primary" />
        <div className="orb orb-secondary" />

        <div style={s.visualContent}>
          <div style={s.logoWrapper}>
            <div style={s.logoIcon}>
              <img src="/logo.png" alt="Zwash" style={s.logoImg} />
            </div>
            <div style={s.logoTextGroup}>
              <p style={s.brandTagline}>ENTERPRISE GRADE CAR CARE</p>
            </div>
          </div>

          <div style={s.heroSection}>
            <h2 className="hero-text" style={s.heroText}>
              Elevate Your <span className="text-gradient">Detailing Empire</span>
            </h2>
            <p style={s.heroSubtext}>
              The world's most advanced operating system for premium car wash and detailing businesses. 
              Seamlessly manage operations, staff, and revenue with precision.
            </p>
          </div>

          <div className="stats-container" style={s.statsContainer}>
            <div ref={refCountries} className="stat-card" style={s.statCard}>
              <div style={s.statValue}>{countCountries}+</div>
              <div style={s.statLabel}>Global Markets</div>
            </div>
            <div ref={refBiz} className="stat-card" style={s.statCard}>
              <div style={s.statValue}>{countBiz}+</div>
              <div style={s.statLabel}>Active Studios</div>
            </div>
            <div ref={refUptime} className="stat-card" style={s.statCard}>
              <div style={s.statValue}>{countUptime}.9%</div>
              <div style={s.statLabel}>System Uptime</div>
            </div>
          </div>
          
          <div style={s.trustPills}>
            <div className="trust-pill" style={s.trustPill}>
              <Shield size={14} /> SOC2 Type II Certified
            </div>
            <div className="trust-pill" style={s.trustPill}>
              <Lock size={14} /> 256-bit Encryption
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Side: Authentication ── */}
      <div className="login-auth" style={s.authSide}>
        <div className="login-card-wrapper" style={s.cardWrapper}>
          <div className="login-card" style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.mobileLogo}>
                 <img src="/logo.png" alt="Zwash" style={{ height: 40 }} />
              </div>
              <h3 style={s.cardTitle}>Welcome Back</h3>
              <p style={s.cardSubtitle}>Access your executive dashboard</p>
            </div>

            {error && (
              <div className="error-alert" style={s.errorAlert}>
                <span style={s.errorIcon}>!</span>
                <div style={s.errorContent}>
                  <div style={{ fontWeight: 600 }}>Access Denied</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{error}</div>
                </div>
              </div>
            )}

            <div style={s.authActions}>
              <button
                className="google-auth-btn"
                style={{ ...s.googleBtn, ...(btnHover ? s.googleBtnHover : {}) }}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                onClick={signInWithGoogle}
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner-small" />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>{loading ? 'Verifying Identity...' : 'Continue with Google Workspace'}</span>
              </button>

              <div style={s.dividerContainer}>
                <div style={s.dividerLine} />
                <span style={s.dividerText}>SECURE ENTERPRISE LOGIN</span>
                <div style={s.dividerLine} />
              </div>

              <div style={s.featuresGrid}>
                {[
                  { icon: Zap, label: 'Real-time Sync' },
                  { icon: Layout, label: 'Multi-Shop' },
                  { icon: TrendingUp, label: 'AI Analytics' },
                  { icon: Users, label: 'Team Portal' },
                ].map((item, i) => (
                  <div key={i} className="feature-item" style={s.featureItem}>
                    <item.icon size={16} style={{ color: '#3b82f6' }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.cardFooter}>
              <p style={s.footerText}>
                Enterprise solution by <strong>Zwash Technologies</strong>
              </p>
              <div style={s.footerLinks}>
                <a href="#" style={s.footerLink}>Support</a>
                <span style={s.footerDot}>•</span>
                <a href="#" style={s.footerLink}>Security Policy</a>
              </div>
            </div>
          </div>
          
          <div style={s.copyrightMobile}>
            © 2025 Zwash. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Onboarding Form ───
const OnboardingForm = () => {
  const { userProfile, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.target);
    try {
      await updateProfile({ 
        displayName: fd.get('displayName'), 
        phone: fd.get('phone'), 
        address: fd.get('address') || '' 
      });
      navigate('/');
    } catch (err) {
      alert("Error updating profile. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="onboarding-page" style={s.onboardingPage}>
      <style>{css}</style>
      <div className="onboarding-card" style={s.onboardingCard}>
        <div style={s.onboardingHeader}>
            <img src="/logo.png" alt="Zwash" style={{ height: 48, marginBottom: 16 }} />
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Finalize Setup</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Complete your professional profile to begin.</p>
        </div>
        
        <form onSubmit={handleSubmit} style={s.onboardingForm}>
          <div style={s.inputGroup}>
            <label style={s.label}>Legal Full Name</label>
            <input name="displayName" type="text" required defaultValue={userProfile?.displayName} style={s.input} placeholder="John Doe" />
          </div>
          <div style={s.inputGroup}>
            <label style={s.label}>Business Contact Number</label>
            <input name="phone" type="tel" required style={s.input} placeholder="+1 (555) 000-0000" />
          </div>
          <div style={s.inputGroup}>
            <label style={s.label}>Operating Address</label>
            <input name="address" type="text" style={s.input} placeholder="123 Business Ave, Suite 100" />
          </div>
          
          <button type="submit" disabled={submitting} className="onboarding-btn" style={s.onboardingBtn}>
            {submitting ? 'Updating Profile...' : 'Launch Dashboard'}
          </button>
        </form>
        
        <button onClick={logout} style={s.switchAccountBtn}>
          ← Use a different account
        </button>
      </div>
    </div>
  );
};

// ─── Styles ───
const s = {
  page: { 
    display: 'flex', 
    minHeight: '100vh', 
    width: '100%', 
    background: '#020617',
    fontFamily: "'Inter', sans-serif",
    overflow: 'hidden'
  },
  
  // Visual Side (Left)
  visualSide: {
    flex: 1.4,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: '60px 8%',
    overflow: 'hidden',
    color: '#ffffff'
  },
  visualBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url("/login-bg.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: 'transform 20s linear',
  },
  visualOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to right, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.4) 50%, rgba(2,6,23,0.8) 100%)',
    zIndex: 1
  },
  visualContent: {
    position: 'relative',
    zIndex: 10,
    maxWidth: 680
  },
  logoWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 64
  },
  logoIcon: {
    background: '#ffffff',
    padding: 12,
    borderRadius: 16,
    boxShadow: '0 0 40px rgba(255,255,255,0.1)'
  },
  logoImg: {
    height: 48,
    width: 'auto'
  },
  logoTextGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  brandTitle: {
    fontSize: '1.5rem',
    fontWeight: 900,
    letterSpacing: '0.15em',
    margin: 0,
    lineHeight: 1
  },
  brandTagline: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.2em',
    margin: '4px 0 0'
  },
  heroSection: {
    marginBottom: 64
  },
  heroText: {
    fontSize: '4.5rem',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
    marginBottom: 24
  },
  heroSubtext: {
    fontSize: '1.2rem',
    color: '#94a3b8',
    lineHeight: 1.6,
    maxWidth: 540
  },
  statsContainer: {
    display: 'flex',
    gap: 32,
    marginBottom: 48
  },
  statCard: {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(12px)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '24px',
    transition: 'transform 0.3s ease, border-color 0.3s ease'
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: 4
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  trustPills: {
    display: 'flex',
    gap: 16
  },
  trustPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94a3b8',
    background: 'rgba(255,255,255,0.05)',
    padding: '8px 16px',
    borderRadius: 100,
    border: '1px solid rgba(255,255,255,0.1)'
  },
  
  // Auth Side (Right)
  authSide: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    position: 'relative',
    background: '#020617'
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 480,
    zIndex: 20
  },
  card: {
    background: '#ffffff',
    borderRadius: 32,
    padding: '48px 40px',
    boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)',
    color: '#0f172a'
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: 40
  },
  mobileLogo: {
    display: 'none',
    justifyContent: 'center',
    marginBottom: 24
  },
  cardTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: '0 0 8px'
  },
  cardSubtitle: {
    fontSize: '1rem',
    color: '#64748b'
  },
  errorAlert: {
    background: '#fff1f2',
    border: '1px solid #ffe4e6',
    borderRadius: 16,
    padding: '16px',
    marginBottom: 32,
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    color: '#e11d48'
  },
  errorIcon: {
    width: 20,
    height: 20,
    background: '#e11d48',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
    flexShrink: 0
  },
  errorContent: {
    fontSize: '0.9rem'
  },
  authActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 24px',
    background: '#ffffff',
    border: '2px solid #e2e8f0',
    borderRadius: 16,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  googleBtnHover: {
    background: '#f8fafc',
    borderColor: '#3b82f6',
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 24px -6px rgba(59,130,246,0.15)'
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#e2e8f0'
  },
  dividerText: {
    fontSize: '0.65rem',
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: '0.1em'
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#475569',
    background: '#f8fafc',
    padding: '12px 16px',
    borderRadius: 12
  },
  cardFooter: {
    marginTop: 48,
    textAlign: 'center',
    borderTop: '1px solid #f1f5f9',
    paddingTop: 32
  },
  footerText: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '0 0 12px'
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    alignItems: 'center'
  },
  footerLink: {
    fontSize: '0.8rem',
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: 600
  },
  footerDot: {
    color: '#cbd5e1'
  },
  copyrightMobile: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: '0.8rem',
    color: '#475569',
    display: 'none'
  },
  
  // Onboarding
  onboardingPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: 20
  },
  onboardingCard: {
    background: '#ffffff',
    width: '100%',
    maxWidth: 480,
    borderRadius: 32,
    padding: '48px',
    boxShadow: '0 40px 80px -15px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  onboardingHeader: {
    marginBottom: 40
  },
  onboardingForm: {
    textAlign: 'left'
  },
  inputGroup: {
    marginBottom: 24
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#334155',
    marginBottom: 8
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    background: '#f1f5f9',
    border: '2px solid transparent',
    borderRadius: 14,
    fontSize: '1rem',
    color: '#0f172a',
    transition: 'all 0.2s',
    outline: 'none'
  },
  onboardingBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 16,
    fontSize: '1.05rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 12,
    boxShadow: '0 10px 20px -5px rgba(59,130,246,0.3)'
  },
  switchAccountBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: 32,
    cursor: 'pointer'
  }
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  
  * { box-sizing: border-box; margin: 0; }
  
  .text-gradient {
    background: linear-gradient(135deg, #3b82f6 0%, #818cf8 50%, #ffffff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    z-index: 2;
    pointer-events: none;
    opacity: 0.5;
  }
  
  .orb-primary {
    width: 500px;
    height: 500px;
    background: rgba(59, 130, 246, 0.2);
    top: -100px;
    left: -100px;
    animation: float 15s infinite alternate ease-in-out;
  }
  
  .orb-secondary {
    width: 400px;
    height: 400px;
    background: rgba(99, 102, 241, 0.15);
    bottom: -50px;
    right: 10%;
    animation: float 18s infinite alternate-reverse ease-in-out;
  }
  
  @keyframes float {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(100px, 50px) scale(1.1); }
  }
  
  @keyframes spin { to { transform: rotate(360deg); } }
  
  .spinner-small {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(0,0,0,0.1);
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 12px;
  }
  
  .stat-card:hover {
    transform: translateY(-5px);
    border-color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05);
  }
  
  input:focus {
    border-color: #3b82f6;
    background: #ffffff;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }
  
  .onboarding-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
  }
  
  .google-auth-btn:active {
    transform: scale(0.98);
  }

  @media (max-width: 1200px) {
    .hero-text { font-size: 3.5rem !important; }
  }

  @media (max-width: 1024px) {
    .login-page { flex-direction: column; overflow: auto; }
    .visual-bg { transform: none !important; }
    .login-visual { flex: none; padding: 60px 40px !important; min-height: 400px; }
    .hero-text { font-size: 2.75rem !important; }
    .stats-container { flex-wrap: wrap; }
    .authSide { flex: none; padding: 40px 20px; }
    .mobileLogo { display: flex !important; }
    .copyrightMobile { display: block !important; }
    .visualOverlay {
       background: linear-gradient(to bottom, rgba(2,6,23,0.7) 0%, rgba(2,6,23,0.95) 100%) !important;
    }
  }
  
  @media (max-width: 640px) {
     .hero-text { font-size: 2.25rem !important; }
     .heroSubtext { font-size: 1rem !important; }
     .login-card { padding: 32px 24px !important; border-radius: 24px !important; }
     .stat-card { padding: 16px !important; }
     .statValue { font-size: 1.25rem !important; }
     .featuresGrid { grid-template-columns: 1fr; }
  }
`;

export default Login;
