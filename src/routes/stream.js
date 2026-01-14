/**
 * SSE and WebSocket proxy routes
 */

/**
 * GET /api/stream - Proxy to Durable Object SSE endpoint
 */
export async function handleSSEStream(request, env) {
  const hubId = env.REALTIME_HUB.idFromName('global');
  const hub = env.REALTIME_HUB.get(hubId);

  const hubRequest = new Request('https://internal/connect/sse', {
    headers: request.headers
  });

  return hub.fetch(hubRequest);
}

/**
 * GET /api/ws - Proxy to Durable Object WebSocket endpoint
 */
export async function handleWebSocketStream(request, env) {
  const hubId = env.REALTIME_HUB.idFromName('global');
  const hub = env.REALTIME_HUB.get(hubId);

  const hubRequest = new Request('https://internal/connect/ws', {
    headers: request.headers
  });

  return hub.fetch(hubRequest);
}
