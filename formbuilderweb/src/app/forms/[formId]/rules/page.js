'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { rulesApi, formsApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATORS = [
  { value: 'ALWAYS',       label: 'Always (no condition)' },
  { value: 'EQUALS',       label: 'Equals' },
  { value: 'NOT_EQUALS',   label: 'Not equals' },
  { value: 'CONTAINS',     label: 'Contains' },
  { value: 'STARTS_WITH',  label: 'Starts with' },
  { value: 'ENDS_WITH',    label: 'Ends with' },
  { value: 'GREATER_THAN', label: 'Greater than (numeric)' },
  { value: 'LESS_THAN',    label: 'Less than (numeric)' },
  { value: 'GREATER_THAN_EQUAL', label: 'Greater than or equal (>=)' },
  { value: 'LESS_THAN_EQUAL',    label: 'Less than or equal (<=)' },
  { value: 'IS_EMPTY',     label: 'Is empty' },
  { value: 'IS_NOT_EMPTY', label: 'Is not empty' },
  { value: 'IS_TRUE',      label: 'Is true/checked/yes' },
  { value: 'IS_FALSE',     label: 'Is false/unchecked/no' },
  { value: 'IN_LIST',      label: 'In list (comma separated)' },
  { value: 'NOT_IN_LIST',  label: 'Not in list' },
  { value: 'MATCHES_REGEX',label: 'Does NOT Match Regex' },
];

const ACTIONS = [
  { value: 'REQUIRE',    label: '🔴 Require field',       needsField: true,  needsValue: false },
  { value: 'REJECT',     label: '🚫 Reject submission',   needsField: false, needsValue: true  },
  { value: 'HIDE',       label: '👁️ Hide field',          needsField: true,  needsValue: false },
  { value: 'SHOW',       label: '✅ Show field',          needsField: true,  needsValue: false },
  { value: 'SET_VALUE',  label: '✏️ Set field value',     needsField: true,  needsValue: true  },
  { value: 'SHOW_ERROR', label: '⚠️ Show field error',    needsField: true,  needsValue: true  },
  { value: 'DISABLE',    label: '🔒 Disable field',       needsField: true,  needsValue: false },
  { value: 'ENABLE',     label: '🔓 Enable field',        needsField: true,  needsValue: false },
  { value: 'CLEAR_VALUE',label: '🗑️ Clear field value',   needsField: true,  needsValue: false },
  { value: 'COPY_VALUE', label: '📋 Copy value from',     needsField: true,  needsValue: false, needsSourceField: true },
];

