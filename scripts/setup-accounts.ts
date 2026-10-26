import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';

const path = new URL('../.dev.vars', import.meta.url);
let existing = '';
try {
	existing = await readFile(path, 'utf8');
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const additions: string[] = [];
if (!/^BETTER_AUTH_SECRET\s*=/m.test(existing))
	additions.push(`BETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}`);
if (!/^GOOGLE_CLIENT_ID\s*=/m.test(existing)) additions.push('GOOGLE_CLIENT_ID=');
if (!/^GOOGLE_CLIENT_SECRET\s*=/m.test(existing)) additions.push('GOOGLE_CLIENT_SECRET=');
if (additions.length)
	await writeFile(
		path,
		`${existing}${existing.endsWith('\n') || !existing ? '' : '\n'}${additions.join('\n')}\n`,
		{ mode: 0o600 }
	);
await chmod(path, 0o600);
console.log(
	'Local account configuration is ready in ignored .dev.vars. Add your Google OAuth client ID and secret there. Existing values were preserved.'
);
