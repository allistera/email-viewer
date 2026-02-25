## 2025-10-26 - Keyboard Accessibility in Lists
**Learning:** Interactive lists (like message lists) often use `div`s with click handlers but miss keyboard accessibility attributes. Adding `role="button"`, `tabindex="0"`, and `keydown` handlers is crucial. Playwright tests for frontend need API mocking.
**Action:** Always check `v-for` lists for interactivity and add keyboard support. Use `page.route` in Playwright to mock backend responses.

## 2025-10-27 - Dynamic Empty States
**Learning:** In list views (Inbox, Archive, Search), a single generic "No items" message is unhelpful. Context-aware empty states (e.g., "No matches for 'xyz'" vs "You're all caught up") provide necessary feedback and recovery paths (like "Clear Search").
**Action:** Implement computed properties for empty states that react to current filters/search terms, providing specific icons and actions.
