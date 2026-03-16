'use client';

export default function Badge({ type = 'neutral', children, dot = false }) {
    const classMap = {
        draft: 'badge-draft',
        published: 'badge-published',
        required: 'badge-required',
        optional: 'badge-optional',
        primary: 'badge-primary',
        danger: 'badge-danger',
        success: 'badge-success',
        neutral: 'badge-neutral',
        type: 'badge-type',
    };
    return (
        <span className={`badge ${classMap[type] || 'badge-neutral'}`}>
            {dot && <span className="badge-dot" />}
            {children}
        </span>
    );
}
