# Roadmap & Tasks

## Future Improvements

- [ ] **Search**: Implement full-text search (using D1 `LIKE` or a dedicated search index).
- [ ] **Retention Policy**: Add a cron trigger to delete emails (and R2 objects) older than N days.
- [ ] **Multi-User**: Update schema and auth to support multiple inboxes.
- [ ] **Reply/Send**: Integrate with an outbound SMTP provider (e.g. MailChannels or AWS SES) to allow replying.
- [x] **PWA**: Add a manifest.json and Service Worker to make it installable.
- [x] **iOS Push Notifications**: Send push notifications when new emails arrive via ntfy.

## Completed

- [x] Initial Architecture (D1, R2, DO)
- [x] Ingestion Pipeline (Email Routing -> Worker -> D1/R2)
- [x] Authentication (Bearer Token)
- [x] Spam Classification (OpenAI)
- [x] Realtime Updates (SSE)
- [x] UI Implementation (Vue.js) - *Todoist Design + Nested Folder Navigation*
