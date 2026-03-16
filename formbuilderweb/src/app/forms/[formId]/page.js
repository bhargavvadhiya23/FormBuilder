'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { formsApi } from '@/lib/api';
import Loader from '@/components/Loader';
import Badge from '@/components/Badge';

export default function FormDetailPage({ params }) {
    const { formId } = use(params);
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchForm() {
            try {
                const res = await formsApi.getById(formId);
                setForm(res.data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        fetchForm();
    }, [formId]);

    if (loading) return <Loader text="Loading form..." />;

    if (error) return (
        <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Failed to load form</h3>
            <p>{error}</p>
            <Link href="/forms" className="btn btn-outline">← Back to Forms</Link>
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>{form?.name}</h1>
                    <p>{form?.description || 'No description'}</p>
                </div>
                <div className="page-header-actions">
                    <Link href={`/forms/${formId}/versions/create`} className="btn btn-primary">＋ New Version</Link>
                    <Link href={`/forms/${formId}/versions`} className="btn btn-outline">Manage Versions</Link>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="content-card">
                    <div className="card-header"><h2>Form Info</h2></div>
                    <div className="card-body">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <tbody>
                                {[
                                    ['ID', `#${form?.id}`],
                                    ['Name', form?.name],
                                    ['Description', form?.description || '—'],
                                    ['Created At', form?.createdAt ? new Date(form.createdAt).toLocaleString() : '—'],
                                    ['Updated At', form?.updatedAt ? new Date(form.updatedAt).toLocaleString() : '—'],
                                ].map(([label, val]) => (
                                    <tr key={label}>
                                        <td style={{ padding: '10px 0', color: 'var(--text-secondary)', width: '130px', verticalAlign: 'top' }}>{label}</td>
                                        <td style={{ padding: '10px 0', fontWeight: 500, color: 'var(--text-primary)' }}>{val}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="content-card">
                    <div className="card-header"><h2>Quick Actions</h2></div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link href={`/forms/${formId}/versions`} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                            📁 View All Versions
                        </Link>
                        <Link href={`/forms/${formId}/versions/create`} className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>
                            ＋ Create New Version
                        </Link>
                        <Link href="/forms" className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}>
                            ← Back to Forms
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
