import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTripRoom, getTripMessages, sendTripMessage, reportTripMessage } from '../services/api.js';
import { getSocket } from '../services/socket.js';
import { useAuth } from '../hooks/useAuth.js';
import { Badge } from '../components/Badge.jsx';
import { Notice } from '../components/Notice.jsx';
import { LoadingSpinner } from '../components/LoadingSpinner.jsx';
import './TripRoomPage.css';

export function TripRoomPage() {
  const { id: tripId } = useParams();
  const { user, profile, isAuthenticated, loading: authLoading } = useAuth();

  // State
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [accessDenied, setAccessDenied] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Connection State
  const [socketStatus, setSocketStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected'
  const [typingUsers, setTypingUsers] = useState({});

  // Composer Input
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Report Modal
  const [reportingMsgId, setReportingMsgId] = useState(null);
  const [reportReason, setReportReason] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Initial Room Metadata and Messages Fetch
  const loadRoom = useCallback(async () => {
    setLoading(true);
    setAccessDenied(null);
    setErrorNotice(null);
    try {
      const [roomRes, msgRes] = await Promise.all([
        getTripRoom(tripId),
        getTripMessages(tripId, { limit: 50 }),
      ]);

      if (roomRes.success) setRoom(roomRes.data.room);
      if (msgRes.success) {
        setMessages(msgRes.data.messages || []);
        setHasMore(msgRes.data.hasMore || false);
        setNextCursor(msgRes.data.nextCursor || null);
      }
    } catch (err) {
      console.error('Failed to load room:', err);
      if (err.status === 403) {
        setAccessDenied(err.message || 'You must be a confirmed trip member or the host to access this private Trip Room.');
      } else {
        setErrorNotice(err.message || 'Unable to load Trip Room.');
      }
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRoom();
    }
  }, [isAuthenticated, loadRoom]);

  // Scroll to bottom on initial message load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading]);

  // 2. Real-Time Socket.IO Integration
  useEffect(() => {
    if (!isAuthenticated || accessDenied) return;

    const socket = getSocket();

    const handleConnect = () => {
      setSocketStatus('connected');
      socket.emit('trip-room:join', { tripId });
    };

    const handleDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const handleConnectError = () => {
      setSocketStatus('disconnected');
    };

    const handleNewMessage = (payload) => {
      if (payload?.message) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m._id === payload.message._id)) return prev;
          return [...prev, payload.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    };

    const handleTyping = (data) => {
      if (data?.tripId === tripId && data?.userId !== user?._id) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.userId]: data.isTyping ? data.userName : null,
        }));
      }
    };

    const handleError = (err) => {
      setErrorNotice(err?.message || 'Chat error occurred.');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('trip-room:message:new', handleNewMessage);
    socket.on('trip-room:typing', handleTyping);
    socket.on('trip-room:message:error', handleError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.emit('trip-room:leave', { tripId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('trip-room:message:new', handleNewMessage);
      socket.off('trip-room:typing', handleTyping);
      socket.off('trip-room:message:error', handleError);
    };
  }, [isAuthenticated, tripId, user?._id, accessDenied]);

  // Load older messages (Pagination)
  const handleLoadEarlier = async () => {
    if (!nextCursor || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const res = await getTripMessages(tripId, { before: nextCursor, limit: 30 });
      if (res.success && res.data) {
        setMessages((prev) => [...res.data.messages, ...prev]);
        setHasMore(res.data.hasMore);
        setNextCursor(res.data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to load earlier messages:', err);
    } finally {
      setLoadingEarlier(false);
    }
  };

  // Send message handler (Dual Delivery: Socket.IO with REST Fallback)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || sending) return;

    if (room?.isArchived || room?.tripStatus === 'cancelled') {
      setErrorNotice('This trip is cancelled. New messages cannot be sent.');
      return;
    }

    setSending(true);
    setErrorNotice(null);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('trip-room:message', { tripId, text: clean }, (res) => {
        setSending(false);
        if (res?.status === 'success') {
          setInputText('');
          // Clear typing
          socket.emit('trip-room:typing', { tripId, isTyping: false });
        } else {
          setErrorNotice(res?.error?.message || 'Failed to send message.');
        }
      });
    } else {
      // Fallback to HTTP REST
      try {
        const res = await sendTripMessage(tripId, clean);
        if (res.success && res.data?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === res.data.message._id)) return prev;
            return [...prev, res.data.message];
          });
          setInputText('');
          setTimeout(scrollToBottom, 50);
        }
      } catch (err) {
        setErrorNotice(err.message || 'Failed to send message.');
      } finally {
        setSending(false);
      }
    }
  };

  // Handle typing debounce
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('trip-room:typing', { tripId, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('trip-room:typing', { tripId, isTyping: false });
      }, 2500);
    }
  };

  const handleReport = async (msgId) => {
    try {
      await reportTripMessage(tripId, msgId, reportReason);
      setReportingMsgId(null);
      setReportReason('');
      setSuccessNotice('Thank you. The message has been reported for moderation review.');
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err) {
      setErrorNotice(err.message || 'Failed to submit report.');
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (authLoading || loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', textAlign: 'center' }}>
        <LoadingSpinner size="lg" message="Connecting to secure Trip Room..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', maxWidth: '580px' }}>
        <Notice type="warning" title="Authentication Required">
          Please log in to enter private Trip Rooms.
        </Notice>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
          <Link to={`/login?redirect=/trips/${tripId}/room`} className="btn btn--primary">
            Sign In
          </Link>
          <Link to={`/trips/${tripId}`} className="btn btn--secondary">
            View Trip Details
          </Link>
        </div>
      </div>
    );
  }

  // Access Denied Guard
  if (accessDenied) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', maxWidth: '640px' }}>
        <Notice type="error" title="Private Trip Room Access Restricted">
          {accessDenied}
        </Notice>
        <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          To protect traveller safety and logistical coordination, private Trip Rooms are accessible exclusively to the trip host and verified companions with approved membership.
        </p>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Link to={`/trips/${tripId}`} className="btn btn--primary">
            ← Return to Trip Details
          </Link>
        </div>
      </div>
    );
  }

  const activeTypers = Object.values(typingUsers).filter(Boolean);

  return (
    <div className="trip-room-page">
      {/* Top Header */}
      <header className="room-header">
        <div className="room-header__left">
          <Link to={`/trips/${tripId}`} className="room-header__back-btn" title="Back to Trip Page">
            ← Details
          </Link>
          <div className="room-header__title-block">
            <h1 className="room-header__title">
              <span>{room?.title}</span>
              {room?.isArchived ? (
                <Badge variant="warning" size="sm">Archived (Read-Only)</Badge>
              ) : (
                <Badge variant="teal" size="sm">Active Trip Room</Badge>
              )}
            </h1>
            <span className="room-header__route">
              {room?.startingCity} ➔ {room?.destination} • {room?.totalCount} Travellers
            </span>
          </div>
        </div>

        <div className="room-header__right">
          <div className="room-status-indicator">
            <div
              className={`status-dot status-dot--${socketStatus}`}
              title={`Socket status: ${socketStatus}`}
            />
            <span>{socketStatus === 'connected' ? 'Live' : socketStatus}</span>
          </div>
        </div>
      </header>

      {/* Main Room Body */}
      <div className="room-body">
        {/* Chat Area */}
        <main className="room-chat-area">
          {errorNotice && (
            <div style={{ padding: 'var(--space-2) var(--space-6)' }}>
              <Notice type="error" title="Notice">
                {errorNotice}
              </Notice>
            </div>
          )}

          {successNotice && (
            <div style={{ padding: 'var(--space-2) var(--space-6)' }}>
              <Notice type="success" title="Success">
                {successNotice}
              </Notice>
            </div>
          )}

          {room?.isArchived && (
            <div style={{ padding: 'var(--space-2) var(--space-6)' }}>
              <Notice type="warning" title="Trip Cancelled">
                This trip has been cancelled. The Trip Room is archived in read-only mode for your reference.
              </Notice>
            </div>
          )}

          {/* Messages List */}
          <div className="messages-container">
            <div className="room-privacy-banner">
              🔒 <span>Messages are encrypted in transit (TLS) and visible only to confirmed trip members. Not end-to-end encrypted.</span>{' '}
              <Link to="/safety" className="room-privacy-link">Read Safety Guidelines</Link>
            </div>

            {hasMore && (
              <button
                type="button"
                className="load-more-btn"
                onClick={handleLoadEarlier}
                disabled={loadingEarlier}
              >
                {loadingEarlier ? 'Loading earlier messages...' : '↑ Load Earlier Messages'}
              </button>
            )}

            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>💬</div>
                <h3 style={{ margin: '0 0 var(--space-1) 0', color: 'var(--color-text-primary)' }}>Welcome to the Trip Room!</h3>
                <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  Introduce yourself, discuss pickup locations, gear checklists, and itinerary adjustments.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOutgoing = msg.sender?._id === user?._id;
                const isHost = room?.organiser?.userId === msg.sender?._id;

                return (
                  <div
                    key={msg._id}
                    className={`chat-message ${isOutgoing ? 'chat-message--outgoing' : 'chat-message--incoming'} ${
                      msg.isDeleted ? 'chat-message--deleted' : ''
                    }`}
                  >
                    {!isOutgoing && (
                      <div className="message-avatar">
                        {msg.sender?.fullName ? msg.sender.fullName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}

                    <div className="message-content">
                      <div className="message-meta">
                        <span className="message-sender-name">
                          {isOutgoing ? 'You' : msg.sender?.fullName || msg.sender?.email}
                        </span>
                        {isHost && <Badge variant="primary" size="xs">Host</Badge>}
                        <span>{formatTimestamp(msg.createdAt)}</span>
                      </div>

                      <div className="message-bubble">
                        {msg.message}
                      </div>

                      {!isOutgoing && !msg.isDeleted && (
                        <div className="message-actions">
                          <button
                            type="button"
                            className="message-report-btn"
                            onClick={() => setReportingMsgId(msg._id)}
                          >
                            Report
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator Bar */}
          <div className="typing-bar">
            {activeTypers.length > 0 && (
              <span>
                {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
              </span>
            )}
          </div>

          {/* Composer */}
          <div className="message-composer-container">
            <form className="message-composer-form" onSubmit={handleSendMessage}>
              <div className="composer-input-wrapper">
                <textarea
                  className="composer-textarea"
                  rows="2"
                  placeholder={
                    room?.isArchived
                      ? 'Trip Room is archived in read-only mode.'
                      : 'Type a message to companions... (Enter to send, Shift+Enter for new line)'
                  }
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  maxLength={2000}
                  disabled={room?.isArchived || sending}
                />
                <span className="composer-char-count">{inputText.length} / 2000</span>
              </div>

              <button
                type="submit"
                className="composer-send-btn"
                disabled={!inputText.trim() || room?.isArchived || sending}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </main>

        {/* Member Roster Sidebar */}
        <aside className="room-sidebar">
          <h2 className="room-sidebar__title">Room Companions ({room?.totalCount})</h2>

          <div className="members-list">
            {/* Host */}
            <div className="member-row">
              <div className="message-avatar">
                {room?.organiser?.fullName?.charAt(0).toUpperCase() || 'H'}
              </div>
              <div className="member-row-info">
                <span className="member-row-name">
                  {room?.organiser?.fullName}
                  <Badge variant="primary" size="xs">Host</Badge>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Trip Organiser</span>
              </div>
            </div>

            {/* Approved Members */}
            {room?.members?.map((m) => (
              <div key={m.userId} className="member-row">
                <div className="message-avatar" style={{ background: 'var(--color-teal-light)', color: 'var(--color-teal)' }}>
                  {m.fullName?.charAt(0).toUpperCase() || 'M'}
                </div>
                <div className="member-row-info">
                  <span className="member-row-name">
                    {m.fullName}
                    {m.isVerified && <span style={{ color: 'var(--color-success)', fontSize: '11px' }}>✓</span>}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Confirmed Member</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Report Modal */}
      {reportingMsgId && (
        <div className="modal-overlay" onClick={() => setReportingMsgId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setReportingMsgId(null)}
            >
              ×
            </button>
            <h3 className="modal-title">Report Message</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Flag this message for community moderation review.
            </p>
            <textarea
              className="form-input"
              rows="3"
              placeholder="Why are you reporting this message? (e.g. harassment, spam, inappropriate conduct)..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{ marginBottom: 'var(--space-4)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setReportingMsgId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => handleReport(reportingMsgId)}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default TripRoomPage;
