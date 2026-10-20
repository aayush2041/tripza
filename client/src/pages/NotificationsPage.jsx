import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyNotifications({
        unreadOnly: filter === 'unread',
        limit: 50,
      });
      const data = res.data;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'join_request_received':
        return '📬';
      case 'request_approved':
        return '🎉';
      case 'request_rejected':
        return 'ℹ️';
      case 'trip_cancelled':
        return '⚠️';
      case 'trip_updated':
        return '✏️';
      case 'member_left':
        return '👋';
      case 'moderation_notice':
        return '🛡️';
      case 'account_status':
        return '⚠️';
      default:
        return '🔔';
    }
  };

  const getNotificationLink = (n) => {
    if (n.trip?._id || n.trip) {
      const tripId = n.trip?._id || n.trip;
      if (n.type === 'request_approved') {
        return `/trips/${tripId}/room`;
      }
      if (n.type === 'join_request_received') {
        return '/my-trips';
      }
      return `/trips/${tripId}`;
    }
    return null;
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div>
          <h1>🔔 Notifications</h1>
          <p className="notifications-subtitle">
            Stay updated with your trips, join requests, community events, and safety notices.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            className="mark-all-btn"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="notifications-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread {unreadCount > 0 && <span className="unread-pill">{unreadCount}</span>}
        </button>
      </div>

      {loading ? (
        <div className="notifications-loading">
          <LoadingSpinner />
          <p>Loading your notifications...</p>
        </div>
      ) : error ? (
        <div className="notifications-error">
          <p>{error}</p>
          <button onClick={fetchNotifications}>Try Again</button>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          message={
            filter === 'unread'
              ? 'You are all caught up! There are no unread updates.'
              : 'When you create trips, request to join expeditions, or receive community updates, they will appear here.'
          }
          icon="🔔"
        />
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => {
            const link = getNotificationLink(n);
            return (
              <div
                key={n._id}
                className={`notification-item ${n.read ? 'read' : 'unread'}`}
                onClick={() => !n.read && handleMarkRead(n._id)}
              >
                <div className="notification-icon">{getNotificationIcon(n.type)}</div>
                <div className="notification-content">
                  <div className="notification-top">
                    <h4 className="notification-title">{n.title}</h4>
                    <span className="notification-time">
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="notification-body">{n.message}</p>
                  {link && (
                    <div className="notification-action">
                      <Link
                        to={link}
                        className="notification-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!n.read) handleMarkRead(n._id);
                        }}
                      >
                        {n.type === 'request_approved'
                          ? '💬 Go to Private Trip Room →'
                          : n.type === 'join_request_received'
                            ? '📋 Manage in Dashboard →'
                            : 'View Trip Details →'}
                      </Link>
                    </div>
                  )}
                </div>
                {!n.read && (
                  <button
                    className="mark-read-dot-btn"
                    title="Mark as read"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(n._id);
                    }}
                  >
                    ●
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
