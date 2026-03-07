## 2025-10-26 - Keyboard Accessibility in Lists
**Learning:** Interactive lists (like message lists) often use `div`s with click handlers but miss keyboard accessibility attributes. Adding `role="button"`, `tabindex="0"`, and `keydown` handlers is crucial. Playwright tests for frontend need API mocking.
**Action:** Always check `v-for` lists for interactivity and add keyboard support. Use `page.route` in Playwright to mock backend responses.

## 2025-10-27 - Dynamic ARIA Labels for Search Inputs
**Learning:** Search inputs often use placeholders to indicate their current search context. Hardcoded `aria-label` attributes do not reflect dynamic context changes. Binding `aria-label` dynamically to the placeholder property ensures screen readers accurately announce changing search contexts.
**Action:** Always bind `:aria-label` dynamically to the placeholder for search inputs that change context.
