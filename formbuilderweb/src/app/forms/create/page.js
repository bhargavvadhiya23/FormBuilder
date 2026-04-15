'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formsApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';

export default function CreateFormPage() {
  const router = useRouter();
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setNameError('Form title is required'); return; }
    setNameError('');
    setSubmitting(true);
    try {
      const res = await formsApi.create({ name: name.trim(), description: description.trim() });
      toast.success('Form created! Now add your questions.');
      router.push(`/forms/${res.data.id}/edit`);
    } catch (e) {
      const errMsg = e.message || 'Failed to create form';
      if (errMsg.toLowerCase().includes('name')) {
        setNameError(errMsg);
      }
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
      <div className="form-title-card" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/forms" className="gf-btn gf-btn-ghost gf-btn-sm">← Back to Forms</Link>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--gf-text-secondary)' }}>
              Form Title <span style={{ color: 'var(--gf-red)' }}>*</span>
            </label>
            <input
              className="form-title-input"
              placeholder="Untitled form"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); }}
              maxLength={150}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.78rem', color: 'var(--gf-text-secondary)' }}>
              <span style={{ color: 'var(--gf-red)' }}>{nameError}</span>
              <span>{name.length}/150</span>
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--gf-text-secondary)' }}>
              Description <span style={{ fontStyle: 'italic', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              className="form-desc-input"
              placeholder="What is this form for?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="gf-btn gf-btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : '＋ Create & Edit'}
            </button>
            <Link href="/forms" className="gf-btn gf-btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
