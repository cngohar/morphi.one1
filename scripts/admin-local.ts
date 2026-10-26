import { enrollOperator, resetOperator } from '../src/lib/server/operator.js';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { getPlatformProxy } from 'wrangler';
import { eq } from 'drizzle-orm';
import { createDatabase } from '../src/lib/server/db/index.js';
import { adminActor, adminAudit, completedRun, player } from '../src/lib/server/db/schema.js';
import { moderate, type ModerationAction } from '../src/lib/server/moderation.js';
import { base32, verifyTotp } from '../src/lib/server/admin-totp.js';
import { deleteAccountForPrivacy, pruneExpiredRecords } from '../src/lib/server/retention.js';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (args.shift() !== '--local')
	throw new Error('This command requires --local and has no remote mode.');
const [command, target, ...reasonWords] = args;
const allowed = [
	'bootstrap',
	'enroll-web',
	'reset-web',
	'list-hidden',
	'ban',
	'unban',
	'hide',
	'restore',
	'ranked-on',
	'ranked-off',
	'prune-expired',
	'privacy-delete'
];
if (!command || !allowed.includes(command)) throw new Error(`Commands: ${allowed.join(', ')}`);
const config = await readFile('wrangler.jsonc', 'utf8');
if (!/"remote"\s*:\s*false/.test(config) || /"remote"\s*:\s*true/.test(config))
	throw new Error('Use the explicitly local D1 configuration.');
const actor = `local:${userInfo().username}`;
const keyFile = '.admin-local.json';
const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
try {
	const db = createDatabase(proxy.env.DB);
	if (command === 'bootstrap') {
		if ((await db.select().from(adminActor).limit(1)).length)
			throw new Error('A local administrator already exists.');
		const secret = crypto.getRandomValues(new Uint8Array(20));
		const uri = `otpauth://totp/Morphi%20local:${encodeURIComponent(actor)}?secret=${base32(secret)}&issuer=Morphi%20local`;
		await writeFile(
			keyFile,
			JSON.stringify({
				actor,
				secret: Buffer.from(secret).toString('hex'),
				authenticatorURI: uri
			}) + '\n',
			{ mode: 0o600, flag: 'wx' }
		);
		await db.batch([
			db.insert(adminActor).values({ id: actor, role: 'admin' }),
			db.insert(adminAudit).values({
				id: crypto.randomUUID(),
				actor,
				action: 'bootstrap-local',
				target: actor,
				reason: 'Explicit local OS-owner bootstrap',
				before: 'null',
				after: JSON.stringify({ role: 'admin' }),
				createdAt: Date.now()
			})
		]);
		console.info(
			'Local administrator created. Privately open .admin-local.json, enroll its authenticatorURI, then close it. Never share this file. Every operational command requires a current authenticator code.'
		);
	} else {
		if (!process.stdin.isTTY)
			throw new Error('Interactive terminal and authenticator code required.');
		if (((await stat(keyFile)).mode & 0o077) !== 0)
			throw new Error('The local admin key file must have mode 600.');
		const key = JSON.parse(await readFile(keyFile, 'utf8')) as { actor: string; secret: string };
		if (key.actor !== actor || !/^[0-9a-f]{40}$/.test(key.secret))
			throw new Error('Local OS identity does not match enrollment.');
		const prompt = createInterface({ input: process.stdin, output: process.stdout });
		let code: string;
		try {
			code = await prompt.question('Current authenticator code: ');
		} finally {
			prompt.close();
		}
		if (!verifyTotp(Buffer.from(key.secret, 'hex'), code.trim(), Date.now()))
			throw new Error('Authentication refused.');
		if (command === 'enroll-web' || command === 'reset-web') {
			if (!target || reasonWords.length) throw new Error('Provide the owner Google user id only.');
			const secret = crypto.getRandomValues(new Uint8Array(20)),
				codes = Array.from({ length: 8 }, () => crypto.randomUUID().replaceAll('-', ''));
			const artifact =
				command === 'reset-web' ? '.admin-web-reset.json' : '.admin-web-enrollment.json';
			await writeFile(
				artifact,
				JSON.stringify({
					authenticatorURI: `otpauth://totp/Morphi.One:${encodeURIComponent(target)}?secret=${base32(secret)}&issuer=Morphi.One`,
					recoveryCodes: codes
				}) + '\n',
				{ mode: 0o600, flag: 'wx' }
			);
			if (command === 'reset-web')
				await resetOperator(
					proxy.env.DB,
					actor,
					target,
					proxy.env.BETTER_AUTH_SECRET,
					secret,
					codes
				);
			else
				await enrollOperator(
					proxy.env.DB,
					actor,
					target,
					'cngohar@gmail.com',
					proxy.env.BETTER_AUTH_SECRET,
					secret,
					codes
				);
			console.info(
				'Local web operator enrolled. Privately open .admin-web-enrollment.json, add its authenticator URI and store the single-use recovery codes offline. Never share or commit this file.'
			);
		} else if (command === 'prune-expired') {
			if (target || reasonWords.length) throw new Error('prune-expired takes no extra arguments.');
			const changes = await pruneExpiredRecords(proxy.env.DB, actor);
			console.info(JSON.stringify({ event: 'local_retention_completed', changes }));
		} else if (command === 'privacy-delete') {
			if (!target || reasonWords.length !== 1)
				throw new Error('Provide an internal user id and one opaque request reference.');
			await deleteAccountForPrivacy(proxy.env.DB, actor, target, reasonWords[0]);
			console.info(
				'Local account deleted and audited; provider records and other devices are separate.'
			);
		} else if (command === 'list-hidden') {
			if (!(await db.select().from(adminActor).where(eq(adminActor.id, actor)).get()))
				throw new Error('Permission refused.');
			const rows = await db
				.select({ id: completedRun.id, group: completedRun.group, score: completedRun.score })
				.from(completedRun)
				.where(eq(completedRun.hidden, true))
				.limit(100);
			await db.insert(adminAudit).values({
				id: crypto.randomUUID(),
				actor,
				action: command,
				target: 'hidden-scores',
				reason: 'Local moderation review',
				before: null,
				after: null,
				createdAt: Date.now()
			});
			console.info(JSON.stringify(rows, null, 2));
		} else {
			if (!target) throw new Error('Provide a target and a reason.');
			let resolvedTarget = target;
			if (command === 'ban' || command === 'unban') {
				const found = await db
					.select({ id: player.userId })
					.from(player)
					.where(eq(player.normalizedName, target.toLowerCase()))
					.get();
				if (!found) throw new Error('Player not found.');
				resolvedTarget = found.id;
			}
			if (command.startsWith('ranked-') && target !== 'ranked')
				throw new Error('The flag target must be ranked.');
			await moderate(
				proxy.env.DB,
				actor,
				command as ModerationAction,
				resolvedTarget,
				reasonWords.join(' ')
			);
			console.info('Local action completed and audited.');
		}
	}
} finally {
	await proxy.dispose();
}
