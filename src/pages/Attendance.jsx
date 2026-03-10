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
    Calendar,
    Clock,
    UserCheck,
    UserX,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Save,
    Trash2,
    FileText,
    Plus,
    Download,
    Mail,
    Phone,
    Briefcase,
    Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Attendance = () => {
    const { hasPermission, userProfile, isAdmin } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showMarkModal, setShowMarkModal] = useState(false);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [stats, setStats] = useState({ present: 0, absent: 0, leaves: 0, overtime: 0 });

    useEffect(() => {
        fetchData();
    }, [currentMonth]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch employees from adminUsers collection
            const empSnapshot = await getDocs(query(
                collection(db, 'adminUsers'),
                where('status', '==', 'approved')
            ));
            const empData = empSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => {
                    const role = (u.role || '').toLowerCase();
                    const validRoles = ['admin', 'manager', 'senior_employee', 'employee', 'worker', 'staff'];
                    return validRoles.includes(role);
                });
            setEmployees(empData);

            // Fetch attendance for current month
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];

            const attQuery = query(
                collection(db, 'attendance'),
                where('date', '>=', startOfMonth),
                where('date', '<=', endOfMonth)
            );
            const attSnapshot = await getDocs(attQuery);
            const attData = attSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAttendance(attData);

            // Fetch holidays
            const holSnapshot = await getDocs(collection(db, 'holidays'));
            setHolidays(holSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            calculateStats(attData, empData);
        } catch (error) {
            console.error('Error fetching attendance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data, empDataToUse) => {
        const today = new Date().toISOString().split('T')[0];
        const todayAtt = data.filter(a => a.date === today);
        const totalEmployees = empDataToUse ? empDataToUse.length : employees.length;

        setStats({
            total: totalEmployees,
            present: todayAtt.filter(a => a.status === 'present' || a.status === 'permission' || a.status === 'half-day').length,
            leaves: todayAtt.filter(a => a.status.includes('leave')).length
        });
    };

    const handleMarkAttendance = async (userId, date, status, extraData = {}) => {
        try {
            const existing = attendance.find(a => a.userId === userId && a.date === date);
            const data = {
                userId,
                date,
                status,
                ...extraData,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile?.displayName || 'Admin'
            };

            if (existing) {
                await updateDoc(doc(db, 'attendance', existing.id), data);
            } else {
                await addDoc(collection(db, 'attendance'), {
                    ...data,
                    createdAt: serverTimestamp()
                });
            }
            fetchData();
        } catch (error) {
            console.error('Error marking attendance:', error);
        }
    };

    const handleAddHoliday = async (date, name) => {
        try {
            await addDoc(collection(db, 'holidays'), {
                date,
                name,
                createdAt: serverTimestamp()
            });
            fetchData();
        } catch (error) {
            console.error('Error adding holiday:', error);
        }
    };

    const handleDeleteHoliday = async (id) => {
        try {
            await deleteDoc(doc(db, 'holidays', id));
            fetchData();
        } catch (error) {
            console.error('Error deleting holiday:', error);
        }
    };

    const exportToExcel = () => {
        // Create matrix: Row = Employee, Col = Day
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const exportData = employees.map(emp => {
            const row = { 'Employee Name': emp.displayName };
            let totalPresent = 0;
            let totalOt = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const att = attendance.find(a => a.userId === emp.id && a.date === dateStr);
                row[d] = att ? att.status.charAt(0).toUpperCase() : '-';
                if (att?.status === 'present' || att?.status === 'permission') totalPresent++;
                totalOt += Number(att?.overtimeHours || 0);
            }

            row['Total Present'] = totalPresent;
            row['Total Overtime'] = totalOt.toFixed(1);
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `Attendance_${currentMonth.getFullYear()}_${currentMonth.getMonth() + 1}.xlsx`);
    };

    const changeMonth = (offset) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
        setCurrentMonth(newDate);
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const getStatusColor = (status) => {
        switch (status) {
            case 'present': return '#10b981';
            case 'permission': return '#0ea5e9';
            case 'absent': return '#ef4444';
            case 'half-day': return '#f59e0b';
            case 'paid_leave': return '#3b82f6';
            case 'unpaid_leave': return '#fca5a5';
            default: return null;
        }
    };

    const renderCalendarDays = () => {
        const days = [];
        // Empty cells for the start of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const isHoliday = holidays.some(h => h.date === dateStr);
            const dayAttendance = attendance.filter(a => a.date === dateStr);

            days.push(
                <div key={day} className={`calendar-day ${isToday ? 'today' : ''} ${isHoliday ? 'holiday' : ''}`}>
                    <div className="day-header">
                        <span className="day-number">{day}</span>
                        {isHoliday && <span style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 'bold' }}>HOLIDAY</span>}
                    </div>
                    <div className="day-dots">
                        {dayAttendance.map((att, idx) => (
                            <div
                                key={idx}
                                className="att-dot"
                                style={{ backgroundColor: getStatusColor(att.status) }}
                                title={`${employees.find(e => e.id === att.userId)?.displayName}: ${att.status}`}
                            />
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="attendance-page">
            <div className="page-header">
                <div>
                    <h1><Calendar size={28} /> Attendance</h1>
                    <p className="subtitle">Track employee attendance</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowHolidayModal(true)}>
                        Manage Holidays
                    </button>
                    {hasPermission('attendance', 'create') && (
                        <button className="btn btn-primary" onClick={() => setShowMarkModal(true)}>
                            <Plus size={18} /> Mark Attendance
                        </button>
                    )}
                </div>
            </div>

            {/* Attendance Stats Cards */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Users size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.total || 0}</span>
                        <span className="stat-label">Total Employees</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <UserCheck size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.present || 0}</span>
                        <span className="stat-label">Present Today</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <AlertCircle size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.leaves || 0}</span>
                        <span className="stat-label">On Leave</span>
                    </div>
                </div>
            </div>

            <div className="attendance-container">
                <div className="card calendar-card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn-icon" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
                        <h2 style={{ minWidth: '150px', textAlign: 'center', margin: 0 }}>
                            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button className="btn-icon" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
                    </div>
                    <div className="card-body">
                        {loading ? (
                            <div className="empty-state"><div className="loader"></div></div>
                        ) : (
                            <div className="calendar-grid-wrapper">
                                <div className="calendar-grid-header">
                                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                                </div>
                                <div className="calendar-days-grid">
                                    {renderCalendarDays()}
                                </div>
                                <div className="calendar-legend">
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#10b981' }}></span> Present</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#0ea5e9' }}></span> Permission</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#ef4444' }}></span> Absent</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#f59e0b' }}></span> Half-day</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#3b82f6' }}></span> Paid Leave</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#fca5a5' }}></span> Unpaid Leave</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#8b5cf6' }}></span> Overtime</div>
                                    <div className="legend-item"><span className="dot" style={{ backgroundColor: '#ddd6fe' }}></span> Holiday</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Monthly Summary Table */}
                <div className="card summary-card" style={{ marginTop: '2rem' }}>
                    <div className="card-header">
                        <h2>Monthly Summary</h2>
                    </div>
                    <div className="card-body">
                        <div className="table-responsive">
                            <table className="summary-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Present (Days)</th>
                                        <th>Absent</th>
                                        <th>Half Day</th>
                                        <th>Paid Leave</th>
                                        <th>Unpaid Leave</th>
                                        <th>Permission (Hrs)</th>
                                        <th>Overtime (Hrs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => {
                                        const empAtt = attendance.filter(a => a.userId === emp.id);
                                        const presentDays = empAtt.filter(a => a.status === 'present' || a.status === 'permission').length;
                                        const absentDays = empAtt.filter(a => a.status === 'absent').length;
                                        const halfDays = empAtt.filter(a => a.status === 'half-day').length;
                                        const paidLeaves = empAtt.filter(a => a.status === 'paid_leave').length;
                                        const unpaidLeaves = empAtt.filter(a => a.status === 'unpaid_leave').length;
                                        const permissionHrs = empAtt.reduce((sum, a) => sum + (Number(a.permissionHours) || 0), 0);
                                        const overtimeHrs = empAtt.reduce((sum, a) => sum + (Number(a.overtimeHours) || 0), 0);

                                        return (
                                            <tr key={emp.id}>
                                                <td data-label="Employee">
                                                    <div style={{ fontWeight: '600' }}>{emp.displayName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-400)' }}>{emp.role}</div>
                                                </td>
                                                <td data-label="Present (Days)">{presentDays}</td>
                                                <td data-label="Absent">{absentDays}</td>
                                                <td data-label="Half Day">{halfDays}</td>
                                                <td data-label="Paid Leave">{paidLeaves}</td>
                                                <td data-label="Unpaid Leave">{unpaidLeaves}</td>
                                                <td data-label="Permission (Hrs)">{permissionHrs.toFixed(1)}</td>
                                                <td data-label="Overtime (Hrs)">{overtimeHrs.toFixed(1)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {showMarkModal && (
                <MarkAttendanceModal
                    employees={employees}
                    attendance={attendance}
                    onClose={() => setShowMarkModal(false)}
                    onMark={handleMarkAttendance}
                />
            )}

            {showHolidayModal && (
                <HolidayModal
                    holidays={holidays}
                    onAdd={handleAddHoliday}
                    onDelete={handleDeleteHoliday}
                    onClose={() => setShowHolidayModal(false)}
                />
            )}

            <style>{`
                .calendar-grid-wrapper {
                    background: white;
                }
                .calendar-grid-header {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    text-align: center;
                    font-weight: 600;
                    color: var(--navy-500);
                    border-bottom: 1px solid var(--navy-100);
                    padding: 0.75rem 0;
                }
                .calendar-days-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    border-left: 1px solid var(--navy-100);
                    border-top: 1px solid var(--navy-100);
                }
                .calendar-day {
                    min-height: 100px;
                    border-right: 1px solid var(--navy-100);
                    border-bottom: 1px solid var(--navy-100);
                    padding: 0.5rem;
                    background: white;
                }
                .calendar-day.empty {
                    background: var(--navy-50);
                }
                .calendar-day.today {
                    background: #f0fdf4;
                }
                .calendar-day.holiday {
                    background: #f5f3ff;
                }
                .day-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .day-number {
                    font-weight: 600;
                    color: var(--navy-700);
                }
                .day-dots {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3px;
                }
                .att-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }
                .calendar-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    padding: 1rem;
                    justify-content: center;
                    border-top: 1px solid var(--navy-100);
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--navy-600);
                }
                .legend-item .dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                .table-responsive {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    white-space: nowrap;
                }
                .summary-table th, .summary-table td {
                    padding: 1rem;
                    text-align: left;
                    border-bottom: 1px solid var(--navy-100);
                    font-size: 0.9rem;
                }
                .summary-table th {
                    background: var(--navy-50);
                    color: var(--navy-600);
                    font-weight: 600;
                }
                .summary-table tr:hover {
                    background: var(--navy-50);
                }
                
                @media (max-width: 768px) {
                    .calendar-day {
                        min-height: 60px;
                        padding: 0.25rem;
                    }
                    .day-number { font-size: 0.8rem; }
                    .att-dot { width: 8px; height: 8px; }
                    
                    .table-responsive {
                        overflow-x: hidden;
                    }
                    .summary-table, .summary-table tbody, .summary-table tr, .summary-table td {
                        display: block;
                        width: 100%;
                    }
                    .summary-table thead {
                        display: none;
                    }
                    .summary-table tr {
                        margin-bottom: 1rem;
                        border: 1px solid var(--navy-200);
                        border-radius: var(--radius-md);
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                        white-space: normal;
                    }
                    .summary-table td {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--navy-50);
                        padding: 0.75rem 1rem !important;
                        font-size: 0.9rem;
                    }
                    .summary-table td:last-child {
                        border-bottom: none;
                    }
                    .summary-table td::before {
                        content: attr(data-label);
                        font-weight: 600;
                        color: var(--navy-600);
                        text-align: left;
                        flex: 1;
                    }
                    .summary-table td[data-label="Employee"] {
                        flex-direction: column;
                        align-items: flex-start;
                        background: var(--navy-50);
                        border-bottom: 1px solid var(--navy-200);
                        border-radius: var(--radius-md) var(--radius-md) 0 0;
                    }
                    .summary-table td[data-label="Employee"]::before {
                        content: none;
                    }
                }
            `}</style>
        </div>
    );
};

const HolidayModal = ({ holidays, onAdd, onDelete, onClose }) => {
    const [date, setDate] = useState('');
    const [name, setName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd(date, name);
        setDate('');
        setName('');
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Manage Holidays</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="form-control" />
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Holiday Name" required className="form-control" />
                        <button type="submit" className="btn btn-primary"><Plus size={18} /></button>
                    </form>

                    <div className="holiday-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {holidays.length === 0 ? (
                            <p>No holidays added</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Holiday</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holidays.sort((a, b) => a.date.localeCompare(b.date)).map(h => (
                                        <tr key={h.id}>
                                            <td>{h.date}</td>
                                            <td>{h.name}</td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteHoliday(h.id)}
                                                    style={{ padding: '4px 8px' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Mark Attendance Modal - Updated to allow Present + Overtime together
const MarkAttendanceModal = ({ employees, attendance, onClose, onMark }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [statuses, setStatuses] = useState({});
    const [overtimeEnabled, setOvertimeEnabled] = useState({}); // Separate toggle for overtime
    const [overtimeHours, setOvertimeHours] = useState({});
    const [overtimeMins, setOvertimeMins] = useState({});
    const [presentHours, setPresentHours] = useState({});
    const [presentMins, setPresentMins] = useState({});
    const [permissionHours, setPermissionHours] = useState({});
    const [permissionMins, setPermissionMins] = useState({});
    // Track gross hours before permission subtraction (so re-adjusting permission works correctly)
    const [baseHours, setBaseHours] = useState({});
    const [baseMins, setBaseMins] = useState({});

    useEffect(() => {
        // Pre-fill with existing attendance
        const existing = {};
        const existingOtH = {};
        const existingOtM = {};
        const existingOtEnabled = {};
        const existingPresentH = {};
        const existingPresentM = {};
        const existingPermissionH = {};
        const existingPermissionM = {};
        attendance.filter(a => a.date === selectedDate).forEach(a => {
            existing[a.userId] = a.status;
            if (a.overtimeHours) {
                const h = Math.floor(Number(a.overtimeHours));
                const m = Math.round((Number(a.overtimeHours) - h) * 60);
                existingOtH[a.userId] = h;
                existingOtM[a.userId] = m;
                existingOtEnabled[a.userId] = true;
            }
            if (a.presentHours) {
                const h = Math.floor(Number(a.presentHours));
                const m = Math.round((Number(a.presentHours) - h) * 60);
                existingPresentH[a.userId] = h;
                existingPresentM[a.userId] = m;
            } else if (a.status === 'present') {
                existingPresentH[a.userId] = 8;
                existingPresentM[a.userId] = 0;
            }

            if (a.permissionHours) {
                const h = Math.floor(Number(a.permissionHours));
                const m = Math.round((Number(a.permissionHours) - h) * 60);
                existingPermissionH[a.userId] = h;
                existingPermissionM[a.userId] = m;
            } else if (a.status === 'permission') {
                existingPermissionH[a.userId] = 2;
                existingPermissionM[a.userId] = 0;
                if (!existingPresentH[a.userId]) {
                    existingPresentH[a.userId] = 8;
                    existingPresentM[a.userId] = 0;
                }
            }
        });
        setStatuses(existing);
        setOvertimeHours(existingOtH);
        setOvertimeMins(existingOtM);
        setOvertimeEnabled(existingOtEnabled);
        setPresentHours(existingPresentH);
        setPresentMins(existingPresentM);
        setPermissionHours(existingPermissionH);
        setPermissionMins(existingPermissionM);
    }, [selectedDate, attendance]);

    const handlePresentHoursChange = (empId, hours) => {
        setPresentHours({ ...presentHours, [empId]: hours });
        // Also update the stored base hours so permission subtraction stays correct
        setBaseHours(prev => ({ ...prev, [empId]: hours }));
        setBaseMins(prev => ({ ...prev, [empId]: presentMins[empId] !== undefined ? presentMins[empId] : 0 }));
    };

    const handlePresentMinsChange = (empId, mins) => {
        setPresentMins({ ...presentMins, [empId]: mins });
        // Update base mins
        setBaseMins(prev => ({ ...prev, [empId]: mins }));
        setBaseHours(prev => ({ ...prev, [empId]: presentHours[empId] !== undefined ? presentHours[empId] : 8 }));
    };

    const handlePermissionHoursChange = (empId, hours) => {
        setPermissionHours({ ...permissionHours, [empId]: hours });
        // Auto-subtract from the base hours to update the Hours Worked field
        const baseH = Number(baseHours[empId] !== undefined ? baseHours[empId] : 8);
        const baseM = Number(baseMins[empId] !== undefined ? baseMins[empId] : 0);
        const permH = Number(hours) || 0;
        const permM = Number(permissionMins[empId] || 0);
        const net = Math.max(0, (baseH + baseM / 60) - (permH + permM / 60));
        setPresentHours(prev => ({ ...prev, [empId]: Math.floor(net) }));
        setPresentMins(prev => ({ ...prev, [empId]: Math.round((net - Math.floor(net)) * 60) }));
    };

    const handlePermissionMinsChange = (empId, mins) => {
        setPermissionMins({ ...permissionMins, [empId]: mins });
        // Auto-subtract from the base hours to update the Hours Worked field
        const baseH = Number(baseHours[empId] !== undefined ? baseHours[empId] : 8);
        const baseM = Number(baseMins[empId] !== undefined ? baseMins[empId] : 0);
        const permH = Number(permissionHours[empId] || 0);
        const permM = Number(mins) || 0;
        const net = Math.max(0, (baseH + baseM / 60) - (permH + permM / 60));
        setPresentHours(prev => ({ ...prev, [empId]: Math.floor(net) }));
        setPresentMins(prev => ({ ...prev, [empId]: Math.round((net - Math.floor(net)) * 60) }));
    };

    const handleStatusChange = (empId, status) => {
        setStatuses({ ...statuses, [empId]: status });
        if (status === 'present' && !presentHours[empId]) {
            setPresentHours({ ...presentHours, [empId]: 8 });
            setPresentMins({ ...presentMins, [empId]: 0 });
        } else if (status === 'permission') {
            // This case is now handled via the Present + Permission toggle, 
            // but we keep the logic for backward compatibility if data has 'permission' status
            if (!presentHours[empId]) {
                setPresentHours({ ...presentHours, [empId]: 8 });
                setPresentMins({ ...presentMins, [empId]: 0 });
            }
            if (!permissionHours[empId]) {
                setPermissionHours({ ...permissionHours, [empId]: 2 });
                setPermissionMins({ ...permissionMins, [empId]: 0 });
            }
        }
    };

    const handlePermissionToggle = (empId) => {
        const currentStatus = statuses[empId];
        if (currentStatus === 'present') {
            handleStatusChange(empId, 'permission');
        } else if (currentStatus === 'permission') {
            handleStatusChange(empId, 'present');
        }
    };

    const handleOvertimeToggle = (empId) => {
        setOvertimeEnabled({ ...overtimeEnabled, [empId]: !overtimeEnabled[empId] });
    };

    const handleOtHoursChange = (empId, hours) => {
        setOvertimeHours({ ...overtimeHours, [empId]: hours });
    };

    const handleOtMinsChange = (empId, mins) => {
        setOvertimeMins({ ...overtimeMins, [empId]: mins });
    };

    const handleSave = async () => {
        for (const [empId, status] of Object.entries(statuses)) {
            if (status) {
                // Include overtime data if overtime is enabled for this employee
                let otValue = 0;
                if (overtimeEnabled[empId]) {
                    otValue = Number(overtimeHours[empId] || 0) + (Number(overtimeMins[empId] || 0) / 60);
                }
                const extraData = { overtimeHours: otValue };

                // Include present hours if status is present
                if (status === 'present') {
                    extraData.presentHours = Number(presentHours[empId] || 0) + (Number(presentMins[empId] || 0) / 60);
                } else if (status === 'permission') {
                    const rawPresent = Number(presentHours[empId] || 0) + (Number(presentMins[empId] || 0) / 60);
                    const permHrs = Number(permissionHours[empId] || 0) + (Number(permissionMins[empId] || 0) / 60);
                    // Net worked hours = hours worked minus permission hours taken
                    extraData.presentHours = Math.max(0, rawPresent - permHrs);
                    extraData.permissionHours = permHrs;
                }
                await onMark(empId, selectedDate, status, extraData);
            }
        }
        onClose();
    };


    // Base statuses (excluding standalone overtime)
    const baseStatuses = [
        { id: 'present', label: 'Present', color: '#10b981' },
        { id: 'absent', label: 'Absent', color: '#ef4444' },
        { id: 'half-day', label: 'Half-day', color: '#f59e0b' },
        { id: 'paid_leave', label: 'Paid Leave', color: '#3b82f6' },
        { id: 'unpaid_leave', label: 'Unpaid Leave', color: '#fca5a5' }
    ];

    return (
        <div className="modal">
            <div className="modal-content modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header" style={{ flexShrink: 0 }}>
                    <h2><UserCheck size={20} /> Mark Attendance</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: 0 }}>
                    <div className="form-group" style={{ flexShrink: 0 }}>
                        <label>Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div className="attendance-list" style={{ marginTop: '1rem', flex: 1, overflowY: 'auto', paddingBottom: '1rem' }}>
                        {employees.map(emp => (
                            <div key={emp.id} className="attendance-row" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '1rem',
                                background: 'var(--navy-50)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '0.5rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <strong>{emp.displayName}</strong>
                                </div>

                                {/* Base Status Buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                    {baseStatuses.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`btn btn-sm`}
                                            onClick={() => handleStatusChange(emp.id, opt.id)}
                                            style={{
                                                background: (statuses[emp.id] === opt.id || (statuses[emp.id] === 'permission' && opt.id === 'present')) ? opt.color : 'white',
                                                color: (statuses[emp.id] === opt.id || (statuses[emp.id] === 'permission' && opt.id === 'present')) ? 'white' : 'var(--navy-600)',
                                                border: `1px solid ${opt.color}`,
                                                flex: '1',
                                                minWidth: '80px'
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Hours Input for Present or Permission Status */}
                                {(statuses[emp.id] === 'present' || statuses[emp.id] === 'permission') && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {/* Hours Worked (for either) */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid #10b981'
                                        }}>
                                            <span style={{ fontWeight: '500', color: '#10b981', flex: 1 }}>Hours Worked:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="24"
                                                    value={presentHours[emp.id] !== undefined ? presentHours[emp.id] : 8}
                                                    onChange={(e) => handlePresentHoursChange(emp.id, e.target.value)}
                                                    placeholder="8"
                                                    style={{ width: '50px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #10b981' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>h</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    value={presentMins[emp.id] !== undefined ? presentMins[emp.id] : 0}
                                                    onChange={(e) => handlePresentMinsChange(emp.id, e.target.value)}
                                                    placeholder="0"
                                                    style={{ width: '50px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #10b981' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>m</span>
                                            </div>
                                        </div>

                                        {/* Permission Toggle (Grouped under Present) */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: statuses[emp.id] === 'permission' ? 'rgba(14, 165, 233, 0.1)' : 'white',
                                            borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${statuses[emp.id] === 'permission' ? '#0ea5e9' : 'var(--navy-200)'}`,
                                            marginTop: '0.5rem'
                                        }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={statuses[emp.id] === 'permission'}
                                                    onChange={() => handlePermissionToggle(emp.id)}
                                                    style={{ width: '18px', height: '18px', accentColor: '#0ea5e9' }}
                                                />
                                                <span style={{ fontWeight: '500', color: '#0ea5e9' }}>+ Permission</span>
                                            </label>

                                            {statuses[emp.id] === 'permission' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="24"
                                                        value={permissionHours[emp.id] !== undefined ? permissionHours[emp.id] : 2}
                                                        onChange={(e) => handlePermissionHoursChange(emp.id, e.target.value)}
                                                        placeholder="2"
                                                        style={{ width: '50px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #0ea5e9' }}
                                                    />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>h</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="59"
                                                        value={permissionMins[emp.id] !== undefined ? permissionMins[emp.id] : 0}
                                                        onChange={(e) => handlePermissionMinsChange(emp.id, e.target.value)}
                                                        placeholder="0"
                                                        style={{ width: '50px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #0ea5e9' }}
                                                    />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>m</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Overtime Add-on (can be combined with Present) */}
                                {(statuses[emp.id] === 'present' || statuses[emp.id] === 'permission' || statuses[emp.id] === 'half-day') && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem',
                                        background: overtimeEnabled[emp.id] ? 'rgba(139, 92, 246, 0.1)' : 'white',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${overtimeEnabled[emp.id] ? '#8b5cf6' : 'var(--navy-200)'}`
                                    }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={overtimeEnabled[emp.id] || false}
                                                onChange={() => handleOvertimeToggle(emp.id)}
                                                style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
                                            />
                                            <span style={{ fontWeight: '500', color: '#8b5cf6' }}>+ Overtime</span>
                                        </label>

                                        {overtimeEnabled[emp.id] && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="24"
                                                    value={overtimeHours[emp.id] !== undefined ? overtimeHours[emp.id] : 0}
                                                    onChange={(e) => handleOtHoursChange(emp.id, e.target.value)}
                                                    placeholder="0"
                                                    style={{ width: '50px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #8b5cf6' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>h</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    value={overtimeMins[emp.id] !== undefined ? overtimeMins[emp.id] : 0}
                                                    onChange={(e) => handleOtMinsChange(emp.id, e.target.value)}
                                                    placeholder="0"
                                                    style={{ width: '50px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #8b5cf6' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>m</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer" style={{ flexShrink: 0, marginTop: 'auto', background: 'white', borderTop: '1px solid var(--navy-100)', paddingTop: '1rem', paddingBottom: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave}>Save Attendance</button>
                </div>
            </div>
        </div >
    );
};

export default Attendance;
