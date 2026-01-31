-- Migration number: 0009 	 2026-01-31T00:00:00.000Z
-- Title: Add Todoist project info to messages

ALTER TABLE messages ADD COLUMN todoist_project_name TEXT;
ALTER TABLE messages ADD COLUMN todoist_project_url TEXT;
