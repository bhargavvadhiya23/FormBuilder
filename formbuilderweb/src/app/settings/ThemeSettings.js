'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/AppContext';

const DEFAULT_THEME = {
    mode: 'light',
    primary: '#3b82f6',
    secondary: '#64748b',
    tertiary: '#10b981'
};

export function ThemeSettings() {
    const { user, updateTheme, toast } = useApp();
    const [config, setConfig] = useState(DEFAULT_THEME);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user && user.themeConfig) {
            try {
                const parsed = typeof user.themeConfig === 'string' 
                    ? JSON.parse(user.themeConfig) 
                    : user.themeConfig;
                setConfig(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse theme config", e);
            }
        }
    }, [user]);

    const handleModeToggle = async () => {
        const newMode = config.mode === 'light' ? 'dark' : 'light';
        const newConfig = { ...config, mode: newMode };
        setConfig(newConfig);
        await updateTheme(newConfig);
    };

    const handleColorChange = (key, value) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
    };

    const saveColors = async () => {
        setSaving(true);
        const success = await updateTheme(config);
        if (success) {
            toast.success('Theme colors saved');
        }
        setSaving(false);
    };

    const handleReset = async () => {
        if (window.confirm('Are you sure you want to reset theme colors to original default?')) {
            setSaving(true);
            setConfig(DEFAULT_THEME);
            const success = await updateTheme(DEFAULT_THEME);
            if (success) {
                toast.success('Theme reset to defaults');
            }
            setSaving(false);
        }
    };

    return (
        <div className="gf-card" style={{ marginTop: '24px', marginBottom: '40px' }}>
            <div className="gf-card-body">
                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--gf-text-primary)' }}>Theme Customization</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--gf-border)' }}>
                    <div>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>Dark Mode</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--gf-text-secondary)' }}>
                            Switch between light and dark visual themes.
                        </div>
                    </div>
                    <div className="gf-switch-container">
                        <label className="gf-switch">
                            <input 
                                type="checkbox" 
                                checked={config.mode === 'dark'} 
                                onChange={handleModeToggle} 
                            />
                            <span className="gf-slider round"></span>
                        </label>
                    </div>
                </div>

                <div style={{ padding: '16px 0' }}>
                    <div style={{ fontWeight: '500', marginBottom: '16px' }}>Brand Colors</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                        <div className="color-picker-item">
                            <label>Primary Color</label>
                            <div className="picker-wrapper">
                                <input 
                                    type="color" 
                                    value={config.primary} 
                                    onChange={(e) => handleColorChange('primary', e.target.value)}
                                />
                                <span className="picker-value">{config.primary}</span>
                            </div>
                        </div>
                        
                        <div className="color-picker-item">
                            <label>Secondary Color</label>
                            <div className="picker-wrapper">
                                <input 
                                    type="color" 
                                    value={config.secondary} 
                                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                                />
                                <span className="picker-value">{config.secondary}</span>
                            </div>
                        </div>
                        
                        <div className="color-picker-item">
                            <label>Tertiary Color</label>
                            <div className="picker-wrapper">
                                <input 
                                    type="color" 
                                    value={config.tertiary} 
                                    onChange={(e) => handleColorChange('tertiary', e.target.value)}
                                />
                                <span className="picker-value">{config.tertiary}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button 
                            className="gf-btn-outline" 
                            onClick={handleReset}
                            disabled={saving}
                        >
                            Reset Theme Colors
                        </button>
                        <button 
                            className="gf-btn-primary" 
                            onClick={saveColors}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Theme Colors'}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .color-picker-item label {
                    display: block;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    marginBottom: 8px;
                }
                .picker-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px;
                    background: var(--bg-primary);
                    border: 1.5px solid var(--border-color);
                    border-radius: var(--border-radius);
                }
                .picker-wrapper input[type="color"] {
                    border: none;
                    width: 30px;
                    height: 30px;
                    padding: 0;
                    background: transparent;
                    cursor: pointer;
                    border-radius: 4px;
                }
                .picker-wrapper span {
                    font-family: monospace;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .gf-btn-primary {
                    background: var(--theme-primary);
                    color: white;
                    border: 1.5px solid var(--theme-primary);
                    padding: 8px 20px;
                    border-radius: var(--border-radius);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .gf-btn-primary:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .gf-btn-outline {
                    background: transparent;
                    color: var(--theme-primary);
                    border: 1.5px solid var(--theme-primary);
                    padding: 8px 20px;
                    border-radius: var(--border-radius);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .gf-btn-outline:hover {
                    background: var(--theme-primary);
                    color: white;
                    transform: translateY(-1px);
                }
                .gf-btn-primary:disabled, .gf-btn-outline:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }
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
                    background-color: var(--theme-primary);
                }
                input:checked + .gf-slider:before {
                    transform: translateX(22px);
                }
            `}</style>
        </div>
    );
}
