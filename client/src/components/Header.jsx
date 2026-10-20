import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getUnreadNotificationCount } from '../services/api.js';
import { Badge } from './Badge.jsx';
import './Header.css';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { user, profile, isAuthenticated, logout } = useAuth();

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    let isMounted = true;
    const fetchCount = async () => {
      try {
        const res = await getUnreadNotificationCount();
        if (isMounted) {
          setUnreadCount(res.data?.unreadCount || 0);
        }
      } catch {
        // Soft fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000); // 30s poll for unread badge
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, location.pathname]);

  const verificationStatus = profile?.verificationStatus || 'unverified';
  const getBadgeVariant = (status) => {
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

  return (
    <header className="header">
      <div className="container header__container">
        {/* Brand / Logo */}
        <Link to="/" className="header__brand" onClick={closeMobileMenu}>
          <div className="header__logo-icon">
            <span>TZ</span>
          </div>
          <div className="header__brand-text">
            <span className="header__brand-name">TripZa</span>
            <span className="header__brand-tagline">India Travel Community</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="header__nav" aria-label="Main Navigation">
          <Link
            to="/"
            className={`header__nav-link ${location.pathname === '/' ? 'header__nav-link--active' : ''}`}
          >
            Overview
          </Link>

          <Link
            to="/trips"
            className={`header__nav-link ${location.pathname.startsWith('/trips') && !location.pathname.includes('/create') ? 'header__nav-link--active' : ''}`}
          >
            Find Trips
          </Link>

          <Link
            to="/trips/create"
            className={`header__nav-link ${location.pathname === '/trips/create' ? 'header__nav-link--active' : ''}`}
          >
            List a Trip
          </Link>

          {isAuthenticated && (
            <Link
              to="/my-trips"
              className={`header__nav-link ${location.pathname === '/my-trips' ? 'header__nav-link--active' : ''}`}
            >
              My Trips
            </Link>
          )}

          <Link
            to="/safety"
            className={`header__nav-link ${location.pathname === '/safety' ? 'header__nav-link--active' : ''}`}
          >
            Safety
          </Link>

          {isAuthenticated && user?.role === 'admin' && (
            <Link
              to="/admin/moderation"
              className={`header__nav-link header__admin-link ${location.pathname.startsWith('/admin') ? 'header__nav-link--active' : ''}`}
            >
              🛡️ Moderation
            </Link>
          )}

          <Link
            to="/system-status"
            className={`header__nav-link header__nav-link--status ${
              location.pathname === '/system-status' ? 'header__nav-link--active' : ''
            }`}
          >
            System Status
          </Link>

          {/* Authentication Actions */}
          <div className="header__auth-section">
            {isAuthenticated ? (
              <div className="header__user-menu">
                {/* Notification Bell */}
                <Link
                  to="/notifications"
                  className="header__notif-btn"
                  title="Notifications"
                  aria-label="View notifications"
                >
                  🔔
                  {unreadCount > 0 && <span className="header__notif-badge">{unreadCount}</span>}
                </Link>

                <Link
                  to="/profile"
                  className={`header__nav-link header__user-profile-link ${
                    location.pathname === '/profile' ? 'header__nav-link--active' : ''
                  }`}
                >
                  <span className="header__user-name">{profile?.fullName || user?.email}</span>
                  <Badge variant={getBadgeVariant(verificationStatus)} size="sm">
                    {verificationStatus === 'verified' ? 'Verified' : verificationStatus.replace('_', ' ')}
                  </Badge>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="header__logout-btn"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="header__auth-buttons">
                <Link
                  to="/login"
                  className={`header__nav-link ${location.pathname === '/login' ? 'header__nav-link--active' : ''}`}
                >
                  Sign In
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Register
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Mobile Menu Hamburger */}
        <button
          className="header__mobile-toggle"
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          aria-expanded={mobileMenuOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="header__mobile-drawer">
          <nav className="header__mobile-nav">
            <Link to="/" className="header__mobile-link" onClick={closeMobileMenu}>
              Overview
            </Link>
            <Link to="/trips" className="header__mobile-link" onClick={closeMobileMenu}>
              Find Trips
            </Link>
            <Link to="/trips/create" className="header__mobile-link" onClick={closeMobileMenu}>
              List a Trip
            </Link>
            {isAuthenticated && (
              <Link to="/my-trips" className="header__mobile-link" onClick={closeMobileMenu}>
                My Trips
              </Link>
            )}
            <Link to="/safety" className="header__mobile-link" onClick={closeMobileMenu}>
              Safety & Guidelines
            </Link>
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/admin/moderation" className="header__mobile-link" onClick={closeMobileMenu}>
                🛡️ Admin Moderation Queue
              </Link>
            )}
            <Link to="/system-status" className="header__mobile-link" onClick={closeMobileMenu}>
              System Status
            </Link>

            <div className="header__mobile-auth">
              {isAuthenticated ? (
                <>
                  <Link to="/notifications" className="header__mobile-link" onClick={closeMobileMenu}>
                    🔔 Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                  </Link>
                  <Link to="/profile" className="header__mobile-link" onClick={closeMobileMenu}>
                    Profile ({profile?.fullName || user?.email})
                    <Badge variant={getBadgeVariant(verificationStatus)} size="sm">
                      {verificationStatus}
                    </Badge>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      closeMobileMenu();
                    }}
                    className="header__mobile-link"
                    style={{ color: 'var(--color-danger)', textAlign: 'left', width: '100%' }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <Link to="/login" className="btn btn--secondary" onClick={closeMobileMenu}>
                    Sign In
                  </Link>
                  <Link to="/register" className="btn btn--primary" onClick={closeMobileMenu}>
                    Register
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
