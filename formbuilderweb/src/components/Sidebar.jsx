'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/AppContext';

const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/forms', label: 'Forms', icon: '📋', permission: 'CREATE_DRAFT_FORM' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/permissions', label: 'Permission Manager', icon: '🔐', permission: 'MANAGE_ROLES' },
    { path: '/user-manager', label: 'User Manager', icon: '👥', permission: 'MANAGE_USERS' },
    { path: '/approvals', label: 'Approvals', icon: '✅', permission: 'MANAGE_APPROVALS' },
    { path: '/my-requests', label: 'My Requests', icon: '🕒' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
    const pathname = usePathname();
    const { user } = useApp();

    const isActive = (path) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
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
