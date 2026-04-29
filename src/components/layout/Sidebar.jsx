import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    Car,
    Users,
    UserCog,
    IndianRupee,
    FileText,
    Receipt,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    Package,
    CalendarCheck,
    Database,
    Shield,
    ShieldCheck,
    Globe
} from 'lucide-react';
import { useState, useEffect } from 'react';

const Sidebar = () => {
    const { userProfile, logout, hasPermission, isAdmin } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
        { path: '/superadmin', icon: Shield, label: 'Super Admin', permission: 'superadmin' },
        { path: '/bookings', icon: ClipboardList, label: 'Bookings', permission: 'bookings' },
        { path: '/calendar', icon: CalendarDays, label: 'Calendar', permission: 'bookings' },
        { path: '/services', icon: Car, label: 'Services', permission: 'services' },
        { path: '/amc-plans', icon: ShieldCheck, label: 'AMC Plans', permission: 'amc' },
        { path: '/customers', icon: Users, label: 'Customers', permission: 'customers' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics', permission: 'analytics' },
        { path: '/invoices', icon: FileText, label: 'Invoices', permission: 'invoices' },
        { path: '/employees', icon: UserCog, label: 'Employees', permission: 'employees' },
        { path: '/payroll', icon: Receipt, label: 'Payroll', permission: 'payroll' },
        { path: '/attendance', icon: CalendarCheck, label: 'Attendance', permission: 'attendance' },
        { path: '/expenses', icon: IndianRupee, label: 'Expenses', permission: 'expenses' },
        { path: '/materials', icon: Package, label: 'Materials', permission: 'materials' },
        { path: '/crm-history', icon: Database, label: 'CRM History', permission: 'crm' },
        { path: '/audit-log', icon: Shield, label: 'Audit Log', permission: 'audit' },
        { path: '/settings', icon: Settings, label: 'Settings', permission: 'settings' },
    ];

    const adminOnlyItems = isAdmin ? [
        { path: '/demo-access', icon: Globe, label: 'Demo Access', permission: null }
    ] : [];

    const visibleNavItems = [
        ...navItems.filter(item => hasPermission(item.permission, 'view') || hasPermission(item.permission)),
        ...adminOnlyItems
    ];

    const handleLogout = async () => {
        await logout();
    };

    return (
        <>
            {/* Mobile Top Navigation Bar */}
            <header className="mobile-top-nav">
                <button
                    className="mobile-burger-btn"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Open menu"
                >
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <div className="mobile-top-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: 'white', padding: '2px 4px', borderRadius: '4px', display: 'flex' }}>
                        <img src="/detail.png" alt="Zwash Demo Logo" style={{ height: '20px', width: 'auto' }} />
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: '600' }}>Zwash Demo</span>
                </div>
                <div className="mobile-top-spacer" />
            </header>

            {/* Desktop Sidebar */}
            <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'white', padding: '4px', borderRadius: '6px', display: 'flex' }}>
                        <img src="/detail.png" alt="Zwash Demo Logo" style={{ height: '24px', width: 'auto' }} />
                    </div>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Zwash Demo</h2>
                </div>

                <nav className="sidebar-nav">
                    {visibleNavItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        {userProfile?.photoURL ? (
                            <img src={userProfile.photoURL} alt="" className="user-avatar" />
                        ) : (
                            <div className="user-avatar-placeholder">
                                {userProfile?.displayName?.charAt(0) || 'U'}
                            </div>
                        )}
                        <div className="user-details">
                            <span className="user-name">{userProfile?.displayName || 'User'}</span>
                            <span className="user-role">{userProfile?.role}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Sidebar Overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}
        </>
    );
};

export default Sidebar;
