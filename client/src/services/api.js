/**
 * API client service for TripZa.
 * Centralizes all network requests to the backend server.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Standard fetch wrapper with credential support and error handling.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    // 'include' ensures HTTP-only cookies are sent for cross-origin local dev
    credentials: 'include',
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    // Network / offline error
    const netError = new Error(
      `Unable to connect to the TripZa backend at ${API_BASE_URL}. Ensure the backend server is running.`
    );
    netError.isNetworkError = true;
    throw netError;
  }
}

/**
 * Fetches the backend system health and database connectivity status.
 */
export async function getBackendHealth() {
  return request('/health');
}

export default {
  request,
  getBackendHealth,
  API_BASE_URL,
};
