'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formsApi, versionsApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';

export default function DashboardPage() {
  const { user } = useApp();
  const [stats, setStats] = useState({ forms: 0, drafts: 0, published: 0, submissions: 0, driftedForms: [] });
  const [recentForms, setRecentForms] = useState([]);
  const [loading, setLoading] = useState(true);

  const canCreateForm = user?.role === 'ADMIN' || user?.permissions?.includes('CREATE_DRAFT_FORM');

  useEffect(() => {
    async function fetchData() {
      try {
        const [formsRes, statsRes] = await Promise.all([
          formsApi.getAll(),
          formsApi.getStats(),
        ]);
        const forms = Array.isArray(formsRes.data) ? formsRes.data : [];
        setRecentForms(forms.slice(0, 5));
        const s = statsRes.data || {};
        setStats({
          forms: forms.length,
          drafts: s.draftVersions ?? 0,
          published: s.publishedVersions ?? 0,
          submissions: s.totalSubmissions ?? 0,
          driftedForms: s.driftedForms ?? [],
        });
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Welcome to the FormBuilder Admin Panel</p>
        </div>
        <div className="page-header-actions">
          {canCreateForm && (
            <Link href="/forms/create" className="btn btn-primary">
              ＋ New Form
            </Link>
          )}
        </div>
      </div>

      {stats.driftedForms?.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <strong style={{ fontSize: '1.1rem' }}>Critical System Alert: Database Schema Drift Detected</strong>
          </div>
          <p style={{ margin: 0 }}>The following forms have been blocked due to manual database changes. Submissions and updates are disabled for these forms to prevent data loss:</p>
          <ul style={{ margin: '4px 0 0 24px', padding: 0 }}>
            {stats.driftedForms.map(f => (
              <li key={f.id}>
                <Link href={`/forms/${f.id}`} style={{ fontWeight: '600', textDecoration: 'underline' }}>{f.name}</Link> (Table: <code>{f.tableName}</code>)
              </li>
            ))}
          </ul>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
            <em>Action Required: Please revert physical database changes or contact the system administrator to re-sync the schema.</em>
          </p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-info">
            <h3>{loading ? '—' : stats.forms}</h3>
            <p>Total Forms</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">✏️</div>
          <div className="stat-info">
            <h3>{loading ? '—' : stats.drafts}</h3>
            <p>Draft Versions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <h3>{loading ? '—' : stats.published}</h3>
            <p>Published Versions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📊</div>
          <div className="stat-info">
            <h3>{loading ? '—' : stats.submissions}</h3>
            <p>Submissions</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="content-card" style={{ marginBottom: '24px' }}>
        <div className="card-header"><h2>Quick Actions</h2></div>
        <div className="card-body" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {canCreateForm && <Link href="/forms/create" className="btn btn-primary">＋ Create New Form</Link>}
          {canCreateForm && <Link href="/forms" className="btn btn-outline">📋 View All Forms</Link>}
        </div>
      </div>

      {/* Recent Forms */}
      <div className="content-card">
        <div className="card-header">
          <h2>Recent Forms</h2>
          {canCreateForm && <Link href="/forms" className="btn btn-ghost btn-sm">View all →</Link>}
        </div>
        {loading ? (
          <div style={{ padding: '24px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: '12px', display: 'flex', gap: '16px' }}>
                <div className="skeleton skeleton-medium" />
                <div className="skeleton skeleton-long" />
              </div>
            ))}
          </div>
        ) : recentForms.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px' }}>
            <div className="empty-state-icon">📋</div>
            <h3>No forms yet</h3>
            <p>Create your first form to get started.</p>
            {canCreateForm && <Link href="/forms/create" className="btn btn-primary">＋ Create Form</Link>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created By</th>
                <th>Description</th>
                <th>Created Date</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentForms.map((form) => (
                <tr key={form.id}>
                  <td><strong>{form.name}</strong></td>
                  <td>
                    {form.createdBy ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{form.createdBy.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>{form.createdBy.email}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td><span className="text-muted">{form.description || '—'}</span></td>
                  <td className="text-muted">{form.createdAt ? new Date(form.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="col-actions">
                    <div className="table-actions">
                      <Link href={`/forms/${form.id}`} className="action-btn primary" title="View">👁</Link>
                      <Link href={`/forms/${form.id}/versions`} className="action-btn" title="Versions">📁</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info banner */}
      <div className="alert alert-info" style={{ marginTop: '24px' }}>
        <span>ℹ️</span>
        <div>
          <strong>Getting Started:</strong> Create a Form → Add a Version → Define Fields → Publish the version to generate a live submission table.
        </div>
      </div>
    </div>
  );
}
