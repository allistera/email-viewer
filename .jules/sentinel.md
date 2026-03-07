## 2025-02-24 - SQL Wildcard Injection in D1
**Vulnerability:** User input passed directly to SQL `LIKE` queries allowed wildcard injection (e.g., `%`, `_`), enabling broader searches than intended and potential DoS via resource exhaustion.
**Learning:** Cloudflare D1 (SQLite) `LIKE` operator does not automatically escape wildcard characters in bound parameters.
**Prevention:** Use the `ESCAPE '\'` clause in SQL queries and sanitize input using a helper function (e.g., `str.replace(/[\\%_]/g, '\\$&')`) before binding.
## 2025-02-24 - SQL Wildcard Injection in excludeTag query
**Vulnerability:** The excludeTag block in `countMessages` and `listMessages` used a LIKE query identical to `tag` filtering, which didn't escape `_` and `%` properly, allowing SQL wildcard injection.
**Learning:** SQL parameterization is not enough to stop wildcard evaluations. SQLite requires explicitly using `ESCAPE` clauses paired with customized string functions that prepend the escape character.
**Prevention:** Make sure ANY user input tied to a SQL LIKE clause uses `.replace(/[\\%_]/g, '\\$&')` and is passed alongside the `ESCAPE '\'` SQL statement, ensuring no part of the query evaluates unintended wildcards.
## 2025-02-05 - XSS Vulnerability in Email Sanitizer due to <style> Tag
**Vulnerability:** The HTML sanitizer configuration (`web/src/workers/sanitizer.config.js`) included the `<style>` tag in its `allowedTags` array. This is inherently vulnerable to CSS injection and Cross-Site Scripting (XSS) attacks in the email inbox interface.
**Learning:** Even when using established security libraries like `sanitize-html`, the default or custom configuration can introduce vulnerabilities if known dangerous tags like `<style>` or `<script>` are explicitly allowed.
**Prevention:** Always verify the security implications of tags allowed in HTML sanitizers. Prohibit `<style>`, `<script>`, `<base>`, and `<object>` tags unless there is an extremely compelling reason and strong additional mitigations are in place. Ensure test suites include explicit checks for blocking these vulnerable tags.
