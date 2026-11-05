CREATE TABLE support_category (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 normalized_name TEXT NOT NULL UNIQUE,
 is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1))
);
--> statement-breakpoint
CREATE TABLE support_priority (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 normalized_name TEXT NOT NULL UNIQUE,
 is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1))
);
--> statement-breakpoint
INSERT INTO support_category VALUES('general','General','general',1);
--> statement-breakpoint
INSERT INTO support_priority VALUES('normal','Normal','normal',1);
--> statement-breakpoint
CREATE TABLE support_ticket (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 subject TEXT NOT NULL,
 category_id TEXT NOT NULL REFERENCES support_category(id) ON DELETE RESTRICT,
 priority_id TEXT NOT NULL REFERENCES support_priority(id) ON DELETE RESTRICT,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 member_read_sequence INTEGER NOT NULL DEFAULT 0,
 last_staff_sequence INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX support_ticket_owner ON support_ticket(user_id,updated_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX support_ticket_open ON support_ticket(user_id,state);
--> statement-breakpoint
CREATE INDEX support_ticket_inbox ON support_ticket(updated_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX support_ticket_category ON support_ticket(category_id);
--> statement-breakpoint
CREATE INDEX support_ticket_priority ON support_ticket(priority_id);
--> statement-breakpoint
CREATE TABLE support_message (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 ticket_id TEXT NOT NULL REFERENCES support_ticket(id) ON DELETE CASCADE,
 author_kind TEXT NOT NULL CHECK(author_kind IN ('member','staff')),
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX support_message_conversation ON support_message(ticket_id,sequence);
--> statement-breakpoint
CREATE TABLE support_receipt (
 nonce TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 ticket_id TEXT REFERENCES support_ticket(id) ON DELETE CASCADE,
 result_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(user_id,request_id)
);
--> statement-breakpoint
CREATE TABLE support_limit (
 nonce TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX support_limit_window ON support_limit(user_id,kind,created_at);
--> statement-breakpoint
CREATE INDEX support_limit_expiry ON support_limit(expires_at);
