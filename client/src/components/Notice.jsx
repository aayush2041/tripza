import React from 'react';
import './Notice.css';

export function Notice({ type = 'info', title, children }) {
  return (
    <div className={`notice notice--${type}`} role="alert">
      {title && <div className="notice__title">{title}</div>}
      <div className="notice__content">{children}</div>
    </div>
  );
}
