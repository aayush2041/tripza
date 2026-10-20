import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Card } from '../components/Card.jsx';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './AuthPages.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/profile';

  if (isAuthenticated) {
    navigate('/profile', { replace: true });
    return null;
  }

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
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
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card-wrapper">
        <Card
          title="Sign In to TripZa"
          subtitle="Access your verified traveller profile and community trips"
        >
          {serverError && (
            <Notice type="error" title="Sign In Error">
              {serverError}
            </Notice>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
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
              <div className="form-label-row">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                className={`form-input ${fieldErrors.password ? 'form-input--error' : ''}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={submitting}
                required
              />
              {fieldErrors.password && <p className="form-error">{fieldErrors.password}</p>}
            </div>

            <button type="submit" className="btn btn--primary auth-submit-btn" disabled={submitting}>
              {submitting ? <LoadingSpinner label="Signing In..." size="sm" /> : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p className="text-sm text-muted">
              Don't have a traveller account?{' '}
              <Link to="/register" className="auth-link">
                Register as a Traveller
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
