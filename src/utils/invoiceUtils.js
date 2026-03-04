import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

/**
 * Generates the next sequential invoice number.
 * Format: DC-[DDMMYY]-[SEQ]
 * 
 * @param {Object} db - Firestore database instance
 * @param {Array} paymentSplits - Array of payment splits [{mode, amount}]
 * @param {Date|string} customDate - Optional date to use for formatting
 * @returns {Promise<string>} - Formatted invoice number
 */
export const getNextInvoiceNumber = async (db, paymentSplits = [], customDate = null) => {
    // Determine if it's an "official" payment (UPI or Card)
    const officialModes = ['upi', 'card', 'bank_transfer', 'online'];
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

            // If official, use globalSequence. Otherwise use dummySequence.
            const field = isOfficial ? 'globalSequence' : 'dummySequence';
            let seq = 1;

            if (counterDoc.exists()) {
                const data = counterDoc.data();
                seq = (data[field] || 0) + 1;
                transaction.update(counterRef, {
                    [field]: seq,
                    updatedAt: serverTimestamp()
                });
            } else {
                transaction.set(counterRef, {
                    [field]: 1,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            return { seq, field };
        });

        // Format to ensure consistent length (4 chars for the sequence part)
        // Official: 0001 (4 digits)
        // Dummy: D001 (D + 3 digits)
        const finalSeq = result.field === 'globalSequence'
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

        // 2. Fetch all completed bookings
        const bookSnap = await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'asc')));
        const completedBookings = bookSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data(), source: 'bookings' }))
            .filter(b => b.status === 'completed');

        // Combined all records needing IDs
        const allRecords = [...manualInvoices, ...completedBookings]
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateA - dateB;
            });

        let globalSeq = 0;
        let dummySeq = 0;
        let processedCount = 0;
        let batch = writeBatch(db);

        const officialModes = ['upi', 'card', 'bank_transfer', 'online'];

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

            if (isOfficial) globalSeq++; else dummySeq++;
            const currentSeq = isOfficial ? globalSeq : dummySeq;

            const type = 'DC';

            // Format date
            const recordDate = record.createdAt?.toDate ? record.createdAt.toDate() :
                (record.bookingDate || record.invoiceDate ? new Date(record.bookingDate || record.invoiceDate) : new Date());

            const yyyy = recordDate.getFullYear();
            const mm = String(recordDate.getMonth() + 1).padStart(2, '0');
            const dd = String(recordDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}${mm}${dd}`;

            // Format to match consistency logic
            const finalSeq = isOfficial
                ? String(currentSeq).padStart(4, '0')
                : `D${String(currentSeq).padStart(3, '0')}`;

            const invoiceNumber = `${type}-${dateStr}-${finalSeq}`;

            const docRef = doc(db, record.source, record.id);
            batch.update(docRef, {
                invoiceNumber: invoiceNumber,
                updatedAt: serverTimestamp()
            });

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

        return { globalSequence: globalSeq, dummySequence: dummySeq, total: allRecords.length };
    } catch (error) {
        console.error("Migration error:", error);
        throw error;
    }
};
