import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
    serverTimestamp
} from 'firebase/firestore';
import {
    Clock,
    ToggleLeft,
    ToggleRight,
    Package,
    ShieldCheck,
    Database,
    Filter,
    UploadCloud,
    Wallet,
    Car,
    Edit,
    Plus,
    Trash2
} from 'lucide-react';
import { seedCeramicServices } from '../utils/seedCeramic';

// Service Catalogue - Default services to seed
// Service Catalogue - Default services to seed
const SERVICE_CATALOGUE = [
    // Detailed Wash Category
    {
        name: 'Express Wash',
        category: 'Detailed Wash',
        description: 'Foam wash, Undercarriage wash, Floor vacuum, Paper mats, Perfume spray, RO water, Wheel cleaning',
        prices: { hatchback: 499, sedan: 599, suv: 699, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 30,
        sortOrder: 1
    },
    {
        name: 'Deluxe Wash',
        category: 'Detailed Wash',
        description: 'All of Express Wash included, Windshield protection, Dashboard clean & polish, Engine bay (optional), Pre-clean, Wheel polish',
        prices: { hatchback: 699, sedan: 799, suv: 899, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 45,
        sortOrder: 2
    },
    {
        name: 'Premium Deep Clean',
        category: 'Detailed Wash',
        description: 'All of Deluxe Wash included, Interior vacuum, Dashboard/Console polish, Tire & rim enrichment, Exterior plastic polish, Panel wipe',
        prices: { hatchback: 799, sedan: 899, suv: 999, luxury_suv: 1199, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 60,
        sortOrder: 3
    },
    {
        name: 'Ceramic Boost Wash',
        category: 'Detailed Wash',
        description: 'All of Premium Deep Clean included, Ceramic shampoo, Ceramic foam wash, Rainwater repellent, Ceramic spray, Anti-bacterial protection',
        prices: { hatchback: 1799, sedan: 1899, suv: 1999, luxury_suv: 2099, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 90,
        sortOrder: 4
    },
    {
        name: 'Interior & Exterior Revival',
        category: 'Detailed Wash',
        description: 'Headliner revive, Interior blowout, Interior glow-up, Dashboard makeover, Exterior reboot, AC vent revival',
        prices: { hatchback: 2799, sedan: 2899, suv: 3199, luxury_suv: 3499, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 120,
        sortOrder: 5
    },
    // Paint Correction & Polish Category
    {
        name: 'Gloss Enhancer',
        category: 'Paint Correction (Polish)',
        description: 'Single-stage machine polish, Light swirl reduction, Enhanced gloss',
        prices: { hatchback: 3799, sedan: 4199, suv: 4599, luxury_suv: 0, scooter: 0, bike: 1799, superbike: 0 },
        durationMinutes: 180,
        sortOrder: 6
    },
    {
        name: 'Intermediate Polish',
        category: 'Paint Correction (Polish)',
        description: '3-stage polish, Moderate scratch removal, Deep gloss',
        prices: { hatchback: 5499, sedan: 5999, suv: 6399, luxury_suv: 0, scooter: 0, bike: 2499, superbike: 0 },
        durationMinutes: 240,
        sortOrder: 7
    },
    {
        name: 'Ultimate Mirror Finish',
        category: 'Paint Correction (Polish)',
        description: 'Multi-stage correction, Heavy scratch & oxidation removal, Showroom finish',
        prices: { hatchback: 7399, sedan: 7899, suv: 8299, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 360,
        sortOrder: 8
    },
    {
        name: 'Spot Correction',
        category: 'Paint Correction (Polish)',
        description: 'Moderate scratch removal, 2-stage machine polish (60x60 cm)',
        prices: { hatchback: 1499, sedan: 1499, suv: 1499, luxury_suv: 1499, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 60,
        sortOrder: 9
    },
    {
        name: 'Single Panel Protection',
        category: 'Paint Correction (Polish)',
        description: 'Moderate scratch removal, 2-stage polish, Single side/front/back',
        prices: { hatchback: 2999, sedan: 3299, suv: 3499, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 120,
        sortOrder: 10
    },
    {
        name: 'Teflon Paint Protection',
        category: 'Paint Correction (Polish)',
        description: 'Paint protection, Enhanced gloss, Scratch & fade resistance',
        prices: { hatchback: 3899, sedan: 4199, suv: 4399, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 120,
        sortOrder: 11
    },
    {
        name: 'Hard Water Removal',
        category: 'Paint Correction (Polish)',
        description: 'Hard water removal, Two-stage solution, Machine polish',
        prices: { hatchback: 1199, sedan: 3499, suv: 4499, luxury_suv: 5499, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 90,
        sortOrder: 12
    },
    // Mechanical / Restore Your Ride
    {
        name: 'AC Gas Service',
        category: 'Mechanical',
        description: 'Full gas refill, Leak check, Vent temperature test (R134a/R1234yf)',
        prices: { hatchback: 899, sedan: 899, suv: 1099, luxury_suv: 1099, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 60,
        sortOrder: 13
    },
    {
        name: '3D Wheel Alignment',
        category: 'Mechanical',
        description: 'Precision 3D Wheel Alignment',
        prices: { hatchback: 449, sedan: 449, suv: 449, luxury_suv: 449, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 45,
        sortOrder: 14
    },
    {
        name: 'Wheel Balancing',
        category: 'Mechanical',
        description: 'Computerized Balancing',
        prices: { hatchback: 349, sedan: 349, suv: 349, luxury_suv: 349, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 45,
        sortOrder: 15
    },
    {
        name: 'Underbody Coating',
        category: 'Mechanical',
        description: 'Underbody Paint Protection / Anti-rust',
        prices: { hatchback: 2749, sedan: 3249, suv: 3749, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 90,
        sortOrder: 16
    },
    // 2-Wheeler Specific
    {
        name: "Standard Bike Wash",
        category: 'Detailed Wash',
        description: 'Foam wash, Spray polish, Pre-clean, Wheel clean & polish',
        prices: { hatchback: 0, sedan: 0, suv: 0, luxury_suv: 0, scooter: 199, bike: 249, superbike: 299 },
        durationMinutes: 20,
        sortOrder: 17
    },
    {
        name: 'Chain Lubrication',
        category: 'Detailed Wash',
        description: 'Chain Lubrication',
        prices: { hatchback: 0, sedan: 0, suv: 0, luxury_suv: 0, scooter: 69, bike: 69, superbike: 69 },
        durationMinutes: 10,
        sortOrder: 18
    }
];

const CATEGORIES = ['All', 'Detailed Wash', 'Paint Correction (Polish)', 'Ceramic', 'Mechanical'];

const Services = () => {
    const { t } = useTranslation();
    const { hasPermission, isAdmin, userProfile } = useAuth();
    const { currentCurrency, currency: currentCurrencyCode, formatCurrency: globalFormatCurrency } = useCurrency();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        if (userProfile?.companyId) {
            fetchServices();
        }
    }, [currentCurrencyCode, userProfile?.companyId]);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const companyId = userProfile?.companyId;
            if (!companyId) {
                if (loading) setLoading(false);
                return;
            }

            const q = query(
                collection(db, 'services'), 
                where('companyId', '==', companyId),
                orderBy('sortOrder', 'asc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServices(data);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    // Seed all services from catalogue
    const seedServices = async () => {
        const companyId = userProfile?.companyId;
        if (!companyId) {
            alert('Cannot seed: Company ID missing');
            return;
        }

        if (!window.confirm(t('seed_services_confirm'))) return;

        setSeeding(true);
        try {
            for (const service of SERVICE_CATALOGUE) {
                // Check if service already exists by name FOR THIS COMPANY
                const existingQuery = query(
                    collection(db, 'services'), 
                    where('name', '==', service.name),
                    where('companyId', '==', companyId)
                );
                const existing = await getDocs(existingQuery);

                if (existing.empty) {
                    await addDoc(collection(db, 'services'), {
                        ...service,
                        isActive: true,
                        materials: [],
                        companyId: companyId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // Update existing service with new prices (merge)
                    const docId = existing.docs[0].id;
                    const currentData = existing.docs[0].data();

                    // Merge prices: catalogue is base, current overrides it. 
                    // BUT for new keys (bike, etc) which are missing in current, catalogue values will take effect.
                    // Wait, if I want to ADD missing keys, I should do:
                    // newPrices = { ...service.prices, ...currentData.prices }
                    // However, if currentData.prices is missing 'bike', it will take from service.prices.
                    // If currentData.prices has 'sedan', it keeps it. Perfect.

                    const updatedPrices = {
                        ...service.prices,
                        ...(currentData.prices || {})
                    };

                    await updateDoc(doc(db, 'services', docId), {
                        prices: updatedPrices,
                        category: service.category, // Sync category/sortOrder too if needed
                        sortOrder: service.sortOrder,
                        updatedAt: serverTimestamp()
                    });
                }
            }
            alert(t('services_synced_success'));
            fetchServices();
        } catch (error) {
            console.error('Error seeding services:', error);
            alert('Error seeding services: ' + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleSeedCeramic = async () => {
        if (!window.confirm(t('seed_ceramic_confirm'))) return;
        setSeeding(true);
        try {
            const res = await seedCeramicServices(db, { email: 'Admin' });
            alert(`Ceramic Seeding: Added ${res.addedCount} services.`);
            fetchServices();
        } catch (error) {
            console.error(error);
            alert('Failed: ' + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const toggleServiceActive = async (serviceId, currentActive) => {
        try {
            await updateDoc(doc(db, 'services', serviceId), {
                isActive: !currentActive,
                updatedAt: serverTimestamp()
            });
            setServices(prev => prev.map(s =>
                s.id === serviceId ? { ...s, isActive: !currentActive } : s
            ));
        } catch (error) {
            console.error('Error toggling service:', error);
        }
    };

    const deleteService = async (serviceId) => {
        if (!window.confirm(t('delete_service_confirm'))) return;

        try {
            await deleteDoc(doc(db, 'services', serviceId));
            setServices(prev => prev.filter(s => s.id !== serviceId));
        } catch (error) {
            console.error('Error deleting service:', error);
        }
    };

    const formatCurrency = (amount) => {
        return globalFormatCurrency(amount || 0);
    };

    const formatDuration = (minutes) => {
        if (!minutes) return '-';
        if (minutes < 60) return `${minutes} ${t('mins')}`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}${t('hours_short')} ${mins}${t('mins')}` : `${hours}${t('hours_short')}`;
    };

    // Filter services by category
    const filteredServices = selectedCategory === 'All'
        ? services
        : services.filter(s => s.category === selectedCategory);

    // Group services by category for display
    const groupedServices = filteredServices.reduce((acc, service) => {
        const cat = service.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(service);
        return acc;
    }, {});

    return (
        <div className="services-page">
            <div className="page-header">
                <div>
                    <h1><Car size={28} /> {t('services')}</h1>
                    <p className="subtitle">{t('manage_services_subtitle')}</p>
                </div>
                <div className="header-actions">
                    {hasPermission('services', 'create') && (
                        <>
                            <Link to="/amc-plans" className="btn btn-secondary">
                                <ShieldCheck size={18} /> {t('manage_amc_packages')}
                            </Link>

                            <button className="btn btn-primary" onClick={() => { setEditingService(null); setShowModal(true); }}>
                                <Plus size={18} /> {t('add_service')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Category Filter */}
            <div className="category-filter" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {t(cat.toLowerCase().replace(/[\(\)]/g, '').replace(/\s+/g, '_'))}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Car size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{services.length}</span>
                        <span className="stat-label">{t('total_services')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <ToggleRight size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{services.filter(s => s.isActive).length}</span>
                        <span className="stat-label">{t('active')}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Filter size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{Object.keys(groupedServices).length}</span>
                        <span className="stat-label">{t('categories')}</span>
                    </div>
                </div>
            </div>

            {/* Services by Category */}
            {loading ? (
                <div className="empty-state">
                    <div className="loader"></div>
                    <p>{t('loading_services')}</p>
                </div>
            ) : Object.keys(groupedServices).length === 0 ? (
                <div className="empty-state">
                    <Car size={48} />
                    <p>{t('no_services_found')}</p>
                    <p style={{ color: 'var(--navy-400)', marginBottom: '1rem' }}>
                        {t('seed_services_prompt')}
                    </p>
                    {hasPermission('services', 'create') && (
                        <button className="btn btn-primary" onClick={seedServices} disabled={seeding}>
                            <Database size={18} /> {seeding ? t('seeding') : t('seed_all_services')}
                        </button>
                    )}
                </div>
            ) : (
                Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category} className="category-section" style={{ marginBottom: '2rem' }}>
                        <h2 style={{
                            fontSize: '1.25rem',
                            fontWeight: '600',
                            color: 'var(--navy-800)',
                            marginBottom: '1rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '2px solid var(--primary)'
                        }}>
                            {t(category.toLowerCase().replace(/[\(\)]/g, '').replace(/\s+/g, '_'))} ({categoryServices.length})
                        </h2>
                        <div className="services-grid">
                            {categoryServices.map(service => (
                                <div key={service.id} className={`service-card ${!service.isActive ? 'inactive' : ''}`}>
                                    <div className="service-card-header">
                                        <h3>{t(service.name)}</h3>
                                        {hasPermission('services', 'edit') && (
                                            <button
                                                className="btn-icon"
                                                onClick={() => toggleServiceActive(service.id, service.isActive)}
                                                title={service.isActive ? t('deactivate') : t('activate')}
                                            >
                                                {service.isActive ? <ToggleRight size={20} color="var(--success)" /> : <ToggleLeft size={20} />}
                                            </button>
                                        )}
                                    </div>
                                    <p className="service-description">{t(service.description) || t('no_description')}</p>

                                    {/* Vehicle Type Pricing */}
                                    {service.prices ? (
                                        <div className="vehicle-prices" style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
                                            gap: '0.5rem',
                                            marginBottom: '1rem',
                                            padding: '0.75rem',
                                            background: 'var(--navy-50)',
                                            borderRadius: '8px'
                                        }}>
                                            {/* Render all non-zero prices dynamically */}
                                            {['scooter', 'bike', 'superbike', 'hatchback', 'sedan', 'suv', 'luxury_suv'].map(type => (
                                                service.prices[type] > 0 && (
                                                    <div key={type} style={{ textAlign: 'center' }}>
                                                        <small style={{ color: 'var(--navy-500)', display: 'block', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                            {t(`${type}_label`)}
                                                        </small>
                                                        <strong style={{ color: 'var(--navy-800)', fontSize: '0.9rem' }}>
                                                            {formatCurrency(service.prices[type])}
                                                        </strong>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="service-meta">
                                            <span style={{ fontWeight: 'bold' }}>
                                                {currentCurrencyCode}
                                            </span> {formatCurrency(service.price)}
                                        </div>
                                    )}

                                    <div className="service-meta">
                                        <span><Clock size={16} /> {formatDuration(service.durationMinutes)}</span>
                                    </div>

                                    {service.materials?.length > 0 && (
                                        <div className="service-materials-badge">
                                            <Package size={14} />
                                            <span>{service.materials.length} {t('material')}{service.materials.length > 1 ? 's' : ''}</span>
                                        </div>
                                    )}

                                    {hasPermission('services', 'edit') && (
                                        <div className="service-actions">
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => { setEditingService(service); setShowModal(true); }}
                                            >
                                                <Edit size={14} /> {t('edit')}
                                            </button>
                                            {hasPermission('services', 'delete') && (
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => deleteService(service.id)}
                                                    style={{ color: 'var(--danger)' }}
                                                >
                                                    <Trash2 size={14} /> {t('delete')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {showModal && (
                <ServiceModal
                    service={editingService}
                    onClose={() => { setShowModal(false); setEditingService(null); }}
                    onSuccess={fetchServices}
                />
            )}

            <style>{`
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        
        .service-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          border: 1px solid var(--navy-100);
          box-shadow: var(--shadow-sm);
        }
        
        .service-card.inactive {
          opacity: 0.6;
          background: var(--navy-50);
        }
        
        .service-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        
        .service-card-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .service-description {
          color: var(--navy-500);
          font-size: 0.875rem;
          margin-bottom: 1rem;
          min-height: 2.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .service-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.75rem;
          color: var(--navy-700);
          font-weight: 600;
        }
        
        .service-meta span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .service-actions {
          display: flex;
          gap: 0.5rem;
        }

        .service-materials-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          background: var(--primary-light);
          color: var(--primary);
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .header-actions {
            width: 100%;
            flex-direction: column;
          }

          .header-actions .btn,
          .header-actions a.btn {
            width: 100%;
            justify-content: center;
          }

          .category-filter {
            justify-content: flex-start;
            overflow-x: auto;
            padding-bottom: 0.5rem;
            -webkit-overflow-scrolling: touch;
          }

          .category-filter .btn {
            white-space: nowrap;
          }

          .quick-stats-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }

          .quick-stat-card {
            padding: 0.75rem;
            margin-bottom: 0;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }

          .vehicle-prices {
            grid-template-columns: repeat(3, 1fr) !important;
          }

          .modal-content {
            width: 95% !important;
            margin: 10px auto !important;
            padding: 1.25rem;
          }

          .form-row {
            flex-direction: column;
            gap: 0 !important;
          }

          .form-group[style*="flex: 2"],
          .form-group[style*="flex: 1"] {
            flex: none !important;
            width: 100%;
          }

          div[style*="display: flex"][style*="align-items: center"][style*="gap: 0.75rem"] {
            flex-direction: column;
            align-items: stretch !important;
            gap: 0.5rem !important;
            position: relative;
            padding-right: 2.5rem !important;
          }

          div[style*="display: flex"][style*="align-items: center"][style*="gap: 0.75rem"] input,
          div[style*="display: flex"][style*="align-items: center"][style*="gap: 0.75rem"] select {
            width: 100% !important;
          }

          div[style*="display: flex"][style*="align-items: center"][style*="gap: 0.75rem"] button {
            position: absolute;
            right: 0.5rem;
            top: 0.5rem;
          }

          div[style*="display: flex"][style*="align-items: center"][style*="gap: 0.75rem"] span[style*="min-width: 50px"] {
             text-align: right;
             margin-top: 0.25rem;
          }
        }
      `}</style>
        </div>
    );
};

const ServiceModal = ({ service, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { currentCurrency, formatCurrency: globalFormatCurrency } = useCurrency();
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [selectedMaterials, setSelectedMaterials] = useState(service?.materials || []);
    const [showMaterialPicker, setShowMaterialPicker] = useState(false);

    // Vehicle type pricing
    const [priceHatchback, setPriceHatchback] = useState(service?.prices?.hatchback || service?.price || 0);
    const [priceSedan, setPriceSedan] = useState(service?.prices?.sedan || service?.price || 0);
    const [priceSuv, setPriceSuv] = useState(service?.prices?.suv || service?.price || 0);
    const [priceLuxurySuv, setPriceLuxurySuv] = useState(service?.prices?.luxury_suv || 0);
    const [priceScooter, setPriceScooter] = useState(service?.prices?.scooter || 0);
    const [priceBike, setPriceBike] = useState(service?.prices?.bike || 0);
    const [priceSuperBike, setPriceSuperBike] = useState(service?.prices?.superbike || 0);

    const [category, setCategory] = useState(service?.category || 'Detailed Wash');

    useEffect(() => {
        fetchMaterials();
    }, []);

    const fetchMaterials = async () => {
        try {
            const companyId = userProfile?.companyId;
            if (!companyId) return;

            const q = query(collection(db, 'materials'), where('companyId', '==', companyId));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(data);
        } catch (error) {
            console.error('Error fetching materials:', error);
        }
    };

    const unitOptions = [
        { value: 'ml', label: 'ml' },
        { value: 'liters', label: t('liters', { defaultValue: 'Liters' }) },
        { value: 'grams', label: t('grams', { defaultValue: 'g' }) },
        { value: 'kg', label: t('kg', { defaultValue: 'kg' }) },
        { value: 'pieces', label: t('pieces', { defaultValue: 'Pieces' }) },
        { value: 'units', label: t('units', { defaultValue: 'Units' }) },
        { value: 'sheets', label: t('sheets', { defaultValue: 'Sheets' }) }
    ];

    const addMaterial = (material) => {
        if (selectedMaterials.find(m => m.materialId === material.id)) return;
        setSelectedMaterials([...selectedMaterials, {
            materialId: material.id,
            materialName: material.name,
            quantity: 1,
            unit: material.unit,
            baseUnit: material.unit,
            costPerUnit: material.costPerUnit
        }]);
        setShowMaterialPicker(false);
    };

    const updateMaterialQuantity = (materialId, quantity) => {
        setSelectedMaterials(prev => prev.map(m =>
            m.materialId === materialId ? { ...m, quantity: Number(quantity) } : m
        ));
    };

    const updateMaterialUnit = (materialId, unit) => {
        setSelectedMaterials(prev => prev.map(m =>
            m.materialId === materialId ? { ...m, unit } : m
        ));
    };

    const removeMaterial = (materialId) => {
        setSelectedMaterials(prev => prev.filter(m => m.materialId !== materialId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);

        const data = {
            name: formData.get('name'),
            description: formData.get('description'),
            category: category,
            prices: {
                hatchback: Number(priceHatchback),
                sedan: Number(priceSedan),
                suv: Number(priceSuv),
                luxury_suv: Number(priceLuxurySuv),
                scooter: Number(priceScooter),
                bike: Number(priceBike),
                superbike: Number(priceSuperBike)
            },
            price: Number(priceSedan), // Keep legacy price field for backward compatibility
            durationMinutes: Number(formData.get('duration')),
            sortOrder: Number(formData.get('sortOrder') || 0),
            materials: selectedMaterials,
            isActive: true,
            companyId: userProfile?.companyId,
            updatedAt: serverTimestamp()
        };

        try {
            if (service) {
                await updateDoc(doc(db, 'services', service.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'services'), data);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
        } finally {
            setLoading(false);
        }
    };

    // Unit conversion ratios (convert to base unit)
    const convertToBaseUnit = (quantity, fromUnit, baseUnit) => {
        // If same unit, no conversion needed
        if (fromUnit === baseUnit) return quantity;

        // Conversion factors
        const conversions = {
            // Volume
            'ml_to_liters': 0.001,
            'liters_to_ml': 1000,
            // Weight
            'grams_to_kg': 0.001,
            'kg_to_grams': 1000,
        };

        const key = `${fromUnit}_to_${baseUnit}`;
        if (conversions[key]) {
            return quantity * conversions[key];
        }

        // Check reverse conversion
        const reverseKey = `${baseUnit}_to_${fromUnit}`;
        if (conversions[reverseKey]) {
            return quantity / conversions[reverseKey];
        }

        return quantity; // No conversion found, return as-is
    };

    const calculateMaterialCost = () => {
        return selectedMaterials.reduce((sum, m) => {
            const convertedQty = convertToBaseUnit(m.quantity, m.unit, m.baseUnit || m.unit);
            return sum + (convertedQty * (m.costPerUnit || 0));
        }, 0);
    };

    const calculateItemCost = (mat) => {
        const convertedQty = convertToBaseUnit(mat.quantity, mat.unit, mat.baseUnit || mat.unit);
        return convertedQty * (mat.costPerUnit || 0);
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2>{service ? t('edit_service') : t('add_service_modal')}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>{t('service_name_label')}</label>
                                <input name="name" defaultValue={service?.name} required placeholder={t('service_name_placeholder')} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>{t('category_label')}</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                    <option value="Detailed Wash">{t('detailed_wash')}</option>
                                    <option value="Paint Correction (Polish)">{t('paint_correction_polish')}</option>
                                    <option value="Mechanical">{t('mechanical')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('description')}</label>
                            <textarea name="description" defaultValue={service?.description} rows="2" placeholder={t('no_description')} />
                        </div>

                        {/* Vehicle Type Pricing */}
                        <div className="form-group" style={{
                            padding: '1rem',
                            background: 'var(--navy-50)',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <label style={{ marginBottom: '0.75rem', display: 'block', fontWeight: '600' }}>
                                {t('vehicle_pricing_title')} ({currentCurrency.symbol})
                            </label>

                            <h5 style={{ fontSize: '0.85rem', color: 'var(--navy-600)', margin: '0 0 0.5rem 0', fontWeight: '600' }}>{t('four_wheelers')}</h5>
                            <div className="form-row" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('hatchback')}</label>
                                    <input type="number" value={priceHatchback || ''} onChange={(e) => setPriceHatchback(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('sedan')}</label>
                                    <input type="number" value={priceSedan || ''} onChange={(e) => setPriceSedan(e.target.value)} placeholder="0" style={{ fontWeight: '600', borderColor: 'var(--primary)' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('suv')}</label>
                                    <input type="number" value={priceSuv || ''} onChange={(e) => setPriceSuv(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('l_suv')}</label>
                                    <input type="number" value={priceLuxurySuv || ''} onChange={(e) => setPriceLuxurySuv(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                            </div>

                            <h5 style={{ fontSize: '0.85rem', color: 'var(--navy-600)', margin: '0 0 0.5rem 0', fontWeight: '600' }}>{t('two_wheelers')}</h5>
                            <div className="form-row" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('scooter')}</label>
                                    <input type="number" value={priceScooter || ''} onChange={(e) => setPriceScooter(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('bike_standard')}</label>
                                    <input type="number" value={priceBike || ''} onChange={(e) => setPriceBike(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('super_bike_sports')}</label>
                                    <input type="number" value={priceSuperBike || ''} onChange={(e) => setPriceSuperBike(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('duration_mins_label')}</label>
                                <input name="duration" type="number" defaultValue={service?.durationMinutes} required placeholder="45" />
                            </div>
                            <div className="form-group">
                                <label>{t('sort_order_label')}</label>
                                <input name="sortOrder" type="number" defaultValue={service?.sortOrder || 0} placeholder="0" />
                            </div>
                        </div>

                        {/* Materials Section */}
                        <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--navy-200)', paddingTop: '1.5rem' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{t('materials_used_label')}</span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setShowMaterialPicker(!showMaterialPicker)}
                                >
                                    {t('add_material_btn')}
                                </button>
                            </label>

                            {showMaterialPicker && (
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {materials.filter(m => !selectedMaterials.find(s => s.materialId === m.id)).map(material => (
                                        <div
                                            key={material.id}
                                            onClick={() => addMaterial(material)}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                                marginBottom: '0.25rem',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                background: 'white'
                                            }}
                                        >
                                            <span>{material.name}</span>
                                            <span style={{ color: 'var(--navy-400)', fontSize: '0.8rem' }}>
                                                {material.category} • {currentCurrency.symbol}{material.costPerUnit}/{material.unit}
                                            </span>
                                        </div>
                                    ))}
                                    {materials.filter(m => !selectedMaterials.find(s => s.materialId === m.id)).length === 0 && (
                                        <p style={{ color: 'var(--navy-400)', textAlign: 'center', padding: '1rem' }}>{t('no_more_materials')}</p>
                                    )}
                                </div>
                            )}

                            {selectedMaterials.length > 0 ? (
                                <div style={{ marginTop: '0.75rem' }}>
                                    {selectedMaterials.map(mat => (
                                        <div key={mat.materialId} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'var(--navy-50)',
                                            borderRadius: '8px',
                                            marginBottom: '0.5rem'
                                        }}>
                                            <span style={{ flex: 1, fontWeight: '500' }}>{mat.materialName}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={mat.quantity}
                                                onChange={(e) => updateMaterialQuantity(mat.materialId, e.target.value)}
                                                style={{ width: '70px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                            />
                                            <select
                                                value={mat.unit}
                                                onChange={(e) => updateMaterialUnit(mat.materialId, e.target.value)}
                                                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)', minWidth: '70px' }}
                                            >
                                                {unitOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <span style={{ color: 'var(--navy-400)', fontSize: '0.8rem', minWidth: '50px' }}>
                                                {currentCurrency.symbol}{calculateItemCost(mat).toFixed(2)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeMaterial(mat.materialId)}
                                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <div style={{ textAlign: 'right', marginTop: '0.5rem', fontWeight: '600', color: 'var(--navy-700)' }}>
                                        {t('material_cost_label')}: {currentCurrency.symbol}{calculateMaterialCost().toFixed(2)}
                                    </div>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--navy-400)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                    {t('no_materials_added')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? t('saving') : (service ? t('update_service') : t('add_service_modal'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Services;
