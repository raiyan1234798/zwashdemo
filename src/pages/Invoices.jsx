import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, query, getDocs, orderBy, doc, getDoc, updateDoc, addDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore';
import { FileText, Download, Eye, Search, Printer, Receipt, MessageCircle, Copy, ExternalLink, Plus, Edit, Trash2, Archive, RotateCcw, X, Car, CheckCircle2, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import SplitPaymentSelector from '../components/SplitPaymentSelector';

const Invoices = () => {
    const { hasPermission, isEmployee, user, userProfile } = useAuth();

    // Get today and yesterday dates for employee filtering
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Core states
    const [invoices, setInvoices] = useState([]);
    const [archivedInvoices, setArchivedInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [settings, setSettings] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Tab state: 'active' or 'archived'
    const [activeTab, setActiveTab] = useState('active');

    // CRUD Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);

    useEffect(() => {
        fetchInvoices();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const docRef = doc(db, 'settings', 'business');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data());
            }
        } catch (error) {
            console.log('Settings fetch not available or permission denied');
        }
    };

    const fetchInvoices = async () => {
        try {
            setLoading(true);

            // Fetch completed bookings
            const bookingsSnap = await getDocs(query(collection(db, 'bookings')));
            const completedBookings = bookingsSnap.docs
                .map(d => ({ id: d.id, ...d.data(), source: 'booking' }))
                .filter(b => b.status === 'completed' && !b.isArchived);

            // Fetch manual invoices
            const invoicesSnap = await getDocs(query(collection(db, 'invoices')));
            const manualInvoices = invoicesSnap.docs
                .map(d => ({ id: d.id, ...d.data(), source: 'invoice' }));

            // Separate active and archived
            const activeManual = manualInvoices.filter(inv => !inv.isArchived);
            const archivedManual = manualInvoices.filter(inv => inv.isArchived);
            const archivedBookings = bookingsSnap.docs
                .map(d => ({ id: d.id, ...d.data(), source: 'booking' }))
                .filter(b => b.status === 'completed' && b.isArchived);

            // Combine and sort by date
            const allActive = [...completedBookings, ...activeManual]
                .sort((a, b) => (b.bookingDate || b.invoiceDate || '').localeCompare(a.bookingDate || a.invoiceDate || ''));
            const allArchived = [...archivedBookings, ...archivedManual]
                .sort((a, b) => (b.bookingDate || b.invoiceDate || '').localeCompare(a.bookingDate || a.invoiceDate || ''));

            setInvoices(allActive);
            setArchivedInvoices(allArchived);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    // Archive an invoice (soft delete)
    const archiveInvoice = async (invoice) => {
        if (!window.confirm(`Archive invoice for ${invoice.customerName || 'this customer'}?`)) return;
        try {
            const collectionName = invoice.source === 'invoice' ? 'invoices' : 'bookings';
            await updateDoc(doc(db, collectionName, invoice.id), {
                isArchived: true,
                archivedAt: serverTimestamp()
            });
            fetchInvoices();
        } catch (error) {
            console.error('Error archiving invoice:', error);
            alert('Error archiving invoice');
        }
    };

    // Restore an archived invoice
    const restoreInvoice = async (invoice) => {
        try {
            const collectionName = invoice.source === 'invoice' ? 'invoices' : 'bookings';
            await updateDoc(doc(db, collectionName, invoice.id), {
                isArchived: false,
                restoredAt: serverTimestamp()
            });
            fetchInvoices();
        } catch (error) {
            console.error('Error restoring invoice:', error);
            alert('Error restoring invoice');
        }
    };

    const exportToExcel = () => {
        const exportData = invoices.map(inv => ({
            'Invoice #': inv.bookingReference || inv.id.slice(0, 8),
            Date: inv.bookingDate,
            Service: inv.serviceName,
            Amount: inv.price,
            'Paid Amount': inv.paidAmount || 0,
            'Payment Status': inv.paymentStatus || 'unpaid',
            'License Plate': inv.licensePlate,
            'Customer Name': inv.customerName,
            'Customer Phone': inv.contactPhone
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
        XLSX.writeFile(wb, `invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Payment status update
    // Payment states
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentPrice, setPaymentPrice] = useState('');
    const [discount, setDiscount] = useState('');
    const [extraCharge, setExtraCharge] = useState('');
    const [processing, setProcessing] = useState(false);

    // Split Payment State
    const [paymentSplits, setPaymentSplits] = useState([{ mode: 'cash', amount: '' }]);

    // Milestone / Partial Payment State
    const [balanceNote, setBalanceNote] = useState('');
    const [paymentDueDate, setPaymentDueDate] = useState('');

    const handleAddSplit = () => {
        setPaymentSplits([...paymentSplits, { mode: 'cash', amount: '' }]);
    };

    const handleRemoveSplit = (index) => {
        if (paymentSplits.length > 1) {
            setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
        }
    };

    const handleSplitChange = (index, field, value) => {
        const newSplits = [...paymentSplits];
        newSplits[index][field] = value;
        setPaymentSplits(newSplits);
    };

    const updatePaymentStatus = async () => {
        if (!paymentInvoice) return;
        try {
            setProcessing(true);

            // Calculate total from splits
            const currentPaymentTotal = paymentSplits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);

            // Use the edited price from state, or fallback to original
            const newTotalPrice = Number(paymentPrice) || paymentInvoice.price || 0;
            const previousPaid = paymentInvoice.paidAmount || 0;
            const newPaidTotal = previousPaid + currentPaymentTotal;

            let status = 'unpaid';
            if (newPaidTotal >= newTotalPrice) status = 'paid';
            else if (newPaidTotal > 0) status = 'partial';

            // Construct payment history entry
            const paymentEntry = {
                date: new Date().toISOString(),
                amount: currentPaymentTotal,
                splits: paymentSplits.map(s => ({ mode: s.mode, amount: Number(s.amount) || 0 })),
                recordedBy: user?.uid || 'unknown'
            };

            const docRef = doc(db, paymentInvoice.source === 'invoice' ? 'invoices' : 'bookings', paymentInvoice.id);

            const docSnap = await getDoc(docRef);
            let currentHistory = [];
            if (docSnap.exists()) {
                currentHistory = docSnap.data().paymentHistory || [];
            }

            const updatedHistory = [...currentHistory, paymentEntry];

            // Prepare update data
            const updateData = {
                price: newTotalPrice,
                discount: Number(discount) || 0,
                extraCharge: Number(extraCharge) || 0,
                paidAmount: newPaidTotal,
                paymentStatus: status,
                // Legacy fields for backward compatibility (shows primary mode of this specific payment)
                paymentMode: paymentSplits[0]?.mode || 'cash',
                lastPaymentDate: new Date().toISOString().split('T')[0],
                paymentHistory: updatedHistory,
                updatedAt: serverTimestamp()
            };

            // If partial payment (balance remains), save note and due date
            if (status === 'partial') {
                updateData.balanceNote = balanceNote;
                updateData.paymentDueDate = paymentDueDate;
            } else if (status === 'paid') {
                // Clear note and due date if fully paid
                updateData.balanceNote = '';
                updateData.paymentDueDate = '';
            }

            await updateDoc(docRef, updateData);

            setInvoices(prev => prev.map(inv =>
                inv.id === paymentInvoice.id
                    ? {
                        ...inv,
                        ...updateData,
                        paymentHistory: updatedHistory
                    }
                    : inv
            ));

            setShowPaymentModal(false);
            setPaymentInvoice(null);
            setPaymentSplits([{ mode: 'cash', amount: '' }]);
            setPaymentPrice('');
            setBalanceNote('');
            setPaymentDueDate('');
            alert(`Payment recorded! New Balance: ₹${newTotalPrice - newPaidTotal}`);
        } catch (error) {
            console.error('Error updating payment:', error);
            alert('Error recording payment');
        } finally {
            setProcessing(false);
        }
    };

    const getPaymentBadge = (invoice) => {
        const status = invoice.paymentStatus || 'unpaid';
        const badges = {
            'paid': { class: 'badge-completed', label: 'Paid' },
            'partial': { class: 'badge-progress', label: 'Partial' },
            'unpaid': { class: 'badge-pending', label: 'Unpaid' }
        };
        return badges[status] || badges.unpaid;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    // Generate PDF Invoice / GST Bill
    const generatePDF = (invoice, includeGST = false) => {
        const baseAmount = invoice.price || 0;
        // Fixed CGST and SGST at 9% each (total 18%)
        const cgstPercentage = 9;
        const sgstPercentage = 9;
        const cgstAmount = includeGST ? Math.round((baseAmount * cgstPercentage) / 100) : 0;
        const sgstAmount = includeGST ? Math.round((baseAmount * sgstPercentage) / 100) : 0;
        const totalGst = cgstAmount + sgstAmount;
        const totalAmount = baseAmount + totalGst;

        // Professional navy/indigo color scheme matching detailed branding
        const brandPrimary = '#1a1f3a';      // Deep navy
        const brandSecondary = '#2e3856';    // Medium navy
        const brandAccent = '#047857';       // Emerald green accent
        const brandSuccess = '#10b981';      // Green for GST

        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${includeGST ? 'GST Bill' : 'Invoice'} - ${invoice.bookingReference || invoice.id.slice(0, 8)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
        .invoice-container { max-width: 800px; margin: 0 auto; padding: 30px 40px; }
        
        /* Header with Logo */
        .invoice-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 30px; 
            padding-bottom: 25px; 
            border-bottom: 3px solid ${brandPrimary}; 
        }
        .company-info { display: flex; align-items: flex-start; gap: 20px; }
        .company-logo { 
            width: 100px; 
            height: 100px; 
            object-fit: contain;
            border-radius: 8px;
        }
        .company-details h1 { font-size: 24px; color: ${brandPrimary}; margin-bottom: 8px; font-weight: 700; }
        .company-details p { color: #64748b; font-size: 12px; line-height: 1.6; }
        .company-details .contact { margin-top: 8px; }
        
        .invoice-title { text-align: right; }
        .invoice-title h2 { 
            font-size: 28px; 
            color: ${includeGST ? brandSuccess : brandPrimary}; 
            text-transform: uppercase; 
            letter-spacing: 2px;
            font-weight: 800;
        }
        .invoice-title .invoice-number { 
            font-size: 15px; 
            color: ${brandSecondary}; 
            margin-top: 8px;
            font-weight: 600;
        }
        .invoice-title .invoice-date { font-size: 13px; color: #64748b; margin-top: 4px; }
        
        /* Customer & Vehicle Details */
        .invoice-details { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 30px; 
            margin-bottom: 30px; 
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
        }
        .detail-section h3 { 
            font-size: 11px; 
            text-transform: uppercase; 
            color: ${brandSecondary}; 
            margin-bottom: 10px; 
            letter-spacing: 1.5px;
            font-weight: 700;
        }
        .detail-section p { font-size: 13px; line-height: 1.8; color: #475569; }
        .detail-section strong { color: ${brandPrimary}; }
        
        /* Items Table */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .items-table th { 
            background: ${brandPrimary}; 
            color: white;
            padding: 14px 15px; 
            text-align: left; 
            font-size: 11px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
            font-weight: 600;
        }
        .items-table td { 
            padding: 14px 15px; 
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
        }
        .items-table .text-right { text-align: right; }
        .items-table tbody tr:hover { background: #f8fafc; }
        
        /* Totals */
        .totals { width: 280px; margin-left: auto; }
        .totals-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
        }
        .totals-row.total { 
            font-size: 18px; 
            font-weight: 700; 
            color: ${brandPrimary}; 
            border-bottom: none;
            border-top: 2px solid ${brandPrimary};
            padding: 15px 0;
            margin-top: 5px;
        }
        .totals-row.gst { color: ${brandSuccess}; font-weight: 500; }
        
        /* GST Info Box */
        ${includeGST ? `
        .gst-info { 
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); 
            border: 1px solid #86efac; 
            border-radius: 8px; 
            padding: 18px 20px; 
            margin: 25px 0; 
        }
        .gst-info h4 { color: ${brandSuccess}; margin-bottom: 10px; font-size: 13px; font-weight: 700; }
        .gst-info p { font-size: 12px; color: #166534; line-height: 1.6; }` : ''}
        
        /* Footer */
        .invoice-footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center;
        }
        .thank-you { 
            font-size: 16px; 
            color: ${brandPrimary}; 
            margin-bottom: 12px;
            font-weight: 600;
        }
        .invoice-footer .note { font-size: 11px; color: #94a3b8; }
        
        @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-container { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            <div class="company-info">
                <img src="/detail.svg" class="company-logo" alt="ZWash Logo" />
                <div class="company-details">
                    <h1>${settings?.businessName || 'ZWash Car Wash'}</h1>
                    <p>Suchindram Byp, near Ragavendra Temple</p>
                    <p>Nagercoil, Tamil Nadu 629704</p>
                    <p class="contact">📞 +91 9363911500 | ✉️ detailingcommando@gmail.com</p>
                    ${includeGST && settings?.gstNumber ? `<p style="margin-top:5px;font-weight:600;">GSTIN: ${settings.gstNumber}</p>` : ''}
                </div>
            </div>
            <div class="invoice-title">
                <h2>${includeGST ? 'Tax Invoice' : 'Invoice'}</h2>
                <p class="invoice-number">#${invoice.bookingReference || invoice.id.slice(0, 8).toUpperCase()}</p>
                <p class="invoice-date">Date: ${invoice.bookingDate || invoice.invoiceDate}</p>
            </div>
        </div>
        
        <div class="invoice-details">
            <div class="detail-section">
                <h3>Bill To</h3>
                <p><strong>${invoice.customerName || 'Walk-in Customer'}</strong></p>
                <p>Phone: ${invoice.contactPhone || 'N/A'}</p>
            </div>
            <div class="detail-section">
                <h3>Vehicle Info</h3>
                <p><strong>${invoice.carMake || ''} ${invoice.carModel || ''}</strong></p>
                <p>Plate: ${invoice.licensePlate || 'N/A'}</p>
                <p>Service Time: ${formatTime12Hour(invoice.startTime)}</p>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Service Description</th>
                    <th style="width:60px;">Qty</th>
                    <th class="text-right" style="width:100px;">Rate</th>
                    <th class="text-right" style="width:100px;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${invoice.serviceName}</strong></td>
                    <td>1</td>
                    <td class="text-right">${formatCurrency(baseAmount)}</td>
                    <td class="text-right"><strong>${formatCurrency(baseAmount)}</strong></td>
                </tr>
            </tbody>
        </table>
        
        <div class="totals">
            <div class="totals-row">
                <span>Subtotal</span>
                <span>${formatCurrency(baseAmount)}</span>
            </div>
            ${includeGST ? `
            <div class="totals-row gst">
                <span>CGST @ ${cgstPercentage}%</span>
                <span>${formatCurrency(cgstAmount)}</span>
            </div>
            <div class="totals-row gst">
                <span>SGST @ ${sgstPercentage}%</span>
                <span>${formatCurrency(sgstAmount)}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
                <span>Total Amount</span>
                <span>${formatCurrency(totalAmount)}</span>
            </div>
            
            <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px;">
                    <span style="color: #64748b;">Paid Amount</span>
                    <span style="font-weight: 600; color: #047857;">${formatCurrency(invoice.paidAmount || 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; padding-top: 5px; border-top: 1px dashed #e2e8f0;">
                    <span>Balance Due</span>
                    <span style="color: ${(totalAmount - (invoice.paidAmount || 0)) > 0 ? '#ef4444' : '#047857'};">
                        ${formatCurrency(Math.max(0, totalAmount - (invoice.paidAmount || 0)))}
                    </span>
                </div>
                ${invoice.paymentMode && invoice.paymentMode !== 'none' ? `
                <div style="font-size: 11px; color: #94a3b8; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Payment Mode: ${invoice.paymentMode}
                </div>` : ''}
            </div>
        </div>
        
        ${includeGST && settings?.gstNumber ? `
        <div class="gst-info">
            <h4>📋 GST Details</h4>
            <p><strong>GSTIN:</strong> ${settings.gstNumber}</p>
            <p><strong>HSN/SAC:</strong> 9992 (Washing and Cleaning Services)</p>
            <p><strong>CGST (${cgstPercentage}%):</strong> ${formatCurrency(cgstAmount)} | <strong>SGST (${sgstPercentage}%):</strong> ${formatCurrency(sgstAmount)}</p>
            <p style="margin-top:5px;"><strong>Total Tax:</strong> ${formatCurrency(totalGst)}</p>
        </div>
        ` : ''}
        
        <div class="invoice-footer">
            <p class="thank-you">Thank you for choosing us! 🙏</p>
            <p class="note">This is a computer-generated ${includeGST ? 'tax invoice' : 'invoice'} and does not require a signature.</p>
        </div>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.onload = function () {
            printWindow.print();
        };
    };

    const openInvoiceModal = (invoice) => {
        setSelectedInvoice(invoice);
        setShowModal(true);
    };

    // Generate shareable invoice link
    const getInvoiceLink = (invoice) => {
        const baseUrl = window.location.origin.replace('5173', '5174'); // Customer app port
        return `${baseUrl}/invoice/${invoice.id}`;
    };

    // Share invoice via WhatsApp
    const shareViaWhatsApp = (invoice) => {
        const link = getInvoiceLink(invoice);
        const message = `Hi! Here's your invoice from ${settings?.businessName || 'ZWash Car Wash'}\n\n` +
            `📋 Invoice: #${invoice.bookingReference || invoice.id.slice(0, 8).toUpperCase()}\n` +
            `🚗 Service: ${invoice.serviceName}\n` +
            `💰 Amount: ${formatCurrency(invoice.price)}\n` +
            `📅 Date: ${invoice.bookingDate || invoice.invoiceDate}\n\n` +
            `View your invoice online: ${link}\n\n` +
            `Thank you for choosing us! 🙏`;

        let phone = invoice.contactPhone?.replace(/[^0-9]/g, '') || '';
        // Add India country code if not present
        if (phone.length === 10) phone = '91' + phone;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    // Copy invoice link
    const copyInvoiceLink = (invoice) => {
        const link = getInvoiceLink(invoice);
        navigator.clipboard.writeText(link).then(() => {
            alert('Invoice link copied to clipboard!');
        });
    };

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.price || 0), 0);

    // Date Filter State
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    // For employees: only show today's and yesterday's invoices (unless they have extended permissions, but user rule said restricting view is ok)
    // Actually, admins might want to see all.
    const baseInvoices = isEmployee
        ? invoices.filter(inv => {
            const date = inv.bookingDate || inv.invoiceDate;
            return date === todayStr || date === yesterdayStr;
        })
        : invoices;

    const filteredInvoices = baseInvoices.filter(inv => {
        // Date Range Filter
        const invDate = inv.bookingDate || inv.invoiceDate;
        if (dateFilter.start && invDate < dateFilter.start) return false;
        if (dateFilter.end && invDate > dateFilter.end) return false;

        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            inv.bookingReference?.toLowerCase().includes(search) ||
            inv.serviceName?.toLowerCase().includes(search) ||
            inv.contactPhone?.includes(search) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(search)) ||
            inv.licensePlate?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="invoices-page">
            <div className="page-header">
                <div>
                    <h1><FileText size={28} /> Invoices</h1>
                    <p className="subtitle">
                        {isEmployee ? "Today's and yesterday's invoices" : 'Manage service invoices'}
                    </p>
                </div>
                <div className="header-actions">
                    {/* Tab Toggle */}
                    <div className="tab-group" style={{ background: 'var(--navy-800)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                        <button
                            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                            onClick={() => setActiveTab('active')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'active' ? 'white' : 'rgba(255,255,255,0.6)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <FileText size={16} /> Active
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
                            onClick={() => setActiveTab('archived')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                background: activeTab === 'archived' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'archived' ? 'white' : 'rgba(255,255,255,0.6)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Archive size={16} /> Archived ({archivedInvoices.length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <FileText size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{filteredInvoices.length}</span>
                        <span className="stat-label">Shown Invoices</span>
                    </div>
                </div>
                {/* Only show revenue to admins with finance permission */}
                {hasPermission('finance') && (
                    <div className="quick-stat-card">
                        <div className="stat-icon blue">
                            <FileText size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.price || 0), 0))}</span>
                            <span className="stat-label">Revenue (Shown)</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Search & Filters */}
            <div className="search-filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '250px' }}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'white', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--navy-200)' }}>
                    <input
                        type="date"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--navy-700)', padding: '0.5rem' }}
                        title="Start Date"
                    />
                    <span style={{ color: 'var(--navy-400)' }}>to</span>
                    <input
                        type="date"
                        value={dateFilter.end}
                        onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--navy-700)', padding: '0.5rem' }}
                        title="End Date"
                    />
                    {(dateFilter.start || dateFilter.end) && (
                        <button
                            onClick={() => setDateFilter({ start: '', end: '' })}
                            style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '4px' }}
                            title="Clear Date Filter"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Export
                    </button>
                    {hasPermission('bookings', 'create') && (
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            <Plus size={18} /> Create Invoice
                        </button>
                    )}
                </div>
            </div>

            {/* Invoices Table */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state"><div className="loader"></div></div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={48} />
                            <p>No invoices found</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Date</th>
                                        <th>Service</th>
                                        <th>Amount</th>
                                        <th>Payment</th>
                                        <th>Owner Details</th>
                                        <th>Vehicle</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map(invoice => {
                                        const payBadge = getPaymentBadge(invoice);
                                        return (
                                            <tr key={invoice.id}>
                                                <td><strong>{invoice.bookingReference || invoice.id.slice(0, 8)}</strong></td>
                                                <td>{invoice.bookingDate || invoice.invoiceDate}</td>
                                                <td>{invoice.serviceName}</td>
                                                <td>
                                                    <div>{formatCurrency(invoice.price)}</div>
                                                    {invoice.paidAmount > 0 && invoice.paidAmount < invoice.price && (
                                                        <>
                                                            <small style={{ color: '#10b981', display: 'block' }}>Paid: {formatCurrency(invoice.paidAmount)}</small>
                                                            {invoice.balanceNote && (
                                                                <small style={{ color: '#f59e0b', display: 'block', fontStyle: 'italic' }}>
                                                                    "{invoice.balanceNote}"
                                                                    {invoice.paymentDueDate && ` (Due: ${formatDate(invoice.paymentDueDate)})`}
                                                                </small>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${payBadge.class}`}>{payBadge.label}</span>
                                                </td>
                                                <td>
                                                    <strong>{invoice.customerName || 'Walk-in'}</strong>
                                                    <br />
                                                    <small style={{ color: 'var(--navy-500)' }}>{invoice.contactPhone || 'N/A'}</small>
                                                </td>
                                                <td>{invoice.licensePlate}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {(invoice.paymentStatus !== 'paid' || (invoice.price || 0) > (invoice.paidAmount || 0)) && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => {
                                                                    setPaymentInvoice(invoice);
                                                                    const currentPrice = invoice.price || 0;
                                                                    const currentPaid = invoice.paidAmount || 0;
                                                                    // Initialize fields
                                                                    setDiscount(invoice.discount || '');
                                                                    setExtraCharge(invoice.extraCharge || '');
                                                                    setPaymentPrice(String(currentPrice));

                                                                    // Load existing milestone info
                                                                    setBalanceNote(invoice.balanceNote || '');
                                                                    setPaymentDueDate(invoice.paymentDueDate || '');

                                                                    // Default payment amount is remaining balance
                                                                    const balance = currentPrice - currentPaid;
                                                                    const safeBalance = Math.max(0, balance);
                                                                    setPaymentSplits([{ mode: 'cash', amount: String(safeBalance) }]);

                                                                    setShowPaymentModal(true);
                                                                }}
                                                                title="Record Payment"
                                                            >
                                                                💳 Pay
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => generatePDF(invoice, false)}
                                                            title="Print Invoice"
                                                        >
                                                            <Printer size={14} />
                                                        </button>
                                                        {settings?.gstEnabled && (
                                                            <button
                                                                className="btn btn-sm"
                                                                onClick={() => generatePDF(invoice, true)}
                                                                title="Print GST Bill"
                                                                style={{ background: '#10b981', color: 'white' }}
                                                            >
                                                                <Receipt size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-sm"
                                                            onClick={() => shareViaWhatsApp(invoice)}
                                                            title="Share via WhatsApp"
                                                            style={{ background: '#25D366', color: 'white' }}
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                        {/* Edit Button */}
                                                        {hasPermission('bookings', 'edit') && (
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() => { setEditingInvoice(invoice); setShowEditModal(true); }}
                                                                title="Edit Invoice"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                        )}
                                                        {/* Archive/Delete Button */}
                                                        {hasPermission('bookings', 'delete') && (
                                                            <button
                                                                className="btn btn-sm"
                                                                onClick={() => archiveInvoice(invoice)}
                                                                title="Archive Invoice"
                                                                style={{ background: '#ef4444', color: 'white' }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Mobile Cards */}
                    <div className="mobile-cards">
                        {filteredInvoices.map(invoice => (
                            <div key={invoice.id} className="booking-card">
                                <div className="booking-card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <strong>{invoice.bookingReference || invoice.id.slice(0, 8)}</strong>
                                        <span className={`badge ${getPaymentBadge(invoice).class}`}>{getPaymentBadge(invoice).label}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>{invoice.bookingDate || invoice.invoiceDate}</span>
                                </div>
                                <div className="booking-card-body">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: '600' }}>{invoice.serviceName}</span>
                                        <span className="booking-price">{formatCurrency(invoice.price)}</span>
                                    </div>
                                    <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{invoice.customerName} ({invoice.contactPhone})</p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-600)' }}>
                                        <Car size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                        {invoice.licensePlate} • {invoice.carMake} {invoice.carModel}
                                    </p>
                                    {invoice.paidAmount > 0 && invoice.paidAmount < invoice.price && (
                                        <div style={{ marginTop: '4px' }}>
                                            <p style={{ fontSize: '0.8rem', color: '#10b981' }}>
                                                Paid: {formatCurrency(invoice.paidAmount)} (Bal: {formatCurrency(invoice.price - invoice.paidAmount)})
                                            </p>
                                            {invoice.balanceNote && (
                                                <p style={{ fontSize: '0.8rem', color: '#f59e0b', fontStyle: 'italic' }}>
                                                    Note: {invoice.balanceNote}
                                                    {invoice.paymentDueDate && ` (Due: ${formatDate(invoice.paymentDueDate)})`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Mobile Actions */}
                                <div className="booking-card-footer" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* Primary Action Row: Pay & Edit */}
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {(invoice.paymentStatus !== 'paid' || (invoice.price || 0) > (invoice.paidAmount || 0)) && (
                                            <button
                                                className="btn btn-sm btn-primary"
                                                style={{ flex: 1 }}
                                                onClick={() => {
                                                    setPaymentInvoice(invoice);
                                                    setDiscount(invoice.discount || '');
                                                    setExtraCharge(invoice.extraCharge || '');
                                                    setPaymentPrice(String(invoice.price || 0));

                                                    // Load existing milestone info
                                                    setBalanceNote(invoice.balanceNote || '');
                                                    setPaymentDueDate(invoice.paymentDueDate || '');

                                                    const balance = (invoice.price || 0) - (invoice.paidAmount || 0);
                                                    const safeBalance = Math.max(0, balance);
                                                    setPaymentSplits([{ mode: 'cash', amount: String(safeBalance) }]);
                                                    setShowPaymentModal(true);
                                                }}
                                            >
                                                💳 Pay Now
                                            </button>
                                        )}
                                        {/* Edit Button */}
                                        {hasPermission('bookings', 'edit') && (
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => { setEditingInvoice(invoice); setShowEditModal(true); }}
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                        {/* Archive Button */}
                                        {hasPermission('bookings', 'delete') && (
                                            <button
                                                className="btn btn-sm"
                                                onClick={() => archiveInvoice(invoice)}
                                                title="Archive"
                                                style={{ background: '#fee2e2', color: '#ef4444', border: 'none' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Secondary Action Row: Print & Share */}
                                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => generatePDF(invoice, false)}
                                            style={{ flex: 1, whiteSpace: 'nowrap' }}
                                        >
                                            <Printer size={14} /> Invoice
                                        </button>
                                        {settings?.gstEnabled && (
                                            <button
                                                className="btn btn-sm"
                                                onClick={() => generatePDF(invoice, true)}
                                                style={{ flex: 1, background: '#10b981', color: 'white', whiteSpace: 'nowrap' }}
                                            >
                                                <Receipt size={14} /> GST
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm"
                                            onClick={() => shareViaWhatsApp(invoice)}
                                            style={{ flex: 1, background: '#25D366', color: 'white', whiteSpace: 'nowrap' }}
                                        >
                                            <MessageCircle size={14} /> WA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }
                    
                    .header-actions {
                        width: 100%;
                        flex-wrap: wrap;
                        gap: 0.5rem;
                    }
                    
                    .tab-group {
                        width: 100%;
                        display: flex; /* Ensure tabs take full width row */
                    }
                    
                    .tab-btn {
                        flex: 1; /* Tabs split space equally */
                        justify-content: center;
                    }
                    
                    .header-actions .btn {
                        flex: 1;
                        white-space: nowrap;
                    }
                }
            `}</style>

            {/* Payment Modal */}
            {
                showPaymentModal && paymentInvoice && (
                    <div className="modal">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>💳 Record Payment</h2>
                                <button className="modal-close" onClick={() => setShowPaymentModal(false)}>&times;</button>
                            </div>
                            <div className="modal-body">
                                <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                    <p><strong>Invoice:</strong> {paymentInvoice.bookingReference}</p>
                                    <p><strong>Service:</strong> {paymentInvoice.serviceName}</p>
                                    <p><strong>Invoice:</strong> {paymentInvoice.bookingReference}</p>
                                    <p><strong>Service:</strong> {paymentInvoice.serviceName}</p>

                                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                        <label style={{ color: 'var(--navy-600)', fontSize: '0.85rem' }}>Base Service Price</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                                            {formatCurrency((paymentInvoice.price || 0) + (Number(paymentInvoice.discount) || 0) - (Number(paymentInvoice.extraCharge) || 0))}
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>(Original)</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label style={{ color: 'var(--navy-600)', fontSize: '0.85rem' }}>Discount (-)</label>
                                            <input
                                                type="number"
                                                value={discount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setDiscount(val);
                                                    // Recalculate total
                                                    const base = (paymentInvoice.price || 0) + (Number(paymentInvoice.discount) || 0) - (Number(paymentInvoice.extraCharge) || 0);
                                                    const newTotal = base - (Number(val) || 0) + (Number(extraCharge) || 0);
                                                    setPaymentPrice(String(newTotal));

                                                    // Update split if single
                                                    const newBalance = Math.max(0, newTotal - (paymentInvoice.paidAmount || 0));
                                                    if (paymentSplits.length === 1) {
                                                        setPaymentSplits([{ ...paymentSplits[0], amount: String(newBalance) }]);
                                                    }
                                                }}
                                                placeholder="0"
                                                style={{ borderColor: '#ef4444', color: '#b91c1c' }}
                                            />
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label style={{ color: 'var(--navy-600)', fontSize: '0.85rem' }}>Extra / Tip (+)</label>
                                            <input
                                                type="number"
                                                value={extraCharge}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setExtraCharge(val);
                                                    // Recalculate total
                                                    const base = (paymentInvoice.price || 0) + (Number(paymentInvoice.discount) || 0) - (Number(paymentInvoice.extraCharge) || 0);
                                                    const newTotal = base - (Number(discount) || 0) + (Number(val) || 0);
                                                    setPaymentPrice(String(newTotal));

                                                    // Update split if single
                                                    const newBalance = Math.max(0, newTotal - (paymentInvoice.paidAmount || 0));
                                                    if (paymentSplits.length === 1) {
                                                        setPaymentSplits([{ ...paymentSplits[0], amount: String(newBalance) }]);
                                                    }
                                                }}
                                                placeholder="0"
                                                style={{ borderColor: '#10b981', color: '#059669' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                                        <label style={{ color: 'var(--navy-800)', fontSize: '0.9rem', fontWeight: '600' }}>Final Bill Amount</label>
                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>
                                            {formatCurrency(paymentPrice)}
                                        </div>
                                    </div>

                                    {paymentInvoice.paidAmount > 0 && (
                                        <p><strong>Already Paid:</strong> {formatCurrency(paymentInvoice.paidAmount)}</p>
                                    )}
                                    <p style={{ color: '#f59e0b', fontWeight: '700', marginTop: '0.5rem' }}>
                                        <strong>Balance Due:</strong> {formatCurrency((Number(paymentPrice) || 0) - (paymentInvoice.paidAmount || 0))}
                                    </p>
                                </div>
                                <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                                    <SplitPaymentSelector
                                        splits={paymentSplits}
                                        onAddSplit={handleAddSplit}
                                        onRemoveSplit={handleRemoveSplit}
                                        onSplitChange={handleSplitChange}
                                        totalAmount={(Number(paymentPrice) || 0) - (paymentInvoice.paidAmount || 0)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={updatePaymentStatus} disabled={processing}>
                                    {processing ? 'Processing...' : 'Record Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Invoice Modal */}
            {showEditModal && editingInvoice && (
                <EditInvoiceModal
                    invoice={editingInvoice}
                    onClose={() => { setShowEditModal(false); setEditingInvoice(null); }}
                    onSuccess={fetchInvoices}
                />
            )}

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <CreateInvoiceModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={fetchInvoices}
                    user={user}
                />
            )}
        </div >
    );
};

const EditInvoiceModal = ({ invoice, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        customerName: invoice.customerName || '',
        contactPhone: invoice.contactPhone || '',
        carMake: invoice.carMake || '',
        carModel: invoice.carModel || '',
        licensePlate: invoice.licensePlate || '',
        serviceName: invoice.serviceName || '',
        price: invoice.price || 0
    });
    const [loading, setLoading] = useState(false);
    const [isPaymentReceived, setIsPaymentReceived] = useState(false);
    const [paymentSplits, setPaymentSplits] = useState([{ mode: 'cash', amount: '' }]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const collectionName = invoice.source === 'invoice' ? 'invoices' : 'bookings';

            // Recalculate status based on new price
            const newPrice = Number(formData.price);
            const additionalPaid = isPaymentReceived
                ? paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
                : 0;
            const totalPaid = (invoice.paidAmount || 0) + additionalPaid;

            let newStatus = 'unpaid';
            if (totalPaid >= newPrice && newPrice > 0) newStatus = 'paid';
            else if (totalPaid > 0) newStatus = 'partial';

            const paymentHistory = [...(invoice.paymentHistory || [])];
            if (isPaymentReceived && additionalPaid > 0) {
                paymentHistory.push({
                    date: new Date().toISOString(),
                    amount: additionalPaid,
                    splits: paymentSplits.filter(s => Number(s.amount) > 0).map(s => ({ mode: s.mode, amount: Number(s.amount) })),
                    recordedBy: 'admin',
                    note: 'Payment added during invoice edit'
                });
            }

            await updateDoc(doc(db, collectionName, invoice.id), {
                ...formData,
                price: newPrice,
                paymentStatus: newStatus,
                paidAmount: totalPaid,
                paymentHistory,
                paymentMode: isPaymentReceived ? (paymentSplits[0]?.mode || invoice.paymentMode) : (invoice.paymentMode || 'none'),
                updatedAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Failed to update invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Edit size={20} /> Edit Invoice</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Customer Name</label>
                            <input
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                value={formData.contactPhone}
                                onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Make</label>
                                <input
                                    value={formData.carMake}
                                    onChange={e => setFormData({ ...formData, carMake: e.target.value })}
                                    placeholder="e.g. Toyota"
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input
                                    value={formData.carModel}
                                    onChange={e => setFormData({ ...formData, carModel: e.target.value })}
                                    placeholder="e.g. Camry"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>License Plate</label>
                            <input
                                value={formData.licensePlate}
                                onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>
                        <div className="form-group">
                            <label>Service Name</label>
                            <input
                                value={formData.serviceName}
                                onChange={e => setFormData({ ...formData, serviceName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Amount (₹)</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                        </div>

                        {/* Additional Payment Status */}
                        <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Currently Paid:</span>
                                <span style={{ fontWeight: '600', color: 'var(--success)' }}>₹{(invoice.paidAmount || 0).toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: '#64748b' }}>Current Balance:</span>
                                <span style={{ fontWeight: '700', color: (Number(formData.price) - (invoice.paidAmount || 0)) > 0 ? '#ef4444' : 'var(--success)' }}>
                                    ₹{(Number(formData.price) - (invoice.paidAmount || 0)).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Payment Toggle & Splits */}
                        <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                            <div
                                onClick={() => setIsPaymentReceived(!isPaymentReceived)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    cursor: 'pointer',
                                    padding: '0.75rem',
                                    background: isPaymentReceived ? '#f0fdf4' : '#f8fafc',
                                    borderRadius: '8px',
                                    border: `1px solid ${isPaymentReceived ? '#86efac' : '#e2e8f0'}`,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    border: `2px solid ${isPaymentReceived ? 'var(--success)' : '#cbd5e1'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isPaymentReceived ? 'var(--success)' : 'white'
                                }}>
                                    {isPaymentReceived && <CheckCircle2 size={16} color="white" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', color: isPaymentReceived ? '#166534' : 'var(--navy-800)', fontSize: '0.9rem' }}>
                                        Add New Payment
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: isPaymentReceived ? '#166534' : '#64748b' }}>
                                        Record an additional payment received right now
                                    </div>
                                </div>
                            </div>

                            {isPaymentReceived && (
                                <div style={{ marginTop: '1rem' }}>
                                    <SplitPaymentSelector
                                        splits={paymentSplits}
                                        onAddSplit={() => setPaymentSplits([...paymentSplits, { mode: 'cash', amount: '' }])}
                                        onRemoveSplit={(idx) => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                                        onSplitChange={(idx, field, val) => {
                                            const newSplits = [...paymentSplits];
                                            newSplits[idx][field] = val;
                                            setPaymentSplits(newSplits);
                                        }}
                                        totalAmount={Number(formData.price) - (invoice.paidAmount || 0)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CreateInvoiceModal = ({ onClose, onSuccess, user }) => {
    const [formData, setFormData] = useState({
        customerName: '',
        contactPhone: '',
        vehicleType: 'car',
        carMake: '',
        carModel: '',
        licensePlate: '',
        serviceName: '',
        price: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        vehicleType: 'hatchback'
    });
    const [loading, setLoading] = useState(false);
    const [isPaymentReceived, setIsPaymentReceived] = useState(false);
    const [services, setServices] = useState([]);
    const [amcPlans, setAmcPlans] = useState([]);
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);
    const [selectedAmcPlan, setSelectedAmcPlan] = useState(null);

    useEffect(() => {
        const fetchServicesAndPlans = async () => {
            try {
                // Fetch Services
                const sQ = query(collection(db, 'services'), where('isActive', '==', true));
                const sSnap = await getDocs(sQ);
                const sData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setServices(sData);

                // Fetch AMC Plans
                const pQ = query(collection(db, 'amc_plans'), where('isActive', '==', true));
                const pSnap = await getDocs(pQ);
                const pData = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAmcPlans(pData);
            } catch (error) {
                console.error("Error fetching services", error);
            }
        };
        fetchServicesAndPlans();
    }, []);

    const combinedList = [
        ...services.map(s => ({ ...s, isAmc: false })),
        ...amcPlans.map(p => ({ ...p, isAmc: true }))
    ];

    const filteredServices = combinedList.filter(s =>
        s.name.toLowerCase().includes(formData.serviceName.toLowerCase())
    );

    const handleServiceSelect = (item) => {
        if (item.isAmc) {
            setSelectedAmcPlan(item);
            const price = item.prices?.[formData.vehicleType] || item.price || 0;
            setFormData({
                ...formData,
                serviceName: `AMC Plan: ${item.name}`,
                price: String(price)
            });
        } else {
            setSelectedAmcPlan(null);
            const defaultPrice = item.prices?.sedan || item.price || 0;
            setFormData({
                ...formData,
                serviceName: item.name,
                price: String(defaultPrice)
            });
        }
        setShowServiceDropdown(false);
    };

    // Update AMC price if vehicle type changes
    useEffect(() => {
        if (selectedAmcPlan) {
            const price = selectedAmcPlan.prices?.[formData.vehicleType] || selectedAmcPlan.price || 0;
            setFormData(prev => ({
                ...prev,
                price: String(price)
            }));
        }
    }, [formData.vehicleType, selectedAmcPlan]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Generate ID similar to bookings but for manual invoices
            const ref = `INV-${Date.now().toString().slice(-6)}`;

            const totalPrice = Number(formData.price) || 0;
            const paidAmount = isPaymentReceived
                ? paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
                : 0;

            let paymentStatus = 'unpaid';
            if (paidAmount >= totalPrice && totalPrice > 0) paymentStatus = 'paid';
            else if (paidAmount > 0) paymentStatus = 'partial';

            const paymentHistory = isPaymentReceived ? [{
                date: new Date().toISOString(),
                amount: paidAmount,
                splits: paymentSplits.filter(s => Number(s.amount) > 0).map(s => ({ mode: s.mode, amount: Number(s.amount) })),
                recordedBy: user?.uid || 'unknown',
                note: 'Initial payment at invoice creation'
            }] : [];

            const isAmc = selectedAmcPlan != null;

            let customerId = 'unknown';

            // If it's an AMC, we need a customer. Let's create or find one if possible.
            // For simplicity, we just save the AMC subscription with the details provided in the modal.
            if (isAmc) {
                const startDate = new Date(formData.invoiceDate);
                const expiryDate = new Date(formData.invoiceDate);
                expiryDate.setMonth(startDate.getMonth() + selectedAmcPlan.validityMonths);

                const serviceTracking = (selectedAmcPlan.services || []).map(service => ({
                    serviceType: service.name,
                    description: service.description,
                    totalAllowed: service.quantity,
                    usages: []
                }));

                if (serviceTracking.length === 0 && selectedAmcPlan.serviceCount) {
                    serviceTracking.push({
                        serviceType: 'Wash',
                        totalAllowed: selectedAmcPlan.serviceCount,
                        usages: []
                    });
                }

                await addDoc(collection(db, 'customer_amc_subscriptions'), {
                    customerId: customerId,
                    customerName: formData.customerName,
                    customerPhone: formData.contactPhone,
                    vehicleNumber: formData.licensePlate.toUpperCase(),
                    vehicleType: formData.vehicleType,
                    planId: selectedAmcPlan.id,
                    planName: selectedAmcPlan.name,
                    price: totalPrice,
                    totalAmount: totalPrice,
                    advancePayment: paidAmount,
                    balanceAmount: totalPrice - paidAmount,
                    paymentStatus: paymentStatus,
                    startDate: Timestamp.fromDate(startDate),
                    expiryDate: Timestamp.fromDate(expiryDate),
                    status: 'active',
                    serviceTracking: serviceTracking,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            // Create standard invoice for both Service and AMC
            await addDoc(collection(db, 'invoices'), {
                ...formData,
                bookingReference: ref,
                price: totalPrice,
                status: 'completed',
                paymentStatus,
                paidAmount,
                paymentHistory,
                paymentMode: isPaymentReceived ? (paymentSplits[0]?.mode || 'cash') : 'none',
                createdBy: user?.uid || 'unknown',
                createdAt: serverTimestamp(),
                isManual: true,
                source: 'invoice'
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><Plus size={20} /> Create Manual Invoice</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={formData.invoiceDate}
                                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    value={formData.contactPhone}
                                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                                    placeholder="Customer phone"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Customer Name *</label>
                            <input
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                required
                                placeholder="Enter customer name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Vehicle Class *</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['hatchback', 'sedan', 'suv'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, vehicleType: type })}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            border: formData.vehicleType === type ? '2px solid var(--primary)' : '1px solid var(--navy-200)',
                                            borderRadius: '8px',
                                            background: formData.vehicleType === type ? 'var(--primary-light)' : 'white',
                                            cursor: 'pointer',
                                            fontWeight: formData.vehicleType === type ? '600' : 'normal',
                                            textTransform: 'capitalize'
                                        }}
                                    >
                                        {type === 'suv' ? 'SUV' : type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Make</label>
                                <input
                                    value={formData.carMake}
                                    onChange={e => setFormData({ ...formData, carMake: e.target.value })}
                                    placeholder="e.g. Honda"
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input
                                    value={formData.carModel}
                                    onChange={e => setFormData({ ...formData, carModel: e.target.value })}
                                    placeholder="e.g. City"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>License Plate</label>
                            <input
                                value={formData.licensePlate}
                                onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                                placeholder="TN-00-AA-0000"
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>

                        {/* Searchable Service Dropdown */}
                        <div className="form-group" style={{ position: 'relative' }}>
                            <label>Service Name *</label>
                            <input
                                value={formData.serviceName}
                                onChange={e => {
                                    setFormData({ ...formData, serviceName: e.target.value });
                                    setShowServiceDropdown(true);
                                }}
                                onFocus={() => setShowServiceDropdown(true)}
                                onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                                required
                                placeholder="Search or type service name..."
                                autoComplete="off"
                            />
                            {showServiceDropdown && formData.serviceName.length > 0 && filteredServices.length > 0 && (
                                <div className="dropdown-list" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '0.5rem',
                                    zIndex: 10,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    boxShadow: 'var(--shadow-md)'
                                }}>
                                    {filteredServices.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleServiceSelect(item)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background 0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                            className="dropdown-item"
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '500', fontSize: '0.9rem', color: item.isAmc ? '#d4af37' : 'inherit' }}>
                                                    {item.isAmc && <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />}
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {item.description ? item.description.slice(0, 50) + '...' : (item.isAmc ? `${item.validityMonths} months validity` : 'No description')}
                                                </div>
                                            </div>
                                            {item.isAmc && <span className="badge badge-progress" style={{ fontSize: '0.65rem' }}>AMC</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-row" style={{ marginTop: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>Amount (₹)</label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setFormData({ ...formData, price: val });
                                        if (paymentSplits.length === 1 && (!paymentSplits[0].amount || Number(paymentSplits[0].amount) === Number(formData.price))) {
                                            setPaymentSplits([{ ...paymentSplits[0], amount: val }]);
                                        }
                                    }}
                                    required
                                    placeholder="0.00"
                                    style={{ fontSize: '1.25rem', fontWeight: '700', border: '2px solid var(--primary)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div
                                    onClick={() => setIsPaymentReceived(!isPaymentReceived)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        cursor: 'pointer',
                                        padding: '0.75rem',
                                        background: isPaymentReceived ? '#f0fdf4' : '#f8fafc',
                                        borderRadius: '8px',
                                        border: `1px solid ${isPaymentReceived ? '#86efac' : '#e2e8f0'}`,
                                        transition: 'all 0.2s',
                                        height: 'fit-content'
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '6px',
                                        border: `2px solid ${isPaymentReceived ? 'var(--success)' : '#cbd5e1'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: isPaymentReceived ? 'var(--success)' : 'white'
                                    }}>
                                        {isPaymentReceived && <CheckCircle2 size={16} color="white" />}
                                    </div>
                                    <div style={{ fontWeight: '600', color: isPaymentReceived ? '#166534' : 'var(--navy-800)', fontSize: '0.9rem' }}>
                                        {isPaymentReceived ? 'Payment Recorded' : 'Mark as Paid'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Splits - only show if toggled */}
                        {isPaymentReceived && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: '#f0fdf4',
                                borderRadius: '12px',
                                border: '1px solid #86efac'
                            }}>
                                <SplitPaymentSelector
                                    splits={paymentSplits}
                                    onAddSplit={() => setPaymentSplits([...paymentSplits, { mode: 'cash', amount: '' }])}
                                    onRemoveSplit={(idx) => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                                    onSplitChange={(idx, field, val) => {
                                        const newSplits = [...paymentSplits];
                                        newSplits[idx][field] = val;
                                        setPaymentSplits(newSplits);
                                    }}
                                    totalAmount={Number(formData.price) || 0}
                                />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Invoice'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Invoices;
