export const StreamRouter = {
  async handle(urlString, request, env) {
    const url = new URL(urlString);
    const path = url.pathname.replace('/api/', '');

    if (path === 'stream' || path === 'ws') {
      const id = env.REALTIME_HUB.idFromName('global');
      const stub = env.REALTIME_HUB.get(id);

      // Rewrite URL to match DO internal paths
      const doUrl = new URL(request.url);
      doUrl.pathname = path === 'stream' ? '/connect/sse' : '/connect/ws';

      const newRequest = new Request(doUrl.toString(), request);
      return stub.fetch(newRequest);
    }

    return null; // Not a stream request
  }
};
