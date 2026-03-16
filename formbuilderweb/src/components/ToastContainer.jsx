'use client';
import { useApp } from '@/lib/AppContext';

const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

export default function ToastContainer() {
    const { toasts, removeToast } = useApp();

    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span className="toast-icon">{icons[t.type]}</span>
                    <div className="toast-content">
                        <div className="toast-title">{t.title}</div>
                        {t.message && <div className="toast-message">{t.message}</div>}
                    </div>
                    <button className="toast-close" onClick={() => removeToast(t.id)}>✕</button>
                </div>
            ))}
        </div>
    );
}
