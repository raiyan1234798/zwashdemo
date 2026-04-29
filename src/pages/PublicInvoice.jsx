import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const PublicInvoice = () => {
    const { id } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            setLoading(true);
            // Try invoices collection first, then bookings
            let data = null;

            const invoiceRef = doc(db, 'invoices', id);
            const invoiceSnap = await getDoc(invoiceRef);
            if (invoiceSnap.exists()) {
                data = { id: invoiceSnap.id, ...invoiceSnap.data(), source: 'invoice' };
            } else {
                const bookingRef = doc(db, 'bookings', id);
                const bookingSnap = await getDoc(bookingRef);
                if (bookingSnap.exists()) {
                    data = { id: bookingSnap.id, ...bookingSnap.data(), source: 'booking' };
                }
            }

            if (!data) {
                setError('Invoice not found.');
            } else {
                setInvoice(data);
            }
        } catch (err) {
            console.error('Error fetching invoice:', err);
            setError('Unable to load invoice. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    // Build line items from available data sources
    const getLineItems = (inv) => {
        if (inv.items && inv.items.length > 0) return inv.items;
        if (inv.serviceBreakdown && inv.serviceBreakdown.length > 0) {
            return inv.serviceBreakdown.map(s => ({
                description: s.name,
                quantity: s.quantity ?? 1,
                price: s.price ?? 0,
                total: (s.price ?? 0) * (s.quantity ?? 1)
            }));
        }
        return [{
            description: inv.serviceName || 'Service',
            quantity: 1,
            price: inv.price ?? 0,
            total: inv.price ?? 0
        }];
    };

    if (loading) {
        return (
            <div style={styles.center}>
                <div style={styles.spinner} />
                <p style={{ color: '#64748b', marginTop: '1rem' }}>Loading invoice...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.center}>
                <div style={{ fontSize: '3rem' }}>🔍</div>
                <h2 style={{ color: '#1a1f3a', marginTop: '1rem' }}>Invoice Not Found</h2>
                <p style={{ color: '#64748b' }}>{error}</p>
            </div>
        );
    }

    const lineItems = getLineItems(invoice);
    const subtotal = invoice.price || lineItems.reduce((s, i) => s + (i.total ?? 0), 0);
    const paidAmount = invoice.paidAmount || 0;
    const balance = Math.max(0, subtotal - paidAmount);

    // Build payment mode string from history
    let paymentModeStr = '';
    if (invoice.paymentHistory && invoice.paymentHistory.length > 0) {
        const modes = new Set();
        invoice.paymentHistory.forEach(h => {
            (h.splits || []).forEach(s => { if (s.mode) modes.add(s.mode.toUpperCase()); });
        });
        if (modes.size > 0) paymentModeStr = Array.from(modes).join(' + ');
    }
    if (!paymentModeStr && invoice.paymentMode && invoice.paymentMode !== 'none') {
        paymentModeStr = invoice.paymentMode.toUpperCase();
    }

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.companyInfo}>
                        <img src="/detail.png" alt="Zwash Demo" style={styles.logo} onError={e => e.target.style.display = 'none'} />
                        <div>
                            <h1 style={styles.companyName}>Zwash Demo</h1>
                            <p style={styles.companyDetail}>Suchindram Byp, near Ragavendra Temple</p>
                            <p style={styles.companyDetail}>Nagercoil, Tamil Nadu 629704</p>
                            <p style={{ ...styles.companyDetail, marginTop: '6px' }}>
                                📞 +91 9363911500 &nbsp;|&nbsp; ✉️ detailingcommando@gmail.com
                            </p>
                        </div>
                    </div>
                    <div style={styles.invoiceTitle}>
                        <h2 style={styles.invoiceLabel}>INVOICE</h2>
                        <p style={styles.invoiceNum}>
                            #{invoice.invoiceNumber || invoice.bookingReference || invoice.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p style={styles.invoiceDate}>
                            Date: {formatDate(invoice.bookingDate || invoice.invoiceDate)}
                        </p>
                    </div>
                </div>

                <hr style={styles.divider} />

                {/* Customer & Vehicle */}
                <div style={styles.detailsGrid}>
                    <div style={styles.detailBox}>
                        <p style={styles.sectionLabel}>BILL TO</p>
                        <p style={styles.customerName}>{invoice.customerName || 'Walk-in Customer'}</p>
                        <p style={styles.detailText}>Phone: {invoice.contactPhone || 'N/A'}</p>
                    </div>
                    <div style={styles.detailBox}>
                        <p style={styles.sectionLabel}>VEHICLE INFO</p>
                        <p style={{ ...styles.customerName, color: '#1a1f3a' }}>
                            {invoice.carMake || ''} {invoice.carModel || ''}
                        </p>
                        {invoice.licensePlate && <p style={styles.detailText}>Plate: {invoice.licensePlate}</p>}
                        {invoice.startTime && (
                            <p style={styles.detailText}>Service Time: {formatTime12Hour(invoice.startTime)}</p>
                        )}
                    </div>
                </div>

                {/* Items Table */}
                <table style={styles.table}>
                    <thead>
                        <tr style={styles.tableHead}>
                            <th style={{ ...styles.th, textAlign: 'left' }}>Service Description</th>
                            <th style={{ ...styles.th, width: '60px', textAlign: 'center' }}>Qty</th>
                            <th style={{ ...styles.th, width: '110px', textAlign: 'right' }}>Rate</th>
                            <th style={{ ...styles.th, width: '110px', textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineItems.map((item, i) => (
                            <tr key={i} style={i % 2 === 1 ? styles.trAlt : {}}>
                                <td style={styles.td}>
                                    <strong>{item.description || item.serviceName || 'Service'}</strong>
                                </td>
                                <td style={{ ...styles.td, textAlign: 'center' }}>{item.quantity ?? 1}</td>
                                <td style={{ ...styles.td, textAlign: 'right' }}>
                                    {formatCurrency(item.price ?? item.rate ?? 0)}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right' }}>
                                    <strong>{formatCurrency(item.total ?? item.amount ?? 0)}</strong>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div style={styles.totalsWrapper}>
                    <div style={styles.totals}>
                        <div style={styles.totalRow}>
                            <span style={{ color: '#64748b' }}>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div style={{ ...styles.totalRow, ...styles.totalRowFinal }}>
                            <span>Total Amount</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>

                        {/* Payment Summary */}
                        <div style={styles.paymentBox}>
                            <div style={styles.paymentRow}>
                                <span style={{ color: '#64748b', fontSize: '13px' }}>Paid Amount</span>
                                <span style={{ color: '#047857', fontWeight: '600' }}>{formatCurrency(paidAmount)}</span>
                            </div>
                            <div style={{ ...styles.paymentRow, borderTop: '1px dashed #e2e8f0', paddingTop: '6px', marginTop: '4px' }}>
                                <span style={{ fontWeight: '700' }}>Balance Due</span>
                                <span style={{ fontWeight: '700', color: balance > 0 ? '#ef4444' : '#047857' }}>
                                    {formatCurrency(balance)}
                                </span>
                            </div>
                            {paymentModeStr && (
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Payment Mode: {paymentModeStr}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <p style={styles.thankYou}>Thank you for choosing us! 🙏</p>
                    <p style={styles.footerNote}>This is a computer-generated invoice and does not require a signature.</p>
                </div>
            </div>
        </div>
    );
};

const styles = {
    page: {
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: '#1e293b'
    },
    container: {
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '40px',
        maxWidth: '800px',
        width: '100%',
        height: 'fit-content'
    },
    center: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'Segoe UI', Arial, sans-serif"
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '4px solid #e2e8f0',
        borderTop: '4px solid #1a1f3a',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '28px',
        gap: '1rem',
        flexWrap: 'wrap'
    },
    companyInfo: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
    },
    logo: {
        width: '80px',
        height: '80px',
        objectFit: 'contain',
        borderRadius: '8px'
    },
    companyName: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1a1f3a',
        margin: '0 0 6px 0'
    },
    companyDetail: {
        fontSize: '12px',
        color: '#64748b',
        margin: '2px 0',
        lineHeight: '1.5'
    },
    invoiceTitle: {
        textAlign: 'right'
    },
    invoiceLabel: {
        fontSize: '26px',
        fontWeight: '800',
        color: '#1a1f3a',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        margin: 0
    },
    invoiceNum: {
        fontSize: '14px',
        color: '#2e3856',
        fontWeight: '600',
        margin: '6px 0 2px 0'
    },
    invoiceDate: {
        fontSize: '12px',
        color: '#64748b',
        margin: 0
    },
    divider: {
        border: 'none',
        borderTop: '3px solid #1a1f3a',
        margin: '0 0 24px 0'
    },
    detailsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        background: '#f8fafc',
        padding: '18px 20px',
        borderRadius: '8px',
        marginBottom: '24px'
    },
    detailBox: {},
    sectionLabel: {
        fontSize: '10px',
        textTransform: 'uppercase',
        color: '#2e3856',
        letterSpacing: '1.5px',
        fontWeight: '700',
        margin: '0 0 8px 0'
    },
    customerName: {
        fontSize: '14px',
        fontWeight: '700',
        color: '#c2410c',
        margin: '0 0 4px 0'
    },
    detailText: {
        fontSize: '13px',
        color: '#475569',
        margin: '2px 0',
        lineHeight: '1.6'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px'
    },
    tableHead: {
        background: '#1a1f3a'
    },
    th: {
        color: 'white',
        padding: '12px 14px',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontWeight: '600'
    },
    td: {
        padding: '13px 14px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '13px'
    },
    trAlt: {
        background: '#f8fafc'
    },
    totalsWrapper: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '32px'
    },
    totals: {
        width: '280px'
    },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '9px 0',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '13px'
    },
    totalRowFinal: {
        fontSize: '17px',
        fontWeight: '700',
        color: '#1a1f3a',
        borderBottom: 'none',
        borderTop: '2px solid #1a1f3a',
        paddingTop: '14px',
        marginTop: '4px'
    },
    paymentBox: {
        marginTop: '14px',
        padding: '12px',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
    },
    paymentRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '13px',
        marginBottom: '4px'
    },
    footer: {
        borderTop: '1px solid #e2e8f0',
        paddingTop: '20px',
        textAlign: 'center'
    },
    thankYou: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1a1f3a',
        margin: '0 0 8px 0'
    },
    footerNote: {
        fontSize: '11px',
        color: '#94a3b8',
        margin: 0
    }
};

export default PublicInvoice;
