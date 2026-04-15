'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formsApi, metadataApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import Swal from 'sweetalert2';

const FIELD_TYPES = [
  { value: 'SHORT_ANSWER',    label: '📝 Text',    icon: '—' },
  { value: 'PARAGRAPH',       label: '📄 Multiline Text',       icon: '≡' },
  { value: 'MULTIPLE_CHOICE', label: '⊙ Radio Buttons',  icon: '⊙' },
  { value: 'CHECKBOXES',      label: '☑ Checkboxes',       icon: '☑' },
  { value: 'DROPDOWN',        label: '▾ Dropdown',         icon: '▾' },
  { value: 'LINEAR_SCALE',    label: '⟵ Linear scale',     icon: '↔' },
  { value: 'RANGE',           label: '📏 Range/Slider',     icon: '—○—' },
  { value: 'DATE',            label: '📅 Date',             icon: '📅' },
  { value: 'TIME',            label: '🕐 Time',             icon: '🕐' },
  { value: 'DATE_TIME',       label: '📅🕐 Date and Time',  icon: '📅' },
  { value: 'MONTH',           label: '🗓 Month',            icon: '🗓' },
  { value: 'WEEK',            label: '📅 Week',             icon: '📅' },
  { value: 'EMAIL',           label: '✉ Email',            icon: '✉' },
  { value: 'NUMBER',          label: '# Number',           icon: '#' },
  { value: 'PASSWORD',        label: '🔑 Password',         icon: '●●●' },
  { value: 'COLOR',           label: '🎨 Color Picker',     icon: '🎨' },
  { value: 'FILE',            label: '📁 File Upload',      icon: '📁' },
  { value: 'RATING',          label: '⭐ Rating',           icon: '⭐' },
  { value: 'MC_GRID',         label: '⊞ Multi-choice Grid', icon: '⊞' },
  { value: 'CHECKBOX_GRID',   label: '▦ Tick-box Grid',    icon: '▦' },
  { value: 'PHONE',           label: '📞 Phone',           icon: '📞' },
  { value: 'URL',             label: '🔗 URL',             icon: '🔗' },
  { value: 'TOGGLE',          label: '🔘 Boolean Toggle',  icon: '🔘' },
  // { value: 'SEARCH',          label: '🔍 Search',           icon: '🔍' },
  { value: 'HEADING',         label: '📜 Title and description', icon: '📜' },
  { value: 'PAGE_BREAK',      label: '📑 Page Break',        icon: '📑' },
];

const HAS_CHOICES = ['MULTIPLE_CHOICE','CHECKBOXES','DROPDOWN'];
const HAS_GRID    = ['MC_GRID', 'CHECKBOX_GRID'];
const HAS_OPTIONS = [...HAS_CHOICES, ...HAS_GRID];
const HAS_SCALE   = ['LINEAR_SCALE', 'RANGE', 'RATING'];
const HAS_MINMAX  = ['NUMBER', 'DATE', 'TIME', 'DATE_TIME', 'MONTH', 'WEEK'];
// Full text validation: charType, minLength, maxLength, trim, removeExtraSpaces, specialChars, regex
const HAS_FULL_TEXT_VAL  = ['SHORT_ANSWER', 'PARAGRAPH', 'PASSWORD', 'SEARCH'];
// Basic text validation: minLength, maxLength, trim, removeExtraSpaces, regex only
const HAS_BASIC_TEXT_VAL = ['EMAIL', 'PHONE', 'URL'];
const IS_LAYOUT = ['HEADING', 'PAGE_BREAK'];

const FILE_CATEGORIES = [
  { label: 'Images', value: 'IMAGE', icon: '🖼' },
  { label: 'Videos', value: 'VIDEO', icon: '🎥' },
  { label: 'PDFs', value: 'PDF', icon: '📄' },
  { label: 'Excel', value: 'EXCEL', icon: '📊' },
  { label: 'CSV', value: 'CSV', icon: '📑' },
  { label: 'Documents', value: 'DOC', icon: '📝' },
  { label: 'Text', value: 'TEXT', icon: '🖋' },
  { label: 'Archives', value: 'ZIP', icon: '📦' },
];

// Maps field type to a suitable HTML input type for min/max inputs in settings
function minMaxInputType(fieldType) {
  switch (fieldType) {
    case 'DATE':      return 'date';
    case 'TIME':      return 'time';
    case 'DATE_TIME': return 'datetime-local';
    case 'MONTH':     return 'month';
    case 'WEEK':      return 'week';
    default:          return 'number'; // NUMBER
  }
}

const validateDefaultValue = (q, val) => {
  if (!val) return null;

  // 1. Length Limits
  if (q.minLength !== '' && val.length < parseInt(q.minLength)) {
    return { message: `Default value is shorter than min length (${q.minLength})`, level: 'warning' };
  }
  if (q.maxLength !== '' && val.length > parseInt(q.maxLength)) {
    return { message: `Default value exceeds max length (${q.maxLength})`, level: 'error', truncate: true };
  }

  // 2. Character Type & Special Characters
  if (HAS_FULL_TEXT_VAL.includes(q.fieldType)) {
    if (q.allowSpecialChars === false) {
      if (/[^a-zA-Z0-9\s]/.test(val)) {
        return { message: "Special characters are not allowed", level: 'error' };
      }
    }

    if (q.charType === 'LETTERS') {
      if (/[0-9]/.test(val)) {
        return { message: "Numbers are not allowed when 'Letters only' is selected", level: 'error' };
      }
    } else if (q.charType === 'NUMBERS') {
      if (/[a-zA-Z]/.test(val)) {
        return { message: "Letters are not allowed when 'Numbers only' is selected", level: 'error' };
      }
    }
  }

  // 3. Custom Regex
  if (q.customRegex) {
    try {
      const reg = new RegExp(q.customRegex);
      if (!reg.test(val)) {
        return { message: "Default value does not match the custom validation pattern", level: 'error' };
      }
    } catch (e) {}
  }

  return null;
};

// No longer using frontend makeKey, handled by backend
function newQuestion(order) {
  return {
    _id: Date.now() + Math.random(),
    fieldLabel: '',
    fieldKey: '',
    fieldType: 'MULTIPLE_CHOICE',
    required: false,
    fieldOrder: order,
    options: ['Option 1'],
    minValue: 1,
    maxValue: 5,
    minLabel: 'Not at all',
    maxLabel: 'Definitely',
    helpText: '',
    minValueStr: '',
    maxValueStr: '',
    // Text validation defaults
    charType: 'LETTERS',
    minLength: '',
    maxLength: '',
    trimWhitespace: true,
    removeExtraSpaces: true,
    allowSpecialChars: true,
    customRegex: '',
    isUnique: false, // New property
    allowedFileTypes: '', // Comma-separated categories
    dataSourceTable: '',
    dataSourceColumn: '',
    defaultValue: '',
    customPlaceholder: '',
  };
}

const HAS_PLACEHOLDER = ['SHORT_ANSWER', 'PARAGRAPH', 'EMAIL', 'NUMBER', 'PHONE', 'URL'];

