'use client';
import Modal from './Modal';

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    loading = false,
    icon,
}) {
    const icons = { danger: '🗑️', warning: '⚠️', info: 'ℹ️' };
    const btnClass = { danger: 'btn-danger', warning: 'btn-warning', info: 'btn-primary' };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            size="sm"
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose} disabled={loading}>{cancelLabel}</button>
                    <button
                        className={`btn ${btnClass[variant] || 'btn-danger'} ${loading ? 'loading' : ''}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : confirmLabel}
                    </button>
                </>
            }
        >
            <div className="confirm-modal-body">
                <div className={`confirm-modal-icon ${variant}`}>
                    {icon || icons[variant]}
                </div>
                <h3>{title}</h3>
                {message && <p>{message}</p>}
            </div>
        </Modal>
    );
}
