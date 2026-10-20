import React from 'react';
import { Link } from 'react-router-dom';
import './SafetyGuidelinesPage.css';

export default function SafetyGuidelinesPage() {
  return (
    <div className="safety-page-container">
      <div className="safety-hero">
        <span className="safety-hero-badge">🛡️ Community Trust & Safety</span>
        <h1>TripZa Safety & Community Guidelines</h1>
        <p className="safety-hero-subtitle">
          TripZa connects travellers across India to explore mountains, coasts, and deserts together.
          Mutual respect, honest communication, and collective safety are our shared foundation.
        </p>
      </div>

      <div className="safety-grid">
        {/* Core Principles */}
        <section className="safety-card">
          <div className="safety-card-icon">🤝</div>
          <h2>1. Mutual Respect & Zero Tolerance</h2>
          <p>
            TripZa maintains a strict zero-tolerance policy towards harassment, discrimination,
            hate speech, stalking, and unwelcome advances. Treat every travel companion with dignity
            regardless of gender, religion, caste, sexual orientation, or background.
          </p>
          <ul>
            <li>No derogatory, abusive, or sexually suggestive language.</li>
            <li>Respect personal space and individual boundaries at all times.</li>
            <li>Honor group itineraries and shared travel agreements.</li>
          </ul>
        </section>

        {/* Real-World Safety in India */}
        <section className="safety-card">
          <div className="safety-card-icon">🏔️</div>
          <h2>2. Meeting & On-Trip Safety in India</h2>
          <p>
            When joining group road trips, Himalayan treks, or weekend getaways, take sensible
            safety precautions:
          </p>
          <ul>
            <li><strong>Meet in Public Locations:</strong> For initial group rendezvous, meet at well-lit, public hubs (such as metro stations, ISBT terminals, or airport arrivals).</li>
            <li><strong>Share Your Itinerary:</strong> Share the trip link, host profile, and route with trusted family or friends before departing.</li>
            <li><strong>Emergency Preparedness:</strong> Check mountain weather advisories, acclimatize responsibly in high-altitude zones (Spiti, Ladakh, Uttarakhand), and carry basic first-aid.</li>
            <li><strong>Expense Transparency:</strong> Use TripZa’s estimated budget splits. Avoid sending large untraceable cash advances to strangers.</li>
          </ul>
        </section>

        {/* In-App Safety Features */}
        <section className="safety-card">
          <div className="safety-card-icon">🚩</div>
          <h2>3. Reporting & Blocking System</h2>
          <p>
            You have powerful safety tools directly within TripZa:
          </p>
          <ul>
            <li><strong>Flagging Content:</strong> You can report any profile, trip listing, or room message by clicking the 🚩 Report button.</li>
            <li><strong>Confidentiality:</strong> Reports are confidential. Reported users are never told who submitted a report.</li>
            <li><strong>Blocking:</strong> You can block another user from their profile. Blocked users cannot request to join your hosted trips, and you cannot join theirs.</li>
            <li><strong>Moderation Action:</strong> Violations result in warnings, content removal, or account suspension following human review.</li>
          </ul>
        </section>

        {/* Messaging & Privacy Limitations */}
        <section className="safety-card">
          <div className="safety-card-icon">🔒</div>
          <h2>4. Privacy & Messaging Transparency</h2>
          <p>
            We believe in honest technology disclosures without false security claims:
          </p>
          <ul>
            <li><strong>Transport Encryption:</strong> All TripZa web traffic and WebSocket communication are encrypted in transit using industry-standard TLS / HTTPS.</li>
            <li><strong>No End-to-End Encryption (E2EE):</strong> Private Trip Rooms are <em>not</em> end-to-end encrypted. Messages are stored on secured servers to allow offline history retrieval and moderation of reported violations.</li>
            <li><strong>Shared Group Rooms:</strong> If you and a blocked user are both confirmed members of the same group trip, messages in the shared room remain visible to preserve logistical and emergency safety.</li>
          </ul>
        </section>
      </div>

      {/* Emergency Helplines in India */}
      <section className="safety-emergency-banner">
        <h2>🚨 Indian National Emergency Helplines</h2>
        <p>If you or someone in your group is in immediate danger, contact authorities immediately:</p>
        <div className="emergency-numbers-grid">
          <div className="emergency-item">
            <span className="emergency-number">112</span>
            <span className="emergency-label">National Emergency (Police, Fire, Ambulance)</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-number">1090 / 1091</span>
            <span className="emergency-label">Women in Distress Helpline</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-number">1363</span>
            <span className="emergency-label">Ministry of Tourism 24x7 Multi-lingual Helpline</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-number">1070</span>
            <span className="emergency-label">National Disaster Management Authority (NDMA)</span>
          </div>
        </div>
      </section>

      {/* Verification & Legal Disclaimers */}
      <section className="safety-disclaimer">
        <h3>ℹ️ Community Disclaimer</h3>
        <p>
          TripZa is a platform facilitating connections between independent travellers. While profile
          verification reviews government IDs, verification does not constitute a legal background check
          or a guarantee of personal safety. Travellers must exercise sound judgment and take personal
          responsibility for their own well-being on all expeditions.
        </p>
        <div className="safety-links-row">
          <Link to="/trips" className="safety-primary-link">Explore Verified Trips →</Link>
          <Link to="/profile" className="safety-secondary-link">Review Your Profile & Verification →</Link>
        </div>
      </section>
    </div>
  );
}
