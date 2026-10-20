import React, { useState } from 'react';
import { submitReport } from '../services/api';
import './ReportModal.css';

export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle = '',
  onReportSubmitted,
}) {
  const [category, setCategory] = useState('inappropriate_content');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await submitReport({
        targetType,
        targetId,
        category,
        explanation,
      });
      setSuccess(true);
      if (onReportSubmitted) {
        onReportSubmitted();
      }
      setTimeout(() => {
        setSuccess(false);
        setExplanation('');
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h3>🚩 Report {targetType ? targetType.charAt(0).toUpperCase() + targetType.slice(1) : 'Item'}</h3>
          <button className="report-modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {targetTitle && (
          <div className="report-target-preview">
            <strong>Reporting:</strong> {targetTitle}
          </div>
        )}

        {success ? (
          <div className="report-success-state">
            <span className="report-success-icon">✓</span>
            <p>Thank you. Your report has been submitted to the TripZa safety and moderation team.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-form">
            {error && <div className="report-error-banner">{error}</div>}

            <div className="report-field">
              <label htmlFor="report-category">Reason for reporting</label>
              <select
                id="report-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="harassment">Harassment or Abuse</option>
                <option value="spam">Spam or Commercial Promotion</option>
                <option value="misleading">Misleading or Inaccurate Information</option>
                <option value="impersonation">Impersonation or Fake Account</option>
                <option value="unsafe_conduct">Unsafe Conduct or Safety Threat</option>
                <option value="inappropriate_content">Inappropriate Content</option>
                <option value="other">Other Concern</option>
              </select>
            </div>

            <div className="report-field">
              <label htmlFor="report-explanation">
                Additional Details <span>(Optional, max 1000 characters)</span>
              </label>
              <textarea
                id="report-explanation"
                rows="4"
                maxLength="1000"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Please describe why you are reporting this..."
              />
              <span className="report-char-count">{explanation.length}/1000</span>
            </div>

            <p className="report-privacy-disclaimer">
              🔒 Your report is confidential. The reported user will not be informed of your identity.
            </p>

            <div className="report-modal-actions">
              <button
                type="button"
                className="report-cancel-btn"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="report-submit-btn" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
