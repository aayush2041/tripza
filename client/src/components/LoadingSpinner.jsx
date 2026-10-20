import React from 'react';

export function LoadingSpinner({ label = 'Loading...', size = 'md' }) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 36,
  };
  const px = sizeMap[size] || 24;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--color-text-muted)',
      }}
      role="status"
      aria-live="polite"
    >
      <svg
        style={{
          width: `${px}px`,
          height: `${px}px`,
          animation: 'spin 1s linear infinite',
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="var(--color-border)"
          strokeWidth="3"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && <span style={{ fontSize: 'var(--font-size-sm)' }}>{label}</span>}
      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
}
