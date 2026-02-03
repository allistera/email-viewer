export const StreamRouter = {
  async handle(urlString, request, env) {
    const url = new URL(urlString);
    const path = url.pathname.replace('/api/', '');

    if (path === 'stream' || path === 'ws') {
      try {
        // Check if REALTIME_HUB binding exists
        if (!env.REALTIME_HUB) {
          console.error('REALTIME_HUB binding not found');
          return new Response(
            JSON.stringify({ error: 'Realtime service unavailable' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const id = env.REALTIME_HUB.idFromName('global');
        const stub = env.REALTIME_HUB.get(id);

        // Rewrite URL to match DO internal paths
        const doUrl = new URL(request.url);
        doUrl.pathname = path === 'stream' ? '/connect/sse' : '/connect/ws';

        const newRequest = new Request(doUrl.toString(), request);
        return stub.fetch(newRequest);
      } catch (error) {
        console.error('StreamRouter error:', error.message, error.stack);
        return new Response(
          JSON.stringify({ error: 'Stream connection failed', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return null; // Not a stream request
  }
};
