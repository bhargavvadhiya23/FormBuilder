'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactPaginate from 'react-paginate';
import Swal from 'sweetalert2';
import api from '@/lib/api';
import { useApp } from '@/lib/AppContext';

export default function ApprovalsPage() {
    const { toast } = useApp();
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Pagination State
    const [pageNumber, setPageNumber] = useState(0);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchApprovals();
    }, []);

    const fetchApprovals = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/api/approvals');
            setApprovals(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        const isApprove = action === 'approve';
        
        const { value: adminNote, isConfirmed } = await Swal.fire({
            title: isApprove ? 'Approve Request?' : 'Reject Request?',
            text: isApprove ? 'You can add an optional note for the requester.' : 'Please provide a reason for rejection.',
            input: 'textarea',
            inputPlaceholder: 'Add your note here...',
            inputLabel: isApprove ? 'Admin Note (Optional)' : 'Rejection Reason (Recommended)',
            showCancelButton: true,
            confirmButtonText: isApprove ? 'Approve' : 'Reject',
            confirmButtonColor: isApprove ? '#10b981' : '#ef4444',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            inputAttributes: {
                'aria-label': 'Type your note here'
            },
            preConfirm: (value) => {
                if (!isApprove && !value) {
                    Swal.showValidationMessage('Rejection reason is required');
                }
                return value;
            }
        });

        if (isConfirmed) {
            try {
                await api.post(`/admin/api/approvals/${id}/${action}`, { adminNote });
                toast.success(`Request ${action}d successfully`);
                fetchApprovals();
            } catch (err) {
                toast.error(err.message || `Failed to ${action} request`);
            }
        }
    };

    // Pagination Logic
    const pagesVisited = pageNumber * itemsPerPage;
    const displayApprovals = approvals.slice(pagesVisited, pagesVisited + itemsPerPage);
    const pageCount = Math.ceil(approvals.length / itemsPerPage);

    const changePage = ({ selected }) => {
        setPageNumber(selected);
    };

    if (loading) return (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="gf-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading pending approvals...</p>
        </div>
    );

    if (error) return (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--gf-red)', marginBottom: '1rem' }}>error</span>
            <h2 style={{ color: 'var(--text-primary)' }}>Error Loading Approvals</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <button className="gf-btn gf-btn-outline" onClick={fetchApprovals} style={{ marginTop: '1rem' }}>Try Again</button>
        </div>
    );

    return (
        <div className="approvals-container">
            <div className="page-header-gf">
                <div>
                    <h1>Pending Approvals</h1>
                    <p>Review and process requests from sub-users</p>
                </div>
                <div className="count-badge primary" style={{ fontSize: '1rem', padding: '6px 16px' }}>
                    {approvals.length} Requests
                </div>
            </div>

            {approvals.length === 0 ? (
                <div className="gf-empty">
                    <div className="gf-empty-icon">✅</div>
                    <div className="gf-empty-title">All Caught Up!</div>
                    <p style={{ color: 'var(--text-secondary)' }}>There are no pending approval requests at the moment.</p>
                </div>
            ) : (
                <div style={{ marginTop: '20px' }}>
                    <div className="requests-list">
                        {displayApprovals.map(request => (
                            <div key={request.id} className="request-card">
                                <div className="request-info">
                                    <div className="request-type-badge">
                                        {request.type.replace(/_/g, ' ')}
                                    </div>
                                    <h3 className="request-form-name">{request.referenceName}</h3>
                                    <div className="request-meta">
                                        <div className="meta-item">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
                                            {request.requestedBy.name} ({request.requestedBy.email})
                                        </div>
                                        <div className="meta-item">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
                                            {new Date(request.createdAt).toLocaleString()}
                                        </div>
                                        {request.description && (
                                            <div className="meta-item note-preview">
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>short_text</span>
                                                Note: "{request.description}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="request-actions">
                                    <Link 
                                        href={`/forms/${request.referenceId}/edit`}
                                        className="gf-btn gf-btn-outline gf-btn-sm"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>visibility</span>
                                        Review
                                    </Link>
                                    <button 
                                        onClick={() => handleAction(request.id, 'reject')}
                                        className="gf-btn gf-btn-ghost gf-btn-sm"
                                        style={{ color: 'var(--gf-red)' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>close</span>
                                        Reject
                                    </button>
                                    <button 
                                        onClick={() => handleAction(request.id, 'approve')}
                                        className="gf-btn gf-btn-primary gf-btn-sm"
                                        style={{ background: '#10b981' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>check</span>
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pageCount > 1 && (
                        <div className="pagination-wrapper" style={{ marginTop: '30px' }}>
                            <ReactPaginate
                                previousLabel={"< Prev"}
                                nextLabel={"Next >"}
                                pageCount={pageCount}
                                onPageChange={changePage}
                                containerClassName={"gf-pagination"}
                                previousLinkClassName={"pagination__link"}
                                nextLinkClassName={"pagination__link"}
                                disabledClassName={"pagination__link--disabled"}
                                activeClassName={"active"}
                            />
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .approvals-container {
                    padding: 2rem;
                    max-width: 1100px;
                    margin: 0 auto;
                }
                .requests-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .request-card {
                    background: white;
                    border: 1px solid var(--gf-border);
                    border-radius: 12px;
                    padding: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.2s ease;
                }
                .request-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border-color: var(--gf-primary);
                }
                .request-type-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    background: #f3f4f6;
                    color: #4b5563;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                }
                .request-form-name {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin: 0 0 10px 0;
                    color: var(--text-primary);
                }
                .request-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.85rem;
                    color: var(--gf-text-secondary);
                }
                .note-preview {
                    margin-top: 4px;
                    padding: 6px 10px;
                    background: #f9fafb;
                    border-radius: 4px;
                    font-style: italic;
                    color: var(--gf-text-placeholder);
                }
                .request-actions {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                @media (max-width: 768px) {
                    .request-card {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 20px;
                    }
                    .request-actions {
                        width: 100%;
                        justify-content: flex-end;
                    }
                }
            `}</style>
        </div>
    );
}
