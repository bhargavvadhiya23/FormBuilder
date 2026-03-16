'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/AppContext';

// Convert /forms/5/versions/2/fields into breadcrumb segments
function buildBreadcrumbs(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    const crumbs = [{ label: 'Dashboard', path: '/' }];
    let currentPath = '';

    const labelMap = {
        forms: 'Forms',
        versions: 'Versions',
        fields: 'Fields',
        create: 'Create',
        edit: 'Edit',
        submissions: 'Submissions',
    };

    segments.forEach((seg, i) => {
        currentPath += `/${seg}`;
        const isId = /^\d+$/.test(seg);
        const label = isId ? `#${seg}` : (labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1));
        crumbs.push({ label, path: currentPath });
    });

    return crumbs;
}

export default function Topbar({ onMenuClick }) {
    const pathname = usePathname();
    const crumbs = buildBreadcrumbs(pathname);
    const { user, logout } = useApp();

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'A';

    return (
        <header className="topbar">
            <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
                <span className="material-symbols-outlined">menu</span>
            </button>
            <nav className="breadcrumbs" aria-label="Breadcrumb">
                {crumbs.map((crumb, idx) => (
                    <div key={crumb.path} className={`breadcrumb-item${idx === crumbs.length - 1 ? ' current' : ''}`}>
                        {idx > 0 && <span className="breadcrumb-sep">/</span>}
                        {idx === crumbs.length - 1 ? (
                            <span>{crumb.label}</span>
                        ) : (
                            <Link href={crumb.path}>{crumb.label}</Link>
                        )}
                    </div>
                ))}
            </nav>
            <div className="topbar-end" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--gf-text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>
                            {user.name}
                        </span>
                        <div style={{
                            fontSize: '0.65rem',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: user.role === 'ADMIN' ? 'rgba(102, 126, 234, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: user.role === 'ADMIN' ? '#667eea' : '#10b981',
                            border: `1px solid ${user.role === 'ADMIN' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {user.role === 'ADMIN' ? 'Admin' : (user.appRole || 'User')}
                        </div>
                    </div>
                )}
                <div className="topbar-avatar" title={user?.name || 'Admin'}>
                    {initials}
                </div>
                <button
                    onClick={logout}
                    title="Logout"
                    style={{
                        background: 'none', border: '1px solid var(--gf-border)',
                        borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                        fontSize: '0.8rem', color: 'var(--gf-text-secondary)',
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                >
                    🚪 Logout
                </button>
            </div>
        </header>
    );
}
