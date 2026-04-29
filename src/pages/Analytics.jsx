import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    IndianRupee,
    Users,
    Car,
    PieChart,
    Wallet,
    UserCheck,
    Calendar,
    Table,
    Filter,
    Layers,
    ChevronRight,
    MapPin
} from 'lucide-react';

const Analytics = () => {
    const [stats, setStats] = useState({
        todayRevenue: 0,
        yesterdayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        customRevenue: 0,
        totalBookings: 0,
        completedBookings: 0,
        pendingBookings: 0,
        cancelledBookings: 0,
        totalCustomers: 0,
        totalExpenses: 0,
        netProfit: 0,
        averageOrderValue: 0,
        growthRate: 0,
        carBookings: 0,
        bikeBookings: 0
    });
    const [serviceBreakdown, setServiceBreakdown] = useState([]);
    const [employeePerformance, setEmployeePerformance] = useState([]);
    const [monthlyComparison, setMonthlyComparison] = useState([]);
    const [dailyRevenue, setDailyRevenue] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [employees, setEmployees] = useState({});
    const [topLocations, setTopLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Pivot Table State
    const [pivotRow, setPivotRow] = useState('serviceName');
    const [pivotCol, setPivotCol] = useState('status');
    const [pivotMetric, setPivotMetric] = useState('revenue'); // 'revenue' or 'count'

    // Helper for local date string
    const toLocalDateStr = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().split('T')[0];
    };

    // Custom Date Range State - Default to Current Month
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        return toLocalDateStr(start);
    });
    const [endDate, setEndDate] = useState(() => toLocalDateStr(new Date()));
    const [isAllTime, setIsAllTime] = useState(false);

    useEffect(() => {
        fetchAnalytics();
    }, [startDate, endDate, isAllTime]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const today = new Date();
            const todayStr = toLocalDateStr(today);

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = toLocalDateStr(yesterday);

            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = toLocalDateStr(weekAgo);

            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthStartStr = toLocalDateStr(monthStart);

            // Fetch all bookings
            const bookingsRef = collection(db, 'bookings');
            const allBookingsSnap = await getDocs(bookingsRef);
            const bookingsData = allBookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllBookings(bookingsData);

            // Month-scoped bookings (used throughout for stats cards)
            const monthBookings = bookingsData.filter(b => b.bookingDate >= monthStartStr);

            // Fetch Employees for mapping
            const empSnap = await getDocs(query(collection(db, 'adminUsers'), where('status', '==', 'approved')));
            const empMap = {};
            empSnap.docs.forEach(doc => {
                const data = doc.data();
                empMap[doc.id] = data.displayName || data.email?.split('@')[0] || 'Unknown';
            });
            setEmployees(empMap);

            const bookingsForCalculations = bookingsData;

            // Helper to sum PAIDs
            const sumPaid = (bookings) => bookings.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0);

            // Today's revenue
            const todayRevenue = sumPaid(bookingsData.filter(b => b.bookingDate === todayStr));

            // Yesterday's revenue
            const yesterdayRevenue = sumPaid(bookingsData.filter(b => b.bookingDate === yesterdayStr));

            // Week revenue
            const weekRevenue = sumPaid(bookingsData.filter(b => b.bookingDate >= weekAgoStr));

            // Month revenue
            const monthRevenue = sumPaid(bookingsData.filter(b => b.bookingDate >= monthStartStr));

            // Custom Range Revenue
            const customRevenue = sumPaid(bookingsData.filter(b => isAllTime || (b.bookingDate >= startDate && b.bookingDate <= endDate)));

            // Fetch expenses
            const expensesSnap = await getDocs(collection(db, 'expenses'));
            const allExpenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const monthExpenses = allExpenses
                .filter(e => e.date >= monthStartStr)
                .reduce((sum, e) => sum + (e.amount || 0), 0);

            // Custom Range Expenses
            const customExpenses = allExpenses
                .filter(e => isAllTime || (e.date >= startDate && e.date <= endDate))
                .reduce((sum, e) => sum + (e.amount || 0), 0);

            // Today's Expenses
            const todayExpenses = allExpenses
                .filter(e => e.date === todayStr)
                .reduce((sum, e) => sum + (e.amount || 0), 0);
            

            // Service breakdown (Based on Custom Range)
            const rangeBookings = bookingsForCalculations.filter(b => isAllTime || (b.bookingDate >= startDate && b.bookingDate <= endDate));
            const serviceStats = {};
            rangeBookings.filter(b => b.status === 'completed').forEach(b => {
                const name = b.serviceName || 'Unknown';
                if (!serviceStats[name]) {
                    serviceStats[name] = { name, count: 0, revenue: 0 };
                }
                serviceStats[name].count++;
                serviceStats[name].revenue += Number(b.paidAmount) || 0;
            });
            const serviceList = Object.values(serviceStats)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);
            setServiceBreakdown(serviceList);

            // Location Stats (Frequent Bookings)
            const locationStats = {};
            rangeBookings.filter(b => b.location && b.location.trim() !== '' && b.status === 'completed').forEach(b => {
                const loc = b.location.trim();
                const name = loc.charAt(0).toUpperCase() + loc.slice(1);
                if (!locationStats[name]) {
                    locationStats[name] = { name: name, count: 0, revenue: 0 };
                }
                locationStats[name].count++;
                locationStats[name].revenue += Number(b.paidAmount || b.price) || 0;
            });
            const locationList = Object.values(locationStats)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            setTopLocations(locationList);

            // Employee performance (Dynamic Range)
            try {
                const empSnap = await getDocs(query(collection(db, 'adminUsers'), where('status', '==', 'approved')));
                const employees = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                let empStats = employees.map(emp => {
                    const empBookings = rangeBookings.filter(b => b.assignedEmployee === emp.id && b.status === 'completed');
                    return {
                        name: emp.displayName || emp.email?.split('@')[0] || 'Employee',
                        bookings: empBookings.length,
                        revenue: empBookings.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0)
                    };
                }).filter(emp => emp.bookings > 0);

                // Add unassigned workers metric
                const unassignedBookings = rangeBookings.filter(b => !b.assignedEmployee && b.status === 'completed');
                if (unassignedBookings.length > 0) {
                    empStats.push({
                        name: 'Unassigned',
                        bookings: unassignedBookings.length,
                        revenue: unassignedBookings.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0)
                    });
                }

                empStats = empStats.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                setEmployeePerformance(empStats);
            } catch (e) {
                console.log('Employee fetch error:', e);
            }

            // Last 6 months comparison
            const monthlyData = [];
            for (let i = 5; i >= 0; i--) {
                const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthStr = toLocalDateStr(date).slice(0, 7); // Uses correct timezone
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });

                const mRevenue = sumPaid(bookingsData.filter(b => b.bookingDate?.startsWith(monthStr)));
                const mExpenses = allExpenses
                    .filter(e => e.date?.startsWith(monthStr))
                    .reduce((sum, e) => sum + (e.amount || 0), 0);

                monthlyData.push({ month: monthName, revenue: mRevenue, expenses: mExpenses });
            }
            setMonthlyComparison(monthlyData);

            // Daily revenue trend (last 14 days)
            const dailyData = [];
            for (let i = 13; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = toLocalDateStr(date); // Uses correct timezone
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

                const dayRevenue = sumPaid(bookingsData.filter(b => b.bookingDate === dateStr));
                const dayBookings = bookingsData.filter(b => b.bookingDate === dateStr && b.status === 'completed').length;

                dailyData.push({ date: dateStr, label: dayLabel, revenue: dayRevenue, bookings: dayBookings });
            }
            setDailyRevenue(dailyData);

            // Misc Stats
            const completedCount = monthBookings.filter(b => b.status === 'completed').length;
            const pendingBookingsCount = monthBookings.filter(b => b.status === 'pending_confirmation' || b.status === 'confirmed').length;
            const cancelledBookingsCount = monthBookings.filter(b => b.status === 'cancelled').length;

            // Average order value
            const averageOrderValue = completedCount > 0 ? monthRevenue / completedCount : 0;

            // Growth rate vs previous month
            const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0];
            const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0];
            const prevMonthRevenue = sumPaid(bookingsData.filter(b => b.bookingDate >= prevMonthStartStr && b.bookingDate <= prevMonthEndStr));

            const growthRate = prevMonthRevenue > 0
                ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue * 100)
                : 0;

            const customersSnap = await getDocs(collection(db, 'customers'));

            setStats({
                todayRevenue,
                yesterdayRevenue,
                weekRevenue,
                monthRevenue,
                customRevenue,
                todayExpenses,
                customExpenses,
                totalBookings: monthBookings.length,
                completedBookings: completedCount,
                pendingBookings: pendingBookingsCount,
                cancelledBookings: cancelledBookingsCount,
                totalCustomers: customersSnap.size,
                totalExpenses: monthExpenses,
                netProfit: monthRevenue - monthExpenses,
                averageOrderValue,
                growthRate,
                carBookings: monthBookings.filter(b => ['hatchback', 'sedan', 'suv', 'luxury_suv'].includes(b.vehicleType)).length,
                bikeBookings: monthBookings.filter(b => ['scooter', 'bike', 'superbike'].includes(b.vehicleType)).length
            });

            // Log for debugging if empty
            if (bookingsData.length === 0) console.warn("Pivot: No bookings fetched from DB");
            if (rangeBookings.length === 0) console.warn("Pivot: Range filter returned 0 results", { startDate, endDate });
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const revenueChange = stats.yesterdayRevenue > 0
        ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100).toFixed(1)
        : 0;

    const maxMonthValue = Math.max(...monthlyComparison.map(m => Math.max(m.revenue, m.expenses)), 1);
    const totalServiceRevenue = serviceBreakdown.reduce((sum, s) => sum + s.revenue, 0);

    return (
        <div className="analytics-page">
            <div className="page-header">
                <div style={{ flex: 1 }}>
                    <h1><BarChart3 size={28} /> Analytics</h1>
                    <p className="subtitle">Business performance overview</p>
                </div>
                {/* Date Picker for Custom View */}
                <div className="date-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--navy-100)' }}>
                    <button
                        onClick={() => setIsAllTime(!isAllTime)}
                        style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            background: isAllTime ? 'var(--primary)' : 'transparent',
                            color: isAllTime ? 'white' : 'var(--navy-600)',
                            border: `1px solid ${isAllTime ? 'var(--primary)' : 'var(--navy-300)'}`,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '500'
                        }}
                    >
                        All Time
                    </button>
                    {!isAllTime && (
                        <>
                            <Calendar size={18} color="var(--navy-500)" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: 'var(--navy-700)' }}
                            />
                            <span style={{ color: 'var(--navy-400)' }}>to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', color: 'var(--navy-700)' }}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Revenue Metrics */}
            <div className="metrics-grid">
                {/* Custom Range Card (Dynamic) */}
                <div className="metric-card" style={{ border: '2px solid var(--primary)', background: '#f0fdfa' }}>
                    <div className="metric-card-icon success">
                        <IndianRupee size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value" style={{ color: 'var(--primary)' }}>{formatCurrency(stats.customRevenue)}</div>
                        <div className="metric-card-label">Revenue ({isAllTime ? 'All Time' : `${startDate} to ${endDate}`})</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon success">
                        <IndianRupee size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.todayRevenue)}</div>
                        <div className="metric-card-label">Today's Revenue</div>
                        <div className={`metric-card-trend ${revenueChange >= 0 ? 'up' : 'down'}`}>
                            {revenueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span>{Math.abs(revenueChange)}% vs yesterday</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon info">
                        <IndianRupee size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.weekRevenue)}</div>
                        <div className="metric-card-label">This Week</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon warning">
                        <Wallet size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.monthRevenue)}</div>
                        <div className="metric-card-label">This Month</div>
                        <div className={`metric-card-trend ${stats.growthRate >= 0 ? 'up' : 'down'}`}>
                            {stats.growthRate >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span>{Math.abs(stats.growthRate).toFixed(1)}% vs last month</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className={`metric-card-icon ${stats.netProfit >= 0 ? 'success' : 'danger'}`}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value" style={{ color: stats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                            {formatCurrency(stats.netProfit)}
                        </div>
                        <div className="metric-card-label">Net Profit (Month)</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon teal">
                        <Users size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{stats.totalBookings}</div>
                        <div className="metric-card-label">Bookings (Month)</div>
                    </div>
                </div>

                {/* New Card: Expenses with segments */}
                <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                    <div className="metric-card-icon danger">
                        <IndianRupee size={24} />
                    </div>
                    <div className="metric-card-body" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="metric-card-value" style={{ color: '#ef4444' }}>{formatCurrency(stats.totalExpenses)}</div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Monthly Expenses</div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #fee2e2' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(stats.todayExpenses || 0)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--navy-500)' }}>Today's Expenses</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(stats.customExpenses || 0)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--navy-500)' }}>Selected Range</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon info">
                        <Car size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{stats.carBookings}</div>
                        <div className="metric-card-label">Car Bookings (Month)</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon warning">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="18" r="4"/><circle cx="19" cy="18" r="4"/><path d="M5 14L9 7 L14 7 L19 14 M9 7L13 14 M12 6L14 3 M14 7L15 11"/></svg>
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{stats.bikeBookings}</div>
                        <div className="metric-card-label">Bike Bookings (Month)</div>
                    </div>
                </div>
            </div>

            {/* Daily Revenue Trend */}
            <div className="analytics-card full-width" style={{ marginBottom: '1.5rem' }}>
                <div className="analytics-card-header">
                    <h3><TrendingUp size={18} /> Daily Revenue Trend (Last 14 Days)</h3>
                </div>
                <div className="daily-chart-container">
                    <div className="daily-revenue-chart">
                        {dailyRevenue.map((day, i) => {
                            const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1);
                            return (
                                <div key={i} className="daily-bar-group">
                                    <div
                                        className="daily-bar"
                                        style={{ height: `${(day.revenue / maxDailyRevenue) * 100}%` }}
                                        title={`${day.label}: ${formatCurrency(day.revenue)}`}
                                    >
                                        {day.revenue > 0 && (
                                            <span className="daily-bar-value">₹{(day.revenue / 1000).toFixed(0)}k</span>
                                        )}
                                    </div>
                                    <span className="daily-label">{day.label.split(' ')[0]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Pivot Analysis Section */}
            <div className="analytics-card full-width pivot-section" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="analytics-card-header pivot-header">
                    <div className="title-area">
                        <h3><Layers size={18} /> Pivot Analysis</h3>
                        <p className="pivot-subtitle">Dynamic multidimensional data matrix</p>
                    </div>
                    <div className="pivot-controls">
                        <div className="control-group">
                            <label><Table size={14} /> Row Dimension</label>
                            <select value={pivotRow} onChange={(e) => setPivotRow(e.target.value)}>
                                <option value="serviceName">Service</option>
                                <option value="assignedEmployee">Employee</option>
                                <option value="bookingDate">Month</option>
                                <option value="status">Status</option>
                                <option value="paymentMethod">Payment</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label><Filter size={14} /> Column Dimension</label>
                            <select value={pivotCol} onChange={(e) => setPivotCol(e.target.value)}>
                                <option value="status">Status</option>
                                <option value="paymentMethod">Payment</option>
                                <option value="serviceName">Service</option>
                                <option value="assignedEmployee">Employee</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label><IndianRupee size={14} /> Metric</label>
                            <select value={pivotMetric} onChange={(e) => setPivotMetric(e.target.value)}>
                                <option value="revenue">Revenue (₹)</option>
                                <option value="count">Count (Bookings)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="pivot-container">
                    {(() => {
                        const rowData = {};
                        const colHeaders = new Set();

                        const getVal = (item, dim) => {
                            if (dim === 'assignedEmployee') return employees[item[dim]] || 'Unassigned';
                            if (dim === 'bookingDate') return item[dim] ? new Date(item[dim]).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : 'Unknown';
                            return item[dim] || 'N/A';
                        };

                        allBookings.filter(b => isAllTime || (b.bookingDate >= startDate && b.bookingDate <= endDate)).forEach(b => {
                            const rVal = getVal(b, pivotRow);
                            const cVal = getVal(b, pivotCol);
                            const mVal = pivotMetric === 'revenue' ? (Number(b.paidAmount) || 0) : 1;

                            if (!rowData[rVal]) rowData[rVal] = { total: 0 };
                            if (!rowData[rVal][cVal]) rowData[rVal][cVal] = 0;

                            rowData[rVal][cVal] += mVal;
                            rowData[rVal].total += mVal;
                            colHeaders.add(cVal);
                        });

                        const sortedCols = Array.from(colHeaders).sort();
                        const sortedRows = Object.keys(rowData).sort((a, b) => rowData[b].total - rowData[a].total);

                        if (sortedRows.length === 0) return <div className="empty-pivot">No data for selected range</div>;

                        return (
                            <div className="pivot-table-wrapper">
                                <table className="pivot-table">
                                    <thead>
                                        <tr>
                                            <th>{pivotRow.replace(/([A-Z])/g, ' $1').trim()} \ {pivotCol.replace(/([A-Z])/g, ' $1').trim()}</th>
                                            {sortedCols.map(c => <th key={c}>{c}</th>)}
                                            <th className="total-col">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.map(r => (
                                            <tr key={r}>
                                                <td className="row-label">{r}</td>
                                                {sortedCols.map(c => (
                                                    <td key={c}>
                                                        {pivotMetric === 'revenue' ? formatCurrency(rowData[r][c] || 0) : (rowData[r][c] || 0)}
                                                    </td>
                                                ))}
                                                <td className="total-cell">
                                                    {pivotMetric === 'revenue' ? formatCurrency(rowData[r].total) : rowData[r].total}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Charts Grid */}
            <div className="analytics-grid">
                {/* Revenue vs Expenses Chart */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><BarChart3 size={18} /> Revenue vs Expenses (6 Months)</h3>
                    </div>
                    <div className="chart-container">
                        <div className="comparison-chart">
                            {monthlyComparison.map((m, i) => (
                                <div key={i} className="comparison-bar-group">
                                    <div className="comparison-bars">
                                        <div
                                            className="comp-bar revenue"
                                            style={{ height: `${(m.revenue / maxMonthValue) * 100}%` }}
                                            title={`Revenue: ${formatCurrency(m.revenue)}`}
                                        />
                                        <div
                                            className="comp-bar expense"
                                            style={{ height: `${(m.expenses / maxMonthValue) * 100}%` }}
                                            title={`Expenses: ${formatCurrency(m.expenses)}`}
                                        />
                                    </div>
                                    <span className="comp-label">{m.month}</span>
                                </div>
                            ))}
                        </div>
                        <div className="chart-legend">
                            <span><span className="dot revenue"></span> Revenue</span>
                            <span><span className="dot expense"></span> Expenses</span>
                        </div>
                    </div>
                </div>

                {/* Service Breakdown */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><PieChart size={18} /> Service Revenue (Selected Range)</h3>
                    </div>
                    <div className="service-list">
                        {serviceBreakdown.length === 0 ? (
                            <p className="empty-text">No data available for this range</p>
                        ) : (
                            serviceBreakdown.map((service, i) => (
                                <div key={i} className="service-item">
                                    <div className="service-info">
                                        <strong>{service.name}</strong>
                                        <span>{service.count} bookings</span>
                                    </div>
                                    <div className="service-bar-container">
                                        <div
                                            className="service-bar"
                                            style={{ width: `${(service.revenue / totalServiceRevenue) * 100}%` }}
                                        />
                                    </div>
                                    <div className="service-revenue">{formatCurrency(service.revenue)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Employee Performance */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><UserCheck size={18} /> Employee Performance ({isAllTime ? 'All Time' : `${startDate} to ${endDate}`})</h3>
                    </div>
                    <div className="performance-list">
                        {employeePerformance.length === 0 ? (
                            <p className="empty-text">No employee data</p>
                        ) : (
                            employeePerformance.map((emp, i) => (
                                <div key={i} className="perf-item">
                                    <div className="perf-rank">#{i + 1}</div>
                                    <div className="perf-info">
                                        <strong>{emp.name}</strong>
                                        <span>{emp.bookings} bookings</span>
                                    </div>
                                    <div className="perf-revenue">{formatCurrency(emp.revenue)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Location Performance */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><MapPin size={18} /> Top Locations ({isAllTime ? 'All Time' : `${startDate} to ${endDate}`})</h3>
                    </div>
                    <div className="performance-list">
                        {topLocations.length === 0 ? (
                            <p className="empty-text">No location data</p>
                        ) : (
                            topLocations.map((loc, i) => (
                                <div key={i} className="perf-item">
                                    <div className="perf-rank" style={{ color: 'var(--info)' }}>#{i + 1}</div>
                                    <div className="perf-info">
                                        <strong>{loc.name}</strong>
                                        <span>{loc.count} bookings</span>
                                    </div>
                                    <div className="perf-revenue">{formatCurrency(loc.revenue)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .analytics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1.5rem;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .metric-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    padding: 1.25rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .metric-card-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .metric-card-icon.success { background: #ecfdf5; color: #10b981; }
                .metric-card-icon.info { background: #eff6ff; color: #3b82f6; }
                .metric-card-icon.warning { background: #fffbeb; color: #f59e0b; }
                .metric-card-icon.teal { background: #f0fdfa; color: #0d9488; }
                .metric-card-icon.danger { background: #fef2f2; color: #ef4444; }

                .metric-card-value { font-size: 1.5rem; font-weight: 700; color: var(--navy-900); }
                .metric-card-label { font-size: 0.85rem; color: var(--navy-500); }
                .metric-card-trend { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; margin-top: 4px; }
                .metric-card-trend.up { color: #10b981; }
                .metric-card-trend.down { color: #ef4444; }
                
                .analytics-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    padding: 1.25rem;
                    overflow: hidden;
                }
                
                .analytics-card-header { margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--navy-100); }
                .analytics-card-header h3 { font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; margin: 0; }
                
                .chart-container { 
                    height: 200px; 
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                .comparison-chart { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end; 
                    height: 160px; 
                    gap: 0.5rem; 
                    min-width: 400px;
                    padding-bottom: 10px;
                }
                
                .comparison-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; }
                .comparison-bars { display: flex; gap: 4px; height: 140px; align-items: flex-end; }
                .comp-bar { width: 16px; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; }
                .comp-bar.revenue { background: linear-gradient(180deg, #10b981, #059669); }
                .comp-bar.expense { background: linear-gradient(180deg, #f59e0b, #d97706); }
                .comp-label { font-size: 0.7rem; color: var(--navy-500); margin-top: 0.5rem; }
                .chart-legend { display: flex; justify-content: center; gap: 1.5rem; margin-top: 0.75rem; font-size: 0.75rem; }
                .chart-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
                .dot.revenue { background: #10b981; }
                .dot.expense { background: #f59e0b; }
                
                .service-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .service-item { display: grid; grid-template-columns: 1fr 100px 80px; gap: 0.75rem; align-items: center; }
                .service-info strong { display: block; font-size: 0.85rem; }
                .service-info span { font-size: 0.7rem; color: var(--navy-500); }
                .service-bar-container { height: 8px; background: var(--navy-100); border-radius: 4px; overflow: hidden; }
                .service-bar { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-dark)); border-radius: 4px; }
                .service-revenue { font-weight: 700; font-size: 0.85rem; text-align: right; color: var(--primary); }
                
                .performance-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .perf-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; background: var(--navy-50); border-radius: var(--radius-md); }
                .perf-rank { font-weight: 800; color: var(--primary); min-width: 30px; }
                .perf-info { flex: 1; }
                .perf-info strong { display: block; font-size: 0.85rem; }
                .perf-info span { font-size: 0.7rem; color: var(--navy-500); }
                .perf-revenue { font-weight: 700; color: #10b981; }
                
                .empty-text { text-align: center; color: var(--navy-400); padding: 2rem; }
                .daily-chart-container { 
                    padding: 1rem 0; 
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .daily-revenue-chart { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end; 
                    height: 150px; 
                    gap: 0.25rem; 
                    min-width: 500px;
                }
                .daily-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
                .daily-bar { width: 100%; max-width: 40px; background: linear-gradient(180deg, #6366f1, #4f46e5); border-radius: 4px 4px 0 0; min-height: 4px; position: relative; display: flex; align-items: flex-start; justify-content: center; transition: all 0.3s ease; }
                .daily-bar:hover { opacity: 0.8; }
                .daily-bar-value { font-size: 0.6rem; color: white; font-weight: 600; padding-top: 3px; white-space: nowrap; }
                .daily-label { font-size: 0.6rem; color: var(--navy-500); margin-top: 0.375rem; }

                /* Pivot styles */
                .pivot-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
                .pivot-subtitle { font-size: 0.75rem; color: var(--navy-500); margin: 2px 0 0 0; }
                .pivot-controls { display: flex; gap: 1rem; flex-wrap: wrap; }
                .control-group { display: flex; flex-direction: column; gap: 4px; }
                .control-group label { font-size: 0.7rem; font-weight: 700; color: var(--navy-400); text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
                .control-group select { padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid var(--navy-200); background: #f8fafc; font-size: 0.85rem; font-weight: 600; color: var(--navy-800); outline: none; transition: all 0.2s ease; }

                .pivot-table-wrapper { overflow-x: auto; margin-top: 1rem; background: #fafbfc; border-radius: 8px; border: 1px solid #f1f5f9; }
                .pivot-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .pivot-table th { background: #f1f5f9; text-align: left; padding: 0.75rem 1rem; color: var(--navy-700); font-weight: 700; white-space: nowrap; border-right: 1px solid #fff; }
                .pivot-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: var(--navy-800); }
                
                .row-label { font-weight: 700; color: var(--navy-900) !important; background: #fdfdfd; }
                .total-col { background: #f1f5f9 !important; text-align: right !important; }
                .total-cell { font-weight: 800; text-align: right; color: var(--primary) !important; background: #fdfdfd; }

                @media (max-width: 768px) {
                    .analytics-grid { grid-template-columns: 1fr; }
                    .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
                    .metric-card { padding: 1rem; flex-direction: column; text-align: center; gap: 0.5rem; }
                    .metric-card-value { font-size: 1.1rem; }
                    .metric-card-label { font-size: 0.7rem; }
                    
                    .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .date-filter { width: 100%; justify-content: space-between; overflow-x: auto; flex-wrap: nowrap; }
                    .date-filter input { width: 100px; font-size: 0.8rem !important; }
                    
                    .pivot-controls { display: grid; grid-template-columns: repeat(2, 1fr); width: 100%; }
                    .service-item { grid-template-columns: 1fr 1fr; }
                    .service-bar-container { display: none; }
                }

                @media (max-width: 480px) {
                    .metrics-grid { grid-template-columns: 1fr; }
                    .pivot-controls { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Analytics;
