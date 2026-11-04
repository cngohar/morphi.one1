import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

// Better Auth core fields, including its database-backed rate limiter.
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_user_id').on(table.userId)]
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		index('account_user_id').on(table.userId),
		uniqueIndex('account_provider_identity').on(table.providerId, table.accountId)
	]
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('verification_identifier').on(table.identifier)]
);

export const rateLimit = sqliteTable('rate_limit', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: integer('last_request').notNull()
});

// The public player name is deliberately separate from Google's private profile.
export const player = sqliteTable('player', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	normalizedName: text('normalized_name').notNull().unique(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});

export const playSession = sqliteTable(
	'play_session',
	{
		sequence: integer('sequence').primaryKey({ autoIncrement: true }),
		id: text('id').notNull().unique(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		family: text('family').notNull(),
		variant: text('variant'),
		firstMoveAt: integer('first_move_at'),
		seed: text('seed').notNull(),
		engineVersion: text('engine_version').notNull(),
		scoreConfigVersion: text('score_config_version').notNull().default('brief-v1'),
		themeConfigVersion: text('theme_config_version').notNull().default('curated-v1'),
		themeGeneratorVersion: text('theme_generator_version').notNull().default('curated-v1'),
		themeSnapshot: text('theme_snapshot'),
		cardOpeningMs: integer('card_opening_ms').notNull().default(0),
		createdAt: integer('created_at').notNull(),
		expiresAt: integer('expires_at').notNull(),
		ipHash: text('ip_hash').notNull(),
		payloadHash: text('payload_hash'),
		claimedAt: integer('claimed_at'),
		abandonedAt: integer('abandoned_at')
	},
	(table) => [
		index('play_owner_family').on(table.userId, table.family, table.sequence),
		index('play_start_time').on(table.createdAt),
		index('play_ip_time').on(table.ipHash, table.createdAt),
		index('play_owner_expiry').on(table.userId, table.expiresAt)
	]
);

export const completedRun = sqliteTable(
	'completed_run',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		family: text('family').notNull(),
		engineVersion: text('engine_version').notNull(),
		scoreConfigVersion: text('score_config_version').notNull().default('brief-v1'),
		themeConfigVersion: text('theme_config_version').notNull().default('curated-v1'),
		themeGeneratorVersion: text('theme_generator_version').notNull().default('curated-v1'),
		themeSnapshot: text('theme_snapshot'),
		group: text('rules_group').notNull(),
		score: integer('score').notNull(),
		pairs: integer('pairs'),
		moves: integer('moves').notNull(),
		seconds: integer('seconds').notNull(),
		seed: text('seed').notNull(),
		moveLog: text('move_log').notNull(),
		payloadHash: text('payload_hash').notNull(),
		ranked: integer('ranked', { mode: 'boolean' }).notNull(),
		hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('run_owner_time').on(table.userId, table.createdAt),
		index('run_board').on(table.group, table.ranked, table.hidden, table.score, table.createdAt)
	]
);

export const playerBan = sqliteTable('player_ban', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	reason: text('reason').notNull(),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at')
});

export const userLifecycle = sqliteTable('user_lifecycle', {
	userId: text('user_id').primaryKey(),
	deletedAt: integer('deleted_at').notNull(),
	restoreUntil: integer('restore_until').notNull(),
	anonymizedAt: integer('anonymized_at'),
	operationId: text('operation_id').notNull()
});

export const accountActivity = sqliteTable('account_activity', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	trackingSince: integer('tracking_since').notNull(),
	lastActivityAt: integer('last_activity_at').notNull()
});
export const accountRoundActivity = sqliteTable(
	'account_round_activity',
	{
		runId: text('run_id').primaryKey(),
		ranked: integer('ranked', { mode: 'boolean' }).notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		family: text('family').notNull(),
		variant: text('variant'),
		firstMoveAt: integer('first_move_at'),
		startedAt: integer('started_at').notNull(),
		completedAt: integer('completed_at'),
		abandonedAt: integer('abandoned_at')
	},
	(table) => [index('account_round_owner_start').on(table.userId, table.startedAt)]
);

export const adminActor = sqliteTable('admin_actor', {
	id: text('id').primaryKey(),
	role: text('role', { enum: ['admin', 'moderator', 'support'] }).notNull()
});
export const adminAudit = sqliteTable('admin_audit', {
	id: text('id').primaryKey(),
	actor: text('actor').notNull(),
	action: text('action').notNull(),
	target: text('target').notNull(),
	reason: text('reason').notNull(),
	before: text('before'),
	after: text('after'),
	createdAt: integer('created_at').notNull()
});

