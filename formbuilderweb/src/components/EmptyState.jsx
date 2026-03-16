'use client';
import Link from 'next/link';

export default function EmptyState({ icon = '📭', title, description, action, actionLabel, actionHref }) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">{icon}</div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {(action || actionHref) && (
                actionHref ? (
                    <Link href={actionHref} className="btn btn-primary">{actionLabel}</Link>
                ) : (
                    <button className="btn btn-primary" onClick={action}>{actionLabel}</button>
                )
            )}
        </div>
    );
}
