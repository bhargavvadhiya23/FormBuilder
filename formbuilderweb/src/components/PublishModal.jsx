'use client';
import Modal from './Modal';
import Badge from './Badge';

export default function PublishModal({ version, onClose, onConfirm, loading }) {
    if (!version) return null;
    return (
        <Modal
            isOpen={!!version}
            onClose={onClose}
            title="Publish Version"
            subtitle="Please review before publishing"
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className={`btn btn-success ${loading ? 'loading' : ''}`} onClick={onConfirm} disabled={loading}>
                        {loading ? 'Publishing...' : '🚀 Publish Now'}
                    </button>
                </>
            }
        >
            <div className="publish-summary">
                {[
                    ['Version', `v${version.versionNumber} (#${version.id})`],
                    ['Status', version.status],
                    ['Created', version.createdAt ? new Date(version.createdAt).toLocaleString() : '—'],
                ].map(([lbl, val]) => (
                    <div key={lbl} className="publish-summary-row">
                        <span className="label">{lbl}</span>
                        <span className="value">{val}</span>
                    </div>
                ))}
            </div>
            <div className="publish-warning">
                <span className="publish-warning-icon">⚠️</span>
                <div>
                    <strong>Important:</strong> Publishing will create a physical PostgreSQL table for submissions and <strong>lock this version</strong>. Fields cannot be modified after publishing.
                </div>
            </div>
        </Modal>
    );
}
