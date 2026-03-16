'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi, userApi } from '@/lib/api';

const AppContext = createContext(null);

let toastIdCounter = 0;

export function AppProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [isAuthLoaded, setIsAuthLoaded] = useState(false);

    // On mount, verify current session with the backend
    useEffect(() => {
        // Recover from localStorage ONLY on client side after mount
        const saved = localStorage.getItem('fb_user');
        if (saved) {
            try { 
                setUser(JSON.parse(saved)); 
            } catch (e) {
                localStorage.removeItem('fb_user');
            }
        }

        authApi.me()
            .then(res => {
                setUser(res.data);
                localStorage.setItem('fb_user', JSON.stringify(res.data));
                setIsAuthLoaded(true);
            })
            .catch((err) => {
                // If the check fails for ANY reason, we clear the local user state
                // to prevent infinite redirection loops between login and dashboard
                setUser(null);
                localStorage.removeItem('fb_user');
                setIsAuthLoaded(true);
            });
    }, []);

    const login = useCallback((userData) => {
        if (userData) {
            setUser(userData);
            localStorage.setItem('fb_user', JSON.stringify(userData));
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch (_) { /* ignore */ }
        setUser(null);
        localStorage.removeItem('fb_user');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }, []);

    const addToast = useCallback((message, type = 'info', title = null, duration = 4000) => {
        const id = ++toastIdCounter;
        const defaultTitles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info',
        };
        setToasts((prev) => [
            ...prev,
            { id, message, type, title: title || defaultTitles[type] || 'Notice' },
        ]);
        setTimeout(() => {
            removeToast(id);
        }, duration);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = {
        success: (msg, title) => addToast(msg, 'success', title),
        error: (msg, title) => addToast(msg, 'error', title),
        warning: (msg, title) => addToast(msg, 'warning', title),
        info: (msg, title) => addToast(msg, 'info', title),
    };

    // Apply theme on mount and whenever user changes
    useEffect(() => {
        if (user && user.themeConfig) {
            try {
                const config = typeof user.themeConfig === 'string' 
                    ? JSON.parse(user.themeConfig) 
                    : user.themeConfig;
                applyTheme(config);
            } catch (e) {
                console.error("Failed to parse theme config", e);
            }
        }
    }, [user]);

    const applyTheme = (config) => {
        if (!config) return;
        const root = document.documentElement;
        if (config.mode) {
            root.setAttribute('data-theme', config.mode);
        }

        const darkenColor = (hex, amount = 20) => {
            if (!hex) return hex;
            try {
                // Remove # if present
                hex = hex.replace(/^#/, '');
                if (hex.length === 3) hex = hex.split('').map(s => s + s).join('');
                
                let r = parseInt(hex.substring(0, 2), 16);
                let g = parseInt(hex.substring(2, 4), 16);
                let b = parseInt(hex.substring(4, 6), 16);

                r = Math.max(0, Math.min(255, r - amount));
                g = Math.max(0, Math.min(255, g - amount));
                b = Math.max(0, Math.min(255, b - amount));

                return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            } catch (e) {
                return hex;
            }
        };

        if (config.primary) {
            root.style.setProperty('--theme-primary', config.primary);
            root.style.setProperty('--color-primary', config.primary);
            root.style.setProperty('--color-primary-dark', darkenColor(config.primary, 30));
        }
        if (config.secondary) {
            root.style.setProperty('--theme-secondary', config.secondary);
            root.style.setProperty('--color-secondary', config.secondary);
            root.style.setProperty('--color-secondary-dark', darkenColor(config.secondary, 30));
        }
        if (config.tertiary) {
            root.style.setProperty('--theme-tertiary', config.tertiary);
            root.style.setProperty('--color-tertiary', config.tertiary);
            root.style.setProperty('--color-tertiary-dark', darkenColor(config.tertiary, 30));
        }
    };

    const updateTheme = useCallback(async (newConfig) => {
        try {
            const configStr = JSON.stringify(newConfig);
            await userApi.updateSettings({ themeConfig: configStr });
            setUser(prev => ({ ...prev, themeConfig: configStr }));
            applyTheme(newConfig);
            return true;
        } catch (err) {
            toast.error(err.message || 'Failed to update theme');
            return false;
        }
    }, [setUser, toast]);

    const showLoading = useCallback(() => setIsLoading(true), []);
    const hideLoading = useCallback(() => setIsLoading(false), []);

    return (
        <AppContext.Provider value={{
            toast, isLoading, showLoading, hideLoading, toasts, removeToast,
            user, setUser, login, logout, isAuthLoaded, updateTheme
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used inside AppProvider');
    return ctx;
}
