'use client';
import { useState, useEffect } from 'react';
import { userApi } from '@/lib/api';
import { useApp } from '@/lib/AppContext';
import { ThemeSettings } from './ThemeSettings';

export default function SettingsPage() {
    const { user, setUser, toast } = useApp();
    const [softDelete, setSoftDelete] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setSoftDelete(user.softDeleteEnabled || false);
        }
    }, [user]);

    const handleToggle = async (e) => {
        const newValue = e.target.checked;
        setSoftDelete(newValue);
        setSaving(true);
        try {
            await userApi.updateSettings({ softDeleteEnabled: newValue });
            // Update local user state in context
            setUser(prev => ({ ...prev, softDeleteEnabled: newValue }));
            toast.success(`Soft Delete ${newValue ? 'enabled' : 'disabled'}`);
        } catch (err) {
            toast.error(err.message || 'Failed to update settings');
            setSoftDelete(!newValue); // revert
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="page-header-gf">
                <div>
                    <h1>Settings</h1>
                    <p>Manage your global application preferences</p>
                </div>
            </div>

            <div className="gf-card" style={{ marginTop: '24px' }}>
                <div className="gf-card-body">
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--gf-text-primary)' }}>General Settings</h3>
                    

                    <div style={{ padding: '16px 0', opacity: 0.6 }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>Email Notifications (Coming Soon)</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--gf-text-secondary)' }}>
                            Receive an email when a new response is submitted.
                        </div>
                    </div>
                </div>
            </div>

            <ThemeSettings />

            <style jsx>{`
                .gf-switch-container {
                    margin-left: 20px;
                }
                .gf-switch {
                    position: relative;
                    display: inline-block;
                    width: 46px;
                    height: 24px;
                }
                .gf-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .gf-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 24px;
                }
                .gf-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .gf-slider {
                    background-color: var(--gf-purple);
                }
                input:focus + .gf-slider {
                    box-shadow: 0 0 1px var(--gf-purple);
                }
                input:checked + .gf-slider:before {
                    transform: translateX(22px);
                }
                input:disabled + .gf-slider {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
