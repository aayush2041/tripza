import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTripById, updateTrip, publishTrip } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './TripCreatePage.css';

const CATEGORIES = [
  { value: 'trekking', label: 'Trekking 🥾' },
  { value: 'hiking', label: 'Hiking 🌲' },
  { value: 'backpacking', label: 'Backpacking 🎒' },
  { value: 'road trip', label: 'Road Trip 🚗' },
  { value: 'weekend getaway', label: 'Weekend Getaway 🌅' },
  { value: 'sightseeing', label: 'Sightseeing 🏛️' },
  { value: 'camping', label: 'Camping ⛺' },
  { value: 'other', label: 'Other 🧭' },
];

export function TripEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const isVerified = profile?.verificationStatus === 'verified';

  const [trip, setTrip] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTripById(id);
      if (res.success && res.data) {
        const t = res.data.trip;
        const isUserOrganiser = res.data.isOrganiser ?? (user && (t.organiser?._id || t.organiser)?.toString() === (user.id || user._id)?.toString());
        if (!isUserOrganiser) {
          setError('You do not have authorization to edit this trip.');
          setLoading(false);
          return;
        }

        setTrip(t);
        setFormData({
          title: t.title || '',
          description: t.description || '',
          category: t.category || 'road trip',
          startingCity: t.startingCity || '',
          meetingPoint: t.meetingPoint || '',
          destination: t.destination || '',
          intermediateStops: t.intermediateStops && t.intermediateStops.length > 0 ? t.intermediateStops : [''],
          startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
          endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 10) : '',
          budgetAmount: t.budget?.amount !== undefined ? String(t.budget.amount) : '',
          includedItems: t.budget?.included && t.budget.included.length > 0 ? t.budget.included : [''],
          excludedItems: t.budget?.excluded && t.budget.excluded.length > 0 ? t.budget.excluded : [''],
          maxGroupSize: t.maxGroupSize || 6,
          joinPolicy: t.joinPolicy || 'approval_required',
          itinerary: t.itinerary && t.itinerary.length > 0
            ? t.itinerary.map((item, idx) => ({
                day: item.day || idx + 1,
                title: item.title || `Day ${idx + 1}`,
                description: item.description || item.activities || '',
                activities: item.activities || item.description || '',
              }))
            : [{ day: 1, title: 'Day 1 Plan', description: '', activities: '' }],
        });
      }
    } catch (err) {
      console.error('Failed to load trip for editing:', err);
      setError(err.message || 'Unable to load trip.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStopChange = (index, value) => {
    const updated = [...formData.intermediateStops];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, intermediateStops: updated }));
  };

  const addStop = () => {
    setFormData((prev) => ({
      ...prev,
      intermediateStops: [...prev.intermediateStops, ''],
    }));
  };

  const removeStop = (index) => {
    setFormData((prev) => ({
      ...prev,
      intermediateStops: prev.intermediateStops.filter((_, idx) => idx !== index),
    }));
  };

  const handleIncludedChange = (index, value) => {
    const updated = [...formData.includedItems];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, includedItems: updated }));
  };

  const addIncluded = () => {
    setFormData((prev) => ({
      ...prev,
      includedItems: [...prev.includedItems, ''],
    }));
  };

  const removeIncluded = (index) => {
    setFormData((prev) => ({
      ...prev,
      includedItems: prev.includedItems.filter((_, idx) => idx !== index),
    }));
  };

  const handleExcludedChange = (index, value) => {
    const updated = [...formData.excludedItems];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, excludedItems: updated }));
  };

  const addExcluded = () => {
    setFormData((prev) => ({
      ...prev,
      excludedItems: [...prev.excludedItems, ''],
    }));
  };

  const removeExcluded = (index) => {
    setFormData((prev) => ({
      ...prev,
      excludedItems: prev.excludedItems.filter((_, idx) => idx !== index),
    }));
  };

  const handleItineraryChange = (index, field, value) => {
    const updated = [...formData.itinerary];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, itinerary: updated }));
  };

  const addItineraryDay = () => {
    const nextDay = formData.itinerary.length + 1;
    setFormData((prev) => ({
      ...prev,
      itinerary: [
        ...prev.itinerary,
        { day: nextDay, title: `Day ${nextDay} Activity`, description: '' },
      ],
    }));
  };

  const removeItineraryDay = (index) => {
    const filtered = formData.itinerary.filter((_, idx) => idx !== index);
    const renumbered = filtered.map((item, idx) => ({ ...item, day: idx + 1 }));
    setFormData((prev) => ({ ...prev, itinerary: renumbered }));
  };

  const handleSave = async (andPublish = false) => {
    setError(null);
    if (!formData.title.trim()) {
      setError('Please provide a trip title.');
      return;
    }
    if (!formData.description.trim() || formData.description.length < 20) {
      setError('Trip description must be at least 20 characters.');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('End date cannot precede the start date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        startingCity: formData.startingCity.trim(),
        meetingPoint: formData.meetingPoint.trim() || formData.startingCity.trim(),
        destination: formData.destination.trim(),
        intermediateStops: formData.intermediateStops.map((s) => s.trim()).filter(Boolean),
        startDate: formData.startDate,
        endDate: formData.endDate,
        budget: {
          amount: Number(formData.budgetAmount),
          currency: 'INR',
          included: formData.includedItems.map((i) => i.trim()).filter(Boolean),
          excluded: formData.excludedItems.map((e) => e.trim()).filter(Boolean),
        },
        maxGroupSize: Number(formData.maxGroupSize),
        joinPolicy: formData.joinPolicy,
        itinerary: formData.itinerary.map((d, idx) => ({
          day: idx + 1,
          title: d.title.trim() || `Day ${idx + 1}`,
          description: d.description?.trim() || d.activities?.trim() || '',
          activities: d.activities?.trim() || d.description?.trim() || 'Activities planned for the day',
        })),
      };

      await updateTrip(id, payload);

      if (andPublish) {
        await publishTrip(id);
      }

      navigate(`/trips/${id}`);
    } catch (err) {
      console.error('Failed to update trip:', err);
      setError(err.message || 'Failed to update trip.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', textAlign: 'center' }}>
        <LoadingSpinner size="lg" message="Loading trip details..." />
      </div>
    );
  }

  if (error && !formData) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <Notice type="error" title="Access Denied or Not Found">
          {error}
        </Notice>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Link to="/my-trips" className="btn btn--secondary">
            ← Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-create-page">
      <section className="trip-create-hero">
        <div className="container">
          <Link to={`/trips/${id}`} className="back-link">
            ← Cancel and View Trip
          </Link>
          <h1 className="heading-xl">Edit Trip Details</h1>
          <p className="text-muted" style={{ maxWidth: '640px', marginTop: 'var(--space-2)' }}>
            Update your itinerary, route details, and group settings for &quot;{trip?.title}&quot;.
          </p>
        </div>
      </section>

      <div className="container trip-form-container">
        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Notice type="error" title="Error">
              {error}
            </Notice>
          </div>
        )}

        <form
          className="trip-form-card"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {/* Section 1: Overview */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">1. Trip Overview</legend>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="edit-title" className="form-label">
                Trip Title *
              </label>
              <input
                id="edit-title"
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
              />
            </div>

            <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="edit-category" className="form-label">
                  Category *
                </label>
                <select
                  id="edit-category"
                  className="form-input"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-joinPolicy" className="form-label">
                  Join Policy *
                </label>
                <select
                  id="edit-joinPolicy"
                  className="form-input"
                  value={formData.joinPolicy}
                  onChange={(e) => handleInputChange('joinPolicy', e.target.value)}
                >
                  <option value="approval_required">Host Approval Required</option>
                  <option value="direct_join">Instant Join (Direct)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="edit-description" className="form-label">
                Trip Description *
              </label>
              <textarea
                id="edit-description"
                className="form-input"
                rows="5"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                required
              />
            </div>
          </fieldset>

          {/* Section 2: Route */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">2. Route &amp; Travel Dates</legend>

            <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="edit-startingCity" className="form-label">
                  Starting City *
                </label>
                <input
                  id="edit-startingCity"
                  type="text"
                  className="form-input"
                  value={formData.startingCity}
                  onChange={(e) => handleInputChange('startingCity', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-meetingPoint" className="form-label">
                  Meeting Point *
                </label>
                <input
                  id="edit-meetingPoint"
                  type="text"
                  className="form-input"
                  value={formData.meetingPoint}
                  onChange={(e) => handleInputChange('meetingPoint', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="edit-destination" className="form-label">
                Final Destination *
              </label>
              <input
                id="edit-destination"
                type="text"
                className="form-input"
                value={formData.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Key Stops Along the Way</label>
              {formData.intermediateStops.map((stop, idx) => (
                <div key={idx} className="dynamic-list-row">
                  <input
                    type="text"
                    className="form-input"
                    value={stop}
                    onChange={(e) => handleStopChange(idx, e.target.value)}
                  />
                  {formData.intermediateStops.length > 1 && (
                    <button
                      type="button"
                      className="dynamic-list-btn"
                      onClick={() => removeStop(idx)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="add-item-btn" onClick={addStop}>
                + Add Stop
              </button>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="edit-startDate" className="form-label">
                  Departure Date *
                </label>
                <input
                  id="edit-startDate"
                  type="date"
                  className="form-input"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-endDate" className="form-label">
                  Return Date *
                </label>
                <input
                  id="edit-endDate"
                  type="date"
                  className="form-input"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Section 3: Cost Splits & Group Size */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">3. Budget &amp; Group Capacity</legend>

            <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="edit-budgetAmount" className="form-label">
                  Budget Per Person (INR) *
                </label>
                <input
                  id="edit-budgetAmount"
                  type="number"
                  min="0"
                  className="form-input"
                  value={formData.budgetAmount}
                  onChange={(e) => handleInputChange('budgetAmount', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-maxGroupSize" className="form-label">
                  Total Group Size *
                </label>
                <input
                  id="edit-maxGroupSize"
                  type="number"
                  min={Math.max(2, (trip?.approvedMembersCount || 0) + 1)}
                  max="50"
                  className="form-input"
                  value={formData.maxGroupSize}
                  onChange={(e) => handleInputChange('maxGroupSize', e.target.value)}
                  required
                />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Current approved members: {trip?.approvedMembersCount || 0}
                </span>
              </div>
            </div>

            {/* Inclusions */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">What&apos;s Included?</label>
              {formData.includedItems.map((item, idx) => (
                <div key={idx} className="dynamic-list-row">
                  <input
                    type="text"
                    className="form-input"
                    value={item}
                    onChange={(e) => handleIncludedChange(idx, e.target.value)}
                  />
                  <button
                    type="button"
                    className="dynamic-list-btn"
                    onClick={() => removeIncluded(idx)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="add-item-btn" onClick={addIncluded}>
                + Add Inclusion
              </button>
            </div>

            {/* Exclusions */}
            <div className="form-group">
              <label className="form-label">What&apos;s Excluded?</label>
              {formData.excludedItems.map((item, idx) => (
                <div key={idx} className="dynamic-list-row">
                  <input
                    type="text"
                    className="form-input"
                    value={item}
                    onChange={(e) => handleExcludedChange(idx, e.target.value)}
                  />
                  <button
                    type="button"
                    className="dynamic-list-btn"
                    onClick={() => removeExcluded(idx)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="add-item-btn" onClick={addExcluded}>
                + Add Exclusion
              </button>
            </div>
          </fieldset>

          {/* Section 4: Itinerary */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">4. Planned Itinerary</legend>

            {formData.itinerary.map((dayItem, idx) => (
              <div key={idx} className="itinerary-day-editor">
                <div className="itinerary-day-editor__header">
                  <strong>Day {dayItem.day}</strong>
                  {formData.itinerary.length > 1 && (
                    <button
                      type="button"
                      className="dynamic-list-btn"
                      onClick={() => removeItineraryDay(idx)}
                    >
                      Remove Day
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={dayItem.title}
                    onChange={(e) => handleItineraryChange(idx, 'title', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <textarea
                    className="form-input"
                    rows="2"
                    value={dayItem.description}
                    onChange={(e) => handleItineraryChange(idx, 'description', e.target.value)}
                  />
                </div>
              </div>
            ))}

            <button type="button" className="add-item-btn" onClick={addItineraryDay}>
              + Add Day to Itinerary
            </button>
          </fieldset>

          {/* Actions */}
          <div className="form-actions-bar">
            <Link to={`/trips/${id}`} className="btn btn--secondary">
              Cancel
            </Link>

            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => handleSave(false)}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>

            {trip?.status === 'draft' && isVerified && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => handleSave(true)}
                disabled={submitting}
              >
                {submitting ? 'Publishing...' : 'Save & Publish Trip'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
export default TripEditPage;
