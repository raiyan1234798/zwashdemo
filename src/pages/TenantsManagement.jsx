import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, PLANS, PLAN_FEATURES, PLAN_USER_LIMITS, ROLES } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    serverTimestamp, query, orderBy, where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
    Globe, Plus, Trash2, Mail, Building2, RefreshCw,
    Zap, ShieldCheck, Crown, Edit3, Users, ChevronDown, ChevronUp,
    UserPlus, AlertCircle, Copy, CheckCheck, ExternalLink
} from 'lucide-react';
import LogoUploader from '../components/LogoUploader';

const PLAN_INFO = {
    [PLANS.BASIC]:    { label: 'Basic',    icon: Zap,         color: '#10b981', userLimit: PLAN_USER_LIMITS[PLANS.BASIC],    price: 'Free' },
    [PLANS.STANDARD]: { label: 'Standard', icon: ShieldCheck, color: '#3b82f6', userLimit: PLAN_USER_LIMITS[PLANS.STANDARD], price: '$49/mo' },
    [PLANS.PREMIUM]:  { label: 'Premium',  icon: Crown,       color: '#f59e0b', userLimit: PLAN_USER_LIMITS[PLANS.PREMIUM],  price: '$99/mo' },
};

export default function TenantsManagement() {
    const { isSuperAdmin, userProfile } = useAuth();
    const [tenants, setTenants]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving]       = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [tenantUsers, setTenantUsers] = useState({});
    const [showInviteModal, setShowInviteModal] = useState(null); // tenantId
    const [copied, setCopied]       = useState('');

    const emptyForm = {
        companyName: '', email: '', country: '', expiresAt: '',
        logoURL: '', logoFile: null, plan: PLANS.BASIC,
        permissions: PLAN_FEATURES[PLANS.BASIC].reduce((a,f) => ({...a,[f]:true}), {})
    };
    const [form, setForm] = useState(emptyForm);

    useEffect(() => { if (isSuperAdmin) fetchTenants(); }, [isSuperAdmin]);

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'demoClients'), orderBy('createdAt','desc')));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTenants(list);
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const fetchTenantUsers = async (tenantId) => {
        try {
            const q = query(collection(db,'adminUsers'), where('companyId','==',tenantId));
            const snap = await getDocs(q);
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTenantUsers(prev => ({ ...prev, [tenantId]: users }));
        } catch(e) { console.error(e); }
    };

    const handlePlanChange = (plan) => {
        setForm(prev => ({
            ...prev, plan,
            permissions: PLAN_FEATURES[plan].reduce((a,f) => ({...a,[f]:true}), {})
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.email || !form.companyName) return;
        setSaving(true);
        try {
            let logoURL = form.logoURL || '';

            // Upload logo file if one was selected
            if (form.logoFile) {
                const ext = form.logoFile.name.split('.').pop().toLowerCase();
                const targetId = editingId || 'pending';
                const storageRef = ref(storage, `companyLogos/${targetId}/logo.${ext}`);
                await uploadBytes(storageRef, form.logoFile, { contentType: form.logoFile.type });
                logoURL = await getDownloadURL(storageRef);
            }

            const payload = {
                companyName: form.companyName,
                email: form.email.toLowerCase().trim(),
                country: form.country,
                expiresAt: form.expiresAt,
                logoURL,
                plan: form.plan,
                permissions: form.permissions,
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db,'demoClients',editingId), payload);
                // Sync all company users
                const usersSnap = await getDocs(query(collection(db,'adminUsers'), where('companyId','==',editingId)));
                for (const u of usersSnap.docs) {
                    await updateDoc(u.ref, { companyName: form.companyName, logoURL, plan: form.plan, updatedAt: serverTimestamp() });
                }
            } else {
                const newRef = await addDoc(collection(db,'demoClients'), {
                    ...payload,
                    active: true,
                    loginCount: 0,
                    lastLogin: null,
                    addedBy: userProfile?.email,
                    createdAt: serverTimestamp(),
                });

                // If logo was pending upload, move it to correct path
                if (form.logoFile && logoURL.includes('/pending/')) {
                    const ext = form.logoFile.name.split('.').pop().toLowerCase();
                    const newRef2 = ref(storage, `companyLogos/${newRef.id}/logo.${ext}`);
                    await uploadBytes(newRef2, form.logoFile, { contentType: form.logoFile.type });
                    const finalURL = await getDownloadURL(newRef2);
                    await updateDoc(doc(db,'demoClients',newRef.id), { logoURL: finalURL });
                    logoURL = finalURL;
                }

                // Sync existing admin user if already in Firestore
                const adminSnap = await getDocs(query(collection(db,'adminUsers'), where('email','==',form.email.toLowerCase().trim())));
                if (!adminSnap.empty) {
                    await updateDoc(adminSnap.docs[0].ref, {
                        companyId: newRef.id, companyName: form.companyName, logoURL,
                        plan: form.plan, role: ROLES.ADMIN, status: 'approved', isDemoClient: true, updatedAt: serverTimestamp()
                    });
                }
            }
            setEditingId(null);
            setForm(emptyForm);
            setShowModal(false);
            fetchTenants();
        } catch(err) { alert('Error: ' + err.message); }
        setSaving(false);
    };

    const handleEdit = (t) => {
        setEditingId(t.id);
        setForm({
            companyName: t.companyName || '',
            email: t.email || '',
            country: t.country || '',
            expiresAt: t.expiresAt || '',
            logoURL: t.logoURL || '',
            plan: t.plan || PLANS.BASIC,
            permissions: t.permissions || PLAN_FEATURES[t.plan||PLANS.BASIC].reduce((a,f)=>({...a,[f]:true}),{})
        });
        setShowModal(true);
    };

    const toggleActive = async (t) => {
        await updateDoc(doc(db,'demoClients',t.id), { active: !t.active });
        fetchTenants();
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete company "${name}"? Their users will lose access immediately.`)) return;
        await deleteDoc(doc(db,'demoClients',id));
        // Deactivate all company users so they can't log in
        try {
            const usersSnap = await getDocs(query(collection(db,'adminUsers'), where('companyId','==',id)));
            for (const u of usersSnap.docs) {
                await updateDoc(u.ref, { status: 'rejected', demoActive: false, updatedAt: serverTimestamp() });
            }
        } catch(e) { console.error('Error deactivating users:', e); }
        fetchTenants();
    };

    const toggleExpand = async (id) => {
        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);
        if (!tenantUsers[id]) await fetchTenantUsers(id);
    };

    const handleRemoveUser = async (userId, tenantId) => {
        if (!window.confirm('Remove this user from the company?')) return;
        await deleteDoc(doc(db,'adminUsers',userId));
        fetchTenantUsers(tenantId);
    };

    const copyText = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(text);
        setTimeout(() => setCopied(''), 2000);
    };

    const isExpired = (d) => d && new Date(d) < new Date();

    const stats = {
        total: tenants.length,
        active: tenants.filter(t => t.active && !isExpired(t.expiresAt)).length,
        expired: tenants.filter(t => isExpired(t.expiresAt)).length,
    };

    if (!isSuperAdmin) return (
        <div style={{ padding:40, textAlign:'center', color:'var(--navy-500)' }}>
            <Globe size={48} style={{ marginBottom:16, opacity:0.3 }} />
            <p>Super Admin access required</p>
        </div>
    );

    return (
        <div className="tenants-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Globe size={26}/> Company Tenants
                    </h1>
                    <p className="subtitle">Manage all car wash companies on the platform</p>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                    <a href="/" target="_blank" style={{ textDecoration:'none' }}>
                        <button className="btn btn-secondary"><Globe size={16}/> View Booking Site</button>
                    </a>
                    <button className="btn btn-secondary" onClick={fetchTenants}><RefreshCw size={16}/> Refresh</button>
                    <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm(emptyForm); setShowModal(true); }}>
                        <Plus size={18}/> Add Company
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16, marginBottom:24 }}>
                {[
                    { label:'Total Companies', value:stats.total,   color:'#3b82f6' },
                    { label:'Active',          value:stats.active,  color:'#10b981' },
                    { label:'Expired',         value:stats.expired, color:'#ef4444' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding:'20px 24px' }}>
                        <div style={{ fontSize:'2rem', fontWeight:700, color:s.color }}>{s.value}</div>
                        <div style={{ fontSize:'0.82rem', color:'var(--navy-500)', marginTop:4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Plan Info Banner */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
                {Object.entries(PLAN_INFO).map(([key,p]) => (
                    <div key={key} className="card" style={{ padding:'16px 20px', borderLeft:`4px solid ${p.color}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                            <p.icon size={18} color={p.color}/>
                            <strong style={{ color:p.color }}>{p.label}</strong>
                            <span style={{ marginLeft:'auto', fontSize:'0.8rem', background:`${p.color}15`, color:p.color, padding:'2px 8px', borderRadius:20, fontWeight:600 }}>{p.price}</span>
                        </div>
                        <div style={{ fontSize:'0.8rem', color:'var(--navy-600)' }}>
                            Up to <strong>{p.userLimit} users</strong> · {PLAN_FEATURES[key].length} modules
                        </div>
                    </div>
                ))}
            </div>

            {/* Tenants List */}
            <div className="card">
                {loading ? (
                    <div style={{ padding:40, textAlign:'center' }}><div className="loader"/></div>
                ) : tenants.length === 0 ? (
                    <div style={{ padding:60, textAlign:'center', color:'var(--navy-400)' }}>
                        <Building2 size={48} style={{ marginBottom:12, opacity:0.25 }}/>
                        <p style={{ margin:0 }}>No companies yet. Add your first company above.</p>
                    </div>
                ) : (
                    <div>
                        {tenants.map(t => {
                            const expired = isExpired(t.expiresAt);
                            const statusColor = !t.active ? '#6b7280' : expired ? '#ef4444' : '#10b981';
                            const statusLabel = !t.active ? 'Disabled' : expired ? 'Expired' : 'Active';
                            const plan = PLAN_INFO[t.plan] || PLAN_INFO[PLANS.BASIC];
                            const users = tenantUsers[t.id] || [];
                            const isOpen = expandedId === t.id;

                            return (
                                <div key={t.id} style={{ borderBottom:'1px solid var(--navy-100)' }}>
                                    {/* Main Row */}
                                    <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                                        {/* Logo/Avatar */}
                                        <div style={{ width:44, height:44, borderRadius:10, background: t.logoURL ? 'white' : 'linear-gradient(135deg,#3b82f6,#6366f1)', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                                            {t.logoURL ? (
                                                <img 
                                                    src={t.logoURL} 
                                                    alt="" 
                                                    style={{ width:'100%', height:'100%', objectFit:'contain' }}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.style.display = 'none';
                                                        e.target.parentNode.innerHTML = `<span style="color:#fff;font-weight:700;font-size:1rem">${t.companyName?.charAt(0)?.toUpperCase()}</span>`;
                                                        e.target.parentNode.style.background = 'linear-gradient(135deg,#3b82f6,#6366f1)';
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ color:'#fff', fontWeight:700, fontSize:'1rem' }}>{t.companyName?.charAt(0)?.toUpperCase()}</span>
                                            )}
                                        </div>

                                        {/* Name + Email */}
                                        <div style={{ flex:1, minWidth:200 }}>
                                            <div style={{ fontWeight:700 }}>{t.companyName}</div>
                                            <div style={{ fontSize:'0.8rem', color:'var(--navy-400)', display:'flex', alignItems:'center', gap:6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '2px', borderRadius: '4px' }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24">
                                                        <path fill="#4285F4" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
                                                        <path fill="#34A853" d="M22 6v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6l10 7 10-7z"/>
                                                        <path fill="#EA4335" d="M2 6l10 7 10-7V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v0z"/>
                                                        <path fill="#FBBC05" d="M2 18l7.5-5.25L2 6v12z"/>
                                                        <path fill="#FBBC05" d="M22 6l-7.5 6.75L22 18V6z"/>
                                                    </svg>
                                                </div>
                                                {t.email}
                                                <button onClick={() => copyText(t.email)} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                                    {copied===t.email ? <CheckCheck size={12} color="#10b981"/> : <Copy size={12} color="#94a3b8"/>}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Plan Badge */}
                                        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.8rem', fontWeight:600 }}>
                                            <plan.icon size={14} color={plan.color}/>
                                            <span style={{ color:plan.color }}>{plan.label}</span>
                                        </div>

                                        {/* Users Count */}
                                        <div style={{ fontSize:'0.8rem', color:'var(--navy-600)', background:'#f1f5f9', padding:'4px 10px', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>
                                            <Users size={12}/>
                                            {isOpen ? users.length : '?'} / {plan.userLimit}
                                        </div>

                                        {/* Status */}
                                        <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:`${statusColor}18`, color:statusColor, fontSize:'0.75rem', fontWeight:600, padding:'4px 12px', borderRadius:20 }}>
                                            {statusLabel}
                                        </span>

                                        {/* Actions */}
                                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                                            <a href={`/book/${t.id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" title="Open booking page" style={{ display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                                                <ExternalLink size={12}/> Book Page
                                            </a>
                                            <button onClick={() => toggleExpand(t.id)} className="btn btn-sm btn-secondary" title="Expand to manage users">
                                                {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                                                {isOpen ? 'Collapse' : 'Users'}
                                            </button>
                                            <button onClick={() => handleEdit(t)} className="btn btn-sm btn-secondary" title="Edit">
                                                <Edit3 size={13}/>
                                            </button>
                                            <button onClick={() => toggleActive(t)} className="btn btn-sm btn-secondary">
                                                {t.active ? 'Disable' : 'Enable'}
                                            </button>
                                            <button onClick={() => handleDelete(t.id, t.companyName)} className="btn btn-sm" style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca' }}>
                                                <Trash2 size={13}/>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Users Panel */}
                                    {isOpen && (
                                        <div style={{ background:'#f8fafc', padding:'16px 20px', borderTop:'1px solid var(--navy-100)' }}>
                                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                                                <strong style={{ fontSize:'0.9rem' }}>Company Users ({users.length}/{plan.userLimit})</strong>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => setShowInviteModal(t.id)}
                                                    disabled={users.length >= plan.userLimit}
                                                >
                                                    <UserPlus size={13}/> Invite User
                                                </button>
                                            </div>

                                            {users.length >= plan.userLimit && (
                                                <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:'0.8rem', color:'#c2410c', display:'flex', alignItems:'center', gap:6 }}>
                                                    <AlertCircle size={14}/> User limit reached for {plan.label} plan. Upgrade to add more users.
                                                </div>
                                            )}

                                            {users.length === 0 ? (
                                                <p style={{ color:'var(--navy-400)', fontSize:'0.85rem', margin:0 }}>
                                                    No users added yet. Invite users to this company using the button above.
                                                </p>
                                            ) : (
                                                <div style={{ display:'grid', gap:8 }}>
                                                    {users.map(u => (
                                                        <div key={u.id} style={{ background:'white', border:'1px solid var(--navy-100)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                                                            {u.photoURL ? (
                                                                <img src={u.photoURL} alt="" style={{ width:32, height:32, borderRadius:'50%' }}/>
                                                            ) : (
                                                                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--primary-light)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                                                                    {u.displayName?.charAt(0) || u.email?.charAt(0) || '?'}
                                                                </div>
                                                            )}
                                                            <div style={{ flex:1 }}>
                                                                <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{u.displayName || 'No Name'}</div>
                                                                <div style={{ fontSize:'0.75rem', color:'var(--navy-400)' }}>{u.email}</div>
                                                            </div>
                                                            <span style={{ fontSize:'0.7rem', textTransform:'capitalize', background:'var(--navy-100)', color:'var(--navy-600)', padding:'2px 8px', borderRadius:20 }}>
                                                                {u.role}
                                                            </span>
                                                            <span style={{ fontSize:'0.7rem', background: u.status==='approved'?'#d1fae5':'#fef3c7', color: u.status==='approved'?'#065f46':'#92400e', padding:'2px 8px', borderRadius:20 }}>
                                                                {u.status}
                                                            </span>
                                                            <button onClick={() => handleRemoveUser(u.id, t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:4 }}>
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add/Edit Company Modal */}
            {showModal && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth:680 }}>
                        <div className="modal-header">
                            <h2 style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <Building2 size={20}/> {editingId ? 'Edit' : 'New'} Company
                            </h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                                    <div className="form-group">
                                        <label>Company Name *</label>
                                        <input value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} required placeholder="e.g. SparkleWash Pro"/>
                                    </div>
                                    <div className="form-group">
                                        <label>Admin Gmail (login email) *</label>
                                        <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="admin@company.com"/>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <LogoUploader
                                        companyId={editingId}
                                        currentURL={form.logoURL}
                                        onUpload={(url, file) => setForm(prev => ({ ...prev, logoURL: url, logoFile: file || null }))}
                                    />
                                </div>

                                {/* Plan Selection */}
                                <div className="form-group">
                                    <label>Subscription Plan</label>
                                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:8 }}>
                                        {Object.entries(PLAN_INFO).map(([key,p]) => (
                                            <div key={key} onClick={() => handlePlanChange(key)} style={{ padding:16, borderRadius:12, border:`2px solid ${form.plan===key?p.color:'#e2e8f0'}`, background:form.plan===key?`${p.color}08`:'white', cursor:'pointer', textAlign:'center', transition:'all 0.2s' }}>
                                                <p.icon size={20} color={p.color} style={{ marginBottom:4 }}/>
                                                <div style={{ fontWeight:700, fontSize:'0.85rem' }}>{p.label}</div>
                                                <div style={{ fontSize:'0.65rem', color:'var(--navy-400)' }}>Up to {p.userLimit} users</div>
                                                <div style={{ fontSize:'0.75rem', color:p.color, fontWeight:600 }}>{p.price}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                                    <div className="form-group">
                                        <label>Country</label>
                                        <input value={form.country} onChange={e => setForm({...form, country: e.target.value})} placeholder="e.g. UAE"/>
                                    </div>
                                    <div className="form-group">
                                        <label>Access Expiry Date</label>
                                        <input type="date" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})}/>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : editingId ? 'Update Company' : 'Create Company'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invite User Modal */}
            {showInviteModal && (
                <InviteUserModal
                    tenantId={showInviteModal}
                    tenant={tenants.find(t => t.id === showInviteModal)}
                    onClose={() => setShowInviteModal(null)}
                    onSuccess={() => { fetchTenantUsers(showInviteModal); setShowInviteModal(null); }}
                />
            )}
        </div>
    );
}

function InviteUserModal({ tenantId, tenant, onClose, onSuccess }) {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState(ROLES.EMPLOYEE);
    const [email, setEmail] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const emailLower = email.toLowerCase().trim();
            
            // Check if user limit reached
            const usersSnap = await getDocs(query(collection(db,'adminUsers'), where('companyId','==',tenantId)));
            const userLimit = PLAN_USER_LIMITS[tenant?.plan || PLANS.BASIC];
            if (usersSnap.size >= userLimit) {
                alert(`User limit (${userLimit}) reached for ${tenant?.plan || 'basic'} plan. Please upgrade.`);
                setLoading(false);
                return;
            }

            // Create invite
            await addDoc(collection(db,'employeeInvites'), {
                email: emailLower,
                role,
                companyId: tenantId,
                companyName: tenant?.companyName || '',
                logoURL: tenant?.logoURL || '',
                plan: tenant?.plan || PLANS.BASIC,
                isDemoClient: true,
                invitedBy: userProfile?.email,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            alert(`✅ Invite sent to ${emailLower}!\n\nThey can now sign in with their Gmail account at the Zwash login page and will be directed to ${tenant?.companyName}'s dashboard automatically.`);
            onSuccess();
        } catch(e) {
            alert('Error: ' + e.message);
        }
        setLoading(false);
    };

    return (
        <div className="modal">
            <div className="modal-content" style={{ maxWidth:480 }}>
                <div className="modal-header">
                    <h2><UserPlus size={20}/> Invite User to {tenant?.companyName}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'0.83rem', color:'#1e40af' }}>
                            <strong>How it works:</strong> Enter the user's Gmail address. They can sign in via Google on the login page and will automatically be added to <strong>{tenant?.companyName}</strong>'s workspace.
                        </div>
                        <div className="form-group">
                            <label>Gmail Address *</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="user@gmail.com"/>
                        </div>
                        <div className="form-group">
                            <label>Role</label>
                            <select value={role} onChange={e => setRole(e.target.value)}>
                                <option value={ROLES.EMPLOYEE}>Employee</option>
                                <option value={ROLES.SENIOR_EMPLOYEE}>Senior Employee</option>
                                <option value={ROLES.MANAGER}>Manager</option>
                                <option value={ROLES.ADMIN}>Admin</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Plan</label>
                            <input value={tenant?.plan || PLANS.BASIC} disabled style={{ background:'#f1f5f9', textTransform:'capitalize' }}/>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Invite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
