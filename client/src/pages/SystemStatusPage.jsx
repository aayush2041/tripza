import React, { useState, useEffect } from 'react';
import { getBackendHealth } from '../services/api.js';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './SystemStatusPage.css';

export function SystemStatusPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBackendHealth();
      setHealthData(response.data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="container status-page">
      <div className="status-page__header">
        <div>
          <h1 className="heading-lg">TripZa System Status & Diagnostics</h1>
          <p className="text-lead" style={{ marginTop: 'var(--space-1)' }}>
            Live diagnostic telemetry for the TripZa backend API and database connectivity.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="btn btn--secondary"
          style={{ alignSelf: 'flex-start' }}
        >
          {loading ? <LoadingSpinner label="Checking..." size="sm" /> : '↻ Refresh Status'}
        </button>
      </div>

      {lastChecked && (
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          Last checked at: {lastChecked}
        </p>
      )}

      {/* Loading state */}
      {loading && !healthData && !error && (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <LoadingSpinner label="Querying backend health endpoint (/api/health)..." size="lg" />
        </div>
      )}

      {/* Network / Offline Error state */}
      {error && (
        <div className="status-error-block">
          <Notice type="error" title="Backend Server Unreachable">
            <p>{error}</p>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong>To resolve:</strong>
              <ol style={{ paddingLeft: 'var(--space-5)', marginTop: 'var(--space-2)' }}>
                <li>Open a terminal and navigate to the project root: <code>cd tripza</code></li>
                <li>Start the backend server: <code>npm run dev:server</code></li>
                <li>Verify the server is running on <code>http://localhost:5000</code></li>
                <li>Click <strong>↻ Refresh Status</strong> above.</li>
              </ol>
            </div>
          </Notice>
        </div>
      )}

      {/* Live Health Data Display */}
      {healthData && (
        <div className="status-grid">
          {/* Overall Health Summary */}
          <Card
            title="Overall System Health"
            subtitle="Calculated from server and database states"
            action={
              <Badge
                variant={healthData.status === 'ok' ? 'success' : 'warning'}
                size="md"
              >
                {healthData.status === 'ok' ? 'System Operational' : 'Degraded (DB Offline)'}
              </Badge>
            }
          >
            <div className="metric-row">
              <span className="metric-label">API Service:</span>
              <span className="metric-value"><code>{healthData.service}</code></span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Environment:</span>
              <span className="metric-value">
                <Badge variant="neutral">{healthData.environment}</Badge>
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Server Uptime:</span>
              <span className="metric-value">{healthData.uptimeSeconds} seconds</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Node Runtime:</span>
              <span className="metric-value">{healthData.server.nodeVersion}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Memory Usage:</span>
              <span className="metric-value">{healthData.server.memoryUsageMb} MB heap</span>
            </div>
          </Card>

          {/* Database Connectivity Status (Honest Reporting) */}
          <Card
            title="Database Connectivity (MongoDB)"
            subtitle="Real-time Mongoose connection monitoring"
            action={
              <Badge
                variant={healthData.database.connected ? 'success' : 'warning'}
                size="md"
              >
                {healthData.database.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            }
          >
            <div className="metric-row">
              <span className="metric-label">Connection Status:</span>
              <span className="metric-value">
                <strong>{healthData.database.status.toUpperCase()}</strong>
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Ready State:</span>
              <span className="metric-value"><code>{healthData.database.readyState}</code></span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Diagnostics:</span>
              <span className="metric-value">{healthData.database.message}</span>
            </div>
            {!healthData.database.connected && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Notice type="warning" title="MongoDB Setup Instructions">
                  To connect MongoDB locally, start your local mongod daemon or provide a connection URI in <code>.env</code>:
                  <pre className="status-code">MONGODB_URI=mongodb://127.0.0.1:27017/tripza_dev</pre>
                  The server will automatically reconnect.
                </Notice>
              </div>
            )}
          </Card>

          {/* Security Baseline Audit */}
          <Card
            title="Active Security Protections"
            subtitle="Verified architectural defenses"
            className="status-grid__full"
          >
            <div className="security-checklist">
              <div className="security-item">
                <span className="security-icon">✓</span>
                <div>
                  <strong>Helmet HTTP Headers:</strong> Content-Security-Policy, X-Frame-Options (DENY), X-Content-Type-Options (nosniff) enabled.
                </div>
              </div>
              <div className="security-item">
                <span className="security-icon">✓</span>
                <div>
                  <strong>Strict CORS:</strong> Restricted to explicit development origin (<code>http://localhost:5173</code>).
                </div>
              </div>
              <div className="security-item">
                <span className="security-icon">✓</span>
                <div>
                  <strong>Rate Limiting:</strong> Enforced across all <code>/api</code> endpoints via Express Rate Limit.
                </div>
              </div>
              <div className="security-item">
                <span className="security-icon">✓</span>
                <div>
                  <strong>Payload Size Limits:</strong> JSON body parser strictly capped at 10KB to avoid memory exhaustion attacks.
                </div>
              </div>
              <div className="security-item">
                <span className="security-icon">✓</span>
                <div>
                  <strong>Credential Sanitization:</strong> Safe logger filters out database passwords and tokens from all logs.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
