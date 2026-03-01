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
    serverTimestamp,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import {
    ShieldCheck,
    Plus,
    Search,
    Check,
    X,
    UserCheck,
    Calendar,
    CreditCard,
    Users,
    Eye,
    CheckCircle,
    Circle,
    Car,
    Edit,
    Trash2,
    FileText
} from 'lucide-react';
import SplitPaymentSelector from '../components/SplitPaymentSelector';

const AMCPlans = () => {
    const { hasPermission, userProfile, isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('plans');
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [showEditSubModal, setShowEditSubModal] = useState(false);
    const [deleteSubConfirm, setDeleteSubConfirm] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [subscriptions, setSubscriptions] = useState([]);
    const [seeding, setSeeding] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceSubscription, setInvoiceSubscription] = useState(null);

    useEffect(() => {
        if (activeTab === 'plans') {
            fetchPlans();
        } else {
            fetchSubscriptions();
        }
    }, [activeTab]);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'amc_plans'), where('isActive', '==', true));
            const snapshot = await getDocs(q);
            setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Error fetching plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'customer_amc_subscriptions'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort client-side to avoid index issues, with null safety
            data.sort((a, b) => {
                const dateA = a.startDate?.seconds || (a.startDate ? new Date(a.startDate).getTime() / 1000 : 0);
                const dateB = b.startDate?.seconds || (b.startDate ? new Date(b.startDate).getTime() / 1000 : 0);
                return dateB - dateA;
            });
            setSubscriptions(data);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePlanStatus = async (planId, currentStatus) => {
        if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this plan?`)) return;
        try {
            await updateDoc(doc(db, 'amc_plans', planId), {
                isActive: !currentStatus,
                updatedAt: serverTimestamp()
            });
            fetchPlans();
        } catch (error) {
            console.error('Error updating plan:', error);
        }
    };

    const getServiceUsageCount = (sub, serviceName) => {
        if (!sub.serviceTracking) return { used: 0, total: 0 };
        const service = sub.serviceTracking.find(s => s.serviceType === serviceName);
        return {
            used: service?.usages?.length || 0,
            total: service?.totalAllowed || 0
        };
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this AMC plan?')) return;

        try {
            await updateDoc(doc(db, 'amc_plans', planId), {
                isActive: false,
                deletedAt: serverTimestamp()
            });
            alert('Plan deleted successfully');
            fetchPlans();
        } catch (error) {
            console.error('Error deleting plan:', error);
            alert('Error: ' + error.message);
        }
    };

    const deleteSubscription = async (subId) => {
        try {
            await deleteDoc(doc(db, 'customer_amc_subscriptions', subId));
            setSubscriptions(prev => prev.filter(s => s.id !== subId));
            setDeleteSubConfirm(null);
        } catch (error) {
            console.error('Error deleting subscription:', error);
            alert('Error deleting subscription');
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        if (date.toDate) return date.toDate().toLocaleDateString();
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
        return new Date(date).toLocaleDateString();
    };

    return (
        <div className="amc-page">
            <div className="page-header">
                <div>
                    <h1><ShieldCheck size={28} /> AMC Management</h1>
                    <p className="subtitle">Manage annual maintenance contracts</p>
                </div>
                <div className="header-actions">
                    <div className="tab-group">
                        <button
                            className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
                            onClick={() => setActiveTab('plans')}
                        >
                            <ShieldCheck size={16} /> Packages
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('subscriptions')}
                        >
                            <UserCheck size={16} /> Subscriptions
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'plans' ? (
                <div className="plans-section">
                    <div className="section-header">
                        <h3>Available Packages</h3>
                        {hasPermission('amc', 'create') && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary" onClick={() => setShowPlanModal(true)}>
                                    <Plus size={18} /> Create New Plan
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="plans-grid">
                        {loading ? (
                            <div className="loader-container"><div className="loader"></div></div>
                        ) : plans.length === 0 ? (
                            <div className="empty-state">
                                <ShieldCheck size={48} />
                                <p>No active AMC plans found</p>
                                <p style={{ color: 'var(--navy-400)', marginTop: '0.5rem' }}>
                                    Create Compact or Premium packages to get started
                                </p>
                            </div>
                        ) : (
                            plans.map(plan => (
                                <div key={plan.id} className={`plan-card ${plan.planType === 'premium' ? 'premium' : 'compact'}`}>
                                    <div className="plan-header">
                                        <div>
                                            <span className="plan-type-badge">{plan.planType?.toUpperCase() || 'STANDARD'}</span>
                                            <h3>{plan.name}</h3>
                                        </div>
                                    </div>
                                    <div className="plan-pricing">
                                        {plan.prices ? (
                                            <div className="vehicle-prices">
                                                <div><small>Hatchback</small><strong>₹{plan.prices.hatchback?.toLocaleString()}</strong></div>
                                                <div><small>Sedan</small><strong>₹{plan.prices.sedan?.toLocaleString()}</strong></div>
                                                <div><small>SUV</small><strong>₹{plan.prices.suv?.toLocaleString()}</strong></div>
                                                <div><small>Luxury SUV</small><strong>₹{plan.prices.luxurySuv?.toLocaleString()}</strong></div>
                                            </div>
                                        ) : (
                                            <span className="plan-price">₹{plan.price?.toLocaleString()}</span>
                                        )}
                                    </div>
                                    <div className="plan-body">
                                        <div className="plan-feature">
                                            <Calendar size={16} />
                                            <span>{plan.validityMonths} Months Validity</span>
                                        </div>
                                        {plan.services?.map((service, idx) => (
                                            <div key={idx} className="plan-feature service-item">
                                                <Check size={16} />
                                                <span>{service.name} {service.quantity > 1 ? `(${service.quantity}x)` : ''}</span>
                                            </div>
                                        ))}
                                        {!plan.services && plan.serviceCount && (
                                            <div className="plan-feature">
                                                <Check size={16} />
                                                <span>{plan.serviceCount} Washes Included</span>
                                            </div>
                                        )}
                                        {plan.description && <p className="plan-desc">{plan.description}</p>}
                                    </div>
                                    <div className="plan-footer">
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            {hasPermission('amc', 'edit') && (
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => { setSelectedPlan(plan); setShowPlanModal(true); }}
                                                    style={{ flex: 1 }}
                                                >
                                                    <Edit size={14} /> Edit
                                                </button>
                                            )}
                                            {hasPermission('amc', 'delete') && (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeletePlan(plan.id)}
                                                    style={{ flex: 1 }}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            )}
                                        </div>
                                        {hasPermission('amc', 'create') && (
                                            <button
                                                className="btn btn-outline-primary w-100"
                                                onClick={() => { setSelectedPlan(plan); setShowAssignModal(true); }}
                                            >
                                                Assign to Customer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="subscriptions-section">
                    <div className="card">
                        <div className="card-body">
                            {loading ? (
                                <div className="loader-container"><div className="loader"></div></div>
                            ) : subscriptions.length === 0 ? (
                                <div className="empty-state">
                                    <Users size={48} />
                                    <p>No active subscriptions</p>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Table View */}
                                    <div className="table-container desktop-view">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th>Plan</th>
                                                    <th>Vehicle</th>
                                                    <th>Start Date</th>
                                                    <th>Expiry</th>
                                                    <th>Services Used</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subscriptions.map(sub => {
                                                    const washUsage = getServiceUsageCount(sub, 'Commando Cleaning');
                                                    return (
                                                        <tr key={sub.id}>
                                                            <td>
                                                                <strong>{sub.customerName}</strong>
                                                                <br />
                                                                <small>{sub.customerPhone}</small>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${sub.planType === 'premium' ? 'badge-progress' : 'badge-confirmed'}`}>
                                                                    {sub.planType?.toUpperCase() || 'STANDARD'}
                                                                </span>
                                                                <br />
                                                                <small>{sub.planName}</small>
                                                            </td>
                                                            <td>
                                                                <strong>{sub.vehicleNumber}</strong>
                                                                <br />
                                                                <small style={{ textTransform: 'capitalize' }}>{sub.vehicleType}</small>
                                                            </td>
                                                            <td>{formatDate(sub.startDate)}</td>
                                                            <td>{formatDate(sub.expiryDate)}</td>
                                                            <td>
                                                                <div className="usage-bar-wrapper">
                                                                    <div className="usage-text">
                                                                        {washUsage.used} / {washUsage.total} washes
                                                                    </div>
                                                                    <div className="usage-progress">
                                                                        <div
                                                                            className="usage-fill"
                                                                            style={{ width: `${washUsage.total ? (washUsage.used / washUsage.total) * 100 : 0}%` }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${sub.status === 'active' ? 'badge-confirmed' : 'badge-cancelled'}`}>
                                                                    {sub.status}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                                    <button
                                                                        className="btn btn-sm btn-primary"
                                                                        onClick={() => { setSelectedSubscription(sub); setShowTrackingModal(true); }}
                                                                        title="Track Services"
                                                                    >
                                                                        <Eye size={14} /> Track
                                                                    </button>
                                                                    {hasPermission('bookings', 'create') && (
                                                                        <button
                                                                            className="btn btn-sm"
                                                                            style={{ background: '#10b981', color: 'white' }}
                                                                            onClick={() => { setInvoiceSubscription(sub); setShowInvoiceModal(true); }}
                                                                            title="Create Invoice"
                                                                        >
                                                                            <FileText size={14} /> Invoice
                                                                        </button>
                                                                    )}
                                                                    {hasPermission('services', 'edit') && (
                                                                        <button
                                                                            className="btn btn-sm btn-secondary"
                                                                            onClick={() => { setSelectedSubscription(sub); setShowEditSubModal(true); }}
                                                                            title="Edit Subscription"
                                                                        >
                                                                            <Edit size={14} />
                                                                        </button>
                                                                    )}
                                                                    {hasPermission('amc', 'delete') && (
                                                                        <button
                                                                            className="btn btn-sm"
                                                                            style={{ background: '#ef4444', color: 'white' }}
                                                                            onClick={() => setDeleteSubConfirm({ id: sub.id, name: sub.customerName })}
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 size={14} />
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

                                    {/* Mobile Card View */}
                                    <div className="mobile-view">
                                        {subscriptions.map(sub => {
                                            const washUsage = getServiceUsageCount(sub, 'Commando Cleaning');
                                            return (
                                                <div key={sub.id} className="mobile-subscription-card">
                                                    <div className="mobile-card-header">
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--navy-900)' }}>{sub.customerName}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--navy-500)' }}>{sub.customerPhone}</div>
                                                        </div>
                                                        <span className={`badge ${sub.status === 'active' ? 'badge-confirmed' : 'badge-cancelled'}`}>
                                                            {sub.status}
                                                        </span>
                                                    </div>

                                                    <div className="detail-rows">
                                                        <div className="mobile-card-detail-row">
                                                            <span className="mobile-card-detail-label">Vehcile</span>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 600 }}>{sub.vehicleNumber}</div>
                                                                <div style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{sub.vehicleType}</div>
                                                            </div>
                                                        </div>

                                                        <div className="mobile-card-detail-row">
                                                            <span className="mobile-card-detail-label">Plan</span>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <span className={`badge ${sub.planType === 'premium' ? 'badge-progress' : 'badge-confirmed'}`} style={{ fontSize: '0.7rem', padding: '2px 6px', marginRight: '4px' }}>
                                                                    {sub.planType?.toUpperCase() || 'STANDARD'}
                                                                </span>
                                                                <div>{sub.planName}</div>
                                                            </div>
                                                        </div>

                                                        <div className="mobile-card-detail-row">
                                                            <span className="mobile-card-detail-label">Expiry</span>
                                                            <span>{formatDate(sub.expiryDate)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="usage-section" style={{ marginTop: '12px', padding: '10px', background: 'var(--navy-50)', borderRadius: '8px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                                                            <span>Service Usage</span>
                                                            <strong>{washUsage.used} / {washUsage.total} washes</strong>
                                                        </div>
                                                        <div className="usage-progress" style={{ height: '6px', background: 'var(--navy-100)', borderRadius: '3px' }}>
                                                            <div className="usage-fill" style={{
                                                                width: `${washUsage.total ? (washUsage.used / washUsage.total) * 100 : 0}%`,
                                                                height: '100%',
                                                                background: 'var(--success)',
                                                                borderRadius: '3px'
                                                            }}></div>
                                                        </div>
                                                    </div>

                                                    <div className="card-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--navy-50)', paddingTop: '12px' }}>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => { setSelectedSubscription(sub); setShowTrackingModal(true); }}
                                                            style={{ flex: 1, justifyContent: 'center' }}
                                                        >
                                                            <Eye size={14} /> Track
                                                        </button>
                                                        {hasPermission('bookings', 'create') && (
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{ background: '#10b981', color: 'white', flex: 1, justifyContent: 'center' }}
                                                                onClick={() => { setInvoiceSubscription(sub); setShowInvoiceModal(true); }}
                                                            >
                                                                <FileText size={14} /> Invoice
                                                            </button>
                                                        )}
                                                        {hasPermission('services', 'edit') && (
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() => { setSelectedSubscription(sub); setShowEditSubModal(true); }}
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                        )}
                                                        {hasPermission('amc', 'delete') && (
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{ background: '#ef4444', color: 'white' }}
                                                                onClick={() => setDeleteSubConfirm({ id: sub.id, name: sub.customerName })}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPlanModal && (
                <CreatePlanModal onClose={() => setShowPlanModal(false)} onSuccess={fetchPlans} />
            )}

            {showAssignModal && selectedPlan && (
                <AssignPlanModal
                    plan={selectedPlan}
                    onClose={() => { setShowAssignModal(false); setSelectedPlan(null); }}
                    onSuccess={() => {
                        fetchSubscriptions();
                        setActiveTab('subscriptions');
                        alert('Plan assigned successfully!');
                    }}
                />
            )}

            {showTrackingModal && selectedSubscription && (
                <ServiceTrackingModal
                    subscription={selectedSubscription}
                    onClose={() => { setShowTrackingModal(false); setSelectedSubscription(null); }}
                    onUpdate={fetchSubscriptions}
                />
            )}

            {showEditSubModal && selectedSubscription && (
                <EditSubscriptionModal
                    subscription={selectedSubscription}
                    onClose={() => { setShowEditSubModal(false); setSelectedSubscription(null); }}
                    onSuccess={fetchSubscriptions}
                />
            )}

            {showInvoiceModal && invoiceSubscription && (
                <SubscriptionInvoiceModal
                    subscription={invoiceSubscription}
                    onClose={() => { setShowInvoiceModal(false); setInvoiceSubscription(null); }}
                    onSuccess={fetchSubscriptions}
                    userProfile={userProfile}
                />
            )}

            {/* Subscription Delete Confirmation Modal */}
            {deleteSubConfirm && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2><Trash2 size={20} color="#ef4444" /> Delete Subscription</h2>
                            <button className="modal-close" onClick={() => setDeleteSubConfirm(null)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <Trash2 size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Delete subscription for "{deleteSubConfirm.name}"?</h3>
                            <p style={{ color: 'var(--navy-500)' }}>
                                This will permanently remove this AMC subscription and all tracking data.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteSubConfirm(null)}>Cancel</button>
                            <button
                                className="btn"
                                style={{ background: '#ef4444', color: 'white' }}
                                onClick={() => deleteSubscription(deleteSubConfirm.id)}
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .amc-page { padding-bottom: 2rem; }
                
                .tab-group {
                    display: flex;
                    background: var(--navy-800);
                    padding: 4px;
                    border-radius: 8px;
                    gap: 4px;
                }
                
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    color: rgba(255,255,255,0.6);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .tab-btn.active {
                    background: var(--primary);
                    color: white;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .plans-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }
                
                .plan-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border: 2px solid var(--navy-100);
                    overflow: hidden;
                    transition: transform 0.2s;
                }
                
                .plan-card.premium {
                    border-color: #d4af37;
                }
                
                .plan-card.compact {
                    border-color: #2d5a27;
                }
                
                .plan-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                }
                
                .plan-header {
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: white;
                    padding: 20px;
                }
                
                .plan-card.premium .plan-header {
                    background: linear-gradient(135deg, #1a1a2e, #2d2d44);
                    border-bottom: 3px solid #d4af37;
                }
                
                .plan-card.compact .plan-header {
                    background: linear-gradient(135deg, #1a3a1a, #2d5a27);
                }
                
                .plan-type-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                }
                
                .plan-card.premium .plan-type-badge {
                    background: linear-gradient(135deg, #d4af37, #c9a227);
                    color: #1a1a2e;
                }
                
                .plan-header h3 { margin: 0; font-size: 1.25rem; }
                
                .plan-pricing {
                    padding: 15px 20px;
                    background: var(--navy-50);
                    border-bottom: 1px solid var(--navy-100);
                }
                
                .vehicle-prices {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    text-align: center;
                }
                
                .vehicle-prices > div small {
                    display: block;
                    color: var(--navy-500);
                    font-size: 0.75rem;
                    margin-bottom: 2px;
                }
                
                .vehicle-prices > div strong {
                    color: var(--primary);
                    font-size: 1rem;
                }
                
                .plan-body { padding: 20px; }
                
                .plan-feature {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 10px;
                    color: var(--navy-700);
                    font-weight: 500;
                }
                
                .plan-feature.service-item {
                    font-size: 0.9rem;
                    color: var(--navy-600);
                }
                
                .plan-feature svg {
                    color: var(--success);
                    flex-shrink: 0;
                }
                
                .plan-desc {
                    margin-top: 16px;
                    font-size: 0.9rem;
                    color: var(--navy-500);
                    line-height: 1.5;
                }
                
                .plan-footer {
                    padding: 20px;
                    border-top: 1px solid var(--navy-50);
                    background: var(--navy-50);
                }
                
                .usage-bar-wrapper { min-width: 140px; }
                .usage-text { font-size: 0.8rem; margin-bottom: 4px; }
                
                .usage-progress {
                    height: 6px;
                    background: var(--navy-100);
                    border-radius: 3px;
                    overflow: hidden;
                }
                
                .usage-fill {
                    height: 100%;
                    background: var(--success);
                    border-radius: 3px;
                    transition: width 0.3s;
                }
                
                @media (max-width: 768px) {
                    .section-header { flex-direction: column; gap: 1rem; align-items: stretch; }
                    .tab-btn span { display: none; }
                    
                    .desktop-view { display: none !important; }
                    .mobile-view { display: block !important; }
                }
                
                /* Mobile Card View Styles */
                .mobile-view { display: none; }
                
                .mobile-subscription-card {
                    background: white;
                    border: 1px solid var(--navy-100);
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                    box-shadow: var(--shadow-sm);
                }
                
                .mobile-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--navy-50);
                }
                
                .mobile-card-detail-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                    margin-bottom: 8px;
                    color: var(--navy-700);
                }
                
                .mobile-card-detail-label {
                    color: var(--navy-500);
                    font-size: 0.85rem;
                }
            `}</style>
        </div>
    );
};

const CreatePlanModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [planType, setPlanType] = useState('compact');
    const [vehiclePrices, setVehiclePrices] = useState({ hatchback: '', sedan: '', suv: '', luxurySuv: '' });
    const [services, setServices] = useState([
        { name: '', quantity: 1, description: '' }
    ]);

    // Load default plan format when type changes
    useEffect(() => {
        if (planType === 'compact') {
            setVehiclePrices({ hatchback: '', sedan: '', suv: '', luxurySuv: '' });
            setServices([{ name: '', quantity: 1, description: '' }]);
        } else if (planType === 'premium') {
            setVehiclePrices({ hatchback: '', sedan: '', suv: '', luxurySuv: '' });
            setServices([{ name: '', quantity: 1, description: '' }]);
        }
    }, [planType]);

    const addService = () => {
        setServices([...services, { name: '', quantity: 1, description: '' }]);
    };

    const updateService = (index, field, value) => {
        const updated = [...services];
        updated[index][field] = field === 'quantity' ? Number(value) : value;
        setServices(updated);
    };

    const removeService = (index) => {
        setServices(services.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.target);

        try {
            await addDoc(collection(db, 'amc_plans'), {
                name: formData.get('name'),
                planType: planType,
                prices: {
                    hatchback: Number(vehiclePrices.hatchback),
                    sedan: Number(vehiclePrices.sedan),
                    suv: Number(vehiclePrices.suv),
                    luxurySuv: Number(vehiclePrices.luxurySuv)
                },
                validityMonths: Number(formData.get('validity')),
                services: services.filter(s => s.name.trim()),
                description: formData.get('description'),
                isActive: true,
                createdAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error creating plan: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2>Create AMC Package</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Plan Type Selection */}
                        <div className="form-group">
                            <label>Plan Type *</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {['compact', 'premium'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setPlanType(type)}
                                        style={{
                                            flex: 1,
                                            padding: '1rem',
                                            border: planType === type ? '2px solid var(--primary)' : '2px solid var(--navy-200)',
                                            borderRadius: '8px',
                                            background: planType === type ? 'var(--primary-light)' : 'white',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>Package Name *</label>
                                <input
                                    name="name"
                                    required
                                    defaultValue=""
                                    placeholder="e.g. Compact Package"
                                />
                            </div>
                            <div className="form-group">
                                <label>Validity (Months) *</label>
                                <input name="validity" type="number" required defaultValue={12} placeholder="12" />
                            </div>
                        </div>

                        {/* Vehicle Type Pricing */}
                        <div className="form-group" style={{
                            padding: '1rem',
                            background: 'var(--navy-50)',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <label style={{ marginBottom: '0.75rem', display: 'block', fontWeight: '600' }}>
                                Vehicle Type Pricing (₹)
                            </label>
                            <div className="form-row" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Hatchback</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.hatchback}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, hatchback: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Sedan</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.sedan}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, sedan: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>SUV</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.suv}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, suv: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Luxury SUV</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.luxurySuv}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, luxurySuv: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Services Included */}
                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Services Included</span>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={addService}>
                                    + Add Service
                                </button>
                            </label>
                            <div style={{ marginTop: '0.75rem' }}>
                                {services.map((service, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        marginBottom: '0.5rem',
                                        padding: '0.75rem',
                                        background: 'var(--navy-50)',
                                        borderRadius: '8px'
                                    }}>
                                        <input
                                            placeholder="Service Name"
                                            value={service.name}
                                            onChange={(e) => updateService(idx, 'name', e.target.value)}
                                            style={{ flex: 2 }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={service.quantity}
                                            onChange={(e) => updateService(idx, 'quantity', e.target.value)}
                                            style={{ width: '70px' }}
                                            min="1"
                                        />
                                        <input
                                            placeholder="Description"
                                            value={service.description}
                                            onChange={(e) => updateService(idx, 'description', e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeService(idx)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--danger)',
                                                cursor: 'pointer',
                                                padding: '0.5rem'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea name="description" placeholder="Package details..." rows="2"></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Package'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AssignPlanModal = ({ plan, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState('existing'); // existing | new
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', vehicleNumber: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [vehicleType, setVehicleType] = useState('hatchback');
    const [salePrice, setSalePrice] = useState(0);
    const [startDateStr, setStartDateStr] = useState(new Date().toISOString().split('T')[0]); // Allow custom start date for past AMC
    const [advancePayment, setAdvancePayment] = useState(0); // Advance payment amount

    // List of all customers for dropdown
    const [customerList, setCustomerList] = useState([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Filter customers by search term - searches by vehicle number, phone, and name
    const filteredCustomers = customers.filter(c => {
        const search = searchTerm.toLowerCase().trim();
        if (!search) return true; // Show all when empty to help discovery

        // Normalize search and data for robust matching
        const searchClean = search.replace(/[^a-z0-9]/g, '');

        // Search by license plate (vehicle number)
        const plate = (c.licensePlate || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const licensePlateMatch = plate.includes(searchClean);

        // Search by phone number
        const phone = (c.phone || '').toString().replace(/[^0-9]/g, '');
        const phoneMatch = phone.includes(searchClean);

        // Search by customer name
        const nameMatch = (c.name || '').toLowerCase().includes(search);

        return licensePlateMatch || phoneMatch || nameMatch;
    });

    const customersLoading = false; // Placeholder if used in render

    useEffect(() => {
        const fetchCustomers = async () => {
            const snap = await getDocs(collection(db, 'customers'));
            setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchCustomers();
    }, []);

    const getPrice = () => {
        return plan.prices?.[vehicleType] || plan.price || 0;
    };

    // Update sale price when vehicle type changes
    useEffect(() => {
        setSalePrice(getPrice());
    }, [vehicleType, plan]);

    const handleAssign = async () => {
        setLoading(true);
        try {
            let customerId = selectedCustomer?.id;
            let custName = selectedCustomer?.name;
            let custPhone = selectedCustomer?.phone;
            let custVehicle = selectedCustomer?.licensePlate;

            // If creating new customer
            if (activeTab === 'new') {
                if (!newCustomer.name || !newCustomer.phone || !newCustomer.vehicleNumber) {
                    alert('Please fill all customer details');
                    setLoading(false);
                    return;
                }

                // Add new customer
                const custRef = await addDoc(collection(db, 'customers'), {
                    name: newCustomer.name,
                    phone: newCustomer.phone,
                    licensePlate: newCustomer.vehicleNumber,
                    vehicleType: vehicleType,
                    createdAt: serverTimestamp()
                });
                customerId = custRef.id;
                custName = newCustomer.name;
                custPhone = newCustomer.phone;
                custVehicle = newCustomer.vehicleNumber;
            } else {
                if (!selectedCustomer) return;
            }

            // Use the selected start date (allows adding past AMC customers)
            const startDate = new Date(startDateStr);
            const expiryDate = new Date(startDateStr);
            expiryDate.setMonth(startDate.getMonth() + plan.validityMonths);

            // Build service tracking structure
            const serviceTracking = (plan.services || []).map(service => ({
                serviceType: service.name,
                description: service.description,
                totalAllowed: service.quantity,
                usages: []
            }));

            // If no services defined, create default wash tracking
            if (serviceTracking.length === 0 && plan.serviceCount) {
                serviceTracking.push({
                    serviceType: 'Wash',
                    totalAllowed: plan.serviceCount,
                    usages: []
                });
            }

            // Calculate payment status
            const advanceAmt = Number(advancePayment) || 0;
            const baseAmount = Number(salePrice) || 0; // Use salePrice as base for GST calculation
            const includeGST = plan.includeGST; // Assuming plan has an includeGST boolean

            // Fixed CGST and SGST at 9% each (total 18%)
            const cgstPercentage = 9;
            const sgstPercentage = 9;
            const gstDivisor = 1 + (cgstPercentage + sgstPercentage) / 100;

            const baseAmountForGst = includeGST ? Math.round(baseAmount / gstDivisor) : baseAmount;
            const cgstAmount = includeGST ? Math.round((baseAmountForGst * cgstPercentage) / 100) : 0;
            const sgstAmount = includeGST ? Math.round((baseAmountForGst * sgstPercentage) / 100) : 0;
            const totalGst = cgstAmount + sgstAmount;
            const totalAmount = includeGST ? (baseAmountForGst + totalGst) : baseAmount;
            const balanceAmt = totalAmount - advanceAmt;
            let paymentStatus = 'unpaid';
            if (advanceAmt >= totalAmount) {
                paymentStatus = 'paid';
            } else if (advanceAmt > 0) {
                paymentStatus = 'partial';
            }

            // Create Subscription
            const subscriptionData = {
                customerId: customerId || 'unknown',
                customerName: custName || custPhone || 'Unknown',
                customerPhone: custPhone || '',
                vehicleNumber: (custVehicle || 'N/A').toUpperCase(),
                vehicleType: vehicleType,
                planId: plan.id,
                planName: plan.name,
                price: totalAmount,
                // Payment Tracking
                totalAmount: totalAmount,
                advancePayment: advanceAmt,
                balanceAmount: balanceAmt,
                paymentStatus: paymentStatus,
                startDate: Timestamp.fromDate(startDate),
                expiryDate: Timestamp.fromDate(expiryDate),
                status: 'active',
                remainingServices: Number(plan.serviceCount) || 0, // Legacy support
                serviceTracking: serviceTracking, // Fixed field name to match UI
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await addDoc(collection(db, 'customer_amc_subscriptions'), subscriptionData);

            /* 
            // Create Invoice
            const invoiceData = {
                bookingReference: `INV-AMC-${Date.now().toString().slice(-6)}`,
                customerId: customerId,
                customerName: custName || custPhone || 'Unknown',
                contactPhone: custPhone || '',
                licensePlate: (custVehicle || 'N/A').toUpperCase(),
                carMake: '',
                carModel: '',
                serviceName: `AMC Plan: ${plan.name} (${vehicleType})`,
                price: totalAmount,
                paidAmount: advanceAmt,
                paymentStatus: paymentStatus,
                paymentMode: advanceAmt > 0 ? 'cash' : 'none',
                paymentHistory: advanceAmt > 0 ? [{
                    date: new Date().toISOString(),
                    amount: advanceAmt,
                    splits: [{ mode: 'cash', amount: advanceAmt }],
                    recordedBy: 'system',
                    note: 'Initial payment for AMC Subscription'
                }] : [],
                status: 'completed',
                invoiceDate: startDateStr,
                createdAt: serverTimestamp(),
                createdBy: 'system',
                isManual: true,
                source: 'invoice'
            };

            await addDoc(collection(db, 'invoices'), invoiceData);
            */

            alert('Plan assigned successfully!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error assigning plan: ", error);
            alert("Error assigning plan");
        }
        setLoading(false);
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Assign {plan.name}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {/* Vehicle Type Selection */}
                    <div className="form-group">
                        <label>Vehicle Type *</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['hatchback', 'sedan', 'suv', 'luxurySuv'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setVehicleType(type)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        border: vehicleType === type ? '2px solid var(--primary)' : '2px solid var(--navy-200)',
                                        borderRadius: '8px',
                                        background: vehicleType === type ? 'var(--primary-light)' : 'white',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {type === 'suv' ? 'SUV' : type === 'luxurySuv' ? 'Luxury SUV' : type}
                                    <br />
                                    <small style={{ fontWeight: 'normal', color: 'var(--primary)' }}>
                                        ₹{plan.prices?.[type]?.toLocaleString() || plan.price}
                                    </small>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Override */}
                    <div className="form-group">
                        <label>Sale Price (₹)</label>
                        <input
                            type="number"
                            value={salePrice}
                            onChange={e => setSalePrice(e.target.value)}
                            style={{
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                color: 'var(--primary)',
                                padding: '0.75rem',
                                width: '100%',
                                boxSizing: 'border-box',
                                border: '1px solid var(--navy-200)',
                                borderRadius: '8px'
                            }}
                        />
                        <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--navy-500)' }}>
                            Standard Price: ₹{getPrice().toLocaleString()}
                        </div>
                    </div>

                    {/* Start Date Selection - For past AMC customers */}
                    <div className="form-group">
                        <label>Start Date *</label>
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={e => setStartDateStr(e.target.value)}
                            style={{
                                padding: '0.75rem',
                                width: '100%',
                                boxSizing: 'border-box',
                                border: '1px solid var(--navy-200)',
                                borderRadius: '8px'
                            }}
                        />
                        <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--navy-500)' }}>
                            Select a past date to add existing AMC customers. Expiry: {(() => {
                                const exp = new Date(startDateStr);
                                exp.setMonth(exp.getMonth() + (plan.validityMonths || 12));
                                return exp.toLocaleDateString();
                            })()}
                        </div>
                    </div>

                    {/* Advance Payment Section */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1rem',
                        border: '1px solid #86efac'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: '600', color: '#166534' }}>Total Amount:</span>
                            <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#166534' }}>₹{Number(salePrice || 0).toLocaleString()}</span>
                        </div>

                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>Advance Payment (₹)</label>
                            <input
                                type="number"
                                value={advancePayment}
                                onChange={(e) => setAdvancePayment(Math.max(0, Number(e.target.value)))}
                                min="0"
                                max={salePrice}
                                placeholder="0"
                                style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    textAlign: 'right',
                                    padding: '0.75rem',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    border: '1px solid #86efac',
                                    borderRadius: '8px'
                                }}
                            />
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingTop: '0.5rem',
                            borderTop: '1px dashed #86efac',
                            marginTop: '0.5rem'
                        }}>
                            <span style={{ fontWeight: '500', color: '#166534' }}>Balance Due:</span>
                            <span style={{
                                fontWeight: '700',
                                fontSize: '1.1rem',
                                color: (Number(salePrice || 0) - Number(advancePayment || 0)) > 0 ? '#dc2626' : '#166534'
                            }}>
                                ₹{(Number(salePrice || 0) - Number(advancePayment || 0)).toLocaleString()}
                            </span>
                        </div>

                        {Number(advancePayment || 0) > 0 && Number(advancePayment) < salePrice && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                background: '#fef3c7',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                color: '#92400e',
                                textAlign: 'center'
                            }}>
                                ⚠️ Partial payment - Balance to be collected
                            </div>
                        )}
                    </div>

                    {/* Customer Selection Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--navy-100)', marginBottom: '1rem' }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('existing')}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderBottom: activeTab === 'existing' ? '2px solid var(--primary)' : 'none',
                                color: activeTab === 'existing' ? 'var(--primary)' : 'var(--navy-500)',
                                fontWeight: '600',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            Existing Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('new')}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderBottom: activeTab === 'new' ? '2px solid var(--primary)' : 'none',
                                color: activeTab === 'new' ? 'var(--primary)' : 'var(--navy-500)',
                                fontWeight: '600',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            + New Customer
                        </button>
                    </div>

                    {activeTab === 'existing' ? (
                        <div className="form-group" style={{ position: 'relative' }}>
                            <div className="search-box mb-2">
                                <Search size={16} />
                                <input
                                    placeholder="Search by name, phone or vehicle plate..."
                                    value={searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setShowCustomerDropdown(true);
                                    }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    autoComplete="off"
                                />
                            </div>

                            {showCustomerDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid var(--navy-200)',
                                    borderRadius: '8px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 100,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}>
                                    {filteredCustomers.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--navy-400)' }}>
                                            No customers found for "{searchTerm}"
                                        </div>
                                    ) : (
                                        filteredCustomers.slice(0, 10).map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setShowCustomerDropdown(false);
                                                    setSearchTerm(c.name || c.phone || '');
                                                }}
                                                style={{
                                                    padding: '12px',
                                                    borderBottom: '1px solid #eee',
                                                    background: selectedCustomer?.id === c.id ? 'var(--primary-light)' : 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <strong>{c.name || 'Unnamed'}</strong>
                                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{c.licensePlate}</span>
                                                </div>
                                                <small style={{ color: 'var(--navy-500)' }}>{c.phone}</small>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {selectedCustomer && !showCustomerDropdown && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    background: '#f0fdf4',
                                    borderRadius: '6px',
                                    border: '1px solid #bbf7d0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: '0.85rem', color: '#166534' }}>
                                        Selected: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.licensePlate})
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-link"
                                        onClick={() => setSelectedCustomer(null)}
                                        style={{ fontSize: '0.75rem', color: '#166534' }}
                                    >
                                        Change
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="form-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label>Customer Name *</label>
                                <input
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone Number *</label>
                                <input
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    placeholder="Enter phone number"
                                    type="tel"
                                />
                            </div>
                            <div className="form-group">
                                <label>Vehicle Number (License Plate) *</label>
                                <input
                                    value={newCustomer.vehicleNumber}
                                    onChange={e => setNewCustomer({ ...newCustomer, vehicleNumber: e.target.value.toUpperCase() })}
                                    placeholder="e.g. TN01AB1234"
                                />
                            </div>
                        </div>
                    )}

                    {(selectedCustomer || (activeTab === 'new' && newCustomer.name)) && (
                        <div style={{
                            padding: '1rem',
                            background: 'var(--primary-light)',
                            borderRadius: '8px',
                            marginTop: '1rem'
                        }}>
                            <strong>Summary:</strong>
                            <p style={{ margin: '0.5rem 0 0' }}>
                                {activeTab === 'existing' ? selectedCustomer.name : newCustomer.name} - {plan.name} ({vehicleType.toUpperCase()})
                                <br />
                                <strong style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                                    ₹{Number(salePrice).toLocaleString()}
                                </strong>
                            </p>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleAssign}
                        disabled={loading || (activeTab === 'existing' && !selectedCustomer) || (activeTab === 'new' && (!newCustomer.name || !newCustomer.phone || !newCustomer.vehicleNumber))}
                    >
                        {loading ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditSubscriptionModal = ({ subscription, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [expiryDate, setExpiryDate] = useState(
        subscription.expiryDate?.toDate ? subscription.expiryDate.toDate().toISOString().split('T')[0] :
            new Date(subscription.expiryDate.seconds * 1000).toISOString().split('T')[0]
    );
    const [status, setStatus] = useState(subscription.status);
    const [vehicleNumber, setVehicleNumber] = useState(subscription.vehicleNumber);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateDoc(doc(db, 'customer_amc_subscriptions', subscription.id), {
                expiryDate: Timestamp.fromDate(new Date(expiryDate)),
                status,
                vehicleNumber,
                updatedAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error updating subscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Edit Subscription</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleUpdate}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Customer</label>
                            <input value={subscription.customerName} disabled style={{ background: '#f5f5f5' }} />
                        </div>
                        <div className="form-group">
                            <label>Vehicle Number</label>
                            <input
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Expiry Date</label>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="active">Active</option>
                                <option value="expired">Expired</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Updating...' : 'Update Subscription'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Service Tracking Modal - Track individual service usage with tick boxes
const ServiceTrackingModal = ({ subscription, onClose, onUpdate }) => {
    const [serviceTracking, setServiceTracking] = useState(subscription.serviceTracking || []);
    const [saving, setSaving] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [showAddUsage, setShowAddUsage] = useState(false);
    const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);
    const [usageNotes, setUsageNotes] = useState('');

    const addUsage = async (serviceIndex) => {
        if (!usageDate) return;

        setSaving(true);
        const updated = [...serviceTracking];
        const serviceType = serviceTracking[serviceIndex].serviceType;

        updated[serviceIndex].usages.push({
            date: usageDate,
            notes: usageNotes,
            addedAt: new Date().toISOString()
        });

        try {
            // Update Subscription
            await updateDoc(doc(db, 'customer_amc_subscriptions', subscription.id), {
                serviceTracking: updated,
                updatedAt: serverTimestamp()
            });

            /*
            // Generate 0-value Invoice for Record
            const invoiceData = {
                invoiceNumber: `INV-AMC-USE-${Date.now()}`,
                customerId: subscription.customerId,
                customerName: subscription.customerName,
                customerPhone: subscription.customerPhone || '',
                vehicleNumber: subscription.vehicleNumber,
                vehicleModel: subscription.vehicleModel || '',
                date: usageDate,
                items: [
                    {
                        description: `AMC Redemption: ${serviceType}`,
                        quantity: 1,
                        price: 0,
                        total: 0
                    }
                ],
                subtotal: 0,
                tax: 0,
                total: 0,
                amountPaid: 0,
                balance: 0,
                status: 'Paid', // or 'AMC Usage'
                paymentMethod: 'AMC',
                notes: `AMC Usage: ${serviceType}. ${usageNotes}`,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'invoices'), invoiceData);
            */

            setServiceTracking(updated);
            setShowAddUsage(false);
            setSelectedService(null);
            setUsageNotes('');
            onUpdate();
        } catch (error) {
            console.error('Error updating usage:', error);
            alert('Error saving: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const removeUsage = async (serviceIndex, usageIndex) => {
        if (!window.confirm('Remove this service usage?')) return;

        setSaving(true);
        const updated = [...serviceTracking];
        updated[serviceIndex].usages.splice(usageIndex, 1);

        try {
            await updateDoc(doc(db, 'customer_amc_subscriptions', subscription.id), {
                serviceTracking: updated,
                updatedAt: serverTimestamp()
            });
            setServiceTracking(updated);
            onUpdate();
        } catch (error) {
            console.error('Error removing usage:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2>
                        <ShieldCheck size={20} /> Service Tracking
                    </h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {/* Customer Info */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: subscription.planType === 'premium' ? 'linear-gradient(135deg, #1a1a2e, #2d2d44)' : 'linear-gradient(135deg, #1a3a1a, #2d5a27)',
                        borderRadius: '8px',
                        color: 'white',
                        marginBottom: '1.5rem'
                    }}>
                        <div>
                            <strong style={{ fontSize: '1.25rem' }}>{subscription.customerName}</strong>
                            <p style={{ margin: '0.25rem 0', opacity: 0.8 }}>{subscription.vehicleNumber}</p>
                            <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                background: subscription.planType === 'premium' ? '#d4af37' : 'rgba(255,255,255,0.2)',
                                color: subscription.planType === 'premium' ? '#1a1a2e' : 'white',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                            }}>
                                {subscription.planType || 'Standard'}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, opacity: 0.8 }}>Plan: {subscription.planName}</p>
                            <p style={{ margin: '0.25rem 0', opacity: 0.8 }}>
                                Vehicle: {subscription.vehicleType?.toUpperCase()}
                            </p>
                        </div>
                    </div>

                    {/* Service Tracking */}
                    {serviceTracking.map((service, serviceIndex) => (
                        <div key={serviceIndex} style={{
                            marginBottom: '1.5rem',
                            border: '1px solid var(--navy-200)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                background: 'var(--navy-50)'
                            }}>
                                <div>
                                    <strong>{service.serviceType}</strong>
                                    {service.description && (
                                        <span style={{ color: 'var(--navy-500)', marginLeft: '0.5rem' }}>
                                            - {service.description}
                                        </span>
                                    )}
                                    <br />
                                    <small style={{ color: 'var(--navy-500)' }}>
                                        {service.usages?.length || 0} / {service.totalAllowed} used
                                    </small>
                                </div>
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => { setSelectedService(serviceIndex); setShowAddUsage(true); }}
                                    disabled={(service.usages?.length || 0) >= service.totalAllowed}
                                >
                                    + Add Usage
                                </button>
                            </div>

                            {/* Tick Boxes */}
                            <div style={{ padding: '1rem' }}>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                }}>
                                    {Array.from({ length: service.totalAllowed }).map((_, idx) => {
                                        const usage = service.usages?.[idx];
                                        const isUsed = !!usage;
                                        return (
                                            <div
                                                key={idx}
                                                title={isUsed ? `Used on ${usage.date}${usage.notes ? ': ' + usage.notes : ''}` : `Service ${idx + 1}`}
                                                onClick={() => isUsed && removeUsage(serviceIndex, idx)}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isUsed ? 'var(--success)' : 'var(--navy-100)',
                                                    color: isUsed ? 'white' : 'var(--navy-400)',
                                                    cursor: isUsed ? 'pointer' : 'default',
                                                    transition: 'all 0.2s',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {isUsed ? <Check size={18} /> : idx + 1}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Usage Details */}
                                {service.usages?.length > 0 && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <small style={{ color: 'var(--navy-500)', display: 'block', marginBottom: '0.5rem' }}>
                                            Usage History:
                                        </small>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {service.usages.map((usage, idx) => (
                                                <span
                                                    key={idx}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: 'var(--success-light)',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--success-dark)'
                                                    }}
                                                >
                                                    #{idx + 1}: {usage.date}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Add Usage Modal */}
                    {showAddUsage && selectedService !== null && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1001
                        }}>
                            <div style={{
                                background: 'white',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                width: '90%',
                                maxWidth: '400px'
                            }}>
                                <h3 style={{ margin: '0 0 1rem' }}>
                                    Add Usage - {serviceTracking[selectedService]?.serviceType}
                                </h3>
                                <div className="form-group">
                                    <label>Date *</label>
                                    <input
                                        type="date"
                                        value={usageDate}
                                        onChange={(e) => setUsageDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Notes (Optional)</label>
                                    <input
                                        type="text"
                                        value={usageNotes}
                                        onChange={(e) => setUsageNotes(e.target.value)}
                                        placeholder="e.g., Regular wash, Employee name..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => { setShowAddUsage(false); setSelectedService(null); }}
                                        style={{ flex: 1 }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => addUsage(selectedService)}
                                        disabled={saving || !usageDate}
                                        style={{ flex: 1 }}
                                    >
                                        {saving ? 'Saving...' : 'Add Usage'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const SubscriptionInvoiceModal = ({ subscription, onClose, onSuccess, userProfile }) => {
    const [paymentSplits, setPaymentSplits] = useState([{ mode: 'cash', amount: '' }]);
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const ref = `INV-AMC-${Date.now().toString().slice(-6)}`;

            const totalPrice = Number(price) || 0;
            const paidAmount = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

            let paymentStatus = 'unpaid';
            if (paidAmount >= totalPrice && totalPrice > 0) paymentStatus = 'paid';
            else if (paidAmount > 0) paymentStatus = 'partial';

            const paymentHistory = paidAmount > 0 ? [{
                date: new Date().toISOString(),
                amount: paidAmount,
                splits: paymentSplits.filter(s => Number(s.amount) > 0).map(s => ({ mode: s.mode, amount: Number(s.amount) })),
                recordedBy: userProfile?.uid || 'system',
                note: 'AMC Milestone Payment'
            }] : [];

            const invoiceData = {
                bookingReference: ref,
                customerId: subscription.customerId || 'unknown',
                customerName: subscription.customerName || 'Unknown',
                contactPhone: subscription.customerPhone || '',
                licensePlate: subscription.vehicleNumber || '',
                carMake: '',
                carModel: '',
                serviceName: `AMC Payment: ${subscription.planName}`,
                price: totalPrice,
                paidAmount: paidAmount,
                paymentStatus: paymentStatus,
                paymentMode: paidAmount > 0 ? (paymentSplits[0]?.mode || 'cash') : 'none',
                paymentHistory: paymentHistory,
                status: 'completed',
                invoiceDate: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(),
                createdBy: userProfile?.uid || 'system',
                isManual: true,
                source: 'invoice'
            };

            await addDoc(collection(db, 'invoices'), invoiceData);

            alert('Invoice created successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><FileText size={20} /> Create AMC Invoice</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ padding: '20px' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Customer</label>
                            <input type="text" className="form-control" value={`${subscription.customerName} (${subscription.vehicleNumber})`} disabled style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Plan</label>
                            <input type="text" className="form-control" value={subscription.planName} disabled style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Invoice Amount (₹) *</label>
                            <input
                                type="number"
                                className="form-control"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                min="0"
                                required
                                placeholder="Enter amount to invoice"
                                style={{ width: '100%', padding: '8px' }}
                            />
                        </div>

                        <SplitPaymentSelector
                            splits={paymentSplits}
                            onAddSplit={() => setPaymentSplits([...paymentSplits, { mode: 'cash', amount: '' }])}
                            onRemoveSplit={(index) => {
                                if (paymentSplits.length > 1) {
                                    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
                                }
                            }}
                            onSplitChange={(index, field, value) => {
                                const newSplits = [...paymentSplits];
                                newSplits[index][field] = value;
                                setPaymentSplits(newSplits);
                            }}
                            totalAmount={Number(price) || 0}
                        />

                        <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Creating...' : 'Create Invoice'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AMCPlans;
