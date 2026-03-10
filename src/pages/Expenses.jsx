import { useState, useEffect } from 'react';
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
    Download
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
    const [selectedDate, setSelectedDate] = useState(null);
    const [editingExpense, setEditingExpense] = useState(null);

    useEffect(() => {
        fetchCategories();
        fetchExpenses();
    }, []);

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

            // Calculate stats
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

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
            const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

            for (let i = 0; i < 30; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                dailyMap[dateStr] = { expense: 0, income: 0, monthLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
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

            // Fetch invoices for income
            try {
                const invSnapshot = await getDocs(query(collection(db, 'invoices')));
                invSnapshot.docs.forEach(doc => {
                    const inv = doc.data();
                    if (inv.paymentHistory && Array.isArray(inv.paymentHistory)) {
                        inv.paymentHistory.forEach(ph => {
                            if (ph.date) {
                                const dateStr = new Date(ph.date).toISOString().split('T')[0];
                                if (dailyMap[dateStr] !== undefined) {
                                    dailyMap[dateStr].income += Number(ph.amount) || 0;
                                }
                            }
                        });
                    } else if (inv.paidAmount > 0) {
                        let dateStr = null;
                        if (inv.createdAt && inv.createdAt.toDate) {
                            dateStr = inv.createdAt.toDate().toISOString().split('T')[0];
                        } else if (inv.createdAt) {
                            dateStr = new Date(inv.createdAt).toISOString().split('T')[0];
                        }
                        if (dateStr && dailyMap[dateStr] !== undefined) {
                            dailyMap[dateStr].income += Number(inv.paidAmount) || 0;
                        }
                    }
                });
            } catch (invErr) {
                console.error('Error fetching invoices for income chart', invErr);
            }

            statsCalc.dailyBreakdown = Object.entries(dailyMap)
                .map(([date, data]) => ({ date, expense: data.expense, income: data.income, name: data.monthLabel }))
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
            default: return <MoreVertical size={18} />;
        }
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

            {/* Summary Cards */}
            <div className="expense-summary-grid">
                <div className="expense-summary-card">
                    <div className="expense-icon total">
                        <IndianRupee size={24} />
                    </div>
                    <div className="expense-content">
                        <span className="expense-label">Today</span>
                        <span className="expense-value">{formatCurrency(stats.today)}</span>
                    </div>
                </div>
                <div className="expense-summary-card">
                    <div className="expense-icon utilities">
                        <IndianRupee size={24} />
                    </div>
                    <div className="expense-content">
                        <span className="expense-label">Yesterday</span>
                        <span className="expense-value">{formatCurrency(stats.yesterday)}</span>
                    </div>
                </div>
                <div className="expense-summary-card">
                    <div className="expense-icon maintenance">
                        <IndianRupee size={24} />
                    </div>
                    <div className="expense-content">
                        <span className="expense-label">This Week</span>
                        <span className="expense-value">{formatCurrency(stats.week)}</span>
                    </div>
                </div>
                <div className="expense-summary-card">
                    <div className="expense-icon supplies">
                        <IndianRupee size={24} />
                    </div>
                    <div className="expense-content">
                        <span className="expense-label">This Month</span>
                        <span className="expense-value">{formatCurrency(stats.month)}</span>
                    </div>
                </div>
                <div className="expense-summary-card" style={{ gridColumn: '1 / -1', background: 'var(--navy-900)', color: 'white', borderColor: 'var(--navy-800)' }}>
                    <div className="expense-icon" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                        <IndianRupee size={24} />
                    </div>
                    <div className="expense-content">
                        <span className="expense-label" style={{ color: 'var(--navy-200)' }}>Last 30 Days</span>
                        <span className="expense-value">{formatCurrency(stats.last30Days)}</span>
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
                                        {hasExpense && hasExpense.income > 0 && (
                                            <div className="cal-amount" style={{ color: '#10b981' }}>+ {formatCurrency(hasExpense.income)}</div>
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
                    color: #059669;
                    background: white;
                    padding: 1px 6px;
                    border-radius: 4px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
            `}</style>

            {/* Income vs Expense Chart */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <h3>📈 Income vs Expenses (Last 30 Days)</h3>
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
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
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

const ExpenseModal = ({ expense, onClose, onSuccess, categories }) => {
    const [loading, setLoading] = useState(false);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategory, setNewCategory] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);

        const data = {
            title: formData.get('title'),
            amount: Number(formData.get('amount')),
            category: formData.get('category'),
            date: formData.get('date'),
            paymentMode: formData.get('paymentMode'),
            note: formData.get('note'),
            updatedAt: serverTimestamp()
        };

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

            if (expense) {
                await updateDoc(doc(db, 'expenses', expense.id), finalData);
            } else {
                finalData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'expenses'), finalData);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving expense:', error);
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
                        <div className="form-group">
                            <label>Title *</label>
                            <input name="title" defaultValue={expense?.title} required placeholder="Car wash shampoo" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Amount (₹) *</label>
                                <input name="amount" type="number" defaultValue={expense?.amount} required placeholder="500" />
                            </div>
                            <div className="form-group">
                                <label>Category *</label>
                                {!showNewCategory ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select name="category" defaultValue={expense?.category} required style={{ flex: 1 }}>
                                            <option value="">Select Category</option>
                                            {categories.map(cat => (
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
