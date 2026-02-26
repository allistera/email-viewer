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
  
  // Hash both inputs independently to prevent timing attacks based on length.
  // The time taken is T(len(a)) + T(len(b)), where T(len(b)) is constant for the secret.
  // This avoids the inflection point that reveals the secret length in padding-based approaches.
  const aHash = await crypto.subtle.digest('SHA-256', aBytes);
  const bHash = await crypto.subtle.digest('SHA-256', bBytes);
  
  const aHashArray = new Uint8Array(aHash);
  const bHashArray = new Uint8Array(bHash);
  
  // Compare hashes in constant time
  let result = 0;
  for (let i = 0; i < aHashArray.length; i++) {
    result |= aHashArray[i] ^ bHashArray[i];
  }
  
  return result === 0;
}
