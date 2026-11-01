CREATE TABLE `score_config` (
	`version` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`parent` text NOT NULL,
	`values_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `score_parent` ON `score_config` (`family`,`parent`);--> statement-breakpoint
CREATE TABLE `score_live` (
	`family` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	FOREIGN KEY (`version`) REFERENCES `score_config`(`version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `completed_run` ADD `score_config_version` text DEFAULT 'brief-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `play_session` ADD `score_config_version` text DEFAULT 'brief-v1' NOT NULL;--> statement-breakpoint
CREATE TRIGGER score_config_no_update BEFORE UPDATE ON score_config BEGIN SELECT RAISE(ABORT,'immutable score config'); END;
--> statement-breakpoint
CREATE TRIGGER score_config_no_delete BEFORE DELETE ON score_config BEGIN SELECT RAISE(ABORT,'immutable score config'); END;
