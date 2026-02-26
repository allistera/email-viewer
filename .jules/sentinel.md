## 2024-10-23 - Cloudflare Workers env.ASSETS Security Headers
**Vulnerability:** Static assets served via `env.ASSETS` in Cloudflare Workers lacked security headers (CSP, HSTS, X-Frame-Options), leaving the frontend vulnerable to XSS and Clickjacking.
**Learning:** The `env.ASSETS` binding returns a standard Response object that must be intercepted and wrapped to add custom headers. It does not inherit headers from the Worker configuration automatically.
**Prevention:** Always intercept `env.ASSETS.fetch()` calls in the Worker entry point and manually inject a `Content-Security-Policy` and other hardening headers before returning the response.

## 2024-10-24 - Timing Side-Channel in DIY Constant-Time Compare
**Vulnerability:** A custom `constantTimeCompare` implementation leaked the length of the secret token by padding inputs to `Math.max(input.length, secret.length)`. This created a timing inflection point when the attacker's input length exceeded the secret's length.
**Learning:** Padding to a max length creates a length oracle if the padding size depends on the secret. Independent hashing of both inputs (double-HMAC or simple double-hash) ensures execution time depends only on the attacker's input length plus a constant factor for the secret.
**Prevention:** Avoid custom padding logic for constant-time comparisons. Instead, hash both inputs independently using a cryptographic hash function (like SHA-256 via `crypto.subtle`) and compare the resulting fixed-size digests in constant time.
