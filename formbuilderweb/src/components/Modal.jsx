'use client';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, subtitle, children, size = '', footer }) {
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        if (isOpen) document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className={`modal${size ? ` modal-${size}` : ''}`} role="dialog" aria-modal="true">
                <div className="modal-header">
                    <div>
                        <h3>{title}</h3>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
