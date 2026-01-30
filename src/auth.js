/**
 * Bearer Token Authentication Middleware
 * 
 * Checks for a valid Bearer token in the Authorization header.
 * 
 * @param {Request} request 
 * @param {Object} env 
 * @returns {Promise<Response|null>} Returns a 401 Response if auth fails, or null if it succeeds.
 */
export async function authenticate(request, env) {
  // Allow health check without auth
  const url = new URL(request.url);
  if (url.pathname === '/api/health') {
    return null;
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
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Constant-time comparison to prevent timing attacks
  const isValid = await constantTimeCompare(token, env.API_TOKEN);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return null;
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
