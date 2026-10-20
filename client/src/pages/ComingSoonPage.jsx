import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.jsx';
import { Badge } from '../components/Badge.jsx';

export function ComingSoonPage({ title, featureName, description, plannedPrompt }) {
  return (
    <div className="container" style={{ paddingTop: 'var(--space-10)' }}>
      <EmptyState
        icon={
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Badge variant="warning" size="md">Roadmap Item: {plannedPrompt}</Badge>
          </div>
        }
        title={title || `${featureName} — Coming Soon`}
        description={
          description ||
          `The ${featureName} feature is part of TripZa's phased architecture rollout and will be implemented in subsequent development prompts.`
        }
        action={
          <Link to="/" className="btn btn--primary">
            Return to Overview
          </Link>
        }
      />
    </div>
  );
}
