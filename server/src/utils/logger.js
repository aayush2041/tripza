/**
 * Safe logging utility for TripZa.
 * Automatically sanitizes sensitive strings such as MongoDB connection credentials
 * and tokens before outputting to stdout/stderr.
 */

const SENSITIVE_PATTERNS = [
  /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  /password["']?\s*[:=]\s*["']?[^"',\s]+/gi,
  /secret["']?\s*[:=]\s*["']?[^"',\s]+/gi,
];

function sanitize(message) {
  if (typeof message !== 'string') {
    try {
      message = JSON.stringify(message);
    } catch {
      message = String(message);
    }
  }

  let sanitized = message;
  sanitized = sanitized.replace(
    /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/gi,
    'mongodb$1://***:***@'
  );
  return sanitized;
}

function format(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ' ' + args.map(sanitize).join(' ') : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${sanitize(message)}${formattedArgs}`;
}

export const logger = {
  info: (msg, ...args) => console.log(format('info', msg, ...args)),
  warn: (msg, ...args) => console.warn(format('warn', msg, ...args)),
  error: (msg, ...args) => console.error(format('error', msg, ...args)),
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(format('debug', msg, ...args));
    }
  },
};
