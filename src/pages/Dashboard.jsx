import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from 'firebase/firestore';
import {
    ClipboardList,
    CheckCircle,
    Clock,
    Trophy,
    Users,
    Car,
    Star,
    IndianRupee,
    AlertTriangle,
    Package,
    TrendingUp,
    Calendar
} from 'lucide-react';

const Dashboard = () => {
    const { userProfile, hasPermission } = useAuth();
    const [stats, setStats] = useState({
        pending: 0,
        confirmed: 0,
        inProgress: 0,
        completed: 0,
        todayRevenue: 0,
        totalCustomers: 0,
        activeServices: 0,
        avgRating: 4.5
    });
    const [recentBookings, setRecentBookings] = useState([]);
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [weeklyRevenue, setWeeklyRevenue] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [employeePerformance, setEmployeePerformance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [comparison, setComparison] = useState({ revenue: 0, bookings: 0 });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toLocaleDateString('en-CA');

            // Fetch all bookings for stats
            const bookingsRef = collection(db, 'bookings');
            const allBookingsSnapshot = await getDocs(bookingsRef);
            const allBookings = allBookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // SUPER ADMIN FETCH LOGIC
            if (userProfile?.role === 'superadmin') {
                const usersRef = collection(db, 'adminUsers');
                const adminsQuery = query(usersRef, where('role', '==', 'admin'));
                const adminsSnapshot = await getDocs(adminsQuery);
                const admins = adminsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setStats({
                    uniqueShops: admins.length,
                    totalAdmins: admins.length,
                    totalBookingsCount: allBookings.length,
                    shopList: admins
                });
                setLoading(false);
                return;
            }

            // Status counts (all time)
            let pending = 0, confirmed = 0, inProgress = 0, completed = 0;
            allBookings.forEach(booking => {
                switch (booking.status) {
                    case 'pending_confirmation': pending++; break;
                    case 'confirmed': confirmed++; break;
                    case 'in_progress': inProgress++; break;
                    case 'completed': completed++; break;
                }
            });

            // Revenue calculation helper
            const calculateRevenue = (bookings) => {
                return bookings.reduce((sum, b) => {
                    if (b.status === 'cancelled') return sum;
                    const amount = Number(b.paidAmount) || Number(b.price) || 0;
                    return sum + amount;
                }, 0);
            };

            // Today's revenue
            const todayBookings = allBookings.filter(b => b.bookingDate === todayStr);
            const todayRevenue = calculateRevenue(todayBookings);

            // Weekly revenue (last 7 days including today)
            const weekData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toLocaleDateString('en-CA');
                const dayBookings = allBookings.filter(b => b.bookingDate === dateStr && b.status !== 'cancelled');
                const dayRevenue = calculateRevenue(dayBookings);
                weekData.push({
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    date: dateStr,
                    revenue: dayRevenue,
                    bookings: dayBookings.length
                });
            }
            setWeeklyRevenue(weekData);

            // Yesterday comparison
            const yesterdayBookings = allBookings.filter(b => b.bookingDate === yesterdayStr);
            const yesterdayRevenue = calculateRevenue(yesterdayBookings);
            const revenueChange = yesterdayRevenue > 0
                ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
                : (todayRevenue > 0 ? 100 : 0);

            // Today's schedule
            const schedule = todayBookings
                .filter(b => ['confirmed', 'in_progress', 'pending_confirmation'].includes(b.status))
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            setTodaySchedule(schedule.slice(0, 5));

            // Fetch metadata
            const [customersSnap, servicesSnap, materialsSnap, empSnap] = await Promise.all([
                getDocs(collection(db, 'customers')),
                getDocs(query(collection(db, 'services'), where('isActive', '==', true))),
                getDocs(collection(db, 'materials')),
                getDocs(collection(db, 'adminUsers'))
            ]);

            // Real customer count logic (matching CRM exactly)
            const customerMap = new Map();
            // 1. Existing customer docs
            customersSnap.forEach(doc => {
                const data = doc.data();
                const key = data.phone || data.licensePlate;
                if (key) customerMap.set(key, true);
            });
            // 2. Customers from bookings
            allBookings.forEach(b => {
                const key = b.contactPhone || b.licensePlate;
                if (key) customerMap.set(key, true);
            });

            // Low stock
            const lowStock = materialsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(m => m.isActive && m.currentStock <= (m.reorderLevel || 10))
                .slice(0, 3);
            setLowStockItems(lowStock);

            // Employee performance
            const employees = empSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(e => e.role === 'employee' && e.status === 'approved');

            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
            const monthBookings = allBookings.filter(b => b.bookingDate >= monthStart && b.status === 'completed');

            const perfData = employees.map(emp => {
                const empBookings = monthBookings.filter(b => b.assignedEmployee === emp.id);
                return {
                    name: emp.displayName || emp.email?.split('@')[0] || 'Employee',
                    bookings: empBookings.length,
                    revenue: calculateRevenue(empBookings)
                };
            }).sort((a, b) => b.bookings - a.bookings).slice(0, 3);
            setEmployeePerformance(perfData);

            // Recent bookings
            const recent = allBookings
                .sort((a, b) => {
                    const aTime = a.createdAt?.seconds || 0;
                    const bTime = b.createdAt?.seconds || 0;
                    return bTime - aTime;
                })
                .slice(0, 5);
            setRecentBookings(recent);

            setStats({
                pending, confirmed, inProgress, completed, todayRevenue,
                totalCustomers: customerMap.size,
                activeServices: servicesSnap.size,
                avgRating: 4.5
            });

            setComparison({ revenue: Number(revenueChange), bookings: 0 });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getStatusBadge = (status) => {
        const badges = {
            'pending_confirmation': { class: 'badge-pending', label: 'Pending' },
            'confirmed': { class: 'badge-confirmed', label: 'Confirmed' },
            'in_progress': { class: 'badge-progress', label: 'In Progress' },
            'completed': { class: 'badge-completed', label: 'Completed' },
            'cancelled': { class: 'badge-cancelled', label: 'Cancelled' }
        };
        return badges[status] || { class: 'badge-pending', label: status };
    };

    const maxRevenue = Math.max(...weeklyRevenue.map(d => d.revenue), 1);

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    // SUPER ADMIN DASHBOARD VIEW
    if (userProfile?.role === 'superadmin') {
        return (
            <div className="dashboard-page">
                <div className="dashboard-header">
                    <div className="header-info">
                        <h1><Trophy size={28} /> Super Admin Overview</h1>
                        <p className="welcome-text">Network Statistics</p>
                    </div>
                </div>

                <div className="stats-grid-compact">
                    <div className="stat-card-compact purple">
                        <div className="stat-icon-sm"><TrendingUp size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{stats.uniqueShops || 0}</span>
                            <span className="stat-text">Total Shops</span>
                        </div>
                    </div>
                    <div className="stat-card-compact blue">
                        <div className="stat-icon-sm"><Users size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{stats.totalAdmins || 0}</span>
                            <span className="stat-text">Shop Admins</span>
                        </div>
                    </div>
                    <div className="stat-card-compact green">
                        <div className="stat-icon-sm"><Car size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{stats.totalBookingsCount || 0}</span>
                            <span className="stat-text">Total Bookings</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-widget" style={{ marginTop: '1.5rem' }}>
                    <div className="widget-header">
                        <h3><TrendingUp size={18} /> Shop Performance</h3>
                    </div>
                    <div className="table-container-compact">
                        <table className="data-table-compact">
                            <thead>
                                <tr>
                                    <th>Shop Name (Admin)</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.shopList?.map(shop => (
                                    <tr key={shop.id}>
                                        <td><strong>{shop.displayName}</strong></td>
                                        <td>{shop.email}</td>
                                        <td><span className="badge-sm badge-completed">Active</span></td>
                                        <td>
                                            <Link to="/superadmin" className="btn btn-sm btn-primary">Manage</Link>
                                        </td>
                                    </tr>
                                ))}
                                {(!stats.shopList || stats.shopList.length === 0) && (
                                    <tr><td colSpan="4" style={{ textAlign: 'center' }}>No shops found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div className="header-info">
                    <h1>Dashboard</h1>
                    <p className="welcome-text">Welcome back, {userProfile?.displayName || 'Admin'}!</p>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="dashboard-section-title">
                <ClipboardList size={18} /> Operational Status
            </div>
            <div className="stats-grid-modern">
                <div className="stat-card-modern pending">
                    <div className="stat-label">Pending Confirmation</div>
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-footer">Requires action</div>
                </div>
                <div className="stat-card-modern confirmed">
                    <div className="stat-label">Confirmed Bookings</div>
                    <div className="stat-value">{stats.confirmed}</div>
                    <div className="stat-footer">Scheduled soon</div>
                </div>
                <div className="stat-card-modern progress">
                    <div className="stat-label">Currently In-Progress</div>
                    <div className="stat-value">{stats.inProgress}</div>
                    <div className="stat-footer">Active on floor</div>
                </div>
                <div className="stat-card-modern completed">
                    <div className="stat-label">Completed Today</div>
                    <div className="stat-value">{todaySchedule.filter(b => b.status === 'completed').length}</div>
                    <div className="stat-footer">{stats.completed} Total All-time</div>
                </div>
            </div>

            <div className="dashboard-section-title" style={{ marginTop: '2rem' }}>
                <IndianRupee size={18} /> Financial Summary
            </div>
            <div className="stats-grid-compact">
                {hasPermission('finance') && (
                    <div className="stat-card-compact purple">
                        <div className="stat-icon-sm"><IndianRupee size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{formatCurrency(stats.todayRevenue)}</span>
                            <span className="stat-text">Today Revenue</span>
                        </div>
                        {comparison.revenue !== 0 && (
                            <span className={`trend ${comparison.revenue >= 0 ? 'up' : 'down'}`}>
                                {comparison.revenue >= 0 ? '↑' : '↓'} {Math.abs(comparison.revenue)}%
                            </span>
                        )}
                    </div>
                )}
                <div className="stat-card-compact indigo">
                    <div className="stat-icon-sm"><Users size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.totalCustomers}</span>
                        <span className="stat-text">Total Customers</span>
                    </div>
                </div>
                <div className="stat-card-compact pink">
                    <div className="stat-icon-sm"><Car size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.activeServices}</span>
                        <span className="stat-text">Active Services</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Weekly Revenue Chart - More prominence */}
                {hasPermission('finance') && (
                    <div className="dashboard-widget wide-widget">
                        <div className="widget-header">
                            <h3><TrendingUp size={18} /> Weekly Performance</h3>
                        </div>
                        <div className="chart-container-large">
                            <div className="revenue-chart">
                                {weeklyRevenue.map((day, i) => (
                                    <div key={i} className="revenue-bar-group">
                                        <div className="revenue-bar-container">
                                            <div
                                                className="revenue-bar"
                                                style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
                                            >
                                                <div className="tooltip">
                                                    {formatCurrency(day.revenue)}<br />
                                                    {day.bookings} bookings
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bar-axis-label">{day.day}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Today's Schedule */}
                <div className="dashboard-widget">
                    <div className="widget-header">
                        <h3><Calendar size={18} /> Today's Appointments</h3>
                        <Link to="/bookings" className="view-all-link">View All</Link>
                    </div>
                    {todaySchedule.length === 0 ? (
                        <div className="empty-widget">
                            <Clock size={24} />
                            <p>No appointments scheduled for today</p>
                        </div>
                    ) : (
                        <div className="schedule-list-modern">
                            {todaySchedule.map(booking => (
                                <div key={booking.id} className="schedule-item-modern">
                                    <div className="time-slot">{booking.startTime}</div>
                                    <div className="booking-details">
                                        <span className="service-name">{booking.serviceName}</span>
                                        <span className="car-plate">{booking.licensePlate}</span>
                                    </div>
                                    <span className={`status-dot ${booking.status}`}></span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Low Inventory Alerts */}
                {hasPermission('expenses') && lowStockItems.length > 0 && (
                    <div className="dashboard-widget alert-widget">
                        <div className="widget-header">
                            <h3><AlertTriangle size={18} /> Critical Stock Alerts</h3>
                        </div>
                        <div className="alert-list-modern">
                            {lowStockItems.map(item => (
                                <div key={item.id} className="alert-card">
                                    <div className="alert-icon-shell"><Package size={16} /></div>
                                    <div className="alert-content">
                                        <h4>{item.name}</h4>
                                        <p>Remaining: <span className="urgent">{item.currentStock} {item.unit}</span></p>
                                    </div>
                                    <Link to="/materials" className="reorder-link">Fix</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Employee Performance */}
                {hasPermission('employees') && employeePerformance.length > 0 && (
                    <div className="dashboard-widget">
                        <div className="widget-header">
                            <h3><Users size={18} /> Top Performers</h3>
                            <span className="month-label">{new Date().toLocaleString('default', { month: 'long' })}</span>
                        </div>
                        <div className="perf-list-modern">
                            {employeePerformance.map((emp, i) => (
                                <div key={i} className="perf-card">
                                    <div className="perf-rank">{i + 1}</div>
                                    <div className="perf-info">
                                        <strong>{emp.name}</strong>
                                        <span>{emp.bookings} jobs completed</span>
                                    </div>
                                    <div className="perf-value">{formatCurrency(emp.revenue)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Bookings Table */}
            <div className="bookings-section-modern">
                <div className="section-header">
                    <h2>Recent Activity</h2>
                    <Link to="/bookings" className="btn-text">View History →</Link>
                </div>
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Ref ID</th>
                                <th>Service Type</th>
                                <th>Date / Time</th>
                                <th className="desktop-only text-center">Amount</th>
                                <th className="text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBookings.map(booking => {
                                const badge = getStatusBadge(booking.status);
                                return (
                                    <tr key={booking.id}>
                                        <td className="ref-cell" data-label="Ref">{booking.bookingReference || booking.id.slice(0, 8)}</td>
                                        <td className="service-cell" data-label="Service">{booking.serviceName}</td>
                                        <td className="date-time-cell" data-label="Date & Time">
                                            <span>{booking.bookingDate}</span>
                                            <small>{booking.startTime}</small>
                                        </td>
                                        <td className="price-cell desktop-only text-center" data-label="Amount">{formatCurrency(booking.price || 0)}</td>
                                        <td className="text-center" data-label="Status"><span className={`status-badge ${booking.status}`}>{badge.label}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <style>{`
                .dashboard-page {
                    padding: 0.5rem;
                    padding-bottom: 5rem;
                }

                .dashboard-section-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--navy-800);
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }

                /* Modern Stats Grid */
                .stats-grid-modern {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card-modern {
                    background: white;
                    padding: 1.25rem;
                    border-radius: var(--radius-lg);
                    border-left: 5px solid #e2e8f0;
                    box-shadow: var(--shadow-sm);
                    transition: transform 0.2s ease;
                }

                .stat-card-modern:hover {
                    transform: translateY(-3px);
                }

                .stat-card-modern.pending { border-color: #f59e0b; }
                .stat-card-modern.confirmed { border-color: #3b82f6; }
                .stat-card-modern.progress { border-color: #8b5cf6; }
                .stat-card-modern.completed { border-color: #10b981; }

                .stat-label {
                    font-size: 0.85rem;
                    color: var(--navy-500);
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .stat-value {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: var(--navy-900);
                }

                .stat-footer {
                    font-size: 0.75rem;
                    color: var(--navy-400);
                    margin-top: 0.5rem;
                }

                /* Compact Stats Row */
                .stats-grid-compact {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card-compact {
                    background: white;
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--navy-50);
                    position: relative;
                }

                .stat-icon-sm {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .purple .stat-icon-sm { background: #f5f3ff; color: #7c3aed; }
                .indigo .stat-icon-sm { background: #eef2ff; color: #4f46e5; }
                .pink .stat-icon-sm { background: #fdf2f8; color: #db2777; }
                .blue .stat-icon-sm { background: #eff6ff; color: #2563eb; }
                .green .stat-icon-sm { background: #f0fdf4; color: #16a34a; }

                .stat-number {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--navy-900);
                    line-height: 1.2;
                }

                .stat-text {
                    font-size: 0.8rem;
                    color: var(--navy-500);
                    font-weight: 600;
                }

                .trend {
                    position: absolute;
                    top: 1.25rem;
                    right: 1.25rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.2rem 0.5rem;
                    border-radius: 20px;
                }
                .trend.up { background: #d1fae5; color: #065f46; }
                .trend.down { background: #fee2e2; color: #991b1b; }

                /* Charts */
                .wide-widget {
                    grid-column: span 2;
                }

                @media (max-width: 1024px) {
                    .wide-widget { grid-column: span 1; }
                }

                .chart-container-large {
                    padding: 1.5rem;
                    background: #f8fafc;
                    height: 250px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                .revenue-chart {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    height: 100%;
                    gap: 1rem;
                    min-width: 450px; /* Ensure chart doesn't squish too much */
                }

                .revenue-bar-group {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                }

                .revenue-bar-container {
                    flex: 1;
                    width: 100%;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    position: relative;
                }

                .revenue-bar {
                    width: 40%;
                    min-width: 30px;
                    background: linear-gradient(to top, var(--primary), #34d399);
                    border-radius: 6px 6px 0 0;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .revenue-bar:hover {
                    filter: brightness(1.1);
                    cursor: pointer;
                }

                .revenue-bar:hover .tooltip {
                    opacity: 1;
                    visibility: visible;
                }

                .tooltip {
                    position: absolute;
                    top: -45px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--navy-900);
                    color: white;
                    padding: 0.4rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    white-space: nowrap;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.2s ease;
                    z-index: 10;
                }

                .bar-axis-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--navy-500);
                    margin-top: 0.75rem;
                }

                /* Modern Lists */
                .schedule-item-modern {
                    display: flex;
                    align-items: center;
                    padding: 0.9rem 1rem;
                    background: white;
                    border-radius: 10px;
                    margin-bottom: 0.6rem;
                    border: 1px solid #f1f5f9;
                }

                .time-slot {
                    background: #eff6ff;
                    color: #2563eb;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 0.75rem;
                    margin-right: 1rem;
                }

                .booking-details {
                    flex: 1;
                }

                .service-name {
                    display: block;
                    font-weight: 600;
                    font-size: 0.85rem;
                }

                .car-plate {
                    font-size: 0.75rem;
                    color: var(--navy-400);
                }

                .status-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                .status-dot.in_progress { background: #8b5cf6; }
                .status-dot.confirmed { background: #3b82f6; }
                .status-dot.pending_confirmation { background: #f59e0b; }

                /* Performance */
                .perf-list-modern {
                    padding: 1rem;
                }

                .perf-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.75rem;
                    border-bottom: 1px solid #f1f5f9;
                }

                .perf-rank {
                    width: 28px;
                    height: 28px;
                    background: #fdf2f8;
                    color: #db2777;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-weight: 800;
                    font-size: 0.8rem;
                }

                .perf-info { flex: 1; }
                .perf-info strong { display: block; font-size: 0.85rem; }
                .perf-info span { font-size: 0.75rem; color: var(--navy-400); }
                .perf-value { font-weight: 700; font-size: 0.9rem; color: var(--primary); }

                /* Recent Activity Table */
                .bookings-section-modern {
                    margin-top: 2rem;
                    background: white;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    overflow: hidden;
                }

                .section-header {
                    padding: 1.25rem 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--navy-50);
                }

                .section-header h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
                .btn-text { font-size: 0.85rem; color: var(--primary); font-weight: 600; text-decoration: none; }

                .table-responsive {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                .modern-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .modern-table th {
                    background: #f8fafc;
                    text-align: left;
                    padding: 0.75rem 1.25rem;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--navy-500);
                    white-space: nowrap;
                }

                .modern-table td {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.85rem;
                    white-space: nowrap;
                }

                .date-time-cell span { display: block; font-weight: 600; }
                .date-time-cell small { color: var(--navy-400); }
                .price-cell { font-weight: 700; color: var(--navy-900); }

                .status-badge {
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .status-badge.completed { background: #d1fae5; color: #065f46; }
                .status-badge.in_progress { background: #ede9fe; color: #5b21b6; }
                .status-badge.confirmed { background: #dbeafe; color: #1e40af; }
                .status-badge.pending_confirmation { background: #ffedd5; color: #9a3412; }

                @media (max-width: 768px) {
                    .stats-grid-modern { 
                        grid-template-columns: repeat(2, 1fr); 
                        gap: 0.75rem;
                    }
                    
                    .stat-card-modern {
                        padding: 1rem;
                    }

                    .stat-value {
                        font-size: 1.4rem;
                    }

                    .revenue-bar { width: 60%; }
                    
                    /* Modern Table Response */
                    .modern-table thead {
                        display: none;
                    }

                    .modern-table tr {
                        display: block;
                        margin-bottom: 1rem;
                        border: 1px solid var(--navy-100);
                        border-radius: 12px;
                        padding: 0.5rem;
                        background: white;
                    }

                    .modern-table td {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0.6rem 0.75rem !important;
                        border-bottom: 1px solid #f1f5f9;
                        font-size: 0.9rem;
                        white-space: normal;
                        text-align: right !important;
                    }

                    .modern-table td:last-child {
                        border-bottom: none;
                    }

                    .modern-table td::before {
                        content: attr(data-label);
                        font-weight: 700;
                        color: var(--navy-500);
                        font-size: 0.75rem;
                        text-transform: uppercase;
                        margin-right: 1rem;
                        text-align: left;
                    }
                    
                    .desktop-only { display: none; }
                    .text-center { text-align: left !important; }
                }

                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .dashboard-widget {
                    background: white;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                }
                
                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid var(--navy-100);
                    background: var(--navy-50);
                }
                
                .widget-header h3 {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--navy-800);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                }
                
                .widget-header .subtitle {
                    font-size: 0.75rem;
                    color: var(--navy-500);
                }
                
                .chart-container {
                    height: 140px;
                    display: flex;
                    align-items: flex-end;
                    padding: 1rem;
                }
                
                .bar-chart {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    width: 100%;
                    height: 100%;
                    gap: 0.25rem;
                }
                
                .bar-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                }
                
                .bar {
                    width: 100%;
                    max-width: 36px;
                    background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%);
                    border-radius: 4px 4px 0 0;
                    min-height: 4px;
                    position: relative;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                
                .bar:hover {
                    opacity: 0.8;
                }
                
                .bar-value {
                    font-size: 0.6rem;
                    color: white;
                    font-weight: 600;
                    padding-top: 3px;
                    white-space: nowrap;
                }
                
                .bar-label {
                    font-size: 0.65rem;
                    color: var(--navy-500);
                    margin-top: 0.375rem;
                }
                
                /* Modern Lists & Alerts */
                .alert-list-modern, .schedule-list-modern {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    padding: 1.25rem;
                }

                .alert-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.85rem;
                    background: white;
                    border-radius: 10px;
                    border: 1px solid #fed7aa;
                    transition: all 0.2s ease;
                }

                .alert-card:hover { border-color: #fca5a5; transform: translateX(4px); }

                .alert-icon-shell {
                    width: 32px;
                    height: 32px;
                    background: #fff7ed;
                    color: #ea580c;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    flex-shrink: 0;
                }

                .alert-content { flex: 1; min-width: 0; }
                .alert-content h4 { font-size: 0.85rem; font-weight: 700; color: var(--navy-900); margin: 0; }
                .alert-content p { font-size: 0.75rem; color: var(--navy-500); margin: 2px 0 0 0; }
                .urgent { color: #dc2626; font-weight: 700; }

                .reorder-link {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--primary);
                    text-decoration: none;
                    background: var(--navy-50);
                    padding: 0.25rem 0.6rem;
                    border-radius: 4px;
                }

                .empty-widget {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem 1.5rem;
                    text-align: center;
                    color: var(--navy-400);
                    gap: 1rem;
                }

                .empty-widget p { font-size: 0.9rem; margin: 0; font-weight: 500; }

                @media (max-width: 1024px) {
                    .wide-widget { grid-column: span 1; }
                }

                @media (max-width: 768px) {
                    .stats-grid-modern { grid-template-columns: repeat(2, 1fr); }
                    .stats-grid-compact { grid-template-columns: 1fr; }
                    .revenue-bar { width: 60%; }
                    .modern-table th:nth-child(4), .modern-table td:nth-child(4) { display: none; }
                }
                
                @media (max-width: 480px) {
                    .schedule-item, .alert-item, .performance-item {
                        padding: 0.5rem;
                    }
                    
                    .schedule-time {
                        font-size: 0.75rem;
                        min-width: 40px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
