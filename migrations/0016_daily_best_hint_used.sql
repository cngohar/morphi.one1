-- Board labels outlive the archived/deleted completed run and its move log.
ALTER TABLE daily_best ADD COLUMN hint_used INTEGER NOT NULL DEFAULT 0;
