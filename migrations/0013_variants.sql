-- Nullable ids preserve classic replay for sessions issued before variant support.
ALTER TABLE play_session ADD COLUMN variant TEXT;
--> statement-breakpoint
ALTER TABLE play_session ADD COLUMN first_move_at INTEGER;
--> statement-breakpoint
ALTER TABLE account_round_activity ADD COLUMN variant TEXT;
--> statement-breakpoint
ALTER TABLE account_round_activity ADD COLUMN first_move_at INTEGER;
--> statement-breakpoint
CREATE TABLE variant_lifecycle (
 family TEXT NOT NULL,
 variant TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('enabled','disabled')),
 reason TEXT NOT NULL,
 PRIMARY KEY(family,variant)
);
