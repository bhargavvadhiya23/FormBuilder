import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="error-page">
            <div className="error-page-code">404</div>
            <h2>Page Not Found</h2>
            <p>The page you are looking for doesn&apos;t exist or has been moved.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Link href="/" className="btn btn-primary">Go to Dashboard</Link>
                <Link href="/forms" className="btn btn-outline">View Forms</Link>
            </div>
        </div>
    );
}
