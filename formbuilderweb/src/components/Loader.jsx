'use client';

export default function Loader({ size = 'default', text }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px' }}>
            <div className={`spinner${size === 'sm' ? ' spinner-sm' : ''}`} />
            {text && <p className="loading-text">{text}</p>}
        </div>
    );
}

export function LoadingOverlay({ text = 'Loading...' }) {
    return (
        <div className="loading-overlay">
            <div className="spinner" />
            <p className="loading-text">{text}</p>
        </div>
    );
}
