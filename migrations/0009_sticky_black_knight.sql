CREATE TABLE `account_activity` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tracking_since` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `account_round_activity` (
	`run_id` text PRIMARY KEY NOT NULL,
	`ranked` integer NOT NULL,
	`user_id` text NOT NULL,
	`family` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`abandoned_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_round_owner_start` ON `account_round_activity` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `user_lifecycle` (
	`user_id` text PRIMARY KEY NOT NULL,
	`deleted_at` integer NOT NULL,
	`restore_until` integer NOT NULL,
	`anonymized_at` integer,
	`operation_id` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `player_ban` ADD `expires_at` integer;--> statement-breakpoint
CREATE TRIGGER admin_audit_no_update BEFORE UPDATE ON admin_audit
BEGIN SELECT RAISE(ABORT, 'audit_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER admin_audit_no_delete BEFORE DELETE ON admin_audit
BEGIN SELECT RAISE(ABORT, 'audit_immutable'); END;
--> statement-breakpoint
CREATE INDEX admin_audit_time ON admin_audit(created_at);
--> statement-breakpoint
DROP TRIGGER account_deletion_audit;
--> statement-breakpoint
CREATE TRIGGER account_deletion_audit AFTER DELETE ON user
WHEN NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=OLD.id)
BEGIN
 INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
 VALUES(lower(hex(randomblob(16))),'self-service','account-deleted',OLD.id,'Account deletion',NULL,NULL,CAST(unixepoch('subsec')*1000 AS INTEGER));
END;
--> statement-breakpoint
CREATE TRIGGER inactive_session_insert BEFORE INSERT ON session
WHEN EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'account_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER deleted_operator_insert BEFORE INSERT ON admin_web_operator
WHEN EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'account_unavailable'); END;
