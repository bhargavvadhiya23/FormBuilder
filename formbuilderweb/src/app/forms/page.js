'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactPaginate from 'react-paginate';
import { formsApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Swal from 'sweetalert2';

export default function FormsPage() {
  const { toast, user } = useApp();
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewingTrash, setViewingTrash] = useState(false);
  const [selectedForms, setSelectedForms] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Pagination State
  const [draftPage, setDraftPage] = useState(0);
  const [pubPage, setPubPage] = useState(0);
  const itemsPerPage = 8;

  const fetchForms = useCallback(async () => {
    setLoading(true);
    setSelectedForms([]); // Reset selection on fetch
    setIsSelectionMode(false); // Reset selection mode
    try {
      const res = viewingTrash ? await formsApi.getTrashForms() : await formsApi.getAll();
      console.log("DASHBOARD DATA:", res.data); // DEBUG
      setForms(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [viewingTrash, toast]);

  useEffect(() => { fetchForms(); }, [fetchForms, viewingTrash]);

  const filtered = forms.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase())
  );

  const copyLink = (formId) => {
    const url = `${window.location.origin}/publish/${formId}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  const handlePublish = async (formId) => {
    const isAdmin = user?.role === 'ADMIN';
    
    // For sub-users, show a note popup
    if (!isAdmin) {
      const { value: note, isConfirmed } = await Swal.fire({
        title: 'Request Approval',
        input: 'textarea',
        inputLabel: 'Add a note for the administrator (optional)',
        inputPlaceholder: 'Type your note here...',
        showCancelButton: true,
        confirmButtonText: 'Send Request',
        confirmButtonColor: '#f4b400',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        inputAttributes: {
          'aria-label': 'Type your note here'
        }
      });

      if (isConfirmed) {
        try {
          const res = await formsApi.publish(formId, { note });
          toast.success(res.data?.message || 'Approval request sent!');
          if (res.status === 202) {
            router.push('/');
          } else {
            fetchForms();
          }
        } catch (e) {
          toast.error(e.message || 'Failed to request approval');
        }
      }
      return;
    }

    // For admins, standard publish confirmation (optional but good)
    const result = await Swal.fire({
      title: 'Publish Form?',
      text: 'This will make the form public and create a new version.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish Now',
      confirmButtonColor: '#0f9d58'
    });

    if (result.isConfirmed) {
      try {
        await formsApi.publish(formId);
        toast.success('Form published successfully!');
        fetchForms();
      } catch (e) {
        toast.error(e.message || 'Failed to publish form');
      }
    }
  };
  
  const handleDelete = async (formId, formName) => {
    const softDelete = user?.softDeleteEnabled === true;
    const isPermanent = viewingTrash || !softDelete;

    const result = await Swal.fire({
      title: isPermanent ? 'Delete Permanently?' : 'Move to Trash?',
      text: isPermanent 
        ? `"${formName}" will be permanently removed. This action cannot be undone.`
        : `You are about to move "${formName}" to trash. This will also hide all its responses!`,
      icon: 'warning',
      showCancelButton: true,
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      confirmButtonColor: '#d93025',
      cancelButtonColor: 'var(--bg-primary)',
      confirmButtonText: isPermanent ? 'Delete Permanently' : 'Move to Trash',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        confirmButton: 'gf-btn gf-btn-danger',
        cancelButton: 'gf-btn gf-btn-ghost'
      }
    });

    if (result.isConfirmed) {
      try {
        const res = await formsApi.delete(formId);
        toast.success(res.data?.message || (isPermanent ? 'Form deleted permanently' : 'Form moved to trash'));
        if (res.status === 202) {
          router.push('/');
        } else {
          fetchForms();
        }
      } catch (e) {
        toast.error(e.message || 'Failed to delete form');
      }
    }
  };

  const handleRecover = async (formId) => {
    try {
      await formsApi.recoverForm(formId);
      toast.success('Form recovered successfully');
      fetchForms();
    } catch (e) {
      toast.error(e.message || 'Failed to recover form');
    }
  };

  const toggleFormSelection = (formId) => {
    setSelectedForms(prev => 
      prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedForms.length === 0) return;
    
    const softDelete = user?.softDeleteEnabled === true;
    const isPermanent = viewingTrash || !softDelete;

    const result = await Swal.fire({
      title: isPermanent ? 'Delete Permanently?' : 'Move to Trash?',
      text: `You have selected ${selectedForms.length} forms. ${isPermanent ? 'This action cannot be undone.' : 'They will be moved to the Trash Bin.'}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d93025',
      confirmButtonText: isPermanent ? 'Delete Permanently' : 'Move to Trash',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      try {
        const res = await formsApi.bulkDeleteForms(selectedForms);
        toast.success(res.data?.message || (isPermanent ? 'Forms deleted permanently' : 'Forms moved to trash'));
        if (res.status === 202) {
          router.push('/');
        } else {
          fetchForms();
        }
      } catch (e) {
        toast.error(e.message || 'Failed to delete forms');
      }
    }
  };

  const handleBulkRecover = async () => {
    if (selectedForms.length === 0) return;

    try {
      await formsApi.bulkRecoverForms(selectedForms);
      toast.success('Forms recovered successfully');
      fetchForms();
    } catch (e) {
      toast.error(e.message || 'Failed to recover forms');
    }
  };

  const handleSelectAll = (items) => {
    const itemIds = items.map(f => f.id);
    const allSelected = itemIds.every(id => selectedForms.includes(id));
    
    if (allSelected) {
      // Unselect all in this section
      setSelectedForms(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      // Select all in this section (add missing ones)
      setSelectedForms(prev => [...new Set([...prev, ...itemIds])]);
    }
  };

  const bannerColors = [
    '#673ab7','#4285f4','#0f9d58','#f4b400','#db4437',
    '#00bcd4','#ff5722','#607d8b','#9c27b0','#3f51b5',
  ];

  const draftsFiltered = filtered.filter(f => f.published !== true);
  const pubFiltered = filtered.filter(f => f.published === true);

  // Pagination Logic
  const draftOffset = draftPage * itemsPerPage;
  const currentDrafts = draftsFiltered.slice(draftOffset, draftOffset + itemsPerPage);
  const draftPageCount = Math.ceil(draftsFiltered.length / itemsPerPage);

  const pubOffset = pubPage * itemsPerPage;
  const currentPubs = pubFiltered.slice(pubOffset, pubOffset + itemsPerPage);
  const pubPageCount = Math.ceil(pubFiltered.length / itemsPerPage);

  const handleDraftPageClick = (event) => setDraftPage(event.selected);
  const handlePubPageClick = (event) => setPubPage(event.selected);

  // Reset pagination on search
  useEffect(() => {
    setDraftPage(0);
    setPubPage(0);
  }, [search]);

  const renderFormCard = (form) => {
    const color = bannerColors[form.id % bannerColors.length];
    const isPub = form.published === true;
    
    const cardTopContent = (
      <div 
        onClick={(e) => {
          if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();
            toggleFormSelection(form.id);
          }
        }}
        style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
      >
        <div className="form-card-banner" style={{ background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <span style={{ fontSize: '2rem' }}>📋</span>
          {isPub && <div className="form-card-badge">PUBLISHED</div>}
        </div>
        <div className="form-card-body">
          <div className="form-card-title">{form.name}</div>
          <div className="form-card-meta">
            {form.description || <span style={{ fontStyle: 'italic', color: 'var(--gf-text-placeholder)' }}>No description</span>}
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--gf-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>{form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ''}</span>
              {!isPub && <span style={{ color: 'var(--gf-text-placeholder)' }}>Draft</span>}
            </div>
            {form.createdBy && (
              <div style={{ fontSize: '0.7rem', color: 'var(--gf-text-placeholder)' }}>
                Created by: <span style={{ color: 'var(--gf-text-secondary)', fontWeight: '500' }}>{form.createdBy.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    const isSelected = selectedForms.includes(form.id);

    return (
      <div key={form.id} className={`form-card ${isSelected ? 'selected' : ''}`}>
        {isSelectionMode && (
          <div className="form-card-checkbox">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={() => toggleFormSelection(form.id)}
              onClick={(e) => e.stopPropagation()} // Prevent card click
            />
          </div>
        )}
        {/* Card top: unpublished → edit page, published → responses page (ADMIN ONLY) */}
        {!viewingTrash && user?.role === 'ADMIN' ? (
          !isPub ? (
            <Link href={`/forms/${form.id}/edit`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              {cardTopContent}
            </Link>
          ) : (
            <Link href={`/forms/${form.id}/responses`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              {cardTopContent}
            </Link>
          )
        ) : (
          <div style={{ textDecoration: 'none', color: 'inherit' }}>
            {cardTopContent}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', padding: viewingTrash ? '8px 12px' : '12px' }}>
            {!viewingTrash ? (
              <>
                {(user?.role === 'ADMIN' || user?.permissions?.includes(isPub ? 'EDIT_PUBLISHED_FORM' : 'EDIT_DRAFT_FORM')) && (
                  <Link href={`/forms/${form.id}/edit`} className="gf-btn gf-btn-outline gf-btn-sm" title="Edit Form">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_square</span>
                  </Link>
                )}
                {isPub && (
                  <Link href={`/publish/${form.id}`} target="_blank" className="gf-btn gf-btn-primary gf-btn-sm" style={{ background: '#1a73e8' }} title="View Form">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                  </Link>
                )}
                {/* Responses button — icon only — published cards only */}
                {isPub && (user?.role === 'ADMIN' || user?.permissions?.includes('VIEW_PUBLISHED_SUBMISSIONS')) && (
                  <Link href={`/forms/${form.id}/responses`} className="gf-btn gf-btn-ghost gf-btn-sm" title="Responses">📊</Link>
                )}
                
                {/* Rules Engine button — shown if user can edit */}
                {(user?.role === 'ADMIN' || user?.permissions?.includes(isPub ? 'EDIT_PUBLISHED_FORM' : 'EDIT_DRAFT_FORM')) && (
                  <Link href={`/forms/${form.id}/rules`} className="gf-btn gf-btn-ghost gf-btn-sm" title="Rules Engine">⚙️</Link>
                )}
                
                {isPub ? (
                  <button className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => copyLink(form.id)} title="Copy share link">🔗</button>
                ) : null}
              </>
            ) : (
              (user?.role === 'ADMIN' || user?.permissions?.includes('DELETE_DRAFT_FORM')) && (
                <button 
                  className="gf-btn gf-btn-outline gf-btn-sm" 
                  onClick={() => handleRecover(form.id)}
                  style={{ flex: 1, marginRight: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restore</span>
                  Recover
                </button>
              )
            )}

            {(user?.role === 'ADMIN' || user?.permissions?.includes(isPub ? 'DELETE_PUBLISHED_FORM' : 'DELETE_DRAFT_FORM')) && (
              <button 
                className="gf-btn gf-btn-ghost gf-btn-sm" 
                onClick={() => handleDelete(form.id, form.name)} 
                title={viewingTrash ? "Delete Permanently" : "Delete Form"}
                style={{ color: 'var(--gf-red)', flex: viewingTrash ? '0 0 auto' : 'none' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header-gf">
        <div>
          <h1>{viewingTrash ? 'Form Trash Bin' : 'My Forms'}</h1>
          <p>{viewingTrash ? 'Recover or permanently delete your forms' : 'Create, edit and manage your forms'}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* <button 
            className={`gf-btn ${viewingTrash ? 'gf-btn-primary' : 'gf-btn-outline'}`}
            onClick={() => setViewingTrash(!viewingTrash)}
            style={viewingTrash ? { background: 'var(--gf-red)', borderColor: 'var(--gf-red)' } : {}}
          >
            {viewingTrash ? '← Back to Forms' : '🗑 View Trash'}
          </button> */}
          {!viewingTrash && <Link href="/forms/create" className="gf-btn gf-btn-primary">＋ New Form</Link>}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '30px' }}>
        <input
          style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', border: '1px solid var(--gf-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
          placeholder="🔍 Search forms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="gf-loader"><div className="gf-spinner" /><span>Loading forms...</span></div>
      ) : filtered.length === 0 ? (
        <div className="gf-empty">
          <div className="gf-empty-icon">📋</div>
          <div className="gf-empty-title">{search ? 'No forms match your search' : 'No forms yet'}</div>
          <p style={{ marginBottom: '16px', fontSize: '0.9rem' }}>Create your first form to get started.</p>
          {!search && <Link href="/forms/create" className="gf-btn gf-btn-primary">＋ Create Form</Link>}
        </div>
      ) : (
        <div className="dashboard-sections">
          {/* Published Section */}
          <div className="section-container">
            <h2 className="section-header published-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="section-icon">🚀</span> Published Forms
                <span className="count-badge primary">{pubFiltered.length}</span>
              </div>
              
              {pubFiltered.length > 0 && (
                <button 
                  className={`gf-btn gf-btn-sm ${isSelectionMode ? 'gf-btn-primary' : 'gf-btn-outline'}`}
                  onClick={() => {
                    if (!isSelectionMode) setIsSelectionMode(true);
                    else handleSelectAll(pubFiltered);
                  }}
                  style={isSelectionMode ? { background: 'var(--gf-purple)', color: 'white', borderColor: 'var(--gf-purple)' } : {}}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>
                    {isSelectionMode ? (pubFiltered.every(f => selectedForms.includes(f.id)) ? 'deselect' : 'select_all') : 'check_box'}
                  </span>
                  {!isSelectionMode ? 'Select' : (pubFiltered.every(f => selectedForms.includes(f.id)) ? 'Unselect All' : 'Select All')}
                </button>
              )}
            </h2>
            {currentPubs.length > 0 ? (
              <div className="forms-grid">
                {currentPubs.map(renderFormCard)}
              </div>
            ) : (
              <div className="empty-section-msg">No published forms yet.</div>
            )}
            
            {pubPageCount > 1 && (
              <div className="pagination-wrapper">
                <ReactPaginate
                  breakLabel="..."
                  nextLabel="Next >"
                  onPageChange={handlePubPageClick}
                  pageRangeDisplayed={3}
                  pageCount={pubPageCount}
                  previousLabel="< Prev"
                  renderOnZeroPageCount={null}
                  className="gf-pagination"
                  activeClassName="active"
                />
              </div>
            )}
          </div>

          <div className="gf-divider-thick" />

          {/* Drafts Section */}
          <div className="section-container">
            <h2 className="section-header drafts-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="section-icon">✏️</span> Drafts
                <span className="count-badge grey">{draftsFiltered.length}</span>
              </div>

              {draftsFiltered.length > 0 && (
                <button 
                  className={`gf-btn gf-btn-sm ${isSelectionMode ? 'gf-btn-primary' : 'gf-btn-outline'}`}
                  onClick={() => {
                    if (!isSelectionMode) setIsSelectionMode(true);
                    else handleSelectAll(draftsFiltered);
                  }}
                  style={isSelectionMode ? { background: 'var(--gf-purple)', color: 'white', borderColor: 'var(--gf-purple)' } : {}}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>
                    {isSelectionMode ? (draftsFiltered.every(f => selectedForms.includes(f.id)) ? 'deselect' : 'select_all') : 'check_box'}
                  </span>
                  {!isSelectionMode ? 'Select' : (draftsFiltered.every(f => selectedForms.includes(f.id)) ? 'Unselect All' : 'Select All')}
                </button>
              )}
            </h2>
            {currentDrafts.length > 0 ? (
              <div className="forms-grid">
                {currentDrafts.map(renderFormCard)}
              </div>
            ) : (
              <div className="empty-section-msg">No draft forms.</div>
            )}

            {draftPageCount > 1 && (
              <div className="pagination-wrapper">
                <ReactPaginate
                  breakLabel="..."
                  nextLabel="Next >"
                  onPageChange={handleDraftPageClick}
                  pageRangeDisplayed={3}
                  pageCount={draftPageCount}
                  previousLabel="< Prev"
                  renderOnZeroPageCount={null}
                  className="gf-pagination"
                  activeClassName="active"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedForms.length > 0 && (
        <div className="bulk-action-bar">
          <div className="bulk-action-info">
            <button 
              className="gf-btn gf-btn-ghost gf-btn-sm" 
              onClick={() => {
                setSelectedForms([]);
                setIsSelectionMode(false);
              }} 
              style={{ color: 'white' }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <span>{selectedForms.length} selected</span>
          </div>
          <div className="bulk-actions">
            {viewingTrash ? (
              <>
                <button className="gf-btn gf-btn-secondary gf-btn-sm" onClick={handleBulkRecover}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restore</span>
                  Recover
                </button>
                <button className="gf-btn gf-btn-danger gf-btn-sm" onClick={handleBulkDelete}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                  Delete Permanently
                </button>
              </>
            ) : (
              <button className="gf-btn gf-btn-danger gf-btn-sm" onClick={handleBulkDelete}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                {user?.softDeleteEnabled ? 'Move to Trash' : 'Delete Permanently'}
              </button>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .form-card.selected {
          border: 2px solid var(--gf-purple);
          box-shadow: 0 4px 12px rgba(103, 58, 183, 0.2);
        }
        .form-card-checkbox {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 10;
          background: white;
          border-radius: 4px;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
        }
        .form-card.selected .form-card-checkbox {
          border: 1px solid var(--gf-purple);
        }
        .form-card-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .bulk-action-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #323232;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 1000;
          animation: slideUp 0.3s ease-out;
        }
        .bulk-action-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 500;
          border-right: 1px solid #555;
          padding-right: 24px;
        }
        .bulk-actions {
          display: flex;
          gap: 12px;
        }
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
