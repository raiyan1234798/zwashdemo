import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
    Settings as SettingsIcon,
    Store,
    Clock,
    Wallet,
    Calendar,
    Save,
    Download,
    FileText,
    ToggleLeft,
    ToggleRight,
    RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Settings = () => {
    const { t } = useTranslation();
    const { isAdmin, user, userProfile } = useAuth();
    const { theme, updateTheme } = useTheme();
    const { changeCurrency } = useCurrency();
    const [settings, setSettings] = useState({
        businessName: 'My Car Wash',
        businessPhone: '',
        businessEmail: '',
        businessAddress: '',
        currency: 'USD',
        currencySymbol: '$',
        openTime: '09:00',
        closeTime: '18:00',
        slotDuration: 30,
        bufferTime: 15,
        maxConcurrentBookings: 2,
        // GST Settings
        gstEnabled: false,
        gstNumber: '',
        gstPercentage: 18,
        // Default Templates
        whatsappConfirmation: '',
        whatsappReminder: '',
        workingDays: [1, 2, 3, 4, 5, 6],
        logoURL: '',
        supportPhone: '',
        paymentPhone: '',
        enquiryPhone: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            // Use Auth UID as the document ID for shop-specific settings
            const docRef = doc(db, 'settings', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const companyId = userProfile?.companyId;

            // Save to shop-specific settings
            await setDoc(doc(db, 'settings', user.uid), {
                ...settings,
                updatedAt: serverTimestamp()
            });

            // Sync with demoClients if companyId exists (to reflect on public booking site)
            if (companyId) {
                await import('firebase/firestore').then(({ updateDoc, doc }) => {
                    return updateDoc(doc(db, 'demoClients', companyId), {
                        companyName: settings.businessName,
                        logoURL: settings.logoURL,
                        openTime: settings.openingTime || settings.openTime,
                        closeTime: settings.closingTime || settings.closeTime,
                        slotDuration: settings.slotDuration,
                        maxConcurrentBookings: settings.maxConcurrentBookings,
                        updatedAt: serverTimestamp()
                    });
                });
            }

            // Sync with global currency context
            if (settings.currency) {
                changeCurrency(settings.currency);
            }
            alert(t('settings_saved_success', { defaultValue: 'Settings saved successfully!' }));
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleBackup = async () => {
        try {
            // This is a simple backup - in production you'd want to backup all collections
            const backup = {
                settings: settings,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `zwashdemo_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Backup error:', error);
        }
    };

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader"></div>
            </div>
        );
    }

    return (
        <>
        <div className="settings-page">
            <div className="page-header">
                <div>
                    <h1><SettingsIcon size={28} /> {t('settings')}</h1>
                    <p className="subtitle">{t('configure_business_settings', { defaultValue: 'Configure your business settings' })}</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleBackup}>
                        <Download size={18} /> {t('backup_data', { defaultValue: 'Backup Data' })}
                    </button>
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                            <Save size={18} /> {saving ? t('saving') : t('save_settings', { defaultValue: 'Save Settings' })}
                        </button>
                    )}
                </div>
            </div>

            <div className="settings-grid">
                {/* Personal Profile Info */}
                <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}><SettingsIcon size={18} /> Personal Profile</h3>
                        <div style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1e40af', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>Connected to Google</div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            {userProfile?.photoURL ? (
                                <img 
                                    src={userProfile.photoURL} 
                                    alt="" 
                                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = 'none';
                                        e.target.parentNode.querySelector('.profile-placeholder').style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div className="profile-placeholder" style={{ display: userProfile?.photoURL ? 'none' : 'flex', width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                {userProfile?.displayName?.charAt(0) || 'U'}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{userProfile?.displayName}</div>
                            <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 12 }}>{userProfile?.email}</div>
                            <button 
                                className="btn btn-secondary" 
                                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                onClick={async () => {
                                    if (window.confirm('Sync profile info from your Google account?')) {
                                        // This will trigger the sync logic in fetchUserProfile on next reload or login
                                        // But for immediate effect, we can suggest a reload
                                        window.location.reload();
                                    }
                                }}
                            >
                                <RefreshCw size={14} style={{ marginRight: 6 }} /> Sync from Google
                            </button>
                        </div>
                    </div>
                </div>

                {/* Business Info */}
                <div className="card">
                    <div className="card-header">
                        <h3><Store size={18} /> {t('business_information')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>{t('business_name')}</label>
                            <input
                                name="businessName"
                                value={settings.businessName}
                                onChange={handleChange}
                                placeholder={t('business_name_placeholder')}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('logo_url')}</label>
                            <input
                                name="logoURL"
                                value={settings.logoURL || ''}
                                onChange={handleChange}
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('phone')}</label>
                                <input
                                    name="businessPhone"
                                    value={settings.businessPhone}
                                    onChange={handleChange}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('email')}</label>
                                <input
                                    name="businessEmail"
                                    type="email"
                                    value={settings.businessEmail}
                                    onChange={handleChange}
                                    placeholder="contact@carwash.com"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('address')}</label>
                            <textarea
                                name="businessAddress"
                                value={settings.businessAddress}
                                onChange={handleChange}
                                rows="2"
                                placeholder="123 Demo Street, Tech City"
                            />
                        </div>
                    </div>
                </div>

                {/* UI Customization */}
                {isAdmin && (
                    <div className="card">
                        <div className="card-header">
                            <h3><SettingsIcon size={18} /> {t('ui_appearance')}</h3>
                        </div>
                        <div className="card-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('primary_brand_color')}</label>
                                    <div className="form-group-color-input" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="color"
                                            value={theme?.primaryColor || '#047857'}
                                            onChange={(e) => updateTheme({ ...theme, primaryColor: e.target.value })}
                                            style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            value={theme?.primaryColor || '#047857'}
                                            onChange={(e) => updateTheme({ ...theme, primaryColor: e.target.value })}
                                            placeholder="#047857"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('secondary_color')}</label>
                                    <div className="form-group-color-input" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="color"
                                            value={theme?.secondaryColor || '#d97706'}
                                            onChange={(e) => updateTheme({ ...theme, secondaryColor: e.target.value })}
                                            style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            value={theme?.secondaryColor || '#d97706'}
                                            onChange={(e) => updateTheme({ ...theme, secondaryColor: e.target.value })}
                                            placeholder="#d97706"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('sidebar_background')}</label>
                                    <div className="form-group-color-input" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="color"
                                            value={theme?.sidebarColor || '#1e293b'}
                                            onChange={(e) => updateTheme({ ...theme, sidebarColor: e.target.value })}
                                            style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            value={theme?.sidebarColor || '#1e293b'}
                                            onChange={(e) => updateTheme({ ...theme, sidebarColor: e.target.value })}
                                            placeholder="#1e293b"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('border_radius')}</label>
                                    <select
                                        value={theme?.borderRadius || '8px'}
                                        onChange={(e) => updateTheme({ ...theme, borderRadius: e.target.value })}
                                    >
                                        <option value="0px">{t('square')}</option>
                                        <option value="4px">{t('small')}</option>
                                        <option value="8px">{t('medium')}</option>
                                        <option value="12px">{t('large')}</option>
                                        <option value="20px">{t('round')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Operating Hours */}
                <div className="card">
                    <div className="card-header">
                        <h3><Clock size={18} /> {t('operating_hours')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('opening_time')}</label>
                                <input
                                    name="openTime"
                                    type="time"
                                    value={settings.openTime}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('closing_time')}</label>
                                <input
                                    name="closeTime"
                                    type="time"
                                    value={settings.closeTime}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('slot_duration')}</label>
                                <input
                                    name="slotDuration"
                                    type="number"
                                    value={settings.slotDuration}
                                    onChange={handleChange}
                                    min="15"
                                    max="120"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('buffer_time')}</label>
                                <input
                                    name="bufferTime"
                                    type="number"
                                    value={settings.bufferTime}
                                    onChange={handleChange}
                                    min="0"
                                    max="60"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('max_concurrent_bookings')}</label>
                            <input
                                name="maxConcurrentBookings"
                                type="number"
                                value={settings.maxConcurrentBookings}
                                onChange={handleChange}
                                min="1"
                                max="10"
                            />
                        </div>
                    </div>
                </div>

                {/* Currency */}
                <div className="card">
                    <div className="card-header">
                        <h3><Wallet size={18} /> {t('currency_settings')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('currency_code')}</label>
                                <select name="currency" value={settings.currency} onChange={handleChange}>
                                    <option value="INR">INR - Indian Rupee</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('currency_symbol')}</label>
                                <input
                                    name="currencySymbol"
                                    value={settings.currencySymbol}
                                    onChange={handleChange}
                                    placeholder="$"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* GST Settings */}
                <div className="card">
                    <div className="card-header">
                        <h3><FileText size={18} /> {t('tax_settings')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>{t('enable_gst')}</label>
                            <button
                                type="button"
                                className="toggle-btn"
                                onClick={() => setSettings(prev => ({ ...prev, gstEnabled: !prev.gstEnabled }))}
                                style={{
                                    background: settings.gstEnabled ? 'var(--success)' : 'var(--navy-300)',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {settings.gstEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                {settings.gstEnabled ? t('enabled') : t('disabled')}
                            </button>
                        </div>

                        {settings.gstEnabled && (
                            <>
                                <div className="form-group">
                                    <label>{t('gst_number')}</label>
                                    <input
                                        name="gstNumber"
                                        value={settings.gstNumber}
                                        onChange={handleChange}
                                        placeholder="22AAAAA0000A1Z5"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('gst_percentage')}</label>
                                    <input
                                        name="gstPercentage"
                                        type="number"
                                        value={settings.gstPercentage}
                                        onChange={handleChange}
                                        min="0"
                                        max="28"
                                        placeholder="18"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* WhatsApp Message Templates */}
                <div className="card">
                    <div className="card-header">
                        <h3>📱 {t('whatsapp_templates')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>{t('booking_confirmation')}</label>
                            <textarea
                                name="whatsappConfirmation"
                                value={settings.whatsappConfirmation || 'Hi {name}! Booking confirmed. 📅 {date}, ⏰ {time}, 🚗 {service}. - {business}'}
                                onChange={handleChange}
                                rows="2"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('reminder_message')}</label>
                            <textarea
                                name="whatsappReminder"
                                value={settings.whatsappReminder || 'Reminder: Your car wash is tomorrow at {time}. - {business}'}
                                onChange={handleChange}
                                rows="2"
                            />
                        </div>
                        <small style={{ color: 'var(--navy-500)' }}>Placeholders: {'{name}'}, {'{date}'}, {'{time}'}, {'{service}'}, {'{business}'}</small>
                    </div>
                </div>

                {/* Support & Messaging Channels */}
                <div className="card">
                    <div className="card-header">
                        <h3>💬 {t('support_channels')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('complaints_phone')}</label>
                                <input
                                    name="supportPhone"
                                    value={settings.supportPhone || ''}
                                    onChange={handleChange}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('payment_phone')}</label>
                                <input
                                    name="paymentPhone"
                                    value={settings.paymentPhone || ''}
                                    onChange={handleChange}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('enquiry_phone')}</label>
                            <input
                                name="enquiryPhone"
                                value={settings.enquiryPhone || ''}
                                onChange={handleChange}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--navy-500)', marginTop: '0.5rem' }}>
                            {t('support_channels_help')}
                        </p>
                    </div>
                </div>

                {/* Working Days */}
                <div className="card">
                    <div className="card-header">
                        <h3><Calendar size={18} /> {t('working_days')}</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                                const days = settings.workingDays || [1, 2, 3, 4, 5, 6];
                                const isOn = days.includes(i);
                                return (
                                    <button key={day} type="button" onClick={() => {
                                        const newDays = isOn ? days.filter(d => d !== i) : [...days, i];
                                        setSettings(prev => ({ ...prev, workingDays: newDays }));
                                    }} style={{
                                        padding: '0.5rem 0.75rem', borderRadius: '6px',
                                        border: 'none', background: isOn ? 'var(--primary)' : '#e5e7eb',
                                        color: isOn ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer'
                                    }}>{day}</button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        .settings-grid {
          display: grid;
          gap: 1.5rem;
        }
        
        .settings-grid .card {
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          border: 1px solid var(--navy-100);
        }
        
        .settings-grid .card-header {
          background: var(--navy-50);
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--navy-100);
        }
        
        .settings-grid .card-header h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--navy-800);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
        }
        
        .settings-grid .card-body {
          padding: 1.25rem;
        }

        .form-row {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .form-row .form-group {
            flex: 1;
            margin-bottom: 0;
        }
        
        .gst-toggle {
          background: var(--navy-100);
          color: var(--navy-600);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .header-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .header-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .settings-grid {
            gap: 1rem;
          }
          
          .settings-grid .card-header {
            padding: 0.875rem 1rem;
          }
          
          .settings-grid .card-body {
            padding: 1rem;
          }
          
          .form-row {
            flex-direction: column;
            gap: 1rem;
          }

          .form-group-color-input {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .form-group-color-input input[type="text"] {
            width: 100% !important;
          }
          
          .settings-grid textarea {
            font-size: 0.875rem;
          }
        }
      `}</style>
        </div>
        </>
    );
};

export default Settings;