const EMPTY_RULE = {
  ruleName: '',
  description: '',
  conditionField: '',
  conditionOperator: 'ALWAYS',
  conditionValue: '',
  actionType: 'REQUIRE',
  actionField: '',
  actionValue: '',
  priority: 100,
  enabled: true,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RulesPage() {
  const { formId } = useParams();
  const { toast } = useApp();

  const [rules, setRules]         = useState([]);
  const [fields, setFields]       = useState([]);
  const [formName, setFormName]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null); // null = new rule
  const [form, setForm]           = useState({ ...EMPTY_RULE });
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    loadAll();
  }, [formId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rulesRes, fieldsRes, formRes] = await Promise.all([
        rulesApi.getRules(formId),
        formsApi.getFields(formId),
        formsApi.getById(formId),
      ]);
      setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
      setFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
      setFormName(formRes.data?.name || 'Form');
    } catch (e) {
      toast.error('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_RULE });
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditing(rule.id);
    setForm({ ...EMPTY_RULE, ...rule });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const saveRule = async () => {
    if (!form.ruleName.trim()) { toast.warning('Rule name is required'); return; }
    if (!form.actionType)      { toast.warning('Action type is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await rulesApi.updateRule(formId, editing, form);
        toast.success('Rule updated!');
      } else {
        await rulesApi.createRule(formId, form);
        toast.success('Rule created!');
      }
      closeModal();
      await loadAll();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await rulesApi.deleteRule(formId, ruleId);
      toast.success('Rule deleted');
      setRules(r => r.filter(x => x.id !== ruleId));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const duplicateRule = (rule) => {
    setEditing(null);
    setForm({
      ...EMPTY_RULE,
      ...rule,
      ruleName: `Copy of ${rule.ruleName}`,
      id: undefined, // Ensure it's treated as a new rule
    });
    setShowModal(true);
  };

  const toggleEnabled = async (rule) => {
    try {
      await rulesApi.updateRule(formId, rule.id, { ...rule, enabled: !rule.enabled });
      setRules(r => r.map(x => x.id === rule.id ? { ...x, enabled: !x.enabled } : x));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const selectedAction = ACTIONS.find(a => a.value === form.actionType) || ACTIONS[0];
  const needsConditionValue = !['ALWAYS', 'IS_EMPTY', 'IS_NOT_EMPTY', 'IS_TRUE', 'IS_FALSE'].includes(form.conditionOperator);

  // Build a pretty summary for a rule card
  const ruleSummary = (r) => {
    const op = OPERATORS.find(o => o.value === r.conditionOperator);
    const act = ACTIONS.find(a => a.value === r.actionType);
    const cond = r.conditionOperator === 'ALWAYS'
      ? 'Always'
      : `IF [${r.conditionField}] ${op?.label?.toLowerCase()} "${r.conditionValue}"`;
    const then = r.actionType === 'REJECT'
      ? `REJECT: "${r.actionValue}"`
      : `${act?.label} ${r.actionField ? `[${r.actionField}]` : ''} ${r.actionValue ? `= "${r.actionValue}"` : ''}`;
    return { cond, then };
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="gf-loader"><div className="gf-spinner" /><span>Loading rules...</span></div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div className="page-header-gf" style={{ marginBottom: 24 }}>
        <div>
          <Link href={`/forms/${formId}/edit`} className="gf-btn gf-btn-ghost gf-btn-sm"
            style={{ marginBottom: 6 }}>← Back to Editor</Link>
          <h1 style={{ marginTop: 4 }}>⚙️ Business Rules — {formName}</h1>
          <p style={{ color: 'var(--gf-text-secondary)', marginTop: 4 }}>
            Rules are evaluated on every form submission. They fire in priority order (lower number = first).
          </p>
        </div>
        <button className="gf-btn gf-btn-primary" onClick={openNew}>+ Add Rule</button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gf-text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚙️</div>
          <p>No business rules yet. Click <strong>+ Add Rule</strong> to create your first rule.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.map(rule => {
            const { cond, then } = ruleSummary(rule);
            return (
              <div key={rule.id} style={{
                background: 'var(--gf-surface)',
                border: `1px solid ${rule.enabled ? 'var(--gf-border)' : '#ccc'}`,
                borderLeft: `4px solid ${rule.enabled ? '#4285f4' : '#bbb'}`,
                borderRadius: 10,
                padding: '14px 18px',
                opacity: rule.enabled ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{rule.ruleName}</strong>
                    {rule.description && (
                      <div style={{ color: 'var(--gf-text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
                        {rule.description}
                      </div>
                    )}
                    <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ background: '#e8f0fe', color: '#1a73e8', borderRadius: 6, padding: '2px 10px', fontSize: '0.82rem' }}>
                        {cond}
                      </span>
                      <span style={{ background: '#fce8e6', color: '#d32f2f', borderRadius: 6, padding: '2px 10px', fontSize: '0.82rem' }}>
                        THEN {then}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      title="Duplicate rule"
                      onClick={() => duplicateRule(rule)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>
                      📋
                    </button>
                    <button
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      onClick={() => toggleEnabled(rule)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>
                      {rule.enabled ? '✅' : '⬜'}
                    </button>
                    <button className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => openEdit(rule)}>Edit</button>
                    <button className="gf-btn gf-btn-danger gf-btn-sm" onClick={() => deleteRule(rule.id)}>Delete</button>
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--gf-text-secondary)' }}>
                  Priority: {rule.priority}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add/Edit Modal ──────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--gf-surface)', borderRadius: 14, padding: 32,
            width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0 }}>{editing ? '✏️ Edit Rule' : '➕ New Rule'}</h2>

            {/* Rule Name */}
            <label style={labelStyle}>Rule Name *</label>
            <input style={inputStyle} value={form.ruleName}
              onChange={e => setForm(f => ({ ...f, ruleName: e.target.value }))}
              placeholder="e.g. Require phone for US users" />

            {/* Description */}
            <label style={labelStyle}>Description (optional)</label>
            <input style={inputStyle} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what this rule does" />

            {/* Priority */}
            <label style={labelStyle}>Priority (lower = fires first)</label>
            <input type="number" style={inputStyle} value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 100 }))} />

            {/* ── Condition ── */}
            <div style={{ borderTop: '1px solid var(--gf-border)', marginTop: 16, paddingTop: 16 }}>
              <strong>IF… (Condition)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <label style={labelStyle}>Field</label>
                  <select style={inputStyle} value={form.conditionField}
                    onChange={e => setForm(f => ({ ...f, conditionField: e.target.value }))}>
                    <option value="">— select field —</option>
                    {fields.map(f => (
                      <option key={f.fieldKey} value={f.fieldKey}>{f.fieldLabel} ({f.fieldKey})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Operator</label>
                  <select style={inputStyle} value={form.conditionOperator}
                    onChange={e => setForm(f => ({ ...f, conditionOperator: e.target.value }))}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {needsConditionValue && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Value to compare</label>
                  <input style={inputStyle} value={form.conditionValue}
                    onChange={e => setForm(f => ({ ...f, conditionValue: e.target.value }))}
                    placeholder='e.g. "US" or "18"' />
                </div>
              )}
            </div>

            {/* ── Action ── */}
            <div style={{ borderTop: '1px solid var(--gf-border)', marginTop: 16, paddingTop: 16 }}>
              <strong>THEN… (Action)</strong>
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Action Type *</label>
                <select style={inputStyle} value={form.actionType}
                  onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))}>
                  {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              {selectedAction.needsField && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Target Field</label>
                  <select style={inputStyle} value={form.actionField}
                    onChange={e => setForm(f => ({ ...f, actionField: e.target.value }))}>
                    <option value="">— select field —</option>
                    {fields.map(f => (
                      <option key={f.fieldKey} value={f.fieldKey}>{f.fieldLabel} ({f.fieldKey})</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedAction.needsValue && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>
                    {form.actionType === 'REJECT' ? 'Error Message *' : 
                     form.actionType === 'SHOW_ERROR' ? 'Field Error Message *' : 'Set to Value *'}
                  </label>
                  <input style={inputStyle} value={form.actionValue}
                    onChange={e => setForm(f => ({ ...f, actionValue: e.target.value }))}
                    placeholder={form.actionType === 'REJECT' || form.actionType === 'SHOW_ERROR'
                      ? 'e.g. Invalid selection'
                      : 'Value to set'} />
                </div>
              )}

              {selectedAction.needsSourceField && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Source Field</label>
                  <select style={inputStyle} value={form.actionValue}
                    onChange={e => setForm(f => ({ ...f, actionValue: e.target.value }))}>
                    <option value="">— select source field —</option>
                    {fields.map(f => (
                      <option key={f.fieldKey} value={f.fieldKey}>{f.fieldLabel} ({f.fieldKey})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Enabled toggle */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} id="enabled" />
              <label htmlFor="enabled">Rule is active</label>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="gf-btn gf-btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="gf-btn gf-btn-primary" onClick={saveRule} disabled={saving}>
                {saving ? '⏳ Saving...' : (editing ? 'Update Rule' : 'Create Rule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'var(--gf-text-secondary)',
  marginBottom: 4,
  marginTop: 12,
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--gf-border)',
  borderRadius: 8,
  background: 'var(--gf-bg)',
  color: 'var(--gf-text)',
  fontSize: '0.92rem',
  boxSizing: 'border-box',
};
