-- Drafts are immutable review artifacts. Publishing atomically advances the live pointer.
CREATE TABLE theme_draft (
  id TEXT PRIMARY KEY NOT NULL,
  base_version TEXT NOT NULL,
  values_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER theme_draft_no_update BEFORE UPDATE ON theme_draft BEGIN SELECT RAISE(ABORT,'immutable theme draft'); END;
--> statement-breakpoint
CREATE TRIGGER theme_draft_no_delete BEFORE DELETE ON theme_draft BEGIN SELECT RAISE(ABORT,'immutable theme draft'); END;
--> statement-breakpoint
-- A stale publisher cannot create a second child of the same live version.
CREATE UNIQUE INDEX theme_parent ON theme_config(parent);
