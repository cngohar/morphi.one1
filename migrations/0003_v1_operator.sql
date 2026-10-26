CREATE TABLE admin_web_operator (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 secret_cipher TEXT NOT NULL,
 last_step INTEGER NOT NULL DEFAULT -1,
 failures INTEGER NOT NULL DEFAULT 0,
 locked_until INTEGER NOT NULL DEFAULT 0,
 auth_nonce TEXT
);
--> statement-breakpoint
CREATE TABLE admin_web_session (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES admin_web_operator(user_id) ON DELETE CASCADE,
 auth_session TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 last_seen INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_recovery (
 code_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES admin_web_operator(user_id) ON DELETE CASCADE,
 used_nonce TEXT
);
--> statement-breakpoint
CREATE TABLE admin_web_limit (key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE moderation_case (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('username','score')),
 target TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('open','resolved')),
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER protect_web_admin_delete BEFORE DELETE ON user
WHEN EXISTS(SELECT 1 FROM admin_web_operator o JOIN admin_actor a ON a.id=o.user_id WHERE o.user_id=OLD.id AND a.role='admin')
BEGIN SELECT RAISE(ABORT,'operator_account_requires_protected_removal'); END;
--> statement-breakpoint
CREATE TRIGGER protect_last_web_admin_role BEFORE UPDATE OF role ON admin_actor
WHEN OLD.role='admin' AND NEW.role!='admin' AND EXISTS(SELECT 1 FROM admin_web_operator WHERE user_id=OLD.id)
AND (SELECT count(*) FROM admin_actor a JOIN admin_web_operator o ON o.user_id=a.id WHERE a.role='admin')<=1
BEGIN SELECT RAISE(ABORT,'last_admin'); END;
--> statement-breakpoint
CREATE TRIGGER protect_last_web_admin_actor BEFORE DELETE ON admin_actor
WHEN OLD.role='admin' AND EXISTS(SELECT 1 FROM admin_web_operator WHERE user_id=OLD.id)
AND (SELECT count(*) FROM admin_actor a JOIN admin_web_operator o ON o.user_id=a.id WHERE a.role='admin')<=1
BEGIN SELECT RAISE(ABORT,'last_admin'); END;
