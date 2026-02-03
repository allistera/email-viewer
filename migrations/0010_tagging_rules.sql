-- Tagging rules allow users to create custom tag matching rules
-- These rules take priority over AI classification

CREATE TABLE IF NOT EXISTS tagging_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- Match conditions (all non-null conditions must match)
    match_from TEXT,         -- Match sender email/name (contains, case-insensitive)
    match_to TEXT,           -- Match recipient email/name (contains, case-insensitive)
    match_subject TEXT,      -- Match subject (contains, case-insensitive)
    match_body TEXT,         -- Match body content (contains, case-insensitive)
    -- Action
    tag_name TEXT NOT NULL,  -- Tag to apply when rule matches
    -- Metadata
    priority INTEGER DEFAULT 0,  -- Higher priority rules are checked first
    is_enabled INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tagging_rules_enabled_priority
ON tagging_rules (is_enabled, priority DESC);
