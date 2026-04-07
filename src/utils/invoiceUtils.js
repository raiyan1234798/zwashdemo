import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';

/**
 * Generates the next sequential invoice number.
 * Format: DC-[DDMMYY]-[SEQ]
 * 
 * @param {Object} db - Firestore database instance
 * @param {Array} paymentSplits - Array of payment splits [{mode, amount}]
 * @param {Date|string} customDate - Optional date to use for formatting
 * @returns {Promise<string>} - Formatted invoice number
 */
/**
 * Generates the next sequential booking number.
 * Format: DC-YYYYMMDD-XXXX
 * 
 * @param {Object} db - Firestore database instance
 * @param {Date|string} customDate - Optional date to use for formatting
 * @returns {Promise<string>} - Formatted booking reference
 */
export const getNextBookingNumber = async (db, customDate = null) => {
    // Unified prefix: DC
    const type = 'DC';

    // Format date: YYYYMMDD
    const now = customDate ? (typeof customDate === 'string' ? new Date(customDate) : customDate) : new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const counterRef = doc(db, 'metadata', 'booking_counters');

    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let seq = 0;
            if (counterDoc.exists()) {
                seq = (counterDoc.data().sequence || 0) + 1;
            } else {
                seq = 1;
            }

            transaction.set(counterRef, {
                sequence: seq,
                updatedAt: serverTimestamp()
            }, { merge: true });

            return seq;
        });

        // Format to ensure consistent length (4 chars for the sequence part)
        const finalSeq = String(result).padStart(4, '0');
        return `${type}-${dateStr}-${finalSeq}`;
    } catch (error) {
        console.error("Error generating sequential booking number:", error);
        return `${type}-${dateStr}-${Date.now().toString().slice(-4)}`;
    }
};

export const getNextInvoiceNumber = async (db, paymentSplits = [], customDate = null) => {
    // Determine if it's an "official" payment (UPI or Card)
    const officialModes = ['upi', 'card'];
    const isOfficial = paymentSplits.length > 0 && paymentSplits.some(s =>
        officialModes.includes(s.mode?.toLowerCase() || '')
    );

    // Unified prefix: DC
    const type = 'DC';

    // Format date: YYYYMMDD
    const now = customDate ? (typeof customDate === 'string' ? new Date(customDate) : customDate) : new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const counterRef = doc(db, 'metadata', 'invoice_counters');

    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let globalSeq = 0;
            let dummySeq = 0;

            if (counterDoc.exists()) {
                const data = counterDoc.data();
                globalSeq = data.globalSequence || 0;
                dummySeq = data.dummySequence || 0;
            }

            // Increment relevant sequence (NO daily reset)
            let seq = 1;
            if (isOfficial) {
                globalSeq += 1;
                seq = globalSeq;
            } else {
                dummySeq += 1;
                seq = dummySeq;
            }

            transaction.set(counterRef, {
                globalSequence: globalSeq,
                dummySequence: dummySeq,
                updatedAt: serverTimestamp()
            }, { merge: true });

            return { seq, isOfficial };
        });

        // Format to ensure consistent length (4 chars for the sequence part)
        // Official: 0001 (4 digits)
        // Dummy: D001 (D + 3 digits)
        const finalSeq = result.isOfficial
            ? String(result.seq).padStart(4, '0')
            : `D${String(result.seq).padStart(3, '0')}`;

        return `${type}-${dateStr}-${finalSeq}`;
    } catch (error) {
        console.error("Error generating sequential invoice number:", error);
        // Fallback to timestamp if transaction fails to prevent blocking user
        const fbDay = String(now.getDate()).padStart(2, '0');
        const fbMonth = String(now.getMonth() + 1).padStart(2, '0');
        const fbYear = now.getFullYear();
        const fbDateStr = `${fbYear}${fbMonth}${fbDay}`;
        return `${type}-${fbDateStr}-${Date.now().toString().slice(-4)}`;
    }
};

