export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, X-Todoist-Token',
    'Access-Control-Max-Age': '86400',
};

export function handleOptions(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders
        });
    }
    return null;
}

export function withCors(response) {
    if (!response) return response;

    // WebSocket upgrade uses status 101; Cloudflare Workers only allows 200-599 when
    // constructing Response. Pass through WebSocket responses without wrapping to
    // avoid RangeError. CORS headers are less critical for the upgrade handshake.
    if (response.webSocket) {
        return response;
    }

    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    // Security Headers (Defense in Depth)
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newHeaders.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

    // Cloudflare Workers only accepts status 200-599
    const status = response.status;
    const safeStatus = (Number.isFinite(status) && status >= 200 && status <= 599)
        ? Math.floor(status) : 502;

    const init = {
        status: safeStatus,
        statusText: response.statusText,
        headers: newHeaders
    };

    return new Response(response.body, init);
}
