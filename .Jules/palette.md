## 2025-02-18 - Contextual Empty States & Keyboard Traps
**Learning:** Lists implemented as clickable `div`s create invisible keyboard traps. Adding `role="button"` and `tabindex="0"` is a low-effort, high-impact fix. Furthermore, generic "No results" messages are missed opportunities for delight; contextual messages (e.g., "Hooray! No spam here") reinforce system status and user success.
**Action:** When auditing lists, check for `tabindex` on interactive items and replace generic empty states with context-aware messaging.
