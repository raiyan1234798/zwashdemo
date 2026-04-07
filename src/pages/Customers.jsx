import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    where,
    serverTimestamp
} from 'firebase/firestore';
import {
    Users,
    Plus,
    Search,
    Phone,
    Mail,
    Car,
    Eye,
    Download,
    Tag,
    FileText,
    Star,
    X,
    Clock,
    MapPin,
    Edit,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Customers = () => {
    const { hasPermission, userProfile, isAdmin } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
    const [filterType, setFilterType] = useState('all'); // all, repeat, new_car

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);

            // Fetch from customers collection
            const customersQuery = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
            const customersSnapshot = await getDocs(customersQuery);
            const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'customers' }));

            // Also fetch unique customers from bookings
            const bookingsQuery = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
            const bookingsSnapshot = await getDocs(bookingsQuery);

            // Count how many bookings each phone/plate key has (for repeat detection)
            const bookingCounts = {};
            bookingsSnapshot.docs.forEach(doc => {
                const b = doc.data();
                const key = b.contactPhone || b.licensePlate;
                if (key) bookingCounts[key] = (bookingCounts[key] || 0) + 1;
            });

            // Create a map of unique customers by phone or license plate
            const customerMap = new Map();

            // Add customers from customers collection first
            // Since customersData is sorted by createdAt desc, we only set if not already in map
            // to keep the newest record when there are duplicates.
            customersData.forEach(c => {
                const key = c.phone || c.licensePlate;
                if (key && !customerMap.has(key)) {
                    customerMap.set(key, {
                        ...c,
                        bookingCount: bookingCounts[key] || c.bookingCount || 0
                    });
                }
            });

            // Add customers from bookings if not already in map
            bookingsSnapshot.docs.forEach(doc => {
                const booking = doc.data();
                const key = booking.contactPhone || booking.licensePlate;
                if (key && !customerMap.has(key)) {
                    customerMap.set(key, {
                        id: `booking-${doc.id}`,
                        name: booking.customerName || booking.contactName || 'Walk-in Customer',
                        phone: booking.contactPhone || '',
                        email: booking.contactEmail || '',
                        carMake: booking.carMake || '',
                        carModel: booking.carModel || '',
                        licensePlate: booking.licensePlate || '',
                        source: 'booking',
                        bookingCount: bookingCounts[key] || 0,
                        createdAt: booking.createdAt
                    });
                }
            });

            // Convert map to array and sort by createdAt
            const allCustomers = Array.from(customerMap.values());
            setCustomers(allCustomers);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        const exportData = customers.map(c => ({
            Name: c.name || 'N/A',
            Phone: c.phone,
            Email: c.email || 'N/A',
            Vehicle: `${c.carMake || ''} ${c.carModel || ''}`.trim() || 'N/A',
            'License Plate': c.licensePlate || 'N/A',
            'Total Bookings': c.bookingCount || 0
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        XLSX.writeFile(wb, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const deleteCustomer = async (customerId) => {
        try {
            await deleteDoc(doc(db, 'customers', customerId));
            setCustomers(prev => prev.filter(c => c.id !== customerId));
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting customer:', error);
            alert('Error deleting customer');
        }
    };

    const isNewRegistration = (plate) => {
        if (!plate) return false;
        const normalized = plate.toUpperCase().replace(/[-\s]/g, '');
        // TN-74: BJ and BK series only | TN-75: AK and AL series only
        return /^TN74(BJ|BK)\d{4}$/.test(normalized) || /^TN75(AK|AL)\d{4}$/.test(normalized);
    };

    // Validate TN license plate format: TN-XX-YY-XXXX (XX=2 digits, YY=2 letters, XXXX=4 digits)
    const isValidLicensePlate = (plate) => {
        if (!plate) return false;
        const normalized = plate.toUpperCase().replace(/[-\s]/g, '');
        return /^TN\d{2}[A-Z]{2}\d{4}$/.test(normalized);
    };

    const filteredCustomers = customers.filter(customer => {
        // Search Filter
        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = !searchTerm || (
            (customer.name || '').toLowerCase().includes(search) ||
            (customer.phone || '').toString().includes(search) ||
            (customer.email || '').toLowerCase().includes(search) ||
            (customer.licensePlate || '').toLowerCase().includes(search)
        );

        if (!matchesSearch) return false;

        // Type Filter
        if (filterType === 'repeat') {
            return (customer.bookingCount || 0) > 1;
        }
        if (filterType === 'new_car') {
            return isNewRegistration(customer.licensePlate);
        }

        return true;
    });

    return (
        <div className="customers-page">
            <div className="page-header">
                <div>
                    <h1><Users size={28} /> Customers</h1>
                    <p className="subtitle">Manage customer relationships</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Export
                    </button>
                    {hasPermission('customers', 'create') && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <Plus size={18} /> Add Customer
                        </button>
                    )}
                </div>
            </div>

            {/* CRM Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Users size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{customers.length}</span>
                        <span className="stat-label">Total Customers</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <Users size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {customers.filter(c => {
                                const now = new Date();
                                const createdAt = c.createdAt?.toDate?.() || c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
                                return createdAt && createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
                            }).length}
                        </span>
                        <span className="stat-label">New This Month</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Car size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {new Set(customers.map(c => c.carMake).filter(Boolean)).size}
                        </span>
                        <span className="stat-label">Vehicle Brands</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <Phone size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {customers.filter(c => c.phone).length}
                        </span>
                        <span className="stat-label">With Phone</span>
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="search-filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: 1 }}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, phone, plate..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterType('all')}
                    >All</button>
                    <button
                        className={`btn btn-sm ${filterType === 'repeat' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterType('repeat')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Star size={14} fill={filterType === 'repeat' ? 'white' : 'transparent'} /> Repeat
                    </button>
                    <button
                        className={`btn btn-sm ${filterType === 'new_car' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterType('new_car')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Tag size={14} /> New Cars
                    </button>
                </div>
            </div>

            {/* Customers Table */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state"><div className="loader"></div></div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="empty-state">
                            <Users size={48} />
                            <p>No customers found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="table-container desktop-table">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th>Contact</th>
                                            <th>Vehicle</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCustomers.map(customer => (
                                            <tr key={customer.id}>
                                                <td>
                                                    <strong>{customer.name || 'N/A'}</strong>
                                                </td>
                                                <td>
                                                    <div><Phone size={12} /> {customer.phone}</div>
                                                    {customer.email && <div><Mail size={12} /> {customer.email}</div>}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {customer.carMake} {customer.carModel}
                                                        {isNewRegistration(customer.licensePlate) && (
                                                            <span className="badge badge-new-car" style={{ background: '#3b82f6', color: 'white', fontSize: '0.65rem' }}>NEW CAR</span>
                                                        )}
                                                        {(customer.bookingCount || 0) > 1 && (
                                                            <span className="badge badge-repeat" style={{ background: '#8b5cf6', color: 'white', fontSize: '0.65rem' }}>REPEAT</span>
                                                        )}
                                                    </div>
                                                    <div><strong>{customer.licensePlate}</strong></div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => setSelectedCustomer(customer)}
                                                            title="View"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {hasPermission('customers', 'edit') && (
                                                            <button
                                                                className="btn-icon"
                                                                onClick={() => setEditingCustomer(customer)}
                                                                title="Edit"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        )}
                                                        {hasPermission('customers', 'delete') && (
                                                            <button
                                                                className="btn-icon danger"
                                                                onClick={() => setDeleteConfirm({ id: customer.id, name: customer.name || customer.phone })}
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="mobile-cards">
                                {filteredCustomers.map(customer => (
                                    <div key={customer.id} className="booking-card">
                                        <div className="booking-card-header">
                                            <strong>{customer.name || 'Walk-in Customer'}</strong>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {isNewRegistration(customer.licensePlate) && (
                                                    <span className="badge" style={{ background: '#3b82f6', color: 'white', fontSize: '0.65rem' }}>NEW CAR</span>
                                                )}
                                                {(customer.bookingCount || 0) > 1 && (
                                                    <span className="badge" style={{ background: '#8b5cf6', color: 'white', fontSize: '0.65rem' }}>REPEAT</span>
                                                )}
                                                <span className="badge badge-confirmed">{customer.carMake || 'Unknown'}</span>
                                            </div>
                                        </div>
                                        <div className="booking-card-body">
                                            <p><Phone size={14} /> {customer.phone || 'No phone'}</p>
                                            <p><Car size={14} /> {customer.carMake} {customer.carModel}</p>
                                            <p><strong>{customer.licensePlate || 'No plate'}</strong></p>
                                        </div>
                                        <div className="booking-card-footer">
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => setSelectedCustomer(customer)}
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showModal && (
                <CustomerModal onClose={() => setShowModal(false)} onSuccess={fetchCustomers} />
            )}

            {selectedCustomer && (
                <CustomerDetailsModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                />
            )}

            {/* Edit Customer Modal */}
            {editingCustomer && (
                <EditCustomerModal
                    customer={editingCustomer}
                    onClose={() => setEditingCustomer(null)}
                    onSuccess={fetchCustomers}
                    userProfile={userProfile}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2><AlertTriangle size={20} color="#ef4444" /> Confirm Delete</h2>
                            <button className="modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Delete "{deleteConfirm.name}"?</h3>
                            <p style={{ color: 'var(--navy-500)' }}>
                                This action cannot be undone. This will permanently delete this customer and all their data.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button
                                className="btn"
                                style={{ background: '#ef4444', color: 'white' }}
                                onClick={() => deleteCustomer(deleteConfirm.id)}
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomerModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [plateError, setPlateError] = useState('');
    const [plateValue, setPlateValue] = useState('');

    const validatePlate = (val) => {
        return null;
    };

    const handlePlateChange = (e) => {
        const val = e.target.value;
        setPlateValue(val);
        setPlateError(validatePlate(val));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validation = validatePlate(plateValue);
        if (validation?.type === 'error') { setPlateError(validation); return; }
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);

        try {
            await addDoc(collection(db, 'customers'), {
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email') || null,
                carMake: formData.get('carMake'),
                carModel: formData.get('carModel'),
                licensePlate: plateValue.toUpperCase(),
                bookingCount: 0,
                createdAt: serverTimestamp()
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error adding customer:', error);
        } finally {
            setLoading(false);
        }
    };

    const plateValid = plateValue && !validatePlate(plateValue);

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Plus size={20} /> Add Customer</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Name</label>
                            <input name="name" placeholder="John Doe" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Phone *</label>
                                <input name="phone" type="tel" required placeholder="+91 98765 43210" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input name="email" type="email" placeholder="john@example.com" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Car Make *</label>
                                <input name="carMake" required placeholder="Toyota" />
                            </div>
                            <div className="form-group">
                                <label>Car Model *</label>
                                <input name="carModel" required placeholder="Camry" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>License Plate</label>
                            <input
                                name="licensePlate"
                                value={plateValue}
                                onChange={handlePlateChange}
                                placeholder="TN-01-AB-1234"
                                style={{
                                    textTransform: 'uppercase',
                                    border: plateValue
                                        ? (plateValid ? '2px solid #10b981' : '2px solid #f59e0b')
                                        : undefined
                                }}
                            />
                            {plateError && (
                                <small style={{ color: plateError.type === 'error' ? '#ef4444' : '#f59e0b', display: 'block', marginTop: '4px' }}>
                                    {plateError.type === 'error' ? '⚠ ' : '⚠ '}{plateError.msg}
                                </small>
                            )}
                            {plateValid && (
                                <small style={{ color: '#10b981', display: 'block', marginTop: '4px' }}>
                                    ✓ Valid TN plate{(/^TN74(BJ|BK)\d{4}$/.test(plateValue.replace(/[-\s]/g, '')) || /^TN75(AK|AL)\d{4}$/.test(plateValue.replace(/[-\s]/g, ''))) ? ' — New Registration' : ''}
                                </small>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Adding...' : 'Add Customer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Edit Customer Modal with Audit Trail
const EditCustomerModal = ({ customer, onClose, onSuccess, userProfile }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        carMake: customer.carMake || '',
        carModel: customer.carModel || '',
        licensePlate: customer.licensePlate || ''
    });
    const [plateError, setPlateError] = useState('');

    const validatePlate = (val) => {
        return null;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'licensePlate') setPlateError(validatePlate(value));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validation = validatePlate(formData.licensePlate);
        if (validation?.type === 'error') { setPlateError(validation); return; }
        setLoading(true);

        try {
            await updateDoc(doc(db, 'customers', customer.id), {
                ...formData,
                licensePlate: formData.licensePlate.toUpperCase(),
                lastEditedBy: userProfile?.displayName || 'Staff',
                lastEditedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating customer:', error);
            alert('Error updating customer');
        } finally {
            setLoading(false);
        }
    };

    const plateValid = formData.licensePlate && !validatePlate(formData.licensePlate);

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Edit size={20} /> Edit Customer</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Show last edited info */}
                        {customer.lastEditedBy && (
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--navy-400)',
                                marginBottom: '1rem',
                                padding: '0.5rem',
                                background: 'var(--navy-50)',
                                borderRadius: '4px'
                            }}>
                                Last edited by <strong>{customer.lastEditedBy}</strong>
                                {customer.lastEditedAt && (
                                    <> on {customer.lastEditedAt.toDate ?
                                        customer.lastEditedAt.toDate().toLocaleDateString() :
                                        new Date(customer.lastEditedAt).toLocaleDateString()}</>
                                )}
                            </div>
                        )}
                        <div className="form-group">
                            <label>Name</label>
                            <input name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Phone *</label>
                                <input name="phone" type="tel" required value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Car Make *</label>
                                <input name="carMake" required value={formData.carMake} onChange={handleChange} placeholder="Toyota" />
                            </div>
                            <div className="form-group">
                                <label>Car Model *</label>
                                <input name="carModel" required value={formData.carModel} onChange={handleChange} placeholder="Camry" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>License Plate</label>
                            <input
                                name="licensePlate"
                                value={formData.licensePlate}
                                onChange={handleChange}
                                placeholder="TN-01-AB-1234"
                                style={{
                                    textTransform: 'uppercase',
                                    border: formData.licensePlate
                                        ? (plateValid ? '2px solid #10b981' : '2px solid #f59e0b')
                                        : undefined
                                }}
                            />
                            {plateError && (
                                <small style={{ color: plateError.type === 'error' ? '#ef4444' : '#f59e0b', display: 'block', marginTop: '4px' }}>
                                    ⚠ {plateError.msg}
                                </small>
                            )}
                            {plateValid && (
                                <small style={{ color: '#10b981', display: 'block', marginTop: '4px' }}>
                                    ✓ Valid TN plate{(/^TN74(BJ|BK)\d{4}$/.test(formData.licensePlate.replace(/[-\s]/g, '')) || /^TN75(AK|AL)\d{4}$/.test(formData.licensePlate.replace(/[-\s]/g, ''))) ? ' — New Registration' : ''}
                                </small>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CustomerDetailsModal = ({ customer, onClose }) => {
    const { hasPermission, userProfile } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState('');
    const [saving, setSaving] = useState(false);
    const [totalSpend, setTotalSpend] = useState(0);
    const [lastVisit, setLastVisit] = useState(null);
    const [isInactive, setIsInactive] = useState(false);
    const [amcSubscription, setAmcSubscription] = useState(null);

    // History arrays for tags and notes
    const [tagHistory, setTagHistory] = useState(customer.tagHistory || []);
    const [noteHistory, setNoteHistory] = useState(customer.noteHistory || []);
    const [showTagHistory, setShowTagHistory] = useState(false);
    const [showNoteHistory, setShowNoteHistory] = useState(false);

    // Service mapping for upsells
    const [services, setServices] = useState([]);
    const [recommendedServices, setRecommendedServices] = useState(customer.recommendedServices || []);
    const [selectedServiceToAdd, setSelectedServiceToAdd] = useState('');

    // Additional customer details
    const [address, setAddress] = useState(customer.address || '');
    const [membershipTier, setMembershipTier] = useState(customer.membershipTier || 'bronze');
    const [preferredContact, setPreferredContact] = useState(customer.preferredContact || 'whatsapp');

    useEffect(() => {
        fetchBookingHistory();
        fetchAmcSubscription();
        fetchServices();
    }, [customer]);

    const fetchAmcSubscription = async () => {
        try {
            const q = query(
                collection(db, 'customer_amc_subscriptions'),
                where('customerPhone', '==', customer.phone),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setAmcSubscription({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
                setAmcSubscription(null);
            }
        } catch (error) {
            console.error('Error fetching AMC:', error);
        }
    };

    const fetchServices = async () => {
        try {
            const snapshot = await getDocs(query(collection(db, 'services'), where('isActive', '==', true)));
            setServices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const addRecommendedService = () => {
        if (!selectedServiceToAdd) return;
        const service = services.find(s => s.id === selectedServiceToAdd);
        if (service && !recommendedServices.find(r => r.id === service.id)) {
            setRecommendedServices(prev => [...prev, { id: service.id, name: service.name }]);
        }
        setSelectedServiceToAdd('');
    };

    const removeRecommendedService = (serviceId) => {
        setRecommendedServices(prev => prev.filter(s => s.id !== serviceId));
    };

    const fetchBookingHistory = async () => {
        try {
            const q = query(collection(db, 'bookings'));
            const snapshot = await getDocs(q);
            const customerBookings = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(b => b.contactPhone === customer.phone || b.licensePlate === customer.licensePlate)
                .sort((a, b) => (b.bookingDate || '').localeCompare(a.bookingDate || ''));

            setBookings(customerBookings);

            // Calculate total spend from completed bookings
            const spend = customerBookings
                .filter(b => b.status === 'completed')
                .reduce((sum, b) => sum + (b.price || 0), 0);
            setTotalSpend(spend);

            // Get last visit date
            const lastCompleted = customerBookings.find(b => b.status === 'completed');
            if (lastCompleted) {
                setLastVisit(lastCompleted.bookingDate);
                // Check if inactive (no visit in 30 days)
                const lastDate = new Date(lastCompleted.bookingDate);
                const daysSince = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                setIsInactive(daysSince > 30);
            }
        } catch (error) {
            console.error('Error fetching booking history:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveCustomerData = async () => {
        try {
            setSaving(true);
            const now = new Date();
            const timestamp = now.toISOString();

            // Create new history entries if values changed
            const newTagHistory = [...tagHistory];
            const newNoteHistory = [...noteHistory];

            if (tags.trim() && tags !== (customer.tags || '')) {
                newTagHistory.unshift({
                    text: tags,
                    savedAt: timestamp,
                    savedBy: userProfile?.displayName || 'Staff'
                });
            }

            if (notes.trim() && notes !== (customer.notes || '')) {
                newNoteHistory.unshift({
                    text: notes,
                    savedAt: timestamp,
                    savedBy: userProfile?.displayName || 'Staff'
                });
            }

            const updateData = {
                notes: notes,
                tags: tags,
                tagHistory: newTagHistory.slice(0, 20), // Keep last 20 entries
                noteHistory: newNoteHistory.slice(0, 20),
                recommendedServices: recommendedServices,
                address: address,
                membershipTier: membershipTier,
                preferredContact: preferredContact,
                updatedAt: serverTimestamp()
            };

            // Only update if customer has a real ID (not booking-derived)
            if (customer.id && !customer.id.startsWith('booking-')) {
                await updateDoc(doc(db, 'customers', customer.id), updateData);
                setTagHistory(newTagHistory.slice(0, 20));
                setNoteHistory(newNoteHistory.slice(0, 20));
                alert('Customer data saved!');
            } else {
                // Create customer record if from booking
                await addDoc(collection(db, 'customers'), {
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email || '',
                    carMake: customer.carMake,
                    carModel: customer.carModel,
                    licensePlate: customer.licensePlate,
                    ...updateData,
                    createdAt: serverTimestamp()
                });
                setTagHistory(newTagHistory.slice(0, 20));
                setNoteHistory(newNoteHistory.slice(0, 20));
                alert('Customer created and data saved!');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error saving customer data');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><Users size={20} /> Customer Details</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {/* AMC Alert */}
                    {amcSubscription && (
                        <div style={{
                            background: amcSubscription.planType === 'premium' ? 'linear-gradient(135deg, #1a1a2e, #2d2d44)' : 'linear-gradient(135deg, #1a3a1a, #2d5a27)',
                            padding: '1rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: amcSubscription.planType === 'premium' ? '1px solid #d4af37' : '1px solid #4ade80'
                        }}>
                            <div>
                                <strong style={{ color: amcSubscription.planType === 'premium' ? '#d4af37' : '#4ade80' }}>
                                    {amcSubscription.planName}
                                </strong>
                                <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', opacity: 0.9 }}>
                                    Active until {amcSubscription.expiryDate?.toDate ? amcSubscription.expiryDate.toDate().toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{
                                    display: 'inline-block',
                                    padding: '4px 8px',
                                    background: 'rgba(255,255,255,0.2)',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {amcSubscription.vehicleNumber}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Inactive Alert */}
                    {isInactive && (
                        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ⚠️ <strong>Inactive Customer</strong> - Last visit was {lastVisit} (over 30 days ago)
                        </div>
                    )}

                    {/* Customer Stats */}
                    <div className="customer-stats-grid">
                        <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{bookings.length}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Total Visits</div>
                        </div>
                        <div style={{ background: '#dcfce7', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#166534' }}>{formatCurrency(totalSpend)}</div>
                            <div style={{ fontSize: '0.75rem', color: '#166534' }}>Total Spend</div>
                        </div>
                        <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--navy-700)' }}>{bookings.filter(b => b.status === 'completed').length}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Completed</div>
                        </div>
                        <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--navy-700)' }}>{lastVisit || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Last Visit</div>
                        </div>
                    </div>

                    <div className="customer-info-grid">
                        <div>
                            <h4 style={{ color: 'var(--navy-500)', marginBottom: '0.5rem' }}>Contact</h4>
                            <p><strong>{customer.name || 'N/A'}</strong></p>
                            <p><Phone size={14} /> {customer.phone}</p>
                            {customer.email && <p><Mail size={14} /> {customer.email}</p>}
                        </div>
                        <div>
                            <h4 style={{ color: 'var(--navy-500)', marginBottom: '0.5rem' }}>Vehicle</h4>
                            <p><Car size={14} /> {customer.carMake} {customer.carModel}</p>
                            <p><strong>{customer.licensePlate}</strong></p>
                        </div>
                    </div>

                    {/* Additional Details Row */}
                    {hasPermission('customers', 'edit') && (
                        <div className="customer-details-grid">
                            <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Membership Tier</label>
                                <select
                                    value={membershipTier}
                                    onChange={(e) => setMembershipTier(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                >
                                    <option value="bronze">Bronze</option>
                                    <option value="silver">Silver</option>
                                    <option value="gold">Gold</option>
                                    <option value="platinum">Platinum</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Preferred Contact</label>
                                <select
                                    value={preferredContact}
                                    onChange={(e) => setPreferredContact(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                >
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="call">Phone Call</option>
                                    <option value="sms">SMS</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Address</label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Customer address..."
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Recommended Services (Upsell) */}
                    {hasPermission('customers', 'view') && (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Star size={16} /> Recommended Services (Upsell)
                            </h4>

                            {/* Mapped services list */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                {recommendedServices.length === 0 ? (
                                    <span style={{ color: 'var(--navy-400)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                        No services mapped yet - add services to recommend to this customer
                                    </span>
                                ) : (
                                    recommendedServices.map(service => (
                                        <span key={service.id} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.25rem 0.5rem',
                                            background: 'var(--primary-light)',
                                            color: 'var(--primary)',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: '500'
                                        }}>
                                            {service.name}
                                            {hasPermission('customers', 'edit') && (
                                                <button
                                                    onClick={() => removeRecommendedService(service.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--danger)' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </span>
                                    ))
                                )}
                            </div>

                            {/* Add service dropdown */}
                            {hasPermission('customers', 'edit') && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select
                                        value={selectedServiceToAdd}
                                        onChange={(e) => setSelectedServiceToAdd(e.target.value)}
                                        style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                    >
                                        <option value="">Select service to recommend...</option>
                                        {services.filter(s => !recommendedServices.find(r => r.id === s.id)).map(service => (
                                            <option key={service.id} value={service.id}>{service.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={addRecommendedService}
                                        disabled={!selectedServiceToAdd}
                                        className="btn btn-sm btn-primary"
                                    >
                                        Add
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes & Tags with History */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div className="customer-history-grid">
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Tag size={14} /> Tags
                                    </h4>
                                    {tagHistory.length > 0 && (
                                        <button
                                            onClick={() => setShowTagHistory(!showTagHistory)}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                                        >
                                            <Clock size={12} /> {showTagHistory ? 'Hide' : 'Show'} History
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="VIP, Regular, New..."
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                    disabled={!hasPermission('customers', 'edit')}
                                />
                                {showTagHistory && tagHistory.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem', background: 'var(--navy-50)', padding: '0.5rem', borderRadius: '4px' }}>
                                        {tagHistory.slice(0, 5).map((entry, idx) => (
                                            <div key={idx} style={{ marginBottom: '0.25rem', borderBottom: '1px solid var(--navy-100)', paddingBottom: '0.25rem' }}>
                                                <strong>{entry.text}</strong>
                                                <div style={{ color: 'var(--navy-400)' }}>
                                                    {new Date(entry.savedAt).toLocaleDateString()} - {entry.savedBy}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <FileText size={14} /> Notes
                                    </h4>
                                    {noteHistory.length > 0 && (
                                        <button
                                            onClick={() => setShowNoteHistory(!showNoteHistory)}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                                        >
                                            <Clock size={12} /> {showNoteHistory ? 'Hide' : 'Show'} History
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Customer preferences..."
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                    disabled={!hasPermission('customers', 'edit')}
                                />
                                {showNoteHistory && noteHistory.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem', background: 'var(--navy-50)', padding: '0.5rem', borderRadius: '4px' }}>
                                        {noteHistory.slice(0, 5).map((entry, idx) => (
                                            <div key={idx} style={{ marginBottom: '0.25rem', borderBottom: '1px solid var(--navy-100)', paddingBottom: '0.25rem' }}>
                                                <strong>{entry.text}</strong>
                                                <div style={{ color: 'var(--navy-400)' }}>
                                                    {new Date(entry.savedAt).toLocaleDateString()} - {entry.savedBy}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {hasPermission('customers', 'edit') && (
                            <button className="btn btn-primary btn-sm" onClick={saveCustomerData} disabled={saving} style={{ marginTop: '0.75rem' }}>
                                {saving ? 'Saving...' : 'Save Customer Data'}
                            </button>
                        )}
                    </div>

                    {/* Last Services Used */}
                    {bookings.length > 0 && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>🕐 Last Services Used</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {[...new Map(
                                    bookings
                                        .filter(b => b.status === 'completed' && b.serviceName)
                                        .map(b => [b.serviceName, b])
                                ).values()]
                                    .slice(0, 5)
                                    .map((booking, idx) => (
                                        <span key={idx} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.25rem 0.5rem',
                                            background: 'white',
                                            border: '1px solid var(--navy-200)',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem'
                                        }}>
                                            {booking.serviceName}
                                            <span style={{ color: 'var(--navy-400)' }}>({booking.bookingDate})</span>
                                        </span>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    <h4 style={{ marginBottom: '0.75rem' }}>Booking History ({bookings.length})</h4>
                    {loading ? (
                        <div className="loader" style={{ margin: '1rem auto' }}></div>
                    ) : bookings.length === 0 ? (
                        <p style={{ color: 'var(--navy-500)' }}>No bookings found</p>
                    ) : (
                        <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Service</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bookings.slice(0, 10).map(booking => (
                                        <tr key={booking.id}>
                                            <td>{booking.bookingDate}</td>
                                            <td>{booking.serviceName}</td>
                                            <td>{formatCurrency(booking.price)}</td>
                                            <td>
                                                <span className={`badge badge-${booking.status?.replace('_', '-') || 'pending'}`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
            <style>{`
        @media (min-width: 769px) {
          .mobile-cards { display: none; }
          .desktop-table { display: block; }
        }

        @media (max-width: 768px) {
          .desktop-table { display: none; }
          .mobile-cards { display: block; }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
            padding: 1rem;
          }

          .header-actions {
            width: 100%;
            display: flex;
            gap: 0.5rem;
          }

          .header-actions .btn {
            flex: 1;
            justify-content: center;
          }

          .quick-stats-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            padding: 0 1rem;
          }

          .quick-stat-card {
            margin-bottom: 0;
            padding: 0.75rem;
          }

          .stat-value {
            font-size: 1.25rem;
          }

          .customer-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .customer-info-grid, 
          .customer-details-grid,
          .customer-history-grid {
            grid-template-columns: 1fr !important;
          }
          
          .modal-content.modal-lg {
            width: 95% !important;
            padding: 1rem !important;
            margin: 1rem auto !important;
          }
        }

        .customer-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .customer-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .customer-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .customer-history-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .booking-card {
          background: white;
          border: 1px solid var(--navy-100);
          border-radius: var(--radius-lg);
          padding: 1rem;
          margin-bottom: 0.75rem;
          box-shadow: var(--shadow-sm);
        }
        
        .booking-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--navy-100);
        }
        
        .booking-card-header strong {
          font-size: 1rem;
          color: var(--navy-800);
          display: block;
        }
        
        .booking-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .booking-card-body p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--navy-600);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .booking-card-body p svg {
          color: var(--navy-400);
          flex-shrink: 0;
        }
        
        .booking-card-footer {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--navy-100);
          flex-wrap: wrap;
        }
        
        .booking-card-footer .btn {
          flex: 1;
          justify-content: center;
          min-width: fit-content;
          white-space: nowrap;
        }
    `}</style>
        </div>
    );
};

export default Customers;
