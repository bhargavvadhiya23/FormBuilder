'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formsApi, rulesApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Link from 'next/link';

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
  if (!val) return null; // optional and empty is fine

  switch (field.fieldType) {
    case 'NUMBER':
      if (isNaN(Number(val)))
        return 'Please enter a valid number';
      if (field.minValueStr && Number(val) < Number(field.minValueStr))
        return `Value must be ≥ ${field.minValueStr}`;
      if (field.maxValueStr && Number(val) > Number(field.maxValueStr))
        return `Value must be ≤ ${field.maxValueStr}`;
      break;
    case 'DATE':
    case 'MONTH':
      if (!val || val.length < 4)
        return 'Please enter a valid date';
      if (field.minValueStr && val < field.minValueStr)
        return `Date must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr)
        return `Date must be on or before ${field.maxValueStr}`;
      break;
    case 'WEEK':
      if (!val || val.length < 4)
        return 'Please enter a valid week';
      if (field.minValueStr && val < field.minValueStr)
        return `Week must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr)
        return `Week must be on or before ${field.maxValueStr}`;
      break;
    case 'TIME':
      if (!val)
        return 'Please select a time';
      if (field.minValueStr && val < field.minValueStr)
        return `Time must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr)
        return `Time must be on or before ${field.maxValueStr}`;
      break;
    case 'DATE_TIME':
      if (!val || val.length < 10)
        return 'Please select both date and time';
      if (field.minValueStr && val < field.minValueStr)
        return `Date/time must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr)
        return `Date/time must be on or before ${field.maxValueStr}`;
      break;
    case 'LINEAR_SCALE':
    case 'RATING':
    case 'RANGE':
      const n = Number(val);
      const min = field.minValue ?? 1, max = field.maxValue ?? 5;
      if (isNaN(n) || n < min || n > max)
        return `Please select a value between ${min} and ${max}`;
      break;
    case 'MC_GRID':
    case 'CHECKBOX_GRID': {
      try {
        const gridData = val ? JSON.parse(val) : {};
        let definition = { rows: [], columns: [] };
        try {
          if (field.options) definition = JSON.parse(field.options);
        } catch(e) {}
        const rows = definition.rows || [];
        
        if (field.required) {
          for (const row of rows) {
            const selection = gridData[row];
            if (!selection || (Array.isArray(selection) && selection.length === 0)) {
              return `Please provide a response for row: "${row}"`;
            }
          }
        }
      } catch (e) {
        return 'Invalid grid data format';
      }
      break;
    }
    case 'SHORT_ANSWER':
    case 'PARAGRAPH':
    case 'PASSWORD':
    case 'SEARCH': {
      // Apply trim (default true) and remove extra spaces (default true) silently
      let cleaned = val;
      if (field.trimWhitespace !== false) cleaned = cleaned.trim();
      if (field.removeExtraSpaces !== false) cleaned = cleaned.replace(/\s+/g, ' ');

      if (cleaned.length > (field.fieldType === 'PARAGRAPH' ? 5000 : 500))
        return `Response is too long (max ${field.fieldType === 'PARAGRAPH' ? 5000 : 500} chars)`;
      if (field.minLength && cleaned.length < field.minLength)
        return `Must be at least ${field.minLength} characters`;
      if (field.maxLength && cleaned.length > field.maxLength)
        return `Must be at most ${field.maxLength} characters`;

      // Character type
      if (field.charType) {
        const patterns = { LETTERS: /^[\p{L} ]*$/u, NUMBERS: /^[\d ]*$/, BOTH: /^[\p{L}\d ]*$/u };
        const labels = { LETTERS: 'letters only', NUMBERS: 'numbers only', BOTH: 'letters and numbers only' };
        if (patterns[field.charType] && !patterns[field.charType].test(cleaned))
          return `Must contain ${labels[field.charType] || field.charType}`;
      }

      // Special characters
      if (field.allowSpecialChars === false && /[^\w\s]/.test(cleaned))
        return 'Special characters are not allowed';

      // Custom regex
      if (field.customRegex) {
        try {
          if (!new RegExp(field.customRegex).test(cleaned))
            return `Does not match the required pattern. Note: your regex must align with your other settings (e.g. if "Letters only" is set, don't allow digits in your regex).`;
        } catch { /* invalid regex — backend will catch it */ }
      }
      break;
    }
    case 'EMAIL':
    case 'PHONE':
    case 'URL': {
      // Basic text validation for these types
      let cleaned = val;
      if (field.trimWhitespace !== false) cleaned = cleaned.trim();
      if (field.removeExtraSpaces !== false) cleaned = cleaned.replace(/\s+/g, ' ');

      if (field.minLength && cleaned.length < field.minLength)
        return `Must be at least ${field.minLength} characters`;
      if (field.maxLength && cleaned.length > field.maxLength)
        return `Must be at most ${field.maxLength} characters`;

      // Custom regex
      if (field.customRegex) {
        try {
          if (!new RegExp(field.customRegex).test(cleaned))
            return `Does not match the required pattern. Note: your regex must align with your other settings.`;
        } catch { /* invalid regex — backend will catch it */ }
      }

      // Then fall through to built-in format checks
      if (field.fieldType === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned))
        return 'Please enter a valid email address';
      if (field.fieldType === 'PHONE' && !/^\d+$/.test(cleaned))
        return 'Please enter a valid phone number (digits only)';
      if (field.fieldType === 'URL') {
        try { new URL(cleaned); } catch { return 'Please enter a valid URL (include https://)'; }
      }
      break;
    }
    case 'TOGGLE':
      // Toggle is always either true or false (string "true"/"false")
      // If required, we might want it to be "true", but usually toggle required means "must interact"?
      // Actually for boolean toggle, required usually doesn't make sense unless it's a "I agree" checkbox.
      // But let's follow the standard "required" which means "not empty".
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
      return <input className={inputClass} type="text" placeholder={field.customPlaceholder || "Your answer"} value={value || ''}
        onChange={e => onChange(e.target.value)} maxLength={500} />;
    case 'PHONE':
      return <input className={inputClass} type="text" placeholder={field.customPlaceholder || "Digits only"} value={value || ''}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))} maxLength={20} />;
    case 'PARAGRAPH':
      return <textarea className="fill-textarea" placeholder={field.customPlaceholder || "Your answer"} value={value || ''}
        onChange={e => onChange(e.target.value)} maxLength={5000} rows={3} />;
    case 'EMAIL':
      return <input className={inputClass} type="email" placeholder={field.customPlaceholder || "example@email.com"} value={value || ''}
        onChange={e => onChange(e.target.value)} />;
    case 'NUMBER':
      return <input className={inputClass} type="number" placeholder={field.customPlaceholder || "0"} value={value || ''}
        min={field.minValueStr || undefined}
        max={field.maxValueStr || undefined}
        onChange={e => onChange(e.target.value)} />;
    case 'URL':
      return <input className={inputClass} type="url" placeholder={field.customPlaceholder || "https://example.com"} value={value || ''}
        onChange={e => onChange(e.target.value)} />;
    case 'DATE':
      return <input className={inputClass} type="date" value={value || ''}
        min={field.minValueStr || undefined}
        max={field.maxValueStr || undefined}
        onChange={e => onChange(e.target.value)} />;
    case 'TIME':
      return <input className={inputClass} type="time" value={value || ''}
        min={field.minValueStr || undefined}
        max={field.maxValueStr || undefined}
        onChange={e => onChange(e.target.value)} />;
    case 'DATE_TIME':
      return <input className={inputClass} type="datetime-local" value={value || ''}
        min={field.minValueStr || undefined}
        max={field.maxValueStr || undefined}
        onChange={e => onChange(e.target.value)} />;
    case 'MONTH':
      return <input className={inputClass} type="month" value={value || ''}
        min={field.minValueStr || undefined}
        max={field.maxValueStr || undefined}
        onChange={e => onChange(e.target.value)} />;
    case 'WEEK':
      return <input className={inputClass} type="week" value={value || ''}
        min={field.minValueStr || undefined}
        max={field.maxValueStr || undefined}
        onChange={e => onChange(e.target.value)} />;
    case 'PASSWORD':
      return <input className={inputClass} type="password" placeholder="••••••••" value={value || ''}
        onChange={e => onChange(e.target.value)} />;
    case 'COLOR':
      return <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} style={{ width: '50px', height: '40px', border: 'none', padding: 0 }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--gf-text-secondary)' }}>{value || '#000000'}</span>
      </div>;
    case 'FILE': {
      const [uploading, setUploading] = useState(false);
      
      // Parse initial fileName from value (which is "originalName|savedName")
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
          const fileName = file.name.toLowerCase();
          const mimeType = file.type.toLowerCase();

          for (const cat of allowedCats) {
            const acceptStr = FILE_TYPE_MAP[cat];
            if (!acceptStr) continue;

            const accepted = acceptStr.split(',');
            if (accepted.some(a => {
              if (a.startsWith('.')) return fileName.endsWith(a);
              if (a.endsWith('/*')) return mimeType.startsWith(a.replace('/*', ''));
              return mimeType === a;
            })) {
              isAllowed = true;
              break;
            }
          }

          if (!isAllowed) {
            alert(`File type not allowed. Please upload: ${allowedCats.join(', ')}`);
            e.target.value = ''; // clear input
            return;
          }
        }

        setUploading(true);
        try {
          const res = await formsApi.uploadFile(file);
          const savedName = res.data.fileName;
          const originalName = file.name;
          const storageValue = `${originalName}|${savedName}`;
          
          setFileName(originalName); // Show original name in UI
          onChange(storageValue);
        } catch (err) {
          console.error("Upload failed:", err);
          alert("File upload failed. Please try again.");
        } finally {
          setUploading(false);
        }
      };

      // Construct 'accept' attribute
      let acceptAttr = "";
      if (field.allowedFileTypes) {
        acceptAttr = field.allowedFileTypes.split(',')
          .map(cat => FILE_TYPE_MAP[cat])
          .filter(Boolean)
          .join(',');
      }

      return (
        <div className="file-upload-field">
          <input 
            className={inputClass} 
            type="file" 
            onChange={handleFileChange} 
            disabled={uploading}
            accept={acceptAttr}
          />
          {uploading && <div style={{ fontSize: '0.8rem', color: 'var(--gf-purple)', marginTop: '4px' }}>⏳ Uploading file...</div>}
          {!uploading && fileName && (
            <div style={{ fontSize: '0.8rem', color: 'var(--gf-green)', marginTop: '4px' }}>
              ✅ File uploaded: {fileName}
            </div>
          )}
        </div>
      );
    }
    case 'SEARCH':
      return <input className={inputClass} type="search" placeholder="Search..." value={value || ''}
        onChange={e => onChange(e.target.value)} />;
    case 'RANGE':
      return (
        <div style={{ width: '100%' }}>
          <input type="range" 
            min={field.minValue ?? 0} 
            max={field.maxValue ?? 100} 
            value={value || field.minValue || 0}
            onChange={e => onChange(e.target.value)}
            style={{ width: '100%', accentColor: 'var(--gf-purple)' }} 
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--gf-text-secondary)' }}>
            <span>{field.minValue ?? 0}</span>
            <span style={{ fontWeight: '500', color: 'var(--gf-purple)' }}>Value: {value || field.minValue || 0}</span>
            <span>{field.maxValue ?? 100}</span>
          </div>
        </div>
      );

    case 'MULTIPLE_CHOICE':
      return (
        <div>
          {options.map(opt => (
            <label key={opt} className="fill-radio-option">
              <input type="radio" name={field.fieldKey} value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                style={{ accentColor: 'var(--gf-purple)' }}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );

    case 'CHECKBOXES': {
      const selected = value ? JSON.parse(value) : [];
      const toggle = (opt) => {
        const arr = selected.includes(opt)
          ? selected.filter(o => o !== opt)
          : [...selected, opt];
        onChange(arr.length ? JSON.stringify(arr) : '');
      };
      return (
        <div>
          {options.map(opt => (
            <label key={opt} className="fill-checkbox-option">
              <input type="checkbox" value={opt}
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                style={{ accentColor: 'var(--gf-purple)' }}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'DROPDOWN': {
      const [dynamicOptions, setDynamicOptions] = useState([]);
      const [loadingOpts, setLoadingOpts] = useState(!!(field.dataSourceTable && field.dataSourceColumn));

      useEffect(() => {
        if (field.dataSourceTable && field.dataSourceColumn) {
          const targetFormId = formId || field.versionId || field.version?.id || field.formId;
          formsApi.getPublicDynamicOptions(targetFormId, field.fieldKey)
            .then(res => setDynamicOptions(res.data || []))
            .catch(err => console.error("Failed to fetch dynamic options:", err))
            .finally(() => setLoadingOpts(false));
        }
      }, [field.dataSourceTable, field.dataSourceColumn, field.fieldKey, formId]);

      const displayOptions = (field.dataSourceTable && field.dataSourceColumn) ? dynamicOptions : options;

      return (
        <select className="fill-select" value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={loadingOpts}>
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
            <span style={{ marginLeft: '12px', fontSize: '0.9rem', color: 'var(--gf-text-secondary)' }}>
              {value ? `${value} / ${max}` : ''}
            </span>
          </div>
        );
      }

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--gf-text-secondary)', marginBottom: '8px' }}>
            <span>{field.minLabel}</span><span>{field.maxLabel}</span>
          </div>
          <div className="fill-scale-row">
            {vals.map(n => (
              <div key={n} className="fill-scale-item">
                <button type="button"
                  className={`fill-scale-btn${value == n ? ' selected' : ''}`}
                  onClick={() => onChange(String(n))}>
                  {n}
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'MC_GRID':
    case 'CHECKBOX_GRID': {
      let definition = { rows: ['Row 1'], columns: ['Column 1'] };
      try {
        if (field.options) definition = JSON.parse(field.options);
      } catch(e) {}
      
      const rows = definition.rows || ['Row 1'];
      const cols = definition.columns || ['Column 1'];
      const gridData = value ? JSON.parse(value) : {};

      const handleGridChange = (row, col) => {
        const newData = { ...gridData };
        if (field.fieldType === 'MC_GRID') {
          newData[row] = col;
        } else {
          // CHECKBOX_GRID
          const current = newData[row] || [];
          newData[row] = current.includes(col)
            ? current.filter(c => c !== col)
            : [...current, col];
        }
        onChange(JSON.stringify(newData));
      };

      return (
        <div className="fill-grid-wrapper">
          <table className="fill-grid-table">
            <thead>
              <tr>
                <th></th>
                {cols.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row}>
                  <td className="grid-row-label">{row}</td>
                  {cols.map(col => (
                    <td key={col} className="grid-cell">
                      <input
                        type={field.fieldType === 'MC_GRID' ? 'radio' : 'checkbox'}
                        name={`${field.fieldKey}-${row}`}
                        checked={field.fieldType === 'MC_GRID' 
                          ? gridData[row] === col 
                          : (gridData[row] || []).includes(col)}
                        onChange={() => handleGridChange(row, col)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'HEADING':
      return null; // Headings don't have inputs

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
      return <input className={inputClass} type="text" placeholder="Your answer" value={value || ''}
        onChange={e => onChange(e.target.value)} />;
  }
}

export default function PublicFillPage({ params }) {
  const { formId } = use(params);
  const router = useRouter();
  const { user, isAuthLoaded } = useApp();
  const [formData, setFormData]   = useState(null);
  const [fields, setFields]       = useState([]);
  const [rules, setRules]         = useState([]);
  const [answers, setAnswers]     = useState({});
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [notFound, setNotFound]       = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submissionIdState, setSubmissionIdState] = useState('');

  const [closed, setClosed]           = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [deleted, setDeleted]         = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (isAuthLoaded && !user) {
      router.replace(`/user-login?redirect=${encodeURIComponent(`/publish/${formId}`)}`);
      return;
    }
    if (!isAuthLoaded || !user) return; // Wait for auth

    Promise.all([
      formsApi.getPublished(formId),
      rulesApi.getPublicRules(formId).catch(() => ({ data: [] }))
    ])
      .then(([resForm, resRules]) => {
        const formFields = Array.isArray(resForm.data.fields) ? resForm.data.fields : [];
        setFormData(resForm.data.form);
        setFields(formFields);
        setRules((resRules.data || []).filter(r => r.enabled));
        
        // Initialize answers: only TOGGLE fields need a default 'false' if not specified
        const initialAnswers = {};
        formFields.forEach(f => {
          if (f.fieldType === 'TOGGLE') {
            initialAnswers[f.fieldKey] = 'false';
          }
        });
        setAnswers(prev => ({ ...initialAnswers, ...prev }));

        if (resForm.data.alreadySubmitted) {
          setAlreadySubmitted(true);
          setSubmissionIdState(resForm.data.submissionId);
        }
      })
      .catch((err) => {
        if (err.message && err.message.includes('closed')) {
          setClosed(true);
          try {
            const parsed = JSON.parse(err.message);
            setClosedMessage(parsed.message || "This form has been closed by the admin.");
          } catch {
            setClosedMessage(err.message);
          }
        } else if (err.message && err.message.includes('deleted')) {
          setDeleted(true);
        } else {
          console.error("Error loading form:", err);
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [formId, isAuthLoaded, user, router]);

  // Evaluate rules dynamically (runs every render, reads current answers)
  const hiddenFields    = new Set();
  const dynamicRequired = new Set();
  const dynamicErrors   = {};
  const disabledFields  = new Set();
  const valueOverrides  = {}; // SET_VALUE / CLEAR_VALUE / COPY_VALUE results

  rules.forEach(rule => {
    const { conditionField, conditionOperator, conditionValue, actionType, actionField, actionValue } = rule;
    // Use the current display value (including any previous overrides) for condition check
    const currentVal = String({ ...answers, ...valueOverrides }[conditionField] ?? '');
    const compVal = String(conditionValue || '');
    
    let isMatch = false;
    switch (conditionOperator) {
      case 'EQUALS':            isMatch = currentVal.toLowerCase() === compVal.toLowerCase(); break;
      case 'NOT_EQUALS':        isMatch = currentVal.toLowerCase() !== compVal.toLowerCase(); break;
      case 'CONTAINS':          isMatch = currentVal.toLowerCase().includes(compVal.toLowerCase()); break;
      case 'STARTS_WITH':       isMatch = currentVal.toLowerCase().startsWith(compVal.toLowerCase()); break;
      case 'ENDS_WITH':         isMatch = currentVal.toLowerCase().endsWith(compVal.toLowerCase()); break;
      case 'GREATER_THAN':      isMatch = currentVal !== '' && !isNaN(Number(currentVal)) && Number(currentVal) > Number(compVal); break;
      case 'LESS_THAN':         isMatch = currentVal !== '' && !isNaN(Number(currentVal)) && Number(currentVal) < Number(compVal); break;
      case 'GREATER_THAN_EQUAL':isMatch = currentVal !== '' && !isNaN(Number(currentVal)) && Number(currentVal) >= Number(compVal); break;
      case 'LESS_THAN_EQUAL':   isMatch = currentVal !== '' && !isNaN(Number(currentVal)) && Number(currentVal) <= Number(compVal); break;
      case 'IS_EMPTY':          isMatch = currentVal === ''; break;
      case 'IS_NOT_EMPTY':      isMatch = currentVal !== ''; break;
      case 'IS_TRUE':           isMatch = ['true', 'yes', '1'].includes(currentVal.toLowerCase()); break;
      case 'IS_FALSE':          isMatch = ['false', 'no', '0'].includes(currentVal.toLowerCase()); break;
      case 'IN_LIST':           isMatch = compVal.split(/\s*,\s*/).some(v => v.trim().toLowerCase() === currentVal.toLowerCase()); break;
      case 'NOT_IN_LIST':       isMatch = !compVal.split(/\s*,\s*/).some(v => v.trim().toLowerCase() === currentVal.toLowerCase()); break;
      case 'MATCHES_REGEX': 
        try { isMatch = !new RegExp(compVal).test(currentVal); } 
        catch { isMatch = false; }
        break;
      case 'ALWAYS':            isMatch = true; break;
    }

    if (isMatch) {
      if (actionType === 'HIDE')        hiddenFields.add(actionField);
      if (actionType === 'SHOW')        hiddenFields.delete(actionField);
      if (actionType === 'REQUIRE')     dynamicRequired.add(actionField);
      if (actionType === 'DISABLE')     disabledFields.add(actionField);
      if (actionType === 'ENABLE')      disabledFields.delete(actionField);
      if (actionType === 'SHOW_ERROR')  dynamicErrors[actionField] = actionValue;
      // ── Value-mutation actions ────────────────────────────────────────────
      if (actionType === 'SET_VALUE')   valueOverrides[actionField] = actionValue || '';
      if (actionType === 'CLEAR_VALUE') valueOverrides[actionField] = '';
      if (actionType === 'COPY_VALUE')  valueOverrides[actionField] = String({ ...answers, ...valueOverrides }[actionValue] ?? '');
    }
  });

  // Merge: rule overrides take precedence over what the user typed
  const displayAnswers = { ...answers, ...valueOverrides };

  const setAnswer = (key, val) => {
    setAnswers(a => ({ ...a, [key]: val }));
    setErrors(e => ({ ...e, [key]: null })); // clear error on change
  };

  const sortedFields = [...fields].sort((a,b) => a.fieldOrder - b.fieldOrder);
  const pages = [];
  let curPage = [];
  sortedFields.forEach(f => {
    if (f.fieldType === 'PAGE_BREAK' && curPage.length > 0) {
      pages.push(curPage);
      curPage = [f];
    } else {
      curPage.push(f);
    }
  });
  if (curPage.length > 0) pages.push(curPage);
  if (pages.length === 0) pages.push([]); // safety

  const handleNext = (e) => {
    if (e) e.preventDefault();
    const currentFields = pages[currentPage].filter(f => !hiddenFields.has(f.fieldKey));
    const newErrors = {};
    for (const field of currentFields) {
      if (field.fieldType === 'PAGE_BREAK' || field.fieldType === 'HEADING') continue;
      const fieldToValidate = { ...field, required: field.required || dynamicRequired.has(field.fieldKey) };
      const err = validateField(fieldToValidate, answers[field.fieldKey]);
      if (err) newErrors[field.fieldKey] = err;
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      const firstKey = Object.keys(newErrors)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setCurrentPage(p => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setCurrentPage(p => Math.max(0, p - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // Client-side validation
    const newErrors = {};
    const visibleFields = fields.filter(f => !hiddenFields.has(f.fieldKey));
    
    for (const field of visibleFields) {
      const fieldToValidate = { ...field, required: field.required || dynamicRequired.has(field.fieldKey) };
      const err = validateField(fieldToValidate, answers[field.fieldKey]);
      if (err) newErrors[field.fieldKey] = err;
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      // Scroll to first error
      const firstKey = Object.keys(newErrors)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      // Use displayAnswers so SET_VALUE / COPY_VALUE / CLEAR_VALUE overrides are submitted
      const finalAnswers = { ...displayAnswers };

      // Apply Default Values for empty fields (only if not required, though required fields must be filled)
      fields.forEach(f => {
        const val = finalAnswers[f.fieldKey];
        const isEmpty = val === undefined || val === null || val === "" || val === "[]" || val === "{}";
        
        if (isEmpty && f.defaultValue) {
          if (f.fieldType === 'CHECKBOXES') {
            try {
              if (f.defaultValue.startsWith('[')) {
                finalAnswers[f.fieldKey] = f.defaultValue;
              } else {
                const arr = f.defaultValue.split(',').map(s => s.trim()).filter(Boolean);
                finalAnswers[f.fieldKey] = JSON.stringify(arr);
              }
            } catch (e) {
              finalAnswers[f.fieldKey] = '[]';
            }
          } else if (['MC_GRID', 'TICK_BOX_GRID'].includes(f.fieldType)) {
            // These are stored as JSON strings in defaultValue
            finalAnswers[f.fieldKey] = f.defaultValue;
          } else {
            finalAnswers[f.fieldKey] = f.defaultValue;
          }
        }
      });

      hiddenFields.forEach(k => delete finalAnswers[k]); // don't submit hidden fields
      const res = await formsApi.submit(formId, finalAnswers);
      if (res.data.submissionId) {
        setSubmissionIdState(res.data.submissionId);
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAnswers({});
    setErrors({});
    setSubmitted(false);
    setSubmitError('');
    setCurrentPage(0);
  };

  if (loading || !isAuthLoaded || !user) return (
    <div className="fill-page">
      <div className="gf-loader"><div className="gf-spinner" /><span>Loading form...</span></div>
    </div>
  );

  if (notFound) return (
    <div className="fill-page">
      <div className="success-card">
        <div className="success-icon">🚫</div>
        <div className="success-title">Form not found</div>
        <div className="success-subtitle">This form doesn't exist or is not published yet.</div>
      </div>
    </div>
  );

  if (closed) return (
    <div className="fill-page">
      <div className="success-card">
        <div className="success-icon">🔒</div>
        <div className="success-title">Form Closed</div>
        <div className="success-subtitle">{closedMessage || "This form is no longer accepting responses."}</div>
      </div>
    </div>
  );

  if (deleted) return (
    <div className="fill-page">
      <div className="success-card">
        <div className="success-icon">🗑️</div>
        <div className="success-title">Form Deleted</div>
        <div className="success-subtitle">This form has been deleted.</div>
      </div>
    </div>
  );

  if (alreadySubmitted) return (
    <div className="fill-page">
      <div className="fill-form-wrap">
        <div className="success-card">
          <div className="success-icon">📋</div>
          <div className="success-title">You've already responded</div>
          <div className="success-subtitle">You can only fill out <strong>{formData?.name}</strong> once.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            <Link href={`/publish/${formId}/edit/${submissionIdState}`} className="gf-btn gf-btn-purple" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Edit your response
            </Link>
            <div style={{ fontSize: '0.8rem', color: 'var(--gf-text-secondary)', textAlign: 'center' }}>
              Your previous response is saved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="fill-page">
      <div className="fill-form-wrap">
        <div className="success-card">
          <div className="success-icon">✅</div>
          <div className="success-title">Your response has been recorded</div>
          <div className="success-subtitle">Thank you for filling out <strong>{formData?.name}</strong>.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            {submissionIdState && (
              <Link href={`/publish/${formId}/edit/${submissionIdState}`} className="gf-btn gf-btn-outline" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
                Edit your response
              </Link>
            )}
            <button className="gf-btn gf-btn-ghost" style={{ fontSize: '0.9rem' }} onClick={resetForm}>
              Submit another response
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fill-page">
      <form className="fill-form-wrap" onSubmit={handleSubmit} noValidate>
        {/* Form header - Only on page 1 */}
        {currentPage === 0 && (
          <div className="fill-header">
            <div className="fill-form-title">{formData?.name}</div>
            {formData?.description && (
              <div className="fill-form-desc">{formData.description}</div>
            )}
          </div>
        )}

        {/* Section Header - On other pages if they start with PAGE_BREAK */}
        {currentPage > 0 && pages[currentPage]?.[0]?.fieldType === 'PAGE_BREAK' && (
           <div className="fill-header" style={{ borderTop: '10px solid var(--gf-purple)' }}>
            <div className="fill-form-title">{pages[currentPage][0].fieldLabel || 'Section'}</div>
            {pages[currentPage][0].helpText && (
              <div className="fill-form-desc">{pages[currentPage][0].helpText}</div>
            )}
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--gf-text-secondary)' }}>
              Page {currentPage + 1} of {pages.length}
            </div>
          </div>
        )}

        {fields.length === 0 ? (
          <div className="success-card">
            <div className="success-icon">📋</div>
            <div className="success-title">No questions in this form</div>
          </div>
        ) : (
          <>
            {pages[currentPage]
              .filter(field => !hiddenFields.has(field.fieldKey))
              .map(field => {
                if (field.fieldType === 'PAGE_BREAK') return null; // Handled as header
                const isHeading = field.fieldType === 'HEADING';
                const isReq = field.required || dynamicRequired.has(field.fieldKey);
                return (
                  <div
                    key={field.id}
                    id={`field-${field.fieldKey}`}
                    className={`fill-question-card ${isHeading ? 'heading-type' : ''}${errors[field.fieldKey] ? ' has-error' : ''}`}
                  >
                    <div className="fill-question-label">
                      {field.fieldLabel}
                      {isReq && !isHeading && <span className="fill-question-required">*</span>}
                    </div>
                {field.helpText && (
                  <div className={field.fieldType === 'HEADING' ? 'fill-question-help' : 'fill-question-help'}>
                    {field.helpText}
                  </div>
                )}
                {field.fieldType !== 'HEADING' && (
                  <fieldset disabled={disabledFields.has(field.fieldKey)} style={{ border: 'none', padding: 0, margin: 0, marginTop: '8px' }}>
                    <FieldRenderer
                      field={field}
                      value={displayAnswers[field.fieldKey]}
                      onChange={val => setAnswer(field.fieldKey, val)}
                      error={!!errors[field.fieldKey] || !!dynamicErrors[field.fieldKey]}
                      formId={formId}
                    />
                  </fieldset>
                )}
                {(errors[field.fieldKey] || dynamicErrors[field.fieldKey]) && (
                  <div className="fill-question-error">
                    <span>⚠</span> {errors[field.fieldKey] || dynamicErrors[field.fieldKey]}
                  </div>
                )}
              </div>
            );
          })}

            {submitError && (
              <div className="gf-alert-error" style={{ marginBottom: '12px' }}>
                <span>⚠</span> {submitError}
              </div>
            )}

            <div className="fill-navigation-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                {currentPage > 0 && (
                  <button type="button" className="gf-btn gf-btn-ghost" onClick={handleBack}>
                    Back
                  </button>
                )}
                {currentPage < pages.length - 1 ? (
                  <button type="button" className="gf-btn gf-btn-purple" onClick={handleNext}>
                    Next
                  </button>
                ) : (
                  <button type="submit" className="fill-submit-btn" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                )}
              </div>
              
              <button type="button" className="fill-clear-btn" onClick={() => {
                resetForm();
                setCurrentPage(0);
              }}>
                Clear form
              </button>
            </div>

            <div style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--gf-text-secondary)', textAlign: 'center' }}>
              Never submit passwords through this form. • <a href="/forms" style={{ color: 'var(--gf-purple)' }}>Build your own form</a>
            </div>
          </>
        )}

      </form>
    </div>
  );
}
