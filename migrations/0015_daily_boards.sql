-- New family/day boards start empty. Internal completed_run replay groups are untouched.
CREATE TABLE daily_puzzle (
 family TEXT NOT NULL,
 date TEXT NOT NULL,
 variant TEXT NOT NULL,
 seed TEXT NOT NULL,
 engine_version TEXT NOT NULL,
 score_config_version TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(family,date)
);
--> statement-breakpoint
CREATE INDEX daily_puzzle_recovery ON daily_puzzle(family,seed,engine_version,score_config_version);
--> statement-breakpoint
-- Retain opaque rank keys after account deletion; names always come from the live player join.
CREATE TABLE daily_best (
 family TEXT NOT NULL,
 date TEXT NOT NULL,
 user_id TEXT NOT NULL,
 score INTEGER NOT NULL,
 seconds INTEGER NOT NULL,
 moves INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(family,date,user_id)
);
--> statement-breakpoint
CREATE INDEX daily_best_board ON daily_best(family,date,score DESC,created_at,user_id);
--> statement-breakpoint
CREATE INDEX daily_best_owner ON daily_best(user_id,date DESC,family);
--> statement-breakpoint
CREATE TABLE daily_board_snapshot (
 family TEXT NOT NULL,
 date TEXT NOT NULL,
 top_json TEXT NOT NULL,
 total_players INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(family,date)
);
--> statement-breakpoint
CREATE TABLE streak (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 current INTEGER NOT NULL,
 longest INTEGER NOT NULL,
 last_date TEXT NOT NULL
);
