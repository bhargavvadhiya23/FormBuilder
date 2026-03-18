'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactPaginate from 'react-paginate';
import Swal from 'sweetalert2';
import api from '@/lib/api';
import { useApp } from '@/lib/AppContext';

export default function ApprovalsPage() {
    const { user, toast } = useApp();
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
    
    // Approvals (Pending) State
    const [approvals, setApprovals] = useState([]);
    const [loadingApprovals, setLoadingApprovals] = useState(true);
    const [approvalsPage, setApprovalsPage] = useState(0);
    
    // Requests (History/My Requests) State
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [requestsPage, setRequestsPage] = useState(0);
    
    const [error, setError] = useState(null);
    const itemsPerPage = 10;

    const isAdmin = user?.role === 'ADMIN';
    const canManageApprovals = isAdmin || user?.permissions?.includes('MANAGE_APPROVALS');

    useEffect(() => {
        if (canManageApprovals) {
            fetchApprovals();
        } else {
            setActiveTab('history');
        }
        fetchMyRequests();
    }, [canManageApprovals]);

    const fetchApprovals = async () => {
        try {
            setLoadingApprovals(true);
            const res = await api.get('/admin/api/approvals');
            setApprovals(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingApprovals(false);
        }
    };

    const fetchMyRequests = async () => {
        try {
            setLoadingRequests(true);
            const res = await api.get('/admin/api/approvals/my-requests');
            setRequests(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            if (activeTab === 'history') setError(err.message);
        } finally {
            setLoadingRequests(false);
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
                fetchMyRequests(); // Refresh history too as it might be updated
            } catch (err) {
                toast.error(err.message || `Failed to ${action} request`);
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return '#10b981';
            case 'REJECTED': return '#ef4444';
            default: return '#f59e0b';
        }
    };

    // Pagination Logic for Approvals
    const approvalsVisited = approvalsPage * itemsPerPage;
    const displayApprovals = approvals.slice(approvalsVisited, approvalsVisited + itemsPerPage);
    const approvalsPageCount = Math.ceil(approvals.length / itemsPerPage);

    // Pagination Logic for Requests
    const requestsVisited = requestsPage * itemsPerPage;
    const displayRequests = requests.slice(requestsVisited, requestsVisited + itemsPerPage);
    const requestsPageCount = Math.ceil(requests.length / itemsPerPage);

    if (error && ((activeTab === 'pending' && loadingApprovals === false) || (activeTab === 'history' && loadingRequests === false))) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--gf-red)', marginBottom: '1rem' }}>error</span>
                <h2 style={{ color: 'var(--text-primary)' }}>Error Loading Data</h2>
                <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
                <button className="gf-btn gf-btn-outline" onClick={() => activeTab === 'pending' ? fetchApprovals() : fetchMyRequests()} style={{ marginTop: '1rem' }}>Try Again</button>
            </div>
        );
    }

    return (
        <div className="approvals-container">
            <div className="page-header-gf">
                <div>
                    <h1>{canManageApprovals ? 'Approvals & Requests' : 'My Requests'}</h1>
                    <p>{canManageApprovals ? 'Manage pending approvals and track request history' : 'Track the status of your approval requests'}</p>
                </div>
            </div>

            {canManageApprovals && (
                <div className="tabs-container">
                    <button 
                        className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        Pending Approvals
                        {approvals.length > 0 && <span className="tab-count">{approvals.length}</span>}
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        {isAdmin ? 'Requests History' : 'My Requests'}
                    </button>
                </div>
            )}

            <div className="tab-content" style={{ marginTop: '20px' }}>
                {activeTab === 'pending' ? (
                    loadingApprovals ? (
                        <div style={{ padding: '4rem', textAlign: 'center' }}>
                            <div className="gf-spinner" style={{ margin: '0 auto 1rem' }}></div>
                            <p style={{ color: 'var(--text-secondary)' }}>Loading pending approvals...</p>
                        </div>
                    ) : approvals.length === 0 ? (
                        <div className="gf-empty">
                            <div className="gf-empty-icon">✅</div>
                            <div className="gf-empty-title">All Caught Up!</div>
                            <p style={{ color: 'var(--text-secondary)' }}>There are no pending approval requests at the moment.</p>
                        </div>
                    ) : (
                        <div>
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
                                                style={{ background: '#10b981', color: 'white' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>check</span>
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {approvalsPageCount > 1 && (
                                <div className="pagination-wrapper" style={{ marginTop: '30px' }}>
                                    <ReactPaginate
                                        previousLabel={"< Prev"}
                                        nextLabel={"Next >"}
                                        pageCount={approvalsPageCount}
                                        onPageChange={({ selected }) => setApprovalsPage(selected)}
                                        containerClassName={"gf-pagination"}
                                        activeClassName={"active"}
                                    />
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    loadingRequests ? (
                        <div style={{ padding: '4rem', textAlign: 'center' }}>
                            <div className="gf-spinner" style={{ margin: '0 auto 1rem' }}></div>
                            <p style={{ color: 'var(--text-secondary)' }}>Loading requests history...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="gf-empty">
                            <div className="gf-empty-icon">📂</div>
                            <div className="gf-empty-title">No Requests Found</div>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                {isAdmin ? "You haven't handled any approval requests yet." : "You haven't made any approval requests yet."}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="gf-table-container">
                                <table className="gf-table">
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th>Form Name</th>
                                            {isAdmin && <th>Requested By</th>}
                                            <th>Status</th>
                                            <th>Requested At</th>
                                            <th>User Note</th>
                                            <th>Admin Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayRequests.map((request) => (
                                            <tr key={request.id}>
                                                <td>
                                                    <span className="type-pill">{request.type.replace(/_/g, ' ')}</span>
                                                </td>
                                                <td style={{ fontWeight: '600' }}>{request.referenceName}</td>
                                                {isAdmin && (
                                                    <td>
                                                        <div style={{ fontWeight: '500' }}>{request.requestedBy?.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--gf-text-placeholder)' }}>{request.requestedBy?.email}</div>
                                                    </td>
                                                )}
                                                <td>
                                                    <span className="status-badge" style={{ 
                                                        backgroundColor: `${getStatusColor(request.status)}15`, 
                                                        color: getStatusColor(request.status),
                                                        borderColor: `${getStatusColor(request.status)}30`
                                                    }}>
                                                        {request.status}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '13px', color: 'var(--gf-text-secondary)' }}>
                                                    {new Date(request.createdAt).toLocaleString()}
                                                </td>
                                                <td className="note-cell" title={request.description}>
                                                    {request.description || '-'}
                                                </td>
                                                <td className="note-cell" title={request.adminNote}>
                                                    {request.adminNote || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {requestsPageCount > 1 && (
                                <div className="pagination-wrapper" style={{ marginTop: '30px' }}>
                                    <ReactPaginate
                                        previousLabel={"< Prev"}
                                        nextLabel={"Next >"}
                                        pageCount={requestsPageCount}
                                        onPageChange={({ selected }) => setRequestsPage(selected)}
                                        containerClassName={"gf-pagination"}
                                        activeClassName={"active"}
                                    />
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            <style jsx>{`
                .approvals-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .tabs-container {
                    display: flex;
                    gap: 10px;
                    border-bottom: 1px solid var(--gf-border);
                    margin-top: 20px;
                }
                .tab-btn {
                    padding: 12px 24px;
                    border: none;
                    background: none;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    cursor: pointer;
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .tab-btn:hover {
                    color: var(--gf-primary);
                }
                .tab-btn.active {
                    color: var(--gf-primary);
                }
                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: var(--gf-primary);
                    border-radius: 3px 3px 0 0;
                }
                .tab-count {
                    background: var(--gf-primary);
                    color: white;
                    font-size: 0.75rem;
                    padding: 2px 8px;
                    border-radius: 10px;
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
                /* Table Styles from my-requests */
                .type-pill {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #6b7280;
                    background: #f3f4f6;
                    padding: 2px 8px;
                    border-radius: 4px;
                    letter-spacing: 0.5px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    border: 1px solid transparent;
                }
                .note-cell {
                    font-size: 13px;
                    color: var(--gf-text-secondary);
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .gf-table-container {
                    background: white;
                    border-radius: 12px;
                    border: 1px solid var(--gf-border);
                    overflow: auto;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .gf-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 800px;
                }
                .gf-table th {
                    text-align: left;
                    padding: 14px 18px;
                    background: #f9fafb;
                    font-size: 13px;
                    font-weight: 600;
                    color: #4b5563;
                    border-bottom: 1px solid var(--gf-border);
                }
                .gf-table td {
                    padding: 16px 18px;
                    border-bottom: 1px solid #f3f4f6;
                    font-size: 14px;
                }
                .gf-table tr:hover {
                    background-color: #fcfcfc;
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

