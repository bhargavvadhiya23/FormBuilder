'use client';
import { useState, useEffect } from 'react';
import api, { API_BASE } from '@/lib/api';

export default function ModuleModal({ isOpen, onClose, module = null, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        routePrefix: '',
        description: '',
        isParent: true,
        activeStatus: true,
        parentId: null,
        iconClass: '',
        pageLink: ''
    });
    const [parents, setParents] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchParents();
            if (module) {
                setFormData({
                    name: module.name || '',
                    routePrefix: module.routePrefix || '',
                    description: module.description || '',
                    isParent: module.isParent ?? true,
                    activeStatus: module.activeStatus ?? true,
                    parentId: module.parentId || null,
                    iconClass: module.iconClass || '',
                    pageLink: module.pageLink || ''
                });
            } else {
                setFormData({
                    name: '',
                    routePrefix: '',
                    description: '',
                    isParent: true,
                    activeStatus: true,
                    parentId: null,
                    iconClass: '',
                    pageLink: ''
                });
            }
        }
    }, [isOpen, module]);

    const fetchParents = async () => {
        try {
            const res = await api.get(`${API_BASE}/modules/admin/all`);
            setParents(res.data.filter(m => m.isParent && (!module || m.id !== module.id)));
        } catch (err) {
            console.error('Error fetching parent modules:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = module ? `${API_BASE}/modules/admin/${module.id}` : `${API_BASE}/modules/admin`;
            const method = module ? 'PUT' : 'POST';
            await api({ method, url, data: formData });
            onSuccess();
            onClose();
        } catch (err) {
            alert(err.message || 'Error saving module');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ 
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
        }}>
            <div className="modal-content" style={{ 
                backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '600px',
                maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                        {module ? 'EDIT MODULE' : 'CREATE MODULE'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Module Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Dashboard"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Route Prefix</label>
                            <input 
                                type="text" 
                                placeholder="e.g. /admin/dashboard"
                                value={formData.routePrefix}
                                onChange={(e) => setFormData({...formData, routePrefix: e.target.value})}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Description</label>
                        <textarea 
                            placeholder="Describe the module purpose..."
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', minHeight: '80px', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: formData.isParent ? '#4f46e5' : '#64748b' }}>
                                <input type="radio" checked={formData.isParent} onChange={() => setFormData({...formData, isParent: true, parentId: null, pageLink: ''})} style={{ accentColor: '#4f46e5' }} />
                                IS PARENT
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: !formData.isParent ? '#4f46e5' : '#64748b' }}>
                                <input type="radio" checked={!formData.isParent} onChange={() => setFormData({...formData, isParent: false})} style={{ accentColor: '#4f46e5' }} />
                                IS SUB-PARENT
                            </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>ACTIVE STATUS</span>
                            <div 
                                onClick={() => setFormData({...formData, activeStatus: !formData.activeStatus})}
                                style={{ 
                                    width: '40px', height: '20px', background: formData.activeStatus ? '#10b981' : '#cbd5e1', 
                                    borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' 
                                }}
                            >
                                <div style={{ 
                                    width: '16px', height: '16px', background: 'white', borderRadius: '50%', 
                                    position: 'absolute', top: '2px', left: formData.activeStatus ? '22px' : '2px', transition: '0.3s' 
                                }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Parent Module</label>
                            <select 
                                value={formData.parentId || ''}
                                onChange={(e) => setFormData({...formData, parentId: e.target.value || null})}
                                disabled={formData.isParent}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: formData.isParent ? '#f1f5f9' : 'white' }}
                            >
                                <option value="">None (Top Level)</option>
                                {parents.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Icon Library Class</label>
                            <input 
                                type="text" 
                                placeholder="e.g. layout, file-text"
                                value={formData.iconClass}
                                onChange={(e) => setFormData({...formData, iconClass: e.target.value})}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}
                            />
                        </div>
                    </div>

                    {!formData.isParent && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Page Content Link</label>
                            <input 
                                type="text" 
                                placeholder="e.g. /forms or https://example.com"
                                value={formData.pageLink}
                                onChange={(e) => setFormData({...formData, pageLink: e.target.value})}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button 
                            type="submit" 
                            disabled={loading}
                            style={{ 
                                flex: 2, padding: '12px', background: '#10b981', color: 'white', 
                                border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                            }}
                        >
                            {loading ? 'SAVING...' : (module ? 'UPDATE MODULE' : 'CREATE MODULE')}
                        </button>
                        <button 
                            type="button" 
                            onClick={onClose}
                            style={{ 
                                flex: 1, padding: '12px', background: 'white', color: '#64748b', 
                                border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
                            }}
                        >
                            CANCEL
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
