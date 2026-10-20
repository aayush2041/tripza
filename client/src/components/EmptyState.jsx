import React from 'react';
import './EmptyState.css';

export function EmptyState({ icon, title, description, message, action }) {
  const text = description || message;
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {text && <p className="empty-state__description">{text}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
