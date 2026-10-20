import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from './Badge.jsx';
import './Header.css';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

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
            to="/find-trips"
            className={`header__nav-link ${location.pathname === '/find-trips' ? 'header__nav-link--active' : ''}`}
          >
            Find Trips
            <Badge variant="neutral" size="sm">Coming Soon</Badge>
          </Link>

          <Link
            to="/list-trip"
            className={`header__nav-link ${location.pathname === '/list-trip' ? 'header__nav-link--active' : ''}`}
          >
            List a Trip
            <Badge variant="neutral" size="sm">Coming Soon</Badge>
          </Link>

          <Link
            to="/my-trips"
            className={`header__nav-link ${location.pathname === '/my-trips' ? 'header__nav-link--active' : ''}`}
          >
            My Trips
            <Badge variant="neutral" size="sm">Coming Soon</Badge>
          </Link>

          <Link
            to="/profile"
            className={`header__nav-link ${location.pathname === '/profile' ? 'header__nav-link--active' : ''}`}
          >
            Profile
            <Badge variant="neutral" size="sm">Coming Soon</Badge>
          </Link>

          <Link
            to="/system-status"
            className={`header__nav-link header__nav-link--status ${
              location.pathname === '/system-status' ? 'header__nav-link--active' : ''
            }`}
          >
            System Status
          </Link>
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
            <Link to="/find-trips" className="header__mobile-link" onClick={closeMobileMenu}>
              Find Trips <Badge variant="neutral">Coming Soon</Badge>
            </Link>
            <Link to="/list-trip" className="header__mobile-link" onClick={closeMobileMenu}>
              List a Trip <Badge variant="neutral">Coming Soon</Badge>
            </Link>
            <Link to="/my-trips" className="header__mobile-link" onClick={closeMobileMenu}>
              My Trips <Badge variant="neutral">Coming Soon</Badge>
            </Link>
            <Link to="/profile" className="header__mobile-link" onClick={closeMobileMenu}>
              Profile <Badge variant="neutral">Coming Soon</Badge>
            </Link>
            <Link to="/system-status" className="header__mobile-link" onClick={closeMobileMenu}>
              System Status
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
