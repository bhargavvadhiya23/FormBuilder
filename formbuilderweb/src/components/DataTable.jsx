'use client';
import { useState } from 'react';

/**
 * A reusable, premium-styled Data Table with client-side pagination.
 * 
 * @param {Array} columns - Array of { key, label, render }
 * @param {Array} data - Array of objects to display
 * @param {number} pageSize - Number of items per page (default: 5)
 */
export default function DataTable({ columns, data, pageSize = 5 }) {
    const [currentPage, setCurrentPage] = useState(1);
    
    // Pagination logic
    const totalPages = Math.ceil(data.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = data.slice(startIndex, startIndex + pageSize);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {columns.map((col) => (
                                <th key={col.key} style={{ 
                                    padding: '12px 16px', 
                                    fontSize: '13px', 
                                    fontWeight: '600', 
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.025em'
                                }}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? (
                            paginatedData.map((row, idx) => (
                                <tr key={row.id || idx} style={{ 
                                    borderBottom: idx === paginatedData.length - 1 ? 'none' : '1px solid #f1f5f9',
                                    transition: 'background-color 0.2s'
                                }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    {columns.map((col) => (
                                        <td key={col.key} style={{ padding: '16px', fontSize: '14px', verticalAlign: 'middle' }}>
                                            {col.render ? col.render(row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                    No data available
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ 
                    padding: '12px 16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Showing {startIndex + 1} to {Math.min(startIndex + pageSize, data.length)} of {data.length} entries
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            style={{ 
                                padding: '6px 12px', 
                                borderRadius: '6px', 
                                border: '1px solid #e2e8f0',
                                backgroundColor: currentPage === 1 ? '#f1f5f9' : 'white',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                color: '#475569'
                            }}
                        >
                            Previous
                        </button>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => handlePageChange(i + 1)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '6px',
                                        border: '1px solid',
                                        borderColor: currentPage === i + 1 ? '#4f46e5' : '#e2e8f0',
                                        backgroundColor: currentPage === i + 1 ? '#4f46e5' : 'white',
                                        color: currentPage === i + i ? 'white' : '#475569',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            style={{ 
                                padding: '6px 12px', 
                                borderRadius: '6px', 
                                border: '1px solid #e2e8f0',
                                backgroundColor: currentPage === totalPages ? '#f1f5f9' : 'white',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                color: '#475569'
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
