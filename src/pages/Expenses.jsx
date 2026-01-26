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

const Expenses = () => {
    const { hasPermission } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState(['supplies', 'utilities', 'maintenance', 'rent', 'misc']);
    const [stats, setStats] = useState({ total: 0 });
    const [selectedDate, setSelectedDate] = useState(null);

    useEffect(() => {
        fetchCategories();
        fetchExpenses();
    }, []);

    // ... (fetchCategories and fetchExpenses remain same) ...

    const filteredExpenses = expenses.filter(e => {
        if (selectedDate && e.date !== selectedDate) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        return true;
    });

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
                                        {hasExpense && (
                                            <div className="cal-amount">{formatCurrency(hasExpense.total)}</div>
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
            <div className="search-filter-bar">
                <select
                    className="filter-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                </select>
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
        
        @media (max-width: 600px) {
          .category-bar-row { grid-template-columns: 80px 1fr 80px; gap: 0.5rem; }
          .cat-value { font-size: 0.7rem; }
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
