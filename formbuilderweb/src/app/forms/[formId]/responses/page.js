'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { formsApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Swal from 'sweetalert2';
import DataTable from 'react-data-table-component';


const FILE_TYPE_MAP = {
  IMAGE: "image/*",
  VIDEO: "video/*",
  PDF: ".pdf,application/pdf",
  EXCEL: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  CSV: ".csv,text/csv",
  DOC: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TEXT: ".txt,text/plain",
  ZIP: ".zip,.rar,.7z,application/zip,application/x-zip-compressed",
};

function validateField(field, value) {
  const val = value === null || value === undefined ? '' : String(value).trim();
  if (field.required && (!val || val === '[]' || val === '')) {
    return `"${field.fieldLabel}" is required`;
  }
  if (!val) return null;

  switch (field.fieldType) {
    case 'NUMBER':
      if (isNaN(Number(val))) return 'Please enter a valid number';
      if (field.minValueStr && Number(val) < Number(field.minValueStr)) return `Value must be ≥ ${field.minValueStr}`;
      if (field.maxValueStr && Number(val) > Number(field.maxValueStr)) return `Value must be ≤ ${field.maxValueStr}`;
      break;
    case 'DATE':
    case 'MONTH':
    case 'WEEK':
    case 'TIME':
    case 'DATE_TIME':
      if (field.minValueStr && val < field.minValueStr) return `Value must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr) return `Value must be on or before ${field.maxValueStr}`;
      break;
    case 'LINEAR_SCALE':
    case 'RATING':
    case 'RANGE':
      const n = Number(val);
      const min = field.minValue ?? 1, max = field.maxValue ?? 5;
      if (isNaN(n) || n < min || n > max) return `Value must be between ${min} and ${max}`;
      break;
    case 'MC_GRID':
    case 'CHECKBOX_GRID': {
      try {
        const gridData = val ? JSON.parse(val) : {};
        const definition = field.options ? JSON.parse(field.options) : { rows: [], columns: [] };
        const rows = definition.rows || [];
        if (field.required) {
          for (const row of rows) {
            const selection = gridData[row];
            if (!selection || (Array.isArray(selection) && selection.length === 0)) return `Row "${row}" is required`;
          }
        }
      } catch (e) { return 'Invalid grid format'; }
      break;
    }
    case 'SHORT_ANSWER':
    case 'TOGGLE':
      if (field.required && (val === '' || val === undefined || val === null)) {
        return `"${field.fieldLabel}" is required`;
      }
      break;
    default: break;
  }
  return null;
}

function FieldRenderer({ field, value, onChange, error, formId }) {
  const options = field.options ? JSON.parse(field.options) : [];
  const inputClass = `fill-input${error ? ' error' : ''}`;

  switch (field.fieldType) {
    case 'SHORT_ANSWER':
    case 'PHONE':
    case 'EMAIL':
    case 'URL':
    case 'SEARCH':
    case 'PASSWORD':
      return <input className={inputClass} type={field.fieldType === 'PASSWORD' ? 'password' : 'text'} value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'PARAGRAPH':
      return <textarea className="fill-textarea" value={value || ''} onChange={e => onChange(e.target.value)} rows={3} />;
    case 'NUMBER':
      return <input className={inputClass} type="number" value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'DATE':
      return <input className={inputClass} type="date" value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'TIME':
      return <input className={inputClass} type="time" value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'MULTIPLE_CHOICE':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {options.map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
              <input type="radio" checked={value === opt} onChange={() => onChange(opt)} /> {opt}
            </label>
          ))}
        </div>
      );
    case 'DROPDOWN': {
      const [dynamicOptions, setDynamicOptions] = useState([]);
      const [loadingOpts, setLoadingOpts] = useState(!!(field.dataSourceTable && field.dataSourceColumn));

      useEffect(() => {
        if (field.dataSourceTable && field.dataSourceColumn) {
          const targetFormId = formId || field.versionId || field.version?.id || field.formId;
          formsApi.getDynamicOptions(targetFormId, field.fieldKey)
            .then(res => setDynamicOptions(res.data || []))
            .catch(err => console.error("Failed to fetch dynamic options:", err))
            .finally(() => setLoadingOpts(false));
        }
      }, [field.dataSourceTable, field.dataSourceColumn, field.fieldKey, formId]);

      const displayOptions = (field.dataSourceTable && field.dataSourceColumn) ? dynamicOptions : options;

      return (
        <select className="fill-select" value={value || ''} onChange={e => onChange(e.target.value)} disabled={loadingOpts}>
          <option value="">{loadingOpts ? 'Loading options...' : 'Choose'}</option>
          {displayOptions.map(opt => {
            const isObj = typeof opt === 'object' && opt !== null;
            const val = isObj ? String(opt.id) : opt;
            const label = isObj ? opt.label : opt;
            return <option key={val} value={val}>{label}</option>;
          })}
        </select>
      );
    }
    case 'LINEAR_SCALE':
    case 'RATING': {
      const min = field.minValue ?? 1, max = field.maxValue ?? 5;
      const vals = Array.from({ length: max - min + 1 }, (_, i) => i + min);
      if (field.fieldType === 'RATING') {
        return (
          <div className="fill-rating-container">
            {vals.map(n => (
              <button
                key={n}
                type="button"
                className={`fill-rating-star ${Number(value) >= n ? 'active' : ''}`}
                onClick={() => onChange(String(n))}
                aria-label={`Rate ${n} out of ${max}`}
              >
                <span className="material-symbols-outlined">star_rate</span>
              </button>
            ))}
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {vals.map(n => (
            <button key={n} type="button" 
              className={`gf-btn gf-btn-sm ${value == n ? 'gf-btn-primary' : 'gf-btn-outline'}`}
              onClick={() => onChange(String(n))}>
              {n}
            </button>
          ))}
        </div>
      );

    }
    case 'MC_GRID':
    case 'CHECKBOX_GRID': {
      const definition = field.options ? JSON.parse(field.options) : { rows: [], columns: [] };
      const rows = definition.rows || ['Row 1'];
      const cols = definition.columns || ['Column 1'];
      const gridData = value ? JSON.parse(value) : {};
      const handleGridChange = (row, col) => {
        const newData = { ...gridData };
        if (field.fieldType === 'MC_GRID') newData[row] = col;
        else {
          const current = newData[row] || [];
          newData[row] = current.includes(col) ? current.filter(c => c !== col) : [...current, col];
        }
        onChange(JSON.stringify(newData));
      };
      return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--gf-border)', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead><tr><th></th>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--gf-border)' }}>{r}</td>
                  {cols.map(c => (
                    <td key={c} style={{ textAlign: 'center', borderBottom: '1px solid var(--gf-border)' }}>
                      <input type={field.fieldType === 'MC_GRID' ? 'radio' : 'checkbox'} name={`${field.id}-${r}`}
                        checked={field.fieldType === 'MC_GRID' ? gridData[r] === c : (gridData[r] || []).includes(c)}
                        onChange={() => handleGridChange(r, c)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'FILE': {
      const [uploading, setUploading] = useState(false);
      const getInitialName = () => {
        if (!value) return '';
        const parts = value.split('|');
        return parts[0];
      };
      const [fileName, setFileName] = useState(getInitialName());

      const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation against allowed types
        if (field.allowedFileTypes) {
          const allowedCats = field.allowedFileTypes.split(',');
          let isAllowed = false;
          const fName = file.name.toLowerCase();
          const mimeType = file.type.toLowerCase();

          for (const cat of allowedCats) {
            const acceptStr = FILE_TYPE_MAP[cat];
            if (!acceptStr) continue;

            const accepted = acceptStr.split(',');
            if (accepted.some(a => {
              if (a.startsWith('.')) return fName.endsWith(a);
              if (a.endsWith('/*')) return mimeType.startsWith(a.replace('/*', ''));
              return mimeType === a;
            })) {
              isAllowed = true;
              break;
            }
          }

          if (!isAllowed) {
            alert(`File type not allowed. Please upload: ${allowedCats.join(', ')}`);
            e.target.value = '';
            return;
          }
        }

        setUploading(true);
        try {
          const res = await formsApi.uploadFile(file);
          const savedName = res.data.fileName;
          const originalName = file.name;
          const storageValue = `${originalName}|${savedName}`;
          setFileName(originalName);
          onChange(storageValue);
        } catch (err) {
          console.error("Upload failed:", err);
          alert("File upload failed.");
        } finally {
          setUploading(false);
        }
      };

      let acceptAttr = "";
      if (field.allowedFileTypes) {
        acceptAttr = field.allowedFileTypes.split(',')
          .map(cat => FILE_TYPE_MAP[cat])
          .filter(Boolean)
          .join(',');
      }

      return (
        <div className="file-upload-field">
          <input className={inputClass} type="file" onChange={handleFileChange} disabled={uploading} accept={acceptAttr} />
          {uploading && <div style={{ fontSize: '0.75rem', color: 'var(--gf-purple)', marginTop: '4px' }}>⏳ Uploading...</div>}
          {!uploading && fileName && (
            <div style={{ fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--gf-green)' }}>✅ {fileName}</span>
              {value && value.includes('|') && (
                <a 
                  href={formsApi.getDownloadUrl(value.split('|')[1], value.split('|')[0])} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'var(--gf-purple)', textDecoration: 'underline', fontSize: '0.7rem' }}
                >
                  Download
                </a>
              )}
            </div>
          )}
        </div>
      );
    }
    case 'TOGGLE':
      return (
        <label className="required-toggle" style={{ display: 'block' }}>
          <input 
            type="checkbox" 
            checked={value === 'true' || value === true}
            onChange={e => onChange(e.target.checked ? 'true' : 'false')}
          />
          <span className="required-toggle-slider"></span>
        </label>
      );
    default:
      return <input className={inputClass} type="text" value={value || ''} onChange={e => onChange(e.target.value)} />;
  }
}

export default function ResponsesPage({ params }) {
  const { formId } = use(params);
  const { toast, user } = useApp();
  const [form, setForm]         = useState(null);
  const [responses, setResponses] = useState([]);
  const [fields, setFields]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [viewingTrash, setViewingTrash] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState(null);
  const [modalAnswers, setModalAnswers] = useState({});
  const [modalErrors, setModalErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [toggleCleared, setToggleCleared] = useState(false);


  const fetchData = (vId) => {
    setLoading(true);
    const versionToFetch = vId || selectedVersionId;
    const apiCalls = [
      formsApi.getById(formId),
      viewingTrash ? formsApi.getTrashSubmissions(formId) : (versionToFetch ? formsApi.getVersionSubmissions(versionToFetch) : formsApi.getResponses(formId)),
      formsApi.getPublished(formId),
    ];

    Promise.all(apiCalls).then(([fRes, rRes, pubRes]) => {
      setForm(fRes.data);
      setResponses(Array.isArray(rRes.data) ? rRes.data : []);
      // If we fetched a specific version, use its fields. If not, use current published ones.
      if (versionToFetch) {
        formsApi.getVersionFields(versionToFetch).then(vfRes => {
           setFields(Array.isArray(vfRes.data) ? vfRes.data : []);
        });
      } else {
        setFields(Array.isArray(pubRes.data.fields) ? pubRes.data.fields : []);
      }
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Fetch versions once
    formsApi.getVersions(formId).then(res => {
      setVersions(res.data || []);
      const active = res.data?.find(v => v.active);
      if (active) setSelectedVersionId(active.id);
    });
  }, [formId]);

  useEffect(() => {
    fetchData();
  }, [formId, viewingTrash, selectedVersionId]);

  const copyLink = () => {
    const url = `${window.location.origin}/publish/${formId}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  const exportCsv = async (dataToExport) => {
    try {
      const ids = dataToExport ? dataToExport.map(r => r.id) : null;
      toast.info(ids ? `Preparing export for ${ids.length} responses...` : "Preparing export...");
      
      const res = await formsApi.exportResponses(formId, ids);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${form?.name || 'responses'}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Export successful!");
      
      if (dataToExport) {
        setToggleCleared(!toggleCleared);
        setSelectedRows([]);
      }
    } catch (e) {
      toast.error("Export failed: " + (e.message || "Unknown error"));
    }
  };





  const openAddModal = () => {
    setEditingResponse(null);
    setModalAnswers({});
    setModalErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (resp) => {
    setEditingResponse(resp);
    const answers = {};
    fields.forEach(f => {
      const rawKey = `${f.fieldKey}_raw`;
      answers[f.fieldKey] = resp[rawKey] !== undefined ? resp[rawKey] : (resp[f.fieldKey] ?? '');
    });
    setModalAnswers(answers);
    setModalErrors({});
    setIsModalOpen(true);
  };

  const handleSaveResponse = async () => {
    // Validation
    const newErrors = {};
    fields.forEach(f => {
      const err = validateField(f, modalAnswers[f.fieldKey]);
      if (err) newErrors[f.fieldKey] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setModalErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      if (editingResponse) {
        await formsApi.updateResponse(formId, editingResponse.id, modalAnswers);
        toast.success("Response updated");
      } else {
        await formsApi.submit(formId, modalAnswers);
        toast.success("Response added");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResponse = async (respId) => {
    const softDeleteEnabled = user?.softDeleteEnabled === true;
    const isPermanent = viewingTrash || !softDeleteEnabled;

    const result = await Swal.fire({
      title: "Delete Permanently?",
      text: "This response will be permanently removed. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete Permanently",
    });

    if (result.isConfirmed) {
      try {
        await formsApi.deleteResponse(formId, respId);
        toast.success("Response deleted permanently");
        fetchData();
      } catch (e) {
        toast.error(e.message || "Delete failed");
      }
    }
  };

  const handleRecoverResponse = async (respId) => {
    try {
      await formsApi.recoverSubmission(formId, respId);
      toast.success("Response recovered");
      fetchData();
    } catch (e) {
      toast.error(e.message || "Failed to recover");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;

    const softDeleteEnabled = user?.softDeleteEnabled === true;
    const isPermanent = viewingTrash || !softDeleteEnabled;

    const res = await Swal.fire({
      title: 'Delete Permanently?',
      text: `You have selected ${selectedRows.length} responses. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete Permanently'
    });

    if (res.isConfirmed) {
      try {
        const ids = selectedRows.map(r => r.id);
        await formsApi.bulkDeleteResponses(formId, ids);
        toast.success("Responses permanently deleted");
        setToggleCleared(!toggleCleared);
        setSelectedRows([]);
        fetchData();
      } catch (e) {
        toast.error(e.message || "Failed to delete responses");
      }
    }
  };

  const handleBulkRecover = async () => {
    if (selectedRows.length === 0) return;

    try {
      const ids = selectedRows.map(r => r.id);
      await formsApi.bulkRecoverResponses(formId, ids);
      toast.success("Responses recovered");
      setToggleCleared(!toggleCleared);
      setSelectedRows([]);
      fetchData();
    } catch (e) {
      toast.error(e.message || "Failed to recover responses");
    }
  };

  const displayVal = (field, row) => {
    const val = row[field.fieldKey];
    if (val == null || val === '') return <span style={{ color: 'var(--gf-text-placeholder)', fontStyle: 'italic' }}>—</span>;
    if (field.fieldType === 'CHECKBOXES') {
      try {
        const arr = JSON.parse(val);
        return arr.join(', ');
      } catch { return val; }
    }
    if (field.fieldType === 'FILE') {
      const parts = val.split('|');
      const originalName = parts[0];
      const savedName = parts.length > 1 ? parts[1] : parts[0];
      
      const handleDownload = async (e) => {
        e.preventDefault();
        try {
          const url = formsApi.getDownloadUrl(savedName, originalName);
          const response = await fetch(url);
          if (!response.ok) throw new Error('Download failed: ' + response.status);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = originalName; // Force the original filename
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } catch (err) {
          alert('Download failed. Please try again.\nError: ' + err.message);
          console.error(err);
        }
      };
      
      return (
        <a 
          href="#"
          onClick={handleDownload}
          style={{ color: 'var(--gf-purple)', textDecoration: 'underline', cursor: 'pointer' }}
          title={`Download ${originalName}`}
        >
          📄 {originalName}
        </a>
      );
    }
    if (field.fieldType === 'RATING') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#ffc107', fontVariationSettings: "'FILL' 1" }}>star_rate</span>
          <span>{val}</span>
        </div>
      );
    }
    if (field.fieldType === 'MC_GRID' || field.fieldType === 'CHECKBOX_GRID') {
      try {
        const gridData = JSON.parse(val);
        return Object.entries(gridData).map(([row, col]) => `${row}: ${Array.isArray(col) ? col.join(', ') : col}`).join(' | ');
      } catch { return val; }
    }
    if (typeof val === 'boolean') return String(val);
    return val;
  };

  const [filterText, setFilterText] = useState('');

  // Find columns in responses that are NOT in the 'fields' list (and not 'id' or 'submitted_at')
  const existingFieldKeys = new Set(fields.map(f => f.fieldKey));
  const extraColumnKeys = new Set();
  
  responses.forEach(resp => {
    Object.keys(resp).forEach(key => {
      // Exclude metadata, form info, and internal '_raw' columns (used for dynamic dropdown selection)
      if (key !== 'id' && key !== 'submitted_at' && key !== 'name' && key !== 'description' && !key.endsWith('_raw') && !existingFieldKeys.has(key)) {
        extraColumnKeys.add(key);
      }
    });
  });

  const columns = [
    {
      name: 'Submitted At',
      selector: row => row.submitted_at,
      sortable: true,
      cell: row => row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—',
      width: '180px',
    },
    ...fields
      .filter(f => f.fieldType !== 'HEADING')
      .map(f => ({
        name: f.fieldLabel || f.fieldKey,
        selector: row => row[f.fieldKey],
        sortable: true,
        cell: row => displayVal(f, row),
        wrap: true,
      })),
    // Extra columns (deleted/abandoned)
    ...Array.from(extraColumnKeys).map(key => ({
      name: key, // Use raw key as label since field def is gone
      selector: row => row[key],
      sortable: true,
      cell: row => {
        const val = row[key];
        if (val == null || val === '') return <span style={{ color: 'var(--gf-text-placeholder)', fontStyle: 'italic' }}>—</span>;
        return String(val);
      },
      wrap: true,
      style: { color: 'var(--gf-text-secondary)' }
    })),
    {
      name: 'Actions',
      cell: row => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', width: '100%' }}>
          {!viewingTrash ? (
            <>
              <button className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => openEditModal(row)} title="Edit">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_square</span>
              </button>
              <button className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => handleDeleteResponse(row.id)} title="Delete" style={{ color: 'var(--gf-red)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
            </>
          ) : (
            <>
              <button className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => handleRecoverResponse(row.id)} title="Recover" style={{ color: 'var(--gf-green)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings_backup_restore</span>
              </button>
              <button className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => handleDeleteResponse(row.id)} title="Delete Permanently" style={{ color: 'var(--gf-red)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete_forever</span>
              </button>
            </>
          )}
        </div>
      ),
      width: '120px',
    }
  ];

  const filteredResponses = responses.filter(item => {
    if (!filterText) return true;
    const lowerFilter = filterText.toLowerCase();
    // Search in submitted date
    if (item.submitted_at && new Date(item.submitted_at).toLocaleString().toLowerCase().includes(lowerFilter)) return true;
    // Search in all form fields
    return fields.some(f => {
      const val = item[f.fieldKey];
      return val && String(val).toLowerCase().includes(lowerFilter);
    });
  });

  const customStyles = {
    header: {
      style: {
        minHeight: '56px',
        backgroundColor: 'var(--gf-surface)',
        color: 'var(--gf-text)',
      },
    },
    headRow: {
      style: {
        backgroundColor: 'var(--gf-surface)',
        borderBottom: 'none',
      },
    },
    headCells: {
      style: {
        fontWeight: '600',
        color: 'var(--gf-text)',
        fontSize: '0.85rem',
      },
    },
    cells: {
      style: {
        fontSize: '0.85rem',
        padding: '12px 16px',
        color: 'var(--gf-text-secondary)',
        backgroundColor: 'var(--gf-bg)',
      },
    },
    pagination: {
      style: {
        backgroundColor: 'var(--gf-surface)',
        color: 'var(--gf-text)',
        borderTop: 'none',
      },
      pageButtonsStyle: {
        fill: 'var(--gf-text)',
        '&:disabled': {
          fill: 'var(--gf-text-placeholder)',
        },
        '&:hover:not(:disabled)': {
          backgroundColor: 'var(--gf-bg)',
        },
      },
    },
    noData: {
      style: {
        backgroundColor: 'var(--gf-bg)',
        color: 'var(--gf-text-secondary)',
      },
    },
    progress: {
      style: {
        backgroundColor: 'var(--gf-bg)',
        color: 'var(--gf-purple)',
      },
    },
    contextMenu: {
      style: {
        backgroundColor: 'var(--gf-bg)',
        color: 'var(--gf-text)',
        padding: '0 16px',
        borderBottom: 'none',
      },
      activeContextStyle: {
        color: 'var(--gf-text)',
        backgroundColor: 'var(--gf-bg)',
      },
    },
    subHeader: {
      style: {
        backgroundColor: 'var(--gf-bg)',
        padding: '16px 20px',
        borderBottom: 'none',
      },
    },
  };

  return (
    <div>
      <div className="page-header-gf">
        <div>
          <Link href="/forms" className="gf-btn gf-btn-ghost gf-btn-sm" style={{ marginBottom: '6px' }}>← Back to Dashboard</Link>
          <h1 style={{ marginTop: '4px' }}>{form?.name} — Responses</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
{/* <button 
            className={`gf-btn ${viewingTrash ? 'gf-btn-primary' : 'gf-btn-outline'}`} 
            onClick={() => setViewingTrash(!viewingTrash)}
            style={viewingTrash ? { background: 'var(--gf-text-secondary)' } : {}}
          >
            {viewingTrash ? '📄 View Responses' : '🗑️ View Trash'}
          </button> */}
          {!viewingTrash && <button className="gf-btn gf-btn-primary" onClick={openAddModal}>＋ Add Response</button>}
          <button className="gf-btn gf-btn-outline" onClick={() => exportCsv()}>📥 Export All (CSV)</button>
          <button className="gf-btn gf-btn-outline" onClick={copyLink}>🔗 Copy Form Link</button>
        </div>

      </div>

      <div className="gf-version-filter-card">
        <div className="gf-version-filter-header">
          <div className="gf-version-filter-title">
            <span className="material-symbols-outlined">history</span>
            <span>Version History</span>
          </div>
          <div className="gf-version-filter-controls">
            <select 
              className="gf-select-premium" 
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              <option value="">Latest Published (All Versions)</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  Version {v.versionNumber} {v.active ? '• Active' : ''} ({v.status})
                </option>
              ))}
            </select>
            {selectedVersionId && (
              <div className="gf-version-badge-info">
                <span className="gf-dot"></span>
                Showing Version {versions.find(v => v.id === selectedVersionId)?.versionNumber}
              </div>
            )}
          </div>
        </div>
        {selectedVersionId && (
           <p className="gf-version-filter-desc">
             You are currently viewing submissions made specifically for <strong>Version {versions.find(v => v.id === selectedVersionId)?.versionNumber}</strong>. 
             Field columns have been adjusted to match this version's schema.
           </p>
        )}
      </div>

      <style jsx>{`
        .gf-version-filter-card {
          background: var(--gf-surface);
          border: 1px solid var(--gf-border);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }
        .gf-version-filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .gf-version-filter-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: var(--gf-text);
          font-size: 1rem;
        }
        .gf-version-filter-title .material-symbols-outlined {
          color: var(--gf-purple);
          font-size: 22px;
        }
        .gf-version-filter-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .gf-select-premium {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--gf-border);
          background: var(--gf-bg);
          color: var(--gf-text);
          font-size: 0.9rem;
          min-width: 260px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
        }
        .gf-select-premium:focus {
          border-color: var(--gf-purple);
        }
        .gf-version-badge-info {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f0fdf4;
          color: #166534;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid #bbf7d0;
        }
        .gf-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
        }
        .gf-version-filter-desc {
          margin-top: 12px;
          font-size: 0.85rem;
          color: var(--gf-text-secondary);
          line-height: 1.5;
          padding-top: 12px;
          border-top: 1px solid var(--gf-border-light);
        }
      `}</style>

      {/* Stats */}
      <div className="responses-stats">
        <div className="responses-stat-card">
          <div className="responses-stat-number">{responses.length}</div>
          <div className="responses-stat-label">Total responses</div>
        </div>
        {responses.length > 0 && (
          <div className="responses-stat-card">
            <div className="responses-stat-number">{fields.length}</div>
            <div className="responses-stat-label">Questions</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="gf-loader"><div className="gf-spinner" /><span>Loading responses...</span></div>
      ) : error ? (
        <div className="gf-alert-error">{error === 'This form is not published'
          ? <>This form is not published yet. <Link href={`/forms/${formId}/edit`} style={{ color: 'var(--gf-purple)' }}>Publish it</Link> to collect responses.</>
          : error}
        </div>
      ) : responses.length === 0 ? (
        <div className="gf-card">
          <div className="gf-empty">
            <div className="gf-empty-icon">{viewingTrash ? '🗑️' : '📊'}</div>
            <div className="gf-empty-title">{viewingTrash ? 'Trash is empty' : 'No responses yet'}</div>
            <p style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
              {viewingTrash ? 'Responses you delete will appear here.' : 'Share the form link to start collecting data.'}
            </p>
            {!viewingTrash && <button className="gf-btn gf-btn-primary" onClick={copyLink}>🔗 Copy Share Link</button>}
          </div>
        </div>
      ) : (
        <div className="gf-card">

          <DataTable
            columns={columns}
            data={filteredResponses}
            pagination
            paginationPerPage={10}
            paginationRowsPerPageOptions={[10, 25, 50, 100]}
            customStyles={customStyles}
            highlightOnHover
            noDataComponent={<div style={{ padding: '24px' }}>No matching responses found</div>}
            selectableRows
            onSelectedRowsChange={({ selectedRows }) => setSelectedRows(selectedRows)}
            clearSelectedRows={toggleCleared}
            actions={
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="gf-btn gf-btn-outline gf-btn-sm" 
                  onClick={() => exportCsv()} 
                  title="Export to CSV"
                  style={{ padding: '6px 12px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>csv</span>
                  CSV Export
                </button>
              </div>
            }
            contextActions={
              <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
                <button 
                  className="gf-btn gf-btn-outline gf-btn-sm" 
                  onClick={() => exportCsv(selectedRows)}
                  style={{ border: '1.5px solid var(--gf-green)', color: 'var(--gf-green)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>csv</span>
                  CSV ({selectedRows.length})
                </button>
                {viewingTrash ? (
                  <>
                    <button 
                      className="gf-btn gf-btn-secondary gf-btn-sm" 
                      onClick={handleBulkRecover}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>restore</span>
                      Recover ({selectedRows.length})
                    </button>
                    <button 
                      className="gf-btn gf-btn-danger gf-btn-sm" 
                      onClick={handleBulkDelete}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>delete_forever</span>
                      Delete ({selectedRows.length})
                    </button>
                  </>
                ) : (
                  <button 
                    className="gf-btn gf-btn-danger gf-btn-sm" 
                    onClick={handleBulkDelete}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>delete</span>
                    Delete ({selectedRows.length})
                  </button>
                )}
              </div>
            }
            subHeader
            subHeaderComponent={
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div className="search-box">
                  <input 
                    type="text" 
                    placeholder="Search responses..." 
                    value={filterText} 
                    onChange={e => setFilterText(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--gf-border)',
                      fontSize: '0.85rem',
                      width: '300px',
                      outline: 'none',
                      background: 'var(--gf-surface)',
                      color: 'var(--gf-text)',
                    }}
                  />
                </div>
              </div>
            }

          />

        </div>
      )}


      {/* Manual Entry/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <div>
                <h3>{editingResponse ? 'Edit Response' : 'Add New Response'}</h3>
                <p>{editingResponse ? 'Modify the submitted data' : 'Manually record a new response'}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ background: 'var(--gf-bg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {fields.filter(f => f.fieldType !== 'HEADING').map(field => (
                  <div key={field.id} className="gf-card" style={{ padding: '16px', border: modalErrors[field.fieldKey] ? '1px solid var(--gf-red)' : '1px solid var(--gf-border)' }}>
                    <div style={{ fontWeight: 500, marginBottom: '8px', fontSize: '0.9rem' }}>
                      {field.fieldLabel} {field.required && <span style={{ color: 'var(--gf-red)' }}>*</span>}
                    </div>
                    <FieldRenderer 
                      field={field} 
                      value={modalAnswers[field.fieldKey]} 
                      onChange={val => {
                        setModalAnswers(a => ({ ...a, [field.fieldKey]: val }));
                        setModalErrors(e => ({ ...e, [field.fieldKey]: null }));
                      }}
                      error={!!modalErrors[field.fieldKey]}
                      formId={formId}
                    />
                    {modalErrors[field.fieldKey] && (
                      <div style={{ color: 'var(--gf-red)', fontSize: '0.75rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                        {modalErrors[field.fieldKey]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="gf-btn gf-btn-ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="gf-btn gf-btn-primary" onClick={handleSaveResponse} disabled={saving}>
                {saving ? 'Saving...' : editingResponse ? 'Update Response' : 'Create Response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
