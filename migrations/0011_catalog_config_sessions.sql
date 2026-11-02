-- Additive for one-release rollback: all old columns, rows and defaults remain.
-- New families are initialized from the catalog in code, never from SQL lists.
ALTER TABLE play_session ADD COLUMN abandoned_at INTEGER;
--> statement-breakpoint
-- Previously issued older tokens must not become valid again. Preserve claimed retries.
UPDATE play_session SET abandoned_at=(
  SELECT MAX(newer.created_at) FROM play_session newer
  WHERE newer.user_id=play_session.user_id AND newer.sequence>play_session.sequence
)
WHERE payload_hash IS NULL AND EXISTS (
  SELECT 1 FROM play_session newer
  WHERE newer.user_id=play_session.user_id AND newer.sequence>play_session.sequence
);
--> statement-breakpoint
CREATE INDEX play_owner_expiry ON play_session(user_id,expires_at);
--> statement-breakpoint
-- Drop the old two-family CHECK while preserving measurements and their other checks.
CREATE TABLE anonymous_event_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  visitor TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('play_clicked','round_started','round_completed','next_clicked','error')),
  family TEXT,
  code TEXT CHECK(code IS NULL OR code IN ('start','save','view')),
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
INSERT INTO anonymous_event_catalog SELECT id,visitor,event,family,code,created_at FROM anonymous_event;
--> statement-breakpoint
DROP TABLE anonymous_event;
--> statement-breakpoint
ALTER TABLE anonymous_event_catalog RENAME TO anonymous_event;
--> statement-breakpoint
CREATE INDEX anonymous_event_time ON anonymous_event(created_at);
--> statement-breakpoint
CREATE INDEX anonymous_event_visitor ON anonymous_event(visitor);
--> statement-breakpoint
CREATE TABLE game_config (
  version TEXT PRIMARY KEY NOT NULL,
  family TEXT NOT NULL,
  parent TEXT NOT NULL,
  values_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE theme_config (
  version TEXT PRIMARY KEY NOT NULL,
  parent TEXT NOT NULL,
  values_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE style_config (
  version TEXT PRIMARY KEY NOT NULL,
  family TEXT NOT NULL,
  parent TEXT NOT NULL,
  values_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE config_live (
  key TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER game_config_no_update BEFORE UPDATE ON game_config BEGIN SELECT RAISE(ABORT,'immutable game config'); END;
--> statement-breakpoint
CREATE TRIGGER game_config_no_delete BEFORE DELETE ON game_config BEGIN SELECT RAISE(ABORT,'immutable game config'); END;
--> statement-breakpoint
CREATE TRIGGER theme_config_no_update BEFORE UPDATE ON theme_config BEGIN SELECT RAISE(ABORT,'immutable theme config'); END;
--> statement-breakpoint
CREATE TRIGGER theme_config_no_delete BEFORE DELETE ON theme_config BEGIN SELECT RAISE(ABORT,'immutable theme config'); END;
--> statement-breakpoint
CREATE TRIGGER style_config_no_update BEFORE UPDATE ON style_config BEGIN SELECT RAISE(ABORT,'immutable style config'); END;
--> statement-breakpoint
CREATE TRIGGER style_config_no_delete BEFORE DELETE ON style_config BEGIN SELECT RAISE(ABORT,'immutable style config'); END;
