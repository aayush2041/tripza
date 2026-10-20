/**
 * API client service for TripZa.
 * Centralizes all network requests to the backend with automated CSRF management
 * and credentials support for server-managed sessions.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Extracts a cookie value by name from document.cookie.
 */
function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Fetches a fresh CSRF token from the server if not already stored in cookies.
 */
let csrfPromise = null;
async function fetchCsrfToken() {
  if (!csrfPromise) {
    csrfPromise = fetch(`${API_BASE_URL}/auth/csrf-token`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => data?.data?.csrfToken || null)
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

/**
 * Core HTTP request wrapper.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Attach CSRF token on mutating requests
  if (isMutating) {
    let csrfToken = getCookie('tripza_csrf');
    if (!csrfToken) {
      csrfToken = await fetchCsrfToken();
    }
    if (csrfToken) {
      defaultHeaders['X-CSRF-Token'] = csrfToken;
    }
  }

  const config = {
    ...options,
    method,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    // 'include' ensures HTTP-only session cookies are transmitted cross-origin in dev
    credentials: 'include',
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.code = data?.error?.code || 'REQUEST_FAILED';
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    const netError = new Error(
      `Unable to connect to the TripZa backend at ${API_BASE_URL}. Ensure the backend server is running.`
    );
    netError.code = 'NETWORK_ERROR';
    netError.isNetworkError = true;
    throw netError;
  }
}

// ==========================================
// Authentication API Endpoints
// ==========================================

export async function registerUser({ fullName, email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });
}

export async function loginUser({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutUser() {
  return request('/auth/logout', {
    method: 'POST',
  });
}

export async function getSessionUser() {
  return request('/auth/me');
}

export async function getCsrfToken() {
  return request('/auth/csrf-token');
}

// ==========================================
// Traveller Profile Endpoints
// ==========================================

export async function getMyProfile() {
  return request('/profiles/me');
}

export async function updateMyProfile(profileData) {
  return request('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
}

export async function getPublicProfile(profileId) {
  return request(`/profiles/${profileId}`);
}

// ==========================================
// Verification Endpoints
// ==========================================

export async function submitVerification() {
  return request('/verification/submit', {
    method: 'POST',
  });
}

// ==========================================
// Trip Discovery & Management Endpoints
// ==========================================

export async function getTrips(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return request(`/trips${queryString}`);
}

export async function getTripById(tripId) {
  return request(`/trips/${tripId}`);
}

export async function createTrip(tripData) {
  return request('/trips', {
    method: 'POST',
    body: JSON.stringify(tripData),
  });
}

export async function updateTrip(tripId, tripData) {
  return request(`/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(tripData),
  });
}

export async function publishTrip(tripId) {
  return request(`/trips/${tripId}/publish`, {
    method: 'POST',
  });
}

export async function cancelTrip(tripId) {
  return request(`/trips/${tripId}/cancel`, {
    method: 'POST',
  });
}

export async function joinTrip(tripId, message = '') {
  return request(`/trips/${tripId}/join`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getTripRequests(tripId) {
  return request(`/trips/${tripId}/requests`);
}

export async function approveJoinRequest(tripId, requestId, reason = '') {
  return request(`/trips/${tripId}/requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function rejectJoinRequest(tripId, requestId, reason = '') {
  return request(`/trips/${tripId}/requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function leaveTrip(tripId) {
  return request(`/trips/${tripId}/leave`, {
    method: 'POST',
  });
}

// ==========================================
// Personal Dashboard Endpoints
// ==========================================

export async function getMyOrganizedTrips() {
  return request('/trips/mine/organized');
}

export async function getMyJoinedTrips() {
  return request('/trips/mine/joined');
}

export async function getMyTripRequests() {
  return request('/trips/mine/requests');
}

// ==========================================
// Notifications Endpoints
// ==========================================

export async function getMyNotifications() {
  return request('/notifications');
}

export async function markNotificationRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

// ==========================================
// Trip Room & Messaging Endpoints
// ==========================================

export async function getTripRoom(tripId) {
  return request(`/trips/${tripId}/room`);
}

export async function getTripMessages(tripId, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return request(`/trips/${tripId}/messages${queryString}`);
}

export async function sendTripMessage(tripId, message) {
  return request(`/trips/${tripId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function reportTripMessage(tripId, messageId, reason = '') {
  return request(`/trips/${tripId}/messages/${messageId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ==========================================
// System Health
// ==========================================

export async function getBackendHealth() {
  return request('/health');
}

export default {
  request,
  registerUser,
  loginUser,
  logoutUser,
  getSessionUser,
  getCsrfToken,
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  submitVerification,
  getTrips,
  getTripById,
  createTrip,
  updateTrip,
  publishTrip,
  cancelTrip,
  joinTrip,
  getTripRequests,
  approveJoinRequest,
  rejectJoinRequest,
  leaveTrip,
  getMyOrganizedTrips,
  getMyJoinedTrips,
  getMyTripRequests,
  getMyNotifications,
  markNotificationRead,
  getTripRoom,
  getTripMessages,
  sendTripMessage,
  reportTripMessage,
  getBackendHealth,
  API_BASE_URL,
};
