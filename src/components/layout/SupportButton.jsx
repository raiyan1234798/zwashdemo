import { useState } from 'react';
import { MessageCircle, Phone, CreditCard, X, HelpCircle, AlertCircle } from 'lucide-react';

const SupportButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const supportOptions = [
        {
            id: 'enquiry',
            label: 'Enquire',
            icon: HelpCircle,
            color: '#10b981',
            action: () => window.open('https://wa.me/919999999999?text=I%20have%20an%20enquiry%20regarding%20Zwash%20services.', '_blank')
        },
        {
            id: 'complaints',
            label: 'Complaints',
            icon: AlertCircle,
            color: '#ef4444',
            action: () => window.open('https://wa.me/919999999999?text=I%20want%20to%20raise%20a%20complaint.', '_blank')
        },
        {
            id: 'payments',
            label: 'Payments',
            icon: CreditCard,
            color: '#3b82f6',
            action: () => window.open('https://wa.me/919999999999?text=I%20have%20a%20query%20regarding%20payments.', '_blank')
        }
    ];

    return (
        <div className="support-container" style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999 }}>
            {/* Options Menu */}
            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
                    {supportOptions.map((opt, i) => (
                        <div 
                            key={opt.id}
                            className="support-option"
                            onClick={() => { opt.action(); setIsOpen(false); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'white',
                                padding: '8px 16px',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                                opacity: isOpen ? 1 : 0,
                                transitionDelay: `${i * 0.05}s`,
                                border: `1px solid ${opt.color}20`
                            }}
                        >
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy-800)' }}>{opt.label}</span>
                            <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '50%', 
                                background: opt.color, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'white' 
                            }}>
                                <opt.icon size={18} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
            >
                {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
            </button>

            <style>{`
                .support-option:hover {
                    transform: translateX(-5px) !important;
                    background: #f8fafc !important;
                }
                @media (max-width: 768px) {
                    .support-container { bottom: 85px !important; right: 20px !important; }
                }
            `}</style>
        </div>
    );
};

export default SupportButton;
