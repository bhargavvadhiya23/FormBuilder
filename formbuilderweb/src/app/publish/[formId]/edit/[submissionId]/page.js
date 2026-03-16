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
  if (!val) return null;

  switch (field.fieldType) {
    case 'NUMBER':
      if (isNaN(Number(val))) return 'Please enter a valid number';
      if (field.minValueStr && Number(val) < Number(field.minValueStr)) return `Value must be ≥ ${field.minValueStr}`;
      if (field.maxValueStr && Number(val) > Number(field.maxValueStr)) return `Value must be ≤ ${field.maxValueStr}`;
      break;
    case 'DATE':
    case 'MONTH':
      if (!val || val.length < 4) return 'Please enter a valid date';
      if (field.minValueStr && val < field.minValueStr) return `Date must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr) return `Date must be on or before ${field.maxValueStr}`;
      break;
    case 'WEEK':
      if (!val || val.length < 4) return 'Please enter a valid week';
      if (field.minValueStr && val < field.minValueStr) return `Week must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr) return `Week must be on or before ${field.maxValueStr}`;
      break;
    case 'TIME':
      if (!val) return 'Please select a time';
      if (field.minValueStr && val < field.minValueStr) return `Time must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr) return `Time must be on or before ${field.maxValueStr}`;
      break;
    case 'DATE_TIME':
      if (!val || val.length < 10) return 'Please select both date and time';
      if (field.minValueStr && val < field.minValueStr) return `Date/time must be on or after ${field.minValueStr}`;
      if (field.maxValueStr && val > field.maxValueStr) return `Date/time must be on or before ${field.maxValueStr}`;
      break;
    case 'LINEAR_SCALE':
    case 'RATING':
    case 'RANGE': {
      const n = Number(val);
      const min = field.minValue ?? 1, max = field.maxValue ?? 5;
      if (isNaN(n) || n < min || n > max) return `Please select a value between ${min} and ${max}`;
      break;
    }
    case 'MC_GRID':
    case 'CHECKBOX_GRID': {
      try {
        const gridData = val ? JSON.parse(val) : {};
        let definition = { rows: [], columns: [] };
        if (field.options) definition = JSON.parse(field.options);
        const rows = definition.rows || [];
        if (field.required) {
          for (const row of rows) {
            const selection = gridData[row];
            if (!selection || (Array.isArray(selection) && selection.length === 0)) {
              return `Please provide a response for row: "${row}"`;
            }
          }
        }
      } catch (e) { return 'Invalid grid data format'; }
      break;
    }
    case 'SHORT_ANSWER':
    case 'PARAGRAPH':
    case 'PASSWORD':
    case 'SEARCH': {
      let cleaned = val;
      if (field.trimWhitespace !== false) cleaned = cleaned.trim();
      if (field.removeExtraSpaces !== false) cleaned = cleaned.replace(/\s+/g, ' ');

      if (cleaned.length > (field.fieldType === 'PARAGRAPH' ? 5000 : 500))
        return `Response is too long (max ${field.fieldType === 'PARAGRAPH' ? 5000 : 500} chars)`;
      if (field.minLength && cleaned.length < field.minLength) return `Must be at least ${field.minLength} characters`;
      if (field.maxLength && cleaned.length > field.maxLength) return `Must be at most ${field.maxLength} characters`;

      if (field.charType) {
        const patterns = { LETTERS: /^[\p{L} ]*$/u, NUMBERS: /^[\d ]*$/, BOTH: /^[\p{L}\d ]*$/u };
        const labels = { LETTERS: 'letters only', NUMBERS: 'numbers only', BOTH: 'letters and numbers only' };
        if (patterns[field.charType] && !patterns[field.charType].test(cleaned))
          return `Must contain ${labels[field.charType] || field.charType}`;
      }
      if (field.allowSpecialChars === false && /[^\w\s]/.test(cleaned)) return 'Special characters are not allowed';
      if (field.customRegex) {
        try { if (!new RegExp(field.customRegex).test(cleaned)) return 'Does not match the required pattern'; } catch(e) {}
      }
      break;
    }
    case 'EMAIL':
    case 'PHONE':
    case 'URL': {
      let cleaned = val;
      if (field.trimWhitespace !== false) cleaned = cleaned.trim();
      if (field.removeExtraSpaces !== false) cleaned = cleaned.replace(/\s+/g, ' ');

      if (field.minLength && cleaned.length < field.minLength) return `Must be at least ${field.minLength} characters`;
      if (field.maxLength && cleaned.length > field.maxLength) return `Must be at most ${field.maxLength} characters`;

      if (field.fieldType === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return 'Invalid email address';
      if (field.fieldType === 'PHONE' && !/^[+\d\s\-().]{7,20}$/.test(cleaned)) return 'Invalid phone number';
      if (field.fieldType === 'URL') { try { new URL(cleaned); } catch { return 'Invalid URL (include https://)'; } }

      if (field.customRegex) {
        try { if (!new RegExp(field.customRegex).test(cleaned)) return 'Does not match the required pattern'; } catch(e) {}
      }
      break;
    }
    default: break;
  }
  return null;
}

function FieldRenderer({ field, value, onChange, error, formId }) {
  const options = field.options ? JSON.parse(field.options) : [];
  const inputClass = `fill-input${error ? ' error' : ''}`;

  switch (field.fieldType) {
    case 'SHORT_ANSWER': return <input className={inputClass} type="text" value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'PARAGRAPH': return <textarea className="fill-textarea" value={value || ''} onChange={e => onChange(e.target.value)} rows={3} />;
    case 'NUMBER': return <input className={inputClass} type="number" value={value || ''} min={field.minValueStr || undefined} max={field.maxValueStr || undefined} onChange={e => onChange(e.target.value)} />;
    case 'DATE': return <input className={inputClass} type="date" value={value || ''} min={field.minValueStr || undefined} max={field.maxValueStr || undefined} onChange={e => onChange(e.target.value)} />;
    case 'MONTH': return <input className={inputClass} type="month" value={value || ''} min={field.minValueStr || undefined} max={field.maxValueStr || undefined} onChange={e => onChange(e.target.value)} />;
    case 'WEEK': return <input className={inputClass} type="week" value={value || ''} min={field.minValueStr || undefined} max={field.maxValueStr || undefined} onChange={e => onChange(e.target.value)} />;
    case 'TIME': return <input className={inputClass} type="time" value={value || ''} min={field.minValueStr || undefined} max={field.maxValueStr || undefined} onChange={e => onChange(e.target.value)} />;
    case 'DATE_TIME': return <input className={inputClass} type="datetime-local" value={value || ''} min={field.minValueStr || undefined} max={field.maxValueStr || undefined} onChange={e => onChange(e.target.value)} />;
    
    case 'DROPDOWN': {
      const [dynamicOptions, setDynamicOptions] = useState([]);
      const [loadingOpts, setLoadingOpts] = useState(!!(field.dataSourceTable && field.dataSourceColumn));

      useEffect(() => {
        if (field.dataSourceTable && field.dataSourceColumn) {
          formsApi.getPublicDynamicOptions(formId, field.fieldKey)
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
    case 'MULTIPLE_CHOICE': return (
      <div>
        {options.map(opt => (
          <label key={opt} className="fill-radio-option">
            <input type="radio" checked={value === opt} onChange={() => onChange(opt)} /> <span>{opt}</span>
          </label>
        ))}
      </div>
    );
    case 'CHECKBOXES': {
      const selected = value ? JSON.parse(value) : [];
      const toggle = (opt) => {
        const arr = selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt];
        onChange(arr.length ? JSON.stringify(arr) : '');
      };
      return (
        <div>
          {options.map(opt => (
            <label key={opt} className="fill-checkbox-option">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} /> <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'MC_GRID':
    case 'CHECKBOX_GRID': {
      let definition = { rows: ['Row 1'], columns: ['Column 1'] };
      try { if (field.options) definition = JSON.parse(field.options); } catch(e) {}
      const rows = definition.rows || ['Row 1'];
      const cols = definition.columns || ['Column 1'];
      const gridData = value ? JSON.parse(value) : {};

      const handleGridChange = (row, col) => {
        const newData = { ...gridData };
        if (field.fieldType === 'MC_GRID') {
          newData[row] = col;
        } else {
          const current = newData[row] || [];
          newData[row] = current.includes(col) ? current.filter(c => c !== col) : [...current, col];
        }
        onChange(JSON.stringify(newData));
      };

      return (
        <div className="fill-grid-wrapper">
          <table className="fill-grid-table">
            <thead>
              <tr><th></th>{cols.map(col => <th key={col}>{col}</th>)}</tr>
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
                        checked={field.fieldType === 'MC_GRID' ? gridData[row] === col : (gridData[row] || []).includes(col)}
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
    case 'HEADING': return null;
    default: return <input className={inputClass} type="text" value={value || ''} onChange={e => onChange(e.target.value)} />;
  }
}

export default function PublicEditPage({ params }) {
  const { formId, submissionId } = use(params);
  const router = useRouter();
  const { user, isAuthLoaded } = useApp();
  
  const [formData, setFormData] = useState(null);
  const [fields, setFields] = useState([]);
  const [rules, setRules] = useState([]);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (isAuthLoaded && !user) {
      router.replace(`/user-login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!isAuthLoaded || !user) return;

    Promise.all([
      formsApi.getPublished(formId),
      formsApi.getPublicResponse(formId, submissionId),
      rulesApi.getPublicRules(formId).catch(() => ({ data: [] }))
    ])
    .then(([resForm, resSub, resRules]) => {
      setFormData(resForm.data.form);
      setFields(resForm.data.fields || []);
      setAnswers(resSub.data || {});
      setRules((resRules.data || []).filter(r => r.enabled));
    })
    .catch(err => {
      console.error(err);
      setError('Failed to load your response.');
    })
    .finally(() => setLoading(false));
  }, [formId, submissionId, isAuthLoaded, user, router]);

  // Rule evaluation
  const hiddenFields = new Set();
  const dynamicRequired = new Set();
  const disabledFields = new Set();
  const valueOverrides = {};

  rules.forEach(rule => {
    const { conditionField, conditionOperator, conditionValue, actionType, actionField, actionValue } = rule;
    const currentVal = String({ ...answers, ...valueOverrides }[conditionField] ?? '');
    const compVal = String(conditionValue || '');
    let isMatch = false;

    switch (conditionOperator) {
      case 'EQUALS':            isMatch = currentVal.toLowerCase() === compVal.toLowerCase(); break;
      case 'NOT_EQUALS':        isMatch = currentVal.toLowerCase() !== compVal.toLowerCase(); break;
      case 'CONTAINS':          isMatch = currentVal.toLowerCase().includes(compVal.toLowerCase()); break;
      case 'IS_EMPTY':          isMatch = currentVal === ''; break;
      case 'IS_NOT_EMPTY':      isMatch = currentVal !== ''; break;
      case 'GREATER_THAN':      isMatch = currentVal !== '' && !isNaN(Number(currentVal)) && Number(currentVal) > Number(compVal); break;
      case 'LESS_THAN':         isMatch = currentVal !== '' && !isNaN(Number(currentVal)) && Number(currentVal) < Number(compVal); break;
      case 'ALWAYS':            isMatch = true; break;
      default: break;
    }

    if (isMatch) {
      if (actionType === 'HIDE') hiddenFields.add(actionField);
      if (actionType === 'SHOW') hiddenFields.delete(actionField);
      if (actionType === 'REQUIRE') dynamicRequired.add(actionField);
      if (actionType === 'DISABLE') disabledFields.add(actionField);
      if (actionType === 'ENABLE') disabledFields.delete(actionField);
      if (actionType === 'SET_VALUE') valueOverrides[actionField] = actionValue || '';
      if (actionType === 'CLEAR_VALUE') valueOverrides[actionField] = '';
    }
  });

  const displayAnswers = { ...answers, ...valueOverrides };

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
  if (pages.length === 0) pages.push([]);

  const handleNext = (e) => {
    if (e) e.preventDefault();
    const currentFields = pages[currentPage].filter(f => !hiddenFields.has(f.fieldKey));
    const newErrors = {};
    for (const field of currentFields) {
      if (field.fieldType === 'PAGE_BREAK' || field.fieldType === 'HEADING') continue;
      const fv = { ...field, required: field.required || dynamicRequired.has(field.fieldKey) };
      const err = validateField(fv, displayAnswers[field.fieldKey]);
      if (err) newErrors[field.fieldKey] = err;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
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
    const newErrors = {};
    const visibleFields = fields.filter(f => !hiddenFields.has(f.fieldKey));
    
    for (const field of visibleFields) {
      if (field.fieldType === 'HEADING') continue;
      const fv = { ...field, required: field.required || dynamicRequired.has(field.fieldKey) };
      const err = validateField(fv, displayAnswers[field.fieldKey]);
      if (err) newErrors[field.fieldKey] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const finalAnswers = { ...displayAnswers };
      hiddenFields.forEach(k => delete finalAnswers[k]);
      await formsApi.updatePublicResponse(formId, submissionId, finalAnswers);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to update response.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="fill-page"><div className="gf-loader"><div className="gf-spinner" /></div></div>;
  if (error) return <div className="fill-page"><div className="gf-alert-error">{error}</div></div>;

  if (submitted) return (
    <div className="fill-page">
      <div className="success-card">
        <div className="success-icon">✅</div>
        <div className="success-title">Response updated</div>
        <div className="success-subtitle">Your changes to <strong>{formData?.name}</strong> have been saved.</div>
        <Link href={`/publish/${formId}`} className="gf-btn gf-btn-outline" style={{ marginTop: '20px', textDecoration: 'none' }}>
          Back to form
        </Link>
      </div>
    </div>
  );

  return (
    <div className="fill-page">
      <form className="fill-form-wrap" onSubmit={handleSubmit}>
        {/* Header - Page 1 only */}
        {currentPage === 0 && (
          <div className="fill-header">
            <div className="fill-form-title">Edit Your Response: {formData?.name}</div>
            <div className="fill-form-desc">Modify your previous answers below.</div>
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

            {pages[currentPage]
              .filter(f => !hiddenFields.has(f.fieldKey))
              .map(field => {
                if (field.fieldType === 'PAGE_BREAK') return null;
                const isHeading = field.fieldType === 'HEADING';
                return (
                  <div key={field.id} className={`fill-question-card ${isHeading ? 'heading-type' : ''}`}>
                    <div className="fill-question-label">
                      {field.fieldLabel} 
                      {field.required && !isHeading && <span className="fill-question-required">*</span>}
                    </div>
                {field.helpText && <div className="fill-question-help">{field.helpText}</div>}
                
                {!isHeading && (
                  <fieldset disabled={disabledFields.has(field.fieldKey)} style={{ border: 'none', padding: 0, margin: 0, marginTop: '8px' }}>
                    <FieldRenderer
                      field={field}
                      value={displayAnswers[field.fieldKey]}
                      onChange={val => setAnswers(a => ({ ...a, [field.fieldKey]: val }))}
                      error={!!errors[field.fieldKey]}
                      formId={formId}
                    />
                  </fieldset>
                )}
                {errors[field.fieldKey] && <div className="fill-question-error">{errors[field.fieldKey]}</div>}
              </div>
            );
          })}

        <div className="fill-navigation-row" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
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
              {submitting ? 'Updating...' : 'Update Response'}
            </button>
          )}
          <Link href={`/publish/${formId}`} className="fill-clear-btn" style={{ textDecoration: 'none' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
