## 2024-05-22 - Missing Security Headers on Static Assets
**Vulnerability:** Static assets served via `env.ASSETS` in Cloudflare Workers do not include security headers by default (CSP, HSTS, X-Frame-Options, etc.).
**Learning:** Cloudflare Workers `env.ASSETS` binding returns the raw response from the asset store. Unlike traditional web servers or Cloudflare Pages functions which might add headers automatically, Workers require manual header injection.
**Prevention:** Wrap `env.ASSETS.fetch(request)` calls and add necessary security headers before returning the response. Use `new Response(response.body, response)` to clone and modify.
