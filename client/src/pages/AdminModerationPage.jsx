import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getAdminReports,
  resolveAdminReport,
  getPendingVerifications,
  reviewVerification,
} from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import './AdminModerationPage.css';

export default function AdminModerationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'verifications'

  // Safety Reports state
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verification Review state
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const [activeVerification, setActiveVerification] = useState(null);
  const [verificationDecision, setVerificationDecision] = useState('verified');
  const [verificationReason, setVerificationReason] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationActionError, setVerificationActionError] = useState(null);

  // Review modal state (Reports)
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

  const fetchVerifications = useCallback(async () => {
    setLoadingVerifications(true);
    setVerificationError(null);
    try {
      const res = await getPendingVerifications();
      setPendingVerifications(res.data.pending || []);
    } catch (err) {
      setVerificationError(err.message || 'Failed to fetch pending verifications.');
    } finally {
      setLoadingVerifications(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchVerifications();
  }, [fetchReports, fetchVerifications]);

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

  const handleOpenVerificationReview = (item) => {
    setActiveVerification(item);
    setVerificationDecision('verified');
    setVerificationReason('');
    setVerificationNotes('');
    setVerificationActionError(null);
  };

  const handleCloseVerificationReview = () => {
    setActiveVerification(null);
    setVerificationActionError(null);
  };

  const handleSaveVerification = async (e) => {
    e.preventDefault();
    if (!activeVerification) return;
    if (verificationDecision === 'rejected' && !verificationReason.trim()) {
      setVerificationActionError('A clear reason is required when rejecting verification.');
      return;
    }

    setVerificationSubmitting(true);
    setVerificationActionError(null);

    try {
      await reviewVerification({
        targetUserId: activeVerification.userId,
        decision: verificationDecision,
        reason: verificationReason.trim(),
        notes: verificationNotes.trim(),
      });
      handleCloseVerificationReview();
      fetchVerifications();
    } catch (err) {
      setVerificationActionError(err.message || 'Failed to update verification review.');
    } finally {
      setVerificationSubmitting(false);
    }
  };

  return (
    <div className="admin-moderation-container">
      <div className="admin-header">
        <div>
          <span className="admin-pill">Admin Console</span>
          <h1>🛡️ Safety & Content Moderation Queue</h1>
          <p className="admin-subtitle">
            Review user reports, inspect reported content, verify traveller profiles, and maintain audit trails.
          </p>
        </div>
      </div>

      <div className="admin-tabs-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`filter-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: activeTab === 'reports' ? 'var(--color-primary, #0284c7)' : '#ffffff',
            color: activeTab === 'reports' ? '#ffffff' : '#334155',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🚩 Safety Reports {total > 0 && `(${total})`}
        </button>
        <button
          type="button"
          className={`filter-btn ${activeTab === 'verifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('verifications')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: activeTab === 'verifications' ? 'var(--color-primary, #0284c7)' : '#ffffff',
            color: activeTab === 'verifications' ? '#ffffff' : '#334155',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✓ Pending Verifications {pendingVerifications.length > 0 && `(${pendingVerifications.length})`}
        </button>
      </div>

      {activeTab === 'reports' ? (
        <>
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
        </>
      ) : (
        /* Pending Verifications Tab */
        <>
          <div className="admin-filters-bar" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
              Pending Traveller Identity Verifications ({pendingVerifications.length})
            </span>
            <button className="admin-refresh-btn" onClick={fetchVerifications}>
              🔄 Refresh
            </button>
          </div>

          {loadingVerifications ? (
            <div className="admin-loading">
              <LoadingSpinner />
              <p>Loading pending verification requests...</p>
            </div>
          ) : verificationError ? (
            <div className="admin-error-box">{verificationError}</div>
          ) : pendingVerifications.length === 0 ? (
            <EmptyState
              title="No pending verifications"
              message="All traveller verification applications have been reviewed."
              icon="✓"
            />
          ) : (
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Traveller</th>
                    <th>Home City</th>
                    <th>Interests</th>
                    <th>Bio</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingVerifications.map((p) => (
                    <tr key={p.userId}>
                      <td className="report-date-col">
                        {p.submittedAt
                          ? new Date(p.submittedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Pending'}
                      </td>
                      <td>
                        <strong>{p.fullName || 'Unnamed'}</strong>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{p.email}</div>
                      </td>
                      <td>{p.homeCity || 'Not specified'}</td>
                      <td>
                        {Array.isArray(p.travelInterests) && p.travelInterests.length > 0
                          ? p.travelInterests.slice(0, 3).join(', ')
                          : 'General'}
                      </td>
                      <td style={{ maxWidth: '280px', fontSize: '0.85rem', color: '#475569' }}>
                        {p.bio || 'No bio provided.'}
                      </td>
                      <td>
                        <button
                          className="review-btn"
                          onClick={() => handleOpenVerificationReview(p)}
                        >
                          Review / Decide
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Verification Decision Modal */}
          {activeVerification && (
            <div className="admin-modal-backdrop" onClick={handleCloseVerificationReview}>
              <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal-header">
                  <h3>Verify Traveller: {activeVerification.fullName}</h3>
                  <button className="admin-modal-close" onClick={handleCloseVerificationReview}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveVerification} className="admin-modal-form">
                  {verificationActionError && (
                    <div className="admin-error-box">{verificationActionError}</div>
                  )}

                  <div className="report-inspect-box">
                    <div><strong>Email:</strong> {activeVerification.email}</div>
                    <div><strong>Home City:</strong> {activeVerification.homeCity || 'Not specified'}</div>
                    <div><strong>Bio:</strong> {activeVerification.bio || 'None'}</div>
                  </div>

                  <div className="admin-form-group">
                    <label>Review Decision</label>
                    <select
                      value={verificationDecision}
                      onChange={(e) => setVerificationDecision(e.target.value)}
                    >
                      <option value="verified">Approve (Mark as Verified Traveller)</option>
                      <option value="rejected">Decline / Reject</option>
                    </select>
                  </div>

                  {verificationDecision === 'rejected' && (
                    <div className="admin-form-group">
                      <label>Rejection Reason (Visible to Traveller) *</label>
                      <textarea
                        rows="2"
                        maxLength="500"
                        required
                        value={verificationReason}
                        onChange={(e) => setVerificationReason(e.target.value)}
                        placeholder="e.g. Please provide a more detailed bio and travel experience..."
                      />
                    </div>
                  )}

                  <div className="admin-form-group">
                    <label>Internal Audit Notes (Optional, Admin Only)</label>
                    <textarea
                      rows="2"
                      maxLength="1000"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Notes for the community audit trail..."
                    />
                  </div>

                  <div className="admin-modal-actions">
                    <button
                      type="button"
                      className="admin-cancel-btn"
                      onClick={handleCloseVerificationReview}
                      disabled={verificationSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-save-btn"
                      disabled={verificationSubmitting}
                    >
                      {verificationSubmitting ? 'Saving Decision...' : 'Save Decision'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
