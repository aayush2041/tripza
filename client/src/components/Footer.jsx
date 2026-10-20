import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__container">
        <div className="footer__grid">
          {/* Brand Col */}
          <div className="footer__brand-col">
            <div className="footer__brand">
              <span className="footer__logo-badge">TZ</span>
              <span className="footer__title">TripZa</span>
            </div>
            <p className="footer__description">
              An India-first travel community platform designed for verified travellers to discover companions,
              coordinate road trips, treks, and explore India safely together.
            </p>
            <div className="footer__tag">🇮🇳 Built for Indian Travellers</div>
          </div>

          {/* Navigation Col */}
          <div className="footer__col">
            <h4 className="footer__col-title">Platform</h4>
            <ul className="footer__links">
              <li><Link to="/find-trips">Find Trips (Upcoming)</Link></li>
              <li><Link to="/list-trip">Host a Trip (Upcoming)</Link></li>
              <li><Link to="/my-trips">My Bookings & Trips</Link></li>
              <li><Link to="/system-status">System Health Status</Link></li>
            </ul>
          </div>

          {/* Architecture & Trust Col */}
          <div className="footer__col">
            <h4 className="footer__col-title">Trust & Architecture</h4>
            <ul className="footer__links">
              <li><span>Verified Traveller Profiles</span></li>
              <li><span>Encrypted Private Trip Rooms</span></li>
              <li><span>Zero Fake Listings Guarantee</span></li>
              <li><span>Community Safety Moderation</span></li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {currentYear} TripZa. All rights reserved. Foundation release v0.1.0.
          </p>
          <div className="footer__meta">
            <span>Secure Architecture</span>
            <span className="footer__dot">&bull;</span>
            <span>REST API & Socket.IO</span>
            <span className="footer__dot">&bull;</span>
            <Link to="/system-status" className="footer__status-link">
              API Status: Live
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
