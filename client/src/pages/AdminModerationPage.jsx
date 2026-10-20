import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAdminReports, resolveAdminReport } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import './AdminModerationPage.css';

export default function AdminModerationPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review modal state
  const [activeReport, setActiveReport] = useState(null);
  const [status, setStatus] = useState('action_taken');
  const [resolutionAction, setResolutionAction] = useState('warning_issued');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminReports({
        status: statusFilter,
        targetType: typeFilter || undefined,
        limit: 50,
      });
      setReports(res.data.reports || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch moderation queue.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-moderation-container">
        <div className="admin-access-denied">
          <h2>🔒 Administrator Authorization Required</h2>
          <p>This moderation queue is restricted to authorized TripZa safety administrators.</p>
        </div>
      </div>
    );
  }

  const handleOpenReview = (report) => {
    setActiveReport(report);
    setStatus(report.status === 'open' ? 'action_taken' : report.status);
    setResolutionAction(report.resolutionAction !== 'none' ? report.resolutionAction : 'warning_issued');
    setModeratorNotes(report.moderatorNotes || '');
    setActionError(null);
  };

  const handleCloseReview = () => {
    setActiveReport(null);
    setActionError(null);
  };

  const handleSaveResolution = async (e) => {
    e.preventDefault();
    if (!activeReport) return;
    setSubmitting(true);
    setActionError(null);

    try {
      await resolveAdminReport(activeReport._id, {
        status,
        resolutionAction,
        moderatorNotes,
      });
      handleCloseReview();
      fetchReports();
    } catch (err) {
      setActionError(err.message || 'Failed to update report resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-moderation-container">
      <div className="admin-header">
        <div>
          <span className="admin-pill">Admin Console</span>
          <h1>🛡️ Safety & Content Moderation Queue</h1>
          <p className="admin-subtitle">
            Review user reports, inspect reported content, apply penalties, and maintain audit trails.
          </p>
        </div>
      </div>

      <div className="admin-filters-bar">
        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="open">Open (Unreviewed)</option>
            <option value="under_review">Under Review</option>
            <option value="action_taken">Action Taken</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Target Type:</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="user">User</option>
            <option value="trip">Trip Listing</option>
            <option value="message">Trip Room Message</option>
          </select>
        </div>

        <button className="admin-refresh-btn" onClick={fetchReports}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">
          <LoadingSpinner />
          <p>Loading moderation queue...</p>
        </div>
      ) : error ? (
        <div className="admin-error-box">{error}</div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports match your filters"
          message="The moderation queue is clear for the selected criteria."
          icon="✅"
        />
      ) : (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Target</th>
                <th>Category</th>
                <th>Reporter</th>
                <th>Details</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r._id} className={`status-row-${r.status}`}>
                  <td className="report-date-col">
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <span className={`target-badge ${r.targetType}`}>{r.targetType}</span>
                    <div className="target-preview-text">
                      {r.targetDetails?.title || r.targetDetails?.email || (r.targetDetails?.message && `"${r.targetDetails.message.slice(0, 40)}..."`) || r.targetId}
                    </div>
                  </td>
                  <td>
                    <span className="category-pill">{r.category}</span>
                  </td>
                  <td className="reporter-col">{r.reporter?.email || 'Unknown'}</td>
                  <td className="explanation-col">
                    <p className="explanation-text">{r.explanation || 'No explanation provided.'}</p>
                    {r.moderatorNotes && (
                      <div className="mod-notes-preview">
                        <strong>Mod Note:</strong> {r.moderatorNotes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    <button className="review-btn" onClick={() => handleOpenReview(r)}>
                      Review / Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution Modal */}
      {activeReport && (
        <div className="admin-modal-backdrop" onClick={handleCloseReview}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Moderate Report: {activeReport.targetType}</h3>
              <button className="admin-modal-close" onClick={handleCloseReview}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveResolution} className="admin-modal-form">
              {actionError && <div className="admin-error-box">{actionError}</div>}

              <div className="report-inspect-box">
                <div><strong>Category:</strong> {activeReport.category}</div>
                <div><strong>Reporter:</strong> {activeReport.reporter?.email}</div>
                <div><strong>Explanation:</strong> {activeReport.explanation || 'None'}</div>
                {activeReport.targetDetails && (
                  <div className="target-inspect-details">
                    <strong>Target Content:</strong>
                    <pre>{JSON.stringify(activeReport.targetDetails, null, 2)}</pre>
                  </div>
                )}
              </div>

              <div className="admin-form-group">
                <label>Update Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="under_review">Under Review</option>
                  <option value="action_taken">Action Taken</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label>Resolution Action</label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                >
                  <option value="none">None (Review Only)</option>
                  <option value="warning_issued">Issue Formal Warning</option>
                  <option value="content_removed">Remove Content (Message / Trip)</option>
                  <option value="user_suspended">Suspend User Account</option>
                  <option value="dismissed">Dismiss (No Violation)</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label>Internal Moderator Notes (Restricted)</label>
                <textarea
                  rows="3"
                  maxLength="2000"
                  value={moderatorNotes}
                  onChange={(e) => setModeratorNotes(e.target.value)}
                  placeholder="Audit trail notes visible only to administrators..."
                />
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-cancel-btn"
                  onClick={handleCloseReview}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-save-btn" disabled={submitting}>
                  {submitting ? 'Saving Resolution...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
