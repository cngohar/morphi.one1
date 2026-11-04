import { readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function savePerformanceCheckpoint(path: string, checkpoint: unknown) {
	const temporary = `${path}.${process.pid}.tmp`;
	await writeFile(temporary, JSON.stringify(checkpoint, null, 2) + '\n');
	await rename(temporary, path);
}

export async function loadPerformanceCheckpoint<T extends { fingerprint: string }>(
	path: string,
	fingerprint: string
): Promise<T | null> {
	let contents: string;
	try {
		contents = await readFile(path, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
	try {
		const saved: unknown = JSON.parse(contents);
		if (
			saved &&
			typeof saved === 'object' &&
			'fingerprint' in saved &&
			saved.fingerprint === fingerprint
		)
			return saved as T;
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
	}
	const stale = path.replace(/\.json$/, '') + `.stale-${randomUUID()}.json`;
	await rename(path, stale);
	console.info(`Preserved mismatched or unreadable performance checkpoint: ${stale}`);
	return null;
}
