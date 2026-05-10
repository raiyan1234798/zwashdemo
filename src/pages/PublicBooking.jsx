import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../config/firebase';
import {
  doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp
} from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Calendar, Car, Clock, CheckCircle, ArrowLeft, Phone, User, Star, AlertCircle } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

export default function PublicBooking() {
  const { t, i18n } = useTranslation();
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { formatCurrency } = useCurrency();
  const [step, setStep] = useState(1); // 1=service, 2=details, 3=confirm, 4=success
  const [selectedService, setSelectedService] = useState(null);
  const [slots, setSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: '', phone: '', carMake: '', carModel: '',
    vehicleType: 'sedan', bookingDate: '', startTime: ''
  });

  useEffect(() => { fetchCompanyData(); }, [companyId]);

  const fetchCompanyData = async () => {
    try {
      const compDoc = await getDoc(doc(db, 'demoClients', companyId));
      if (!compDoc.exists() || !compDoc.data().active) { setNotFound(true); setLoading(false); return; }
      const data = compDoc.data();
      // Check expiry
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) { setNotFound(true); setLoading(false); return; }
      // Check if bookings enabled
      const hasBooking = data.permissions?.bookings === true || (Array.isArray(data.features) && data.features.includes('bookings'));
      if (!hasBooking) { setNotFound(true); setLoading(false); return; }
      setCompany({ id: compDoc.id, ...data });

      // Fetch their services (company-scoped)
      const svSnap = await getDocs(query(collection(db, 'services'), where('companyId', '==', companyId), where('isActive', '==', true)));
      // fallback: fetch all active if no company-scoped ones
      let svcs = svSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (svcs.length === 0) {
        const fallback = await getDocs(query(collection(db, 'services'), where('isActive', '==', true)));
        svcs = fallback.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.companyId || s.companyId === companyId);
      }
      svcs.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setServices(svcs);
    } catch (e) { console.error(e); setNotFound(true); }
    setLoading(false);
  };

  const getPrice = (svc) => {
    if (svc?.prices?.[form.vehicleType] !== undefined) return Number(svc.prices[form.vehicleType]);
    return Number(svc?.price || 0);
  };

  const [slotsLoading, setSlotsLoading] = useState(false);

  const generateSlots = async (date) => {
    if (!date) return;
    setSlotsLoading(true);
    
    try {
      const q = query(
        collection(db, 'bookings'), 
        where('companyId', '==', companyId), 
        where('bookingDate', '==', date)
      );
      const snap = await getDocs(q);
      const bookings = snap.docs.map(d => d.data()).filter(b => b.status !== 'cancelled');
      
      const openTime = company.openTime || '09:00';
      const closeTime = company.closeTime || '19:00';
      const slotDuration = Number(company.slotDuration) || 30;
      const maxConcurrent = Number(company.maxConcurrentBookings) || 1;

      const result = [];
      const [startH, startM] = openTime.split(':').map(Number);
      const [endH, endM] = closeTime.split(':').map(Number);
      
      let current = new Date(`2000-01-01T${openTime}`);
      const end = new Date(`2000-01-01T${closeTime}`);

      while (current < end) {
        const h = current.getHours();
        const m = current.getMinutes();
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const label = current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        // Check concurrency: how many bookings already exist for this exact startTime?
        const concurrentCount = bookings.filter(b => b.startTime === time).length;
        const isBooked = concurrentCount >= maxConcurrent;
        
        result.push({ time, label, isBooked });
        
        // Move to next slot
        current = new Date(current.getTime() + slotDuration * 60000);
      }
      setSlots(result);
    } catch (e) {
      console.error("Error fetching available slots:", e);
    }
    setSlotsLoading(false);
  };

  const handleDateChange = (date) => {
    setForm(prev => ({ ...prev, bookingDate: date, startTime: '' }));
    generateSlots(date);
  };

  const handleSubmit = async () => {
    if (!form.customerName || !form.phone || !form.bookingDate || !form.startTime || !selectedService) {
      alert(t('fill_all_fields', 'Please fill all required fields.'));
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'bookings'), {
        companyId,
        companyName: company?.companyName || '',
        customerName: form.customerName,
        contactPhone: form.phone,
        carMake: form.carMake,
        carModel: form.carModel,
        vehicleType: form.vehicleType,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: getPrice(selectedService),
        totalAmount: getPrice(selectedService),
        bookingDate: form.bookingDate,
        startTime: form.startTime,
        status: 'pending_confirmation',
        source: 'public_booking',
        paymentStatus: 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setStep(4);
    } catch (e) {
      alert(t('booking_error', 'Error submitting booking. Please try again.'));
      console.error(e);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{t('loading', 'Loading...')}</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <AlertCircle size={56} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#0f172a', marginBottom: 8 }}>{t('booking_unavailable', 'Booking Unavailable')}</h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>{t('booking_expired_desc', "This company's online booking is not available or has expired.")}</p>
        <Link to="/" style={{ background: '#6366f1', color: 'white', padding: '10px 24px', borderRadius: 20, textDecoration: 'none', fontWeight: 600 }}>← {t('back_to_home', 'Back to Home')}</Link>
      </div>
    </div>
  );

  const brandColor = '#0ea5e9';
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Company Header */}
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 5%' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, height: 72 }}>
          {company?.logoURL ? (
            <img src={company.logoURL} alt={company.companyName} style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>
              {company?.companyName?.charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>{company?.companyName}</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{t('online_booking', 'Online Booking')}</div>
          </div>
          <Link to="/" style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.82rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={13} /> {t('back', 'Back')}
          </Link>
        </div>
      </header>

      {/* Progress Bar */}
      {step < 4 && (
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 5%' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 8 }}>
            {[t('select_service', 'Select Service'), t('your_details', 'Your Details'), t('confirm', 'Confirm')].map((label, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 4, borderRadius: 4, background: step > i ? '#6366f1' : '#e2e8f0', marginBottom: 6, transition: 'background 0.3s' }} />
                <span style={{ fontSize: '0.72rem', color: step > i ? '#6366f1' : '#94a3b8', fontWeight: step === i + 1 ? 700 : 400 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 5% 80px' }}>

        {/* STEP 1: Select Service */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{t('choose_service', 'Choose Your Service')}</h2>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.9rem' }}>{t('choose_service_desc', 'Select a vehicle type and service to get started')}</p>

            {/* Vehicle Type */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151', display: 'block', marginBottom: 10 }}>{t('vehicle_type', 'Vehicle Type')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['hatchback', 'sedan', 'suv', 'luxury_suv', 'scooter', 'bike', 'superbike'].map(v => (
                  <button key={v} onClick={() => { setForm(p => ({ ...p, vehicleType: v })); setSelectedService(null); }}
                    style={{ padding: '8px 14px', borderRadius: 20, border: `2px solid ${form.vehicleType === v ? '#6366f1' : '#e2e8f0'}`, background: form.vehicleType === v ? '#6366f130' : 'white', color: form.vehicleType === v ? '#6366f1' : '#374151', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s' }}>
                    {t(v, v.replace('_', ' '))}
                  </button>
                ))}
              </div>
            </div>

            {/* Services */}
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                <Car size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>{t('no_services_found', 'No services available right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {services.filter(s => getPrice(s) > 0).map(svc => {
                  const price = getPrice(svc);
                  const isSelected = selectedService?.id === svc.id;
                  return (
                    <div key={svc.id} onClick={() => setSelectedService(svc)}
                      style={{ background: 'white', border: `2px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`, borderRadius: 16, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.2s', boxShadow: isSelected ? '0 0 0 4px #6366f120' : 'none' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: isSelected ? '#6366f120' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Car size={20} color={isSelected ? '#6366f1' : '#64748b'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{svc.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                          {svc.durationMinutes || 30} {t('mins', 'mins')} · {svc.category || t('car_wash', 'Car Wash')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isSelected ? '#6366f1' : '#0f172a' }}>{formatCurrency(price, company?.currency || 'INR')}</div>
                      </div>
                      {isSelected && <CheckCircle size={20} color="#6366f1" />}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedService && (
              <button onClick={() => setStep(2)} style={{ marginTop: 24, width: '100%', padding: '14px', background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', color: 'white', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                {t('continue', 'Continue')} →
              </button>
            )}
          </div>
        )}

        {/* STEP 2: Details & Date */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.88rem', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> {t('back', 'Back')}
            </button>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>{t('your_details', 'Your Details')}</h2>

            {/* Selected Service Summary */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#1e40af' }}>{selectedService?.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#3b82f6' }}>{selectedService?.durationMinutes || 30} {t('mins', 'mins')}</div>
              </div>
              <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '1.1rem' }}>{formatCurrency(getPrice(selectedService), company?.currency || 'INR')}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { label: t('your_name', 'Your Name *'), key: 'customerName', type: 'text', placeholder: t('full_name_placeholder', 'Full name'), icon: User },
                { label: t('phone', 'Phone *'), key: 'phone', type: 'tel', placeholder: '+91 98765 43210', icon: Phone },
                { label: t('make', 'Car Make'), key: 'carMake', type: 'text', placeholder: t('make_placeholder', 'e.g. Toyota') },
                { label: t('model', 'Car Model'), key: 'carModel', type: 'text', placeholder: t('model_placeholder', 'e.g. Camry') },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  <input type={field.type} value={form[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder}
                    style={{ width: '100%', padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: 6 }}>{t('booking_date', 'Booking Date')} *</label>
                <input type="date" min={today} value={form.bookingDate} onChange={e => handleDateChange(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: 6 }}>{t('time_slot', 'Time Slot')} *</label>
                <select value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} disabled={!form.bookingDate || slotsLoading}
                  style={{ width: '100%', padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', background: slotsLoading ? '#f1f5f9' : 'white' }}>
                  <option value="">{slotsLoading ? t('loading_slots', 'Loading slots...') : t('pick_time', '-- Pick a time --')}</option>
                  {slots.map(s => (
                    <option key={s.time} value={s.time} disabled={s.isBooked}>
                      {s.label} {s.isBooked ? `(${t('booked', 'Booked')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={() => setStep(3)} disabled={!form.customerName || !form.phone || !form.bookingDate || !form.startTime}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', color: 'white', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: (!form.customerName || !form.phone || !form.bookingDate || !form.startTime) ? 0.5 : 1 }}>
              {t('review_booking', 'Review Booking')} →
            </button>
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.88rem', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> {t('back', 'Back')}
            </button>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>{t('confirm_booking', 'Confirm Booking')}</h2>

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', padding: '20px 24px' }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: 4 }}>{t('booking_at', 'Booking at')}</div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{company?.companyName}</div>
              </div>
              {[
                [t('service', 'Service'), selectedService?.name],
                [t('duration', 'Duration'), `${selectedService?.durationMinutes || 30} ${t('mins', 'minutes')}`],
                [t('price', 'Price'), formatCurrency(getPrice(selectedService), company?.currency || 'INR')],
                [t('customer', 'Customer'), form.customerName],
                [t('phone', 'Phone'), form.phone],
                [t('vehicle', 'Vehicle'), `${t(form.vehicleType, form.vehicleType)} — ${form.carMake} ${form.carModel}`],
                [t('date', 'Date'), new Date(form.bookingDate).toLocaleDateString(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
                [t('time', 'Time'), slots.find(s => s.time === form.startTime)?.label || form.startTime],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontSize: '0.88rem' }}>{label}</span>
                  <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.88rem', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                </div>
              ))}
              <div style={{ padding: '16px 24px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{t('total_amount', 'Total Amount')}</span>
                  <span style={{ fontWeight: 900, fontSize: '1.3rem', color: '#6366f1' }}>{formatCurrency(getPrice(selectedService), company?.currency || 'INR')}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>{t('payment_due_at_shop', 'Payment due at the shop')}</div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? t('submitting', 'Submitting...') : `✓ ${t('confirm_and_book', 'Confirm & Book')}`}
            </button>
          </div>
        )}

        {/* STEP 4: Success */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>{t('booking_confirmed', 'Booking Confirmed!')}</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: 8 }}>
              {t('booking_at_submitted', 'Your booking at')} <strong>{company?.companyName}</strong> {t('is_submitted', 'is submitted')}.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: 32 }}>
              {t('booking_confirmation_wait', "The team will confirm your appointment. You'll be contacted at")} <strong>{form.phone}</strong>.
            </p>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: '16px 24px', marginBottom: 32, display: 'inline-block' }}>
              <div style={{ color: '#1e40af', fontWeight: 700 }}>{selectedService?.name}</div>
              <div style={{ color: '#3b82f6', fontSize: '0.88rem' }}>{form.bookingDate} {t('at', 'at')} {slots.find(s => s.time === form.startTime)?.label || form.startTime}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => { setStep(1); setSelectedService(null); setForm({ customerName: '', phone: '', carMake: '', carModel: '', vehicleType: 'sedan', bookingDate: '', startTime: '' }); }}
                style={{ padding: '10px 24px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('book_another', 'Book Another')}
              </button>
              <Link to="/" style={{ padding: '10px 24px', background: '#f1f5f9', color: '#374151', borderRadius: 12, textDecoration: 'none', fontWeight: 600 }}>
                {t('back_to_home', 'Back to Home')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#f8fafc', padding: '40px 5%', textAlign: 'center', borderTop: '1px solid #e2e8f0', marginTop: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ background: 'white', padding: '4px', borderRadius: '6px', display: 'flex', border: '1px solid #e2e8f0' }}>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
                  <path fill="#34A853" d="M22 6v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6l10 7 10-7z"/>
                  <path fill="#EA4335" d="M2 6l10 7 10-7V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v0z"/>
                  <path fill="#FBBC05" d="M2 18l7.5-5.25L2 6v12z"/>
                  <path fill="#FBBC05" d="M22 6l-7.5 6.75L22 18V6z"/>
                </svg>
              </div>
              <a href="mailto:Zwash.office@gmail.com" style={{ color: '#0f172a', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Zwash.office@gmail.com</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Phone size={16} color="#64748b" />
              <a href="tel:8838157898" style={{ color: '#0f172a', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>8838157898</a>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>
            © {new Date().getFullYear()} Zwash. All rights reserved.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: #6366f1 !important; }
      `}</style>
    </div>
  );
}
