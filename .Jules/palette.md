## 2026-02-19 - Custom Autocomplete Accessibility
**Learning:** Custom autocomplete inputs (like the recipients field) require manual management of `aria-haspopup`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` to be accessible to screen readers. Relying on default browser behavior is insufficient for custom listboxes.
**Action:** When implementing custom dropdowns, always ensure the input has `role="combobox"` (or `aria-haspopup="listbox"`) and explicitly links to the listbox ID via `aria-controls`, while managing focus via `aria-activedescendant`.
