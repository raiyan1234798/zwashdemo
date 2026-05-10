import { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';

const AuthContext = createContext(null);

// User roles with permissions
export const ROLES = {
    SUPER_ADMIN: 'superadmin',
    ADMIN: 'admin', // Company Admin
    MANAGER: 'manager',
    SENIOR_EMPLOYEE: 'senior_employee',
    EMPLOYEE: 'employee'
};

export const PLANS = {
    BASIC: 'basic',
    STANDARD: 'standard',
    PREMIUM: 'premium'
};

// Plan feature access
export const PLAN_FEATURES = {
    [PLANS.BASIC]: ['dashboard', 'bookings', 'calendar', 'services', 'customers', 'settings'],
    [PLANS.STANDARD]: ['dashboard', 'bookings', 'calendar', 'services', 'customers', 'settings', 'invoices', 'expenses', 'analytics', 'amc', 'inspections'],
    [PLANS.PREMIUM]: ['dashboard', 'bookings', 'calendar', 'services', 'customers', 'settings', 'invoices', 'expenses', 'analytics', 'amc', 'payroll', 'attendance', 'materials', 'crm', 'audit', 'inspections']
};

// Plan-based USER LIMITS (excluding the admin themselves)
export const PLAN_USER_LIMITS = {
    [PLANS.BASIC]: 5,       // Basic: up to 5 users (admin + 4 staff)
    [PLANS.STANDARD]: 15,   // Standard: up to 15 users
    [PLANS.PREMIUM]: 50     // Premium: up to 50 users
};

export const PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        bookings: { view: true, create: true, edit: true, delete: true },
        services: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        employees: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        payroll: { view: true, create: true, edit: true, delete: true },
        analytics: { view: true, create: true, edit: true, delete: true },
        finance: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, create: true, edit: true, delete: true },
        attendance: { view: true, create: true, edit: true, delete: true },
        audit: { view: true, create: true, edit: true, delete: true },
        materials: { view: true, create: true, edit: true, delete: true },
        crm: { view: true, create: true, edit: true, delete: true },
        amc: { view: true, create: true, edit: true, delete: true },
        calendar: { view: true, create: true, edit: true, delete: true },
        inspections: { view: true, create: true, edit: true, delete: true },
        superadmin: { view: true, create: true, edit: true, delete: true }
    },
    [ROLES.ADMIN]: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        bookings: { view: true, create: true, edit: true, delete: true },
        services: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        employees: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        payroll: { view: true, create: true, edit: true, delete: true },
        analytics: { view: true, create: true, edit: true, delete: true },
        finance: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, create: true, edit: true, delete: true },
        attendance: { view: true, create: true, edit: true, delete: true },
        audit: { view: true, create: true, edit: true, delete: true },
        materials: { view: true, create: true, edit: true, delete: true },
        crm: { view: true, create: true, edit: true, delete: true },
        amc: { view: true, create: true, edit: true, delete: true },
        inspections: { view: true, create: true, edit: true, delete: true },
        calendar: { view: true, create: true, edit: true, delete: true }
    },
    [ROLES.MANAGER]: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        bookings: { view: true, create: true, edit: true, delete: true },
        services: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        employees: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: { view: false, create: false, edit: false, delete: false },
        finance: { view: true, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        attendance: { view: true, create: true, edit: true, delete: true },
        materials: { view: true, create: true, edit: true, delete: true },
        crm: { view: true, create: true, edit: true, delete: true },
        amc: { view: true, create: true, edit: true, delete: false },
        calendar: { view: true, create: true, edit: true, delete: true },
        inspections: { view: true, create: true, edit: true, delete: true },
        audit: { view: false, create: false, edit: false, delete: false }
    },
    [ROLES.SENIOR_EMPLOYEE]: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        bookings: { view: true, create: true, edit: true, delete: true },
        services: { view: true, create: false, edit: true, delete: false },
        customers: { view: true, create: true, edit: true, delete: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: false, delete: false },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: { view: false, create: false, edit: false, delete: false },
        finance: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        attendance: { view: true, create: true, edit: true, delete: false },
        materials: { view: true, create: true, edit: false, delete: false },
        crm: { view: false, create: false, edit: false, delete: false },
        amc: { view: true, create: true, edit: false, delete: false },
        calendar: { view: true, create: false, edit: false, delete: false },
        inspections: { view: true, create: true, edit: false, delete: false },
        audit: { view: false, create: false, edit: false, delete: false }
    },
    [ROLES.EMPLOYEE]: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        bookings: { view: true, create: true, edit: false, delete: false },
        services: { view: true, create: false, edit: false, delete: false },
        customers: { view: false, create: false, edit: false, delete: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        invoices: { view: false, create: false, edit: false, delete: false },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: { view: false, create: false, edit: false, delete: false },
        finance: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        attendance: { view: true, create: true, edit: false, delete: false },
        materials: { view: false, create: false, edit: false, delete: false },
        crm: { view: false, create: false, edit: false, delete: false },
        amc: { view: true, create: true, edit: false, delete: false },
        calendar: { view: true, create: false, edit: false, delete: false },
        inspections: { view: true, create: true, edit: false, delete: false },
        audit: { view: false, create: false, edit: false, delete: false }
    }
};

