CREATE TABLE anonymous_event (
 id TEXT PRIMARY KEY NOT NULL,
 visitor TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('play_clicked','round_started','round_completed','next_clicked','error')),
 family TEXT CHECK(family IN ('block','memory')),
 code TEXT CHECK(code IS NULL OR code IN ('start','save','view')),
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX anonymous_event_time ON anonymous_event(created_at);
--> statement-breakpoint
CREATE INDEX anonymous_event_visitor ON anonymous_event(visitor);
