/**
 * Authentication utilities
 */

/**
 * Validate bearer token from Authorization header
 */
export function validateAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === env.API_TOKEN;
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Middleware to require authentication
 */
export function requireAuth(handler) {
  return async (request, env, ctx) => {
    if (!validateAuth(request, env)) {
      return unauthorizedResponse();
    }
    return handler(request, env, ctx);
  };
}
