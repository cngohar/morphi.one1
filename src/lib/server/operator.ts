import { digest, RunError } from './runs.js';
import { can, type OperatorRole } from '../operator-permissions.js';
export { can, permissions } from '../operator-permissions.js';
export async function encryptOperatorSecret(secret: Uint8Array, applicationSecret: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(`operator-v1:${applicationSecret}`)
		),
		{ name: 'AES-GCM' },
		false,
		['encrypt']
	);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		new Uint8Array(secret)
	);
	return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}
async function decryptSecret(cipher: string, applicationSecret: string) {
	const { iv, data } = JSON.parse(cipher) as { iv: number[]; data: number[] };
	const key = await crypto.subtle.importKey(
		'raw',
		await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(`operator-v1:${applicationSecret}`)
		),
		{ name: 'AES-GCM' },
		false,
		['decrypt']
	);
	return new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: new Uint8Array(iv) },
			key,
			new Uint8Array(data)
		)
	);
}
export async function totpAt(secret: Uint8Array, step: number) {
	const key = await crypto.subtle.importKey(
		'raw',
		new Uint8Array(secret),
		{ name: 'HMAC', hash: 'SHA-1' },
		false,
		['sign']
	);
	const counter = new Uint8Array(8);
	new DataView(counter.buffer).setBigUint64(0, BigInt(step));
	const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter)),
		offset = hash[19]! & 15;
	return String((new DataView(hash.buffer).getUint32(offset) & 0x7fffffff) % 1000000).padStart(
		6,
		'0'
	);
}
export async function operatorLimit(db: D1Database, key: string, limit: number, now = Date.now()) {
	const bucket = Math.floor(now / 60000);
	const result = await db
		.prepare(
			'INSERT INTO admin_web_limit(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count'
		)
		.bind(`${bucket}:${key}`, now + 120000)
		.first<{ count: number }>();
	if (!result || result.count > limit) throw new RunError('operator_limit', 429);
}
export async function verifyOperator(
	db: D1Database,
	userId: string,
	authSession: string,
	code: string,
	recovery: boolean,
	applicationSecret: string,
	now = Date.now()
) {
	const operator = await db
		.prepare(
			'SELECT o.*,a.role FROM admin_web_operator o JOIN admin_actor a ON a.id=o.user_id WHERE user_id=?'
		)
		.bind(userId)
		.first<{ secret_cipher: string; last_step: number; locked_until: number; role: string }>();
	if (!operator || !can(operator.role, 'moderation')) throw new RunError('permission', 403);
	if (operator.locked_until > now) throw new RunError('operator_locked', 429);
	const nonce = crypto.randomUUID(),
		token = crypto.randomUUID() + crypto.randomUUID(),
		tokenHash = await digest(token);
	let step = -1;
	if (!recovery && /^\d{6}$/.test(code)) {
		const secret = await decryptSecret(operator.secret_cipher, applicationSecret);
		for (const shift of [-1, 0, 1]) {
			const candidate = Math.floor(now / 30000) + shift;
			if (
				candidate > operator.last_step &&
				(await equalCode(secret, await totpAt(secret, candidate), code))
			)
				step = candidate;
		}
	}
	const validRecovery =
		recovery && /^[a-f0-9]{32}$/.test(code) ? await digest(`recovery:${userId}:${code}`) : null;
	if (step < 0 && !validRecovery) {
		await failOperator(db, userId, now);
		throw new RunError('operator_code', 403);
	}
	const statements: D1PreparedStatement[] = [];
	if (validRecovery) {
		statements.push(
			db
				.prepare(
					'UPDATE admin_recovery SET used_nonce=? WHERE user_id=? AND code_hash=? AND used_nonce IS NULL'
				)
				.bind(nonce, userId, validRecovery)
		);
		statements.push(
			db
				.prepare(
					'UPDATE admin_web_operator SET auth_nonce=?,failures=0,locked_until=0 WHERE user_id=? AND locked_until<=? AND EXISTS(SELECT 1 FROM admin_recovery WHERE user_id=? AND used_nonce=?)'
				)
				.bind(nonce, userId, now, userId, nonce)
		);
	} else
		statements.push(
			db
				.prepare(
					'UPDATE admin_web_operator SET auth_nonce=?,last_step=?,failures=0,locked_until=0 WHERE user_id=? AND last_step<? AND locked_until<=?'
				)
				.bind(nonce, step, userId, step, now)
		);
	statements.push(
		db
			.prepare(
				'INSERT INTO admin_web_session(token_hash,user_id,auth_session,created_at,last_seen,expires_at) SELECT ?,user_id,?,?,?,? FROM admin_web_operator WHERE user_id=? AND auth_nonce=?'
			)
			.bind(tokenHash, authSession, now, now, now + 30 * 60000, userId, nonce)
	);
	statements.push(
		db
			.prepare(
				'INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) SELECT ?,user_id,?,user_id,?,NULL,NULL,? FROM admin_web_operator WHERE user_id=? AND auth_nonce=?'
			)
			.bind(
				crypto.randomUUID(),
				recovery ? 'operator-recovery' : 'operator-login',
				recovery ? 'Single-use recovery code' : 'Google and TOTP',
				now,
				userId,
				nonce
			)
	);
	const results = await db.batch(statements);
	if (results[results.length - 2]!.meta.changes !== 1) {
		await failOperator(db, userId, now);
		throw new RunError('operator_code', 403);
	}
	return token;
}
async function failOperator(db: D1Database, id: string, now: number) {
	await db.batch([
		db
			.prepare(
				'UPDATE admin_web_operator SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN ? ELSE locked_until END WHERE user_id=?'
			)
			.bind(now + 15 * 60000, id),
		db
			.prepare(
				"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'operator-login-denied',?,'Invalid or replayed second factor',NULL,NULL,?)"
			)
			.bind(crypto.randomUUID(), id, id, now)
	]);
}
export async function requireOperator(
	db: D1Database,
	identity: { userId: string; authSession: string; authCreatedAt: number; token: string },
	action: string,
	sensitive = false,
	now = Date.now()
) {
	const row = await db
		.prepare(
			'SELECT a.role,s.created_at FROM admin_web_session s JOIN admin_web_operator o ON o.user_id=s.user_id JOIN admin_actor a ON a.id=o.user_id WHERE s.token_hash=? AND s.user_id=? AND s.auth_session=? AND s.expires_at>? AND s.last_seen>?'
		)
		.bind(
			await digest(identity.token),
			identity.userId,
			identity.authSession,
			now,
			now - 10 * 60000
		)
		.first<{ role: OperatorRole; created_at: number }>();
	if (!row || !can(row.role, action)) throw new RunError('permission', 403);
	if (sensitive && (now - identity.authCreatedAt > 15 * 60000 || now - row.created_at > 15 * 60000))
		throw new RunError('operator_reauth', 403);
	await db
		.prepare('UPDATE admin_web_session SET last_seen=? WHERE token_hash=?')
		.bind(now, await digest(identity.token))
		.run();
	return { id: identity.userId, role: row.role };
}
export async function auditOperatorRead(
	db: D1Database,
	actor: string,
	action: string,
	target: string,
	now = Date.now()
) {
	await db
		.prepare(
			"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,?,?,'Operator review',NULL,NULL,?)"
		)
		.bind(crypto.randomUUID(), actor, action, target, now)
		.run();
}
/** Called only after the local OS administrator's TOTP challenge, never by a route. */
export async function enrollOperator(
	db: D1Database,
	actor: string,
	userId: string,
	expectedEmail: string,
	applicationSecret: string,
	secret: Uint8Array,
	recoveryCodes: string[],
	now = Date.now()
) {
	const permission = await db
		.prepare("SELECT id FROM admin_actor WHERE id=? AND role='admin'")
		.bind(actor)
		.first();
	const owner = await db
		.prepare('SELECT id FROM user WHERE id=? AND email=? AND email_verified=1')
		.bind(userId, expectedEmail)
		.first();
	if (!permission || !owner) throw new RunError('permission', 403);
	if (await db.prepare('SELECT user_id FROM admin_web_operator LIMIT 1').first())
		throw new RunError('already_enrolled', 409);
	const cipher = await encryptOperatorSecret(secret, applicationSecret);
	const statements = [
		db
			.prepare(
				"INSERT INTO admin_actor(id,role) VALUES(?,'admin') ON CONFLICT(id) DO UPDATE SET role='admin'"
			)
			.bind(userId),
		db
			.prepare('INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES(?,?)')
			.bind(userId, cipher)
	];
	for (const code of recoveryCodes)
		statements.push(
			db
				.prepare('INSERT INTO admin_recovery(code_hash,user_id) VALUES(?,?)')
				.bind(await digest(`recovery:${userId}:${code}`), userId)
		);
	statements.push(
		db
			.prepare(
				"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'operator-enroll',?,'Explicit OS-owner enrollment',NULL,?,?)"
			)
			.bind(crypto.randomUUID(), actor, userId, '{"role":"admin","twoFactor":true}', now)
	);
	await db.batch(statements);
}
/** Break-glass reset after local OS/TOTP verification. All existing grants are revoked. */
export async function resetOperator(
	db: D1Database,
	actor: string,
	userId: string,
	applicationSecret: string,
	secret: Uint8Array,
	codes: string[],
	now = Date.now()
) {
	if (
		!(await db
			.prepare("SELECT id FROM admin_actor WHERE id=? AND role='admin'")
			.bind(actor)
			.first())
	)
		throw new RunError('permission', 403);
	if (
		!(await db
			.prepare('SELECT user_id FROM admin_web_operator WHERE user_id=?')
			.bind(userId)
			.first())
	)
		throw new RunError('missing', 404);
	const statements = [
		db.prepare('DELETE FROM admin_web_session WHERE user_id=?').bind(userId),
		db.prepare('DELETE FROM admin_recovery WHERE user_id=?').bind(userId),
		db
			.prepare(
				'UPDATE admin_web_operator SET secret_cipher=?,last_step=-1,failures=0,locked_until=0,auth_nonce=NULL WHERE user_id=?'
			)
			.bind(await encryptOperatorSecret(secret, applicationSecret), userId)
	];
	for (const code of codes)
		statements.push(
			db
				.prepare('INSERT INTO admin_recovery(code_hash,user_id) VALUES(?,?)')
				.bind(await digest(`recovery:${userId}:${code}`), userId)
		);
	statements.push(
		db
			.prepare(
				"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'operator-reset',?,'OS-owner break-glass reset',NULL,NULL,?)"
			)
			.bind(crypto.randomUUID(), actor, userId, now)
	);
	await db.batch(statements);
}

async function equalCode(secret: Uint8Array, expected: string, provided: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new Uint8Array(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
	const encoder = new TextEncoder();
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected));
	return crypto.subtle.verify('HMAC', key, signature, encoder.encode(provided));
}
