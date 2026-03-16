'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ToastContainer from './ToastContainer';
import { useApp } from '@/lib/AppContext';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/user-login', '/user-register'];
const PUBLIC_PREFIX = ['/publish/']; // public form fill pages

function isPublicRoute(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PREFIX.some(p => pathname.startsWith(p))) return true;
  return false;
}

export default function LayoutShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthLoaded, logout } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = isPublicRoute(pathname);
  const isAdmin = user?.role === 'ADMIN';

  // Helper to check for a specific permission
  const hasPermission = (perm) => {
    if (isAdmin) return true;
    return user?.permissions?.includes(perm);
  };

  // If authenticated but not allowed to access anything at all (rare case)
  // For now, we allow all authenticated users to enter the shell and filter the sidebar.
  const isForbidden = false; // Relaxing this to support custom roles

  // Show the public page directly (no sidebar/topbar)
  if (isPublic) {
    return (
      <>
        {children}
        <ToastContainer />
      </>
    );
  }

  // Show Forbidden page if user is not an admin
  if (isForbidden) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--gf-bg, #f0f4f8)', textAlign: 'center', padding: '20px'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🚫</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e' }}>Access Denied</h1>
        <p style={{ color: '#6b7280', maxWidth: '400px', margin: '10px 0 24px' }}>
          This area is restricted to administrators. You are currently logged in as <strong>{user.name}</strong> (User).
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.location.href = '/user-login'}
            className="gf-btn gf-btn-purple"
          >
            Go to User Panel
          </button>
          <button
            className="gf-btn gf-btn-outline"
            onClick={logout}
          >
            Switch Account
          </button>
        </div>
        <ToastContainer />
      </div>
    );
  }

  // Show loading spinner while checking auth
  // We MUST match the server's initial render to avoid hydration errors.
  // The server always renders !isAuthLoaded and !user.
  if (!isAuthLoaded && !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gf-bg, #f0f4f8)' }}>
        <div className="gf-loader">
          <div className="gf-spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div className="sidebar-overlay visible" onClick={() => setMobileOpen(false)} />
      )}
      <div className={`main-wrapper${collapsed ? ' collapsed' : ''}`}>
        <Topbar onMenuClick={() => {
          if (window.innerWidth > 768) {
            setCollapsed(!collapsed);
          } else {
            setMobileOpen(!mobileOpen);
          }
        }} />
        <main className="page-content">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
