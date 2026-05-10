import { useState, useEffect } from 'react';
import {
    Database,
    Search,
    Download,
    Users,
    Phone,
    Car,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    Loader,
    Trash2,
    Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';

const CRMHistory = () => {
    const { t } = useTranslation();
    const { formatCurrency } = useCurrency();
    const [loading, setLoading] = useState(true);
    const [workbook, setWorkbook] = useState(null);
    const [activeSheet, setActiveSheet] = useState(0);
    const [sheetData, setSheetData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState(null);
    const rowsPerPage = 50;

    useEffect(() => {
        loadExcelFile();
    }, []);

    useEffect(() => {
        if (workbook) {
            loadSheetData(activeSheet);
        }
    }, [workbook, activeSheet]);

    const loadExcelFile = async () => {
        try {
            setLoading(true);
            const response = await fetch('/crm_old_data.xlsx');
            if (!response.ok) throw new Error('Failed to load Excel file');

            const arrayBuffer = await response.arrayBuffer();
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            setWorkbook(wb);
            setError(null);
        } catch (err) {
            console.error('Error loading Excel file:', err);
            setError('Failed to load CRM data file. Please ensure crm_old_data.xlsx is in the public folder.');
        } finally {
            setLoading(false);
        }
    };

    const loadSheetData = (sheetIndex) => {
        if (!workbook) return;

        const sheetName = workbook.SheetNames[sheetIndex];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (jsonData.length > 0) {
            // First row as headers
            const rawHeaders = jsonData[0].map((h, i) =>
                h?.toString().trim() || `Column ${i + 1}`
            );
            setHeaders(rawHeaders);
            // Rest as data - add unique IDs
            const dataWithIds = jsonData.slice(1)
                .filter(row => row.some(cell => cell !== '' && cell !== null))
                .map((row, idx) => ({ id: idx, data: row }));
            setSheetData(dataWithIds);
        } else {
            setHeaders([]);
            setSheetData([]);
        }
        setCurrentPage(1);
    };

    const deleteRow = (rowId) => {
        if (window.confirm('Are you sure you want to remove this record from the view?')) {
            setSheetData(prev => prev.filter(row => row.id !== rowId));
        }
    };

    const filteredData = sheetData.filter(row => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return row.data.some(cell =>
            cell?.toString().toLowerCase().includes(search)
        );
    });

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const exportCurrentSheet = () => {
        // Helper function to format Excel serial dates for export
        const formatExportValue = (value, colIndex) => {
            if (value === null || value === undefined || value === '') return '';

            // Format date columns - Excel stores dates as serial numbers
            if (headers[colIndex]?.toLowerCase().includes('date') ||
                headers[colIndex]?.toLowerCase().includes('created') ||
                headers[colIndex]?.toLowerCase().includes('updated')) {
                // Check if it's a number (Excel serial date)
                if (typeof value === 'number' && value > 25000 && value < 60000) {
                    // Convert Excel serial number to JavaScript Date
                    const excelEpoch = new Date(1899, 11, 30);
                    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
                    return date.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                }
            }
            return value;
        };

        // Format all data before export
        const formattedData = filteredData.map(r =>
            r.data.map((cell, colIndex) => formatExportValue(cell, colIndex))
        );

        const exportData = [headers, ...formattedData];
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        const sheetName = workbook?.SheetNames[activeSheet] || 'Sheet1';
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
        XLSX.writeFile(wb, `crm_export_${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const getVehicleTypeLabel = (type) => {
        const types = {
            'HA': 'Hatchback',
            'SE': 'Sedan',
            'SU': 'SUV',
            'PS': 'Pre-SUV'
        };
        return types[type] || type;
    };

    const formatCellValue = (value, colIndex) => {
        if (value === null || value === undefined || value === '') return '-';

        const header = headers[colIndex]?.toLowerCase() || '';

        // REDACTION LOGIC for privacy & production readiness
        
        // Mask phone numbers (e.g., 9790******)
        if (header.includes('mobile') || header.includes('phone')) {
            const str = value.toString();
            return str.length > 5 ? str.substring(0, 4) + '******' : '******';
        }

        // Mask vehicle numbers (e.g., TN09******)
        if (header.includes('vehicle number') || header.includes('reg') || header.includes('number')) {
            const str = value.toString().toUpperCase();
            return str.length > 4 ? str.substring(0, 4) + '****' : '****';
        }

        // Mask places (e.g., ASR****)
        if (header.includes('place') || header.includes('location')) {
            const str = value.toString();
            return str.length > 3 ? str.substring(0, 3) + '****' : '****';
        }

        // Format vehicle type
        if (header.includes('vehi type') || header === 'type') {
            return getVehicleTypeLabel(value);
        }

        // Format bill amount
        if (header.includes('bill') || header.includes('amount')) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                return formatCurrency(num);
            }
        }

        // Format date columns - Excel stores dates as serial numbers
        if (header.includes('date') || header.includes('created') || header.includes('updated')) {
            if (typeof value === 'number' && value > 25000 && value < 60000) {
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
                return date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
            if (typeof value === 'string' && value.match(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/)) {
                return value;
            }
        }

        return value.toString();
    };

    const getSheetStats = () => {
        const uniquePhones = new Set();
        const uniqueVehicles = new Set();

        sheetData.forEach(row => {
            // Find phone column
            const phoneIdx = headers.findIndex(h =>
                h?.toLowerCase().includes('mobile') || h?.toLowerCase().includes('phone')
            );
            if (phoneIdx >= 0 && row.data[phoneIdx]) {
                uniquePhones.add(row.data[phoneIdx].toString());
            }

            // Find vehicle column
            const vehicleIdx = headers.findIndex(h =>
                h?.toLowerCase().includes('vehicle number') || h?.toLowerCase().includes('number')
            );
            if (vehicleIdx >= 0 && row.data[vehicleIdx]) {
                uniqueVehicles.add(row.data[vehicleIdx].toString().toUpperCase());
            }
        });

        return {
            totalRecords: sheetData.length,
            uniqueCustomers: uniquePhones.size,
            uniqueVehicles: uniqueVehicles.size,
            filteredRecords: filteredData.length
        };
    };

    const stats = getSheetStats();

    if (loading) {
        return (
            <div className="crm-history-page">
                <div className="page-header">
                    <div>
                        <h1><Database size={28} /> {t('crm_history')}</h1>
                        <p className="subtitle">{t('loading_crm_data', { defaultValue: 'Loading old CRM data...' })}</p>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <Loader size={48} className="spin" />
                            <p>{t('loading_excel', { defaultValue: 'Loading Excel file...' })}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="crm-history-page">
                <div className="page-header">
                    <div>
                        <h1><Database size={28} /> {t('crm_history')}</h1>
                        <p className="subtitle">{t('old_crm_subtitle', { defaultValue: 'Old customer data visualization' })}</p>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <FileSpreadsheet size={48} />
                            <p>{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crm-history-page">
            <div className="page-header">
                <div>
                    <h1><Database size={28} /> {t('crm_history')}</h1>
                    <p className="subtitle">{t('old_crm_records_subtitle', { defaultValue: 'Old customer data from Excel • {{count}} records', count: stats.totalRecords })}</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={exportCurrentSheet}>
                        <Download size={18} /> {t('export')}
                    </button>
                </div>
            </div>

            {/* Sheet Tabs */}
            <div className="crm-sheet-tabs">
                {workbook?.SheetNames.map((name, index) => (
                    <button
                        key={name}
                        className={`sheet-tab ${activeSheet === index ? 'active' : ''}`}
                        onClick={() => setActiveSheet(index)}
                    >
                        <FileSpreadsheet size={16} />
                        <span>{name.length > 20 ? name.substring(0, 20) + '...' : name}</span>
                    </button>
                ))}
            </div>

            {/* Stats Cards */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.totalRecords}</span>
                        <span className="stat-label">{t('total_records', { defaultValue: 'Total Records' })}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <Users size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.uniqueCustomers}</span>
                        <span className="stat-label">{t('unique_phones', { defaultValue: 'Unique Phones' })}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Car size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.uniqueVehicles}</span>
                        <span className="stat-label">{t('unique_vehicles', { defaultValue: 'Unique Vehicles' })}</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <Phone size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.filteredRecords}</span>
                        <span className="stat-label">{t('filtered_results', { defaultValue: 'Filtered Results' })}</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="search-filter-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder={t('search_all_columns_placeholder', { defaultValue: 'Search across all columns...' })}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="card">
                <div className="card-body">
                    {paginatedData.length === 0 ? (
                        <div className="empty-state">
                            <Database size={48} />
                            <p>{t('no_records_found', { defaultValue: 'No records found' })}</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="table-container desktop-table">
                                <table className="data-table crm-data-table">
                                    <thead>
                                        <tr>
                                            {headers.slice(0, 7).map((header, i) => (
                                                <th key={i}>{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedData.map((row) => (
                                            <tr key={row.id}>
                                                {row.data.slice(0, 7).map((cell, cellIndex) => (
                                                    <td key={cellIndex}>
                                                        {formatCellValue(cell, cellIndex)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="mobile-cards">
                                {paginatedData.map((row) => {
                                    const nameIdx = headers.findIndex(h =>
                                        h?.toLowerCase().includes('siva') || h?.toLowerCase().includes('name')
                                    );
                                    const phoneIdx = headers.findIndex(h =>
                                        h?.toLowerCase().includes('mobile') || h?.toLowerCase().includes('phone')
                                    );
                                    const placeIdx = headers.findIndex(h =>
                                        h?.toLowerCase().includes('place')
                                    );
                                    const vehicleIdx = headers.findIndex(h =>
                                        h?.toLowerCase().includes('vehicle number')
                                    );
                                    const typeIdx = headers.findIndex(h =>
                                        h?.toLowerCase().includes('vehi type')
                                    );

                                    return (
                                        <div key={row.id} className="booking-card">
                                            <div className="booking-card-header">
                                                <strong>{row.data[nameIdx] || 'Unknown'}</strong>
                                                <span className="badge badge-confirmed">
                                                    {getVehicleTypeLabel(row.data[typeIdx])}
                                                </span>
                                            </div>
                                            <div className="booking-card-body">
                                                <p><Phone size={14} /> {formatCellValue(row.data[phoneIdx], phoneIdx)}</p>
                                                <p><Car size={14} /> {formatCellValue(row.data[vehicleIdx], vehicleIdx)}</p>
                                                <p>{formatCellValue(row.data[placeIdx], placeIdx)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="pagination-info">
                                        {t('page_info', { current: currentPage, total: totalPages, defaultValue: 'Page {{current}} of {{total}}' })}
                                    </span>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CRMHistory;
