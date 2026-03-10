import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, ROLES, PERMISSIONS } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import {
    UserCog, Mail, Phone, Calendar, MapPin,
    ArrowLeft, Save, Shield, Clock, IndianRupee,
    CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import PermissionSelector from '../components/PermissionSelector';
import { logAction } from '../utils/logger';

const EmployeeDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, isAdmin, userProfile } = useAuth();

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Form States
    const [role, setRole] = useState('');
    const [permissions, setPermissions] = useState({});
    const [address, setAddress] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [dateOfJoining, setDateOfJoining] = useState('');
    const [phone, setPhone] = useState('');

    // Data States
    const [kpiStats, setKpiStats] = useState({ totalBookings: 0, thisMonth: 0, completedServices: 0 });
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0 });
    const [payrollData, setPayrollData] = useState(null);

    useEffect(() => {
        fetchEmployeeDetails();
    }, [id]);

    useEffect(() => {
        if (employee) {
            if (activeTab === 'attendance') fetchAttendance();
            if (activeTab === 'payroll' && isAdmin) fetchPayroll();
        }
    }, [activeTab, employee]);

    const fetchEmployeeDetails = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'adminUsers', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                setEmployee(data);

                // Initialize form states
                setRole(data.role || ROLES.EMPLOYEE);
                setPermissions(data.permissions || (PERMISSIONS[data.role] ? JSON.parse(JSON.stringify(PERMISSIONS[data.role])) : {}));
                setAddress(data.address || '');
                setEmergencyContact(data.emergencyContact || '');
                setDateOfJoining(data.dateOfJoining || '');
                setPhone(data.phone || '');

                // Fetch KPIs immediately
                fetchKPIs(data.id);
            } else {
                alert('Employee not found');
                navigate('/employees');
            }
        } catch (error) {
            console.error('Error fetching employee:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchKPIs = async (empId) => {
        try {
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('createdBy', '==', empId)
            );
            const snapshot = await getDocs(bookingsQuery);
            const bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            const thisMonth = new Date().toISOString().slice(0, 7);
            const thisMonthBookings = bookings.filter(b => b.bookingDate?.startsWith(thisMonth));
            const completed = bookings.filter(b => b.status === 'completed');

            setKpiStats({
                totalBookings: bookings.length,
                thisMonth: thisMonthBookings.length,
                completedServices: completed.length
            });
        } catch (error) {
            console.error('Error fetching KPIs:', error);
        }
    };

    const fetchAttendance = async () => {
        try {
            const attendanceQuery = query(
                collection(db, 'attendance'),
                where('userId', '==', id)
            );
            const snapshot = await getDocs(attendanceQuery);
            const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Sort manually to avoid Firestore composite index requirement
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            setAttendanceRecords(records.slice(0, 30));

            const present = records.filter(r => r.status === 'present' || r.status === 'permission' || r.checkIn).length;
            const absent = records.filter(r => r.status === 'absent').length;
            const late = records.filter(r => r.isLate).length;
            setAttendanceStats({ present, absent, late });
        } catch (error) {
            console.error('Error fetching attendance:', error);
        }
    };

    const fetchPayroll = async () => {
        try {
            const payrollQuery = query(
                collection(db, 'payroll'),
                where('employeeId', '==', id)
            );
            const snapshot = await getDocs(payrollQuery);
            if (!snapshot.empty) {
                setPayrollData(snapshot.docs[0].data());
            }
        } catch (error) {
            console.error('Error fetching payroll:', error);
        }
    };

    const handleSave = async () => {
        if (!hasPermission('employees', 'edit')) return;

        try {
            setSaving(true);
            await updateDoc(doc(db, 'adminUsers', id), {
                role,
                permissions,
                address,
                emergencyContact,
                dateOfJoining,
                updatedAt: serverTimestamp()
            });

            await logAction(userProfile, 'update', 'employees', `Updated details for ${employee.displayName}`, { userId: id });

            alert('Employee details updated successfully');
            fetchEmployeeDetails(); // Refresh
        } catch (error) {
            console.error('Error updating employee:', error);
            alert('Error updating details');
        } finally {
            setSaving(false);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '-';
        if (timestamp.toDate) return timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return timestamp;
    };

    if (loading) return <div className="loader-container"><div className="loader"></div></div>;
    if (!employee) return <div>Employee not found</div>;

    const canEdit = hasPermission('employees', 'edit');

    return (
        <div className="employee-details-page">
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn-icon" onClick={() => navigate('/employees')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1>{employee.displayName}</h1>
                        <p className="subtitle">{employee.email}</p>
                    </div>
                    <span className={`badge badge-${role}`}>{role}</span>
                </div>
                <div className="header-actions">
                    {canEdit && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                {isAdmin && (
                    <button
                        className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('permissions')}
                    >
                        Permissions
                    </button>
                )}
                <button
                    className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('attendance')}
                >
                    Attendance
                </button>
                {isAdmin && (
                    <button
                        className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payroll')}
                    >
                        Payroll
                    </button>
                )}
            </div>

            {/* Content Actions */}
            <div className="tab-content-area">

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="overview-grid">
                        {/* KPI Cards */}
                        <div className="full-width-section kpi-row">
                            <div className="stat-card">
                                <div className="stat-value">{kpiStats.totalBookings}</div>
                                <div className="stat-label">Total Bookings</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{kpiStats.thisMonth}</div>
                                <div className="stat-label">This Month</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value success">{kpiStats.completedServices}</div>
                                <div className="stat-label">Completed Services</div>
                            </div>
                        </div>

                        {/* Personal Info */}
                        <div className="card form-card">
                            <div className="card-header">
                                <h3><UserCog size={18} /> Personal Information</h3>
                            </div>
                            <div className="card-body form-grid">
                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <div className="input-icon">
                                        <Phone size={16} />
                                        <input
                                            value={employee.phone || ''}
                                            readOnly
                                            className="readonly"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Date of Joining</label>
                                    <div className="input-icon">
                                        <Calendar size={16} />
                                        <input
                                            type="date"
                                            value={dateOfJoining}
                                            onChange={(e) => setDateOfJoining(e.target.value)}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>
                                <div className="form-group full-width">
                                    <label>Address</label>
                                    <div className="input-icon">
                                        <MapPin size={16} />
                                        <textarea
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            disabled={!canEdit}
                                            rows={2}
                                            placeholder="Enter full address"
                                        />
                                    </div>
                                </div>
                                <div className="form-group full-width">
                                    <label>Emergency Contact</label>
                                    <div className="input-icon">
                                        <AlertTriangle size={16} />
                                        <input
                                            value={emergencyContact}
                                            onChange={(e) => setEmergencyContact(e.target.value)}
                                            disabled={!canEdit}
                                            placeholder="Name - Phone Number"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Role Management */}
                        {canEdit && (
                            <div className="card role-card">
                                <div className="card-header">
                                    <h3><Shield size={18} /> Role & Access</h3>
                                </div>
                                <div className="card-body">
                                    <div className="form-group">
                                        <label>Current Role</label>
                                        <select
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                            disabled={!isAdmin}
                                            className="role-select"
                                        >
                                            <option value={ROLES.EMPLOYEE}>Employee</option>
                                            <option value={ROLES.SENIOR_EMPLOYEE}>Senior Employee</option>
                                            <option value={ROLES.MANAGER}>Manager</option>
                                            <option value={ROLES.ADMIN}>Admin</option>
                                        </select>
                                        <p className="field-hint">Changing role provides default permissions. Use the Permissions tab for granular control.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PERMISSIONS TAB */}
                {activeTab === 'permissions' && (
                    <div className="permissions-tab">
                        <div className="alert alert-info">
                            <Shield size={18} />
                            <div>
                                <strong>Granular Permissions</strong>
                                <p>Adjusting these settings will override user's role-based defaults.</p>
                            </div>
                        </div>
                        <PermissionSelector
                            currentPermissions={permissions}
                            onChange={setPermissions}
                            role={role}
                        />
                    </div>
                )}

                {/* ATTENDANCE TAB */}
                {activeTab === 'attendance' && (
                    <div className="attendance-tab">
                        <div className="stats-row mb-4">
                            <div className="stat-card mini success">
                                <span>Present</span>
                                <strong>{attendanceStats.present}</strong>
                            </div>
                            <div className="stat-card mini danger">
                                <span>Absent</span>
                                <strong>{attendanceStats.absent}</strong>
                            </div>
                            <div className="stat-card mini warning">
                                <span>Late</span>
                                <strong>{attendanceStats.late}</strong>
                            </div>
                        </div>

                        <div className="card">
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceRecords.length > 0 ? (
                                            attendanceRecords.map(record => (
                                                <tr key={record.id}>
                                                    <td>{record.date}</td>
                                                    <td>{formatTime(record.checkIn)}</td>
                                                    <td>{formatTime(record.checkOut)}</td>
                                                    <td>
                                                        <span className={`badge ${record.isLate ? 'badge-pending' : 'badge-confirmed'}`}>
                                                            {record.isLate ? 'Late' : 'On Time'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="4" className="text-center">No records found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .employee-details-page {
                    padding-bottom: 2rem;
                }
                
                .tabs-container {
                    display: flex;
                    border-bottom: 1px solid var(--navy-200);
                    margin-bottom: 1.5rem;
                    gap: 1rem;
                }
                
                .tab-btn {
                    padding: 0.75rem 1rem;
                    background: transparent;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--navy-500);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .tab-btn:hover {
                    color: var(--primary);
                }
                
                .tab-btn.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                }
                
                .overview-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                }
                
                .kpi-row {
                    grid-column: 1 / -1;
                    display: flex;
                    gap: 1rem;
                }
                
                .stat-card {
                    background: white;
                    padding: 1.25rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    flex: 1;
                    text-align: center;
                    box-shadow: var(--shadow-sm);
                }
                
                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--navy-800);
                    margin-bottom: 0.25rem;
                }
                
                .stat-value.success { color: #10b981; }
                
                .stat-label {
                    color: var(--navy-500);
                    font-size: 0.85rem;
                }
                
                .form-card, .role-card {
                    height: fit-content;
                }
                
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                
                .full-width {
                    grid-column: 1 / -1;
                }
                
                .input-icon {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                
                .input-icon svg {
                    position: absolute;
                    left: 10px;
                    color: var(--navy-400);
                }
                
                .input-icon input, .input-icon textarea {
                    padding-left: 2.5rem;
                    width: 100%;
                }
                
                .role-select {
                    width: 100%;
                    padding: 0.75rem;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--navy-200);
                }
                
                .field-hint {
                    font-size: 0.75rem;
                    color: var(--navy-400);
                    margin-top: 0.5rem;
                }
                
                .permissions-tab {
                    background: white;
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                }
                
                @media (max-width: 900px) {
                    .overview-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .kpi-row {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
};

export default EmployeeDetails;
