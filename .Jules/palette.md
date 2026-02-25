## 2025-10-26 - Keyboard Accessibility in Lists
**Learning:** Interactive lists (like message lists) often use `div`s with click handlers but miss keyboard accessibility attributes. Adding `role="button"`, `tabindex="0"`, and `keydown` handlers is crucial. Playwright tests for frontend need API mocking.
**Action:** Always check `v-for` lists for interactivity and add keyboard support. Use `page.route` in Playwright to mock backend responses.