export default function FormEditPage({ params }) {
  const { formId } = use(params);
  const router = useRouter();
  const { toast, user } = useApp();

  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState(false);
  const [driftError, setDriftError] = useState(null);
  const [status, setStatus] = useState({ published: false, shareLink: null });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'top' or 'bottom'
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fRes, fieldsRes, tRes] = await Promise.all([
          formsApi.getById(formId),
          formsApi.getFields(formId),
          metadataApi.getTables(),
        ]);
        setForm(fRes.data);
        setTables(tRes.data || []);
        const rawFields = Array.isArray(fieldsRes.data) ? fieldsRes.data : [];
        setQuestions(rawFields.map(f => ({
          ...f,
          _id: f.id,
          options: (() => {
            try {
              if (f.options) return JSON.parse(f.options);
              if (HAS_GRID.includes(f.fieldType)) return { rows: ['Row 1'], columns: ['Column 1'] };
            } catch (e) { console.error("Parse options error", e); }
            return ['Option 1'];
          })(),
          minValue: f.minValue ?? 1,
          maxValue: f.maxValue ?? 5,
          minLabel: f.minLabel ?? '',
          maxLabel: f.maxLabel ?? '',
          minValueStr: f.minValueStr ?? '',
          maxValueStr: f.maxValueStr ?? '',
          // Text validation
          charType: f.charType || 'LETTERS',
          minLength: f.minLength ?? '',
          maxLength: f.maxLength ?? '',
          trimWhitespace: f.trimWhitespace ?? true,
          removeExtraSpaces: f.removeExtraSpaces ?? true,
          allowSpecialChars: f.allowSpecialChars ?? true,
          customRegex: f.customRegex ?? '',
          isUnique: f.isUnique ?? false, // New property
          isOriginal: f.isOriginal ?? false, // Added isOriginal
          allowedFileTypes: f.allowedFileTypes ?? '',
          dataSourceTable: f.dataSourceTable ?? '',
          dataSourceColumn: f.dataSourceColumn ?? '',
          defaultValue: f.defaultValue ?? '',
          customPlaceholder: f.customPlaceholder ?? '',
        })));
        
        // Try getting status separately so it doesn't break the whole page
        try {
          const statusRes = await formsApi.getStatus(formId);
          setStatus(statusRes.data);
          
          if (statusRes.data.published) {
            toast.info("This form is live. Changes will update the published version.");
          }
        } catch (statusErr) {
          console.error("Failed to fetch status:", statusErr);
        }

      } catch (e) {
        if (e.message && e.message.toLowerCase().includes('deleted')) {
          setDeleted(true);
        } else if (e.message && e.message.toLowerCase().includes('drift')) {
          setDriftError(e.message);
        } else {
          toast.error(e.message || "Failed to load form");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [formId]);

  const fetchColumns = async (tableName) => {
    if (!tableName) {
      setColumns([]);
      return;
    }
    try {
      const res = await metadataApi.getColumns(tableName);
      setColumns(res.data || []);
    } catch (err) {
      console.error('Failed to fetch columns:', err);
      setColumns([]);
    }
  };

  useEffect(() => {
    if (activeIdx !== null && questions[activeIdx]?.dataSourceTable) {
      fetchColumns(questions[activeIdx].dataSourceTable);
    } else {
      setColumns([]);
    }
  }, [activeIdx, questions[activeIdx]?.dataSourceTable]);

  const updateForm = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const addQuestion = (type = 'MULTIPLE_CHOICE', index = -1) => {
    const q = newQuestion(questions.length + 1);
    if (type) {
      q.fieldType = type;
      // Initialize correct options structure based on type
      if (HAS_GRID.includes(type)) {
        q.options = { rows: ['Row 1'], columns: ['Column 1'] };
      } else if (HAS_CHOICES.includes(type)) {
        q.options = ['Option 1'];
      } else {
        q.options = undefined;
      }
    }
    
    setQuestions(qs => {
      const next = [...qs];
      const targetIndex = index === -1 ? next.length : index;
      next.splice(targetIndex, 0, q);
      // Re-map fieldOrder
      return next.map((item, i) => ({ ...item, fieldOrder: i + 1 }));
    });
    
    const targetIdx = index === -1 ? questions.length : index;
    setActiveIdx(targetIdx);
    
    // Scroll if needed
    if (index === -1) {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('fieldType', type);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('fieldType');
    if (type) addQuestion(type);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const moveQuestion = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setQuestions(qs => {
      const next = [...qs];
      const [q] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, q);
      // Re-map fieldOrder
      return next.map((item, i) => ({ ...item, fieldOrder: i + 1 }));
    });
    setActiveIdx(toIdx);
  };

  const onQuestionDragStart = (e, idx) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('sourceIdx', idx);
  };

  const onQuestionDragOver = (e, idx) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const pos = e.clientY < mid ? 'top' : 'bottom';
    
    setDragOverIdx(idx);
    setDropPosition(pos);
  };

  const onQuestionDrop = (e, idx) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('fieldType');
    const sourceIdxStr = e.dataTransfer.getData('sourceIdx');
    
    let targetIdx = idx;
    if (dropPosition === 'bottom') targetIdx += 1;

    if (sourceType) {
      // Insertion from sidebar
      addQuestion(sourceType, targetIdx);
    } else if (sourceIdxStr !== "") {
      // Reorder
      const fromIdx = parseInt(sourceIdxStr);
      // If moving down, adjustment is needed because splice-out changes indices
      let adjustedToIdx = targetIdx;
      if (fromIdx < targetIdx) adjustedToIdx -= 1;
      moveQuestion(fromIdx, adjustedToIdx);
    }
    
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const handleGlobalDragOver = (e) => {
    e.preventDefault();
  };

  const handleGlobalDrop = (e) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('fieldType');
    const sourceIdxStr = e.dataTransfer.getData('sourceIdx');
    
    // Only handle drops OUTSIDE questions (at the end)
    if (e.target.closest('.question-card')) return;
    
    if (sourceType) {
      addQuestion(sourceType);
    } else if (sourceIdxStr !== "") {
      moveQuestion(parseInt(sourceIdxStr), questions.length - 1);
    }
    
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const updateQ = (idx, key, val) => {
    setQuestions(qs => {
      const next = [...qs];
      let newVal = val;
      
      // If setting required to true, clear defaultValue
      if (key === 'required' && val === true) {
        next[idx] = { ...next[idx], [key]: val, defaultValue: '' };
      } else {
        next[idx] = { ...next[idx], [key]: val };
      }

      // If a validation constraint was changed, validate the existing defaultValue
      const validationKeys = ['charType', 'minLength', 'maxLength', 'allowSpecialChars', 'customRegex'];
      if (validationKeys.includes(key) && next[idx].defaultValue) {
        const err = validateDefaultValue(next[idx], next[idx].defaultValue);
        if (err) {
          if (err.level === 'error') toast.error(err.message);
          else toast.warning(err.message);
          
          // Focus the default value field
          setTimeout(() => {
            const el = document.getElementById(`default-value-${idx}`);
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }

      return next;
    });
  };

  const updateOption = (qIdx, optIdx, val) => {
    if (HAS_GRID.includes(questions[qIdx].fieldType)) return;
    setQuestions(qs => {
      const next = [...qs];
      const opts = [...next[qIdx].options];
      opts[optIdx] = val;
      next[qIdx] = { ...next[qIdx], options: opts };
      return next;
    });
  };

  const addOption = (qIdx) => {
    if (HAS_GRID.includes(questions[qIdx].fieldType)) return;
    setQuestions(qs => {
      const next = [...qs];
      next[qIdx] = { ...next[qIdx], options: [...next[qIdx].options, `Option ${next[qIdx].options.length + 1}`] };
      return next;
    });
  };

  const removeOption = (qIdx, optIdx) => {
    if (HAS_GRID.includes(questions[qIdx].fieldType)) return;
    setQuestions(qs => {
      const next = [...qs];
      const opts = next[qIdx].options.filter((_, i) => i !== optIdx);
      next[qIdx] = { ...next[qIdx], options: opts.length ? opts : ['Option 1'] };
      return next;
    });
  };

  const removeQuestion = async (idx) => {
    const q = questions[idx];
    if (q.id) {
      try { await formsApi.deleteField(formId, q.id); }
      catch (e) { toast.error('Failed to delete field: ' + e.message); return; }
    }
    setQuestions(qs => qs.filter((_, i) => i !== idx));
    if (activeIdx === idx) setActiveIdx(null);
  };

  const saveAll = async () => {
    // Basic pre-save validation
    for (const q of questions) {
      // Length validation
      if (q.minLength !== '' && q.maxLength !== '' && parseInt(q.minLength) > parseInt(q.maxLength)) {
        toast.error(`"${q.fieldLabel || 'Question'}": Min length (${q.minLength}) cannot be greater than max length (${q.maxLength})`);
        return;
      }
      // Numeric value validation
      if (HAS_MINMAX.includes(q.fieldType) && q.minValueStr !== '' && q.maxValueStr !== '' && !isNaN(q.minValueStr) && !isNaN(q.maxValueStr)) {
        if (parseFloat(q.minValueStr) > parseFloat(q.maxValueStr)) {
          toast.error(`"${q.fieldLabel || 'Question'}": Min value (${q.minValueStr}) cannot be greater than max value (${q.maxValueStr})`);
          return;
        }
      }
      
      // Default value validation
      if (q.defaultValue) {
        const err = validateDefaultValue(q, q.defaultValue);
        if (err && err.level === 'error') {
          toast.error(`"${q.fieldLabel || 'Question'}": ${err.message}`);
          // Set activeIdx to the question with the error to show it in settings
          const idx = questions.indexOf(q);
          if (idx !== -1) setActiveIdx(idx);
          return;
        }
      }
    }

    if (status.published && !status.hasDraft) {
      const result = await Swal.fire({
        title: 'Form Update',
        text: 'Draft submission of this version was discarded due to a form update.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Proceed',
        confirmButtonColor: 'var(--gf-purple)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)'
      });

      if (!result.isConfirmed) {
        return false;
      }
    }

    setSaving(true);
    try {
      // Save form title/description/settings
      await formsApi.update(formId, { 
        name: form.name, 
        description: form.description,
        oneSubmissionPerUser: form.oneSubmissionPerUser,
        unpublishTime: form.unpublishTime
      });

      // Save questions
      for (const q of questions) {
        const payload = {
          fieldKey: q.fieldKey || undefined, // Backend will generate if missing
          fieldLabel: q.fieldLabel,
          fieldType: q.fieldType,
          required: q.required,
          fieldOrder: q.fieldOrder,
          options: HAS_OPTIONS.includes(q.fieldType) ? q.options : undefined,
          minValue: HAS_SCALE.includes(q.fieldType) ? q.minValue : undefined,
          maxValue: HAS_SCALE.includes(q.fieldType) ? q.maxValue : undefined,
          minLabel: HAS_SCALE.includes(q.fieldType) ? q.minLabel : undefined,
          maxLabel: HAS_SCALE.includes(q.fieldType) ? q.maxLabel : undefined,
          minValueStr: HAS_MINMAX.includes(q.fieldType) ? (q.minValueStr || undefined) : undefined,
          maxValueStr: HAS_MINMAX.includes(q.fieldType) ? (q.maxValueStr || undefined) : undefined,
          helpText: q.helpText || undefined,
          // Text validation
          charType: (HAS_FULL_TEXT_VAL.includes(q.fieldType) && q.charType) ? q.charType : undefined,
          minLength: (HAS_FULL_TEXT_VAL.includes(q.fieldType) || HAS_BASIC_TEXT_VAL.includes(q.fieldType)) && q.minLength !== '' ? (q.minLength || undefined) : undefined,
          maxLength: (HAS_FULL_TEXT_VAL.includes(q.fieldType) || HAS_BASIC_TEXT_VAL.includes(q.fieldType)) && q.maxLength !== '' ? (q.maxLength || undefined) : undefined,
          trimWhitespace: (HAS_FULL_TEXT_VAL.includes(q.fieldType) || HAS_BASIC_TEXT_VAL.includes(q.fieldType)) ? q.trimWhitespace : undefined,
          removeExtraSpaces: (HAS_FULL_TEXT_VAL.includes(q.fieldType) || HAS_BASIC_TEXT_VAL.includes(q.fieldType)) ? q.removeExtraSpaces : undefined,
          allowSpecialChars: HAS_FULL_TEXT_VAL.includes(q.fieldType) ? q.allowSpecialChars : undefined,
          customRegex: (HAS_FULL_TEXT_VAL.includes(q.fieldType) || HAS_BASIC_TEXT_VAL.includes(q.fieldType)) && q.customRegex ? q.customRegex : undefined,
          isUnique: ['EMAIL', 'NUMBER', 'PHONE'].includes(q.fieldType) ? (q.isUnique || false) : undefined,
          allowedFileTypes: q.fieldType === 'FILE' ? q.allowedFileTypes : undefined,
          dataSourceTable: q.fieldType === 'DROPDOWN' ? q.dataSourceTable : undefined,
          dataSourceColumn: q.fieldType === 'DROPDOWN' ? q.dataSourceColumn : undefined,
          defaultValue: q.defaultValue || undefined,
          customPlaceholder: HAS_PLACEHOLDER.includes(q.fieldType) ? (q.customPlaceholder || undefined) : undefined,
        };

        if (q.id) {
          // UPDATE EXISTING
          await formsApi.updateField(formId, q.id, payload);
        } else {
          // ADD NEW
          if (!q.fieldLabel.trim()) {
            toast.warning('Please fill in all question labels before saving');
            setSaving(false);
            return;
          }
          await formsApi.addField(formId, payload);
        }
      }

      // Save reorder if needed (for all items)
      const fieldOrders = questions.map((q, i) => ({
        fieldId: q.id,
        fieldOrder: i + 1
      })).filter(item => item.fieldId); // only existing ones

      if (fieldOrders.length > 0) {
        await formsApi.reorderFields(formId, fieldOrders);
      }

      // Refresh fields from server
      const res = await formsApi.getFields(formId);
      setQuestions((Array.isArray(res.data) ? res.data : []).map(f => {
        let parsedOptions = ['Option 1'];
        try {
          if (f.options) {
            parsedOptions = JSON.parse(f.options);
          } else if (HAS_GRID.includes(f.fieldType)) {
            parsedOptions = { rows: ['Row 1'], columns: ['Column 1'] };
          }
        } catch(e) { console.error("Parse options error", e); }

        return {
          ...f, _id: f.id, _saved: true,
          options: parsedOptions,
        minValue: f.minValue ?? 1, maxValue: f.maxValue ?? 5,
        minLabel: f.minLabel ?? '', maxLabel: f.maxLabel ?? '',
        minValueStr: f.minValueStr ?? '', maxValueStr: f.maxValueStr ?? '',
        charType: f.charType ?? '',
        minLength: f.minLength ?? '',
        maxLength: f.maxLength ?? '',
        trimWhitespace: f.trimWhitespace ?? true,
        removeExtraSpaces: f.removeExtraSpaces ?? true,
        allowSpecialChars: f.allowSpecialChars ?? true,
        customRegex: f.customRegex ?? '',
        isUnique: f.isUnique ?? false,
        allowedFileTypes: f.allowedFileTypes ?? '',
        defaultValue: f.defaultValue ?? '',
        customPlaceholder: f.customPlaceholder ?? '',
      };
    }));
      // Refresh status to show "Draft Pending" warning if a new draft was created
      const statusRes = await formsApi.getStatus(formId);
      setStatus(statusRes.data);

      toast.success('Form saved!');
      return true;   // ← signal success to callers
    } catch (e) {
      toast.error(e.message || 'Save failed');
      return false;  // ← signal failure
    } finally {
      setSaving(false);
    }
  };

  const publishForm = async () => {
    // Save first
    const savedOk = await saveAll();
    if (!savedOk) return;

    const isAdmin = user?.role === 'ADMIN';
    let note = '';

    // For sub-users, show a note popup
    if (!isAdmin) {
      const { value: enteredNote, isConfirmed } = await Swal.fire({
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

      if (!isConfirmed) return;
      note = enteredNote;
    } else {
      // For admins, standard publish confirmation (optional but good)
      const result = await Swal.fire({
        title: 'Publish Form?',
        text: 'This will make the form public and create a new version.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Publish Now',
        confirmButtonColor: '#0f9d58',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      });

      if (!result.isConfirmed) return;
    }

    setPublishing(true);
    try {
      const res = await formsApi.publish(formId, { note });
      if (res.status === 202) {
        toast.info(res.data.message || 'Publish request sent to your administrator.');
        router.push('/forms');
      } else {
        setStatus({ published: true, shareLink: res.data.shareLink });
        toast.success('Form published! Share link is ready.');
        router.push('/forms');
      }
    } catch (e) {
      toast.error(e.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = () => {
    const url = window.location.origin + '/publish/' + formId;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  if (loading) return <div className="gf-loader"><div className="gf-spinner" /><span>Loading form...</span></div>;

  if (deleted) return (
    <div className="gf-error-page">
      <div className="gf-error-card">
        <h1>This form has been deleted.</h1>
        <p>This form is currently in the trash. You must recover it before you can make any changes.</p>
        <Link href="/forms" className="gf-btn gf-btn-primary">Back to My Forms</Link>
      </div>
    </div>
  );

  if (driftError) return (
    <div className="gf-error-page">
      <div className="gf-error-card" style={{ borderColor: '#d93025' }}>
        <h1 style={{ color: '#d93025' }}>⚠️ Database Schema Drift Detected</h1>
        <p style={{ fontWeight: '500' }}>{driftError}</p>
        <p>The database table for this form has been modified outside of this application. To prevent data corruption, editing is disabled.</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/forms" className="gf-btn gf-btn-outline">Back to My Forms</Link>
            <button className="gf-btn gf-btn-primary" onClick={() => window.location.reload()}>🔄 Retry Check</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Topbar actions */}
      <div className="page-header-gf">
        <div>
          <Link href="/forms" className="gf-btn gf-btn-ghost gf-btn-sm" style={{ marginBottom: '6px' }}>← Back</Link>
          <h1 style={{ marginTop: '4px' }}>{form?.name || 'Untitled form'}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {status.published && (
            <button className="gf-btn gf-btn-outline gf-btn-sm" onClick={copyLink}>🔗 Copy Link</button>
          )}
          <Link href={`/forms/${formId}/responses`} className="gf-btn gf-btn-outline gf-btn-sm">📊 Responses</Link>
          <button
            className="gf-btn gf-btn-outline gf-btn-sm"
            disabled={saving}
            onClick={async () => {
              const ok = await saveAll();
              if (ok) router.push(`/forms/${formId}/rules`);
            }}
          >⚙️ Rules</button>
          <button 
            className={`gf-btn gf-btn-outline ${saving ? 'disabled' : ''}`} 
            onClick={saveAll} 
            disabled={saving}
          >
            {saving ? '⏳ Saving...' : '💾 Save Draft'}
          </button>
          <button 
            className={`gf-btn gf-btn-primary ${publishing ? 'disabled' : ''}`} 
            onClick={publishForm} 
            disabled={publishing}
          >
            {user?.role === 'USER' ? (
              publishing ? '⏳ Sending Request...' : '🚀 Send Approval Request'
            ) : (
              status.published ? (publishing ? '⏳ Updating...' : '🚀 Update Live Form') : (publishing ? '⏳ Publishing...' : '🚀 Publish')
            )}
          </button>
        </div>
      </div>

      {status.published && (
        <div className="share-link-box" style={{ 
          marginBottom: '16px', 
          background: status.hasDraft ? '#fff8e1' : '#e8f0fe', 
          border: `1px solid ${status.hasDraft ? '#ffc107' : '#4285f4'}` 
        }}>
          <span style={{ color: status.hasDraft ? '#ff8f00' : '#4285f4' }}>{status.hasDraft ? '⚠️' : 'ℹ️'}</span>
          <div className="share-link-url" style={{ color: status.hasDraft ? '#ff8f00' : '#4285f4', fontWeight: '500' }}>
            {status.hasDraft 
              ? "You are editing a DRAFT version. These changes will not be live until you click 'Update Live Form'." 
              : "This form is live. Any changes you save will create a new draft for you to review before publishing."}
          </div>
          <button className="share-copy-btn" style={{ borderColor: status.hasDraft ? '#ffc107' : '#4285f4' }} onClick={copyLink}>Copy Link</button>
        </div>
      )}

      <div className="editor-main-layout" onDragOver={handleGlobalDragOver} onDrop={handleGlobalDrop}>
        {/* Left Sidebar: Field Picker */}
        <aside className="field-picker-sidebar">
          <div className="field-picker-title">Add Elements</div>
          <div className="field-picker-grid">
            {FIELD_TYPES.map(t => (
              <button
                key={t.value}
                className="field-picker-item"
                onClick={() => addQuestion(t.value)}
                draggable
                onDragStart={(e) => handleDragStart(e, t.value)}
              >
                <span className="icon">{t.icon}</span>
                <span>{t.label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Editor Content */}
        <div className="editor-content-area">
          {/* Title card */}
          <div className={`form-title-card ${activeIdx === null ? 'active' : ''}`} onClick={() => setActiveIdx(null)}>
            <input
              className="form-title-input"
              placeholder="Untitled form"
              value={form?.name || ''}
              onChange={e => updateForm('name', e.target.value)}
            />
            <textarea
              className="form-desc-input"
              placeholder="Form description (optional)"
              value={form?.description || ''}
              onChange={e => updateForm('description', e.target.value)}
              rows={2}
            />
          </div>

          {/* Questions */}
          {questions.map((q, idx) => (
             <div
              key={q._id || q.id}
              className={`question-card ${IS_LAYOUT.includes(q.fieldType) ? 'heading-type' : ''}${activeIdx === idx ? ' active' : ''}${dragOverIdx === idx ? ` drag-over-${dropPosition}` : ''}${draggedIdx === idx ? ' dragging' : ''}`}
              onClick={() => setActiveIdx(idx)}
              onDragOver={(e) => onQuestionDragOver(e, idx)}
              onDrop={(e) => onQuestionDrop(e, idx)}
              onDragLeave={() => { setDragOverIdx(null); setDropPosition(null); }}
            >
              <div
                className="drag-handle"
                draggable
                onDragStart={(e) => onQuestionDragStart(e, idx)}
              />
              <div className="question-card-top">
                <input
                  className="question-title-input"
                   placeholder={IS_LAYOUT.includes(q.fieldType) ? (q.fieldType === 'PAGE_BREAK' ? 'Section Title' : 'Title') : 'Question'}
                  value={q.fieldLabel}
                  onChange={e => updateQ(idx, 'fieldLabel', e.target.value)}
                  disabled={status.published && q.isOriginal}
                />
              <span className="q-type-badge">{FIELD_TYPES.find(t => t.value === q.fieldType)?.label.split(' ').slice(1).join(' ')}</span>
              </div>

              {/* Help/Description text */}
              {(q.helpText !== undefined || IS_LAYOUT.includes(q.fieldType)) && (
                <textarea
                  className="question-help-text"
                  placeholder={IS_LAYOUT.includes(q.fieldType) ? 'Description (optional)' : 'Help text (optional)'}
                  value={q.helpText || ''}
                  rows={IS_LAYOUT.includes(q.fieldType) ? 2 : 1}
                  onChange={e => updateQ(idx, 'helpText', e.target.value)}
                  disabled={status.published && q.isOriginal}
                />
              )}

               {/* Options editor */}
              {HAS_CHOICES.includes(q.fieldType) && (
                <div style={{ marginTop: '16px' }}>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="option-row">
                      {q.fieldType === 'CHECKBOXES'
                        ? <div className="option-check" />
                        : q.fieldType === 'DROPDOWN'
                          ? <span style={{ color: 'var(--gf-text-secondary)', fontSize: '0.85rem', width: '20px' }}>{oi + 1}.</span>
                          : <div className="option-radio" />}
                        <input
                          className="option-input"
                          value={opt}
                          onChange={e => updateOption(idx, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                          disabled={status.published && q.isOriginal}
                        />
                      <button className="option-delete-btn" onClick={() => removeOption(idx, oi)}>✕</button>
                    </div>
                  ))}
                    <button className="add-option-btn" onClick={() => addOption(idx)} disabled={status.published && q.isOriginal}>
                      ＋ Add option
                    </button>
                </div>
              )}

              {/* Linear scale editor */}
              {HAS_SCALE.includes(q.fieldType) && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--gf-text-secondary)' }}>
                      Min:&nbsp;
                      <input type="number" min={0} max={1} value={q.minValue}
                        onChange={e => updateQ(idx, 'minValue', parseInt(e.target.value))}
                        disabled={status.published && q.isOriginal}
                        style={{ width: '50px', border: '1px solid var(--gf-border)', borderRadius: '3px', padding: '3px 6px' }}
                      />
                    </label>
                    <label style={{ fontSize: '0.85rem', color: 'var(--gf-text-secondary)' }}>
                      Max:&nbsp;
                      <select value={q.maxValue} onChange={e => updateQ(idx, 'maxValue', parseInt(e.target.value))}
                        disabled={status.published && q.isOriginal}
                        style={{ border: '1px solid var(--gf-border)', borderRadius: '3px', padding: '3px 6px' }}>
                        {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="scale-row">
                    {Array.from({ length: q.maxValue - q.minValue + 1 }, (_, i) => i + q.minValue).map(n => (
                      <div key={n} className="scale-value">{n}</div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <input className="option-input" placeholder="Min label (e.g. Not at all)" value={q.minLabel}
                      onChange={e => updateQ(idx, 'minLabel', e.target.value)} style={{ flex: 1 }} disabled={status.published && q.isOriginal} />
                    <input className="option-input" placeholder="Max label (e.g. Definitely)" value={q.maxLabel}
                      onChange={e => updateQ(idx, 'maxLabel', e.target.value)} style={{ flex: 1 }} disabled={status.published && q.isOriginal} />
                  </div>
                </div>
              )}

              {/* Preview for simple types */}
              {!HAS_OPTIONS.includes(q.fieldType) && !HAS_SCALE.includes(q.fieldType) && !IS_LAYOUT.includes(q.fieldType) && (
                <div style={{ marginTop: '12px' }}>
                  {q.fieldType === 'TOGGLE' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                      <label className="required-toggle" style={{ pointerEvents: 'none' }}>
                        <input type="checkbox" checked={true} readOnly />
                        <span className="required-toggle-slider"></span>
                      </label>
                      <span style={{ fontSize: '0.9rem', color: 'var(--gf-text-secondary)' }}>Toggle Switch Preview</span>
                    </div>
                  ) : (
                    <div style={{ borderBottom: '1px dashed var(--gf-border)', padding: '8px 0', fontSize: '0.9rem', color: 'var(--gf-text-placeholder)' }}>
                      {q.customPlaceholder || (
                       q.fieldType === 'PARAGRAPH' ? 'Long answer text' :
                       q.fieldType === 'DATE' ? 'MM/DD/YYYY' :
                       q.fieldType === 'TIME' ? 'HH:MM' :
                       q.fieldType === 'DATE_TIME' ? 'MM/DD/YYYY, HH:MM' :
                       q.fieldType === 'MONTH' ? 'Month, YYYY' :
                       q.fieldType === 'WEEK' ? 'Week WW, YYYY' :
                       q.fieldType === 'EMAIL' ? 'example@email.com' :
                       q.fieldType === 'NUMBER' ? '0' :
                       q.fieldType === 'PASSWORD' ? '••••••••' :
                       q.fieldType === 'COLOR' ? 'Select a color' :
                       q.fieldType === 'FILE' ? 'Upload a file' :
                       q.fieldType === 'PHONE' ? '+1 (___) ___-____' :
                       q.fieldType === 'URL' ? 'https://example.com' :
                       q.fieldType === 'SEARCH' ? '🔍 Search...' :
                       'Short answer text'
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Grid Preview */}
              {HAS_GRID.includes(q.fieldType) && (
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--gf-text-secondary)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ borderBottom: '1px solid var(--gf-border)' }}></th>
                        {(q.options?.columns || ['Column 1']).map((col, i) => (
                          <th key={i} style={{ borderBottom: '1px solid var(--gf-border)', padding: '4px' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(q.options?.rows || ['Row 1']).map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px', borderBottom: '1px solid var(--gf-border)' }}>{row}</td>
                          {(q.options?.columns || ['Column 1']).map((_, j) => (
                            <td key={j} style={{ textAlign: 'center', borderBottom: '1px solid var(--gf-border)' }}>
                              <div style={{ width: '12px', height: '12px', border: '1px solid var(--gf-border)', borderRadius: q.fieldType === 'MC_GRID' ? '50%' : '2px', margin: '0 auto' }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Rating Preview */}
              {q.fieldType === 'RATING' && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '4px' }}>
                  {Array.from({ length: q.maxValue || 5 }).map((_, i) => (
                    <span key={i} className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#ccc' }}>star_rate</span>
                  ))}
                </div>
              )}
            </div>
          ))}
{/* 
          <div className="add-question-fab">
            <button className="add-question-btn" onClick={() => addQuestion()} title="Add question">＋</button>
          </div> */}
        </div>

        {/* Right Sidebar: Element Settings */}
        <aside className="settings-sidebar">
          <div className="settings-title">Settings</div>
          {activeIdx !== null && questions[activeIdx] ? (
            <div className="settings-content">

              {/* Field ID (Key) is now auto-generated on backend */}
              {/* <div className="settings-group">
                <label className="settings-label">Field ID (Key)</label>
                <input 
                  className="settings-input"
                  value={questions[activeIdx].fieldKey}
                  onChange={(e) => updateQ(activeIdx, 'fieldKey', e.target.value)}
                  placeholder="e.g. user_name"
                />
              </div> */}

              <div className="settings-group">
                <label className="settings-label">Help Text</label>
                <textarea 
                  className="settings-input settings-textarea"
                  value={questions[activeIdx].helpText || ''}
                  onChange={(e) => updateQ(activeIdx, 'helpText', e.target.value)}
                  placeholder="Instructions for users..."
                  disabled={status.published && questions[activeIdx].isOriginal}
                />
              </div>

              {!IS_LAYOUT.includes(questions[activeIdx].fieldType) && questions[activeIdx].fieldType !== 'FILE' && !questions[activeIdx].required && (
                <div className="settings-group">
                  <label className="settings-label">Default Value</label>
                  {(() => {
                    const q = questions[activeIdx];
                    const commonProps = {
                      className: "settings-input",
                      value: q.defaultValue || '',
                      onChange: (e) => updateQ(activeIdx, 'defaultValue', e.target.value),
                      disabled: status.published && q.isOriginal,
                    };

                    if (q.fieldType === 'PARAGRAPH') {
                      return <textarea {...commonProps} id={`default-value-${activeIdx}`} rows={3} placeholder="Long default answer..." className="settings-input settings-textarea"
                        onBlur={(e) => {
                          const val = e.target.value;
                          const err = validateDefaultValue(q, val);
                          if (err) {
                            if (err.level === 'error') toast.error(err.message);
                            else toast.warning(err.message);
                            
                            if (err.truncate && q.maxLength) {
                              updateQ(activeIdx, 'defaultValue', val.substring(0, q.maxLength));
                            }
                          }
                        }}
                      />;
                    }
                    if (q.fieldType === 'NUMBER') {
                      return <input type="number" {...commonProps} id={`default-value-${activeIdx}`} placeholder="Default number..."
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (q.minValueStr && val < Number(q.minValueStr)) {
                            toast.error(`Default value must be ≥ ${q.minValueStr}`);
                            updateQ(activeIdx, 'defaultValue', q.minValueStr);
                          } else if (q.maxValueStr && val > Number(q.maxValueStr)) {
                            toast.error(`Default value must be ≤ ${q.maxValueStr}`);
                            updateQ(activeIdx, 'defaultValue', q.maxValueStr);
                          }
                        }}
                      />;
                    }
                    if (['MULTIPLE_CHOICE', 'DROPDOWN'].includes(q.fieldType)) {
                      return (
                        <select {...commonProps}>
                          <option value="">-- No Default --</option>
                          {q.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                        </select>
                      );
                    }
                    if (q.fieldType === 'TOGGLE') {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={q.defaultValue === 'true'} 
                            onChange={e => updateQ(activeIdx, 'defaultValue', e.target.checked ? 'true' : 'false')}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--gf-purple)' }}
                            disabled={status.published && q.isOriginal}
                          />
                          <span style={{ fontSize: '0.85rem', color: 'var(--gf-text-secondary)' }}>Default to ON</span>
                        </div>
                      );
                    }
                    if (['DATE', 'TIME', 'DATE_TIME', 'MONTH', 'WEEK'].includes(q.fieldType)) {
                      return <input type={minMaxInputType(q.fieldType)} {...commonProps} id={`default-value-${activeIdx}`}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (q.minValueStr && val < q.minValueStr) {
                             toast.error(`Default value must be on or after ${q.minValueStr}`);
                             updateQ(activeIdx, 'defaultValue', q.minValueStr);
                          } else if (q.maxValueStr && val > q.maxValueStr) {
                             toast.error(`Default value must be on or before ${q.maxValueStr}`);
                             updateQ(activeIdx, 'defaultValue', q.maxValueStr);
                          }
                          
                          const err = validateDefaultValue(q, val);
                          if (err) {
                            if (err.level === 'error') toast.error(err.message);
                            else toast.warning(err.message);
                          }
                        }}
                      />;
                    }
                    if (q.fieldType === 'COLOR') {
                      return <input type="color" {...commonProps} style={{ height: '40px', padding: '2px' }} />;
                    }
                    if (HAS_SCALE.includes(q.fieldType)) {
                      return (
                         <select {...commonProps}>
                            <option value="">-- No Default --</option>
                            {Array.from({ length: q.maxValue - q.minValue + 1 }, (_, i) => i + q.minValue).map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                         </select>
                      );
                    }
                    if (q.fieldType === 'CHECKBOXES') {
                      const selected = (q.defaultValue || '').split(',').map(s => s.trim()).filter(s => s);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {q.options.map((opt, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input 
                                type="checkbox" 
                                checked={selected.includes(opt)}
                                onChange={e => {
                                  let next;
                                  if (e.target.checked) next = [...selected, opt];
                                  else next = selected.filter(s => s !== opt);
                                  updateQ(activeIdx, 'defaultValue', next.join(','));
                                }}
                                style={{ accentColor: 'var(--gf-purple)' }}
                                disabled={status.published && q.isOriginal}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      );
                    }
                    if (HAS_GRID.includes(q.fieldType)) {
                      const gridOptions = q.options || { rows: [], columns: [] };
                      let gridDefaults = {};
                      try { gridDefaults = JSON.parse(q.defaultValue || '{}'); } catch(e) {}
                      
                      return (
                        <div style={{ overflowX: 'auto', border: '1px solid var(--gf-border)', borderRadius: '4px', padding: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr>
                                <th></th>
                                {gridOptions.columns.map((col, i) => <th key={i} style={{ padding: '4px' }}>{col}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {gridOptions.rows.map((row, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '4px', fontWeight: 'bold' }}>{row}</td>
                                  {gridOptions.columns.map((col, j) => (
                                    <td key={j} style={{ textAlign: 'center', padding: '4px' }}>
                                      <input 
                                        type={q.fieldType === 'MC_GRID' ? 'radio' : 'checkbox'}
                                        name={`default_${q.fieldKey}_${i}`}
                                        checked={q.fieldType === 'MC_GRID' ? gridDefaults[row] === col : (gridDefaults[row] || []).includes(col)}
                                        disabled={status.published && q.isOriginal}
                                        onChange={e => {
                                          let next = { ...gridDefaults };
                                          if (q.fieldType === 'MC_GRID') {
                                            if (e.target.checked) next[row] = col;
                                          } else {
                                            let rowVals = next[row] || [];
                                            if (e.target.checked) rowVals = [...rowVals, col];
                                            else rowVals = rowVals.filter(v => v !== col);
                                            next[row] = rowVals;
                                          }
                                          updateQ(activeIdx, 'defaultValue', JSON.stringify(next));
                                        }}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button 
                            className="gf-btn-text" 
                            style={{ fontSize: '0.7rem', marginTop: '8px' }}
                            onClick={() => updateQ(activeIdx, 'defaultValue', '')}
                          >Clear Grid Defaults</button>
                        </div>
                      );
                    }
                    
                    return <input type="text" {...commonProps} id={`default-value-${activeIdx}`} placeholder="Default answer..." 
                      onChange={(e) => {
                        let val = e.target.value;
                        if (q.fieldType === 'PHONE') val = val.replace(/\D/g, '');
                        updateQ(activeIdx, 'defaultValue', val);
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const err = validateDefaultValue(q, val);
                        if (err) {
                          if (err.level === 'error') toast.error(err.message);
                          else toast.warning(err.message);
                          
                          if (err.truncate && q.maxLength) {
                            updateQ(activeIdx, 'defaultValue', val.substring(0, q.maxLength));
                          }
                        }
                      }}
                    />;
                  })()}
                </div>
              )}

              {HAS_PLACEHOLDER.includes(questions[activeIdx].fieldType) && (
                <div className="settings-group">
                  <label className="settings-label">Custom Placeholder</label>
                  <input 
                    className="settings-input"
                    value={questions[activeIdx].customPlaceholder || ''}
                    onChange={(e) => updateQ(activeIdx, 'customPlaceholder', e.target.value)}
                    placeholder="Enter custom placeholder text..."
                    disabled={status.published && questions[activeIdx].isOriginal}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--gf-text-secondary)', marginTop: '4px' }}>
                    If empty, the system default will be used.
                  </div>
                </div>
              )}

              {!IS_LAYOUT.includes(questions[activeIdx].fieldType) && (
                <>
                  <div className="settings-toggle-row">
                    <span className="settings-label" style={{ marginBottom: 0 }}>Required</span>
                    <input
                      type="checkbox"
                      checked={questions[activeIdx].required || false}
                      disabled={status.published && questions[activeIdx].isOriginal}
                      onChange={(e) => updateQ(activeIdx, 'required', e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--gf-purple)' }}
                    />
                  </div>

                  {['EMAIL', 'NUMBER', 'PHONE'].includes(questions[activeIdx].fieldType) && (
                    <div className="settings-toggle-row" style={{ marginTop: '8px' }}>
                      <span className="settings-label" style={{ marginBottom: 0 }}>Unique Value</span>
                      <input
                        type="checkbox"
                        checked={questions[activeIdx].isUnique || false}
                        disabled={status.published && questions[activeIdx].isOriginal}
                        onChange={(e) => updateQ(activeIdx, 'isUnique', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--gf-purple)' }}
                      />
                    </div>
                  )}
                </>
              )}

              {HAS_SCALE.includes(questions[activeIdx].fieldType) && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <label className="settings-label">Scale Range</label>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <input type="number" min={0} max={1} className="settings-input" value={questions[activeIdx].minValue} onChange={e => updateQ(activeIdx, 'minValue', parseInt(e.target.value))} disabled={status.published && questions[activeIdx].isOriginal} />
                    <span>to</span>
                    <select className="settings-input" value={questions[activeIdx].maxValue} onChange={e => updateQ(activeIdx, 'maxValue', parseInt(e.target.value))} disabled={status.published && questions[activeIdx].isOriginal}>
                      {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div style={{marginTop: '12px'}}>
                    <label className="settings-label">Labels</label>
                    <input className="settings-input" placeholder="Min label" value={questions[activeIdx].minLabel} onChange={e => updateQ(activeIdx, 'minLabel', e.target.value)} style={{marginBottom: '8px'}} disabled={status.published && questions[activeIdx].isOriginal} />
                    <input className="settings-input" placeholder="Max label" value={questions[activeIdx].maxLabel} onChange={e => updateQ(activeIdx, 'maxLabel', e.target.value)} disabled={status.published && questions[activeIdx].isOriginal} />
                  </div>
                </div>
              )}

              {HAS_MINMAX.includes(questions[activeIdx].fieldType) && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <label className="settings-label">Value Range</label>
                  <div style={{fontSize: '0.75rem', color: 'var(--gf-text-secondary)', marginBottom: '8px'}}>
                    Leave empty for no limit (−∞ / +∞)
                  </div>
                  <div style={{marginBottom: '8px'}}>
                    <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>Minimum Value</label>
                    <input
                      type={minMaxInputType(questions[activeIdx].fieldType)}
                      className="settings-input"
                      value={questions[activeIdx].minValueStr || ''}
                      onChange={e => updateQ(activeIdx, 'minValueStr', e.target.value)}
                      placeholder="No minimum"
                      disabled={status.published && questions[activeIdx].isOriginal}
                    />
                  </div>
                  <div>
                    <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>Maximum Value</label>
                    <input
                      type={minMaxInputType(questions[activeIdx].fieldType)}
                      className="settings-input"
                      value={questions[activeIdx].maxValueStr || ''}
                      onChange={e => updateQ(activeIdx, 'maxValueStr', e.target.value)}
                      placeholder="No maximum"
                      disabled={status.published && questions[activeIdx].isOriginal}
                    />
                  </div>
                </div>
              )}

              {/* Grid Rows and Columns */}
              {HAS_GRID.includes(questions[activeIdx].fieldType) && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <div style={{marginBottom: '16px'}}>
                    <label className="settings-label" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      Rows
                      <button className="gf-btn-text" style={{fontSize: '0.75rem', color: 'var(--gf-purple)'}} 
                        disabled={status.published && questions[activeIdx].isOriginal} 
                        onClick={() => {
                        const currentOptions = questions[activeIdx].options || { rows: ['Row 1'], columns: ['Column 1'] };
                        const rows = currentOptions.rows || ['Row 1'];
                        updateQ(activeIdx, 'options', { ...currentOptions, rows: [...rows, `Row ${rows.length + 1}`] });
                      }}>+ Add Row</button>
                    </label>
                    {(questions[activeIdx].options?.rows || ['Row 1']).map((row, rIdx) => (
                      <div key={rIdx} style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                         <input 
                          className="settings-input" 
                          value={row} 
                          disabled={status.published && questions[activeIdx].isOriginal}
                          onChange={e => {
                            const currentOptions = questions[activeIdx].options || { rows: ['Row 1'], columns: ['Column 1'] };
                            const rows = [...(currentOptions.rows || [])];
                            rows[rIdx] = e.target.value;
                            updateQ(activeIdx, 'options', { ...currentOptions, rows });
                          }}
                        />
                        <button className="option-delete-btn" style={{padding: '4px'}} 
                          disabled={status.published && questions[activeIdx].isOriginal} 
                          onClick={() => {
                          const currentOptions = questions[activeIdx].options || { rows: ['Row 1'], columns: ['Column 1'] };
                          const rows = (currentOptions.rows || []).filter((_, i) => i !== rIdx);
                          updateQ(activeIdx, 'options', { ...currentOptions, rows });
                        }}>✕</button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="settings-label" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      Columns
                      <button className="gf-btn-text" style={{fontSize: '0.75rem', color: 'var(--gf-purple)'}} 
                        disabled={status.published && questions[activeIdx].isOriginal}
                        onClick={() => {
                        const currentOptions = questions[activeIdx].options || { rows: ['Row 1'], columns: ['Column 1'] };
                        const cols = currentOptions.columns || ['Column 1'];
                        updateQ(activeIdx, 'options', { ...currentOptions, columns: [...cols, `Column ${cols.length + 1}`] });
                      }}>+ Add Column</button>
                    </label>
                    {(questions[activeIdx].options?.columns || ['Column 1']).map((col, cIdx) => (
                      <div key={cIdx} style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                         <input 
                          className="settings-input" 
                          value={col} 
                          disabled={status.published && questions[activeIdx].isOriginal}
                          onChange={e => {
                            const currentOptions = questions[activeIdx].options || { rows: ['Row 1'], columns: ['Column 1'] };
                            const cols = [...(currentOptions.columns || [])];
                            cols[cIdx] = e.target.value;
                            updateQ(activeIdx, 'options', { ...currentOptions, columns: cols });
                          }}
                        />
                        <button className="option-delete-btn" style={{padding: '4px'}} 
                          disabled={status.published && questions[activeIdx].isOriginal}
                          onClick={() => {
                          const currentOptions = questions[activeIdx].options || { rows: ['Row 1'], columns: ['Column 1'] };
                          const cols = (currentOptions.columns || []).filter((_, i) => i !== cIdx);
                          updateQ(activeIdx, 'options', { ...currentOptions, columns: cols });
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Validation Settings — Full (SHORT_ANSWER, PARAGRAPH, PASSWORD, SEARCH) */}
              {HAS_FULL_TEXT_VAL.includes(questions[activeIdx].fieldType) && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <label className="settings-label">Text Validation</label>

                  {/* Character Type */}
                  <div style={{marginBottom: '12px'}}>
                    {/* <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '6px'}}>Character Type</label> */}
                    {[['LETTERS', 'Letters only'], ['NUMBERS', 'Numbers only'], ['BOTH', 'Letters & Numbers']].map(([val, lbl]) => (
                      <label key={val} style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.85rem', cursor: 'pointer'}}>
                        <input type="radio" name={`charType_${activeIdx}`} value={val}
                          checked={questions[activeIdx].charType === val}
                          disabled={status.published && questions[activeIdx].isOriginal}
                          onChange={() => updateQ(activeIdx, 'charType', val)}
                          style={{accentColor: 'var(--gf-purple)'}}
                        />
                        {lbl}
                      </label>
                    ))}
                  </div>

                  {/* Min / Max Length */}
                  <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
                    <div style={{flex: 1}}>
                      <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>Min Length</label>
                      <input type="number" min={0} className="settings-input"
                        placeholder="None"
                        value={questions[activeIdx].minLength}
                        onChange={e => updateQ(activeIdx, 'minLength', e.target.value === '' ? '' : parseInt(e.target.value))}
                      />
                    </div>
                    <div style={{flex: 1}}>
                      <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>Max Length</label>
                      <input type="number" min={0} className="settings-input"
                        placeholder="None"
                        value={questions[activeIdx].maxLength}
                        onChange={e => updateQ(activeIdx, 'maxLength', e.target.value === '' ? '' : parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  {[['trimWhitespace', 'Trim whitespace'], ['removeExtraSpaces', 'Remove extra spaces'], ['allowSpecialChars', 'Allow special characters']].map(([key, lbl]) => (
                    <div key={key} className="settings-toggle-row" style={{marginBottom: '6px'}}>
                      <span style={{fontSize: '0.85rem', color: 'var(--gf-text-secondary)'}}>{lbl}</span>
                      <input type="checkbox"
                        checked={questions[activeIdx][key] ?? true}
                        onChange={e => updateQ(activeIdx, key, e.target.checked)}
                        style={{width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--gf-purple)'}}
                      />
                    </div>
                  ))}

                </div>
              )}

              {/* Text Validation Settings — Basic (EMAIL, PHONE, URL) */}
              {HAS_BASIC_TEXT_VAL.includes(questions[activeIdx].fieldType) && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <label className="settings-label">Text Validation</label>

                  {/* Min / Max Length — Only if NOT PHONE */}
                  {questions[activeIdx].fieldType !== 'PHONE' && (
                    <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
                      <div style={{flex: 1}}>
                        <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>Min Length</label>
                        <input type="number" min={0} className="settings-input"
                          placeholder="None"
                          value={questions[activeIdx].minLength}
                          onChange={e => updateQ(activeIdx, 'minLength', e.target.value === '' ? '' : parseInt(e.target.value))}
                        />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>Max Length</label>
                        <input type="number" min={0} className="settings-input"
                          placeholder="None"
                          value={questions[activeIdx].maxLength}
                          onChange={e => updateQ(activeIdx, 'maxLength', e.target.value === '' ? '' : parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Trim + Remove spaces toggles */}
                  {[['trimWhitespace', 'Trim whitespace'], ['removeExtraSpaces', 'Remove extra spaces']].map(([key, lbl]) => (
                    <div key={key} className="settings-toggle-row" style={{marginBottom: '6px'}}>
                      <span style={{fontSize: '0.85rem', color: 'var(--gf-text-secondary)'}}>{lbl}</span>
                      <input type="checkbox"
                        checked={questions[activeIdx][key] ?? true}
                        onChange={e => updateQ(activeIdx, key, e.target.checked)}
                        style={{width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--gf-purple)'}}
                      />
                    </div>
                  ))}

                </div>
              )}

              {/* File Validation Settings */}
              {questions[activeIdx].fieldType === 'FILE' && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <label className="settings-label">Allowed File Types</label>
                  <p style={{fontSize: '0.75rem', color: 'var(--gf-text-secondary)', marginBottom: '12px'}}>
                    Select which types of files users are allowed to upload.
                  </p>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                    {FILE_CATEGORIES.map(cat => {
                      const current = questions[activeIdx].allowedFileTypes || '';
                      const types = current ? current.split(',') : [];
                      const isChecked = types.includes(cat.value);
                      
                      return (
                        <label key={cat.value} className={`gf-file-type-chip ${isChecked ? 'active' : ''}`}>
                          <input 
                            type="checkbox" 
                            hidden 
                            checked={isChecked}
                            disabled={status.published && questions[activeIdx].isOriginal}
                            onChange={(e) => {
                              let next;
                              if (e.target.checked) next = [...types, cat.value];
                              else next = types.filter(t => t !== cat.value);
                              updateQ(activeIdx, 'allowedFileTypes', next.join(','));
                            }}
                          />
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {(questions[activeIdx].allowedFileTypes || '').length === 0 && (
                    <div style={{fontSize: '0.72rem', color: '#f59e0b', marginTop: '10px'}}>
                      ⚠ If no types are selected, any supported file will be allowed.
                    </div>
                  )}
                </div>
              )}

              {/* Dropdown Options Source Settings */}
              {activeIdx !== null && questions[activeIdx].fieldType === 'DROPDOWN' && (
                <div className="settings-group" style={{marginTop: '20px'}}>
                  <label className="settings-label">Options Data Source</label>
                  <div style={{marginBottom: '10px'}}>
                    <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>
                      Source Type
                    </label>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <select 
                        className="settings-input"
                        value={questions[activeIdx].dataSourceTable || questions[activeIdx]._usingDynamic ? 'DATABASE' : 'STATIC'}
                        disabled={status.published && questions[activeIdx].isOriginal}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'STATIC') {
                            updateQ(activeIdx, 'dataSourceTable', '');
                            updateQ(activeIdx, 'dataSourceColumn', '');
                            updateQ(activeIdx, '_usingDynamic', false);
                          } else {
                            updateQ(activeIdx, '_usingDynamic', true);
                            if (tables.length > 0) {
                              updateQ(activeIdx, 'dataSourceTable', tables[0].tableName);
                            }
                          }
                        }}
                        style={{flex: 1}}
                      >
                        <option value="STATIC">Static Options (Manual)</option>
                        <option value="DATABASE">Database Table (Dynamic)</option>
                      </select>
                      <button 
                        className="gf-btn-text" 
                        style={{fontSize: '0.8rem', padding: '0 4px'}} 
                        title="Refresh Tables"
                        disabled={status.published && questions[activeIdx].isOriginal}
                        onClick={async () => {
                          try {
                            const tRes = await metadataApi.getTables();
                            setTables(tRes.data || []);
                            toast.info("Tables list refreshed");
                          } catch (err) {
                            toast.error("Failed to refresh tables");
                          }
                        }}
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                  
                  {(questions[activeIdx].dataSourceTable || questions[activeIdx]._usingDynamic) && tables.length === 0 && (
                    <div style={{fontSize: '0.72rem', color: '#f59e0b', marginTop: '-8px', marginBottom: '16px', background: '#fffbeb', padding: '8px', border: '1px solid #fef3c7', borderRadius: '4px'}}>
                      ⚠ You haven't published any forms yet. Please publish a form first to use its submissions as a data source.
                    </div>
                  )}

                  {(questions[activeIdx].dataSourceTable || questions[activeIdx]._usingDynamic) && tables.length > 0 && (
                    <>
                      <div style={{marginBottom: '10px'}}>
                        <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>
                          Database Table
                        </label>
                        <select 
                          className="settings-input"
                          value={questions[activeIdx].dataSourceTable}
                          onChange={(e) => {
                            updateQ(activeIdx, 'dataSourceTable', e.target.value);
                            updateQ(activeIdx, 'dataSourceColumn', '');
                          }}
                        >
                          <option value="">-- Select Table --</option>
                          {tables.map(t => <option key={t.tableName} value={t.tableName}>{t.displayName}</option>)}
                        </select>
                      </div>

                      <div style={{marginBottom: '10px'}}>
                        <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>
                          Table Column
                        </label>
                        <select 
                          className="settings-input"
                          value={questions[activeIdx].dataSourceColumn}
                          onChange={(e) => updateQ(activeIdx, 'dataSourceColumn', e.target.value)}
                          disabled={!questions[activeIdx].dataSourceTable}
                        >
                          <option value="">-- Select Column --</option>
                          {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      
                      <div style={{fontSize: '0.72rem', color: 'var(--gf-text-secondary)', marginTop: '4px', lineHeight: '1.4', background: '#f8f9fa', padding: '8px', borderRadius: '4px', border: '1px solid #dee2e6'}}>
                        ℹ Static options will be ignored when a database source is selected.
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="settings-action-row" style={{marginTop: '30px'}}>
                <button 
                  className="gf-btn gf-btn-outline"
                  onClick={() => removeQuestion(activeIdx)}
                  style={{width: '100%', borderColor: 'var(--gf-red)', color: 'var(--gf-red)'}}
                >
                  🗑 Delete Element
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-content">
              <div className="settings-group">
                <label className="settings-label">Form Settings</label>
                
                <div className="settings-toggle-row" style={{marginBottom: '16px'}}>
                  <span className="settings-label" style={{ marginBottom: 0 }}>Limit to 1 response</span>
                  <input
                    type="checkbox"
                    checked={form?.oneSubmissionPerUser || false}
                    onChange={(e) => updateForm('oneSubmissionPerUser', e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--gf-purple)' }}
                  />
                </div>

                <div style={{marginBottom: '12px'}}>
                  <label style={{fontSize: '0.8rem', color: 'var(--gf-text-secondary)', display: 'block', marginBottom: '4px'}}>
                    FormExpiry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    className="settings-input"
                    value={form?.unpublishTime || ''}
                    onChange={(e) => updateForm('unpublishTime', e.target.value)}
                  />
                  <div style={{fontSize: '0.72rem', color: 'var(--gf-text-secondary)', marginTop: '4px'}}>
                    Leave empty to keep open indefinitely.
                  </div>
                </div>

              </div>
              <div style={{textAlign: 'center', color: 'var(--gf-text-secondary)', marginTop: '40px', fontSize: '0.9rem', padding: '0 10px'}}>
                Click on a question to modify its settings here
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
