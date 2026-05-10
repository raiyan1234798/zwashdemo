import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, Check, X, ClipboardCheck, Car, AlertTriangle, FileText, Image as ImageIcon } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

const VEHICLE_PARTS = [
    'Front Bumper', 'Rear Bumper', 'Left Door (Front)', 'Left Door (Rear)',
    'Right Door (Front)', 'Right Door (Rear)', 'Hood', 'Trunk', 'Roof',
    'Windshield', 'Rear Window', 'Left Mirror', 'Right Mirror', 'Wheels/Alloys'
];

const DAMAGE_TYPES = ['Scratch', 'Dent', 'Crack', 'Broken', 'Paint Chip'];

export default function Inspections() {
    const { userProfile, hasPermission } = useAuth();
    const { t } = useTranslation();
    
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    const emptyForm = {
        customerName: '',
        vehicleMake: '',
        vehicleModel: '',
        licensePlate: '',
        damages: [], // { part: '', type: '', notes: '' }
        inspectorNotes: '',
        status: 'pending' // pending, signed, completed
    };
    
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        fetchInspections();
    }, [userProfile?.companyId]);

    const fetchInspections = async () => {
        setLoading(true);
        try {
            let q = collection(db, 'inspections');
            if (userProfile?.companyId) {
                q = query(q, where('companyId', '==', userProfile.companyId));
            }
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort client-side by createdAt descending
            list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setInspections(list);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                companyId: userProfile?.companyId || null,
                companyName: userProfile?.companyName || '',
                inspectorId: userProfile?.uid,
                inspectorName: userProfile?.displayName || 'Unknown',
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db, 'inspections', editingId), payload);
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, 'inspections'), payload);
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingId(null);
            fetchInspections();
        } catch (e) {
            alert('Error saving inspection: ' + e.message);
        }
        setSaving(false);
    };

    const handleEdit = (insp) => {
        setForm({
            customerName: insp.customerName || '',
            vehicleMake: insp.vehicleMake || '',
            vehicleModel: insp.vehicleModel || '',
            licensePlate: insp.licensePlate || '',
            damages: insp.damages || [],
            inspectorNotes: insp.inspectorNotes || '',
            status: insp.status || 'pending'
        });
        setEditingId(insp.id);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this inspection record?')) return;
        try {
            await deleteDoc(doc(db, 'inspections', id));
            fetchInspections();
        } catch (e) {
            alert('Error deleting: ' + e.message);
        }
    };

    const addDamage = () => {
        setForm(p => ({
            ...p,
            damages: [...p.damages, { part: VEHICLE_PARTS[0], type: DAMAGE_TYPES[0], notes: '' }]
        }));
    };

    const updateDamage = (index, field, value) => {
        const newDamages = [...form.damages];
        newDamages[index][field] = value;
        setForm({ ...form, damages: newDamages });
    };

    const removeDamage = (index) => {
        const newDamages = form.damages.filter((_, i) => i !== index);
        setForm({ ...form, damages: newDamages });
    };

    const filteredInspections = inspections.filter(i => 
        (i.licensePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.customerName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="inspections-page" style={{ padding: '24px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0, color: 'var(--navy-900)' }}>
                        <ClipboardCheck size={28} color="var(--primary-color)" />
                        Vehicle Inspections
                    </h1>
                    <p style={{ color: 'var(--navy-500)', marginTop: '4px', fontSize: '0.9rem' }}>
                        Track pre-wash vehicle conditions and avoid damage liability
                    </p>
                </div>
                {hasPermission('inspections', 'create') && (
                    <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditingId(null); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> New Inspection
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--navy-400)' }} />
                        <input
                            type="text"
                            placeholder="Search by license plate or customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid var(--navy-200)', borderRadius: '8px' }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><div className="loader" /></div>
                ) : filteredInspections.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--navy-400)' }}>
                        <Car size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <p>No vehicle inspections found.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th>Vehicle</th>
                                    <th>License Plate</th>
                                    <th>Damages Recorded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInspections.map(insp => (
                                    <tr key={insp.id}>
                                        <td>{insp.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                                        <td>{insp.customerName}</td>
                                        <td>{insp.vehicleMake} {insp.vehicleModel}</td>
                                        <td style={{ fontWeight: '600' }}>{insp.licensePlate}</td>
                                        <td>
                                            {insp.damages?.length > 0 ? (
                                                <span style={{ color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertTriangle size={14} /> {insp.damages.length} Issue(s)
                                                </span>
                                            ) : (
                                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Check size={14} /> Clear
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize',
                                                background: insp.status === 'completed' ? '#d1fae5' : '#fef3c7',
                                                color: insp.status === 'completed' ? '#065f46' : '#92400e'
                                            }}>
                                                {insp.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {hasPermission('inspections', 'edit') && (
                                                    <button onClick={() => handleEdit(insp)} className="btn btn-sm btn-secondary" title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                                {hasPermission('inspections', 'delete') && (
                                                    <button onClick={() => handleDelete(insp.id)} className="btn btn-sm" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }} title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="modal-content" style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--navy-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy-900)' }}>
                                <ClipboardCheck size={20} color="var(--primary-color)" />
                                {editingId ? 'Edit Inspection' : 'New Vehicle Inspection'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-400)' }}><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
                            <h3 style={{ fontSize: '1rem', color: 'var(--navy-800)', marginBottom: '16px', borderBottom: '2px solid var(--navy-100)', paddingBottom: '8px' }}>Vehicle Details</h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div className="form-group">
                                    <label>Customer Name</label>
                                    <input required type="text" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--navy-200)', borderRadius: '8px' }} />
                                </div>
                                <div className="form-group">
                                    <label>License Plate *</label>
                                    <input required type="text" value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--navy-200)', borderRadius: '8px', textTransform: 'uppercase' }} />
                                </div>
                                <div className="form-group">
                                    <label>Make</label>
                                    <input type="text" value={form.vehicleMake} onChange={e => setForm({...form, vehicleMake: e.target.value})} placeholder="e.g. Toyota" style={{ width: '100%', padding: '10px', border: '1px solid var(--navy-200)', borderRadius: '8px' }} />
                                </div>
                                <div className="form-group">
                                    <label>Model</label>
                                    <input type="text" value={form.vehicleModel} onChange={e => setForm({...form, vehicleModel: e.target.value})} placeholder="e.g. Camry" style={{ width: '100%', padding: '10px', border: '1px solid var(--navy-200)', borderRadius: '8px' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid var(--navy-100)', paddingBottom: '8px' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--navy-800)', margin: 0 }}>Damage Report</h3>
                                <button type="button" onClick={addDamage} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plus size={14} /> Add Damage
                                </button>
                            </div>

                            {form.damages.length === 0 ? (
                                <div style={{ padding: '20px', background: '#f8fafc', border: '1px dashed var(--navy-300)', borderRadius: '8px', textAlign: 'center', color: 'var(--navy-500)', marginBottom: '24px' }}>
                                    No damages recorded. Vehicle is clear.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                    {form.damages.map((dmg, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--navy-100)' }}>
                                            <select value={dmg.part} onChange={e => updateDamage(idx, 'part', e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid var(--navy-200)', borderRadius: '6px' }}>
                                                {VEHICLE_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <select value={dmg.type} onChange={e => updateDamage(idx, 'type', e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid var(--navy-200)', borderRadius: '6px' }}>
                                                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <input type="text" placeholder="Notes (optional)" value={dmg.notes} onChange={e => updateDamage(idx, 'notes', e.target.value)} style={{ flex: 1.5, padding: '8px', border: '1px solid var(--navy-200)', borderRadius: '6px' }} />
                                            <button type="button" onClick={() => removeDamage(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>General Inspector Notes</label>
                                <textarea 
                                    rows="3" 
                                    value={form.inspectorNotes} 
                                    onChange={e => setForm({...form, inspectorNotes: e.target.value})} 
                                    placeholder="Any other observations..."
                                    style={{ width: '100%', padding: '10px', border: '1px solid var(--navy-200)', borderRadius: '8px', resize: 'vertical' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--navy-200)', borderRadius: '8px' }}>
                                    <option value="pending">Pending Customer Signature</option>
                                    <option value="signed">Customer Agreed (Signed)</option>
                                    <option value="completed">Completed / Washed</option>
                                </select>
                            </div>
                        </form>

                        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--navy-100)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
