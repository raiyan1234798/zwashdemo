import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
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
    serverTimestamp,
    increment,
    writeBatch
} from 'firebase/firestore';
import {
    generateAvailableStartTimes,
    getSettings,
    formatTime12Hour as formatTimeEngine
} from '../utils/schedulingEngine';
import { getNextInvoiceNumber, getNextBookingNumber } from '../utils/invoiceUtils';
import {
    ClipboardList,
    Plus,
    Search,
    Filter,
    Eye,
    Edit,
    Check,
    Clock,
    X,
    Phone,
    Car as CarIcon,
    Droplets,
    CheckCircle,
    Trash2,
    Archive,
    RotateCcw,
    MessageCircle
} from 'lucide-react';
import SplitPaymentSelector from '../components/SplitPaymentSelector';

const Bookings = () => {
    const { t } = useTranslation();
    const { hasPermission, userProfile, user } = useAuth();
    const { 
        currency: currentCurrencyCode, 
        currentCurrency,
        formatCurrency: globalFormatCurrency 
    } = useCurrency();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showCompletionModal, setShowCompletionModal] = useState(false);

    const [completingBooking, setCompletingBooking] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);

    // Filter view: active vs archived
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    useEffect(() => {
        if (userProfile?.companyId) {
            fetchBookings();
        }
    }, [filter, viewMode, currentCurrencyCode, userProfile?.companyId]);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            let q;

            if (viewMode === 'archived') {
                q = query(
                    collection(db, 'archivedBookings'),
                    where('companyId', '==', userProfile?.companyId || 'NA'),
                    orderBy('bookingDate', 'desc')
                );
            } else {
                if (filter === 'all') {
                    q = query(
                        collection(db, 'bookings'),
                        where('companyId', '==', userProfile?.companyId || 'NA'),
                        orderBy('bookingDate', 'desc')
                    );
                } else {
                    q = query(
                        collection(db, 'bookings'),
                        where('companyId', '==', userProfile?.companyId || 'NA'),
                        where('status', '==', filter),
                        orderBy('bookingDate', 'desc')
                    );
                }
            }

            const snapshot = await getDocs(q);
            const bookingsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBookings(bookingsList);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending_confirmation':
                return { label: t('pending'), class: 'badge-warning' };
            case 'confirmed':
                return { label: t('confirmed'), class: 'badge-info' };
            case 'in_progress':
                return { label: t('in_progress'), class: 'badge-primary' };
            case 'completed':
                return { label: t('completed'), class: 'badge-success' };
            case 'cancelled':
                return { label: t('cancelled'), class: 'badge-danger' };
            default:
                return { label: status || 'Unknown', class: 'badge-secondary' };
        }
    };

    const updateBookingStatus = async (bookingId, newStatus, completionData = null) => {
        try {
            const updateData = {
                status: newStatus,
                updatedAt: serverTimestamp()
            };

            if (newStatus === 'completed' && completionData) {
                updateData.completedAt = serverTimestamp();
                updateData.completedByName = userProfile?.name || t('staff');
                updateData.completedById = userProfile?.uid;
                if (completionData.materialsUsed) {
                    updateData.materialsUsed = completionData.materialsUsed;
                }
                if (completionData.totalMaterialCost) {
                    updateData.totalMaterialCost = completionData.totalMaterialCost;
                }
            }

            await updateDoc(doc(db, 'bookings', bookingId), updateData);
            fetchBookings();
        } catch (error) {
            console.error('Error updating booking status:', error);
        }
    };

    const handleCompleteClick = (booking) => {
        setCompletingBooking(booking);
        setShowCompletionModal(true);
    };

    const handleEditBooking = (booking) => {
        setEditingBooking(booking);
        setShowEditModal(true);
    };

    const handleRestoreBooking = async (booking) => {
        if (!window.confirm(t('restore_booking_confirm', { defaultValue: 'Are you sure you want to restore this archived booking?' }))) {
            return;
        }
        try {
            const batch = writeBatch(db);
            // Move back to bookings
            const activeRef = doc(db, 'bookings', booking.id);
            // Destructure to remove archivedAt from the active document
            const { archivedAt, ...rest } = booking;
            batch.set(activeRef, rest);
            // Delete from archives
            batch.delete(doc(db, 'archivedBookings', booking.id));
            await batch.commit();
            fetchBookings();
        } catch (error) {
            console.error('Error restoring booking:', error);
        }
    };



    const handleDeleteBooking = async (booking) => {
        if (viewMode === 'archived') {
            // Permanently delete from archive
            if (!window.confirm(t('delete_permanently_confirm', { defaultValue: 'Are you sure you want to permanently delete this booking? This cannot be undone.' }))) {
                return;
            }
            try {
                await deleteDoc(doc(db, 'archivedBookings', booking.id));
                fetchBookings();
            } catch (error) {
                console.error('Error deleting archived booking:', error);
            }
        } else {
            // Archive the booking
            if (!window.confirm(t('archive_booking_confirm', { defaultValue: 'Are you sure you want to archive this booking?' }))) {
                return;
            }
            try {
                const batch = writeBatch(db);
                // Add to archive
                const archiveRef = doc(db, 'archivedBookings', booking.id);
                batch.set(archiveRef, {
                    ...booking,
                    archivedAt: serverTimestamp()
                });
                // Delete from active bookings
                batch.delete(doc(db, 'bookings', booking.id));
                await batch.commit();
                fetchBookings();
            } catch (error) {
                console.error('Error archiving booking:', error);
            }
        }
    };

    const filteredBookings = bookings.filter(booking => {
        // Status Filter Fallback (Client-side)
        if (filter !== 'all' && booking.status !== filter) return false;

        // Date Range Filter
        if (dateFilter.start && booking.bookingDate < dateFilter.start) return false;
        if (dateFilter.end && booking.bookingDate > dateFilter.end) return false;

        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            booking.bookingReference?.toLowerCase().includes(search) ||
            booking.serviceName?.toLowerCase().includes(search) ||
            (booking.customerName && booking.customerName.toLowerCase().includes(search))
        );
    });

    const formatCurrency = (amount) => {
        return globalFormatCurrency(amount || 0);
    };

    return (
        <div className="bookings-page">
            <div className="page-header">
                <div>
                    <h1><ClipboardList size={28} /> {t('bookings')}</h1>
                    <p className="subtitle">{t('manage_all_bookings', { defaultValue: 'Manage all booking requests' })}</p>
                </div>
                <div className="header-actions">
                    {hasPermission('bookings', 'create') && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <Plus size={18} /> {t('add_walk_in')}
                        </button>
                    )}
                </div>
            </div>

            <div className="view-mode-tabs">
                <button
                    className={`btn ${viewMode === 'active' ? 'active' : ''}`}
                    onClick={() => setViewMode('active')}
                >
                    <ClipboardList size={16} />
                    {t('active_bookings_tab')}
                </button>
                <button
                    className={`btn ${viewMode === 'archived' ? 'active' : ''}`}
                    onClick={() => setViewMode('archived')}
                >
                    <Archive size={16} />
                    {t('archived_bookings_tab')}
                </button>
            </div>

            {/* Filters */}
            <div className="search-filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '250px' }}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder_bookings')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'white', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--navy-200)' }}>
                    <input
                        type="date"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--navy-700)', padding: '0.5rem' }}
                        title={t('start_date')}
                    />
                    <span style={{ color: 'var(--navy-400)' }}>{t('to')}</span>
                    <input
                        type="date"
                        value={dateFilter.end}
                        onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--navy-700)', padding: '0.5rem' }}
                        title={t('end_date')}
                    />
                    {(dateFilter.start || dateFilter.end) && (
                        <button
                            onClick={() => setDateFilter({ start: '', end: '' })}
                            style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '4px' }}
                            title={t('clear_date_filter')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <select
                    className="filter-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <option value="all">{t('all_status')}</option>
                    <option value="pending_confirmation">{t('pending')}</option>
                    <option value="confirmed">{t('confirmed')}</option>
                    <option value="in_progress">{t('in_progress')}</option>
                    <option value="completed">{t('completed')}</option>
                    <option value="cancelled">{t('cancelled')}</option>
                </select>
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'pending_confirmation').length}
                        </span>
                        <span className="stat-label">{t('pending')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'confirmed').length}
                        </span>
                        <span className="stat-label">{t('confirmed')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'in_progress').length}
                        </span>
                        <span className="stat-label">{t('in_progress')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'completed').length}
                        </span>
                        <span className="stat-label">{t('completed')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <CarIcon size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => ['hatchback', 'sedan', 'suv', 'luxury_suv'].includes(b.vehicleType)).length}
                        </span>
                        <span className="stat-label">{t('car_bookings')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <Droplets size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => ['scooter', 'bike', 'superbike'].includes(b.vehicleType)).length}
                        </span>
                        <span className="stat-label">{t('bike_bookings')}</span>
                    </div>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state">
                            <div className="loader"></div>
                            <p>{t('loading_bookings')}</p>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="empty-state">
                            <ClipboardList size={48} />
                            <p>{t('no_bookings_found')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="table-container desktop-table">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('reference')}</th>
                                            <th>{t('service')}</th>
                                            <th>{t('vehicle')}</th>
                                            <th>{t('date_time')}</th>
                                            <th>{t('amount')}</th>
                                            <th>{t('status')}</th>
                                            <th>{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map(booking => {
                                            const badge = getStatusBadge(booking.status);
                                            return (
                                                <tr key={booking.id}>
                                                    <td>
                                                        <strong>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                                                        <br />
                                                        <small style={{ fontSize: '0.7em', color: 'var(--navy-400)' }}>
                                                            {booking.createdByName ? `${t('by')}: ${booking.createdByName.split(' ')[0]}` : ''}
                                                        </small>
                                                        <br />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--navy-700)' }}>
                                                            {booking.customerName || t('na')}
                                                        </span>
                                                        {booking.assignedEmployeeName && (
                                                            <div style={{ marginTop: '4px', padding: '2px 6px', background: 'var(--navy-50)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--navy-600)', display: 'inline-block' }}>
                                                                👤 {booking.assignedEmployeeName}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{t(booking.serviceName)}</td>
                                                    <td>
                                                        {booking.carMake} {booking.carModel}
                                                    </td>
                                                    <td>{booking.bookingDate}<br />{booking.startTime}</td>
                                                    <td>{formatCurrency(booking.price)}</td>
                                                    <td>
                                                        {hasPermission('bookings', 'edit') && viewMode !== 'archived' ? (
                                                            <select
                                                                className={`badge ${badge.class}`}
                                                                value={booking.status}
                                                                onChange={(e) => {
                                                                    const newStatus = e.target.value;
                                                                    if (newStatus === 'completed') {
                                                                        handleCompleteClick(booking);
                                                                    } else {
                                                                        updateBookingStatus(booking.id, newStatus);
                                                                    }
                                                                }}
                                                                style={{ cursor: 'pointer', border: 'none', outline: 'none', appearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                                                            >
                                                                <option value="pending_confirmation">{t('pending')}</option>
                                                                <option value="confirmed">{t('confirmed')}</option>
                                                                <option value="in_progress">{t('in_progress')}</option>
                                                                <option value="completed">{t('completed')}</option>
                                                                <option value="cancelled">{t('cancelled')}</option>
                                                            </select>
                                                        ) : (
                                                            <span className={`badge ${badge.class}`}>{badge.label}</span>
                                                        )}
                                                        {booking.completedByName && booking.status === 'completed' && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                                                                {t('done')}: {booking.completedByName.split(' ')[0]}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                            <button
                                                                className="btn-icon"
                                                                title={t('view')}
                                                                onClick={() => setSelectedBooking(booking)}
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                            {hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && viewMode !== 'archived' && (
                                                                <button
                                                                    className="btn-icon"
                                                                    title={t('edit')}
                                                                    onClick={() => handleEditBooking(booking)}
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                            )}
                                                            {viewMode !== 'archived' && (
                                                                <>
                                                                    {hasPermission('bookings', 'edit') && booking.status === 'pending_confirmation' && (
                                                                        <button
                                                                            className="btn-icon"
                                                                            title={t('confirm')}
                                                                            onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                                                        >
                                                                            <Check size={16} />
                                                                        </button>
                                                                    )}
                                                                    {hasPermission('bookings', 'edit') && booking.status === 'confirmed' && (
                                                                        <button
                                                                            className="btn-icon"
                                                                            title={t('start')}
                                                                            onClick={() => updateBookingStatus(booking.id, 'in_progress')}
                                                                        >
                                                                            <Clock size={16} />
                                                                        </button>
                                                                    )}
                                                                    {hasPermission('bookings', 'edit') && booking.status === 'in_progress' && (
                                                                        <button
                                                                            className="btn-icon"
                                                                            title={t('complete')}
                                                                            onClick={() => handleCompleteClick(booking)}
                                                                            style={{ color: 'var(--success)' }}
                                                                        >
                                                                            <Check size={16} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {viewMode === 'archived' && (
                                                                <button
                                                                    className="btn-icon"
                                                                    title={t('restore')}
                                                                    onClick={() => handleRestoreBooking(booking)}
                                                                    style={{ color: 'var(--primary)' }}
                                                                >
                                                                    <RotateCcw size={16} />
                                                                </button>
                                                            )}
                                                            {hasPermission('bookings', 'delete') && (
                                                                <button
                                                                    className="btn-icon header-actions"
                                                                    title={viewMode === 'archived' ? t('delete_permanently') : t('archive')}
                                                                    onClick={() => handleDeleteBooking(booking)}
                                                                    style={{ color: 'var(--danger)' }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="mobile-cards">
                                {filteredBookings.map(booking => {
                                    const badge = getStatusBadge(booking.status);
                                    return (
                                        <div key={booking.id} className="booking-card">
                                            <div className="booking-card-header">
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)', marginTop: '2px' }}>
                                                        {booking.customerName || t('na')}
                                                    </span>
                                                </div>
                                                <span className={`badge ${badge.class}`}>{badge.label}</span>
                                            </div>
                                            <div className="booking-card-body">
                                                <p><CarIcon size={14} /> {booking.carMake} {booking.carModel}</p>
                                                <p><Clock size={14} /> {booking.bookingDate} at {booking.startTime}</p>
                                                <p><Droplets size={14} /> {t(booking.serviceName)}</p>
                                                {booking.assignedEmployeeName && (
                                                    <p style={{ color: 'var(--success)', fontWeight: '600' }}>👤 {booking.assignedEmployeeName}</p>
                                                )}
                                            </div>
                                            <div className="booking-card-footer">
                                                <button 
                                                    className="btn btn-sm btn-secondary" 
                                                    onClick={() => setSelectedBooking(booking)}
                                                >
                                                    {t('details')}
                                                </button>
                                                
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && viewMode !== 'archived' && (
                                                        <button
                                                            className="btn btn-sm btn-secondary icon-only"
                                                            onClick={() => handleEditBooking(booking)}
                                                            title={t('edit')}
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}
                                                    {viewMode !== 'archived' && hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => {
                                                                if (booking.status === 'in_progress') {
                                                                    handleCompleteClick(booking);
                                                                } else {
                                                                    const nextStatus = {
                                                                        'pending_confirmation': 'confirmed',
                                                                        'confirmed': 'in_progress'
                                                                    };
                                                                    updateBookingStatus(booking.id, nextStatus[booking.status]);
                                                                }
                                                            }}
                                                        >
                                                            {booking.status === 'pending_confirmation' ? t('confirm') :
                                                                booking.status === 'confirmed' ? t('start') : t('complete')}
                                                        </button>
                                                    )}
                                                    {viewMode === 'archived' && (
                                                        <button className="btn btn-sm btn-primary" onClick={() => handleRestoreBooking(booking)}>
                                                            <RotateCcw size={14} style={{ marginRight: '4px' }} /> {t('restore')}
                                                        </button>
                                                    )}
                                                    {hasPermission('bookings', 'delete') && (
                                                        <button
                                                            className="btn btn-sm btn-danger icon-only"
                                                            onClick={() => handleDeleteBooking(booking)}
                                                            title={viewMode === 'archived' ? t('delete_permanently') : t('archive')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Walk-in Modal - placeholder */}
            {showModal && (
                <WalkInModal onClose={() => setShowModal(false)} onSuccess={fetchBookings} />
            )}

            {/* Booking Details Modal */}
            {selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onStatusChange={updateBookingStatus}
                    onCompleteClick={handleCompleteClick}
                    onRefresh={fetchBookings}
                />
            )}

            {/* Completion Modal */}
            {showCompletionModal && completingBooking && (
                <CompletionModal
                    booking={completingBooking}
                    onClose={() => { setShowCompletionModal(false); setCompletingBooking(null); }}
                    onComplete={async (data) => {
                        // 1. Update Booking
                        await updateBookingStatus(completingBooking.id, 'completed', data);

                        // 2. Generate Invoice
                        try {
                            const sequentialInv = await getNextInvoiceNumber(db, data.paymentSplits || []);

                            const materialItems = (data.materialsUsed || []).map(m => ({
                                description: `Material: ${m.name}`,
                                quantity: m.quantity,
                                price: (m.cost / (m.quantity || 1)),
                                total: m.cost
                            }));

                            const invoiceItems = [
                                {
                                    description: t(completingBooking.serviceName),
                                    quantity: 1,
                                    price: Number(completingBooking.price || 0),
                                    total: Number(completingBooking.price || 0)
                                },
                                ...materialItems
                            ];

                            const finalTotal = Number(completingBooking.price || 0) + (data.totalMaterialCost || 0);

                            const paymentHistory = [{
                                date: new Date().toISOString(),
                                amount: finalTotal,
                                splits: (data.paymentSplits || []).map(s => ({ mode: s.mode, amount: Number(s.amount) || 0 })),
                                recordedBy: user?.uid || 'unknown',
                                note: 'Initial payment at completion'
                            }];

                            await addDoc(collection(db, 'invoices'), {
                                invoiceNumber: sequentialInv,
                                bookingId: completingBooking.id,
                                customerId: completingBooking.customerId || 'walk-in',
                                customerName: completingBooking.customerName || t('guest'),
                                customerPhone: 'HIDDEN',
                                vehicleNumber: 'DEMO',
                                type: 'Service',
                                items: invoiceItems,
                                subtotal: finalTotal,
                                total: finalTotal,
                                amountPaid: finalTotal,
                                balance: 0,
                                status: 'paid',
                                paymentHistory: paymentHistory,
                                paymentMode: (data.paymentSplits && data.paymentSplits[0]?.mode) || 'cash',
                                date: serverTimestamp(),
                                createdAt: serverTimestamp()
                            });
                        } catch (err) {
                            console.error("Error generating invoice:", err);
                        }

                        setShowCompletionModal(false);
                        setCompletingBooking(null);
                        fetchBookings();
                    }}
                />
            )}

            {/* Edit Booking Modal */}
            {showEditModal && editingBooking && (
                <BookingEditModal
                    booking={editingBooking}
                    onClose={() => { setShowEditModal(false); setEditingBooking(null); }}
                    onSuccess={fetchBookings}
                />
            )}

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
          }
          
          .header-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .search-filter-bar {
            flex-direction: column;
            align-items: stretch !important;
            gap: 0.75rem !important;
            padding: 1rem;
          }

          .search-box {
            width: 100% !important;
          }

          .filter-select {
            width: 100%;
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

          .booking-card {
            margin: 0 1rem 0.75rem 1rem;
          }

          .full-page-form {
            padding: 1rem;
          }
          .full-page-form-header h2 {
            font-size: 1.25rem;
          }
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

        .booking-card-footer .icon-only {
          flex: 0 0 auto;
          width: 40px;
        }

        .full-page-form {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: white;
          z-index: 2000;
          overflow-y: auto;
          padding: 2rem;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .full-page-form-container {
          max-width: 800px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }

        .full-page-form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--navy-100);
        }

        .full-page-form-header h2 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--navy-800);
        }

        .full-page-form-body {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .full-page-form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid var(--navy-100);
        }
    `}</style>
        </div >
    );
};

// Walk-in Booking Modal
const WalkInModal = ({ onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { user, userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState([]);
    const [vehicleType, setVehicleType] = useState('sedan');

    // Multi-service selection state
    const [selectedServices, setSelectedServices] = useState([]); // Array of full service objects
    const [currentServiceId, setCurrentServiceId] = useState(''); // Control for the dropdown
    const [extraTime, setExtraTime] = useState(0); // Manually added extra time in minutes

    // Custom Service State
    const [isCustomService, setIsCustomService] = useState(false);
    const [customServiceData, setCustomServiceData] = useState({ name: '', price: '', category: 'Custom' });

    // Duration-based scheduling states
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [settings, setSettings] = useState(null);

    // Customer search states
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showAddCustomer, setShowAddCustomer] = useState(false); // Toggle for adding new customer
    const [customerMode, setCustomerMode] = useState('existing'); // 'existing' | 'new'
    const [formData, setFormData] = useState({
        customerName: '',
        carMake: '',
        carModel: '',
        licensePlate: '',
        phone: '',
        location: '',
        bookingDate: new Date().toISOString().split('T')[0],
        startTime: ''
    });
    const [employees, setEmployees] = useState([]);
    const [assignedEmployees, setAssignedEmployees] = useState([]);
    const [plateError, setPlateError] = useState('');

    // Validate TN license plate: TN-XX-YY-XXXX
    const validatePlate = (val) => {
        return ''; // Validation removed
    };

    const handlePlateChange = (val) => {
        setFormData(prev => ({ ...prev, licensePlate: val }));
        setPlateError(validatePlate(val));
    };

    // Advance Payment State
    const [paymentSplits, setPaymentSplits] = useState([{ mode: 'cash', amount: '' }]);

    useEffect(() => {
        fetchServices();
        fetchCustomers();
        loadSettings();
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const q = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const empList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => {
                    const role = (u.role || '').toLowerCase();
                    const validRoles = ['admin', 'manager', 'senior_employee', 'employee', 'worker', 'staff'];
                    return validRoles.includes(role);
                });
            setEmployees(empList);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    // Load settings once
    const loadSettings = async () => {
        const s = await getSettings(db);
        setSettings(s);
    };



    // Regenerate slots when date OR selected services change
    useEffect(() => {
        if (formData.bookingDate && selectedServices.length > 0) {
            generateDynamicSlots();
        } else if (selectedServices.length === 0) {
            setAvailableSlots([]);
        }
    }, [formData.bookingDate, selectedServices, settings, extraTime]); // Deep dependency on selectedServices length/content, added extraTime

    // Helper: Get price for a specific service and current vehicle type
    const getServicePrice = (service) => {
        if (!service) return 0;
        const price = service.prices?.[vehicleType];
        return price !== undefined ? Number(price) : Number(service.price || 0);
    };

    // Derived totals
    const totalPrice = selectedServices.reduce((sum, s) => sum + getServicePrice(s), 0);
    const baseDuration = selectedServices.reduce((sum, s) => sum + (Number(s.durationMinutes) || 30), 0);
    const hasMultiServiceBuffer = selectedServices.length > 1;
    const multiServiceBuffer = hasMultiServiceBuffer ? 30 : 0; // 30 min lock for multi-service
    const totalDuration = baseDuration + multiServiceBuffer + extraTime;

    // Generate slots using the duration-based scheduling engine
    const generateDynamicSlots = async () => {
        if (!formData.bookingDate || selectedServices.length === 0) {
            setAvailableSlots([]);
            return;
        }

        try {
            setSlotsLoading(true);

            // Create a "composite" service object to represent the combined booking
            const compositeService = {
                name: selectedServices.map(s => s.name).join(' + '),
                durationMinutes: totalDuration,
                // Use the category of the first service for conflict resolution rule (e.g. blocking same category)
                category: selectedServices[0].category || 'Detailed Wash'
            };

            // Use the scheduling engine to generate available times
            const slots = await generateAvailableStartTimes({
                db,
                dateStr: formData.bookingDate,
                service: compositeService,
                settings: settings
            });

            setAvailableSlots(slots);

            // Clear selected time if it's no longer available
            if (formData.startTime && !slots.find(s => s.time === formData.startTime && s.available)) {
                setFormData(prev => ({ ...prev, startTime: '' }));
            }
        } catch (error) {
            console.error('Error generating available slots:', error);
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    };

    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const fetchServices = async () => {
        try {
            const servicesRef = collection(db, 'services');
            const q = query(servicesRef, where('isActive', '==', true));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            setServices(data);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            // Fetch explicit customers
            const customersQuery = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
            const customersSnapshot = await getDocs(customersQuery);
            const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'customers' }));

            // Fetch implicit customers from bookings history
            const bookingsQuery = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
            const bookingsSnapshot = await getDocs(bookingsQuery);

            // Create a map of unique customers by phone or license plate
            const customerMap = new Map();

            // Add explicit customers first (they take precedence)
            customersData.forEach(c => {
                const key = c.customerName;
                if (key) customerMap.set(key, c);
            });

            // Add customers from bookings if not already in map
            bookingsSnapshot.docs.forEach(doc => {
                const booking = doc.data();
                const key = booking.customerName;
                if (key && !customerMap.has(key)) {
                    customerMap.set(key, {
                        id: `booking-${doc.id}`,
                        name: booking.customerName || booking.contactName || 'Walk-in Customer',
                        phone: booking.contactPhone || '',
                        email: booking.contactEmail || '',
                        carMake: booking.carMake || '',
                        carModel: booking.carModel || '',
                        licensePlate: 'DEMO',
                        source: 'booking',
                        createdAt: booking.createdAt,
                        // Infer vehicle type if possible, or leave undefined
                    });
                }
            });

            // Convert map to array
            const allCustomers = Array.from(customerMap.values());
            setCustomers(allCustomers);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    // Filter customers by search term - searches by vehicle number, phone, and name
    // Shows ALL customers when no search term, filters when typing
    const filteredCustomers = customers.filter(c => {
        const search = customerSearch.toLowerCase().trim();

        // Show ALL customers when search is empty
        if (!search) return true;

        // Normalize search and data for robust matching
        const searchClean = search.replace(/[^a-z0-9]/g, '');
        const searchDigits = search.replace(/[^0-9]/g, '');

        // Search by license plate (vehicle number) - clean both for comparison
        const licensePlateMatch = false;

        // Search by phone number - match any digits
        const phoneMatch = false;

        // Search by customer name - partial match
        const nameMatch = (c.name || '').toLowerCase().includes(search);

        // Search by car make/model
        const carMakeMatch = (c.carMake || '').toLowerCase().includes(search);
        const carModelMatch = (c.carModel || '').toLowerCase().includes(search);

        return nameMatch || carMakeMatch || carModelMatch;
    });
    
    // Group filtered customers by vehicle type for better UI organization
    const groupedCustomersByVehicle = filteredCustomers.reduce((acc, customer) => {
        const type = (customer.vehicleType || 'other').toLowerCase();
        if (!acc[type]) acc[type] = [];
        acc[type].push(customer);
        return acc;
    }, {});

    // Vehicle type display order and labels
    const vehicleTypeOrder = ['hatchback', 'sedan', 'suv', 'luxury_suv', 'scooter', 'bike', 'superbike', 'other'];
    const vehicleTypeLabels = {
        hatchback: `🚗 ${t('hatchback')}`,
        sedan: `🚙 ${t('sedan')}`,
        suv: `🚐 ${t('suv')}`,
        luxury_suv: `🏎️ ${t('luxury_suv')}`,
        scooter: `🛵 ${t('scooter')}`,
        bike: `🏍️ ${t('bike')}`,
        superbike: `🏍️ ${t('superbike')}`,
        other: `🚘 ${t('other')}`
    };

    const selectCustomer = (customer) => {
        // Preserve existing bookingDate and startTime when selecting a customer
        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            customerName: customer.name || '',
            carMake: customer.carMake || '',
            carModel: customer.carModel || '',
            licensePlate: 'DEMO',
            phone: 'HIDDEN'
        }));
        // Also set the vehicle type from customer if available
        if (customer.vehicleType) {
            setVehicleType(customer.vehicleType);
        }
        setCustomerSearch('');
        setShowCustomerDropdown(false);
    };

    // Group services by category (Filtered by availability for vehicle type)
    const groupedServices = services
        .filter(service => getServicePrice(service) > 0) // Only show services with valid price for selected info
        .reduce((acc, service) => {
            const cat = service.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(service);
            return acc;
        }, {});

    const handleAddService = (serviceId) => {
        if (serviceId === 'custom') {
            setIsCustomService(true);
            setCurrentServiceId('custom');
            return;
        }

        if (!serviceId) return;

        // Prevent duplicates
        if (selectedServices.find(s => s.id === serviceId)) {
            alert('Service already added');
            return;
        }

        const service = services.find(s => s.id === serviceId);
        if (service) {
            setSelectedServices(prev => [...prev, service]);
            setCurrentServiceId(''); // Reset dropdown
        }
    };

    const handleAddCustomService = () => {
        if (!customServiceData.name || !customServiceData.price) {
            alert('Please enter service name and price');
            return;
        }

        const newService = {
            id: `custom-${Date.now()}`,
            name: customServiceData.name,
            price: Number(customServiceData.price),
            durationMinutes: 30, // Default duration
            isCustom: true,
            category: 'Custom'
        };

        setSelectedServices(prev => [...prev, newService]);
        setCustomServiceData({ name: '', price: '', category: 'Custom' });
        setIsCustomService(false);
        setCurrentServiceId('');
    };

    const handleRemoveService = (serviceId) => {
        setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
    };

    const saveNewCustomer = async () => {
        if (!formData.customerName || !formData.phone) {
            alert('Please fill in Name and Phone to save customer.');
            return;
        }

        try {
            setLoading(true);
            await addDoc(collection(db, 'customers'), {
                name: formData.customerName,
                phone: 'HIDDEN',
                licensePlate: 'DEMO',
                carMake: formData.carMake,
                carModel: formData.carModel,
                bookingCount: 1,
                createdAt: serverTimestamp(),
                vehicleType: vehicleType
            });

            // Refresh customers list
            fetchCustomers();

            alert('Customer added to database successfully!');
            setShowAddCustomer(false);
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Failed to save customer');
        } finally {
            setLoading(false);
        }
    };

    // Update prices when vehicle type changes (re-calculate totals automatically via derived state)
    // No explicit effect needed since we calculate total on render using vehicleType state

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedServices.length === 0) {
            alert('Please select at least one service');
            return;
        }
        if (!formData.startTime) {
            alert('Please select a start time');
            return;
        }

        setLoading(true);

        try {
            const bookingRef = await getNextBookingNumber(db, formData.bookingDate);
            // Calculate payment status
            const currentPaymentTotal = paymentSplits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
            const balanceAmt = totalPrice - currentPaymentTotal;
            let paymentStatus = 'unpaid';
            if (currentPaymentTotal >= totalPrice) {
                paymentStatus = 'paid';
            } else if (currentPaymentTotal > 0) {
                paymentStatus = 'partial';
            }

            const paymentHistory = currentPaymentTotal > 0 ? [{
                date: new Date().toISOString(),
                amount: currentPaymentTotal,
                splits: paymentSplits.filter(s => Number(s.amount) > 0).map(s => ({ mode: s.mode, amount: Number(s.amount) })),
                recordedBy: user?.uid || 'unknown',
                note: 'Advance payment at booking'
            }] : [];

            // Auto-save new customer to database if we're in new customer mode
            let customerIdToLink = formData.customerId || null;
            if (customerMode === 'new' && formData.customerName) {
                try {
                    const newCustomerRef = await addDoc(collection(db, 'customers'), {
                        name: formData.customerName,
                        carMake: formData.carMake,
                        carModel: formData.carModel,
                        bookingCount: 1,
                        createdAt: serverTimestamp(),
                        vehicleType: vehicleType
                    });
                    customerIdToLink = newCustomerRef.id;
                } catch (customerErr) {
                    console.warn('Could not save customer to DB:', customerErr);
                    // Don't block booking creation if customer save fails
                }
            }

            const companyIdForBooking = userProfile?.companyId || userProfile?.uid || 'default';
            await addDoc(collection(db, 'bookings'), {
                bookingReference: bookingRef,
                createdBy: user?.uid || 'unknown',
                createdByName: userProfile?.displayName || user?.email || 'Staff',
                companyId: companyIdForBooking,
                serviceId: selectedServices[0].id,
                serviceIds: selectedServices.map(s => s.id),
                serviceName: selectedServices.map(s => s.name).join(' + '),
                serviceCategory: selectedServices[0].category || 'Detailed Wash',
                serviceBreakdown: selectedServices.map(s => ({
                    name: s.name,
                    price: getServicePrice(s),
                    quantity: 1
                })),
                serviceDuration: totalDuration,
                extraTime: extraTime,
                price: totalPrice,
                totalAmount: totalPrice,
                advancePayment: currentPaymentTotal,
                balanceAmount: balanceAmt,
                paymentStatus: paymentStatus,
                paymentHistory,
                paymentMode: paymentSplits[0]?.mode || 'cash',
                vehicleType: vehicleType,
                bookingDate: formData.bookingDate,
                startTime: formData.startTime || new Date().toTimeString().slice(0, 5),
                customerId: customerIdToLink,
                customerName: formData.customerName,
                carMake: formData.carMake,
                carModel: formData.carModel,
                location: formData.location || '',
                assignedEmployees: assignedEmployees,
                assignedEmployeeName: employees.filter(e => assignedEmployees.includes(e.id)).map(e => e.displayName).join(', '),
                status: 'in_progress',
                isWalkIn: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating walk-in booking:', error);
            alert('Error creating booking: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="full-page-form">
            <div className="full-page-form-container">
                <div className="full-page-form-header">
                    <h2><Plus size={20} /> {t('add_walk_in')}</h2>
                    <button className="btn btn-secondary" onClick={onClose}>← {t('cancel')}</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="full-page-form-body">

                        {/* STEP 1: Customer Details */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '1rem', color: '#166534', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>🔍 Step 1: Customer Details</label>

                            <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button
                                    type="button"
                                    className={`btn ${customerMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setCustomerMode('existing')}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    <Search size={16} /> Select Existing
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${customerMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setCustomerMode('new')}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    <Plus size={16} /> New Customer
                                </button>
                            </div>

                            {/* MODE: EXISTING CUSTOMER SEARCH */}
                            {customerMode === 'existing' && (
                                <>
                                    <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #86efac' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <label style={{ marginBottom: 0, fontWeight: '600', fontSize: '0.9rem', color: '#166534' }}>Search Database</label>
                                        <span style={{ fontSize: '0.75rem', color: '#166534', background: '#bbf7d0', padding: '2px 8px', borderRadius: '12px' }}>{customers.length} customers</span>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder={t('search_customers_placeholder', { defaultValue: "Search by name, phone or plate..." })}
                                            value={customerSearch}
                                            onChange={(e) => handleCustomerSearch(e.target.value)}
                                            onFocus={() => setShowCustomerDropdown(true)}
                                            style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '10px', border: '2px solid #86efac', fontSize: '1rem', background: 'white' }}
                                        />
                                        {customerSearch && (
                                            <button
                                                    type="button"
                                                    onClick={() => { setCustomerSearch(''); setShowCustomerDropdown(false); }}
                                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#166534', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
                                                    title="Clear search"
                                                >
                                                    <X size={20} />
                                                </button>
                                            )}
                                        </div>
                                        {showCustomerDropdown && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--navy-200)', borderRadius: '8px', maxHeight: '350px', overflowY: 'auto', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: '4px' }}>
                                                <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--navy-600)', borderBottom: '1px solid #eee', background: 'var(--navy-50)', position: 'sticky', top: 0, zIndex: 1 }}>
                                                    📋 {filteredCustomers.length} of {customers.length} customers {customerSearch && `matching "${customerSearch}"`}
                                                </div>
                                                {filteredCustomers.length === 0 ? (
                                                    <div style={{ padding: '16px', color: 'var(--navy-400)', textAlign: 'center' }}>No customers found matching "{customerSearch}"</div>
                                                ) : (
                                                    vehicleTypeOrder.filter(type => groupedCustomersByVehicle[type]?.length > 0).map(type => (
                                                        <div key={type}>
                                                            <div style={{ padding: '6px 12px', background: '#f1f5f9', fontWeight: '600', fontSize: '0.8rem', color: '#475569', position: 'sticky', top: '36px' }}>{vehicleTypeLabels[type] || type} ({groupedCustomersByVehicle[type].length})</div>
                                                            {groupedCustomersByVehicle[type].map(c => (
                                                                <div key={c.id} onClick={() => { selectCustomer(c); setShowCustomerDropdown(false); }} style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseOver={(e) => e.currentTarget.style.background = '#ecfdf5'} onMouseOut={(e) => e.currentTarget.style.background = 'white'}>
                                                                    <div><div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>{c.name || 'Unnamed'}</div></div>
                                                                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#059669' }}>{c.carMake} {c.carModel}</div></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    {formData.customerId && (
                                        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'white', borderRadius: '8px', fontSize: '0.9rem', color: '#166534', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div><strong>{formData.customerName}</strong></div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{formData.carMake} {formData.carModel}</div>
                                            </div>
                                            <button type="button" className="btn-sm btn-outline" onClick={() => setCustomerMode('new')} title={t('edit_details')}>{t('edit')}</button>
                                        </div>
                                    )}
                                    {/* Location field for existing customer */}
                                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                                        <label>{t('location_optional')}</label>
                                        <input
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder={t('area_city_placeholder')}
                                            style={{ background: 'white' }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                            {/* MODE: NEW CUSTOMER / EDIT FORM */}
                            {customerMode === 'new' && (
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                                    <div className="form-group">
                                        <label>{t('customer_name_required')}</label>
                                        <input
                                            value={formData.customerName}
                                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                            placeholder={t('enter_customer_name')}
                                            required
                                            style={{ background: 'white' }}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>{t('car_make_required')}</label>
                                            <input
                                                value={formData.carMake}
                                                onChange={(e) => setFormData({ ...formData, carMake: e.target.value })}
                                                required
                                                placeholder="Toyota"
                                                style={{ background: 'white' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('car_model_required')}</label>
                                            <input
                                                value={formData.carModel}
                                                onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                                                required
                                                placeholder="Camry"
                                                style={{ background: 'white' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* STEP 2: Vehicle Type Selection */}
                        <div className="form-group" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', marginBottom: '0.75rem', display: 'block' }}>🚗 Step 2: Vehicle Type Selection</label>
                            <div className="vehicle-type-sections">
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <small style={{ fontWeight: '600', color: 'var(--navy-500)', display: 'block', marginBottom: '0.25rem' }}>Four Wheelers</small>
                                    <div className="vehicle-type-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {['hatchback', 'sedan', 'suv', 'luxury_suv'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`vehicle-type-btn ${vehicleType === type ? 'active' : ''}`}
                                                onClick={() => setVehicleType(type)}
                                                style={{
                                                    padding: '0.6rem',
                                                    border: vehicleType === type ? '2px solid var(--primary)' : '1px solid var(--navy-200)',
                                                    borderRadius: '8px',
                                                    background: vehicleType === type ? 'var(--primary-light)' : 'white',
                                                    color: vehicleType === type ? 'var(--primary)' : 'var(--navy-600)',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize',
                                                    transition: 'all 0.2s ease',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {type.replace('_', ' ').replace('luxury suv', 'L-SUV')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <small style={{ fontWeight: '600', color: 'var(--navy-500)', display: 'block', marginBottom: '0.25rem' }}>Two Wheelers</small>
                                    <div className="vehicle-type-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
                                        {['scooter', 'bike', 'superbike'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`vehicle-type-btn ${vehicleType === type ? 'active' : ''}`}
                                                onClick={() => setVehicleType(type)}
                                                style={{
                                                    padding: '0.6rem',
                                                    border: vehicleType === type ? '2px solid var(--primary)' : '1px solid var(--navy-200)',
                                                    borderRadius: '8px',
                                                    background: vehicleType === type ? 'var(--primary-light)' : 'white',
                                                    color: vehicleType === type ? 'var(--primary)' : 'var(--navy-600)',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize',
                                                    transition: 'all 0.2s ease',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {type.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* STEP 3: Service Selection */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>🛠️ Step 3: Service Selection</label>

                            {/* Extra Time Input moved to top as per request (though implementation keeps logical flow, UI shows "Add Extra Time" button near time field now) */}
                            {/* Keeping the legacy/full extra time selector if user wants granular control for extensive work */}
                            <div className="form-group" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '6px' }}>
                                <label style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Add Extra Time (for extensive work)</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[0, 30, 60, 90, 120, 180, 240].map(mins => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setExtraTime(mins)}
                                            className={extraTime === mins ? 'btn-primary' : 'btn-secondary'}
                                            style={{
                                                fontSize: '0.8rem',
                                                padding: '4px 8px',
                                                background: extraTime === mins ? 'var(--primary)' : 'white'
                                            }}
                                        >
                                            {mins === 0 ? 'None' : mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        placeholder="Custom"
                                        value={extraTime}
                                        onChange={e => setExtraTime(Number(e.target.value))}
                                        style={{ width: '80px', padding: '4px 8px', fontSize: '0.8rem' }}
                                    />
                                </div>
                            </div>

                            {/* Selected Services List */}
                            {selectedServices.length > 0 && (
                                <div className="selected-services-list" style={{ marginBottom: '1rem' }}>
                                    {selectedServices.map((service, index) => (
                                        <div key={`${service.id}-${index}`} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.5rem 0.75rem',
                                            background: 'var(--navy-50)',
                                            borderRadius: '6px',
                                            marginBottom: '0.5rem',
                                            border: '1px solid var(--navy-100)'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{service.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>
                                                    {service.durationMinutes || 30} mins • {globalFormatCurrency(getServicePrice(service))}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveService(service.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--danger)',
                                                    cursor: 'pointer',
                                                    padding: '4px'
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Totals Summary */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '0.75rem',
                                        background: 'var(--primary-light)',
                                        borderRadius: '6px',
                                        fontWeight: '600',
                                        color: 'var(--primary-dark)',
                                        marginTop: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Total</span>
                                            <span style={{ textAlign: 'right' }}>
                                                {totalDuration} mins • {globalFormatCurrency(totalPrice)}
                                            </span>
                                        </div>
                                        {hasMultiServiceBuffer && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                marginTop: '0.25rem',
                                                fontWeight: '400',
                                                color: 'var(--navy-600)'
                                            }}>
                                                ⏱️ Includes 30 min buffer for multi-service booking
                                            </div>
                                        )}
                                        {extraTime > 0 && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                marginTop: '0.1rem',
                                                fontWeight: '400',
                                                color: 'var(--navy-600)'
                                            }}>
                                                ➕ Includes {extraTime} min extra time
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Service Adder Dropdown */}
                            {!isCustomService ? (
                                <select
                                    value={currentServiceId}
                                    onChange={(e) => handleAddService(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--navy-200)' }}
                                >
                                    <option value="">+ Add Service</option>
                                    <option value="custom">✨ Add Custom Service (Manual Entry)</option>
                                    {Object.entries(groupedServices).map(([category, categoryServices]) => {
                                        // Filter services valid for this vehicle type
                                        const validServices = categoryServices.filter(s => {
                                            if (s.prices && s.prices[vehicleType] !== undefined) {
                                                return s.prices[vehicleType] > 0;
                                            }
                                            return true;
                                        });

                                        if (validServices.length === 0) return null;

                                        return (
                                            <optgroup key={category} label={category}>
                                                {validServices.map(service => {
                                                    const isSelected = selectedServices.some(s => s.id === service.id);
                                                    return (
                                                        <option
                                                            key={service.id}
                                                            value={service.id}
                                                            disabled={isSelected}
                                                        >
                                                            {service.name} ({service.durationMinutes || 30}m - {globalFormatCurrency(getServicePrice(service))}) {isSelected ? '✓' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                            ) : (
                                <div className="custom-service-form" style={{
                                    padding: '1rem',
                                    background: 'var(--navy-50)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--primary)'
                                }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Add Custom Service</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input
                                            placeholder="Service Name"
                                            value={customServiceData.name}
                                            onChange={e => setCustomServiceData({ ...customServiceData, name: e.target.value })}
                                            style={{ flex: 2 }}
                                            autoFocus
                                        />
                                        <input
                                            placeholder={`Price (${currentCurrency.symbol})`}
                                            type="number"
                                            value={customServiceData.price}
                                            onChange={e => setCustomServiceData({ ...customServiceData, price: e.target.value })}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={handleAddCustomService}
                                            style={{ flex: 1 }}
                                        >
                                            Add Service
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { setIsCustomService(false); setCurrentServiceId(''); }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* STEP 4: Select Date & Time */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>📅 Step 4: Select Date & Time</label>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={formData.bookingDate}
                                        onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        Time
                                        <button
                                            type="button"
                                            className="btn-link"
                                            onClick={() => {
                                                const currentVal = prompt("Add extra duration (minutes):", "0");
                                                if (currentVal && !isNaN(currentVal)) {
                                                    setExtraTime(Number(currentVal));
                                                }
                                            }}
                                            style={{
                                                background: 'none', border: 'none', color: 'var(--primary)',
                                                fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline'
                                            }}
                                        >
                                            + Extra Time {extraTime > 0 ? `(${extraTime}m)` : ''}
                                        </button>
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Dynamic Available Slots - Duration Based */}
                            <div className="slots-container" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                    Available Times {selectedServices.length > 0 && <span style={{ fontWeight: '400', color: 'var(--navy-500)' }}>({totalDuration} min service)</span>}
                                </label>

                                {selectedServices.length === 0 ? (
                                    <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center', color: 'var(--navy-500)' }}>
                                        ⬆️ Please select a service first to see available times
                                    </div>
                                ) : slotsLoading ? (
                                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div className="loader is-small"></div>
                                        <p style={{ marginTop: '0.5rem', color: 'var(--navy-500)' }}>Calculating available times...</p>
                                    </div>
                                ) : availableSlots.length === 0 ? (
                                    <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', textAlign: 'center', color: '#991b1b' }}>
                                        ❌ No available time slots for this date and service duration
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                                        {availableSlots.map((slot, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                disabled={!slot.available}
                                                onClick={() => slot.available && setFormData({ ...formData, startTime: slot.time })}
                                                style={{
                                                    padding: '0.6rem 0.4rem',
                                                    borderRadius: '8px',
                                                    border: '2px solid',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '500',
                                                    cursor: slot.available ? 'pointer' : 'not-allowed',
                                                    background: !slot.available
                                                        ? '#fee2e2' // Light red for booked
                                                        : formData.startTime === slot.time ? 'var(--success)' : 'white',
                                                    borderColor: !slot.available
                                                        ? '#ef4444' // Red border
                                                        : formData.startTime === slot.time ? 'var(--success)' : 'var(--navy-200)',
                                                    color: !slot.available
                                                        ? '#b91c1c' // Dark red text
                                                        : formData.startTime === slot.time ? 'white' : 'var(--navy-700)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={!slot.available ? (slot.reason || 'Unavailable') : `Blocks until ${slot.blockedUntil}`}
                                            >
                                                {slot.display}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedServices.length > 0 && availableSlots.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--navy-500)' }}>
                                        ℹ️ Showing {availableSlots.length} available start times. Times account for service duration + buffer.
                                    </div>
                                )}
                            </div>
                        </div>



                        {/* Payment Section */}
                        {selectedServices.length > 0 && (
                            <div style={{
                                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginTop: '1rem',
                                border: '1px solid #86efac'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: '600', color: '#166534' }}>{t('total_amount_label')}</span>
                                    <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#166534' }}>{globalFormatCurrency(totalPrice)}</span>
                                </div>

                                <SplitPaymentSelector
                                    splits={paymentSplits}
                                    onAddSplit={() => setPaymentSplits([...paymentSplits, { mode: 'cash', amount: '' }])}
                                    onRemoveSplit={(idx) => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                                    onSplitChange={(idx, field, val) => {
                                        const newSplits = [...paymentSplits];
                                        newSplits[idx][field] = val;
                                        setPaymentSplits(newSplits);
                                    }}
                                    totalAmount={totalPrice}
                                />

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: '0.5rem',
                                    borderTop: '1px dashed #86efac',
                                    marginTop: '0.5rem'
                                }}>
                                    <span style={{ fontWeight: '500', color: '#166534' }}>{t('balance_due_label')}</span>
                                    <span style={{
                                        fontWeight: '700',
                                        fontSize: '1.1rem',
                                        color: (totalPrice - paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)) > 0 ? '#dc2626' : '#166534'
                                    }}>
                                        {globalFormatCurrency(totalPrice - paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0))}
                                    </span>
                                </div>

                                {paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) > 0 && paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) < totalPrice && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        background: '#fef3c7',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        color: '#92400e',
                                        textAlign: 'center'
                                    }}>
                                        {t('partial_payment_warning')}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 5: Assign Employees */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>👥 {t('step_5_assign_employees')}</label>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--navy-200)' }}>
                                {employees.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-400)', textAlign: 'center', padding: '1rem' }}>{t('loading_employees')}...</p>
                                ) : (
                                    employees.map(emp => (
                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid var(--navy-50)' }}>
                                            <input
                                                type="checkbox"
                                                checked={assignedEmployees.includes(emp.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAssignedEmployees([...assignedEmployees, emp.id]);
                                                    } else {
                                                        setAssignedEmployees(assignedEmployees.filter(id => id !== emp.id));
                                                    }
                                                }}
                                            />
                                            <div>
                                                <span style={{ fontWeight: '600' }}>{emp.displayName}</span>
                                                <small style={{ color: 'var(--navy-400)', marginLeft: '0.5rem' }}>({emp.role})</small>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="full-page-form-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? t('creating_booking') : t('create_booking_btn')}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
};

// Booking Details Modal - Enhanced with Employee Assignment, Reschedule, Notes, WhatsApp
const BookingDetailsModal = ({ booking, onClose, onStatusChange, onCompleteClick, onRefresh }) => {
    const { t } = useTranslation();
    const { formatCurrency: globalFormatCurrency } = useCurrency();
    const { hasPermission } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [assignedEmployees, setAssignedEmployees] = useState(booking.assignedEmployees || (booking.assignedEmployee ? [booking.assignedEmployee] : []));
    const [notes, setNotes] = useState(booking.notes || '');
    const [showReschedule, setShowReschedule] = useState(false);
    const [newDate, setNewDate] = useState(booking.bookingDate || '');
    const [newTime, setNewTime] = useState(booking.startTime || '');
    const [saving, setSaving] = useState(false);

    const badge = {
        'pending_confirmation': { class: 'badge-pending', label: t('pending') },
        'confirmed': { class: 'badge-confirmed', label: t('confirmed') },
        'in_progress': { class: 'badge-progress', label: t('in_progress') },
        'completed': { class: 'badge-completed', label: t('completed') },
        'cancelled': { class: 'badge-cancelled', label: t('cancelled') }
    }[booking.status] || { class: 'badge-pending', label: booking.status };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const q = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const empList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => {
                    const role = (u.role || '').toLowerCase();
                    const validRoles = ['admin', 'manager', 'senior_employee', 'employee', 'worker', 'staff'];
                    return validRoles.includes(role);
                });
            setEmployees(empList);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const saveAssignment = async () => {
        try {
            setSaving(true);
            const selectedEmps = employees.filter(e => assignedEmployees.includes(e.id));
            const names = selectedEmps.map(e => e.displayName).join(', ');

            await updateDoc(doc(db, 'bookings', booking.id), {
                assignedEmployees: assignedEmployees, // Store array of IDs
                assignedEmployeeName: names, // Store joined names for display
                updatedAt: serverTimestamp()
            });
            alert('Employees assigned successfully!');
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error assigning employee:', error);
        } finally {
            setSaving(false);
        }
    };

    const saveNotes = async () => {
        try {
            setSaving(true);
            await updateDoc(doc(db, 'bookings', booking.id), {
                notes: notes,
                updatedAt: serverTimestamp()
            });
            alert('Notes saved!');
        } catch (error) {
            console.error('Error saving notes:', error);
        } finally {
            setSaving(false);
        }
    };

    const rescheduleBooking = async () => {
        try {
            setSaving(true);
            await updateDoc(doc(db, 'bookings', booking.id), {
                bookingDate: newDate,
                startTime: newTime,
                updatedAt: serverTimestamp()
            });
            alert('Booking rescheduled successfully!');
            setShowReschedule(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error rescheduling:', error);
        } finally {
            setSaving(false);
        }
    };
    const sendWhatsAppReminder = () => {
        const phone = booking.customerPhone || booking.phone;
        const message = `Hello ${booking.customerName || 'Customer'}, this is a reminder for your booking (${booking.bookingReference || booking.id.slice(0, 8)}) at Zwash. Looking forward to seeing you!`;
        
        if (!phone || phone === 'HIDDEN') {
            const manualPhone = prompt('Please enter the customer phone number (with country code):', '');
            if (manualPhone) {
                const cleanPhone = manualPhone.replace(/\D/g, '');
                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
            }
        } else {
            const cleanPhone = phone.replace(/\D/g, '');
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><ClipboardList size={20} /> {t('booking_details_title')}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div>
                            <strong style={{ fontSize: '1.25rem' }}>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>
                                {booking.customerName || t('na')}
                            </div>
                            {booking.isWalkIn && <span className="badge badge-progress" style={{ marginTop: '0.5rem' }}>{t('walk_in_badge')}</span>}
                        </div>
                        <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>{t('service_label')}</h4>
                            <p><strong>{booking.serviceName}</strong></p>
                            <p>{globalFormatCurrency(booking.price)}</p>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>{t('schedule_label')}</h4>
                            <p>{booking.bookingDate}</p>
                            <p>{booking.startTime}</p>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>{t('vehicle_label')}</h4>
                            <p>{booking.carMake} {booking.carModel}</p>
                        </div>
                    </div>

                    {/* Assign Employee */}
                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && (
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>{t('assign_employees_title')}</h4>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'white', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--navy-200)', marginBottom: '0.5rem' }}>
                                {employees.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-400)' }}>{t('loading_employees')}</p>
                                ) : (
                                    employees.map(emp => (
                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={assignedEmployees.includes(emp.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAssignedEmployees([...assignedEmployees, emp.id]);
                                                    } else {
                                                        setAssignedEmployees(assignedEmployees.filter(id => id !== emp.id));
                                                    }
                                                }}
                                            />
                                            {emp.displayName} <small style={{ color: 'var(--navy-400)' }}>({emp.role})</small>
                                        </label>
                                    ))
                                )}
                            </div>
                            <button className="btn btn-primary btn-sm w-100" onClick={saveAssignment} disabled={saving || employees.length === 0}>
                                {saving ? t('saving') : t('save_assignments_btn')}
                            </button>
                            {booking.assignedEmployeeName && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                                    {t('currently_assigned_to')} <strong>{booking.assignedEmployeeName}</strong>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Reschedule Section */}
                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                        <div style={{ marginBottom: '1rem' }}>
                            {!showReschedule ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowReschedule(true)}>
                                    {t('reschedule_booking_btn')}
                                </button>
                            ) : (
                                <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                                    <h4 style={{ marginBottom: '0.5rem' }}>{t('reschedule_title')}</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                                        <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-primary btn-sm" onClick={rescheduleBooking} disabled={saving}>
                                            {saving ? t('saving') : t('confirm_reschedule_btn')}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setShowReschedule(false)}>{t('cancel')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes Section */}
                    <div style={{ marginBottom: '1rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>{t('notes')}</h4>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('add_notes_placeholder')}
                            rows={3}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--navy-200)' }}
                            disabled={!hasPermission('bookings', 'edit')}
                        />
                        {hasPermission('bookings', 'edit') && (
                            <button className="btn btn-secondary btn-sm" onClick={saveNotes} disabled={saving} style={{ marginTop: '0.5rem' }}>
                                {t('save_notes_btn')}
                            </button>
                        )}
                    </div>
                </div>
                <div className="modal-footer">
                    {/* WhatsApp Reminder */}
                    <button className="btn btn-secondary" onClick={sendWhatsAppReminder} style={{ background: '#25d366', color: 'white', border: 'none' }}>
                        {t('whatsapp_reminder_btn')}
                    </button>

                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                        <>
                            {booking.status === 'pending_confirmation' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { onStatusChange(booking.id, 'confirmed'); onClose(); }}
                                >
                                    {t('confirm_booking_btn')}
                                </button>
                            )}
                            {booking.status === 'confirmed' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { onStatusChange(booking.id, 'in_progress'); onClose(); }}
                                >
                                    {t('start_service_btn')}
                                </button>
                            )}
                            {booking.status === 'in_progress' && (
                                <button
                                    className="btn btn-success"
                                    onClick={() => { onCompleteClick(booking); onClose(); }}
                                >
                                    {t('mark_complete_btn')}
                                </button>
                            )}
                        </>
                    )}
                    <button className="btn btn-secondary" onClick={onClose}>{t('close')}</button>
                </div>
            </div>
        </div>
    );
};

// Completion Modal with Water Usage & Material Deduction
const CompletionModal = ({ booking, onClose, onComplete }) => {
    const { t } = useTranslation();
    const { user, userProfile } = useAuth();
    const { formatCurrency, currentCurrency } = useCurrency();
    const [waterUsage, setWaterUsage] = useState('');
    const [notes, setNotes] = useState('');
    const [materials, setMaterials] = useState([]);
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingMaterials, setFetchingMaterials] = useState(true);
    const [paymentSplits, setPaymentSplits] = useState([{ mode: 'cash', amount: String(booking.price || 0) }]);

    const totalMaterialCost = selectedMaterials.reduce((sum, sm) => {
        return sum + (Number(sm.quantity) || 0) * (Number(sm.costPerUnit) || 0);
    }, 0);

    useEffect(() => {
        fetchMaterials();
    }, []);

    const fetchMaterials = async () => {
        try {
            const materialsRef = collection(db, 'materials');
            const q = query(materialsRef, where('isActive', '==', true));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(data);
        } catch (error) {
            console.error('Error fetching materials:', error);
        } finally {
            setFetchingMaterials(false);
        }
    };

    const addMaterial = () => {
        setSelectedMaterials([...selectedMaterials, { materialId: '', quantity: 0 }]);
    };

    const updateSelectedMaterial = (index, field, value) => {
        const updated = [...selectedMaterials];
        updated[index][field] = value;
        if (field === 'materialId') {
            const material = materials.find(m => m.id === value);
            if (material) {
                updated[index].materialName = material.name;
                updated[index].costPerUnit = material.costPerUnit;
                updated[index].unit = material.unit;
            }
        }
        setSelectedMaterials(updated);
    };

    const removeMaterial = (index) => {
        setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Calculate total material cost
            let totalMaterialCost = 0;
            const materialsUsed = selectedMaterials.map(sm => {
                const cost = sm.quantity * (sm.costPerUnit || 0);
                totalMaterialCost += cost;
                return {
                    materialId: sm.materialId,
                    name: sm.materialName,
                    quantity: Number(sm.quantity),
                    unit: sm.unit,
                    cost: cost
                };
            });

            // Deduct materials from inventory
            for (const sm of selectedMaterials) {
                if (sm.materialId && sm.quantity > 0) {
                    await updateDoc(doc(db, 'materials', sm.materialId), {
                        currentStock: increment(-Number(sm.quantity)),
                        updatedAt: serverTimestamp()
                    });

                    // Record material usage
                    await addDoc(collection(db, 'materialUsage'), {
                        bookingId: booking.id,
                        materialId: sm.materialId,
                        materialName: sm.materialName,
                        quantityUsed: Number(sm.quantity),
                        unit: sm.unit,
                        cost: sm.quantity * (sm.costPerUnit || 0),
                        usedAt: serverTimestamp()
                    });
                }
            }

            // Create expense entry for materials used
            if (totalMaterialCost > 0) {
                await addDoc(collection(db, 'expenses'), {
                    title: `Materials for ${booking.serviceName}`,
                    amount: totalMaterialCost,
                    category: 'supplies',
                    date: new Date().toISOString().split('T')[0],
                    paymentMode: 'internal',
                    note: `Auto-generated from service completion. Booking: ${booking.bookingReference || booking.id.slice(0, 8)}`,
                    bookingId: booking.id,
                    isAutoGenerated: true,
                    createdAt: serverTimestamp()
                });
            }

            // Complete the booking with additional data
            onComplete({
                waterUsage: Number(waterUsage) || 0,
                completedBy: user?.uid || 'unknown',
                completedByName: userProfile?.displayName || user?.email || 'Staff',
                materialsUsed: materialsUsed,
                totalMaterialCost: totalMaterialCost,
                completionNotes: notes,
                paymentSplits: paymentSplits,
                completedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error completing service:', error);
            alert('Error completing service. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><CheckCircle size={20} /> Complete Service</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="completion-info" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <p><strong>{booking.customerName || 'N/A'}</strong></p>
                            <p><strong>{booking.serviceName}</strong></p>
                            <p style={{ fontSize: '0.875rem', color: '#666' }}>{booking.carMake} {booking.carModel}</p>
                        </div>

                        <div className="form-group">
                            <label><Droplets size={16} style={{ marginRight: '0.5rem' }} />Water Usage (Liters)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={waterUsage}
                                onChange={(e) => setWaterUsage(e.target.value)}
                                placeholder="e.g., 30"
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Materials Used</span>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={addMaterial}>
                                    + Add Material
                                </button>
                            </label>

                            {fetchingMaterials ? (
                                <p style={{ color: '#666', fontSize: '0.875rem' }}>Loading materials...</p>
                            ) : selectedMaterials.length === 0 ? (
                                <p style={{ color: '#666', fontSize: '0.875rem' }}>No materials added yet</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {selectedMaterials.map((sm, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <select
                                                value={sm.materialId}
                                                onChange={(e) => updateSelectedMaterial(index, 'materialId', e.target.value)}
                                                style={{ flex: 2 }}
                                            >
                                                <option value="">Select Material</option>
                                                {materials.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.currentStock} {m.unit})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="Qty"
                                                value={sm.quantity}
                                                onChange={(e) => updateSelectedMaterial(index, 'quantity', e.target.value)}
                                                style={{ flex: 1, width: '70px' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn-icon danger"
                                                onClick={() => removeMaterial(index)}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Completion Notes (Optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows="2"
                                placeholder="Any notes about the service..."
                            />
                        </div>

                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                            <SplitPaymentSelector
                                splits={paymentSplits}
                                onAddSplit={() => setPaymentSplits([...paymentSplits, { mode: 'cash', amount: '' }])}
                                onRemoveSplit={(idx) => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                                onSplitChange={(idx, field, val) => {
                                    const newSplits = [...paymentSplits];
                                    newSplits[idx][field] = val;
                                    setPaymentSplits(newSplits);
                                }}
                                totalAmount={Number(booking.price || 0) + totalMaterialCost}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-success" disabled={loading}>
                            {loading ? 'Completing...' : 'Complete Service'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Booking Edit Modal
const BookingEditModal = ({ booking, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { userProfile } = useAuth();
    const { formatCurrency, currentCurrency } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        customerName: booking.customerName || '',
        phone: 'HIDDEN',
        carMake: booking.carMake || '',
        carModel: booking.carModel || '',
        licensePlate: 'DEMO',
        location: booking.location || '',
        bookingDate: booking.bookingDate || '',
        startTime: booking.startTime || '',
        serviceCategory: booking.serviceCategory || '',
        serviceName: booking.serviceName || '',
        price: booking.price || 0
    });

    const [employees, setEmployees] = useState([]);
    const [assignedEmployees, setAssignedEmployees] = useState(booking.assignedEmployees || (booking.assignedEmployee ? [booking.assignedEmployee] : []));

    const [categories, setCategories] = useState(['Detailed Wash', 'Quick Wash', 'Interior Clean', 'Coating', 'Other']);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [services, setServices] = useState([]);
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);

    useEffect(() => {
        fetchCategories();
        fetchServices();
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const q = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const empList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => {
                    const role = (u.role || '').toLowerCase();
                    const validRoles = ['admin', 'manager', 'senior_employee', 'employee', 'worker', 'staff'];
                    return validRoles.includes(role);
                });
            setEmployees(empList);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };
    const fetchCategories = async () => {
        try {
            const docRef = doc(db, 'settings', 'booking_categories');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().categories) {
                setCategories(docSnap.data().categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchServices = async () => {
        try {
            const snapshot = await getDocs(query(collection(db, 'services'), where('isActive', '==', true)));
            const serviceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServices(serviceList);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const handleSaveCategory = async () => {
        if (!newCategory.trim()) return;
        const cat = newCategory.trim();
        const updatedCategories = [...categories];
        if (!updatedCategories.includes(cat)) {
            updatedCategories.push(cat);
            try {
                await setDoc(doc(db, 'settings', 'booking_categories'), {
                    categories: updatedCategories
                }, { merge: true });
                setCategories(updatedCategories);
                setFormData({ ...formData, serviceCategory: cat });
                setShowNewCategory(false);
                setNewCategory('');
            } catch (error) {
                console.error("Error saving category:", error);
                alert("Failed to save category");
            }
        } else {
            setFormData({ ...formData, serviceCategory: cat });
            setShowNewCategory(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateDoc(doc(db, 'bookings', booking.id), {
                customerName: formData.customerName,
                contactPhone: 'HIDDEN',
                carMake: formData.carMake,
                carModel: formData.carModel,
                licensePlate: 'DEMO',
                location: formData.location || '',
                bookingDate: formData.bookingDate,
                startTime: formData.startTime,
                serviceCategory: formData.serviceCategory,
                serviceName: formData.serviceName,
                price: Number(formData.price) || 0,
                assignedEmployees: assignedEmployees,
                assignedEmployeeName: employees.filter(e => assignedEmployees.includes(e.id)).map(e => e.displayName).join(', '),
                updatedAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating booking:", error);
            alert("Failed to update booking");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Edit size={20} /> Edit Booking</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}>

                        {/* Section 1: Customer & Vehicle Info */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>👤 Customer & Vehicle Info</label>
                            <div className="form-group">
                                <label>Customer Name</label>
                                <input
                                    value={formData.customerName}
                                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Customer Name</label>
                                <input
                                    value={formData.customerName}
                                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Make</label>
                                    <input
                                        value={formData.carMake}
                                        onChange={e => setFormData({ ...formData, carMake: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Model</label>
                                    <input
                                        value={formData.carModel}
                                        onChange={e => setFormData({ ...formData, carModel: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Date & Time */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>📅 Date & Time</label>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={formData.bookingDate}
                                        onChange={e => setFormData({ ...formData, bookingDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <input
                                        type="time"
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Service Details */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>⚙️ Service Details</label>

                            {/* Service Category with Add Option */}
                            <div className="form-group">
                                <label>Service Category</label>
                                {!showNewCategory ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select
                                            value={formData.serviceCategory}
                                            onChange={e => setFormData({ ...formData, serviceCategory: e.target.value })}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setShowNewCategory(true)}
                                            title="Add New Category"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            placeholder="New Category Name"
                                            value={newCategory}
                                            onChange={e => setNewCategory(e.target.value)}
                                            autoFocus
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={handleSaveCategory}
                                        >
                                            Save
                                        </button>
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
                            <div className="form-row">
                                <div className="form-group" style={{ position: 'relative' }}>
                                    <label>Service Name</label>
                                    <input
                                        value={formData.serviceName}
                                        onChange={e => {
                                            setFormData({ ...formData, serviceName: e.target.value });
                                            setShowServiceDropdown(true);
                                        }}
                                        onFocus={() => setShowServiceDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                                        placeholder="Search or type service name"
                                        autoComplete="off"
                                    />
                                    {showServiceDropdown && services.length > 0 && (
                                        <div className="dropdown-menu" style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0,
                                            background: 'white', border: '1px solid var(--navy-200)',
                                            borderRadius: 'var(--radius-md)', maxHeight: '200px',
                                            overflowY: 'auto', zIndex: 10,
                                            boxShadow: 'var(--shadow-md)'
                                        }}>
                                            {services
                                                .filter(s => s.name?.toLowerCase().includes((formData.serviceName || '').toLowerCase()))
                                                .map(s => (
                                                    <div
                                                        key={s.id}
                                                        onClick={() => {
                                                            const vType = (booking.vehicleType || 'sedan').toLowerCase().replace(' ', '_');
                                                            const calcPrice = (s.prices && s.prices[vType] > 0) ? s.prices[vType] : (s.price || 0);
                                                            setFormData({
                                                                ...formData,
                                                                serviceName: s.name,
                                                                price: calcPrice,
                                                                serviceCategory: s.category || formData.serviceCategory
                                                            });
                                                            setShowServiceDropdown(false);
                                                        }}
                                                        style={{
                                                            padding: '0.75rem 1rem', cursor: 'pointer',
                                                            borderBottom: '1px solid var(--navy-50)',
                                                            display: 'flex', justifyContent: 'space-between',
                                                            alignItems: 'center', transition: 'background-color 0.2s',
                                                            gap: '1rem'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--navy-50)'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                                    >
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <strong style={{ color: 'var(--navy-900)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.category}</div>
                                                        </div>
                                                        <span style={{ color: 'var(--primary)', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0, paddingRight: '0.5rem' }}>
                                                            {formatCurrency((s.prices && s.prices[(booking.vehicleType || 'sedan').toLowerCase().replace(' ', '_')] > 0)
                                                                ? s.prices[(booking.vehicleType || 'sedan').toLowerCase().replace(' ', '_')]
                                                                : (s.price || 0))}
                                                        </span>
                                                    </div>
                                                ))}
                                            {services.filter(s => s.name?.toLowerCase().includes((formData.serviceName || '').toLowerCase())).length === 0 && (
                                                <div style={{ padding: '0.75rem 1rem', color: 'var(--navy-400)', textAlign: 'center', fontSize: '0.85rem' }}>
                                                    No services found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Amount ({currentCurrency.symbol})</label>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Assignment Section */}
                        <div className="form-section" style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--navy-200)' }}>
                            <label style={{ fontSize: '1rem', color: 'var(--navy-800)', fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>👥 Assign Employees</label>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--navy-200)' }}>
                                {employees.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-400)', textAlign: 'center', padding: '0.5rem' }}>Loading employees...</p>
                                ) : (
                                    employees.map(emp => (
                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid var(--navy-50)' }}>
                                            <input
                                                type="checkbox"
                                                checked={assignedEmployees.includes(emp.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAssignedEmployees([...assignedEmployees, emp.id]);
                                                    } else {
                                                        setAssignedEmployees(assignedEmployees.filter(id => id !== emp.id));
                                                    }
                                                }}
                                            />
                                            <div>
                                                <span style={{ fontWeight: '600' }}>{emp.displayName}</span>
                                                <small style={{ color: 'var(--navy-400)', marginLeft: '0.5rem' }}>({emp.role})</small>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Update Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Bookings;