// Hard-coded Super Admin emails
const SUPER_ADMIN_EMAILS = ['zwash.office@gmail.com', 'abubackerraiyan@gmail.com'];

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user has specific permission
    const hasPermission = (resource, action = null) => {
        if (!userProfile?.role) return false;

        // Plan-based restriction
        if (userProfile.plan && PLAN_FEATURES[userProfile.plan] && !PLAN_FEATURES[userProfile.plan].includes(resource)) {
            if (userProfile.role === ROLES.SUPER_ADMIN && resource === 'superadmin') return true;
            return false;
        }

        // Normalize role
        const normalizedRole = userProfile.role.toLowerCase().replace(/[\s-]/g, '_');
        const rolePermissions = PERMISSIONS[normalizedRole];
        const defaultPerms = rolePermissions ? rolePermissions[resource] : undefined;

        // Custom Permissions Override
        if (userProfile.permissions && userProfile.permissions[resource] !== undefined) {
            const customPerms = userProfile.permissions[resource];

            if (typeof customPerms === 'boolean') return customPerms;

            if (action && typeof customPerms === 'object') {
                if (customPerms[action] !== undefined) return customPerms[action] === true;
                if (defaultPerms !== undefined) {
                    if (typeof defaultPerms === 'boolean') return defaultPerms;
                    return defaultPerms[action] === true;
                }
                return false;
            }

            if (typeof customPerms === 'object') {
                if (customPerms.view || customPerms.create || customPerms.edit || customPerms.delete) return true;
                if (defaultPerms !== undefined) {
                    if (typeof defaultPerms === 'boolean') return defaultPerms;
                    return defaultPerms.view || defaultPerms.create || defaultPerms.edit || defaultPerms.delete;
                }
            }
            return false;
        }

        // Role-based fallback
        if (!rolePermissions) return false;
        if (defaultPerms === undefined) return false;
        if (typeof defaultPerms === 'boolean') return defaultPerms;
        if (action && typeof defaultPerms === 'object') return defaultPerms[action] === true;
        if (typeof defaultPerms === 'object') {
            return defaultPerms.view === true || defaultPerms.create === true ||
                defaultPerms.edit === true || defaultPerms.delete === true;
        }
        return false;
    };

    // Fetch or create user profile — handles all tenant scenarios
    const fetchUserProfile = async (firebaseUser) => {
        try {
            const userRef = doc(db, 'adminUsers', firebaseUser.uid);
            const userDoc = await getDoc(userRef);
            const emailLower = firebaseUser.email.toLowerCase();
            const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(emailLower);

            if (userDoc.exists()) {
                const profile = { id: userDoc.id, ...userDoc.data() };
                
                // Sync photoURL and displayName from Google if changed
                if (firebaseUser.photoURL && firebaseUser.photoURL !== profile.photoURL) {
                    profile.photoURL = firebaseUser.photoURL;
                    await updateDoc(userRef, { photoURL: firebaseUser.photoURL });
                }
                if (firebaseUser.displayName && firebaseUser.displayName !== profile.displayName) {
                    profile.displayName = firebaseUser.displayName;
                    await updateDoc(userRef, { displayName: firebaseUser.displayName });
                }

                // Ensure super admin always has correct role
                if (isSuperAdminEmail && (profile.role !== ROLES.SUPER_ADMIN || profile.status !== 'approved')) {
                    profile.role = ROLES.SUPER_ADMIN;
                    profile.status = 'approved';
                    await updateDoc(userRef, {
                        role: ROLES.SUPER_ADMIN,
                        status: 'approved',
                        updatedAt: serverTimestamp()
                    });
                }

                // Check demoClients whitelist (legacy compatibility)
                let isWhitelisted = false;
                if (emailLower && !isSuperAdminEmail) {
                    const demoQuery = query(
                        collection(db, 'demoClients'),
                        where('email', '==', emailLower),
                        where('active', '==', true)
                    );
                    const demoSnapshot = await getDocs(demoQuery);

                    if (!demoSnapshot.empty) {
                        const demoData = demoSnapshot.docs[0].data();
                        isWhitelisted = true;

                        profile.role = profile.role || ROLES.ADMIN;
                        profile.status = 'approved';
                        profile.isDemoClient = true;
                        profile.permissions = demoData.permissions || profile.permissions;
                        profile.companyName = demoData.companyName || profile.companyName;
                        profile.logoURL = demoData.logoURL || profile.logoURL;
                        profile.demoExpiryDate = demoData.expiresAt || profile.demoExpiryDate;
                        profile.plan = demoData.plan || PLANS.BASIC;
                        // companyId for demo clients: use their Firestore doc ID from demoClients
                        profile.companyId = profile.companyId || demoSnapshot.docs[0].id;

                        await updateDoc(userRef, {
                            role: profile.role,
                            status: 'approved',
                            isDemoClient: true,
                            companyId: profile.companyId,
                            updatedAt: serverTimestamp()
                        });
                    }
                }

                // Status checks
                if (!isWhitelisted && !isSuperAdminEmail) {
                    if (profile.status === 'pending') {
                        setError('Your account is pending approval. Please wait for admin approval.');
                        await signOut(auth);
                        return null;
                    }
                    if (profile.status === 'rejected') {
                        setError('Your account access has been rejected.');
                        await signOut(auth);
                        return null;
                    }
                    if (profile.demoActive === false) {
                        setError('Your demo subscription has been cancelled. Please contact the administrator.');
                        await signOut(auth);
                        return null;
                    }
                }

                if (profile.demoExpiryDate) {
                    const expiryDate = new Date(profile.demoExpiryDate);
                    expiryDate.setHours(23, 59, 59, 999);
                    if (new Date() > expiryDate) {
                        setError('Your demo access has expired. Please contact the administrator.');
                        await signOut(auth);
                        return null;
                    }
                }

                setUserProfile(profile);
                return profile;

            } else {
                // New user — check super admin, invites, or demoClients
                const adminConfig = await getDoc(doc(db, 'settings', 'admin_config'));
                const isFirstUser = !(adminConfig.exists() && adminConfig.data().initialized);

                if (isSuperAdminEmail || isFirstUser) {
                    const role = isSuperAdminEmail ? ROLES.SUPER_ADMIN : ROLES.ADMIN;
                    const newProfile = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || (isSuperAdminEmail ? 'Super Admin' : 'Admin'),
                        photoURL: firebaseUser.photoURL,
                        role: role,
                        status: 'approved',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    await setDoc(userRef, newProfile);
                    if (!isSuperAdminEmail) {
                        await setDoc(doc(db, 'settings', 'admin_config'), {
                            initialized: true,
                            primaryAdminEmail: firebaseUser.email
                        });
                    }

                    setUserProfile({ id: firebaseUser.uid, ...newProfile });
                    return { id: firebaseUser.uid, ...newProfile };
                }

                // Check company invites (new tenant user system)
                const invitesQuery = query(
                    collection(db, 'employeeInvites'),
                    where('email', '==', emailLower),
                    where('status', '==', 'pending')
                );
                const inviteSnapshot = await getDocs(invitesQuery);

                if (!inviteSnapshot.empty) {
                    const invite = inviteSnapshot.docs[0];
                    const inviteData = invite.data();

                    const newProfile = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || '',
                        photoURL: firebaseUser.photoURL,
                        role: inviteData.role || ROLES.EMPLOYEE,
                        permissions: inviteData.permissions || null,
                        companyName: inviteData.companyName || '',
                        companyId: inviteData.companyId || inviteData.invitedBy || '',
                        logoURL: inviteData.logoURL || '',
                        isDemoClient: inviteData.isDemoClient || false,
                        plan: inviteData.plan || PLANS.BASIC,
                        status: 'approved',
                        invitedBy: inviteData.invitedBy,
                        needsOnboarding: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    await setDoc(userRef, newProfile);

                    // Update invite to accepted
                    await updateDoc(doc(db, 'employeeInvites', invite.id), {
                        status: 'accepted',
                        acceptedAt: serverTimestamp(),
                        acceptedByUid: firebaseUser.uid
                    });

                    setUserProfile({ id: firebaseUser.uid, ...newProfile });
                    return { id: firebaseUser.uid, ...newProfile };
                }

                // Check demoClients whitelist
                const demoQuery = query(
                    collection(db, 'demoClients'),
                    where('email', '==', emailLower),
                    where('active', '==', true)
                );
                const demoSnapshot = await getDocs(demoQuery);

                if (!demoSnapshot.empty) {
                    const demoData = demoSnapshot.docs[0].data();
                    if (demoData.expiresAt) {
                        const expiry = new Date(demoData.expiresAt);
                        expiry.setHours(23, 59, 59, 999);
                        if (new Date() > expiry) {
                            setError('Your demo access has expired. Contact us to renew.');
                            await signOut(auth);
                            return null;
                        }
                    }
                    const demoProfile = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || demoData.companyName || 'Demo Client',
                        photoURL: firebaseUser.photoURL,
                        role: ROLES.ADMIN,
                        status: 'approved',
                        isDemoClient: true,
                        companyName: demoData.companyName || '',
                        companyId: demoSnapshot.docs[0].id,
                        logoURL: demoData.logoURL || '',
                        permissions: demoData.permissions || null,
                        plan: demoData.plan || PLANS.BASIC,
                        demoExpiresAt: demoData.expiresAt || null,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };
                    await setDoc(userRef, demoProfile);
                    
                    // Update login stats
                    try {
                        const { updateDoc: updateDemoDoc, increment } = await import('firebase/firestore');
                        await updateDemoDoc(demoSnapshot.docs[0].ref, { lastLogin: serverTimestamp(), loginCount: increment(1) });
                    } catch (e) { /* ignore */ }
                    
                    setUserProfile({ id: firebaseUser.uid, ...demoProfile });
                    return { id: firebaseUser.uid, ...demoProfile };
                }

                setError('Access denied. You need an invitation to access this system.');
                await signOut(auth);
                return null;
            }
        } catch (err) {
            console.error('Error fetching user profile:', err);
            setError('Failed to load user profile: ' + err.message);
            return null;
        }
    };

    // Listen for auth state changes
    useEffect(() => {
        const checkRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    setUser(result.user);
                    await fetchUserProfile(result.user);
                }
            } catch (err) {
                console.error('Redirect result error:', err);
                if (err.code === 'auth/cross-origin-opener-policy-blocked') {
                    setError('Authentication blocked by browser security. Try again or check browser settings.');
                } else {
                    setError(err.message);
                }
            }
        };

        checkRedirect();

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            setError(null);

            if (firebaseUser) {
                setUser(firebaseUser);
                await fetchUserProfile(firebaseUser);
            } else {
                setUser(null);
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Real-time Profile Listener
    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(doc(db, 'adminUsers', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                if (data.status === 'rejected') {
                    setError('Your account access has been rejected.');
                    signOut(auth);
                    return;
                }

                if (data.demoActive === false) {
                    setError('Your demo subscription has been cancelled.');
                    signOut(auth);
                    return;
                }

                if (data.demoExpiryDate) {
                    const expiryDate = new Date(data.demoExpiryDate);
                    expiryDate.setHours(23, 59, 59, 999);
                    if (new Date() > expiryDate) {
                        setError('Your demo access has expired.');
                        signOut(auth);
                        return;
                    }
                }

                if (data.demoExpiresAt) {
                    const expiry = new Date(data.demoExpiresAt);
                    expiry.setHours(23, 59, 59, 999);
                    if (new Date() > expiry) {
                        setError('Your demo access has expired.');
                        signOut(auth);
                        return;
                    }
                }

                setUserProfile({ id: docSnap.id, ...data });
            }
        }, (err) => {
            console.error('Profile listener error:', err);
        });

        return () => unsubscribe();
    }, [user]);

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            setError(null);
            setLoading(true);

            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            if (!isLocal) {
                await signInWithRedirect(auth, googleProvider);
                return;
            }

            try {
                await signInWithPopup(auth, googleProvider);
            } catch (popupErr) {
                console.log('Popup failed, falling back to redirect...', popupErr);
                await signInWithRedirect(auth, googleProvider);
            }
        } catch (err) {
            console.error('Google sign in error:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    // Sign out
    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
        } catch (err) {
            console.error('Logout error:', err);
            setError(err.message);
        }
    };

    // Update user profile (for onboarding)
    const updateProfile = async (profileData) => {
        if (!user) return;
        try {
            const userRef = doc(db, 'adminUsers', user.uid);
            await setDoc(userRef, {
                ...profileData,
                needsOnboarding: false,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setUserProfile(prev => ({
                ...prev,
                ...profileData,
                needsOnboarding: false
            }));
        } catch (err) {
            console.error('Error updating profile:', err);
            throw err;
        }
    };

    const isSuperAdminFlag = userProfile?.role === ROLES.SUPER_ADMIN ||
        (user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()));

    const value = {
        user,
        userProfile,
        loading,
        error,
        signInWithGoogle,
        logout,
        updateProfile,
        hasPermission,
        isSuperAdmin: isSuperAdminFlag,
        isAdmin: userProfile?.role === ROLES.ADMIN || isSuperAdminFlag,
        isManager: userProfile?.role === ROLES.MANAGER,
        isSeniorEmployee: userProfile?.role === ROLES.SENIOR_EMPLOYEE,
        isEmployee: userProfile?.role === ROLES.EMPLOYEE,
        // companyId for data isolation
        companyId: isSuperAdminFlag ? null : (userProfile?.companyId || userProfile?.uid || null),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
