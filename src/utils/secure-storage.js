/**
 * Secure localStorage wrapper with XSS prevention
 * Sanitizes data before storage and retrieval to prevent injection attacks
 */

/* global process */

// Allowed keys - whitelist approach for security
const ALLOWED_KEYS = [
  'rows',
  'darkMode',
  'presets',
  'sessionHistory',
  'userSettings',
  'lastPreset',
];

/**
 * Sanitize string to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // Remove potentially dangerous characters and patterns
  /* eslint-disable security/detect-unsafe-regex */
  return str
    .replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replaceAll(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replaceAll(/javascript:/gi, '')
    .replaceAll(/on\w+\s*=/gi, ''); // Remove inline event handlers
  /* eslint-enable security/detect-unsafe-regex */
}

/**
 * Recursively sanitize object properties
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Securely get item from localStorage
 * @param {string} key - Storage key
 * @returns {any} Parsed and sanitized value
 */
export function secureGetItem(key) {
  // Validate key is allowed
  if (!ALLOWED_KEYS.includes(key)) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`Attempted to access non-whitelisted localStorage key: ${key}`);
    }
    return null;
  }

  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    return sanitizeObject(parsed);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`Error reading from localStorage (${key}):`, error);
    }
    return null;
  }
}

/**
 * Securely set item in localStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {boolean} Success status
 */
export function secureSetItem(key, value) {
  // Validate key is allowed
  if (!ALLOWED_KEYS.includes(key)) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`Attempted to set non-whitelisted localStorage key: ${key}`);
    }
    return false;
  }

  try {
    const sanitized = sanitizeObject(value);
    const serialized = JSON.stringify(sanitized);

    // Validate size (localStorage has ~5-10MB limit)
    if (serialized.length > 5_000_000) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(`Data too large for localStorage (${key}): ${serialized.length} bytes`);
      }
      return false;
    }

    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`Error writing to localStorage (${key}):`, error);
    }
    return false;
  }
}

/**
 * Securely remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} Success status
 */
export function secureRemoveItem(key) {
  if (!ALLOWED_KEYS.includes(key)) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`Attempted to remove non-whitelisted localStorage key: ${key}`);
    }
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`Error removing from localStorage (${key}):`, error);
    }
    return false;
  }
}

/**
 * Securely clear all whitelisted items from localStorage
 * @returns {boolean} Success status
 */
export function secureClear() {
  try {
    for (const key of ALLOWED_KEYS) {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Error clearing localStorage:', error);
    }
    return false;
  }
}

/**
 * Get all whitelisted keys currently in localStorage
 * @returns {string[]} Array of keys
 */
export function getWhitelistedKeys() {
  return ALLOWED_KEYS.filter((key) => localStorage.getItem(key) !== null);
}
