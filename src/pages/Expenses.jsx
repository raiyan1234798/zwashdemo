import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import {
    IndianRupee,
    Plus,
    TrendingDown,
    TrendingUp,
    Package,
    Zap,
    Wrench,
    Home,
    MoreVertical,
    Edit,
    Trash2,
    Download,
    UserCog,
    CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';

const Expenses = () => {
    const { hasPermission } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState(['tea', 'supplies', 'utilities', 'maintenance', 'rent', 'misc']);
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [stats, setStats] = useState({ total: 0 });
    const [income, setIncome] = useState({ today: 0, yesterday: 0, week: 0, month: 0, last30Days: 0 });
    const [selectedDate, setSelectedDate] = useState(null);
    const [editingExpense, setEditingExpense] = useState(null);
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        fetchCategories();
        fetchExpenses();
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const usersRef = collection(db, 'adminUsers');
            const q = query(usersRef, where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEmployees(list);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchCategories = async () => {
        try {
            const docRef = doc(db, 'settings', 'expenses');
            const docSnap = await getDoc(docRef);
            let expenseCategories = ['tea', 'supplies', 'utilities', 'maintenance', 'rent', 'misc'];

            if (docSnap.exists() && docSnap.data().categories) {
                expenseCategories = docSnap.data().categories;
            }

            // Fetch services to include them as categories
            const servicesSnapshot = await getDocs(collection(db, 'services'));
            const servicesList = servicesSnapshot.docs
                .map(doc => doc.data().name.toLowerCase())
                .filter(name => name);

            // Merge and remove duplicates
            const combinedCategories = [...new Set([...expenseCategories, ...servicesList])];
            setCategories(combinedCategories);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            const expensesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setExpenses(expensesList);

            // Fetch bookings for income calculation
            const bookingsSnap = await getDocs(collection(db, 'bookings'));
            const bookingsList = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Calculate stats
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

            // --- Income from bookings ---
            const sumPaid = (list) => list.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
            setIncome({
                today:      sumPaid(bookingsList.filter(b => b.bookingDate === today)),
                yesterday:  sumPaid(bookingsList.filter(b => b.bookingDate === yesterday)),
                week:       sumPaid(bookingsList.filter(b => b.bookingDate >= weekAgo)),
                month:      sumPaid(bookingsList.filter(b => b.bookingDate >= monthStart)),
                last30Days: sumPaid(bookingsList.filter(b => b.bookingDate >= thirtyDaysAgo)),
            });

            // --- Expense stats ---
            const statsCalc = {
                total: 0,
                today: 0,
                yesterday: 0,
                week: 0,
                month: 0,
                last30Days: 0,
                tea: 0,
                supplies: 0,
                utilities: 0,
                maintenance: 0,
                rent: 0,
                misc: 0,
                dailyBreakdown: []
            };
            // Calculate daily breakdown for last 30 days
            const dailyMap = {};

            for (let i = 0; i < 30; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                dailyMap[dateStr] = { expense: 0, monthLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            }

            expensesList.forEach(exp => {
                const amount = exp.amount || 0;
                statsCalc.total += amount;

                if (exp.date === today) statsCalc.today += amount;
                if (exp.date === yesterday) statsCalc.yesterday += amount;
                if (exp.date >= weekAgo) statsCalc.week += amount;
                if (exp.date >= monthStart) statsCalc.month += amount;
                if (exp.date >= thirtyDaysAgo) statsCalc.last30Days += amount;

                if (exp.category && statsCalc[exp.category] !== undefined) {
                    statsCalc[exp.category] += amount;
                }

                if (dailyMap[exp.date] !== undefined) {
                    dailyMap[exp.date].expense += amount;
                }
            });

            statsCalc.dailyBreakdown = Object.entries(dailyMap)
                .map(([date, data]) => ({ date, expense: data.expense, name: data.monthLabel }))
                .reverse();

            setStats(statsCalc);
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteExpense = async (id) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;
        try {
            await deleteDoc(doc(db, 'expenses', id));
            fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'supplies': return <Package size={18} />;
            case 'utilities': return <Zap size={18} />;
            case 'maintenance': return <Wrench size={18} />;
            case 'rent': return <Home size={18} />;
            case 'advance salary': return <UserCog size={18} />;
            default: return <MoreVertical size={18} />;
        }
    };

    const generateAdvanceSlip = (emp, amount, date, note) => {
        const doc = new jsPDF();
        const margin = 20;
        let y = 30;

        // Header Background
        doc.setFillColor(26, 31, 58); // var(--navy-900)
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('ADVANCE SALARY SLIP', 105, 25, { align: 'center' });

        doc.setTextColor(30, 41, 59); // var(--navy-800)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        y = 55;

        // Employee Info Box
        doc.setDrawColor(226, 232, 240); // var(--navy-200)
        doc.setFillColor(248, 250, 252); // var(--navy-50)
        doc.roundedRect(margin, y, 170, 45, 3, 3, 'FD');

        y += 12;
        doc.setFont('helvetica', 'bold');
        doc.text('Employee Details:', margin + 10, y);
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Name: ${emp?.displayName || 'N/A'}`, margin + 10, y);
        doc.text(`Employee ID: ${emp?.id?.slice(0, 8) || 'N/A'}`, margin + 100, y);
        y += 8;
        doc.text(`Role: ${emp?.role || 'N/A'}`, margin + 10, y);
        doc.text(`Phone: ${emp?.phone || 'N/A'}`, margin + 100, y);

        // Payment Info
        y = 115;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT DETAILS', margin, y);
        y += 5;
        doc.line(margin, y, 190, y);

        y += 12;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Advance Date:', margin + 10, y);
        doc.setFont('helvetica', 'bold');
        doc.text(date, margin + 60, y);

        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text('Advance Amount:', margin + 10, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(16, 185, 129); // Success color
        doc.text(`INR ${amount.toLocaleString()}`, margin + 60, y);

        y += 12;
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Description:', margin + 10, y);
        doc.setFont('helvetica', 'italic');
        doc.text(note || 'Salary Advance', margin + 60, y);

        // Footer
        y = 250;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, 190, y);
        y += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // Muted color
        doc.text('This is an electronically generated slip. No signature required.', 105, y, { align: 'center' });
        doc.text('Thank you for being a part of our team!', 105, y + 5, { align: 'center' });

        doc.save(`AdvanceSlip_${emp?.displayName || 'Employee'}_${date}.pdf`);
    };

    const exportToExcel = () => {
        const dataToExport = filteredExpenses.map(exp => ({
            Date: exp.date,
            Title: exp.title,
            Category: exp.category,
            Amount: exp.amount,
            'Payment Mode': exp.paymentMode || 'N/A',
            Note: exp.note || ''
        }));

        const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

        dataToExport.push({
            Date: 'Total',
            Title: '',
            Category: '',
            Amount: totalAmount,
            'Payment Mode': '',
            Note: ''
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        XLSX.writeFile(wb, `Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredExpenses = expenses.filter(e => {
        if (selectedDate && e.date !== selectedDate) return false;
        if (startDateFilter && e.date < startDateFilter) return false;
        if (endDateFilter && e.date > endDateFilter) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        return true;
    });

    const filteredTotal = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return (
        <div className="expenses-page">
            <div className="page-header">
                <div>
                    <h1><IndianRupee size={28} /> Expense Tracking</h1>
                    <p className="subtitle">Track and manage business expenses</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Export
                    </button>
                    {hasPermission('expenses', 'create') && (
                        <button className="btn btn-primary" onClick={() => { setEditingExpense(null); setShowModal(true); }}>
                            <Plus size={18} /> Add Expense
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards — Income vs Expenses */}
            <div style={{ marginBottom: '1.5rem' }}>

                {/* Section header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', paddingLeft: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <TrendingUp size={14} /> Income (Paid)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <TrendingDown size={14} /> Expenses
                    </div>
                </div>

                {/* Paired cards grid */}
                {[
                    { label: 'Today',       inc: income.today,      exp: stats.today      },
                    { label: 'Yesterday',   inc: income.yesterday,  exp: stats.yesterday  },
                    { label: 'This Week',   inc: income.week,       exp: stats.week       },
                    { label: 'This Month',  inc: income.month,      exp: stats.month      },
                ].map(({ label, inc, exp }) => {
                    const net = inc - exp;
                    return (
                        <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            {/* Income card */}
                            <div className="expense-summary-card" style={{ borderLeft: '3px solid #10b981' }}>
                                <div className="expense-icon" style={{ background: '#dcfce7', color: '#059669' }}>
                                    <TrendingUp size={22} />
                                </div>
                                <div className="expense-content">
                                    <span className="expense-label">{label} — Income</span>
                                    <span className="expense-value" style={{ color: '#059669' }}>{formatCurrency(inc)}</span>
                                </div>
                            </div>
                            {/* Expense card */}
                            <div className="expense-summary-card" style={{ borderLeft: '3px solid #ef4444' }}>
                                <div className="expense-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                                    <TrendingDown size={22} />
                                </div>
                                <div className="expense-content">
                                    <span className="expense-label">{label} — Expenses</span>
                                    <span className="expense-value" style={{ color: '#dc2626' }}>{formatCurrency(exp)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Last 30 Days full-width net row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="expense-summary-card" style={{ borderLeft: '3px solid #10b981' }}>
                        <div className="expense-icon" style={{ background: '#dcfce7', color: '#059669' }}>
                            <TrendingUp size={22} />
                        </div>
                        <div className="expense-content">
                            <span className="expense-label">Last 30 Days — Income</span>
                            <span className="expense-value" style={{ color: '#059669' }}>{formatCurrency(income.last30Days)}</span>
                        </div>
                    </div>
                    <div className="expense-summary-card" style={{ borderLeft: '3px solid #ef4444' }}>
                        <div className="expense-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                            <TrendingDown size={22} />
                        </div>
                        <div className="expense-content">
                            <span className="expense-label">Last 30 Days — Expenses</span>
                            <span className="expense-value" style={{ color: '#dc2626' }}>{formatCurrency(stats.last30Days)}</span>
                        </div>
                    </div>
                    <div className="expense-summary-card" style={{
                        background: (income.last30Days - stats.last30Days) >= 0 ? '#f0fdf4' : '#fef2f2',
                        borderLeft: `3px solid ${(income.last30Days - stats.last30Days) >= 0 ? '#10b981' : '#ef4444'}`,
                    }}>
                        <div className="expense-icon" style={{
                            background: (income.last30Days - stats.last30Days) >= 0 ? '#bbf7d0' : '#fecaca',
                            color: (income.last30Days - stats.last30Days) >= 0 ? '#059669' : '#dc2626'
                        }}>
                            <IndianRupee size={22} />
                        </div>
                        <div className="expense-content">
                            <span className="expense-label">Net Profit (30 Days)</span>
                            <span className="expense-value" style={{ color: (income.last30Days - stats.last30Days) >= 0 ? '#059669' : '#dc2626' }}>
                                {formatCurrency(income.last30Days - stats.last30Days)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar View */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>📅 Expense Calendar (Last 30 Days)</h3>
                    {selectedDate && (
                        <button
                            onClick={() => setSelectedDate(null)}
                            style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}
                        >
                            Reset Filter
                        </button>
                    )}
                </div>
                <div className="card-body">
                    <div className="calendar-grid">
                        {(() => {
                            // Generate last 30 days
                            const days = [];
                            for (let i = 29; i >= 0; i--) {
                                const d = new Date();
                                d.setDate(d.getDate() - i);
                                const dateStr = d.toISOString().split('T')[0];
                                const hasExpense = stats.dailyBreakdown?.find(day => day.date === dateStr);
                                const isSelected = selectedDate === dateStr;

                                days.push(
                                    <div
                                        key={dateStr}
                                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                        className={`calendar-day ${isSelected ? 'selected' : ''} ${hasExpense ? 'has-data' : ''}`}
                                    >
                                        <span className="cal-date">{d.getDate()}</span>
                                        <span className="cal-day">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                        {hasExpense && hasExpense.expense > 0 && (
                                            <div className="cal-amount" style={{ color: '#ef4444' }}>- {formatCurrency(hasExpense.expense)}</div>
                                        )}
                                    </div>
                                );
                            }
                            return days;
                        })()}
                    </div>
                </div>
            </div>

            <style>{`
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 8px;
                }
                @media (max-width: 768px) {
                  .calendar-grid {
                    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                  }
                }
                .calendar-day {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 8px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    min-height: 70px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .calendar-day:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }
                .calendar-day.selected {
                    background: #eff6ff;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px #3b82f6 inset;
                }
                .calendar-day.has-data {
                    background: #f0fdf4;
                    border-color: #86efac;
                }
                .calendar-day.selected.has-data {
                    background: #dbeafe;
                    border-color: #3b82f6;
                }
                .cal-date {
                    font-weight: 700;
                    font-size: 1.1rem;
                    color: #334155;
                }
                .cal-day {
                    font-size: 0.7rem;
                    color: #64748b;
                    text-transform: uppercase;
                }
                .cal-amount {
                    margin-top: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #ef4444;
                    background: white;
                    padding: 1px 6px;
                    border-radius: 4px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
            `}</style>

            {/* Expense Trend Chart */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <h3>📈 Monthly Expense Trend (Last 30 Days)</h3>
                </div>
                <div className="card-body" style={{ height: '350px', paddingBottom: '2rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.dailyBreakdown} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} minTickGap={15} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `₹${value}`} width={60} />
                            <RechartsTooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                formatter={(value) => [`₹${value}`, '']}
                            />
                            <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Category Breakdown Chart */}
            {stats.total > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <h3>📊 Category Breakdown</h3>
                    </div>
                    <div className="card-body">
                        <div className="category-chart">
                            {categories.map((cat, idx) => {
                                const val = stats[cat] || 0;
                                if (val === 0) return null;
                                const colors = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];
                                return (
                                    <div key={cat} className="category-bar-row">
                                        <span className="cat-label" style={{ textTransform: 'capitalize' }}>{cat}</span>
                                        <div className="cat-bar-container">
                                            <div
                                                className="cat-bar"
                                                style={{
                                                    width: `${(val / stats.total) * 100}%`,
                                                    background: colors[idx % colors.length]
                                                }}
                                            />
                                        </div>
                                        <span className="cat-value">{formatCurrency(val)} ({Math.round((val / stats.total) * 100)}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div className="search-filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                    className="filter-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{ flex: '1 1 200px' }}
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                </select>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: '2 1 300px' }}>
                    <input
                        type="date"
                        className="filter-input"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        placeholder="Start Date"
                        style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--navy-500)', fontWeight: '500' }}>to</span>
                    <input
                        type="date"
                        className="filter-input"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        placeholder="End Date"
                        style={{ flex: 1 }}
                    />
                    {(startDateFilter || endDateFilter) && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                            style={{ padding: '0.4rem 0.75rem' }}
                        >
                            Clear Dates
                        </button>
                    )}
                </div>

                <div style={{
                    marginLeft: 'auto',
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '0.6rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <span>Filtered Total:</span>
                    <span>{formatCurrency(filteredTotal)}</span>
                </div>
            </div>

            {/* Expenses List */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state">
                            <div className="loader"></div>
                        </div>
                    ) : filteredExpenses.length === 0 ? (
                        <div className="empty-state">
                            <IndianRupee size={48} />
                            <p>No expenses found</p>
                        </div>
                    ) : (
                        <div className="expenses-list">
                            {filteredExpenses.map(expense => (
                                <div key={expense.id} className="expense-item">
                                    <div className={`expense-item-icon ${expense.category}`}>
                                        {getCategoryIcon(expense.category)}
                                    </div>
                                    <div className="expense-item-details">
                                        <h4>{expense.title}</h4>
                                        <span className="expense-category">{expense.category}</span>
                                        <span className="expense-date">{expense.date}</span>
                                    </div>
                                    <div className="expense-item-amount">
                                        <span className="amount">{formatCurrency(expense.amount)}</span>
                                        {hasPermission('expenses', 'edit') && (
                                            <div className="expense-actions">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => { setEditingExpense(expense); setShowModal(true); }}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                {hasPermission('expenses', 'delete') && (
                                                    <button
                                                        className="btn-icon danger"
                                                        onClick={() => deleteExpense(expense.id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <ExpenseModal
                    expense={editingExpense}
                    onClose={() => { setShowModal(false); setEditingExpense(null); }}
                    onSuccess={() => {
                        fetchExpenses();
                        fetchCategories();
                    }}
                    categories={categories}
                    employees={employees}
                    generateAdvanceSlip={generateAdvanceSlip}
                />
            )}

            <style>{`
        .expense-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .expense-summary-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--navy-100);
        }
        
        .expense-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .expense-icon.total { background: #e0e7ff; color: var(--primary); }
        .expense-icon.supplies { background: #dbeafe; color: #2563eb; }
        .expense-icon.utilities { background: #fef3c7; color: #d97706; }
        .expense-icon.maintenance { background: #fee2e2; color: #dc2626; }
        
        .expense-content { flex: 1; }
        .expense-label { font-size: 0.875rem; color: var(--navy-500); display: block; }
        .expense-value { font-size: 1.25rem; font-weight: 700; }
        
        .expenses-list { display: flex; flex-direction: column; gap: 0.75rem; }
        
        .expense-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--navy-50);
          border-radius: var(--radius-md);
        }
        
        .expense-item-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .expense-item-icon.supplies { background: #dbeafe; color: #2563eb; }
        .expense-item-icon.utilities { background: #fef3c7; color: #d97706; }
        .expense-item-icon.maintenance { background: #fee2e2; color: #dc2626; }
        .expense-item-icon.rent { background: #d1fae5; color: #059669; }
        .expense-item-icon.misc { background: #e5e7eb; color: #6b7280; }
        
        .expense-item-details { flex: 1; }
        .expense-item-details h4 { margin: 0; font-size: 0.95rem; }
        .expense-item-details .expense-category { 
          font-size: 0.75rem; 
          text-transform: capitalize;
          color: var(--navy-500);
          margin-right: 0.5rem;
        }
        .expense-item-details .expense-date { font-size: 0.75rem; color: var(--navy-400); }
        
        .expense-item-amount { text-align: right; }
        .expense-item-amount .amount { font-weight: 700; display: block; }
        .expense-actions { display: flex; gap: 0.25rem; margin-top: 0.25rem; }
        
        .category-chart { display: flex; flex-direction: column; gap: 0.75rem; }
        .category-bar-row { display: grid; grid-template-columns: 100px 1fr 120px; gap: 0.75rem; align-items: center; }
        .cat-label { font-weight: 600; font-size: 0.875rem; }
        .cat-bar-container { height: 24px; background: var(--navy-100); border-radius: 4px; overflow: hidden; }
        .cat-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
        .cat-value { font-size: 0.8rem; color: var(--navy-600); text-align: right; }
        
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

          .header-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .expense-summary-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }

          .expense-summary-card {
            padding: 1rem;
            flex-direction: column;
            text-align: center;
            gap: 0.5rem;
          }

          .expense-icon {
            width: 40px;
            height: 40px;
          }

          .expense-value {
            font-size: 1.1rem;
          }

          .search-filter-bar {
            flex-direction: column;
            gap: 0.75rem;
          }

          .filter-select {
            width: 100%;
          }

          .expense-item {
            padding: 0.75rem;
          }

          .expense-item-icon {
            width: 32px;
            height: 32px;
            flex-shrink: 0;
          }

          .expense-item-details h4 {
            font-size: 0.875rem;
          }

          .expense-item-amount .amount {
            font-size: 0.9rem;
          }

          .category-bar-row {
            grid-template-columns: 1fr;
            gap: 0.25rem;
          }

          .cat-value {
            text-align: left;
            font-size: 0.75rem;
          }

          .modal-content {
            width: 95% !important;
            margin: 10px auto !important;
          }

          .form-row {
            flex-direction: column;
            gap: 0;
          }
        }

        /* Daily Breakdown Styles */
        .daily-list-container {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .daily-list-item {
            display: flex;
            align-items: center;
            padding: 0.75rem 1rem;
            background: var(--navy-50);
            border-radius: var(--radius-md);
        }

        .daily-date {
            font-weight: 600;
            color: var(--navy-700);
            min-width: 120px;
        }

        .daily-line-spacer {
            flex: 1;
            margin: 0 1rem;
            border-bottom: 1px dashed var(--navy-200);
        }

        .daily-amount {
            font-weight: 700;
            color: var(--navy-900);
        }
      `}</style>
        </div>
    );
};

const ExpenseModal = ({ expense, onClose, onSuccess, categories, employees, generateAdvanceSlip }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(expense?.category || '');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);

        const isAdvance = selectedCategory === 'advance salary';
        let employee = null;
        if (isAdvance) {
            employee = employees.find(emp => emp.id === selectedEmployeeId);
        }

        const data = {
            title: isAdvance ? `Advance Salary - ${employee?.displayName || 'Unknown'}` : formData.get('title'),
            amount: Number(formData.get('amount')),
            category: selectedCategory,
            date: formData.get('date'),
            paymentMode: formData.get('paymentMode'),
            note: formData.get('note'),
            updatedAt: serverTimestamp()
        };

        if (isAdvance && !selectedEmployeeId) {
            alert('Please select an employee for the advance salary.');
            setLoading(false);
            return;
        }

        try {
            let finalCategory = data.category;
            if (showNewCategory && newCategory.trim()) {
                const cat = newCategory.trim().toLowerCase();
                finalCategory = cat;
                // Update categories list in settings
                if (!categories.includes(cat)) {
                    await setDoc(doc(db, 'settings', 'expenses'), {
                        categories: [...categories, cat]
                    }, { merge: true });
                }
            }

            const finalData = { ...data, category: finalCategory };

            let docId = '';
            if (expense) {
                await updateDoc(doc(db, 'expenses', expense.id), finalData);
                docId = expense.id;
            } else {
                finalData.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'expenses'), finalData);
                docId = docRef.id;
            }

            // Also record in advances collection if it's an advance
            if (isAdvance && employee) {
                await addDoc(collection(db, 'advances'), {
                    employeeId: employee.id,
                    employeeName: employee.displayName,
                    amount: finalData.amount,
                    date: finalData.date,
                    note: finalData.note || 'Salary Advance (Recorded in Expenses)',
                    expenseId: docId,
                    isAdvance: true,
                    addedBy: user?.uid || 'admin',
                    createdAt: serverTimestamp()
                });

                // Generate Slip
                generateAdvanceSlip(employee, finalData.amount, finalData.date, finalData.note);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Error saving expense. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{expense ? 'Edit Expense' : 'Add Expense'}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {selectedCategory !== 'advance salary' && (
                            <div className="form-group">
                                <label>Title *</label>
                                <input name="title" defaultValue={expense?.title} required placeholder="Car wash shampoo" />
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Amount (₹) *</label>
                                <input name="amount" type="number" defaultValue={expense?.amount} required placeholder="500" />
                            </div>
                            <div className="form-group">
                                <label>Category *</label>
                                {!showNewCategory ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select
                                            name="category"
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            required
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select Category</option>
                                            <option value="advance salary">Advance Salary</option>
                                            {categories.filter(c => c !== 'advance salary').map(cat => (
                                                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setShowNewCategory(true)}
                                            style={{ padding: '0 0.75rem' }}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            placeholder="New category name"
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            autoFocus
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { setShowNewCategory(false); setNewCategory(''); }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedCategory === 'advance salary' && (
                            <div className="form-group">
                                <label>Select Employee *</label>
                                <select
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.displayName} ({emp.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Date *</label>
                                <input name="date" type="date" defaultValue={expense?.date || new Date().toISOString().split('T')[0]} required />
                            </div>
                            <div className="form-group">
                                <label>Payment Mode</label>
                                <select name="paymentMode" defaultValue={expense?.paymentMode || 'cash'}>
                                    <option value="cash">Cash</option>
                                    <option value="bank">Bank Transfer</option>
                                    <option value="upi">UPI</option>
                                    <option value="card">Card</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Note</label>
                            <textarea name="note" defaultValue={expense?.note} rows="2" placeholder="Additional details..." />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : (expense ? 'Update' : 'Add Expense')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Expenses;
