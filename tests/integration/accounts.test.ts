import { abandonRanked } from '../../src/lib/server/ranked-session.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { createAuth, type AuthSettings } from '../../src/lib/server/auth.js';
import { createDatabase } from '../../src/lib/server/db/index.js';
import * as schema from '../../src/lib/server/db/schema.js';
import { findPlayer, savePlayerName, validatePlayerName } from '../../src/lib/server/players.js';
import { deleteAccountForPrivacy, pruneExpiredRecords } from '../../src/lib/server/retention.js';
import {
	accountHistory,
	digest,
	leaderboard,
	saveRun,
	startRanked
} from '../../src/lib/server/runs.js';
import { catalog } from '../../src/lib/catalog.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { utcDate } from '../../src/lib/server/daily.js';

const settings: AuthSettings = {
	baseURL: 'http://localhost:5173',
	secret: 'integration-only-secret-not-used-by-any-app-configuration',
	googleClientId: 'integration-client',
	googleClientSecret: 'integration-secret'
};
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;

function testAuth() {
	// Privileged test helpers exist only in this test process, never in the app.
	return betterAuth({ ...createAuth(proxy.env.DB, settings).options, plugins: [testUtils()] });
}

async function newUser() {
	const auth = testAuth();
	const helpers = (await auth.$context).test;
	const user = await helpers.saveUser(
		helpers.createUser({
			email: `${crypto.randomUUID()}@example.test`,
			name: 'Private Google Name'
		})
	);
	const login = await helpers.login({ userId: user.id });
	return { user, login, auth };
}

async function request(
	auth: ReturnType<typeof testAuth>,
	path: string,
	body?: Record<string, unknown>,
	headers = new Headers()
) {
	headers.set('origin', settings.baseURL);
	if (body) headers.set('content-type', 'application/json');
	return auth.handler(
		new Request(`${settings.baseURL}/api/auth/${path}`, {
			method: body ? 'POST' : 'GET',
			headers,
			body: body ? JSON.stringify(body) : undefined
		})
	);
}

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	const files = (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort();
	for (const file of files) {
		const statements = (await readFile(`migrations/${file}`, 'utf8'))
			.split('--> statement-breakpoint')
			.map((part) => part.trim())
			.filter(Boolean);
		await proxy.env.DB.batch(statements.map((sql) => proxy.env.DB.prepare(sql)));
	}
});
afterAll(async () => {
	await proxy?.dispose();
});

