import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getMyOrganizedTrips,
  getMyJoinedTrips,
  getMyTripRequests,
  getTripRequests,
  approveJoinRequest,
  rejectJoinRequest,
  leaveTrip,
  publishTrip,
  cancelTrip,
} from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './MyTripsPage.css';

export function MyTripsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAuthenticated, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('hosted'); // 'hosted' | 'joined' | 'requests'

  // Tab Data States
  const [hostedTrips, setHostedTrips] = useState([]);
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [myRequests, setMyRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Request Management Modal State
  const [selectedTripForRequests, setSelectedTripForRequests] = useState(null);
  const [tripRequests, setTripRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [hostedRes, joinedRes, requestsRes] = await Promise.all([
        getMyOrganizedTrips(),
        getMyJoinedTrips(),
        getMyTripRequests(),
      ]);

      if (hostedRes.success) setHostedTrips(hostedRes.data.trips || []);
      if (joinedRes.success) setJoinedTrips(joinedRes.data.trips || []);
      if (requestsRes.success) setMyRequests(requestsRes.data.requests || []);
    } catch (err) {
      console.error('Failed to fetch user dashboard data:', err);
      setError(err.message || 'Unable to load your trips dashboard.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle URL param ?trip=... to automatically open requests modal
  useEffect(() => {
    const tripParam = searchParams.get('trip');
    if (tripParam && hostedTrips.length > 0) {
      const target = hostedTrips.find((t) => t._id === tripParam);
      if (target) {
        openRequestsModal(target);
      }
    }
  }, [searchParams, hostedTrips]);

  const openRequestsModal = async (trip) => {
    setSelectedTripForRequests(trip);
    setLoadingRequests(true);
    try {
      const res = await getTripRequests(trip._id);
      if (res.success) {
        setTripRequests(res.data.requests || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load requests for this trip.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const closeRequestsModal = () => {
    setSelectedTripForRequests(null);
    setTripRequests([]);
    setDecisionNotes({});
    if (searchParams.get('trip')) {
      searchParams.delete('trip');
      setSearchParams(searchParams);
    }
  };

  const handleDecision = async (requestId, decision) => {
    if (!selectedTripForRequests) return;
    setActionInProgress(true);
    setError(null);
    try {
      const reason = decisionNotes[requestId] || '';
      if (decision === 'approve') {
        await approveJoinRequest(selectedTripForRequests._id, requestId, reason);
        setSuccessNotice('Join request approved!');
      } else {
        await rejectJoinRequest(selectedTripForRequests._id, requestId, reason);
        setSuccessNotice('Join request rejected.');
      }

      // Refresh requests and hosted trips
      const updated = await getTripRequests(selectedTripForRequests._id);
      if (updated.success) setTripRequests(updated.data.requests || []);
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || `Failed to ${decision} request.`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleLeave = async (tripId) => {
    if (!window.confirm('Are you sure you want to withdraw from this trip?')) return;
    try {
      await leaveTrip(tripId);
      setSuccessNotice('You have withdrawn from the trip.');
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to leave trip.');
    }
  };

  const handlePublish = async (tripId) => {
    try {
      await publishTrip(tripId);
      setSuccessNotice('Trip published successfully!');
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to publish trip.');
    }
  };

  const handleCancel = async (tripId) => {
    if (!window.confirm('Are you sure you want to cancel this trip? Members will be notified.')) return;
    try {
      await cancelTrip(tripId);
      setSuccessNotice('Trip has been cancelled.');
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to cancel trip.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      val || 0
    );
  };

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', maxWidth: '580px' }}>
        <Notice type="warning" title="Sign In Required">
          Please log in to manage your hosted trips, joined journeys, and active join requests.
        </Notice>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/login?redirect=/my-trips" className="btn btn--primary">
            Sign In
          </Link>
          <Link to="/register" className="btn btn--secondary">
            Register
          </Link>
        </div>
      </div>
    );
  }

  const isVerified = profile?.verificationStatus === 'verified';

  return (
    <div className="my-trips-page">
      <section className="my-trips-hero">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="heading-xl">My Trips Dashboard</h1>
            <p className="text-muted" style={{ marginTop: 'var(--space-2)' }}>
              Manage your hosted expeditions, confirmed travel memberships, and join applications.
            </p>
          </div>
          <Link to="/trips/create" className="btn btn--primary">
            + List a Trip
          </Link>
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

        {/* Tab Navigation */}
        <div className="my-trips-tabs">
          <button
            type="button"
            className={`my-trips-tab-btn ${activeTab === 'hosted' ? 'my-trips-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('hosted')}
          >
            <span>Trips I&apos;m Hosting</span>
            <span className="tab-badge">{hostedTrips.length}</span>
          </button>

          <button
            type="button"
            className={`my-trips-tab-btn ${activeTab === 'joined' ? 'my-trips-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('joined')}
          >
            <span>Trips I&apos;ve Joined</span>
            <span className="tab-badge">{joinedTrips.length}</span>
          </button>

          <button
            type="button"
            className={`my-trips-tab-btn ${activeTab === 'requests' ? 'my-trips-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <span>My Join Requests</span>
            <span className="tab-badge">{myRequests.length}</span>
          </button>
        </div>

        {/* Tab 1: Trips I'm Hosting */}
        {activeTab === 'hosted' && (
          <div>
            {loading ? (
              <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
                <LoadingSpinner size="md" message="Loading your hosted trips..." />
              </div>
            ) : hostedTrips.length === 0 ? (
              <EmptyState
                icon="🏕️"
                title="You Haven't Hosted Any Trips Yet"
                description="List your planned journey, share route and split costs, and travel across India with verified companions."
                action={
                  <Link to="/trips/create" className="btn btn--primary">
                    Create Your First Trip
                  </Link>
                }
              />
            ) : (
              <div className="dashboard-grid">
                {hostedTrips.map((trip) => {
                  const maxJoiners = Math.max(1, trip.maxGroupSize - 1);
                  const filled = trip.approvedMembersCount || 0;
                  const isFull = filled >= maxJoiners;

                  return (
                    <div key={trip._id} className="dash-trip-card">
                      <div>
                        <div className="dash-trip-card__header">
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Badge variant="primary" size="sm">
                              {trip.category?.toUpperCase()}
                            </Badge>
                            {trip.status === 'published' && <Badge variant="success" size="sm">Published</Badge>}
                            {trip.status === 'draft' && <Badge variant="warning" size="sm">Draft</Badge>}
                            {trip.status === 'cancelled' && <Badge variant="danger" size="sm">Cancelled</Badge>}
                            {trip.status === 'completed' && <Badge variant="neutral" size="sm">Completed</Badge>}
                          </div>
                          {isFull && <Badge variant="danger" size="sm">Full</Badge>}
                        </div>

                        <h3 className="dash-trip-card__title">{trip.title}</h3>
                        <div className="dash-trip-card__route">
                          {trip.startingCity} ➔ {trip.destination}
                        </div>

                        <div className="dash-trip-card__meta">
                          <div>
                            <strong>Dates:</strong> {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                          </div>
                          <div>
                            <strong>Capacity:</strong> {filled + 1} of {trip.maxGroupSize} travellers ({filled} companions)
                          </div>
                          <div>
                            <strong>Join Policy:</strong>{' '}
                            {trip.joinPolicy === 'direct_join' ? 'Instant Join' : 'Approval Required'}
                          </div>
                          <div>
                            <strong>Budget:</strong> {formatCurrency(trip.budget?.amount)} / person
                          </div>
                        </div>
                      </div>

                      <div className="dash-trip-card__actions">
                        <Link to={`/trips/${trip._id}`} className="btn btn--outline btn--sm">
                          View
                        </Link>

                        {trip.status !== 'cancelled' && (
                          <Link to={`/trips/${trip._id}/edit`} className="btn btn--secondary btn--sm">
                            Edit
                          </Link>
                        )}

                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => openRequestsModal(trip)}
                        >
                          Join Requests
                        </button>

                        {trip.status === 'draft' && isVerified && (
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => handlePublish(trip._id)}
                          >
                            Publish
                          </button>
                        )}

                        {trip.status === 'published' && (
                          <button
                            type="button"
                            className="btn btn--sm"
                            style={{ color: 'var(--color-danger)' }}
                            onClick={() => handleCancel(trip._id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Trips I've Joined */}
        {activeTab === 'joined' && (
          <div>
            {loading ? (
              <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
                <LoadingSpinner size="md" message="Loading your joined trips..." />
              </div>
            ) : joinedTrips.length === 0 ? (
              <EmptyState
                icon="🎒"
                title="No Joined Trips Yet"
                description="Explore published journeys across India and request to join group travels matching your schedule."
                action={
                  <Link to="/trips" className="btn btn--primary">
                    Find Trips to Join
                  </Link>
                }
              />
            ) : (
              <div className="dashboard-grid">
                {joinedTrips.map((trip) => (
                  <div key={trip._id} className="dash-trip-card">
                    <div>
                      <div className="dash-trip-card__header">
                        <Badge variant="teal" size="sm">
                          {trip.category?.toUpperCase()}
                        </Badge>
                        <Badge variant="success" size="sm">Confirmed Member</Badge>
                      </div>

                      <h3 className="dash-trip-card__title">{trip.title}</h3>
                      <div className="dash-trip-card__route">
                        {trip.startingCity} ➔ {trip.destination}
                      </div>

                      <div className="dash-trip-card__meta">
                        <div>
                          <strong>Host:</strong> {trip.organiser?.profile?.fullName || 'Trip Host'}
                        </div>
                        <div>
                          <strong>Dates:</strong> {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                        </div>
                        <div>
                          <strong>Budget Split:</strong> {formatCurrency(trip.budget?.amount)} / person
                        </div>
                        <div>
                          <strong>Meeting Point:</strong> {trip.meetingPoint}
                        </div>
                      </div>
                    </div>

                    <div className="dash-trip-card__actions">
                      <Link to={`/trips/${trip._id}`} className="btn btn--outline btn--sm">
                        View Trip
                      </Link>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => handleLeave(trip._id)}
                      >
                        Leave Trip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: My Requests */}
        {activeTab === 'requests' && (
          <div>
            {loading ? (
              <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
                <LoadingSpinner size="md" message="Loading your trip requests..." />
              </div>
            ) : myRequests.length === 0 ? (
              <EmptyState
                icon="📨"
                title="No Active Requests"
                description="When you apply to join trips requiring host approval, track their approval status here."
                action={
                  <Link to="/trips" className="btn btn--primary">
                    Discover Trips
                  </Link>
                }
              />
            ) : (
              <div className="dashboard-grid">
                {myRequests.map((req) => {
                  const trip = req.trip;
                  if (!trip) return null;

                  return (
                    <div key={req._id} className="dash-trip-card">
                      <div>
                        <div className="dash-trip-card__header">
                          <Badge variant="primary" size="sm">
                            {trip.category?.toUpperCase()}
                          </Badge>
                          {req.status === 'pending' && <Badge variant="warning" size="sm">Pending Review</Badge>}
                          {req.status === 'approved' && <Badge variant="success" size="sm">Approved</Badge>}
                          {req.status === 'rejected' && <Badge variant="danger" size="sm">Declined</Badge>}
                          {req.status === 'withdrawn' && <Badge variant="neutral" size="sm">Withdrawn</Badge>}
                        </div>

                        <h3 className="dash-trip-card__title">{trip.title}</h3>
                        <div className="dash-trip-card__route">
                          {trip.startingCity} ➔ {trip.destination}
                        </div>

                        <div className="dash-trip-card__meta">
                          <div>
                            <strong>Host:</strong> {trip.organiser?.profile?.fullName || 'Trip Host'}
                          </div>
                          <div>
                            <strong>Applied On:</strong> {formatDate(req.requestedAt)}
                          </div>
                          {req.requestMessage && (
                            <div style={{ marginTop: 'var(--space-1)' }}>
                              <strong>Your Note:</strong> &quot;{req.requestMessage}&quot;
                            </div>
                          )}
                          {req.decisionReason && (
                            <div style={{ marginTop: 'var(--space-1)', color: 'var(--color-text-primary)' }}>
                              <strong>Host Response:</strong> &quot;{req.decisionReason}&quot;
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="dash-trip-card__actions">
                        <Link to={`/trips/${trip._id}`} className="btn btn--outline btn--sm">
                          View Trip
                        </Link>
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => handleLeave(trip._id)}
                          >
                            Withdraw Request
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Host Requests Management Modal */}
      {selectedTripForRequests && (
        <div className="modal-overlay" onClick={closeRequestsModal}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeRequestsModal}
            >
              ×
            </button>
            <h3 className="modal-title">Join Requests</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-2) 0' }}>
              Review applicants for <strong>{selectedTripForRequests.title}</strong>
            </p>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Approved: {selectedTripForRequests.approvedMembersCount || 0} / {Math.max(1, selectedTripForRequests.maxGroupSize - 1)} joiner capacity
            </div>

            {loadingRequests ? (
              <div style={{ padding: 'var(--space-8) 0', textAlign: 'center' }}>
                <LoadingSpinner size="sm" message="Loading applicant requests..." />
              </div>
            ) : tripRequests.length === 0 ? (
              <div style={{ padding: 'var(--space-6) 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No join requests have been submitted for this journey yet.
              </div>
            ) : (
              <div className="requests-modal-list">
                {tripRequests.map((req) => {
                  const applicant = req.traveller;
                  const applicantProfile = applicant?.profile;
                  const isApplicantVerified = applicantProfile?.verificationStatus === 'verified';

                  return (
                    <div key={req._id} className="request-card">
                      <div className="request-card__header">
                        <div className="request-card__user">
                          <span>{applicantProfile?.fullName || applicant?.email || 'Applicant'}</span>
                          {isApplicantVerified ? (
                            <Badge variant="success" size="sm">✓ Verified</Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">Unverified</Badge>
                          )}
                        </div>
                        <div>
                          {req.status === 'pending' && <Badge variant="warning" size="sm">Pending</Badge>}
                          {req.status === 'approved' && <Badge variant="success" size="sm">Approved</Badge>}
                          {req.status === 'rejected' && <Badge variant="danger" size="sm">Rejected</Badge>}
                          {req.status === 'withdrawn' && <Badge variant="neutral" size="sm">Withdrawn</Badge>}
                        </div>
                      </div>

                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Applied: {formatDate(req.requestedAt)}
                      </div>

                      {req.requestMessage && (
                        <div className="request-card__msg">
                          &quot;{req.requestMessage}&quot;
                        </div>
                      )}

                      {req.decisionReason && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                          <strong>Note provided:</strong> {req.decisionReason}
                        </div>
                      )}

                      {req.status === 'pending' && (
                        <div className="request-card__actions">
                          <input
                            type="text"
                            className="decision-input"
                            placeholder="Optional response / note to traveller..."
                            value={decisionNotes[req._id] || ''}
                            onChange={(e) =>
                              setDecisionNotes((prev) => ({ ...prev, [req._id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            disabled={actionInProgress}
                            onClick={() => handleDecision(req._id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            disabled={actionInProgress}
                            onClick={() => handleDecision(req._id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default MyTripsPage;
