export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': '*',
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

    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    const init = {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    };

    if (response.webSocket) {
        init.webSocket = response.webSocket;
    }

    return new Response(response.body, init);
}
