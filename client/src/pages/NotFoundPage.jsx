import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.jsx';
import { Badge } from '../components/Badge.jsx';

export function NotFoundPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--space-10)' }}>
      <EmptyState
        icon={
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Badge variant="danger" size="md">404 Error</Badge>
          </div>
        }
        title="Page Not Found"
        description="The trail you are looking for does not exist on TripZa. It may have moved or been taken off the map."
        action={
          <Link to="/" className="btn btn--primary">
            Return to Overview
          </Link>
        }
      />
    </div>
  );
}
