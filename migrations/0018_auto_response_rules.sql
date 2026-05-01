-- Auto-response rules: send templated replies when an inbound email matches criteria.

CREATE TABLE IF NOT EXISTS auto_response_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- Match conditions (all non-null conditions must match)
    match_tag TEXT,           -- Match if message has this tag (case-insensitive)
    match_text TEXT,          -- Substring match against subject + body (case-insensitive)
    -- Reply template
    reply_subject TEXT,       -- Optional override; defaults to "Re: <original subject>"
    reply_body TEXT NOT NULL,
    -- Metadata
    is_enabled INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_response_rules_enabled
ON auto_response_rules (is_enabled);
