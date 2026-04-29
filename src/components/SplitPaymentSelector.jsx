import React from 'react';
import { Plus, X } from 'lucide-react';

const SplitPaymentSelector = ({ splits, onAddSplit, onRemoveSplit, onSplitChange, totalAmount = 0 }) => {
    const currentTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const balance = Math.max(0, totalAmount - currentTotal);

    return (
        <div className="payment-splits-container" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', color: 'var(--navy-800)', fontSize: '0.9rem' }}>
                Payment Breakdown
            </label>

            {splits.map((split, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <select
                            className="form-control"
                            value={split.mode}
                            onChange={(e) => onSplitChange(index, 'mode', e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="cash">Cash</option>
                            <option value="upi">UPI / Scanner</option>
                            <option value="card">Card</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.85rem' }}>₹</span>
                        <input
                            type="number"
                            className="form-control"
                            placeholder="Amount"
                            value={split.amount}
                            onChange={(e) => onSplitChange(index, 'amount', e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    {splits.length > 1 && (
                        <button
                            type="button"
                            onClick={() => onRemoveSplit(index)}
                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '0 0.6rem', cursor: 'pointer' }}
                            title="Remove split"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            ))}

            <button
                type="button"
                onClick={onAddSplit}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginTop: '0.5rem', background: 'white',
                    border: '1px dashed #94a3b8', color: '#64748b',
                    padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', width: '100%', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: '500'
                }}
            >
                <Plus size={14} /> Add Another Mode
            </button>

            {totalAmount > 0 && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Total Entered: <strong style={{ color: 'var(--navy-900)' }}>₹{currentTotal.toLocaleString()}</strong></span>
                    {balance > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>Remaining: ₹{balance.toLocaleString()}</span>
                    ) : (
                        <span style={{ color: '#10b981', fontWeight: '600' }}>✓ Fully Allocated</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default SplitPaymentSelector;
