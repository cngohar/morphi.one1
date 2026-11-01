ALTER TABLE `completed_run` ADD `theme_config_version` text DEFAULT 'curated-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `completed_run` ADD `theme_generator_version` text DEFAULT 'curated-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `completed_run` ADD `theme_snapshot` text;--> statement-breakpoint
ALTER TABLE `play_session` ADD `theme_config_version` text DEFAULT 'curated-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `play_session` ADD `theme_generator_version` text DEFAULT 'curated-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `play_session` ADD `theme_snapshot` text;