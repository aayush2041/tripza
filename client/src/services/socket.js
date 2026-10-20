import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '')
  : 'http://localhost:5000';

let socket = null;

/**
 * Initializes and returns the authenticated Socket.IO client.
 * Uses withCredentials: true so that HTTP-only session cookies
 * are transmitted automatically in browser handshakes.
 */
export function getSocket() {
  if (!socket || socket.disconnected) {
    socket = io(SOCKET_SERVER_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

/**
 * Disconnects and cleans up the active socket.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default {
  getSocket,
  disconnectSocket,
  SOCKET_SERVER_URL,
};
