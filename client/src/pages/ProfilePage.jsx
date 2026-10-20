import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import { getBlockedUsers, unblockUser } from '../services/api.js';
import './ProfilePage.css';

export function ProfilePage() {
  const { user, profile, isAuthenticated, loading: authLoading, editProfile, requestVerification } = useAuth();

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [travelInterests, setTravelInterests] = useState('');
  const [languages, setLanguages] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');

  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const loadBlockedUsers = async () => {
    setBlockedLoading(true);
    try {
      const res = await getBlockedUsers();
      setBlockedUsers(res.data?.blockedUsers || []);
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    } finally {
      setBlockedLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId) => {
    try {
      await unblockUser(blockedUserId);
      setBlockedUsers((prev) => prev.filter((b) => b.blockedUser?._id !== blockedUserId));
    } catch (err) {
      alert(err.message || 'Failed to unblock user.');
    }
  };

  // Sync state when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setBio(profile.bio || '');
      setHomeCity(profile.homeCity || '');
      setTravelInterests((profile.travelInterests || []).join(', '));
      setLanguages((profile.languages || []).join(', '));
      setProfilePhotoUrl(profile.profilePhotoUrl || '');
      loadBlockedUsers();
    }
  }, [profile]);

  if (authLoading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
        <LoadingSpinner label="Loading your traveller profile..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-12)' }}>
        <Card title="Sign In Required" subtitle="You must be signed in to view or manage your profile">
          <Notice type="warning">
            Please sign in to access your traveller details, community trust badges, and verification status.
          </Notice>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
            <Link to="/login" className="btn btn--primary">Sign In</Link>
            <Link to="/register" className="btn btn--secondary">Register</Link>
          </div>
        </Card>
      </div>
    );
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setSaveError('Full name must be at least 2 characters long');
      return;
    }

    setSaving(true);
    try {
      const parsedInterests = travelInterests
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedLanguages = languages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await editProfile({
        fullName: fullName.trim(),
        bio: bio.trim(),
        homeCity: homeCity.trim(),
        travelInterests: parsedInterests,
        languages: parsedLanguages,
        profilePhotoUrl: profilePhotoUrl.trim(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitVerification = async () => {
    setVerificationNotice('');
    setSaveError('');
    setSubmittingVerification(true);

    try {
      const result = await requestVerification();
      setVerificationNotice(result.message || 'Profile successfully submitted for verification review.');
    } catch (err) {
      setSaveError(err.message || 'Failed to submit verification request.');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const verificationStatus = profile?.verificationStatus || 'unverified';

  const getVerificationBadgeVariant = (status) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'pending_review':
        return 'primary';
      case 'rejected':
        return 'danger';
      default:
        return 'warning';
    }
  };

  const getVerificationLabel = (status) => {
    switch (status) {
      case 'verified':
        return 'Verified Traveller';
      case 'pending_review':
        return 'Verification Pending Review';
      case 'rejected':
        return 'Verification Rejected';
      default:
        return 'Unverified Profile';
    }
  };

  return (
    <div className="container profile-page">
      {/* Profile Header */}
      <div className="profile-hero">
        <div className="profile-hero__avatar">
          {profile?.profilePhotoUrl ? (
            <img src={profile.profilePhotoUrl} alt={profile.fullName} className="profile-hero__img" />
          ) : (
            <span className="profile-hero__initials">
              {(profile?.fullName || 'T').slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="profile-hero__meta">
          <div className="profile-hero__name-row">
            <h1 className="heading-lg">{profile?.fullName || 'Traveller'}</h1>
            <Badge variant={getVerificationBadgeVariant(verificationStatus)} size="md">
              {getVerificationLabel(verificationStatus)}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            {user?.email} &bull; Account Role: <strong>{user?.role}</strong> &bull; Status: {user?.accountStatus}
          </p>
        </div>
      </div>

      {saveSuccess && (
        <Notice type="success" title="Profile Updated">
          Your traveller profile details have been saved successfully.
        </Notice>
      )}

      {saveError && (
        <Notice type="error" title="Action Error">
          {saveError}
        </Notice>
      )}

      {verificationNotice && (
        <Notice type="info" title="Verification Update">
          {verificationNotice}
        </Notice>
      )}

      <div className="profile-grid">
        {/* Verification Card */}
        <Card
          title="Community Verification"
          subtitle="TripZa trust badge and safety verification"
          className="profile-grid__sidebar"
          action={
            <Badge variant={getVerificationBadgeVariant(verificationStatus)} size="sm">
              {verificationStatus.toUpperCase()}
            </Badge>
          }
        >
          {verificationStatus === 'verified' && (
            <div>
              <p className="text-sm text-secondary">
                ✓ <strong>Verified Traveller Status Active</strong>. Your identity has been verified through our
                community review process. You are eligible to host trips and join private Trip Rooms.
              </p>
            </div>
          )}

          {verificationStatus === 'pending_review' && (
            <div>
              <p className="text-sm text-secondary">
                ⏳ <strong>Review in Progress</strong>. Your profile has been submitted for manual verification. Our team
                reviews traveller details to ensure community safety. You will be notified once reviewed.
              </p>
            </div>
          )}

          {verificationStatus === 'rejected' && (
            <div>
              <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-3)' }}>
                ⚠️ <strong>Verification Rejected</strong>. Your previous submission could not be verified. Please ensure
                your full name and details are authentic, then re-submit.
              </p>
              <button
                type="button"
                onClick={handleSubmitVerification}
                disabled={submittingVerification}
                className="btn btn--secondary btn--sm"
              >
                {submittingVerification ? <LoadingSpinner size="sm" /> : 'Re-submit for Review'}
              </button>
            </div>
          )}

          {verificationStatus === 'unverified' && (
            <div>
              <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-3)' }}>
                Email verification alone does not prove identity. Complete your traveller profile and submit for review
                to earn the <strong>Verified Traveller</strong> badge and publish trips.
              </p>
              <button
                type="button"
                onClick={handleSubmitVerification}
                disabled={submittingVerification}
                className="btn btn--primary btn--sm"
              >
                {submittingVerification ? <LoadingSpinner label="Submitting..." size="sm" /> : 'Submit for Verification'}
              </button>
            </div>
          )}

          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            <span className="text-sm text-muted">Profile Completeness:</span>
            <div className="progress-bar">
              <div
                className="progress-bar__fill"
                style={{ width: `${profile?.completenessPercentage || 20}%` }}
              />
            </div>
            <span className="text-xs text-muted">{profile?.completenessPercentage || 20}% completed</span>
          </div>
        </Card>

        {/* Edit Profile Form */}
        <Card
          title="Traveller Profile Details"
          subtitle="Information visible to fellow community members"
          className="profile-grid__main"
        >
          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">
                Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="fullName"
                type="text"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio" className="form-label">
                About Me / Bio
              </label>
              <textarea
                id="bio"
                className="form-textarea"
                rows="3"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your travel style, past trips across India (e.g. Spiti, Western Ghats, Gokarna)..."
                maxLength={500}
                disabled={saving}
              />
              <span className="text-xs text-muted" style={{ textAlign: 'right' }}>
                {bio.length}/500 characters
              </span>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="homeCity" className="form-label">
                  Home City
                </label>
                <input
                  id="homeCity"
                  type="text"
                  className="form-input"
                  value={homeCity}
                  onChange={(e) => setHomeCity(e.target.value)}
                  placeholder="e.g. Bengaluru, Mumbai, Pune"
                  disabled={saving}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="profilePhotoUrl" className="form-label">
                  Profile Photo URL
                </label>
                <input
                  id="profilePhotoUrl"
                  type="url"
                  className="form-input"
                  value={profilePhotoUrl}
                  onChange={(e) => setProfilePhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="travelInterests" className="form-label">
                Travel Interests (comma-separated)
              </label>
              <input
                id="travelInterests"
                type="text"
                className="form-input"
                value={travelInterests}
                onChange={(e) => setTravelInterests(e.target.value)}
                placeholder="e.g. High-altitude trekking, Coastal road trips, Heritage trails, Camping"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="languages" className="form-label">
                Languages Spoken (comma-separated)
              </label>
              <input
                id="languages"
                type="text"
                className="form-input"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="e.g. Hindi, English, Marathi, Kannada"
                disabled={saving}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? <LoadingSpinner label="Saving..." size="sm" /> : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </Card>

        {/* Safety & Blocked Users Management */}
        <Card
          title="🛡️ Blocked Users & Safety"
          subtitle="Manage community members you have blocked"
          className="profile-grid__main"
        >
          {blockedLoading ? (
            <LoadingSpinner size="sm" label="Loading blocked users..." />
          ) : blockedUsers.length === 0 ? (
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              You have not blocked any travellers. When you block someone from a trip or profile, they will be listed here and will not be able to join your trips.
            </p>
          ) : (
            <div className="blocked-users-list">
              {blockedUsers.map((b) => (
                <div key={b.blockId} className="blocked-user-row">
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                      {b.blockedUser?.fullName || b.blockedUser?.email}
                    </strong>
                    {b.reason && (
                      <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                        Reason: {b.reason}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => handleUnblock(b.blockedUser?._id)}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