export const siteControl = sqliteTable('site_control', {
	key: text('key').primaryKey(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull()
});

// Stage 1 local web operators. Enrollment is an OS/TOTP command, never a route.
export const adminWebOperator = sqliteTable('admin_web_operator', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'restrict' }),
	secretCipher: text('secret_cipher').notNull(),
	lastStep: integer('last_step').notNull().default(-1),
	failures: integer('failures').notNull().default(0),
	lockedUntil: integer('locked_until').notNull().default(0),
	authNonce: text('auth_nonce')
});
export const adminWebSession = sqliteTable('admin_web_session', {
	tokenHash: text('token_hash').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => adminWebOperator.userId, { onDelete: 'cascade' }),
	authSession: text('auth_session')
		.notNull()
		.references(() => session.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at').notNull(),
	lastSeen: integer('last_seen').notNull(),
	expiresAt: integer('expires_at').notNull()
});
export const adminRecovery = sqliteTable('admin_recovery', {
	codeHash: text('code_hash').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => adminWebOperator.userId, { onDelete: 'cascade' }),
	usedNonce: text('used_nonce')
});
export const adminWebLimit = sqliteTable('admin_web_limit', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	expiresAt: integer('expires_at').notNull()
});
export const moderationCase = sqliteTable('moderation_case', {
	id: text('id').primaryKey(),
	kind: text('kind', { enum: ['username', 'score'] }).notNull(),
	target: text('target').notNull(),
	state: text('state', { enum: ['open', 'resolved'] }).notNull(),
	createdAt: integer('created_at').notNull()
});
export const anonymousEvent = sqliteTable(
	'anonymous_event',
	{
		id: text('id').primaryKey(),
		visitor: text('visitor').notNull(),
		event: text('event', {
			enum: ['play_clicked', 'round_started', 'round_completed', 'next_clicked', 'error']
		}).notNull(),
		family: text('family'),
		code: text('code', { enum: ['start', 'save', 'view'] }),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('anonymous_event_time').on(table.createdAt),
		index('anonymous_event_visitor').on(table.visitor)
	]
);

export const scoreConfig = sqliteTable(
	'score_config',
	{
		version: text('version').primaryKey(),
		family: text('family').notNull(),
		parent: text('parent').notNull(),
		valuesJson: text('values_json').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(table) => [uniqueIndex('score_parent').on(table.family, table.parent)]
);
export const scoreLive = sqliteTable('score_live', {
	family: text('family').primaryKey(),
	version: text('version')
		.notNull()
		.references(() => scoreConfig.version)
});

export const gameLifecycle = sqliteTable('game_lifecycle', {
	family: text('family').primaryKey(),
	state: text('state', { enum: ['enabled', 'disabled', 'deleted', 'hard-deleted'] }).notNull(),
	restoreUntil: integer('restore_until')
});

// Family ids stay text: adding a manifest never requires a schema migration.
export const gameConfig = sqliteTable('game_config', {
	version: text('version').primaryKey(),
	family: text('family').notNull(),
	parent: text('parent').notNull(),
	valuesJson: text('values_json').notNull(),
	createdAt: integer('created_at').notNull()
});
export const themeConfig = sqliteTable('theme_config', {
	version: text('version').primaryKey(),
	parent: text('parent').notNull(),
	valuesJson: text('values_json').notNull(),
	createdAt: integer('created_at').notNull()
});
export const styleConfig = sqliteTable('style_config', {
	version: text('version').primaryKey(),
	family: text('family').notNull(),
	parent: text('parent').notNull(),
	valuesJson: text('values_json').notNull(),
	createdAt: integer('created_at').notNull()
});
export const configLive = sqliteTable('config_live', {
	key: text('key').primaryKey(),
	version: text('version').notNull()
});

export const themeDraft = sqliteTable('theme_draft', {
	id: text('id').primaryKey(),
	baseVersion: text('base_version').notNull(),
	valuesJson: text('values_json').notNull(),
	createdAt: integer('created_at').notNull()
});

export const variantLifecycle = sqliteTable(
	'variant_lifecycle',
	{
		family: text('family').notNull(),
		variant: text('variant').notNull(),
		state: text('state', { enum: ['enabled', 'disabled'] }).notNull(),
		reason: text('reason').notNull()
	},
	(table) => [primaryKey({ columns: [table.family, table.variant] })]
);
