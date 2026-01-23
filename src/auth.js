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
    console.log('Auth failed: No token provided');
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Auth-Error': 'missing-token'
      }
    });
  }

  // Basic constant-time comparison
  console.log('Verifying token. Environment has API_TOKEN:', !!env.API_TOKEN);
  if (token !== env.API_TOKEN) {
    console.log('Auth failed: Token mismatch');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Auth-Error': 'token-mismatch',
        'X-Debug-Token-Len': token.length.toString(),
        'X-Debug-Env-Len': (env.API_TOKEN || '').length.toString(),
        'X-Debug-Token-Start': token.substring(0, 3)
      }
    });
  }

  return null;
}