describe('accounts against local D1 and Better Auth', () => {
	it('verifies signed sessions, rejects a modified cookie, and does not trust a user id header', async () => {
		const { user, login, auth } = await newUser();
		const valid = await request(auth, 'get-session', undefined, new Headers(login.headers));
		expect(((await valid.json()) as { user: { id: string } }).user.id).toBe(user.id);
		const tampered = new Headers(login.headers);
		tampered.set('cookie', `${tampered.get('cookie')}x`);
		expect(await (await request(auth, 'get-session', undefined, tampered)).json()).toBeNull();
		expect(
			await (
				await request(auth, 'get-session', undefined, new Headers({ 'x-user-id': user.id }))
			).json()
		).toBeNull();
	});

	it('keeps public names separate, resolves case-insensitive concurrent name claims, and isolates account edits', async () => {
		const first = await newUser();
		const second = await newUser();
		const name = `p_${crypto.randomUUID().slice(0, 8)}`;
		const results = await Promise.all([
			savePlayerName(proxy.env.DB, first.user.id, name),
			savePlayerName(proxy.env.DB, second.user.id, name.toUpperCase())
		]);
		expect(results.sort()).toEqual(['saved', 'taken']);
		const winner = (await findPlayer(proxy.env.DB, first.user.id)) ? first : second;
		const other = winner === first ? second : first;
		await savePlayerName(proxy.env.DB, other.user.id, `${name}_b`);
		await savePlayerName(proxy.env.DB, winner.user.id, `${name}_a`);
		expect((await findPlayer(proxy.env.DB, other.user.id))?.name).toBe(`${name}_b`);
		expect(
			(
				await createDatabase(proxy.env.DB)
					.select()
					.from(schema.user)
					.where(eq(schema.user.id, winner.user.id))
					.get()
			)?.name
		).toBe('Private Google Name');
	});

	it('rejects malformed and reserved public names', () => {
		expect(
			[null, {}, 'ab', 'x'.repeat(21), '<script>', 'admin', 'MORPHI', 'name with spaces'].map(
				validatePlayerName
			)
		).toEqual(Array(8).fill(null));
		expect(validatePlayerName('  Player_28  ')).toBe('Player_28');
	});

	it('revokes a signed-out session and refuses cross-origin state changes', async () => {
		const { login, auth } = await newUser();
		const hostile = new Headers(login.headers);
		hostile.set('origin', 'https://untrusted.example');
		hostile.set('content-type', 'application/json');
		const rejected = await auth.handler(
			new Request(`${settings.baseURL}/api/auth/sign-out`, {
				method: 'POST',
				headers: hostile,
				body: '{}'
			})
		);
		expect(rejected.status).toBe(403);
		const response = await request(auth, 'sign-out', {}, new Headers(login.headers));
		expect(response.status).toBe(200);
		expect(
			await (await request(auth, 'get-session', undefined, new Headers(login.headers))).json()
		).toBeNull();
	});

	it('rejects expired sessions and stale deletion, then removes fresh accounts and related data', async () => {
		const { user, login, auth } = await newUser();
		const db = createDatabase(proxy.env.DB);
		await savePlayerName(proxy.env.DB, user.id, `p_${crypto.randomUUID().slice(0, 8)}`);
		await db.insert(schema.account).values({
			id: crypto.randomUUID(),
			userId: user.id,
			accountId: user.id,
			providerId: 'google',
			createdAt: new Date(),
			updatedAt: new Date()
		});
		await db
			.update(schema.session)
			.set({ createdAt: new Date(Date.now() - 3600_000) })
			.where(eq(schema.session.id, login.session.id));
		expect((await request(auth, 'delete-user', {}, new Headers(login.headers))).status).toBe(400);
		expect(await findPlayer(proxy.env.DB, user.id)).toBeDefined();
		await db
			.update(schema.session)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(schema.session.id, login.session.id));
		expect(
			await (await request(auth, 'get-session', undefined, new Headers(login.headers))).json()
		).toBeNull();
		const fresh = await (await auth.$context).test.login({ userId: user.id });
		expect((await request(auth, 'delete-user', {}, new Headers(fresh.headers))).status).toBe(200);
		expect(
			await db.select().from(schema.user).where(eq(schema.user.id, user.id)).get()
		).toBeUndefined();
		expect(
			await db.select().from(schema.account).where(eq(schema.account.userId, user.id))
		).toEqual([]);
		expect(
			await db.select().from(schema.session).where(eq(schema.session.userId, user.id))
		).toEqual([]);
		expect(await findPlayer(proxy.env.DB, user.id)).toBeUndefined();
	});

	it('disables password registration and creates a Google authorization request without contacting Google', async () => {
		const auth = testAuth();
		expect(
			(
				await request(auth, 'sign-up/email', {
					name: 'Test',
					email: 'unused@example.test',
					password: 'example-password-long'
				})
			).status
		).not.toBe(200);
		const response = await request(auth, 'sign-in/social', {
			provider: 'google',
			callbackURL: '/account',
			errorCallbackURL: '/account/sign-in?error=oauth'
		});
		expect(response.status).toBe(200);
		const result = (await response.json()) as { url: string };
		const url = new URL(result.url);
		expect(url.origin).toBe('https://accounts.google.com');
		expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual([
			'email',
			'openid',
			'profile'
		]);
		expect(url.searchParams.get('access_type')).toBe('online');
		expect(auth.options.account?.encryptOAuthTokens).toBe(true);
		expect(url.searchParams.get('redirect_uri')).toBe(
			`${settings.baseURL}/api/auth/callback/google`
		);
		expect(response.headers.get('set-cookie')).toContain('HttpOnly');
	});

	it('prunes expired operational data without reviving superseded starts or losing claimed retries', async () => {
		const { user, login } = await newUser();
		const db = createDatabase(proxy.env.DB);
		const actor = crypto.randomUUID();
		await db.insert(schema.adminActor).values({ id: actor, role: 'admin' });
		const moderator = crypto.randomUUID();
		await db.insert(schema.adminActor).values({ id: moderator, role: 'moderator' });
		await expect(pruneExpiredRecords(proxy.env.DB, moderator)).rejects.toMatchObject({
			status: 403
		});
		await savePlayerName(proxy.env.DB, user.id, `p_${user.id.slice(0, 8)}`);
		const now = Date.now();
		await db
			.update(schema.session)
			.set({ expiresAt: new Date(now - 1) })
			.where(eq(schema.session.id, login.session.id));
		const active = await (await testAuth().$context).test.login({ userId: user.id });
		const expiredState = crypto.randomUUID(),
			activeState = crypto.randomUUID();
		await db.insert(schema.verification).values([
			{
				id: expiredState,
				identifier: expiredState,
				value: 'fixture',
				expiresAt: new Date(now - 1),
				createdAt: new Date(),
				updatedAt: new Date()
			},
			{
				id: activeState,
				identifier: activeState,
				value: 'fixture',
				expiresAt: new Date(now + 600_000),
				createdAt: new Date(),
				updatedAt: new Date()
			}
		]);
		const oldRate = crypto.randomUUID(),
			currentRate = crypto.randomUUID();
		await db.insert(schema.rateLimit).values([
			{ id: oldRate, key: oldRate, count: 1, lastRequest: now - 86_400_001 },
			{ id: currentRate, key: currentRate, count: 1, lastRequest: now }
		]);
		const old = now - 10_800_000;
		const committed = await startRanked(proxy.env.DB, user.id, 'memory', 'old-ip', old);
		const run = solvedMemory(committed.seed, committed.id);
		const saved = await saveRun(proxy.env.DB, user.id, run, old + 30_000);
		const unused = await startRanked(proxy.env.DB, user.id, 'memory', 'old-ip', old + 60_000);
		await abandonRanked(proxy.env.DB, user.id, unused.id, old + 61_000);
		const unresolved = await startRanked(proxy.env.DB, user.id, 'memory', 'old-ip', old + 120_000);
		const recovery = solvedMemory(unresolved.seed, unresolved.id);
		await db
			.update(schema.playSession)
			.set({ payloadHash: await digest(JSON.stringify(recovery)), claimedAt: old + 150_000 })
			.where(eq(schema.playSession.id, unresolved.id));
		const superseded = await startRanked(proxy.env.DB, user.id, 'memory', 'current-ip', now - 2000);
		const latest = await startRanked(
			proxy.env.DB,
			user.id,
			'memory',
			'current-ip',
			now - 1000,
			superseded.id
		);
		await saveRun(proxy.env.DB, user.id, solvedMemory(latest.seed, latest.id), now + 30_000);
		await proxy.env.DB.prepare(
			`CREATE TRIGGER reject_retention_audit BEFORE INSERT ON admin_audit
			WHEN NEW.action = 'prune-expired' BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END`
		).run();
		await expect(pruneExpiredRecords(proxy.env.DB, actor, now + 31_000)).rejects.toBeDefined();
		expect(
			await db.select().from(schema.session).where(eq(schema.session.id, login.session.id))
		).toHaveLength(1);
		await proxy.env.DB.prepare('DROP TRIGGER reject_retention_audit').run();
		await pruneExpiredRecords(proxy.env.DB, actor, now + 31_000);
		expect(
			await db.select().from(schema.session).where(eq(schema.session.id, login.session.id))
		).toEqual([]);
		expect(
			await db.select().from(schema.session).where(eq(schema.session.id, active.session.id))
		).toHaveLength(1);
		expect(
			await db.select().from(schema.verification).where(eq(schema.verification.id, expiredState))
		).toEqual([]);
		expect(
			await db.select().from(schema.verification).where(eq(schema.verification.id, activeState))
		).toHaveLength(1);
		expect(
			await db.select().from(schema.rateLimit).where(eq(schema.rateLimit.id, oldRate))
		).toEqual([]);
		expect(
			await db.select().from(schema.rateLimit).where(eq(schema.rateLimit.id, currentRate))
		).toHaveLength(1);
		for (const id of [committed.id, unused.id])
			expect(
				await db.select().from(schema.playSession).where(eq(schema.playSession.id, id))
			).toEqual([]);
		expect(
			(
				await db
					.select()
					.from(schema.playSession)
					.where(eq(schema.playSession.id, unresolved.id))
					.get()
			)?.ipHash
		).toBe('');
		await expect(saveRun(proxy.env.DB, user.id, run, now + 32_000)).resolves.toEqual(saved);
		await expect(saveRun(proxy.env.DB, user.id, recovery, now + 32_000)).resolves.toMatchObject({
			ranked: true
		});
		await expect(
			saveRun(proxy.env.DB, user.id, solvedMemory(superseded.seed, superseded.id), now + 32_000)
		).rejects.toMatchObject({ status: 410 });
		expect(
			await db.select().from(schema.adminAudit).where(eq(schema.adminAudit.actor, actor))
		).toHaveLength(1);
	});

	it('audits authorized privacy deletion, revokes sessions, cascades private game data, and preserves separate records', async () => {
		const { user, login, auth } = await newUser();
		const other = await newUser();
		const db = createDatabase(proxy.env.DB);
		const actor = crypto.randomUUID(),
			support = crypto.randomUUID();
		await db.insert(schema.adminActor).values([
			{ id: actor, role: 'admin' },
			{ id: support, role: 'support' }
		]);
		await savePlayerName(proxy.env.DB, user.id, `p_${user.id.slice(0, 8)}`);
		await db.insert(schema.account).values({
			id: crypto.randomUUID(),
			userId: user.id,
			providerId: 'google',
			accountId: user.id,
			accessToken: 'fixture-only',
			idToken: 'fixture-id',
			scope: 'openid email profile',
			createdAt: new Date(),
			updatedAt: new Date()
		});
		const now = Date.now();
		const issued = await startRanked(proxy.env.DB, user.id, 'memory', 'fixture-ip', now);
		await saveRun(proxy.env.DB, user.id, solvedMemory(issued.seed, issued.id), now + 30_000);
		const publicBoard = await leaderboard(proxy.env.DB, 'memory', utcDate(now), user.id);
		expect(publicBoard.own).toBeNull();
		expect(publicBoard.rows).toEqual([]);
		expect(Object.keys(publicBoard).sort()).toEqual([
			'date',
			'family',
			'frozen',
			'own',
			'rows',
			'totalPlayers',
			'updatedAt'
		]);
		await db
			.insert(schema.playerBan)
			.values({ userId: user.id, reason: 'fixture', createdAt: now });
		const state = crypto.randomUUID();
		await db.insert(schema.verification).values({
			id: state,
			identifier: state,
			value: 'unlinked OAuth fixture',
			expiresAt: new Date(now + 600_000),
			createdAt: new Date(),
			updatedAt: new Date()
		});
		await expect(
			deleteAccountForPrivacy(proxy.env.DB, support, user.id, 'case_123')
		).rejects.toMatchObject({ status: 403 });
		await expect(
			deleteAccountForPrivacy(proxy.env.DB, actor, user.id, 'private@example.test')
		).rejects.toMatchObject({ code: 'request_reference' });
		await proxy.env.DB.prepare(
			`CREATE TRIGGER reject_privacy_audit BEFORE INSERT ON admin_audit
			WHEN NEW.action = 'privacy-delete' BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END`
		).run();
		await expect(
			deleteAccountForPrivacy(proxy.env.DB, actor, user.id, 'case_123')
		).rejects.toBeDefined();
		expect(await db.select().from(schema.user).where(eq(schema.user.id, user.id))).toHaveLength(1);
		await proxy.env.DB.prepare('DROP TRIGGER reject_privacy_audit').run();
		await deleteAccountForPrivacy(proxy.env.DB, actor, user.id, 'case_123');
		expect(await db.select().from(schema.user).where(eq(schema.user.id, user.id))).toEqual([]);
		for (const table of [
			schema.account,
			schema.session,
			schema.player,
			schema.playSession,
			schema.completedRun,
			schema.playerBan
		])
			expect(await db.select().from(table).where(eq(table.userId, user.id))).toEqual([]);
		expect(
			await (await request(auth, 'get-session', undefined, new Headers(login.headers))).json()
		).toBeNull();
		expect((await accountHistory(proxy.env.DB, user.id)).history).toEqual([]);
		expect((await leaderboard(proxy.env.DB, 'memory', utcDate(now), user.id)).own).toBeNull();
		expect(
			await db.select().from(schema.user).where(eq(schema.user.id, other.user.id))
		).toHaveLength(1);
		expect(
			await db.select().from(schema.verification).where(eq(schema.verification.id, state))
		).toHaveLength(1);
		const audit = await db
			.select()
			.from(schema.adminAudit)
			.where(eq(schema.adminAudit.actor, actor));
		expect(audit).toHaveLength(1);
		expect(audit[0]).toMatchObject({
			action: 'privacy-delete',
			target: user.id,
			reason: 'case_123',
			before: null,
			after: null
		});
	});
});

function solvedMemory(seed: string, id: string): CompletedRun {
	const round = catalog.memory.createRound(seed);
	return {
		version: 1,
		id,
		family: 'memory',
		engineVersion: 'memory-1',
		seed,
		moves: [...new Set(round.cards.map((card) => card.symbol))].flatMap((symbol) =>
			round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
		),
		elapsedSeconds: 10,
		rankedSession: id
	};
}
