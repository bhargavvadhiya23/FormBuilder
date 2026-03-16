'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function PermissionsPage() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    // Form State
    const [roleName, setRoleName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState({});

    const PERMISSION_OPTIONS = [
        { id: 'CREATE_DRAFT_FORM', label: 'Create Draft Form', defaultApproval: false },
        { id: 'EDIT_DRAFT_FORM', label: 'Edit Draft Form', defaultApproval: false },
        { id: 'DELETE_DRAFT_FORM', label: 'Delete Draft Form', defaultApproval: false },
        { id: 'VIEW_PUBLISHED_SUBMISSIONS', label: 'View Published Submissions', defaultApproval: false },
        { id: 'EDIT_PUBLISHED_FORM', label: 'Edit Published Form', defaultApproval: true },
        { id: 'DELETE_PUBLISHED_FORM', label: 'Delete Published Form', defaultApproval: true },
    ];

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/api/roles');
            setRoles(res.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEdit = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleName(role.name);
            const perms = {};
            role.permissions.forEach(p => {
                perms[p] = true;
            });
            setSelectedPermissions(perms);
        } else {
            setEditingRole(null);
            setRoleName('');
            setSelectedPermissions({});
        }
        setShowModal(true);
    };

    const handlePermissionToggle = (permId) => {
        setSelectedPermissions(prev => ({
            ...prev,
            [permId]: !prev[permId]
        }));
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        
        const permissions = Object.keys(selectedPermissions).filter(k => selectedPermissions[k]);
        const payload = {
            name: roleName,
            permissions
        };

        const isSystem = editingRole?.isSystem;
        if (isSystem) return; // Cannot edit system roles

        try {
            const url = editingRole ? `/admin/api/roles/${editingRole.id}` : '/admin/api/roles';
            const method = editingRole ? 'PUT' : 'POST';

            await api({
                method,
                url,
                data: payload
            });
            
            await fetchRoles();
            setShowModal(false);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteRole = async (id) => {
        if (!confirm('Are you sure you want to delete this role?')) return;
        
        try {
            await api.delete(`/admin/api/roles/${id}`);
            fetchRoles();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading roles...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Permission Manager</h1>
                    <button 
                        onClick={() => handleCreateEdit(null)}
                        style={{ 
                            padding: '8px 16px', 
                            backgroundColor: '#4f46e5', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        + Create Role
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {roles.map(role => (
                        <div key={role.id} style={{ 
                            border: '1px solid #e5e7eb', 
                            borderRadius: '8px', 
                            padding: '1.5rem',
                            backgroundColor: role.isSystem ? '#f9fafb' : 'white'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {role.name}
                                        {role.isSystem && (
                                            <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: '#e5e7eb', borderRadius: '12px' }}>
                                                System Default
                                            </span>
                                        )}
                                    </h3>
                                    <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
                                        {role.permissions.length} permissions assigned
                                    </p>
                                </div>
                                {!role.isSystem && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleCreateEdit(role)}
                                            style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteRole(role.id)}
                                            style={{ padding: '4px 12px', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '4px', background: '#fef2f2', cursor: 'pointer' }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {role.permissions.map(perm => (
                                    <span key={perm} style={{ 
                                        fontSize: '12px', 
                                        padding: '4px 8px', 
                                        backgroundColor: '#e0e7ff', 
                                        color: '#4338ca',
                                        borderRadius: '4px' 
                                    }}>
                                        {perm}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Create/Edit Modal */}
                {showModal && (
                    <div style={{ 
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
                    }}>
                        <div style={{ 
                            backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '600px',
                            maxHeight: '90vh', overflowY: 'auto'
                        }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                                {editingRole ? 'Edit Role' : 'Create New Role'}
                            </h2>
                            
                            <form onSubmit={handleSaveRole}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Role Name</label>
                                    <input 
                                        type="text" 
                                        value={roleName}
                                        onChange={(e) => setRoleName(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                        placeholder="e.g. Content Editor"
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500' }}>Assign Permissions</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {PERMISSION_OPTIONS.map(perm => (
                                            <div key={perm.id} style={{ 
                                                display: 'flex', alignItems: 'flex-start', gap: '8px', 
                                                padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px',
                                                backgroundColor: selectedPermissions[perm.id] ? '#f5f3ff' : 'white'
                                            }}>
                                                <input 
                                                    type="checkbox" 
                                                    id={perm.id}
                                                    checked={!!selectedPermissions[perm.id]}
                                                    onChange={() => handlePermissionToggle(perm.id)}
                                                    style={{ marginTop: '4px' }}
                                                />
                                                <label htmlFor={perm.id} style={{ cursor: 'pointer', fontSize: '14px' }}>
                                                    <div style={{ fontWeight: '500' }}>{perm.label}</div>
                                                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                                                        {perm.defaultApproval ? '⚠️ Requires Admin Approval' : 'Instant execution'}
                                                    </div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '2rem' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowModal(false)}
                                        style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        style={{ padding: '8px 16px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Save Role
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
