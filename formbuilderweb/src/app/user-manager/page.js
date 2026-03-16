'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function UserManagerPage() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, rolesRes] = await Promise.all([
                api.get('/admin/api/users'),
                api.get('/admin/api/roles')
            ]);
            
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEdit = (user = null) => {
        if (user) {
            setEditingUser(user);
            setName(user.name);
            setEmail(user.email);
            setPassword(''); // Don't populate password for edit
            setSelectedRole(user.appRole?.id || '');
        } else {
            setEditingUser(null);
            setName('');
            setEmail('');
            setPassword('');
            setSelectedRole('');
        }
        setShowModal(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        
        try {
            const url = editingUser ? `/admin/api/users/${editingUser.id}` : '/admin/api/users';
            const method = editingUser ? 'PUT' : 'POST';
            
            // Only send password if provided (for both create and edit)
            const payload = {
                name,
                email,
                appRoleId: selectedRole
            };
            if (password) {
                payload.password = password;
            }

            const res = await api({
                method,
                url,
                data: payload
            });

            
            await fetchData();
            setShowModal(false);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!confirm('Are you sure you want to deactivate/delete this user?')) return;
        
        try {
            await api.delete(`/admin/api/users/${id}`);
            fetchData();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading users...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>User Manager</h1>
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
                        + Create User
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Role</th>
                                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                                        No users created yet.
                                    </td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '12px' }}>{user.name}</td>
                                        <td style={{ padding: '12px', color: '#6b7280' }}>{user.email}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ 
                                                fontSize: '14px', 
                                                padding: '4px 8px', 
                                                backgroundColor: '#e0e7ff', 
                                                color: '#4338ca',
                                                borderRadius: '4px' 
                                            }}>
                                                {user.appRole?.name || 'No Role'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleCreateEdit(user)}
                                                style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(user.id)}
                                                style={{ padding: '4px 12px', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '4px', background: '#fef2f2', cursor: 'pointer' }}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Create/Edit Modal */}
                {showModal && (
                    <div style={{ 
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
                    }}>
                        <div style={{ 
                            backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px'
                        }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                                {editingUser ? 'Edit User' : 'Create New User'}
                            </h2>
                            
                            <form onSubmit={handleSaveUser}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Full Name</label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Email Address</label>
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                        Password {editingUser && <span style={{ color: '#6b7280', fontWeight: 'normal' }}>(Leave blank to keep unchanged)</span>}
                                    </label>
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required={!editingUser}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Assigned Role</label>
                                    <select 
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: 'white' }}
                                    >
                                        <option value="">Select a role...</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
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
                                        Save User
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
