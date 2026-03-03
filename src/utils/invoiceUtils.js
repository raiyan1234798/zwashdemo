import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

/**
 * Generates the next sequential invoice number.
 * Format: INV-[TYPE]-[DDMMYY]-[SEQ]
 * 
 * @param {Object} db - Firestore database instance
 * @param {Array} paymentSplits - Array of payment splits [{mode, amount}]
 * @param {Date|string} customDate - Optional date to use for formatting
 * @returns {Promise<string>} - Formatted invoice number
 */
export const getNextInvoiceNumber = async (db, paymentSplits = [], customDate = null) => {
    // Determine type: UC for Digital (UPI/Card/Bank), CS for Cash
    // If mixed, default to UC
    const isDigital = paymentSplits.some(s =>
        ['upi', 'card', 'bank_transfer', 'online'].includes(s.mode?.toLowerCase())
    );
    const type = isDigital ? 'UC' : 'CS';

    // Format date: DDMMYY
    const now = customDate ? (typeof customDate === 'string' ? new Date(customDate) : customDate) : new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${day}${month}${year}`;

    const counterRef = doc(db, 'metadata', 'invoice_counters');

    try {
        const nextSeq = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let seq = 1;
            const field = type === 'UC' ? 'digitalSequence' : 'cashSequence';

            if (counterDoc.exists()) {
                seq = (counterDoc.data()[field] || 0) + 1;
                transaction.update(counterRef, {
                    [field]: seq,
                    updatedAt: serverTimestamp()
                });
            } else {
                transaction.set(counterRef, {
                    digitalSequence: type === 'UC' ? 1 : 0,
                    cashSequence: type === 'CS' ? 1 : 0,
                    updatedAt: serverTimestamp()
                });
            }

            return seq;
        });

        // Format: INV-UC-271023-001
        return `INV-${type}-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
    } catch (error) {
        console.error("Error generating sequential invoice number:", error);
        // Fallback to timestamp if transaction fails to prevent blocking user
        return `INV-${type}-${dateStr}-${Date.now().toString().slice(-4)}`;
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

        let digitalSeq = 0;
        let cashSeq = 0;
        let processedCount = 0;
        const batch = writeBatch(db);

        for (const record of allRecords) {
            // Already has sequential ID? Skip if it matches the pattern
            if (record.invoiceNumber && record.invoiceNumber.startsWith('INV-')) {
                const parts = record.invoiceNumber.split('-');
                const type = parts[1];
                const seq = parseInt(parts[parts.length - 1]);
                if (type === 'UC') digitalSeq = Math.max(digitalSeq, seq);
                if (type === 'CS') cashSeq = Math.max(cashSeq, seq);
                processedCount++;
                continue;
            }

            // Determine type
            const paymentHistory = record.paymentHistory || [];
            const splits = paymentHistory.flatMap(h => h.splits || []);
            // Simple check: if paymentMode is cash or all splits are cash
            const isDigital = record.paymentMode?.toLowerCase() !== 'cash' && record.paymentMode !== 'none' ||
                splits.some(s => ['upi', 'card', 'bank_transfer', 'online'].includes(s.mode?.toLowerCase()));

            const type = isDigital ? 'UC' : 'CS';
            if (type === 'UC') digitalSeq++; else cashSeq++;
            const seq = type === 'UC' ? digitalSeq : cashSeq;

            // Format date
            const recordDate = record.createdAt?.toDate ? record.createdAt.toDate() :
                (record.bookingDate || record.invoiceDate ? new Date(record.bookingDate || record.invoiceDate) : new Date());

            const day = String(recordDate.getDate()).padStart(2, '0');
            const month = String(recordDate.getMonth() + 1).padStart(2, '0');
            const year = String(recordDate.getFullYear()).slice(-2);
            const dateStr = `${day}${month}${year}`;

            const invoiceNumber = `INV-${type}-${dateStr}-${String(seq).padStart(3, '0')}`;

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
            }
        }

        // Commit remaining
        await batch.commit();

        // Update counters metadata
        await updateDoc(doc(db, 'metadata', 'invoice_counters'), {
            digitalSequence: digitalSeq,
            cashSequence: cashSeq,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return { digitalSeq, cashSeq, total: allRecords.length };
    } catch (error) {
        console.error("Migration error:", error);
        throw error;
    }
};
