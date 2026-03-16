'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Link from 'next/link';

export default function UserLoginPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gf-bg, #f0f4f8)' }}><div className="gf-spinner" /></div>}>
      <UserLoginContent />
    </Suspense>
  );
}

function UserLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, logout, user, isAuthLoaded, toast } = useApp();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expired = searchParams.get('expired');
  const redirect = searchParams.get('redirect') || '/';

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthLoaded && user) {
      if (user.role === 'ADMIN' || user.appRole) {
        router.replace('/');
      } else if (redirect !== '/') {
        router.replace(redirect);
      }
      // If user is USER and redirect is /, we just stay here or show a message
    }
  }, [isAuthLoaded, user, redirect, router]);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Email and password are required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.userLogin(form.email, form.password);
      login(res.data);
      toast.success(`Welcome back, ${res.data.name}!`);
      if (res.data.role === 'ADMIN' || res.data.appRole) {
        router.replace('/');
      } else {
        router.replace(redirect !== '/' ? redirect : `/user-login?welcome=1`);
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthLoaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gf-bg, #f0f4f8)' }}>
      <div className="gf-spinner" />
    </div>;
  }

  // If already logged in as USER and no specific redirect
  if (user && user.role === 'USER' && redirect === '/') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4ade80 0%, #3b82f6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{
          background: 'white', borderRadius: '20px', padding: '48px 40px',
          width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>👋</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e' }}>Welcome, {user.name}!</h1>
          <p style={{ color: '#6b7280', margin: '16px 0 32px' }}>
            You are successfully logged in to your account.
          </p>
          <button onClick={logout} className="gf-btn gf-btn-outline" style={{ width: '100%' }}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4ade80 0%, #3b82f6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'fadeInUp 0.4s ease'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #4ade80, #3b82f6)',
            borderRadius: '16px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 16px auto', color: 'white'
          }}>📋</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>FormBuilder</h1>
          <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '0.9rem' }}>
            Sign in to fill out the form
          </p>
        </div>

        {/* Session expiry notice */}
        {expired && (
          <div style={{
            background: '#fff3cd', border: '1px solid #ffc107',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
            fontSize: '0.85rem', color: '#856404'
          }}>
            ⏰ Your session has expired. Please log in again.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #ef4444',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
            fontSize: '0.85rem', color: '#b91c1c'
          }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email Address</label>
            <input
              name="email" type="email" placeholder="user@example.com"
              value={form.email} onChange={handleChange}
              style={inputStyle} autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Password</label>
            <input
              name="password" type="password" placeholder="••••••••"
              value={form.password} onChange={handleChange}
              style={inputStyle} autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #4ade80, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Please wait...' : '🔑 Sign In'}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280', fontSize: '0.9rem' }}>
          Don&apos;t have an account?{' '}
          <Link
            href={`/user-register?redirect=${encodeURIComponent(redirect)}`}
            style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}
          >
            Create Account
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '0.95rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
