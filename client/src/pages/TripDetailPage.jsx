import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTripById, joinTrip, leaveTrip, cancelTrip, publishTrip } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './TripDetailPage.css';

export function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated } = useAuth();

  const [trip, setTrip] = useState(null);
  const [userMembership, setUserMembership] = useState(null);
  const [isOrganiser, setIsOrganiser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Join Modal State
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');

  const fetchTripDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTripById(id);
      if (res.success && res.data) {
        setTrip(res.data.trip);
        setUserMembership(res.data.userMembership);
        setIsOrganiser(res.data.isOrganiser);
      }
    } catch (err) {
      console.error('Failed to load trip details:', err);
      setError(err.message || 'Unable to load trip details. It may not exist or has been removed.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/trips/${id}`);
      return;
    }

    if (trip.joinPolicy === 'direct_join') {
      if (window.confirm(`Are you sure you want to join "${trip.title}" directly?`)) {
        performJoin('');
      }
    } else {
      setJoinModalOpen(true);
    }
  };

  const performJoin = async (msg) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await joinTrip(id, msg);
      setSuccessNotice(res.message || 'Join action processed successfully!');
      setJoinModalOpen(false);
      setJoinMessage('');
      await fetchTripDetails();
    } catch (err) {
      setError(err.message || 'Failed to submit join request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTrip = async () => {
    if (!window.confirm('Are you sure you want to withdraw/leave this trip?')) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await leaveTrip(id);
      setSuccessNotice(res.message || 'You have successfully left the trip.');
      await fetchTripDetails();
    } catch (err) {
      setError(err.message || 'Failed to leave trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!window.confirm('Are you sure you want to cancel this entire trip? All joined members will be notified.')) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await cancelTrip(id);
      setSuccessNotice(res.message || 'Trip has been cancelled.');
      await fetchTripDetails();
    } catch (err) {
      setError(err.message || 'Failed to cancel trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishDraft = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await publishTrip(id);
      setSuccessNotice(res.message || 'Trip published successfully to the community!');
      await fetchTripDetails();
    } catch (err) {
      setError(err.message || 'Failed to publish trip.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', textAlign: 'center' }}>
        <LoadingSpinner size="lg" message="Loading itinerary and trip details..." />
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <Notice type="error" title="Trip Not Found">
          {error}
        </Notice>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Link to="/trips" className="btn btn--secondary">
            ← Browse All Trips
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const calculateDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? `${diff} Days` : '1 Day';
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      val || 0
    );
  };

  const maxJoiners = Math.max(1, trip.maxGroupSize - 1);
  const filledSpots = trip.approvedMembersCount || 0;
  const spotsRemaining = Math.max(0, maxJoiners - filledSpots);
  const isFull = spotsRemaining === 0;
  const fillPercent = Math.min(100, Math.round((filledSpots / maxJoiners) * 100));

  const hostProfile = trip.organiser?.profile;
  const isHostVerified = hostProfile?.verificationStatus === 'verified';

  return (
    <div className="trip-detail-page">
      {/* Top Header Banner */}
      <section className="trip-detail-header-bar">
        <div className="container">
          <Link to="/trips" className="back-link">
            ← Back to all trips
          </Link>

          <div className="trip-title-area">
            <div className="trip-title-badges">
              <Badge variant="primary" size="md">
                {trip.category?.toUpperCase()}
              </Badge>
              {trip.status === 'published' && <Badge variant="success">Published</Badge>}
              {trip.status === 'draft' && <Badge variant="warning">Draft</Badge>}
              {trip.status === 'cancelled' && <Badge variant="danger">Cancelled</Badge>}
              {trip.status === 'completed' && <Badge variant="neutral">Completed</Badge>}
              {trip.joinPolicy === 'direct_join' ? (
                <Badge variant="teal">Instant Join</Badge>
              ) : (
                <Badge variant="neutral">Host Approval Required</Badge>
              )}
            </div>

            <h1 className="trip-title">{trip.title}</h1>

            <div className="trip-route-banner">
              <span>{trip.startingCity}</span>
              {trip.intermediateStops && trip.intermediateStops.length > 0 && (
                <>
                  <span style={{ color: 'var(--color-text-muted)' }}>➔</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    via {trip.intermediateStops.join(', ')}
                  </span>
                </>
              )}
              <span style={{ color: 'var(--color-text-muted)' }}>➔</span>
              <span>{trip.destination}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {successNotice && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Notice type="success" title="Success">
              {successNotice}
            </Notice>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Notice type="error" title="Notice">
              {error}
            </Notice>
          </div>
        )}

        <div className="trip-detail-grid">
          {/* Main Trip Information Column */}
          <main className="trip-main-content">
            {/* Highlights Stats */}
            <div className="trip-stats-grid">
              <div className="trip-stat-card">
                <span className="trip-stat-card__label">Duration</span>
                <span className="trip-stat-card__val">{calculateDays(trip.startDate, trip.endDate)}</span>
              </div>
              <div className="trip-stat-card">
                <span className="trip-stat-card__label">Dates</span>
                <span className="trip-stat-card__val" style={{ fontSize: 'var(--font-size-base)' }}>
                  {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                </span>
              </div>
              <div className="trip-stat-card">
                <span className="trip-stat-card__label">Budget Split</span>
                <span className="trip-stat-card__val">{formatCurrency(trip.budget?.amount)}</span>
              </div>
              <div className="trip-stat-card">
                <span className="trip-stat-card__label">Group Capacity</span>
                <span className="trip-stat-card__val">
                  {trip.approvedMembersCount + 1} / {trip.maxGroupSize}
                </span>
              </div>
            </div>

            {/* Overview / Story */}
            <section className="detail-section">
              <h2 className="detail-section__title">About This Trip</h2>
              <p className="trip-description">{trip.description}</p>
            </section>

            {/* Route & Departure Logistics */}
            <section className="detail-section">
              <h2 className="detail-section__title">Route &amp; Meeting Details</h2>
              <div className="route-box">
                <div className="route-stop-item">
                  <div className="route-stop-dot route-stop-dot--start" />
                  <div>
                    <strong>Departure City: {trip.startingCity}</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      <strong>Meeting Point:</strong> {trip.meetingPoint}
                    </p>
                  </div>
                </div>

                {trip.intermediateStops && trip.intermediateStops.length > 0 && (
                  <div className="route-stop-item">
                    <div className="route-stop-dot route-stop-dot--mid" />
                    <div>
                      <strong>Key Waypoints &amp; Stops:</strong>
                      <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {trip.intermediateStops.join(' ➔ ')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="route-stop-item">
                  <div className="route-stop-dot route-stop-dot--end" />
                  <div>
                    <strong>Final Destination: {trip.destination}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Budget Breakdown: Inclusions & Exclusions */}
            <section className="detail-section">
              <h2 className="detail-section__title">Expected Budget &amp; Splits</h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                Estimated total cost per traveller is <strong>{formatCurrency(trip.budget?.amount)}</strong>. TripZa encourages transparent cost sharing among companions.
              </p>

              <div className="budget-splits-grid">
                <div className="budget-split-col">
                  <div className="budget-split-col__title" style={{ color: 'var(--color-success)' }}>
                    <span>✓</span> What is Included
                  </div>
                  {trip.budget?.included && trip.budget.included.length > 0 ? (
                    <ul className="budget-items-list">
                      {trip.budget.included.map((item, idx) => (
                        <li key={idx}>
                          <span style={{ color: 'var(--color-success)' }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      No specific inclusions listed.
                    </p>
                  )}
                </div>

                <div className="budget-split-col">
                  <div className="budget-split-col__title" style={{ color: 'var(--color-danger)' }}>
                    <span>✕</span> What is Not Included
                  </div>
                  {trip.budget?.excluded && trip.budget.excluded.length > 0 ? (
                    <ul className="budget-items-list">
                      {trip.budget.excluded.map((item, idx) => (
                        <li key={idx}>
                          <span style={{ color: 'var(--color-danger)' }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      Personal expenses and individual travel gear.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Planned Itinerary */}
            {trip.itinerary && trip.itinerary.length > 0 && (
              <section className="detail-section">
                <h2 className="detail-section__title">Planned Day-by-Day Itinerary</h2>
                <div className="itinerary-timeline">
                  {trip.itinerary.map((dayItem) => (
                    <div key={dayItem.day} className="itinerary-day-card">
                      <div className="itinerary-day-header">
                        <span className="itinerary-day-number">Day {dayItem.day}</span>
                        <h4 className="itinerary-day-title">{dayItem.title}</h4>
                      </div>
                      {dayItem.description && (
                        <p className="itinerary-day-desc">{dayItem.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>

          {/* Right Sidebar: Host & Booking Action Card */}
          <aside className="trip-sidebar">
            <div className="booking-card">
              <div className="booking-price">
                <span className="booking-price__amount">{formatCurrency(trip.budget?.amount)}</span>
                <span className="booking-price__unit">/ person</span>
              </div>

              {/* Group Capacity Progress */}
              <div className="booking-capacity-info">
                <div className="booking-capacity-header">
                  <span style={{ color: 'var(--color-text-muted)' }}>Available Spots</span>
                  <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                    {isFull ? '0 spots left' : `${spotsRemaining} spots available`}
                  </span>
                </div>
                <div className="booking-capacity-bar">
                  <div
                    className="booking-capacity-fill"
                    style={{ width: `${fillPercent}%`, backgroundColor: isFull ? 'var(--color-danger)' : undefined }}
                  />
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Total group limit: {trip.maxGroupSize} travellers (1 Host + {maxJoiners} Companions)
                </span>
              </div>

              {/* Action Buttons & Status Notices */}
              <div className="booking-actions">
                {trip.status === 'cancelled' ? (
                  <Notice type="warning" title="Trip Cancelled">
                    This trip was cancelled by the organiser.
                  </Notice>
                ) : isOrganiser ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <Notice type="info" title="Host Controls">
                      You are the organiser of this trip.
                    </Notice>

                    <Link to={`/trips/${trip._id}/room`} className="btn btn--primary" style={{ width: '100%' }}>
                      💬 Enter Private Trip Room
                    </Link>

                    <Link to={`/trips/${trip._id}/edit`} className="btn btn--secondary" style={{ width: '100%' }}>
                      Edit Trip
                    </Link>

                    <Link to={`/my-trips?trip=${trip._id}`} className="btn btn--secondary" style={{ width: '100%' }}>
                      Manage Join Requests
                    </Link>

                    {trip.status === 'draft' && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handlePublishDraft}
                        disabled={actionLoading}
                        style={{ width: '100%' }}
                      >
                        {actionLoading ? 'Publishing...' : 'Publish Trip Now'}
                      </button>
                    )}

                    {trip.status === 'published' && (
                      <button
                        type="button"
                        className="btn btn--outline"
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', width: '100%' }}
                        onClick={handleCancelTrip}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Cancelling...' : 'Cancel Trip'}
                      </button>
                    )}
                  </div>
                ) : userMembership?.status === 'approved' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <Notice type="success" title="Confirmed Member">
                      You are an approved member of this trip! 🎉
                    </Notice>
                    <Link to={`/trips/${trip._id}/room`} className="btn btn--primary" style={{ width: '100%' }}>
                      💬 Enter Private Trip Room
                    </Link>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={handleLeaveTrip}
                      disabled={actionLoading}
                      style={{ width: '100%' }}
                    >
                      {actionLoading ? 'Withdrawing...' : 'Leave Trip'}
                    </button>
                  </div>
                ) : userMembership?.status === 'pending' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <Notice type="info" title="Request Pending">
                      Your join request is awaiting host review.
                    </Notice>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={handleLeaveTrip}
                      disabled={actionLoading}
                      style={{ width: '100%' }}
                    >
                      {actionLoading ? 'Processing...' : 'Withdraw Request'}
                    </button>
                  </div>
                ) : userMembership?.status === 'rejected' ? (
                  <Notice type="warning" title="Request Not Approved">
                    Your request to join this trip was not approved by the host.
                  </Notice>
                ) : isFull ? (
                  <button type="button" className="btn btn--secondary" disabled style={{ width: '100%' }}>
                    Trip Full
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ width: '100%' }}
                    onClick={handleJoinClick}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? 'Processing...'
                      : trip.joinPolicy === 'direct_join'
                      ? 'Join Trip Now'
                      : 'Request to Join'}
                  </button>
                )}
              </div>
            </div>

            {/* Host Profile Card */}
            <div className="host-summary-card">
              <div className="host-summary-header">
                <div className="host-avatar-lg">
                  {hostProfile?.fullName ? hostProfile.fullName.charAt(0).toUpperCase() : 'H'}
                </div>
                <div>
                  <div className="host-details-name">{hostProfile?.fullName || 'Trip Host'}</div>
                  {isHostVerified ? (
                    <Badge variant="success" size="sm">✓ Verified Traveller</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">Community Host</Badge>
                  )}
                </div>
              </div>

              {hostProfile?.bio && (
                <p className="host-bio">{hostProfile.bio}</p>
              )}

              {hostProfile?.experienceLevel && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  <strong>Travel Experience:</strong> {hostProfile.experienceLevel}
                </div>
              )}

              {hostProfile?.city && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  <strong>Based in:</strong> {hostProfile.city}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Join Request Modal */}
      {joinModalOpen && (
        <div className="modal-overlay" onClick={() => setJoinModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setJoinModalOpen(false)}
            >
              ×
            </button>
            <h3 className="modal-title">Request to Join</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
              Introduce yourself to <strong>{hostProfile?.fullName || 'the host'}</strong>. Share your travel style, fitness level, or any questions about the itinerary.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                performJoin(joinMessage);
              }}
            >
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label htmlFor="join-message" className="form-label">
                  Note to Host (Optional)
                </label>
                <textarea
                  id="join-message"
                  className="form-input"
                  rows="4"
                  placeholder="Hi! I'd love to join this journey. I have experience with weekend hikes and travel light..."
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setJoinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default TripDetailPage;
