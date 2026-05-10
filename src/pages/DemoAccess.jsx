import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection, addDoc, getDocs, doc, updateDoc,
    deleteDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { Globe, Plus, Trash2, Check, X, Clock, Mail, Building2, RefreshCw, Copy, CheckCheck, Zap, ShieldCheck, Crown, Edit3 } from 'lucide-react';
import { PLANS, PLAN_FEATURES } from '../contexts/AuthContext';

const DemoAccess = () => {
    const { isSuperAdmin, userProfile } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ 
        companyName: '', 
        email: '', 
        country: '', 
        expiresAt: '', 
        notes: '',
        logoURL: '',
        plan: PLANS.BASIC,
        permissions: PLAN_FEATURES[PLANS.BASIC].reduce((acc, feat) => ({ ...acc, [feat]: true }), {})
    });

    useEffect(() => { fetchClients(); }, []);

    const fetchClients = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'demoClients'), orderBy('createdAt', 'desc')));
            setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.email || !form.companyName) return;
        setSaving(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, 'demoClients', editingId), {
                    ...form,
                    email: form.email.toLowerCase().trim(),
                    updatedAt: serverTimestamp(),
                });
            } else {
                await addDoc(collection(db, 'demoClients'), {
                    ...form,
                    email: form.email.toLowerCase().trim(),
                    active: true,
                    loginCount: 0,
                    lastLogin: null,
                    addedBy: userProfile?.email,
                    createdAt: serverTimestamp(),
                });
            }
            setEditingId(null);
            setForm({ 
                companyName: '', 
                email: '', 
                country: '', 
                expiresAt: '', 
                notes: '',
                logoURL: '',
                plan: PLANS.BASIC,
                permissions: PLAN_FEATURES[PLANS.BASIC].reduce((acc, feat) => ({ ...acc, [feat]: true }), {})
            });
            setShowModal(false);
            fetchClients();
        } catch (e) { alert('Error: ' + e.message); }
        setSaving(false);
    };

    const handlePlanChange = (newPlan) => {
        setForm(prev => ({
            ...prev,
            plan: newPlan,
            permissions: PLAN_FEATURES[newPlan].reduce((acc, feat) => ({ ...acc, [feat]: true }), {})
        }));
    };

    const togglePermission = (module) => {
        setForm(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: !prev.permissions[module]
            }
        }));
    };

    const toggleActive = async (client) => {
        await updateDoc(doc(db, 'demoClients', client.id), { active: !client.active });
        fetchClients();
    };

    const handleEdit = (client) => {
        setEditingId(client.id);
        setForm({
            companyName: client.companyName || '',
            email: client.email || '',
            country: client.country || '',
            expiresAt: client.expiresAt || '',
            notes: client.notes || '',
            plan: client.plan || PLANS.BASIC,
            permissions: client.permissions || PLAN_FEATURES[client.plan || PLANS.BASIC].reduce((acc, feat) => ({ ...acc, [feat]: true }), {})
        });
        setShowModal(true);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove demo access for ${name}?`)) return;
        await deleteDoc(doc(db, 'demoClients', id));
        fetchClients();
    };

    const isExpired = (expiresAt) => expiresAt && new Date(expiresAt) < new Date();

    const stats = {
        total: clients.length,
        active: clients.filter(c => c.active && !isExpired(c.expiresAt)).length,
        expired: clients.filter(c => isExpired(c.expiresAt)).length,
        logins: clients.reduce((a, c) => a + (c.loginCount || 0), 0),
    };

    if (!isSuperAdmin) return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--navy-500)' }}>
            <Globe size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Super Admin access required</p>
        </div>
    );

    return (
        <div className="demo-access-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Globe size={26} /> Super Admin Control
                    </h1>
                    <p className="subtitle">Manage company demos and module-level permissions</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={fetchClients}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditingId(null); setShowModal(true); }}>
                        <Plus size={18} /> New Demo Account
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Companies', value: stats.total, color: '#3b82f6' },
                    { label: 'Active', value: stats.active, color: '#10b981' },
                    { label: 'Expired', value: stats.expired, color: '#ef4444' },
                    { label: 'Logins', value: stats.logins, color: '#f59e0b' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--navy-500)', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center' }}><div className="loader" /></div>
                ) : clients.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--navy-400)' }}>
                        <Globe size={48} style={{ marginBottom: 12, opacity: 0.25 }} />
                        <p style={{ margin: 0 }}>No demo clients yet. Add your first company above.</p>
                    </div>
                ) : (
                    <div className="table-container responsive-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company Branding</th>
                                    <th>Gmail Access</th>
                                    <th>Plan</th>
                                    <th>Features</th>
                                    <th>Expires</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map(c => {
                                    const expired = isExpired(c.expiresAt);
                                    const statusColor = !c.active ? '#6b7280' : expired ? '#ef4444' : '#10b981';
                                    const statusLabel = !c.active ? 'Disabled' : expired ? 'Expired' : 'Active';
                                    const activePermissionsCount = Object.values(c.permissions || {}).filter(Boolean).length;
                                    
                                    return (
                                        <tr key={c.id} style={{ opacity: !c.active ? 0.55 : 1 }}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                                                        {c.companyName?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.companyName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--navy-400)' }}>{c.country || 'N/A'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: '0.85rem' }}>{c.email}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                                                    {c.plan === PLANS.PREMIUM ? <Crown size={14} color="#f59e0b" /> : 
                                                     c.plan === PLANS.STANDARD ? <ShieldCheck size={14} color="#3b82f6" /> : 
                                                     <Zap size={14} color="#10b981" />}
                                                    <span style={{ textTransform: 'capitalize' }}>{c.plan || 'Basic'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-600)', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                                                    {activePermissionsCount} Modules
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ color: expired ? '#ef4444' : 'var(--navy-600)', fontSize: '0.83rem' }}>
                                                    {c.expiresAt || 'Lifetime'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${statusColor}18`, color: statusColor, fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button onClick={() => handleEdit(c)} className="btn btn-sm btn-secondary" title="Edit details & plan">
                                                        <Edit3 size={13} />
                                                    </button>
                                                    <button onClick={() => toggleActive(c)} className="btn btn-sm btn-secondary">
                                                        {c.active ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id, c.companyName)} className="btn btn-sm btn-danger">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: 650 }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={20} /> {editingId ? 'Edit' : 'New'} Demo Configuration</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAdd}>
                            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Company Branding Name *</label>
                                        <input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} required placeholder="e.g. Clean & Go Studio" />
                                    </div>
                                    <div className="form-group">
                                        <label>Company Gmail *</label>
                                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="client@gmail.com" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Company Logo URL (Optional)</label>
                                    <input value={form.logoURL} onChange={e => setForm({ ...form, logoURL: e.target.value })} placeholder="https://example.com/logo.png" />
                                </div>

                                <div className="form-group">
                                    <label>Subscription Plan</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
                                        {[
                                            { id: PLANS.BASIC, label: 'Basic', icon: Zap, color: '#10b981', desc: 'Core ERP' },
                                            { id: PLANS.STANDARD, label: 'Standard', icon: ShieldCheck, color: '#3b82f6', desc: 'Full Financials' },
                                            { id: PLANS.PREMIUM, label: 'Premium', icon: Crown, color: '#f59e0b', desc: 'Advanced Ops' }
                                        ].map(p => (
                                            <div 
                                                key={p.id}
                                                onClick={() => handlePlanChange(p.id)}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    border: `2px solid ${form.plan === p.id ? p.color : '#e2e8f0'}`,
                                                    background: form.plan === p.id ? `${p.color}08` : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <p.icon size={20} color={p.color} style={{ marginBottom: 4 }} />
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.label}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--navy-400)' }}>{p.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Access Permissions (Select Modules)</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, background: '#f8fafc', padding: 16, borderRadius: 12, marginTop: 8 }}>
                                        {Object.keys(form.permissions).map(module => (
                                            <label key={module} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', textTransform: 'capitalize' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={form.permissions[module]} 
                                                    onChange={() => togglePermission(module)}
                                                    style={{ width: 16, height: 16 }}
                                                />
                                                {module}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Country</label>
                                        <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="e.g. Switzerland" />
                                    </div>
                                    <div className="form-group">
                                        <label>Demo Expiry Date</label>
                                        <input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Creating...' : 'Grant Module Access'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{`
                .btn-danger { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
                .btn-danger:hover { background: #fee2e2; }
            `}</style>
        </div>
    );
};

export default DemoAccess;
