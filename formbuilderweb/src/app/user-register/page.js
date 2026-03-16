'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Link from 'next/link';

export default function UserRegisterPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gf-bg, #f0f4f8)' }}><div className="gf-spinner" /></div>}>
      <UserRegisterContent />
    </Suspense>
  );
}

function UserRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, isAuthLoaded, toast } = useApp();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirect = searchParams.get('redirect') || '/';

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthLoaded && user) {
      router.replace(redirect);
    }
  }, [isAuthLoaded, user, redirect, router]);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError('All fields are required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.userRegister(form.name, form.email, form.password);
      // Auto-login after register
      const res = await authApi.userLogin(form.email, form.password);
      login(res.data);
      toast.success(`Account created! Welcome, ${res.data.name}!`);
      router.replace(redirect);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthLoaded || (isAuthLoaded && user)) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gf-bg, #f0f4f8)' }}>
      <div className="gf-spinner" />
    </div>;
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
            Create an account to fill out the form
          </p>
        </div>

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

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Full Name</label>
            <input
              name="name" type="text" placeholder="John Doe"
              value={form.name} onChange={handleChange}
              style={inputStyle} autoComplete="name"
            />
          </div>

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
              style={inputStyle} autoComplete="new-password"
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
            {loading ? '⏳ Please wait...' : '✨ Create Account'}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280', fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link
            href={`/user-login?redirect=${encodeURIComponent(redirect)}`}
            style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign In
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
