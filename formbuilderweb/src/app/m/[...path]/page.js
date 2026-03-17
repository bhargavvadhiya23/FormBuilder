'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

export default function DynamicModulePage() {
    const params = useParams();
    const [module, setModule] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchModule = async () => {
            try {
                // The first part of path is the ID or we can find by route prefix
                const path = Array.isArray(params.path) ? params.path.join('/') : params.path;
                
                // Fetch module details to get the link
                // For simplicity, we assume the first segment is the ID if we use /m/[id]
                // But the implementation plan said /m/[...path]
                const res = await api.get('/api/modules/my');
                const mods = res.data;
                const match = mods.find(m => m.id === params.path[0] || m.routePrefix.includes(params.path[0]));
                
                if (match) {
                    setModule(match);
                } else {
                    setError('Module not found or access denied');
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchModule();
    }, [params]);

    if (loading) return <div style={{ padding: '2rem' }}>Loading content...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>{error}</div>;
    if (!module) return <div style={{ padding: '2rem' }}>No module selected</div>;

    // Handle redirection if internal (though sidebar handles it, direct hits might land here)
    if (module.pageLink?.startsWith('/')) {
        window.location.href = module.pageLink;
        return null;
    }

    if (!module.pageLink) {
        return <div style={{ padding: '2rem' }}>No content link provided for this module.</div>;
    }

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            <iframe 
                src={module.pageLink} 
                title={module.name}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
            />
        </div>
    );
}
