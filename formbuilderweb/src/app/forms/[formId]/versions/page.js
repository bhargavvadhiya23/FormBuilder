'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { formsApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Swal from 'sweetalert2';

export default function VersionsPage({ params }) {
  const { formId } = use(params);
  const { toast } = useApp();
  const [versions, setVersions] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const [fRes, vRes] = await Promise.all([
        formsApi.getById(formId),
        formsApi.getVersions(formId)
      ]);
      setForm(fRes.data);
      setVersions(vRes.data || []);
    } catch (err) {
      toast.error("Failed to load versions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [formId]);

  const handleActivate = async (versionId) => {
    const result = await Swal.fire({
      title: 'Activate Version?',
      text: "This will make this version the active one for new submissions. The current active version will be archived.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--gf-purple)',
      confirmButtonText: 'Yes, Activate',
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)'
    });

    if (result.isConfirmed) {
      try {
        await formsApi.activateVersion(versionId);
        toast.success("Version activated successfully");
        fetchVersions();
      } catch (err) {
        toast.error(err.message || "Failed to activate version");
      }
    }
  };

  if (loading) return <div className="gf-loader"><div className="gf-spinner" /><span>Loading version history...</span></div>;

  return (
    <div className="gf-container" style={{ padding: '40px 20px', maxWidth: '1000px' }}>
      <div className="page-header-gf" style={{ marginBottom: '40px' }}>
        <div>
          <Link href={`/forms/${formId}/edit`} className="gf-btn gf-btn-ghost gf-btn-sm" style={{ marginBottom: '15px', color: 'var(--gf-purple)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}>arrow_back</span>
            Back to Editor
          </Link>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            {form?.name} <span style={{ color: 'var(--gf-text-placeholder)', fontWeight: '300' }}>/ Versions</span>
          </h1>
          <p style={{ color: 'var(--gf-text-secondary)', fontSize: '1.1rem' }}>Track evolution and rollback to any previous state.</p>
        </div>
      </div>

      <div className="gf-versions-list" style={{ display: 'grid', gap: '20px' }}>
        {versions.length === 0 ? (
          <div className="gf-card" style={{ textAlign: 'center', padding: '60px', borderRadius: '16px' }}>
             <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🕒</div>
             <h3 style={{ color: 'var(--gf-text-secondary)' }}>No published versions yet</h3>
             <p style={{ color: 'var(--gf-text-placeholder)' }}>Publish your form to see version history here.</p>
          </div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className={`gf-card version-card ${v.active ? 'active-version' : ''}`} style={{
              padding: '0',
              borderRadius: '16px',
              border: v.active ? '2px solid var(--gf-purple)' : '1px solid var(--gf-border)',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: v.active ? 'linear-gradient(to right, #ffffff, #fdfbff)' : '#fff',
              position: 'relative'
            }}>
              {v.active && (
                <div style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  bottom: '0',
                  width: '6px',
                  background: 'var(--gf-purple)'
                }} />
              )}
              <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    background: v.active ? '#f3e8ff' : '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    color: v.active ? 'var(--gf-purple)' : 'var(--gf-text-secondary)',
                    border: v.active ? '1px solid #e9d5ff' : '1px solid #e2e8f0'
                  }}>
                    V{v.versionNumber}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                       <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '700' }}>Version {v.versionNumber}</h3>
                       {v.active ? (
                         <span className="gf-badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', padding: '2px 10px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>CURRENTLY ACTIVE</span>
                       ) : (
                         <span className={`gf-badge ${v.status === 'PUBLISHED' ? 'gf-badge-primary' : 'gf-badge-secondary'}`} style={{ padding: '2px 10px', fontSize: '0.7rem' }}>
                           {v.status}
                         </span>
                       )}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', color: 'var(--gf-text-secondary)', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
                        {v.publishedAt ? new Date(v.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>description</span>
                        {v.submissionCount || 0} Submissions
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Link href={`/forms/${formId}/responses?versionId=${v.id}`} className="gf-btn gf-btn-outline" style={{ borderRadius: '10px' }}>
                    <span className="material-symbols-outlined" style={{ marginRight: '8px' }}>analytics</span>
                    See Responses
                  </Link>

                  {!v.active && (
                    <button 
                      className="gf-btn gf-btn-primary" 
                      onClick={() => handleActivate(v.id)}
                      style={{ 
                        borderRadius: '10px',
                        padding: '10px 24px',
                        boxShadow: '0 4px 12px rgba(103, 58, 183, 0.2)'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ marginRight: '8px', fontSize: '20px' }}>bolt</span>
                      Activate
                    </button>
                  )}
                  {v.active && (
                    <div style={{ padding: '10px 15px', color: '#059669', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '0.9rem' }}>
                      <span className="material-symbols-outlined">check_circle</span>
                      Active
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ 
        marginTop: '50px', 
        background: 'linear-gradient(135deg, #f8f9ff 0%, #f1f4ff 100%)', 
        padding: '30px', 
        borderRadius: '20px', 
        border: '1px solid #e0e7ff',
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start'
      }}>
        <div style={{ 
          background: 'white', 
          width: '50px', 
          height: '50px', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--gf-purple)' }}>help_outline</span>
        </div>
        <div>
          <h3 style={{ color: '#1e3a8a', marginBottom: '8px', fontSize: '1.1rem' }}>Understanding Versioning</h3>
          <p style={{ color: '#374151', fontSize: '0.95rem', lineHeight: '1.6', margin: '0' }}>
            Activating a previous version immediately changes the live form for all respondents. 
            All existing submission data is preserved, and new responses will be tagged with the newly active version ID.
          </p>
          <div style={{ display: 'flex', gap: '30px', marginTop: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              <strong style={{ color: '#1e3a8a' }}>Rollback:</strong> Switch back to any stable state in seconds.
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              <strong style={{ color: '#1e3a8a' }}>Integrity:</strong> Field keys are locked in published versions.
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .version-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.06);
          border-color: #d1d5db;
        }
        .active-version:hover {
          border-color: var(--gf-purple);
        }
      `}</style>
    </div>
  );
}
