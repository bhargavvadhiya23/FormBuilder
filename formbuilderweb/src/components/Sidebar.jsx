'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/AppContext';
import api from '@/lib/api';

const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/forms', label: 'Forms', icon: '📋', permission: 'CREATE_DRAFT_FORM' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/permissions', label: 'Permission & Modules', icon: '🔐', permission: 'MANAGE_ROLES' },
    { path: '/user-manager', label: 'User Manager', icon: '👥', permission: 'MANAGE_USERS' },
    { path: '/approvals', label: 'Approvals', icon: '✅', permission: 'MANAGE_APPROVALS' },
    { path: '/my-requests', label: 'My Requests', icon: '🕒' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
    const pathname = usePathname();
    const { user } = useApp();
    const [dynamicModules, setDynamicModules] = useState([]);
    const [expandedModules, setExpandedModules] = useState({});

    useEffect(() => {
        if (user) {
            fetchMyModules();
        }
    }, [user]);

    const fetchMyModules = async () => {
        try {
            const res = await api.get('/api/modules/my');
            setDynamicModules(res.data);
        } catch (err) {
            console.error('Error fetching dynamic modules:', err);
        }
    };

    const isActive = (path) => {
        if (!path) return false;
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    };

    const toggleModule = (modId) => {
        setExpandedModules(prev => ({
            ...prev,
            [modId]: !prev[modId]
        }));
    };

    const getModuleLink = (mod) => {
        if (mod.pageLink && (mod.pageLink.startsWith('/') || mod.pageLink.startsWith('http'))) {
            return mod.pageLink;
        }
        if (mod.routePrefix && mod.routePrefix.startsWith('/')) {
            return mod.routePrefix;
        }
        return `/m/${mod.id}`;
    };

    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">FB</div>
                {!collapsed && (
                    <div className="sidebar-logo-text">
                        <span>FormBuilder</span>
                    </div>
                )}
                <button 
                    className="sidebar-toggle-arrow" 
                    onClick={onToggle}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <span className="material-symbols-outlined">
                        {collapsed ? 'arrow_right_alt' : 'arrow_left_alt'}
                    </span>
                </button>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-label">Menu</div>
                {navItems
                    .filter(item => {
                        if (!item.permission) return true; // generic items
                        if (user?.role === 'ADMIN') return true;
                        return user?.permissions?.includes(item.permission);
                    })
                    .map((item) => (
                        <Link key={item.path} href={item.path} style={{ textDecoration: 'none' }}>
                            <div className={`nav-item${isActive(item.path) ? ' active' : ''}`}>
                                <span className="nav-item-icon">{item.icon}</span>
                                <span className="nav-item-text">{item.label}</span>
                            </div>
                        </Link>
                    ))}

                {/* --- Dynamic Modules --- */}
                {dynamicModules.filter(m => m.parentId === null).map((mod) => {
                    const children = dynamicModules.filter(child => child.parentId === mod.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = !!expandedModules[mod.id];

                    const itemContent = (
                        <div 
                            className={`nav-item${isActive(mod.routePrefix) ? ' active' : ''}`}
                            onClick={() => hasChildren && toggleModule(mod.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="nav-item-icon">{mod.iconClass || '📄'}</span>
                            {!collapsed && (
                                <>
                                    <span className="nav-item-text" style={{ flex: 1 }}>{mod.name}</span>
                                    {hasChildren && (
                                        <span className="material-symbols-outlined" style={{ 
                                            fontSize: '18px', 
                                            transition: '0.3s', 
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            color: '#94a3b8'
                                        }}>
                                            expand_more
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    );

                    return (
                        <div key={mod.id}>
                            {mod.isParent && !mod.pageLink && !mod.routePrefix?.startsWith('/') ? (
                                itemContent
                            ) : (
                                <Link href={getModuleLink(mod)} style={{ textDecoration: 'none' }}>
                                    {itemContent}
                                </Link>
                            )}
                            
                            {/* Children */}
                            {hasChildren && isExpanded && !collapsed && (
                                <div className="sub-menu">
                                    {children.map(child => (
                                        <Link key={child.id} href={getModuleLink(child)} style={{ textDecoration: 'none' }}>
                                            <div className={`nav-item sub-item${isActive(child.routePrefix) ? ' active' : ''}`} style={{ paddingLeft: '32px', fontSize: '13px', opacity: 0.9 }}>
                                                <span className="nav-item-icon" style={{ fontSize: '12px' }}>{child.iconClass || '▸'}</span>
                                                <span className="nav-item-text">{child.name}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="nav-section-label" style={{ marginTop: '16px' }}>Coming Soon</div>
                {[{ label: 'Analytics', icon: '📊' }].map((item) => (
                    <div key={item.label} className="nav-item" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                        <span className="nav-item-icon">{item.icon}</span>
                        <span className="nav-item-text">{item.label}</span>
                    </div>
                ))}
            </nav>

        </aside>
    );
}
