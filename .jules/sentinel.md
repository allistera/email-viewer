## 2024-10-23 - Cloudflare Workers env.ASSETS Security Headers
**Vulnerability:** Static assets served via `env.ASSETS` in Cloudflare Workers lacked security headers (CSP, HSTS, X-Frame-Options), leaving the frontend vulnerable to XSS and Clickjacking.
**Learning:** The `env.ASSETS` binding returns a standard Response object that must be intercepted and wrapped to add custom headers. It does not inherit headers from the Worker configuration automatically.
**Prevention:** Always intercept `env.ASSETS.fetch()` calls in the Worker entry point and manually inject a `Content-Security-Policy` and other hardening headers before returning the response.
