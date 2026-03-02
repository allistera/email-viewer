## 2025-10-26 - Keyboard Accessibility in Lists
**Learning:** Interactive lists (like message lists) often use `div`s with click handlers but miss keyboard accessibility attributes. Adding `role="button"`, `tabindex="0"`, and `keydown` handlers is crucial. Playwright tests for frontend need API mocking.
**Action:** Always check `v-for` lists for interactivity and add keyboard support. Use `page.route` in Playwright to mock backend responses.

## 2025-10-27 - Dynamic ARIA Labels for Search Inputs
**Learning:** Search inputs often change their placeholder based on context (e.g., "Search in Inbox", "Search in Archive"). A static `aria-label="Search"` might not convey this important context to screen reader users. Binding the `aria-label` to the same dynamic value as the placeholder ensures parity between visual and auditory experiences.
**Action:** Always bind `:aria-label` to the dynamic placeholder property when the search context changes, ensuring assistive technologies announce the specific scope of the search.
