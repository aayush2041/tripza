import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createTrip } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Notice } from '../components/Notice.jsx';
import { Badge } from '../components/Badge.jsx';
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

export function TripCreatePage() {
  const navigate = useNavigate();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const isVerified = profile?.verificationStatus === 'verified';

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'road trip',
    startingCity: '',
    meetingPoint: '',
    destination: '',
    intermediateStops: [''],
    startDate: '',
    endDate: '',
    budgetAmount: '',
    includedItems: ['Shared fuel / transport', 'Homestay / camping stay'],
    excludedItems: ['Personal snacks & shopping', 'Individual gear'],
    maxGroupSize: 6,
    joinPolicy: 'approval_required',
    itinerary: [
      { day: 1, title: 'Departure & Arrival', description: 'Meet companions and head to base camp.' },
      { day: 2, title: 'Exploration & Trek', description: 'Scenic trail hike and local exploration.' },
    ],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Field updates
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Intermediate stops helpers
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

  // Included items helpers
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

  // Excluded items helpers
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

  // Itinerary helpers
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

  // Form submission
  const handleSubmit = async (targetStatus) => {
    setError(null);

    // Basic frontend validations
    if (!formData.title.trim()) {
      setError('Please provide a trip title.');
      return;
    }
    if (!formData.description.trim() || formData.description.length < 20) {
      setError('Please provide a descriptive trip overview of at least 20 characters.');
      return;
    }
    if (!formData.startingCity.trim() || !formData.destination.trim()) {
      setError('Starting city and destination are required.');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Trip start date and end date are required.');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('Trip end date cannot be earlier than the start date.');
      return;
    }
    if (!formData.budgetAmount || Number(formData.budgetAmount) < 0) {
      setError('Please specify a valid budget amount per person.');
      return;
    }

    setLoading(true);

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
          description: d.description.trim(),
        })),
        status: targetStatus,
      };

      const res = await createTrip(payload);
      if (res.success && res.data?.trip) {
        navigate(`/trips/${res.data.trip._id}`);
      } else {
        navigate('/my-trips');
      }
    } catch (err) {
      console.error('Failed to create trip:', err);
      setError(err.message || 'Failed to save trip. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0', maxWidth: '600px' }}>
        <Notice type="warning" title="Authentication Required">
          You must be logged in to create or list a trip.
        </Notice>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/login?redirect=/trips/create" className="btn btn--primary">
            Sign In
          </Link>
          <Link to="/register" className="btn btn--secondary">
            Register Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-create-page">
      <section className="trip-create-hero">
        <div className="container">
          <h1 className="heading-xl">List a New Group Journey</h1>
          <p className="text-muted" style={{ maxWidth: '640px', marginTop: 'var(--space-2)' }}>
            Publish an upcoming road trip, trek, or weekend exploration. Share your route, cost splits, and find verified travel companions.
          </p>
        </div>
      </section>

      <div className="container trip-form-container">
        {!isVerified && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Notice type="warning" title="Identity Verification Required for Publishing">
              Your profile is not verified yet. To safeguard community trust, only verified travellers can publish trips for public discovery.
              You can still prepare and save this journey as a <strong>Draft</strong>, and submit your ID verification under your Profile to publish it.
            </Notice>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Notice type="error" title="Submission Error">
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
          {/* Section 1: Basic Info */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">1. Trip Overview</legend>
            <p className="form-fieldset-desc">Give your journey a clear, inviting title and comprehensive description.</p>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="title" className="form-label">
                Trip Title *
              </label>
              <input
                id="title"
                type="text"
                className="form-input"
                placeholder="e.g. Spiti Valley 9-Day Road Trip from Chandigarh"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
              />
            </div>

            <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="category" className="form-label">
                  Category *
                </label>
                <select
                  id="category"
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
                <label htmlFor="joinPolicy" className="form-label">
                  Join Policy *
                </label>
                <select
                  id="joinPolicy"
                  className="form-input"
                  value={formData.joinPolicy}
                  onChange={(e) => handleInputChange('joinPolicy', e.target.value)}
                >
                  <option value="approval_required">Host Approval Required (Recommended)</option>
                  <option value="direct_join">Instant Join (Direct)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Trip Description &amp; Plan *
              </label>
              <textarea
                id="description"
                className="form-input"
                rows="5"
                placeholder="Describe your travel style, route highlights, vehicle details, fitness expectations, and what kind of travel buddies you are looking for..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                required
              />
            </div>
          </fieldset>

          {/* Section 2: Route & Schedule */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">2. Route &amp; Travel Dates</legend>
            <p className="form-fieldset-desc">Specify departure point, destination, and planned dates.</p>

            <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="startingCity" className="form-label">
                  Starting City *
                </label>
                <input
                  id="startingCity"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Chandigarh"
                  value={formData.startingCity}
                  onChange={(e) => handleInputChange('startingCity', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="meetingPoint" className="form-label">
                  Exact Meeting Point *
                </label>
                <input
                  id="meetingPoint"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sector 17 ISBT / Railway Station"
                  value={formData.meetingPoint}
                  onChange={(e) => handleInputChange('meetingPoint', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="destination" className="form-label">
                Final Destination *
              </label>
              <input
                id="destination"
                type="text"
                className="form-input"
                placeholder="e.g. Kaza, Spiti Valley"
                value={formData.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                required
              />
            </div>

            {/* Intermediate Stops */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Key Stops Along the Way (Optional)</label>
              {formData.intermediateStops.map((stop, idx) => (
                <div key={idx} className="dynamic-list-row">
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Stop #${idx + 1} (e.g. Shimla, Narkanda, Kalpa)`}
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
                <label htmlFor="startDate" className="form-label">
                  Departure Date *
                </label>
                <input
                  id="startDate"
                  type="date"
                  className="form-input"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate" className="form-label">
                  Return Date *
                </label>
                <input
                  id="endDate"
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
            <p className="form-fieldset-desc">Maintain transparency in cost sharing and vehicle/group capacity.</p>

            <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="budgetAmount" className="form-label">
                  Expected Budget Per Person (INR) *
                </label>
                <input
                  id="budgetAmount"
                  type="number"
                  min="0"
                  step="100"
                  className="form-input"
                  placeholder="e.g. 14500"
                  value={formData.budgetAmount}
                  onChange={(e) => handleInputChange('budgetAmount', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxGroupSize" className="form-label">
                  Total Group Size (Including Host) *
                </label>
                <input
                  id="maxGroupSize"
                  type="number"
                  min="2"
                  max="50"
                  className="form-input"
                  value={formData.maxGroupSize}
                  onChange={(e) => handleInputChange('maxGroupSize', e.target.value)}
                  required
                />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Allows up to {Math.max(1, Number(formData.maxGroupSize) - 1)} joiners.
                </span>
              </div>
            </div>

            {/* Inclusions */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">What&apos;s Included in this Budget?</label>
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

          {/* Section 4: Day by Day Itinerary */}
          <fieldset className="form-fieldset">
            <legend className="form-fieldset-legend">4. Planned Itinerary</legend>
            <p className="form-fieldset-desc">Outline your day-to-day schedule and stops.</p>

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
                    placeholder="Day title (e.g. Chandigarh to Narkanda via Shimla)"
                    value={dayItem.title}
                    onChange={(e) => handleItineraryChange(idx, 'title', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Activities, scenic stops, estimated driving hours, stay details..."
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

          {/* Form Actions */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => handleSubmit('draft')}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>

            {isVerified ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => handleSubmit('published')}
                disabled={loading}
              >
                {loading ? 'Publishing...' : 'Publish Trip'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled
                title="Verification required to publish"
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              >
                Publish (Verified Hosts Only)
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
export default TripCreatePage;
