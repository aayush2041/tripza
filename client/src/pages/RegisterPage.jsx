import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Card } from '../components/Card.jsx';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './AuthPages.css';

export function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/profile', { replace: true });
    return null;
  }

  const validate = () => {
    const errors = {};
    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.password = 'Password must contain at least one letter and at least one number or special character';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      await register(fullName, email, password);
      navigate('/profile', { replace: true });
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card-wrapper">
        <Card
          title="Join TripZa"
          subtitle="Create your traveller profile and explore India with verified companions"
        >
          {serverError && (
            <Notice type="error" title="Registration Error">
              {serverError}
            </Notice>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                className={`form-input ${fieldErrors.fullName ? 'form-input--error' : ''}`}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                placeholder="e.g. Aarav Sharma"
                autoComplete="name"
                disabled={submitting}
                required
              />
              {fieldErrors.fullName && <p className="form-error">{fieldErrors.fullName}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className={`form-input ${fieldErrors.email ? 'form-input--error' : ''}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="traveller@example.com"
                autoComplete="email"
                disabled={submitting}
                required
              />
              {fieldErrors.email && <p className="form-error">{fieldErrors.email}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                className={`form-input ${fieldErrors.password ? 'form-input--error' : ''}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Minimum 8 characters with letters & numbers"
                autoComplete="new-password"
                disabled={submitting}
                required
              />
              {fieldErrors.password && <p className="form-error">{fieldErrors.password}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`form-input ${fieldErrors.confirmPassword ? 'form-input--error' : ''}`}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={submitting}
                required
              />
              {fieldErrors.confirmPassword && <p className="form-error">{fieldErrors.confirmPassword}</p>}
            </div>

            <button type="submit" className="btn btn--primary auth-submit-btn" disabled={submitting}>
              {submitting ? <LoadingSpinner label="Creating Account..." size="sm" /> : 'Create Traveller Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p className="text-sm text-muted">
              Already registered?{' '}
              <Link to="/login" className="auth-link">
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
