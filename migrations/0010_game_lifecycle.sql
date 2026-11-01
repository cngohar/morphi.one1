CREATE TABLE game_lifecycle (
  family TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('enabled','disabled','deleted','hard-deleted')),
  restore_until INTEGER
);
--> statement-breakpoint
INSERT INTO game_lifecycle(family,state) VALUES ('block','enabled'),('memory','enabled'),('connect','enabled');
