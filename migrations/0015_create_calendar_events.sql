-- Calendar events table
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  all_day INTEGER DEFAULT 0,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_end ON calendar_events(end_time);