/**
 * Migrates existing invoices and bookings to the new sequential format.
 * 
 * @param {Object} db - Firestore database instance
 * @param {Function} onProgress - Callback for progress updates
 */
export const migrateExistingInvoices = async (db, onProgress = () => { }) => {
    const { collection, getDocs, query, orderBy, updateDoc, writeBatch, serverTimestamp } = await import('firebase/firestore');

    try {
        // 1. Fetch all invoices
        const invSnap = await getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'asc')));
        const manualInvoices = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'invoices' }));

        // 2. Fetch all bookings (all statuses for bookingReference standardization)
        const bookSnap = await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'asc')));
        const allBookings = bookSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'bookings' }));

        // Combined all records needing IDs
        const allRecords = [...manualInvoices, ...allBookings]
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateA - dateB;
            });

        let globalSeq = 0;
        let dummySeq = 0;
        let bookingSeq = 0;
        let processedCount = 0;
        let batch = writeBatch(db);

        const officialModes = ['upi', 'card'];

        for (const record of allRecords) {
            // Determine if official or dummy based on payment mode or history
            let isOfficial = false;
            if (record.paymentHistory && Array.isArray(record.paymentHistory)) {
                isOfficial = record.paymentHistory.some(h =>
                    h.splits && h.splits.some(s => officialModes.includes(s.mode?.toLowerCase()))
                );
            } else if (record.paymentMode) {
                isOfficial = officialModes.includes(record.paymentMode.toLowerCase());
            }

            const type = 'DC';
            const recordDate = record.createdAt?.toDate ? record.createdAt.toDate() :
                (record.bookingDate || record.invoiceDate ? new Date(record.bookingDate || record.invoiceDate) : new Date());

            const yyyy = recordDate.getFullYear();
            // Re-calc date string properly
            const mStr = String(recordDate.getMonth() + 1).padStart(2, '0');
            const dStr = String(recordDate.getDate()).padStart(2, '0');
            const finalDateStr = `${yyyy}${mStr}${dStr}`;

            let invoiceNumber = '';
            // Only assign an invoice number if it's an actual invoice or a completed booking
            if (record.source === 'invoices' || record.status === 'completed') {
                if (isOfficial) globalSeq++; else dummySeq++;
                const currentSeq = isOfficial ? globalSeq : dummySeq;
                const finalSeq = isOfficial
                    ? String(currentSeq).padStart(4, '0')
                    : `D${String(currentSeq).padStart(3, '0')}`;
                invoiceNumber = `${type}-${finalDateStr}-${finalSeq}`;
            }

            // Also update booking reference if it's a booking
            let bookingRef = '';
            if (record.source === 'bookings') {
                bookingSeq++;
                bookingRef = `${type}-${finalDateStr}-${String(bookingSeq).padStart(4, '0')}`;
            }

            const docRef = doc(db, record.source, record.id);
            const updateData = {
                invoiceNumber: invoiceNumber,
                updatedAt: serverTimestamp()
            };
            if (bookingRef) {
                updateData.bookingReference = bookingRef;
            }
            batch.update(docRef, updateData);

            processedCount++;
            onProgress(processedCount, allRecords.length);

            // Commit batch if large
            if (processedCount % 400 === 0) {
                await batch.commit();
                batch = writeBatch(db);
            }
        }

        // Commit remaining
        if (processedCount % 400 !== 0) {
            await batch.commit();
        }

        // Update counters metadata
        await updateDoc(doc(db, 'metadata', 'invoice_counters'), {
            globalSequence: globalSeq,
            dummySequence: dummySeq,
            updatedAt: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, 'metadata', 'booking_counters'), {
            sequence: bookingSeq,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return { globalSequence: globalSeq, dummySequence: dummySeq, bookingSequence: bookingSeq, total: allRecords.length };
    } catch (error) {
        console.error("Migration error:", error);
        throw error;
    }
};