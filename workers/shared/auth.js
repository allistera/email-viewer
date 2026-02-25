import { DB } from './db.js';

/**
 * Bearer Token Authentication Middleware
 * 
 * Checks for a valid Bearer token in the Authorization header.
 * 
 * @param {Request} request 
 * @param {Object} env 
 * @returns {Promise<Object>} Returns { user, userId, error: Response|null }
 */
export async function authenticate(request, env) {
  // Allow health check without auth
  const url = new URL(request.url);
  if (url.pathname === '/api/health') {
    return { user: null, userId: null, error: null };
  }

  let token = null;

  const authHeader = request.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '').trim();
  } else {
    // Fallback: Query param (for EventSource and Downloads)
    const tokenParam = url.searchParams.get('token');
    if (tokenParam) {
      token = tokenParam;
    }
  }

  if (!token) {
    return {
      user: null,
      userId: null,
      error: new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }

  // 1. Check DB for token
  // We need DB binding in env
  if (env.DB) {
    const user = await DB.getUserByToken(env.DB, token);
    if (user) {
      return { user, userId: user.id, error: null };
    }
  }

  // 2. Fallback: Check env.API_TOKEN
  if (env.API_TOKEN) {
    const isValid = await constantTimeCompare(token, env.API_TOKEN);
    if (isValid) {
      return {
        user: { id: 'default-user-id', username: 'admin' },
        userId: 'default-user-id',
        error: null
      };
    }
  }

  return {
    user: null,
    userId: null,
    error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses Web Crypto API for secure comparison.
 * 
 * @param {string} a 
 * @param {string} b 
 * @returns {Promise<boolean>}
 */
async function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  
  // If lengths differ, still do a comparison to maintain constant time
  // but use the longer array padded
  const maxLength = Math.max(aBytes.length, bBytes.length);
  const aPadded = new Uint8Array(maxLength);
  const bPadded = new Uint8Array(maxLength);
  
  aPadded.set(aBytes);
  bPadded.set(bBytes);
  
  // Use crypto.subtle to hash both values and compare
  // This ensures constant-time comparison
  const aHash = await crypto.subtle.digest('SHA-256', aPadded);
  const bHash = await crypto.subtle.digest('SHA-256', bPadded);
  
  const aHashArray = new Uint8Array(aHash);
  const bHashArray = new Uint8Array(bHash);
  
  // Length check must still happen to prevent length oracle
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  
  // Compare hashes (both are same length, 32 bytes)
  let result = 0;
  for (let i = 0; i < aHashArray.length; i++) {
    result |= aHashArray[i] ^ bHashArray[i];
  }
  
  return result === 0;
}

/**
 * Hash a password using PBKDF2
 * @param {string} password
 * @returns {Promise<string>} Hex-encoded salt + hash
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // We export the raw key bits as the "hash"
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const hashArray = new Uint8Array(exportedKey);

  // Combine salt and hash: hex(salt) + ':' + hex(hash)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;

  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const originalHash = new Uint8Array(hashHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const newHash = new Uint8Array(exportedKey);

  // Constant time comparison of hashes
  if (originalHash.length !== newHash.length) return false;

  let result = 0;
  for (let i = 0; i < originalHash.length; i++) {
    result |= originalHash[i] ^ newHash[i];
  }

  return result === 0;
}
