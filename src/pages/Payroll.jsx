import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Receipt, Download, Users, Edit, Check, X, IndianRupee, TrendingUp, CreditCard, History, AlertCircle, Calendar, CheckCircle, XCircle, PlusSquare, Calculator, Search, Filter, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const Payroll = () => {
    const { hasPermission } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [payrollRecords, setPayrollRecords] = useState({});
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    // Modal States
    const [showPayrollModal, setShowPayrollModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showManualEntryModal, setShowManualEntryModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        fetchPayrollData();
    }, [month]);

    const fetchPayrollData = async () => {
        try {
            setLoading(true);
            // Fetch approved employees
            const q = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const employeeList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch payroll records for the selected month
            const payrollRef = collection(db, 'payroll');
            const payrollQuery = query(payrollRef, where('month', '==', month));
            const payrollSnapshot = await getDocs(payrollQuery);

            const records = {};
            payrollSnapshot.docs.forEach(doc => {
                const data = doc.data();
                records[data.employeeId] = { id: doc.id, ...data };
            });

            // Combine employee data with payroll
            const payrollData = employeeList.map(emp => {
                const record = records[emp.id] || {
                    baseSalary: emp.baseSalary || 15000,
                    allowances: 0,
                    bonus: 0,
                    deductions: 0
                };
                return {
                    ...emp,
                    payrollId: record.id,
                    baseSalary: record.baseSalary || emp.baseSalary || 15000,
                    allowances: record.allowances || 0,
                    bonus: record.bonus || 0,
                    deductions: record.deductions || 0,
                    netPay: (record.baseSalary || emp.baseSalary || 15000) + (record.allowances || 0) + (record.bonus || 0) - (record.deductions || 0),
                    notes: record.notes || '',
                    processedToExpenses: record.processedToExpenses || false
                };
            });

            setEmployees(payrollData);
            setPayrollRecords(records);

            // Fetch payment history - simplified mainly for expenses view reference
            // We'll just keep the existing query if needed, or we can query 'expenses' 
            // but for now let's leave the 'salaryPayments' logic alone or remove it if unused.
            // Since we are moving to single payments, the batch 'salaryPayments' might be legacy.
            // Leaving it as empty for now to clean up UI.
            setPaymentHistory([]);

        } catch (error) {
            console.error('Error fetching payroll:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (emp) => {
        setSelectedEmployee(emp);
        setShowPayrollModal(true);
    };

    const handleViewHistoryClick = (emp) => {
        setSelectedEmployee(emp);
        setShowHistoryModal(true);
    };

    const handleProcessClick = (emp) => {
        setSelectedEmployee(emp);
        setShowConfirmModal(true);
    };

    const handleUnpayClick = (emp) => {
        if (!window.confirm(`Revert payment for ${emp.displayName}? This will delete the expense entry and reset the status to Pending.`)) return;
        processUnpay(emp);
    };

    const processUnpay = async (emp) => {
        try {
            setProcessing(true);
            const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // 1. Delete the auto-generated expense for this employee+month
            const expQ = query(
                collection(db, 'expenses'),
                where('employeeId', '==', emp.id),
                where('month', '==', month),
                where('isAutoGenerated', '==', true)
            );
            const expSnap = await getDocs(expQ);
            const deletePromises = expSnap.docs.map(d => deleteDoc(doc(db, 'expenses', d.id)));
            await Promise.all(deletePromises);

            // 2. Reset payroll record
            if (emp.payrollId) {
                await updateDoc(doc(db, 'payroll', emp.payrollId), {
                    processedToExpenses: false,
                    processedAt: null
                });
            }

            fetchPayrollData();
        } catch (error) {
            console.error('Error reverting payment:', error);
            alert('Failed to revert payment. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const handleManualEntryClick = (emp) => {
        setSelectedEmployee(emp);
        setShowManualEntryModal(true);
    };

    // Generate PDF Blob from Payslip HTML
    const generatePdfBlob = async (emp) => {
        const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
        const gross = (emp.baseSalary || 0) + (emp.allowances || 0) + (emp.bonus || 0);
        const status = emp.processedToExpenses ? 'PAID' : 'PENDING';
        const statusColor = emp.processedToExpenses ? '#16a34a' : '#b45309';
        const statusBg = emp.processedToExpenses ? '#dcfce7' : '#fef3c7';

        const htmlContent = `
            <div id="payslip-render-${emp.id}" style="width: 800px; padding: 40px; background: white; font-family: 'Segoe UI', sans-serif; box-sizing: border-box;">
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0;">
                    <div>
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Detailing Commando</h1>
                        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.85;">Professional Car Detailing Services</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 1px;">PAYSLIP</h2>
                        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.85;">${monthLabel}</p>
                    </div>
                </div>
                <div style="padding: 25px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px 30px; border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
                    <div><label style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Employee Name</label><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #1e293b;">${emp.displayName}</p></div>
                    <div><label style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Email</label><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #1e293b;">${emp.email || '—'}</p></div>
                    <div><label style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Role</label><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #1e293b;">${emp.role || '—'}</p></div>
                    <div><label style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Pay Period</label><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #1e293b;">${monthLabel}</p></div>
                </div>
                <div style="padding: 30px 40px;">
                    <h3 style="margin: 0 0 20px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Earnings &amp; Deductions</h3>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; color: #334155;"><span>Basic Salary</span><span>${fmt(emp.baseSalary)}</span></div>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; color: #334155;"><span>Allowances</span><span>${fmt(emp.allowances)}</span></div>
                    ${emp.bonus > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; color: #10b981;"><span>Bonus</span><span>+${fmt(emp.bonus)}</span></div>` : ''}
                    ${emp.deductions > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px; color: #ef4444;"><span>Deductions</span><span>−${fmt(emp.deductions)}</span></div>` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 15px 0 5px 0; font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 10px;"><span>Gross Earnings</span><span>${fmt(gross)}</span></div>
                </div>
                <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 25px 40px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 16px; font-weight: 600;">Net Pay (Take Home)</span>
                    <span style="font-size: 26px; font-weight: 700;">${fmt(emp.netPay)}</span>
                </div>
                <div style="padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                    <div><span style="padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; background: ${statusBg}; color: ${statusColor};">${status}</span></div>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">Computer-generated payslip</p>
                </div>
            </div>
        `;

        // Create temporary container off-screen
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.innerHTML = htmlContent;
        document.body.appendChild(container);

        try {
            const canvas = await html2canvas(container.firstElementChild, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            return pdf.output('blob');
        } finally {
            document.body.removeChild(container);
        }
    };

    // Send payslip via WhatsApp as PDF Link
    const sendPayslipViaWhatsApp = async (emp) => {
        try {
            setProcessing(true);
            const pdfBlob = await generatePdfBlob(emp);
            const fileName = `Payslip_${emp.displayName.replace(/\s+/g, '_')}_${month}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

            // Upload PDF to Firebase Storage
            const storageRef = ref(storage, `payslips/${month}/${emp.id}_${fileName}`);
            await uploadBytes(storageRef, pdfBlob);
            const downloadUrl = await getDownloadURL(storageRef);

            const message = `Hi ${emp.displayName}, here is your ${monthLabel} payslip from Detailing Commando. Click here to download: ${downloadUrl}`;

            // Open exact WhatsApp contact link
            const rawPhone = emp.phone || emp.mobile || '';
            const phone = String(rawPhone).replace(/\D/g, '');

            if (!phone) {
                alert(`⚠️ No phone number saved for ${emp.displayName}. Please edit their profile in the Employees tab to automatically open their chat next time.`);
            }

            const formattedPhone = phone ? (phone.startsWith('91') ? phone : '91' + phone) : '';
            const waUrl = formattedPhone
                ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;

            setTimeout(() => { window.open(waUrl, '_blank'); }, 500);

        } catch (error) {
            console.error('Error generating PDF for WhatsApp:', error);
            alert('Failed to generate PDF for WhatsApp.');
        } finally {
            setProcessing(false);
        }
    };

    // Process Single Employee Salary
    const processEmployeeSalary = async () => {
        if (!selectedEmployee) return;

        try {
            setProcessing(true);
            const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const emp = selectedEmployee;

            // 1. Create Expense Entry
            await addDoc(collection(db, 'expenses'), {
                title: `Salary - ${emp.displayName} (${monthName})`,
                amount: emp.netPay,
                category: 'salary',
                date: new Date().toISOString().split('T')[0],
                paymentMode: 'bank_transfer',
                note: `Monthly salary payment for ${monthName}. Base: ₹${emp.baseSalary}, Allowances: ₹${emp.allowances || 0}, Bonus: ₹${emp.bonus}, Deductions: ₹${emp.deductions}`,
                employeeId: emp.id,
                month: month,
                isAutoGenerated: true,
                createdAt: serverTimestamp()
            });

            // 2. Update or Create Payroll Record with processed status
            if (emp.payrollId) {
                await updateDoc(doc(db, 'payroll', emp.payrollId), {
                    processedToExpenses: true,
                    processedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'payroll'), {
                    employeeId: emp.id,
                    month: month,
                    baseSalary: emp.baseSalary,
                    allowances: emp.allowances || 0,
                    bonus: emp.bonus,
                    deductions: emp.deductions,
                    notes: emp.notes || '',
                    netPay: emp.netPay,
                    processedToExpenses: true,
                    processedAt: serverTimestamp(),
                    createdAt: serverTimestamp()
                });
            }

            setShowConfirmModal(false);
            fetchPayrollData();

            // 3. Send via WhatsApp (this now downloads/shares PDF instead of opening HTML)
            if (emp.processedToExpenses) {
                // Already paid? Just send WhatsApp
                sendPayslipViaWhatsApp(emp);
            } else {
                setTimeout(() => sendPayslipViaWhatsApp(emp), 500);
            }

        } catch (error) {
            console.error('Error processing salary:', error);
            alert('Error processing salary. Please try again.');
        } finally {
            setSelectedEmployee(null);
            // Don't setProcessing(false) here if sendPayslipViaWhatsApp is taking over the loading state
        }
    };

    const exportToExcel = () => {
        const exportData = employees.map(emp => ({
            Name: emp.displayName,
            Email: emp.email,
            Role: emp.role,
            'Base Salary': emp.baseSalary,
            Allowances: emp.allowances || 0,
            Bonus: emp.bonus,
            Deductions: emp.deductions,
            'Net Pay': emp.netPay,
            Status: emp.processedToExpenses ? 'Paid' : 'Pending',
            Notes: emp.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
        XLSX.writeFile(wb, `payroll_${month}.xlsx`);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const handlePrevMonth = () => {
        const date = new Date(month + '-01');
        date.setMonth(date.getMonth() - 1);
        setMonth(date.toISOString().slice(0, 7));
    };

    const handleNextMonth = () => {
        const date = new Date(month + '-01');
        date.setMonth(date.getMonth() + 1);
        setMonth(date.toISOString().slice(0, 7));
    };

    const handleGeneratePayslips = async () => {
        if (employees.length === 0) return;
        setProcessing(true);
        try {
            for (const emp of employees) {
                const pdfBlob = await generatePdfBlob(emp);
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Payslip_${emp.displayName.replace(/\s+/g, '_')}_${month}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                await new Promise(r => setTimeout(r, 500)); // stagger downloads
            }
        } catch (error) {
            console.error('Error batch generating payslips:', error);
            alert('Failed to generate some payslips.');
        } finally {
            setProcessing(false);
        }
    };

    const handleSinglePayslip = async (emp) => {
        setProcessing(true);
        try {
            const pdfBlob = await generatePdfBlob(emp);
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Payslip_${emp.displayName.replace(/\s+/g, '_')}_${month}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Also open in new tab for preview
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF.');
        } finally {
            setProcessing(false);
        }
    };

    // Filters
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.displayName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'All' || emp.role === roleFilter;
        let matchesStatus = true;
        if (statusFilter === 'Pending') matchesStatus = !emp.processedToExpenses;
        if (statusFilter === 'Paid') matchesStatus = emp.processedToExpenses;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const uniqueRoles = ['All', ...new Set(employees.map(emp => emp.role))];

    const totalPayroll = employees.reduce((sum, emp) => sum + (emp.netPay || 0), 0);
    const totalBonus = employees.reduce((sum, emp) => sum + (emp.bonus || 0), 0);
    const totalDeductions = employees.reduce((sum, emp) => sum + (emp.deductions || 0), 0);
    const totalPending = employees.filter(emp => !emp.processedToExpenses).reduce((sum, emp) => sum + (emp.netPay || 0), 0);

    const roleCostData = uniqueRoles.filter(r => r !== 'All').map(role => ({
        name: role,
        cost: employees.filter(e => e.role === role).reduce((sum, e) => sum + (e.netPay || 0), 0)
    }));

    const currentMonthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const monthlyTrendData = [
        { month: currentMonthLabel, cost: totalPayroll }
    ];

    return (
        <div className="payroll-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <style>{`
                .desktop-table-container { display: block; overflow-x: auto; }
                .mobile-cards-container { display: none; padding: 1rem; }
                .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
                .analytics-grid > div { min-width: 0; }
                @media (max-width: 1024px) {
                    .desktop-table-container { display: none !important; }
                    .mobile-cards-container { display: flex !important; flex-direction: column; gap: 1rem; }
                    .summary-cards-row1, .summary-cards-row2 { grid-template-columns: 1fr !important; }
                    .analytics-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                        <Receipt size={24} color="#3b82f6" /> Payroll Management
                    </h1>
                    <p style={{ color: '#64748b', margin: '0.2rem 0 0 0', fontSize: '0.875rem' }}>Manage employee salaries, bonuses, and payments</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <button onClick={handlePrevMonth} style={{ padding: '0.4rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRight: '1px solid #e2e8f0' }}><ChevronLeft size={18} /></button>
                        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: 'none', background: 'transparent', fontWeight: '500', color: '#334155', outline: 'none', fontSize: '0.875rem' }} />
                        <button onClick={handleNextMonth} style={{ padding: '0.4rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderLeft: '1px solid #e2e8f0' }}><ChevronRight size={18} /></button>
                    </div>
                    {hasPermission('payroll', 'edit') && (
                        <button onClick={() => setShowManualEntryModal(true)} title="Manual Entry" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.45rem 0.75rem', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <Calculator size={16} /> Entry
                        </button>
                    )}
                    <button onClick={handleGeneratePayslips} title="Generate Payslips" style={{ background: 'white', color: '#334155', border: '1px solid #e2e8f0', padding: '0.45rem 0.75rem', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <FileText size={16} /> Payslips
                    </button>
                    <button onClick={exportToExcel} title="Export" style={{ background: 'white', color: '#334155', border: '1px solid #e2e8f0', padding: '0.45rem 0.75rem', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <Download size={16} /> Export
                    </button>
                </div>
            </div>

            {/* Summary Cards — Row 1: 3 cards */}
            <div className="summary-cards-row1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#f3e8ff', color: '#a855f7', padding: '0.75rem', borderRadius: '10px', flexShrink: 0 }}><Users size={22} /></div>
                    <div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.2rem' }}>Total Employees</div>
                        <div style={{ color: '#0f172a', fontSize: '1.4rem', fontWeight: '700' }}>{filteredEmployees.length}</div>
                    </div>
                </div>
                <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#dcfce7', color: '#22c55e', padding: '0.75rem', borderRadius: '10px', flexShrink: 0 }}><Receipt size={22} /></div>
                    <div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.2rem' }}>Total Payroll Cost</div>
                        <div style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(totalPayroll)}</div>
                    </div>
                </div>
                <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#e0f2fe', color: '#0ea5e9', padding: '0.75rem', borderRadius: '10px', flexShrink: 0 }}><TrendingUp size={22} /></div>
                    <div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.2rem' }}>Total Bonuses</div>
                        <div style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(totalBonus)}</div>
                    </div>
                </div>
            </div>
            {/* Summary Cards — Row 2: 2 cards */}
            <div className="summary-cards-row2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#fee2e2', color: '#ef4444', padding: '0.75rem', borderRadius: '10px', flexShrink: 0 }}><IndianRupee size={22} /></div>
                    <div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.2rem' }}>Total Deductions</div>
                        <div style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(totalDeductions)}</div>
                    </div>
                </div>
                <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ background: '#fef3c7', color: '#f59e0b', padding: '0.75rem', borderRadius: '10px', flexShrink: 0 }}><AlertCircle size={22} /></div>
                    <div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500', marginBottom: '0.2rem' }}>Pending Payments</div>
                        <div style={{ color: '#b45309', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(totalPending)}</div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', background: 'white', padding: '0.75rem', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ flex: '1', minWidth: '180px', position: 'relative' }}>
                    <Search size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', borderRadius: '7px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }}
                    />
                </div>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '7px', border: '1px solid #e2e8f0', outline: 'none', background: 'white', color: '#334155', fontSize: '0.875rem' }}>
                    {uniqueRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '7px', border: '1px solid #e2e8f0', outline: 'none', background: 'white', color: '#334155', fontSize: '0.875rem' }}>
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                </select>
            </div>

            {/* Payroll Table */}
            <div className="card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: '2rem' }}>
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state" style={{ padding: '3rem' }}><div className="loader"></div></div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="empty-state" style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                            <Receipt size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                            <p style={{ fontSize: '1.1rem' }}>No employees found matching criteria</p>
                        </div>
                    ) : (
                        <div className="desktop-table-container">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', color: '#64748b' }}>
                                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>Employee</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontWeight: '600' }}>Role</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>Base</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>Allow.</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>Bonus</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#ef4444' }}>Deduct.</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>Net Pay</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: '600' }}>Status</th>
                                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.map((emp) => (
                                        <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={(e) => { if (e.target.closest('.action-btn')) return; handleViewHistoryClick(emp); }}>
                                            <td style={{ padding: '0.65rem 0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: '600', fontSize: '0.8rem', flexShrink: 0 }}>
                                                        {emp.displayName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ color: '#1e293b', fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{emp.displayName}</div>
                                                        <div style={{ color: '#94a3b8', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{emp.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem' }}>
                                                <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '500', whiteSpace: 'nowrap' }}>{emp.role}</span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{formatCurrency(emp.baseSalary)}</td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{formatCurrency(emp.allowances)}</td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                                                <span style={{ color: emp.bonus > 0 ? '#10b981' : '#cbd5e1' }}>{emp.bonus > 0 ? '+' : ''}{formatCurrency(emp.bonus)}</span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                                                <span style={{ color: emp.deductions > 0 ? '#ef4444' : '#cbd5e1' }}>{emp.deductions > 0 ? '-' : ''}{formatCurrency(emp.deductions)}</span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <strong style={{ color: '#0f172a', fontSize: '0.875rem' }}>{formatCurrency(emp.netPay)}</strong>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                                                {emp.processedToExpenses ? (
                                                    <span style={{ background: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                                                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#166534' }}></div> Paid
                                                    </span>
                                                ) : (
                                                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                                                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#b45309' }}></div> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleViewHistoryClick(emp); }} title="Payroll Details" style={{ padding: '0.3rem', color: '#64748b', background: '#f8fafc', borderRadius: '5px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                                                        <Eye size={14} />
                                                    </button>
                                                    {hasPermission('payroll', 'edit') && !emp.processedToExpenses && (
                                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }} title="Edit Salary" style={{ padding: '0.3rem', color: '#3b82f6', background: '#eff6ff', borderRadius: '5px', border: '1px solid #bfdbfe', cursor: 'pointer' }}>
                                                            <Edit size={14} />
                                                        </button>
                                                    )}
                                                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleSinglePayslip(emp); }} title="View Payslip" style={{ padding: '0.3rem', color: '#8b5cf6', background: '#f5f3ff', borderRadius: '5px', border: '1px solid #ddd6fe', cursor: 'pointer' }}>
                                                        <FileText size={14} />
                                                    </button>
                                                    {hasPermission('payroll', 'edit') && !emp.processedToExpenses && (
                                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleProcessClick(emp); }} title="Mark as Paid" style={{ padding: '0.3rem', color: '#10b981', background: '#ecfdf5', borderRadius: '5px', border: '1px solid #a7f3d0', cursor: 'pointer' }}>
                                                            <CheckCircle size={14} />
                                                        </button>
                                                    )}
                                                    {hasPermission('payroll', 'edit') && emp.processedToExpenses && (
                                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleUnpayClick(emp); }} title="Revert Payment" style={{ padding: '0.3rem', color: '#ef4444', background: '#fef2f2', borderRadius: '5px', border: '1px solid #fecaca', cursor: 'pointer' }}>
                                                            <XCircle size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Mobile Cards */}
                    <div className="mobile-cards-container">
                        {filteredEmployees.map(emp => (
                            <div key={emp.id} className="booking-card" style={{ background: 'white', borderTop: '4px solid #3b82f6', borderRadius: '8px', padding: '1rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div className="booking-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{emp.displayName}</strong>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '99px', marginTop: '0.2rem', width: 'fit-content' }}>{emp.role}</span>
                                    </div>
                                    <div>
                                        {emp.processedToExpenses ? (
                                            <span style={{ background: '#dcfce7', color: '#166534', padding: '0.3rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#166534' }}></div> Paid
                                            </span>
                                        ) : (
                                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.3rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b45309' }}></div> Pending
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="booking-card-body" style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base Salary:</span> <strong>{formatCurrency(emp.baseSalary)}</strong></div>
                                    {emp.allowances > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Allowances:</span> <strong>{formatCurrency(emp.allowances)}</strong></div>}
                                    {emp.bonus > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}><span>Bonus:</span> <strong>+{formatCurrency(emp.bonus)}</strong></div>}
                                    {emp.deductions > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}><span>Deductions:</span> <strong>-{formatCurrency(emp.deductions)}</strong></div>}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '1.05rem', color: '#0f172a' }}><span><strong>Net Pay:</strong></span> <strong>{formatCurrency(emp.netPay)}</strong></div>
                                </div>
                                <div className="booking-card-footer" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleViewHistoryClick(emp); }} title="Payroll Details" style={{ flex: '1 1 45%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#64748b', background: '#f8fafc', borderRadius: '5px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}>
                                        <Eye size={14} /> Details
                                    </button>
                                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleSinglePayslip(emp); }} title="WhatsApp Payslip" style={{ flex: '1 1 45%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#fff', background: '#10b981', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                                        <FileText size={14} /> Send Payslip
                                    </button>
                                    {hasPermission('payroll', 'edit') && !emp.processedToExpenses && (
                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }} title="Edit Salary" style={{ flex: '1 1 45%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#3b82f6', background: '#eff6ff', borderRadius: '5px', border: '1px solid #bfdbfe', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}>
                                            <Edit size={14} /> Edit
                                        </button>
                                    )}
                                    {hasPermission('payroll', 'edit') && !emp.processedToExpenses && (
                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleProcessClick(emp); }} title="Mark as Paid" style={{ flex: '1 1 45%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#166534', background: '#dcfce7', borderRadius: '5px', border: '1px solid #a7f3d0', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}>
                                            <CheckCircle size={14} /> Pay
                                        </button>
                                    )}
                                    {hasPermission('payroll', 'edit') && emp.processedToExpenses && (
                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleUnpayClick(emp); }} title="Revert Payment" style={{ flex: '1 1 45%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#ef4444', background: '#fef2f2', borderRadius: '5px', border: '1px solid #fecaca', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}>
                                            <XCircle size={14} /> Revert
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payroll Analytics Section */}
            {!loading && filteredEmployees.length > 0 && (
                <div className="analytics-grid">
                    <div className="card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '1.5rem', fontWeight: '600' }}>Payroll Cost by Role</h3>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={roleCostData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(value) => `₹${value / 1000}k`} />
                                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '1.5rem', fontWeight: '600' }}>Monthly Payroll Expenses</h3>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(value) => `₹${value / 1000}k`} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && selectedEmployee && (
                <div className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2><AlertCircle size={20} /> Confirm Payment Processing</h2>
                            <button className="modal-close" onClick={() => setShowConfirmModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '1rem' }}>
                                Process salary payment for <strong>{selectedEmployee.displayName}</strong> for <strong>{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>?
                            </p>
                            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Net Pay:</span>
                                    <strong>{formatCurrency(selectedEmployee.netPay)}</strong>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                    Base: {formatCurrency(selectedEmployee.baseSalary)}
                                    {selectedEmployee.bonus > 0 && ` + Bonus: ${formatCurrency(selectedEmployee.bonus)}`}
                                    {selectedEmployee.deductions > 0 && ` - Ded: ${formatCurrency(selectedEmployee.deductions)}`}
                                </div>
                            </div>
                            <p style={{ color: '#666', fontSize: '0.9rem' }}>
                                This will add an expense record and mark the salary as paid.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={processEmployeeSalary}
                                disabled={processing}
                            >
                                {processing ? 'Processing...' : 'Confirm & Pay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payroll Edit Modal */}
            {showPayrollModal && selectedEmployee && (
                <PayrollModal
                    employee={selectedEmployee}
                    month={month}
                    onClose={() => setShowPayrollModal(false)}
                    onSuccess={() => {
                        setShowPayrollModal(false);
                        fetchPayrollData();
                    }}
                />
            )}

            {/* Manual Payroll Entry Modal */}
            {showManualEntryModal && selectedEmployee && (
                <ManualPayrollModal
                    employee={selectedEmployee}
                    initialMonth={month}
                    onClose={() => setShowManualEntryModal(false)}
                    onSuccess={() => {
                        setShowManualEntryModal(false);
                        fetchPayrollData();
                    }}
                />
            )}

            {/* Employee History Modal */}
            {showHistoryModal && selectedEmployee && (
                <EmployeePayrollHistoryModal
                    employee={selectedEmployee}
                    onClose={() => setShowHistoryModal(false)}
                    onManualEntry={() => {
                        setShowHistoryModal(false);
                        setShowManualEntryModal(true);
                    }}
                    hasEditPermission={hasPermission('payroll', 'edit')}
                />
            )}

            <style>{`
                .process-salary-section {
                    margin-bottom: 1.5rem;
                }
                .btn-success {
                    background-color: #10b981;
                    color: white;
                }
                .btn-success:hover {
                    background-color: #059669;
                }

                @media (max-width: 768px) {
                  .page-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 1rem;
                  }

                  .header-actions {
                    width: 100%;
                    flex-direction: column;
                  }

                  .header-actions .filter-select,
                  .header-actions .btn {
                    width: 100%;
                    justify-content: center;
                  }

                  .quick-stats-row {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                  }

                  .quick-stat-card {
                    padding: 0.75rem;
                    margin-bottom: 0;
                  }

                  .desktop-table {
                    display: none;
                  }

                  .mobile-cards {
                    display: block;
                  }

                  .booking-card {
                    background: var(--navy-50);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                    border: 1px solid var(--navy-100);
                  }

                  .booking-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                    border-bottom: 1px solid var(--navy-100);
                    padding-bottom: 0.5rem;
                  }

                  .booking-card-body p {
                    margin: 0.25rem 0;
                    font-size: 0.9rem;
                  }

                  .booking-card-footer {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--navy-100);
                  }

                  .booking-card-footer .btn {
                    flex: 1;
                    justify-content: center;
                  }

                  .modal-content {
                    width: 95% !important;
                    margin: 10px auto !important;
                    padding: 1.25rem;
                  }

                  .form-row {
                    flex-direction: column;
                    gap: 0;
                  }

                  /* History Modal Header */
                  .modal-body > div[style*="display: flex"][style*="justify-content: space-between"] {
                    flex-direction: column;
                    align-items: flex-start !important;
                    gap: 1rem;
                  }

                  .modal-body div[style*="text-align: right"] {
                    text-align: left !important;
                    width: 100%;
                    flex-direction: column-reverse;
                  }

                  .modal-body div[style*="text-align: right"] .btn {
                    width: 100%;
                  }

                  /* Manual Entry Stats Grid */
                  div[style*="display: grid"][style*="grid-template-columns: repeat(auto-fit"] {
                    grid-template-columns: repeat(3, 1fr) !important;
                  }
                }

                @media (min-width: 769px) {
                  .mobile-cards {
                    display: none;
                  }
                }
            `}</style>
        </div>
    );
};

const PayrollModal = ({ employee, month, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        baseSalary: employee.baseSalary,
        allowances: employee.allowances || 0,
        bonus: employee.bonus,
        deductions: employee.deductions,
        notes: employee.notes || ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = {
                employeeId: employee.id,
                month: month,
                baseSalary: Number(formData.baseSalary) || 0,
                allowances: Number(formData.allowances) || 0,
                bonus: Number(formData.bonus) || 0,
                deductions: Number(formData.deductions) || 0,
                notes: formData.notes || '',
                netPay: Number(formData.baseSalary) + Number(formData.allowances) + Number(formData.bonus) - Number(formData.deductions),
                updatedAt: serverTimestamp()
            };

            if (employee.payrollId) {
                await updateDoc(doc(db, 'payroll', employee.payrollId), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'payroll'), data);
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving payroll:', error);
            alert('Error saving payroll. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const netPay = Number(formData.baseSalary) + Number(formData.allowances) + Number(formData.bonus) - Number(formData.deductions);

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Edit size={20} /> Edit Payroll</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                            <strong>{employee.displayName}</strong>
                            <div style={{ fontSize: '0.85rem', color: 'var(--navy-500)' }}>
                                {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Base Salary</label>
                                <input
                                    type="number"
                                    name="baseSalary"
                                    value={formData.baseSalary}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Allowances</label>
                                <input
                                    type="number"
                                    name="allowances"
                                    value={formData.allowances}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Bonus</label>
                                <input
                                    type="number"
                                    name="bonus"
                                    value={formData.bonus}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Deductions</label>
                                <input
                                    type="number"
                                    name="deductions"
                                    value={formData.deductions}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Reason for bonus/deduction..."
                            ></textarea>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500' }}>Net Pay:</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#166534' }}>
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(netPay)}
                            </span>
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

const EmployeePayrollHistoryModal = ({ employee, onClose, onManualEntry, hasEditPermission }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const q = query(
                    collection(db, 'payroll'),
                    where('employeeId', '==', employee.id),
                    orderBy('month', 'desc')
                );
                const snapshot = await getDocs(q);
                setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [employee.id]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const totalEarnings = history.reduce((sum, record) => sum + (record.netPay || 0), 0);

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><Receipt size={20} /> Payroll History</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{employee.displayName}</h3>
                            <p style={{ color: 'var(--navy-500)' }}>{employee.role}</p>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--navy-500)' }}>Total Earnings</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    {formatCurrency(totalEarnings)}
                                </div>
                            </div>
                            {hasEditPermission && (
                                <button
                                    className="btn btn-primary"
                                    onClick={onManualEntry}
                                    style={{ height: 'fit-content' }}
                                >
                                    <Calculator size={18} style={{ marginRight: '0.5rem' }} />
                                    Add Manual Entry
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loader" style={{ margin: '2rem auto' }}></div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <p>No payroll history found</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Base</th>
                                        <th>Allowances</th>
                                        <th>Bonus</th>
                                        <th>Deductions</th>
                                        <th>Net Pay</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(record => (
                                        <tr key={record.id}>
                                            <td>
                                                {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </td>
                                            <td>{formatCurrency(record.baseSalary)}</td>
                                            <td>{formatCurrency(record.allowances || 0)}</td>
                                            <td style={{ color: record.bonus > 0 ? '#10b981' : 'inherit' }}>
                                                {formatCurrency(record.bonus)}
                                            </td>
                                            <td style={{ color: record.deductions > 0 ? '#ef4444' : 'inherit' }}>
                                                {formatCurrency(record.deductions)}
                                            </td>
                                            <td><strong>{formatCurrency(record.netPay)}</strong></td>
                                            <td>
                                                {record.processedToExpenses ? (
                                                    <span className="badge badge-completed">Paid</span>
                                                ) : (
                                                    <span className="badge badge-pending">Pending</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const ManualPayrollModal = ({ employee, initialMonth, onClose, onSuccess }) => {
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [attendanceStats, setAttendanceStats] = useState({
        present: 0,
        absent: 0,
        halfDay: 0,
        paidLeave: 0,
        unpaidLeave: 0,
        overtime: 0,
        overtimeHours: 0,
        totalDays: 0
    });
    const [loadingStats, setLoadingStats] = useState(false);
    const [formData, setFormData] = useState({
        baseSalary: employee.baseSalary,
        allowances: employee.allowances || 0,
        bonus: 0,
        deductions: 0,
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAttendanceStats();
    }, [selectedMonth, employee.id]);

    const fetchAttendanceStats = async () => {
        setLoadingStats(true);
        try {
            const year = parseInt(selectedMonth.split('-')[0]);
            const month = parseInt(selectedMonth.split('-')[1]) - 1; // 0-indexed

            // Calculate start and end date for the month
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const q = query(
                collection(db, 'attendance'),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );

            const snapshot = await getDocs(q);
            const empAttendance = snapshot.docs
                .map(doc => doc.data())
                .filter(doc => doc.userId === employee.id);

            const stats = {
                present: empAttendance.filter(a => a.status === 'present').length,
                absent: empAttendance.filter(a => a.status === 'absent').length,
                halfDay: empAttendance.filter(a => a.status === 'half-day').length,
                leave: empAttendance.filter(a => a.status === 'leave').length,
                totalDays: lastDay
            };
            setAttendanceStats(stats);

            // Check if there's already a payroll record for this month to pre-fill
            // Note: The parent component passes 'employee' which might have data for the *viewed* month, 
            // but if user changes month in this modal, we might want to fetch that month's payroll.
            // For simplicity, we stick to entering new data or editing if we add that logic, 
            // but the requirement implies "entering" a record.
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // 1. Calculate Net Pay
            const netPay = Number(formData.baseSalary) + Number(formData.allowances) + Number(formData.bonus) - Number(formData.deductions);
            const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // 2. Create Payroll Record
            // Check if exists first to update or create
            const payrollRef = collection(db, 'payroll');
            const q = query(payrollRef, where('employeeId', '==', employee.id), where('month', '==', selectedMonth));
            const snapshot = await getDocs(q);

            let payrollId;
            const payrollData = {
                employeeId: employee.id,
                month: selectedMonth,
                baseSalary: Number(formData.baseSalary),
                allowances: Number(formData.allowances) || 0,
                bonus: Number(formData.bonus),
                deductions: Number(formData.deductions),
                notes: formData.notes,
                netPay: netPay,
                processedToExpenses: true, // Auto-mark as processed for manual entry
                processedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (!snapshot.empty) {
                const docId = snapshot.docs[0].id;
                await updateDoc(doc(db, 'payroll', docId), payrollData);
                payrollId = docId;
            } else {
                payrollData.createdAt = serverTimestamp();
                const docRef = await addDoc(payrollRef, payrollData);
                payrollId = docRef.id;
            }

            // 3. Create Expense Entry
            await addDoc(collection(db, 'expenses'), {
                title: `Salary - ${employee.displayName} (${monthName})`,
                amount: netPay,
                category: 'salary',
                date: new Date().toISOString().split('T')[0],
                paymentMode: 'bank_transfer', // Default or add selector
                note: `Manual Entry. Base: ${formData.baseSalary}, Allowances: ${formData.allowances || 0}, Bonus: ${formData.bonus}, Ded: ${formData.deductions}. ${formData.notes}`,
                employeeId: employee.id,
                payrollId: payrollId,
                month: selectedMonth,
                isAutoGenerated: true,
                createdAt: serverTimestamp()
            });

            onSuccess();
        } catch (error) {
            console.error('Error submitting manual payroll:', error);
            alert('Failed to submit payroll. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const netPay = Number(formData.baseSalary) + Number(formData.allowances) + Number(formData.bonus) - Number(formData.deductions);

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><Calculator size={20} /> Manual Payroll Entry</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Header Info */}
                        <div className="manual-entry-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{employee.displayName}</h3>
                                <p style={{ color: 'var(--navy-500)', fontSize: '0.9rem' }}>{employee.role}</p>
                            </div>
                            <div>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="filter-select"
                                    required
                                />
                            </div>
                        </div>

                        {/* Attendance Summary Panel */}
                        <div style={{
                            background: 'var(--navy-50)',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            marginBottom: '1.5rem',
                            border: '1px solid var(--navy-100)'
                        }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={16} /> Attendance Summary ({selectedMonth})
                            </h4>
                            {loadingStats ? (
                                <div className="loader is-small"></div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{attendanceStats.present}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Present</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{attendanceStats.absent}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Absent</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{attendanceStats.halfDay}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Half-day</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{attendanceStats.paidLeave}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Paid Leave</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fca5a5' }}>{attendanceStats.unpaidLeave}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Unpaid Leave</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{attendanceStats.overtimeHours}h</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Overtime</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Salary Inputs */}
                        <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Base Salary</label>
                                    <input
                                        type="number"
                                        name="baseSalary"
                                        value={formData.baseSalary}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Allowances</label>
                                    <input
                                        type="number"
                                        name="allowances"
                                        value={formData.allowances}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Bonus</label>
                                    <input
                                        type="number"
                                        name="bonus"
                                        value={formData.bonus}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Deductions</label>
                                    <input
                                        type="number"
                                        name="deductions"
                                        value={formData.deductions}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    placeholder="Add notes about payment, overtime, etc..."
                                    rows="2"
                                ></textarea>
                            </div>
                        </div>

                        {/* Net Pay */}
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontWeight: '500', display: 'block' }}>Net Pay</span>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>Amount to be paid</span>
                            </div>
                            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#166534' }}>
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(netPay)}
                            </span>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Processing...' : 'Confirm & Pay'}
                        </button>
                    </div>
                </form>
                <style>{`
                    .stat-card-mini {
                        padding: 0.75rem;
                        border-radius: 6px;
                        text-align: center;
                    }
                    .stat-card-mini .label {
                        font-size: 0.75rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 0.25rem;
                        opacity: 0.8;
                    }
                    .stat-card-mini .value {
                        font-size: 1.25rem;
                        font-weight: 700;
                    }

                    @media (max-width: 768px) {
                      .manual-entry-header {
                        grid-template-columns: 1fr !important;
                      }
                      
                      div[style*="display: grid"][style*="grid-template-columns: repeat(auto-fit"] {
                        grid-template-columns: repeat(2, 1fr) !important;
                      }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default Payroll;
