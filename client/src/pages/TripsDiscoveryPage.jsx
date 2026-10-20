import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTrips } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './TripsDiscoveryPage.css';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'trekking', label: 'Trekking 🥾' },
  { value: 'hiking', label: 'Hiking 🌲' },
  { value: 'backpacking', label: 'Backpacking 🎒' },
  { value: 'road trip', label: 'Road Trip 🚗' },
  { value: 'weekend getaway', label: 'Weekend Getaway 🌅' },
  { value: 'sightseeing', label: 'Sightseeing 🏛️' },
  { value: 'camping', label: 'Camping ⛺' },
  { value: 'other', label: 'Other 🧭' },
];

export function TripsDiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search filter state from URL or defaults
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [startingCity, setStartingCity] = useState(searchParams.get('startingCity') || '');
  const [destination, setDestination] = useState(searchParams.get('destination') || '');
  const [maxBudget, setMaxBudget] = useState(searchParams.get('maxBudget') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('availableOnly') === 'true');
  const [sort, setSort] = useState(searchParams.get('sort') || 'departure_asc');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Trips data state
  const [trips, setTrips] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 12,
        sort,
      };
      if (query.trim()) params.q = query.trim();
      if (category) params.category = category;
      if (startingCity.trim()) params.startingCity = startingCity.trim();
      if (destination.trim()) params.destination = destination.trim();
      if (maxBudget) params.maxBudget = maxBudget;
      if (startDate) params.startDate = startDate;
      if (availableOnly) params.availableOnly = true;

      const res = await getTrips(params);
      if (res.success && res.data) {
        setTrips(res.data.trips || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 12, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to fetch trips:', err);
      setError(err.message || 'Unable to load trips. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, category, startingCity, destination, maxBudget, startDate, availableOnly, sort, page]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleResetFilters = () => {
    setQuery('');
    setCategory('');
    setStartingCity('');
    setDestination('');
    setMaxBudget('');
    setStartDate('');
    setAvailableOnly(false);
    setSort('departure_asc');
    setPage(1);
    setSearchParams({});
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      val || 0
    );
  };

  return (
    <div className="discovery-page">
      {/* Hero Header */}
      <section className="discovery-hero">
        <div className="container discovery-hero__container">
          <div>
            <h1 className="discovery-hero__title">Find Upcoming Journeys</h1>
            <p className="discovery-hero__subtitle">
              Discover authentic group adventures across India. Filter by destination, category, cost splits, and travel dates.
            </p>
          </div>
          <Link to="/trips/create" className="btn btn--primary">
            + List a Trip
          </Link>
        </div>
      </section>

      <div className="container">
        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Notice type="error" title="Could not load trips">
              {error}
            </Notice>
          </div>
        )}

        <div className="discovery-layout">
          {/* Filters Sidebar */}
          <aside className="filter-sidebar">
            <div className="filter-sidebar__header">
              <h2 className="filter-sidebar__title">Filters</h2>
              <button
                type="button"
                className="filter-sidebar__reset-btn"
                onClick={handleResetFilters}
              >
                Reset All
              </button>
            </div>

            {/* Keyword Search */}
            <div className="filter-group">
              <label htmlFor="search-input" className="filter-group__label">Keywords / Search</label>
              <input
                id="search-input"
                type="text"
                className="filter-input"
                placeholder="Spiti, Manali, Western Ghats..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Category */}
            <div className="filter-group">
              <label htmlFor="category-select" className="filter-group__label">Category</label>
              <select
                id="category-select"
                className="filter-select"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div className="filter-group">
              <label htmlFor="destination-input" className="filter-group__label">Destination</label>
              <input
                id="destination-input"
                type="text"
                className="filter-input"
                placeholder="e.g. Leh, Goa, Rishikesh"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Starting City */}
            <div className="filter-group">
              <label htmlFor="starting-city-input" className="filter-group__label">Starting City</label>
              <input
                id="starting-city-input"
                type="text"
                className="filter-input"
                placeholder="e.g. Delhi, Bengaluru, Mumbai"
                value={startingCity}
                onChange={(e) => {
                  setStartingCity(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Start Date */}
            <div className="filter-group">
              <label htmlFor="start-date-input" className="filter-group__label">Departing After</label>
              <input
                id="start-date-input"
                type="date"
                className="filter-input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Max Budget */}
            <div className="filter-group">
              <label htmlFor="budget-input" className="filter-group__label">
                Max Budget (INR) {maxBudget ? `: ₹${Number(maxBudget).toLocaleString('en-IN')}` : ''}
              </label>
              <input
                id="budget-input"
                type="number"
                min="0"
                step="500"
                className="filter-input"
                placeholder="e.g. 15000"
                value={maxBudget}
                onChange={(e) => {
                  setMaxBudget(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Available Spots Only */}
            <div className="filter-group">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => {
                    setAvailableOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                <span>Available spots only</span>
              </label>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="discovery-content">
            {/* Toolbar */}
            <div className="discovery-toolbar">
              <div className="discovery-toolbar__count">
                Showing <strong>{trips.length}</strong> of <strong>{pagination.total}</strong> published journeys
              </div>

              <div className="discovery-toolbar__sort">
                <label htmlFor="sort-select" style={{ color: 'var(--color-text-muted)' }}>Sort by:</label>
                <select
                  id="sort-select"
                  className="filter-select"
                  style={{ width: 'auto' }}
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="departure_asc">Departure Date (Earliest)</option>
                  <option value="departure_desc">Departure Date (Latest)</option>
                  <option value="budget_asc">Budget (Lowest First)</option>
                  <option value="budget_desc">Budget (Highest First)</option>
                  <option value="newest">Recently Published</option>
                </select>
              </div>
            </div>

            {/* Results Grid / Loading / Empty */}
            {loading ? (
              <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
                <LoadingSpinner size="lg" message="Searching active trips across India..." />
              </div>
            ) : trips.length === 0 ? (
              <EmptyState
                icon="🧭"
                title="No Trips Found Matching Your Filters"
                description="Try broadening your search keywords, adjusting budget limits, or clearing filters to see more journeys."
                action={
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button type="button" className="btn btn--secondary" onClick={handleResetFilters}>
                      Clear Filters
                    </button>
                    <Link to="/trips/create" className="btn btn--primary">
                      Host a Trip
                    </Link>
                  </div>
                }
              />
            ) : (
              <>
                <div className="trips-grid">
                  {trips.map((trip) => {
                    const maxJoiners = Math.max(1, trip.maxGroupSize - 1);
                    const filled = trip.approvedMembersCount || 0;
                    const spotsRemaining = Math.max(0, maxJoiners - filled);
                    const isFull = spotsRemaining === 0;
                    const fillPercent = Math.min(100, Math.round((filled / maxJoiners) * 100));

                    return (
                      <Link to={`/trips/${trip._id}`} key={trip._id} className="trip-card">
                        <div>
                          <div className="trip-card__header">
                            <div className="trip-card__badges">
                              <Badge variant="primary" size="sm">
                                {trip.category.toUpperCase()}
                              </Badge>
                              {trip.joinPolicy === 'direct_join' ? (
                                <Badge variant="success" size="sm">Instant Join</Badge>
                              ) : (
                                <Badge variant="neutral" size="sm">Host Approval</Badge>
                              )}
                            </div>
                            {isFull && <Badge variant="danger" size="sm">Full</Badge>}
                          </div>

                          <h3 className="trip-card__title">{trip.title}</h3>

                          <div className="trip-card__route">
                            <span>{trip.startingCity}</span>
                            <span className="trip-card__route-arrow">➔</span>
                            <span>{trip.destination}</span>
                          </div>

                          <div className="trip-card__details">
                            <div className="trip-card__detail-item">
                              <span className="trip-card__detail-label">Dates</span>
                              <span className="trip-card__detail-val">
                                {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                              </span>
                            </div>
                            <div className="trip-card__detail-item">
                              <span className="trip-card__detail-label">Budget</span>
                              <span className="trip-card__detail-val">
                                {formatCurrency(trip.budget?.amount)} / person
                              </span>
                            </div>
                          </div>

                          {/* Capacity Indicator */}
                          <div className="trip-card__capacity">
                            <div className="trip-card__capacity-header">
                              <span style={{ color: 'var(--color-text-muted)' }}>Group Capacity</span>
                              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                {isFull ? (
                                  <strong style={{ color: 'var(--color-danger)' }}>Fully Booked</strong>
                                ) : (
                                  `${spotsRemaining} spot${spotsRemaining > 1 ? 's' : ''} left`
                                )}
                              </span>
                            </div>
                            <div className="trip-card__capacity-bar">
                              <div
                                className={`trip-card__capacity-fill ${isFull ? 'trip-card__capacity-fill--full' : ''}`}
                                style={{ width: `${fillPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Footer / Host Info */}
                        <div className="trip-card__footer">
                          <div className="trip-card__host">
                            <div className="trip-card__host-avatar">
                              {trip.organiser?.profile?.fullName
                                ? trip.organiser.profile.fullName.charAt(0).toUpperCase()
                                : 'H'}
                            </div>
                            <div className="trip-card__host-info">
                              <span className="trip-card__host-name">
                                {trip.organiser?.profile?.fullName || 'Trip Host'}
                              </span>
                              {trip.organiser?.profile?.verificationStatus === 'verified' && (
                                <span style={{ color: 'var(--color-success)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  ✓ Verified Host
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="btn btn--outline btn--sm" style={{ pointerEvents: 'none' }}>
                            View Details
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="pagination">
                    <button
                      type="button"
                      className="pagination__btn"
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      ← Previous
                    </button>
                    <span className="pagination__info">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      className="pagination__btn"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
export default TripsDiscoveryPage;
