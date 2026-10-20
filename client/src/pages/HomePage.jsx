import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import './HomePage.css';

export function HomePage() {
  return (
    <div className="home-page">
      {/* Notice Banner */}
      <div className="container" style={{ marginTop: 'var(--space-6)' }}>
        <Notice
          type="info"
          title="TripZa Foundation (Prompt 1) Active"
        >
          Welcome to the foundational release of TripZa. Backend security baseline, health diagnostics,
          and client shell are live. Registration, identity verification, and trip creation will be introduced in upcoming phases.
        </Notice>
      </div>

      {/* Hero / Introduction */}
      <section className="hero">
        <div className="container hero__container">
          <div className="hero__content">
            <div className="hero__badge-wrapper">
              <Badge variant="primary" size="md">🇮🇳 India-First Travel Community</Badge>
              <Badge variant="neutral" size="md">Foundation v0.1.0</Badge>
            </div>
            <h1 className="hero__title">
              Explore India with Verified Travel Companions.
            </h1>
            <p className="hero__lead">
              TripZa is built for trusted group journeys across India — from high-altitude Spiti expeditions
              and Himalayan treks to Western Ghats road trips and Konkan coastal drives. Travel with genuine, verified people.
            </p>
            <div className="hero__actions">
              <Link to="/find-trips" className="btn btn--primary">
                Find Trips <Badge variant="neutral" size="sm">Soon</Badge>
              </Link>
              <Link to="/system-status" className="btn btn--secondary">
                View System Health
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="section">
        <div className="container">
          <div className="section__header">
            <h2 className="heading-lg">Built on Genuine Trust & Security</h2>
            <p className="text-lead">
              Unlike generic forums or social media groups, TripZa is engineered from the ground up for safety, verification, and transparency.
            </p>
          </div>

          <div className="grid-3">
            <Card
              title="Verified Identity Workflows"
              subtitle="Safety First"
            >
              <p className="card-text">
                Email verification alone does not prove who someone is. TripZa requires a documented identity
                verification process before users can host trips or join private travel rooms.
              </p>
            </Card>

            <Card
              title="Private Trip Rooms"
              subtitle="Coordinated Travel"
            >
              <p className="card-text">
                Approved travel companions get access to an exclusive, real-time Trip Room for group chat,
                itinerary discussions, gear checklists, and pickup logistics.
              </p>
            </Card>

            <Card
              title="Zero Fake Content"
              subtitle="Honest Platform"
            >
              <p className="card-text">
                No artificial user counts, no fabricated listings, and no fake reviews. Every trip, profile, and
                rating represents an authentic traveller journey across India.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How TripZa Works */}
      <section className="section section--alt">
        <div className="container">
          <div className="section__header">
            <h2 className="heading-lg">How TripZa Operates</h2>
            <p className="text-lead">A transparent 5-step journey designed for Indian travel realities.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-card__number">1</div>
              <h3 className="step-card__title">Create &amp; Verify Profile</h3>
              <p className="step-card__desc">
                Register and complete government ID verification or trusted review to establish trust within the community.
              </p>
            </div>

            <div className="step-card">
              <div className="step-card__number">2</div>
              <h3 className="step-card__title">Discover or List Trips</h3>
              <p className="step-card__desc">
                Verified hosts publish detailed itineraries, route maps, cost splits, vehicle details, and group preferences.
              </p>
            </div>

            <div className="step-card">
              <div className="step-card__number">3</div>
              <h3 className="step-card__title">Request &amp; Review</h3>
              <p className="step-card__desc">
                Travellers apply to join. Hosts review profiles, travel experience, and preferences before approving members.
              </p>
            </div>

            <div className="step-card">
              <div className="step-card__number">4</div>
              <h3 className="step-card__title">Coordinate in Trip Room</h3>
              <p className="step-card__desc">
                Approved members gain access to the private real-time Trip Room to discuss gear, schedules, and arrangements.
              </p>
            </div>

            <div className="step-card">
              <div className="step-card__number">5</div>
              <h3 className="step-card__title">Travel Safely Together</h3>
              <p className="step-card__desc">
                Embark on your journey with trusted companions, share costs transparently, and build lasting friendships.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Architecture Snapshot */}
      <section className="section">
        <div className="container">
          <div className="arch-banner">
            <div className="arch-banner__content">
              <h3 className="heading-md">Clean, Monorepo Architecture</h3>
              <p className="text-sm text-muted" style={{ marginTop: 'var(--space-2)' }}>
                Powered by Node.js, Express, React, Vite, Mongoose, and Socket.IO.
                Equipped with Helmet security headers, strict CORS, rate limiting, and honest database state reporting.
              </p>
            </div>
            <Link to="/system-status" className="btn btn--secondary">
              Inspect Live API Health
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
