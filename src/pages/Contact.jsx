import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Phone, Mail, Linkedin, Instagram, Twitter, ArrowLeft, Send } from 'lucide-react';

export default function Contact() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    businessEmail: '',
    phone: '',
    budget: '',
    inquiry: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'platformEnquiries'), {
        ...form,
        type: 'contact_page',
        status: 'new',
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0f172a', fontFamily: "'Inter', sans-serif", padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400, background: 'white', padding: 40, borderRadius: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 80, height: 80, background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Send size={40} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 16 }}>{t('message_sent', 'Message Sent!')}</h1>
          <p style={{ color: '#64748b', marginBottom: 32 }}>{t('message_sent_desc', 'Thank you for reaching out. Our team will review your inquiry and get back to you shortly.')}</p>
          <button 
            onClick={() => navigate('/')}
            style={{ background: '#3b82f6', color: 'white', padding: '12px 24px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', width: '100%' }}
          >
            {t('back_to_home', 'Back to Home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      <nav style={{ padding: '30px 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>
          <ArrowLeft size={20} /> {t('back', 'Back')}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={20} color="white" />
          </div>
          <span style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: '-0.02em', color: '#1e3a8a' }}>ZWASH</span>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 5%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
        {/* Left Side */}
        <div style={{ paddingTop: 40 }}>
          <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: 60, lineHeight: 1.1, color: '#1e3a8a' }}>{t('contact_us_title', 'Get in touch with us')}</h1>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div>
              <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Email Support</div>
              <a href="mailto:Zwash.office@gmail.com" style={{ color: '#0f172a', fontSize: '1.4rem', textDecoration: 'none', fontWeight: 600 }}>Zwash.office@gmail.com</a>
            </div>

            <div>
              <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Call Us</div>
              <a href="tel:+918838157898" style={{ color: '#0f172a', fontSize: '1.4rem', textDecoration: 'none', fontWeight: 600 }}>+91 8838157898</a>
            </div>

            <div>
              <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.05em' }}>Connect Socially</div>
              <div style={{ display: 'flex', gap: 15 }}>
                {[Linkedin, Instagram, Twitter].map((Icon, idx) => (
                  <a key={idx} href="#" style={{ width: 44, height: 44, borderRadius: 12, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div style={{ background: 'white', borderRadius: 32, padding: 48, boxShadow: '0 20px 50px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.02em' }}>{t('full_name', 'Full Name')}</label>
              <input 
                required
                placeholder="Jane Doe"
                value={form.fullName}
                onChange={e => setForm({...form, fullName: e.target.value})}
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', color: '#0f172a', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.02em' }}>{t('business_email', 'Business Email')}</label>
              <input 
                required
                type="email"
                placeholder="jane@company.com"
                value={form.businessEmail}
                onChange={e => setForm({...form, businessEmail: e.target.value})}
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', color: '#0f172a', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.02em' }}>{t('phone_number', 'Phone Number')}</label>
              <input 
                required
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', color: '#0f172a', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.02em' }}>{t('project_budget', 'Project Budget')}</label>
              <div style={{ position: 'relative' }}>
                <select 
                  required
                  value={form.budget}
                  onChange={e => setForm({...form, budget: e.target.value})}
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', color: '#0f172a', fontSize: '1rem', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">{t('select_range', 'Select a range')}</option>
                  <option value="basic">{t('budget_basic', 'Basic Setup')}</option>
                  <option value="standard">{t('budget_standard', 'Standard Operation')}</option>
                  <option value="enterprise">{t('budget_enterprise', 'Enterprise Multi-Location')}</option>
                </select>
                <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
                  <ArrowRight size={18} style={{ transform: 'rotate(90deg)' }} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.02em' }}>{t('your_inquiry', 'Your Inquiry')}</label>
              <textarea 
                required
                rows={4}
                placeholder={t('inquiry_placeholder', 'Tell us about your project...')}
                value={form.inquiry}
                onChange={e => setForm({...form, inquiry: e.target.value})}
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', color: '#0f172a', fontSize: '1rem', outline: 'none', resize: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              style={{ background: '#3b82f6', color: 'white', padding: '18px', borderRadius: 12, fontWeight: 800, fontSize: '1.1rem', border: 'none', cursor: 'pointer', marginTop: 12, transition: 'all 0.3s', boxShadow: '0 10px 20px rgba(59, 130, 246, 0.2)' }}
            >
              {loading ? t('sending_btn', 'SENDING...') : t('send_message_btn', 'SEND MESSAGE')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
