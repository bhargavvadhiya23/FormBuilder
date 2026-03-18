'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import ModuleModal from '@/components/ModuleModal';
import Swal from 'sweetalert2';
import api from '@/lib/api';

export default function PermissionsPage() {
    // ... rest of the component state ...
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    // Module Management State
    const [allModules, setAllModules] = useState([]);
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [editingModule, setEditingModule] = useState(null);

    // Form State
    const [roleName, setRoleName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState({});
    const [selectedModules, setSelectedModules] = useState({});

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
        fetchModules();
    }, []);

    const fetchModules = async () => {
        try {
            const res = await api.get('/api/modules/admin/all');
            setAllModules(res.data);
        } catch (err) {
            console.error('Error fetching modules:', err);
        }
    };

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

    // Helper to build module path
    const getModulePath = (mod) => {
        const path = [];
        let current = mod;
        while (current) {
            path.unshift(current.name);
            current = allModules.find(m => m.id === current.parentId);
        }
        return path.join(' / ');
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
            const modMap = {};
            role.modules.forEach(mId => {
                modMap[mId] = true;
            });
            setSelectedModules(modMap);
        } else {
            setEditingRole(null);
            setRoleName('');
            setSelectedPermissions({});
            setSelectedModules({});
        }
        setShowModal(true);
    };

    const handleModuleToggle = (modId) => {
        setSelectedModules(prev => ({
            ...prev,
            [modId]: !prev[modId]
        }));
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
        const modules = Object.keys(selectedModules).filter(k => selectedModules[k]);
        
        const payload = {
            name: roleName,
            permissions,
            modules
        };

        try {
            const url = editingRole ? `/admin/api/roles/${editingRole.id}` : '/admin/api/roles';
            const method = editingRole ? 'PUT' : 'POST';

            await api({
                method,
                url,
                data: payload
            });
            
            Swal.fire({
                title: 'Success!',
                text: `Role ${editingRole ? 'updated' : 'created'} successfully`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            });
            
            await fetchRoles();
            setShowModal(false);
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.response?.data?.message || err.message,
                icon: 'error',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            });
        }
    };

    const handleDeleteRole = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/admin/api/roles/${id}`);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Role has been deleted.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                });
                fetchRoles();
            } catch (err) {
                Swal.fire({
                    title: 'Delete Failed',
                    text: err.response?.data?.message || err.message,
                    icon: 'error',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                });
            }
        }
    };

    const handleDeleteModule = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Module?',
            text: "This will remove the module and its hierarchy. This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/modules/admin/${id}`);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Module has been deleted.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                });
                fetchModules();
            } catch (err) {
                Swal.fire({
                    title: 'Error',
                    text: err.response?.data?.message || err.message,
                    icon: 'error',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                });
            }
        }
    };

    const roleColumns = [
        { 
            key: 'name', 
            label: 'Role Name', 
            render: (role) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{role.name}</span>
                    {role.isSystem && (
                        <span style={{ 
                            fontSize: '10px', padding: '2px 8px', backgroundColor: '#f1f5f9', 
                            color: '#64748b', borderRadius: '12px', border: '1px solid #e2e8f0' 
                        }}>
                            System
                        </span>
                    )}
                </div>
            )
        },
        { 
            key: 'permissions', 
            label: 'Permissions', 
            render: (role) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {role.permissions.map(perm => (
                        <span key={perm} style={{ 
                            fontSize: '11px', padding: '2px 6px', backgroundColor: '#e0e7ff', 
                            color: '#4338ca', borderRadius: '4px' 
                        }}>
                            {perm}
                        </span>
                    ))}
                    {role.modules.length > 0 && (
                        <span style={{ 
                            fontSize: '11px', padding: '2px 6px', backgroundColor: '#dcfce7', 
                            color: '#166534', borderRadius: '4px' 
                        }}>
                            +{role.modules.length} Modules
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (role) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => handleCreateEdit(role)}
                        style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer' }}
                    >
                        Edit
                    </button>
                    {!role.isSystem && (
                        <button 
                            onClick={() => handleDeleteRole(role.id)}
                            style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', background: '#fef2f2', cursor: 'pointer' }}
                        >
                            Delete
                        </button>
                    )}
                </div>
            )
        }
    ];

    const moduleColumns = [
        {
            key: 'name',
            label: 'Module',
            render: (mod) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{mod.iconClass || '📄'}</span>
                    <div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{mod.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{mod.routePrefix}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Type',
            render: (mod) => (
                <div style={{ display: 'flex', gap: '6px' }}>
                    {mod.isParent ? (
                        <span style={{ 
                            fontSize: '11px', padding: '2px 8px', backgroundColor: '#fef3c7', 
                            color: '#92400e', borderRadius: '12px', border: '1px solid #fde68a' 
                        }}>
                            Parent
                        </span>
                    ) : (
                        <span style={{ 
                            fontSize: '11px', padding: '2px 8px', backgroundColor: '#e0f2fe', 
                            color: '#075985', borderRadius: '12px', border: '1px solid #bae6fd' 
                        }}>
                            Subsection
                        </span>
                    )}
                    {!mod.activeStatus && (
                        <span style={{ 
                            fontSize: '11px', padding: '2px 8px', backgroundColor: '#fee2e2', 
                            color: '#991b1b', borderRadius: '12px', border: '1px solid #fecaca' 
                        }}>
                            Inactive
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'path',
            label: 'Full Path',
            render: (mod) => (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    {getModulePath(mod)}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (mod) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => { setEditingModule(mod); setShowModuleModal(true); }}
                        style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer' }}
                    >
                        Edit
                    </button>
                    <button 
                        onClick={() => handleDeleteModule(mod.id)}
                        style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', background: '#fef2f2', cursor: 'pointer' }}
                    >
                        Delete
                    </button>
                </div>
            )
        }
    ];

    if (loading) return <div style={{ padding: '2rem' }}>Loading roles...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                {/* Roles Section */}
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em' }}>Roles & Access Control</h1>
                            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Manage user roles and their granular permissions.</p>
                        </div>
                        <button 
                            onClick={() => handleCreateEdit(null)}
                            style={{ 
                                padding: '10px 24px', backgroundColor: '#4f46e5', color: 'white', border: 'none', 
                                borderRadius: '10px', cursor: 'pointer', fontWeight: '600',
                                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            + Create Role
                        </button>
                    </div>

                    <DataTable columns={roleColumns} data={roles} pageSize={5} />
                </div>

                {/* Modules Section */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em' }}>Dynamic Module Manager</h1>
                            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Configure application sections, hierarchies, and external links.</p>
                        </div>
                        <button 
                            onClick={() => { setEditingModule(null); setShowModuleModal(true); }}
                            style={{ 
                                padding: '10px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', 
                                borderRadius: '10px', cursor: 'pointer', fontWeight: '600',
                                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            + Create Module
                        </button>
                    </div>

                    <DataTable columns={moduleColumns} data={allModules} pageSize={5} />
                </div>

                {/* Role Creation/Edit Modal */}
                {showModal && (
                    <div style={{ 
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', 
                        backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
                    }}>
                        <div style={{ 
                            backgroundColor: 'white', padding: '2.5rem', borderRadius: '16px', width: '100%', maxWidth: '650px',
                            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                                    {editingRole ? 'Update Role' : 'Create New Role'}
                                </h2>
                                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#64748b' }}>×</button>
                            </div>
                            
                            <form onSubmit={handleSaveRole}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Role Name</label>
                                    <input 
                                        type="text" 
                                        value={roleName}
                                        onChange={(e) => setRoleName(e.target.value)}
                                        required
                                        style={{ 
                                            width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', 
                                            borderRadius: '8px', fontSize: '14px', outline: 'none'
                                        }}
                                        placeholder="e.g. Manager"
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Assign Permissions</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {PERMISSION_OPTIONS.map(perm => (
                                            <div key={perm.id} 
                                                onClick={() => handlePermissionToggle(perm.id)}
                                                style={{ 
                                                    display: 'flex', alignItems: 'flex-start', gap: '10px', 
                                                    padding: '12px', border: '1px solid',
                                                    borderColor: selectedPermissions[perm.id] ? '#4f46e5' : '#e2e8f0',
                                                    borderRadius: '10px', cursor: 'pointer',
                                                    backgroundColor: selectedPermissions[perm.id] ? '#f5f3ff' : 'white',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!selectedPermissions[perm.id]}
                                                    onChange={(e) => { e.stopPropagation(); handlePermissionToggle(perm.id); }}
                                                    style={{ marginTop: '4px' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: '600', fontSize: '13px', color: selectedPermissions[perm.id] ? '#4338ca' : '#1e293b' }}>{perm.label}</div>
                                                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                                        {perm.defaultApproval ? 'Requires Approval' : 'Instant'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Assign Modules</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {allModules.map(mod => (
                                            <div key={mod.id} 
                                                onClick={() => handleModuleToggle(mod.id)}
                                                style={{ 
                                                    display: 'flex', alignItems: 'flex-start', gap: '10px', 
                                                    padding: '12px', border: '1px solid',
                                                    borderColor: selectedModules[mod.id] ? '#10b981' : '#e2e8f0',
                                                    borderRadius: '10px', cursor: 'pointer',
                                                    backgroundColor: selectedModules[mod.id] ? '#f0fdf4' : 'white',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!selectedModules[mod.id]}
                                                    onChange={(e) => { e.stopPropagation(); handleModuleToggle(mod.id); }}
                                                    style={{ marginTop: '4px' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: '600', fontSize: '13px', color: selectedModules[mod.id] ? '#065f46' : '#1e293b' }}>{mod.name}</div>
                                                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                                        {mod.isParent ? 'Parent' : 'Subsection'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '2rem' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowModal(false)}
                                        style={{ padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontWeight: '500' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        style={{ 
                                            padding: '10px 24px', backgroundColor: '#4f46e5', color: 'white', border: 'none', 
                                            borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
                                            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
                                        }}
                                    >
                                        {editingRole ? 'Update Role' : 'Save Role'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <ModuleModal 
                    isOpen={showModuleModal} 
                    onClose={() => setShowModuleModal(false)}
                    module={editingModule}
                    onSuccess={fetchModules}
                />
            </div>
        </div>
    );
}
