CREATE TABLE `admin_actor` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`reason` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `completed_run` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`family` text NOT NULL,
	`engine_version` text NOT NULL,
	`rules_group` text NOT NULL,
	`score` integer NOT NULL,
	`pairs` integer,
	`moves` integer NOT NULL,
	`seconds` integer NOT NULL,
	`seed` text NOT NULL,
	`move_log` text NOT NULL,
	`payload_hash` text NOT NULL,
	`ranked` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_owner_time` ON `completed_run` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `run_board` ON `completed_run` (`rules_group`,`ranked`,`hidden`,`score`,`created_at`);--> statement-breakpoint
CREATE TABLE `play_session` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`family` text NOT NULL,
	`seed` text NOT NULL,
	`engine_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_hash` text NOT NULL,
	`payload_hash` text,
	`claimed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `play_session_id_unique` ON `play_session` (`id`);--> statement-breakpoint
CREATE INDEX `play_owner_family` ON `play_session` (`user_id`,`family`,`sequence`);--> statement-breakpoint
CREATE INDEX `play_start_time` ON `play_session` (`created_at`);--> statement-breakpoint
CREATE INDEX `play_ip_time` ON `play_session` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `player_ban` (
	`user_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
