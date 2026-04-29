import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection, addDoc, getDocs, doc, updateDoc,
    deleteDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { Globe, Plus, Trash2, Check, X, Clock, Mail, Building2, RefreshCw, Copy, CheckCheck } from 'lucide-react';

const DemoAccess = () => {
    const { isAdmin, userProfile } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(null);
    const [form, setForm] = useState({ companyName: '', email: '', country: '', expiresAt: '', notes: '' });

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
            await addDoc(collection(db, 'demoClients'), {
                ...form,
                email: form.email.toLowerCase().trim(),
                active: true,
                loginCount: 0,
                lastLogin: null,
                addedBy: userProfile?.email,
                createdAt: serverTimestamp(),
            });
            setForm({ companyName: '', email: '', country: '', expiresAt: '', notes: '' });
            setShowModal(false);
            fetchClients();
        } catch (e) { alert('Error: ' + e.message); }
        setSaving(false);
    };

    const toggleActive = async (client) => {
        await updateDoc(doc(db, 'demoClients', client.id), { active: !client.active });
        fetchClients();
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove demo access for ${name}?`)) return;
        await deleteDoc(doc(db, 'demoClients', id));
        fetchClients();
    };

    const copyEmail = (email) => {
        navigator.clipboard.writeText(email);
        setCopied(email);
        setTimeout(() => setCopied(null), 2000);
    };

    const isExpired = (expiresAt) => expiresAt && new Date(expiresAt) < new Date();

    const stats = {
        total: clients.length,
        active: clients.filter(c => c.active && !isExpired(c.expiresAt)).length,
        expired: clients.filter(c => isExpired(c.expiresAt)).length,
        logins: clients.reduce((a, c) => a + (c.loginCount || 0), 0),
    };

    if (!isAdmin) return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--navy-500)' }}>
            <Globe size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Admin access required</p>
        </div>
    );

    return (
        <div className="demo-access-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Globe size={26} /> Demo Client Access
                    </h1>
                    <p className="subtitle">Manage which companies can access the demo via Google login</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={fetchClients}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> Add Company
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total Companies', value: stats.total, color: '#3b82f6' },
                    { label: 'Active Access', value: stats.active, color: '#10b981' },
                    { label: 'Expired', value: stats.expired, color: '#ef4444' },
                    { label: 'Total Logins', value: stats.logins, color: '#f59e0b' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--navy-500)', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* How it works info box */}
            <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Globe size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e40af', marginBottom: 4 }}>How Demo Access Works</div>
                    <div style={{ fontSize: '0.82rem', color: '#3b82f6', lineHeight: 1.6 }}>
                        Add a company's Gmail address below. When they visit your demo URL and click <strong>"Continue with Google"</strong> using that exact Gmail, they will automatically get access as a <strong>Manager-level demo user</strong>. No passwords, no manual approval — instant access with optional expiry date.
                    </div>
                </div>
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
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th>Gmail Access</th>
                                    <th>Country</th>
                                    <th>Expires</th>
                                    <th>Logins</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map(c => {
                                    const expired = isExpired(c.expiresAt);
                                    const statusColor = !c.active ? '#6b7280' : expired ? '#ef4444' : '#10b981';
                                    const statusLabel = !c.active ? 'Disabled' : expired ? 'Expired' : 'Active';
                                    return (
                                        <tr key={c.id} style={{ opacity: !c.active ? 0.55 : 1 }}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                                                        {c.companyName?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.companyName}</div>
                                                        {c.notes && <div style={{ fontSize: '0.75rem', color: 'var(--navy-400)' }}>{c.notes}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{c.email}</span>
                                                    <button onClick={() => copyEmail(c.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-400)', padding: 2, display: 'flex' }}>
                                                        {copied === c.email ? <CheckCheck size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td>{c.country || <span style={{ color: 'var(--navy-300)' }}>—</span>}</td>
                                            <td>
                                                {c.expiresAt ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: expired ? '#ef4444' : 'var(--navy-600)', fontSize: '0.83rem' }}>
                                                        <Clock size={13} /> {c.expiresAt}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--navy-300)' }}>Unlimited</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{c.loginCount || 0}</td>
                                            <td>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${statusColor}18`, color: statusColor, fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                                                    {statusLabel === 'Active' ? <Check size={11} /> : <X size={11} />}
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        onClick={() => toggleActive(c)}
                                                        className={`btn btn-sm ${c.active ? 'btn-secondary' : 'btn-primary'}`}
                                                        title={c.active ? 'Disable access' : 'Enable access'}
                                                    >
                                                        {c.active ? <X size={13} /> : <Check size={13} />}
                                                        {c.active ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id, c.companyName)} className="btn btn-sm" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>
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
                    <div className="modal-content" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={20} /> Add Demo Company</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAdd}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Company / Client Name *</label>
                                    <input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} required placeholder="e.g. AutoGlanz GmbH, Carrosserie Italia..." />
                                </div>
                                <div className="form-group">
                                    <label><Mail size={13} style={{ verticalAlign: 'middle' }} /> Gmail Address (for Google login) *</label>
                                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="company@gmail.com or person@gmail.com" />
                                    <small style={{ color: 'var(--navy-400)', fontSize: '0.75rem' }}>This exact Gmail will be granted demo access when they sign in.</small>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Country</label>
                                        <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="Germany, Italy, India..." />
                                    </div>
                                    <div className="form-group">
                                        <label><Clock size={13} style={{ verticalAlign: 'middle' }} /> Access Expires</label>
                                        <input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes (internal)</label>
                                    <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Met at AutoExpo 2025, interested in premium plan..." />
                                </div>
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem', color: '#166534' }}>
                                    ✓ Once added, the company can immediately sign in via Google. No password needed.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Adding...' : 'Grant Access'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoAccess;
