import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard, CalendarDays, ClipboardList, Car, Users, UserCog,
    FileText, Receipt, BarChart3, Settings, LogOut, Menu, X,
    Package, CalendarCheck, Database, Shield, ShieldCheck, Globe,
    DollarSign, Building2, ClipboardCheck, Mail
} from 'lucide-react';
import { useState, useEffect } from 'react';
import LanguageCurrencySelector from './LanguageCurrencySelector';

const Sidebar = () => {
    const { logout, isAdmin, isSuperAdmin, hasPermission, userProfile } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const { t } = useTranslation();

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const navItems = [
        { path: '/',             icon: LayoutDashboard, labelKey: 'dashboard',   permission: 'dashboard' },
        // Super Admin only
        { path: '/tenants',      icon: Building2,       label: 'Company Tenants', permission: 'superadmin' },
        { path: '/platform-enquiries', icon: () => (
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
                <path fill="#34A853" d="M22 6v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6l10 7 10-7z"/>
                <path fill="#EA4335" d="M2 6l10 7 10-7V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v0z"/>
                <path fill="#FBBC05" d="M2 18l7.5-5.25L2 6v12z"/>
                <path fill="#FBBC05" d="M22 6l-7.5 6.75L22 18V6z"/>
            </svg>
        ), label: 'Enquiries', permission: 'superadmin' },
        { path: '/demo-access',  icon: Shield,          labelKey: 'super_admin', label: 'Demo Config',    permission: 'superadmin' },
        // Standard
        { path: '/bookings',     icon: ClipboardList,   labelKey: 'bookings',    permission: 'bookings' },
        { path: '/calendar',     icon: CalendarDays,    labelKey: 'calendar',    permission: 'bookings' },
        { path: '/inspections',  icon: ClipboardCheck,  label: 'Vehicle Inspections', permission: 'inspections' },
        { path: '/services',     icon: Car,             labelKey: 'services',    permission: 'services' },
        { path: '/amc-plans',    icon: ShieldCheck,     labelKey: 'amc_plans',   permission: 'amc' },
        { path: '/customers',    icon: Users,           labelKey: 'customers',   permission: 'customers' },
        { path: '/analytics',    icon: BarChart3,       labelKey: 'analytics',   permission: 'analytics' },
        { path: '/invoices',     icon: FileText,        labelKey: 'invoices',    permission: 'invoices' },
        { path: '/employees',    icon: UserCog,         labelKey: 'employees',   permission: 'employees' },
        { path: '/payroll',      icon: Receipt,         labelKey: 'payroll',     permission: 'payroll' },
        { path: '/attendance',   icon: CalendarCheck,   labelKey: 'attendance',  permission: 'attendance' },
        { path: '/expenses',     icon: DollarSign,      labelKey: 'expenses',    permission: 'expenses' },
        { path: '/materials',    icon: Package,         labelKey: 'materials',   permission: 'materials' },
        { path: '/crm-history',  icon: Database,        labelKey: 'crm_history', permission: 'crm' },
        { path: '/audit-log',    icon: Shield,          label: 'Audit Log',      permission: 'audit' },
        { path: '/settings',     icon: Settings,        labelKey: 'settings',    permission: 'settings' },
    ];

    const visibleNavItems = navItems.filter(item => {
        if (item.permission === 'superadmin') return isSuperAdmin;
        return hasPermission(item.permission, 'view') || hasPermission(item.permission);
    });

    // Show company logo + name (not Zwash branding for tenant users)
    const logoSrc = userProfile?.logoURL || '/logo.png';
    const brandName = isSuperAdmin
        ? 'ZWASH'
        : (userProfile?.companyName?.toUpperCase() || 'ZWASH');
    const roleLabel = isSuperAdmin
        ? (t('superadmin') || 'SUPER ADMIN').toUpperCase()
        : (t('erp_system') || 'ERP SYSTEM').toUpperCase();

    return (
        <>
            {/* Mobile Top Navigation Bar */}
            <header className="mobile-top-nav">
                <button className="mobile-burger-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
                    {mobileOpen ? <X size={24}/> : <Menu size={24}/>}
                </button>
                <div className="mobile-top-logo" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ background:'white', padding:'4px', borderRadius:'4px', display:'flex' }}>
                        <img src={logoSrc} alt="Logo" style={{ height:'24px', width:'auto' }}
                            onError={e => { e.target.src = '/logo.png'; }}/>
                    </div>
                    <span style={{ color:'white', fontWeight:800, fontSize:'0.9rem', letterSpacing:'0.05em' }}>
                        {brandName}
                    </span>
                </div>
                <div className="mobile-top-spacer"/>
            </header>

            {/* Desktop Sidebar */}
            <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header" style={{ display:'flex', alignItems:'center', gap:'12px', padding:'24px 20px' }}>
                    <div style={{ background:'white', padding:'6px', borderRadius:'8px', display:'flex', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', flexShrink:0 }}>
                        <img
                            src={logoSrc}
                            alt="Logo"
                            style={{ height:'32px', width:'auto', maxWidth:'80px', objectFit:'contain' }}
                            onError={e => { e.target.src = '/logo.png'; }}
                        />
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
                        <span style={{ color:'white', fontWeight:900, fontSize:'1rem', letterSpacing:'0.05em', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {brandName}
                        </span>
                        <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em' }}>
                            {roleLabel}
                        </span>
                    </div>
                </div>

                {/* Language & Currency Selector */}
                <div style={{ padding:'8px 12px' }}>
                    <LanguageCurrencySelector/>
                </div>

                <nav className="sidebar-nav">
                    {visibleNavItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            <item.icon size={20}/>
                            <span>{t(item.labelKey) || item.label || item.labelKey}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        {userProfile?.photoURL ? (
                            <img 
                                src={userProfile.photoURL} 
                                alt="" 
                                className="user-avatar"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                    const placeholder = e.target.parentNode.querySelector('.user-avatar-placeholder-hidden');
                                    if (placeholder) placeholder.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        {(!userProfile?.photoURL || userProfile?.photoURL) && (
                            <div 
                                className={`user-avatar-placeholder ${userProfile?.photoURL ? 'user-avatar-placeholder-hidden' : ''}`}
                                style={userProfile?.photoURL ? { display: 'none' } : {}}
                            >
                                {userProfile?.displayName?.charAt(0) || 'U'}
                            </div>
                        )}
                        <div className="user-details">
                            <span className="user-name">{userProfile?.displayName || t('user') || 'User'}</span>
                            <span className="user-role" style={{ textTransform:'capitalize' }}>
                                {userProfile?.role ? t(userProfile.role) || userProfile.role : ''}
                            </span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={logout}>
                        <LogOut size={16}/>
                        {t('logout') || 'Logout'}
                    </button>
                </div>
            </aside>

            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}/>
            )}
        </>
    );
};

export default Sidebar;
