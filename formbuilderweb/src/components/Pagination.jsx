'use client';

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
    if (totalPages <= 1) return null;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const pageNumbers = [];
    const range = 2;
    for (let i = Math.max(1, page - range); i <= Math.min(totalPages, page + range); i++) {
        pageNumbers.push(i);
    }

    return (
        <div className="pagination">
            <span className="pagination-info">
                Showing {start}–{end} of {total} results
            </span>
            <div className="pagination-controls">
                <button className="page-btn" onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
                <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
                {pageNumbers[0] > 1 && <span className="page-btn" style={{ border: 'none', cursor: 'default' }}>…</span>}
                {pageNumbers.map((p) => (
                    <button
                        key={p}
                        className={`page-btn${p === page ? ' active' : ''}`}
                        onClick={() => onPageChange(p)}
                    >
                        {p}
                    </button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <span className="page-btn" style={{ border: 'none', cursor: 'default' }}>…</span>
                )}
                <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>›</button>
                <button className="page-btn" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>»</button>
            </div>
        </div>
    );
}
