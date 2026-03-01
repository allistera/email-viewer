## 2025-02-24 - SQL Wildcard Injection in D1
**Vulnerability:** User input passed directly to SQL `LIKE` queries allowed wildcard injection (e.g., `%`, `_`), enabling broader searches than intended and potential DoS via resource exhaustion.
**Learning:** Cloudflare D1 (SQLite) `LIKE` operator does not automatically escape wildcard characters in bound parameters.
**Prevention:** Use the `ESCAPE '\'` clause in SQL queries and sanitize input using a helper function (e.g., `str.replace(/[\\%_]/g, '\\$&')`) before binding.
## 2025-02-24 - SQL Wildcard Injection in excludeTag query
**Vulnerability:** The excludeTag block in `countMessages` and `listMessages` used a LIKE query identical to `tag` filtering, which didn't escape `_` and `%` properly, allowing SQL wildcard injection.
**Learning:** SQL parameterization is not enough to stop wildcard evaluations. SQLite requires explicitly using `ESCAPE` clauses paired with customized string functions that prepend the escape character.
**Prevention:** Make sure ANY user input tied to a SQL LIKE clause uses `.replace(/[\\%_]/g, '\\$&')` and is passed alongside the `ESCAPE '\'` SQL statement, ensuring no part of the query evaluates unintended wildcards.
