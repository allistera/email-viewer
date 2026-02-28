## 2025-02-24 - SQL Wildcard Injection in D1
**Vulnerability:** User input passed directly to SQL `LIKE` queries allowed wildcard injection (e.g., `%`, `_`), enabling broader searches than intended and potential DoS via resource exhaustion.
**Learning:** Cloudflare D1 (SQLite) `LIKE` operator does not automatically escape wildcard characters in bound parameters.
**Prevention:** Use the `ESCAPE '\'` clause in SQL queries and sanitize input using a helper function (e.g., `str.replace(/[\\%_]/g, '\\$&')`) before binding.
