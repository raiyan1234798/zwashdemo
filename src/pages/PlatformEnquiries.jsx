import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, orderBy, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Mail, Trash2, CheckCircle, Clock, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PlatformEnquiries() {
    const { t } = useTranslation();
    const [enquiries, setEnquiries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEnquiries();
    }, []);

    const fetchEnquiries = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'platformEnquiries'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setEnquiries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Error fetching enquiries:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await updateDoc(doc(db, 'platformEnquiries', id), { status: 'read' });
            setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status: 'read' } : e));
        } catch (error) {
            console.error('Error updating enquiry:', error);
        }
    };

    const deleteEnquiry = async (id) => {
        if (!window.confirm('Are you sure you want to delete this enquiry?')) return;
        try {
            await deleteDoc(doc(db, 'platformEnquiries', id));
            setEnquiries(prev => prev.filter(e => e.id !== id));
        } catch (error) {
            console.error('Error deleting enquiry:', error);
        }
    };

    const styles = {
        page: {
            padding: '24px',
            minHeight: '100vh',
            background: 'var(--bg-primary, #f8fafc)',
        },
        headerIcon: { display: 'flex', alignItems: 'center', gap: '8px' },
        subtitle: { color: 'var(--text-secondary, #64748b)', marginTop: '4px', fontSize: '0.95rem' },
        card: {
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: {
            padding: '14px 20px',
            textAlign: 'left',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary, #94a3b8)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--table-header-bg, #f8fafc)',
        },
        td: {
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            fontSize: '0.92rem',
            verticalAlign: 'middle',
        },
        newRow: { background: 'rgba(37, 99, 235, 0.04)' },
        emptyState: {
            padding: '80px 24px',
            textAlign: 'center',
            color: 'var(--text-tertiary, #94a3b8)',
        },
        badgeNew: {
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'rgba(37,99,235,0.1)', color: '#2563eb',
            padding: '4px 12px', borderRadius: '20px',
            fontSize: '0.78rem', fontWeight: 700,
            border: '1px solid rgba(37,99,235,0.2)',
        },
        badgeRead: {
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'rgba(100,116,139,0.1)', color: '#64748b',
            padding: '4px 12px', borderRadius: '20px',
            fontSize: '0.78rem', fontWeight: 700,
            border: '1px solid rgba(100,116,139,0.15)',
        },
        actionBtn: {
            width: '32px', height: '32px',
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--btn-bg, #f8fafc)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: 'var(--text-secondary, #64748b)',
        },
        waBtn: {
            width: '32px', height: '32px',
            border: '1px solid rgba(37,211,102,0.25)',
            background: 'rgba(37,211,102,0.06)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: '#25d366',
        },
        dangerBtn: {
            width: '32px', height: '32px',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.05)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: '#ef4444',
        },
    };

    return (
        <div style={styles.page}>
            <div style={{ marginBottom: '28px' }}>
                <h1 style={styles.headerIcon}>
                    <Mail size={26} />
                    {t('platform_enquiries', 'Platform Enquiries')}
                </h1>
                <p style={styles.subtitle}>
                    {t('manage_website_enquiries', 'Manage enquiries from the public booking website.')}
                </p>
            </div>

            <div style={styles.card}>
                {loading ? (
                    <div style={styles.emptyState}>
                        <div className="loader" />
                    </div>
                ) : enquiries.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Mail size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                        <p>{t('no_enquiries', 'No enquiries found.')}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>{t('date', 'Date')}</th>
                                    <th style={styles.th}>{t('contact', 'Contact')}</th>
                                    <th style={styles.th}>{t('plan_budget', 'Plan / Budget')}</th>
                                    <th style={styles.th}>{t('message', 'Message')}</th>
                                    <th style={styles.th}>{t('status', 'Status')}</th>
                                    <th style={styles.th}>{t('actions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {enquiries.map(enq => (
                                    <tr key={enq.id} style={enq.status === 'new' ? styles.newRow : {}}>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary, #64748b)', fontSize: '0.85rem' }}>
                                                <Clock size={13} />
                                                {enq.createdAt
                                                    ? new Date(enq.createdAt?.toDate?.() || enq.createdAt).toLocaleDateString()
                                                    : '—'}
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <strong style={{ color: 'var(--text-primary, #0f172a)' }}>
                                                {enq.fullName || enq.name}
                                            </strong>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                {/* Gmail icon */}
                                                <div style={{ background: 'white', padding: '2px 3px', borderRadius: '4px', display: 'flex', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                    <svg width="13" height="10" viewBox="0 0 24 18">
                                                        <path fill="#4285F4" d="M1.5 18h3V9L0 6.75V16.5c0 .825.675 1.5 1.5 1.5z"/>
                                                        <path fill="#34A853" d="M19.5 18h3c.825 0 1.5-.675 1.5-1.5V6.75L19.5 9z"/>
                                                        <path fill="#FBBC05" d="M19.5 1.5v7.5L24 6.75V2.25c0-1.837-2.1-2.887-3.562-1.762z"/>
                                                        <path fill="#EA4335" d="M4.5 9V1.5L12 7l7.5-5.5V9L12 14.5z"/>
                                                        <path fill="#C5221F" d="M0 2.25v4.5L4.5 9V1.5L3.563.488C2.1-.638 0 .412 0 2.25z"/>
                                                    </svg>
                                                </div>
                                                <a
                                                    href={`mailto:${enq.businessEmail || enq.email}`}
                                                    style={{ fontSize: '0.82rem', color: '#3b82f6', textDecoration: 'none' }}
                                                >
                                                    {enq.businessEmail || enq.email}
                                                </a>
                                            </div>
                                            {enq.phone && (
                                                <a
                                                    href={`tel:${enq.phone}`}
                                                    style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)', display: 'block', marginTop: '2px', textDecoration: 'none' }}
                                                >
                                                    {enq.phone}
                                                </a>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', textTransform: 'capitalize' }}>
                                                {enq.budget || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ ...styles.td, maxWidth: '280px', whiteSpace: 'normal', color: 'var(--text-secondary, #64748b)' }}>
                                            {enq.inquiry || enq.message || <span style={{ opacity: 0.4 }}>No message</span>}
                                        </td>
                                        <td style={styles.td}>
                                            {enq.status === 'new' ? (
                                                <span style={styles.badgeNew}>● New</span>
                                            ) : (
                                                <span style={styles.badgeRead}>✓ Read</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {enq.status === 'new' && (
                                                    <button
                                                        style={styles.actionBtn}
                                                        title="Mark as Read"
                                                        onClick={() => markAsRead(enq.id)}
                                                    >
                                                        <CheckCircle size={15} />
                                                    </button>
                                                )}
                                                {enq.phone && (
                                                    <button
                                                        style={styles.waBtn}
                                                        title="Reply via WhatsApp"
                                                        onClick={() => {
                                                            const phone = enq.phone.replace(/\D/g, '');
                                                            const text = encodeURIComponent(
                                                                `Hello ${enq.fullName || enq.name},\n\nThank you for reaching out to Zwash! We received your enquiry${enq.budget ? ` regarding the "${enq.budget}" package` : ''}. How can we assist you?`
                                                            );
                                                            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                                                        }}
                                                    >
                                                        <MessageCircle size={15} />
                                                    </button>
                                                )}
                                                <button
                                                    style={styles.dangerBtn}
                                                    title="Delete"
                                                    onClick={() => deleteEnquiry(enq.id)}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
