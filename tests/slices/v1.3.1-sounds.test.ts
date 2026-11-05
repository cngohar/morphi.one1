import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { generateSounds, sounds } from '../../scripts/generate-sounds.js';

const temporary: string[] = [];
const newKinds = ['trio-match', 'reshuffle', 'timer-tick'];
const source = Buffer.from('generated source');
const bytes = Buffer.from('processed audio');
const generated = { source, bytes, credits: 12 };
const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const read = (path: string) => readFileSync(path, 'utf8');

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), 'morphi-sounds-'));
	temporary.push(directory);
	const original = read('static/audio/manifest.json');
	writeFileSync(join(directory, 'manifest.json'), original);
	for (const [name] of sounds.slice(0, 22))
		writeFileSync(join(directory, `${name}.mp3`), `untouched ${name}`);
	return { directory, original };
}

afterEach(() => {
	for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

it('S1 preserves the entire manifest and publishes no partial assets after a later failure', async () => {
	const { directory, original } = fixture();
	const requested: string[] = [];
	await expect(
		generateSounds(directory, async ([name]) => {
			requested.push(name);
			if (name === 'reshuffle') throw new Error('forced generation failure');
			return generated;
		})
	).rejects.toThrow('forced generation failure');
	expect(requested).toEqual(['trio-match', 'reshuffle']);
	expect(read(join(directory, 'manifest.json'))).toBe(original);
	for (const name of newKinds) expect(existsSync(join(directory, `${name}.mp3`))).toBe(false);
	for (const [name] of sounds.slice(0, 22))
		expect(read(join(directory, `${name}.mp3`))).toBe(`untouched ${name}`);
});

it('S1 appends provenance without rewriting any existing entry or regenerating an existing file', async () => {
	const { directory, original } = fixture();
	const requested: string[] = [];
	await generateSounds(directory, async ([name]) => {
		requested.push(name);
		return generated;
	});
	const updated = read(join(directory, 'manifest.json'));
	const manifest = JSON.parse(updated);
	expect(requested).toEqual(newKinds);
	for (const [name] of sounds.slice(0, 22)) {
		const entry = new RegExp(`    "${name}": \\{[\\s\\S]*?\\n    \\}`);
		expect(updated.match(entry)?.[0]).toBe(original.match(entry)?.[0]);
		expect(read(join(directory, `${name}.mp3`))).toBe(`untouched ${name}`);
	}
	for (const name of newKinds) {
		expect(manifest.sounds[name]).toMatchObject({
			file: `${name}.mp3`,
			sha256: sha256(bytes),
			sourceSha256: sha256(source),
			credits: 12
		});
		expect(manifest.sounds[name].generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(readFileSync(join(directory, `${name}.mp3`))).toEqual(bytes);
	}
});

it('S3 maps every action to one static file and preloads each kind exactly once', () => {
	const runtime = read('src/lib/ui/sound.ts');
	const preloads = runtime.split('const kinds: SoundKind[] = [')[1]?.split('];')[0];
	const names = [...(preloads?.matchAll(/'([^']+)'/g) ?? [])].map((match) => match[1]);
	const manifest = JSON.parse(read('static/audio/manifest.json'));
	const actions = {
		memory: ['flip', 'match', 'mismatch', 'win', 'deal'],
		trios: ['flip', 'trio-match', 'mismatch', 'win', 'deal'],
		moving: ['flip', 'match', 'mismatch', 'reshuffle', 'win', 'deal'],
		block: ['pick', 'deselect', 'place', 'invalid', 'clear', 'combo', 'refill', 'end', 'deal'],
		rush: [
			'pick',
			'deselect',
			'place',
			'invalid',
			'clear',
			'combo',
			'refill',
			'end',
			'deal',
			'timer-tick'
		]
	};
	expect(names).toEqual(sounds.map(([name]) => name));
	expect(new Set(names).size).toBe(names.length);
	for (const name of Object.values(actions).flat()) {
		expect(names).toContain(name);
		expect(manifest.sounds[name].file).toBe(`${name}.mp3`);
		expect(existsSync(`static/audio/${name}.mp3`)).toBe(true);
	}
	expect(
		new Set(Object.values(manifest.sounds).map((entry) => (entry as { file: string }).file)).size
	).toBe(Object.keys(manifest.sounds).length);
	const memory = read('src/lib/puzzles/memory/Game.svelte');
	expect(memory).toContain("sound.play(trios ? 'trio-match' : 'match', matchStreak - 1)");
	expect(memory).toContain("if (memoryVariant(game) === 'memory:moving') sound.play('reshuffle')");
	expect(runtime).toContain("kind === 'trio-match'");
});
