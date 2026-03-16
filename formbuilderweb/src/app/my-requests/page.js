'use client';
import { useState, useEffect } from 'react';
import ReactPaginate from 'react-paginate';
import api from '@/lib/api';
import { useApp } from '@/lib/AppContext';

export default function MyRequestsPage() {
    const { user } = useApp();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Pagination State
    const [pageNumber, setPageNumber] = useState(0);
    const itemsPerPage = 10;

    const isAdmin = user?.role === 'ADMIN';

    useEffect(() => {
        fetchMyRequests();
    }, []);

    const fetchMyRequests = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/api/approvals/my-requests');
            setRequests(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return '#10b981';
            case 'REJECTED': return '#ef4444';
            default: return '#f59e0b';
        }
    };

    // Pagination Logic
    const pagesVisited = pageNumber * itemsPerPage;
    const displayRequests = requests.slice(pagesVisited, pagesVisited + itemsPerPage);
    const pageCount = Math.ceil(requests.length / itemsPerPage);

    const changePage = ({ selected }) => {
        setPageNumber(selected);
    };

    if (loading) return (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="gf-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading your requests...</p>
        </div>
    );
    
    if (error) return (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--gf-red)', marginBottom: '1rem' }}>error</span>
            <h2 style={{ color: 'var(--text-primary)' }}>Error Loading Requests</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <button className="gf-btn gf-btn-outline" onClick={fetchMyRequests} style={{ marginTop: '1rem' }}>Try Again</button>
        </div>
    );

    return (
        <div className="my-requests-container">
            <div className="page-header-gf">
                <div>
                    <h1>{isAdmin ? 'History of Handled Requests' : 'My Approval Requests'}</h1>
                    <p>{isAdmin ? 'Review requests you have already processed' : 'Track the status of your approval requests'}</p>
                </div>
                <div className="count-badge grey" style={{ fontSize: '1rem', padding: '6px 16px' }}>
                    {requests.length} Total
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="gf-empty">
                    <div className="gf-empty-icon">📂</div>
                    <div className="gf-empty-title">No Requests Found</div>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {isAdmin ? "You haven't handled any approval requests yet." : "You haven't made any approval requests yet."}
                    </p>
                </div>
            ) : (
                <div style={{ marginTop: '20px' }}>
                    <div className="gf-table-container">
                        <table className="gf-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Form Name</th>
                                    {isAdmin && <th>Requested By</th>}
                                    <th>Status</th>
                                    <th>Requested At</th>
                                    <th>Your Note</th>
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

                    {pageCount > 1 && (
                        <div className="pagination-wrapper" style={{ marginTop: '30px' }}>
                            <ReactPaginate
                                previousLabel={"< Prev"}
                                nextLabel={"Next >"}
                                pageCount={pageCount}
                                onPageChange={changePage}
                                containerClassName={"gf-pagination"}
                                activeClassName={"active"}
                            />
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .my-requests-container {
                    padding: 2rem;
                    max-width: 1300px;
                    margin: 0 auto;
                }
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
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .gf-table {
                    width: 100%;
                    border-collapse: collapse;
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
                .gf-table tr:last-child td {
                    border-bottom: none;
                }
                .gf-table tr:hover {
                    background-color: #fcfcfc;
                }
            `}</style>
        </div>
    );
}
