import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { responsePolicy } from '#lib/server/response-policy.js';
import { GET as sitemap } from '../../src/routes/sitemap.xml/+server.js';
import { catalog } from '#lib/catalog.js';
import { resumableRanked } from '#lib/server/ranked-session.js';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Slice 6 cache and SEO policy', () => {
	it('keeps generic UI and the game service free of known-family dispatch', () => {
		function files(path: string): string[] {
			return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory()
					? files(`${path}/${entry.name}`)
					: /\.(svelte|ts)$/.test(entry.name)
						? [`${path}/${entry.name}`]
						: []
			);
		}
		const family = `(?:${Object.keys(catalog).join('|')})`;
		const branch = new RegExp(
			`\\b(?:family|game|id)\\s*(?:===?|!==?)\\s*['"]${family}['"]|['"]${family}['"]\\s*(?:===?|!==?)\\s*\\w*(?:family|game|id)\\b`
		);
		for (const path of [
			...files('src/lib/screens'),
			...files('src/lib/components'),
			...files('src/routes/admin'),
			'src/lib/ui/puzzle-backdrop.ts',
			'src/lib/server/games.ts'
		])
			expect(source(path), path).not.toMatch(branch);
	});
	it.each([
		'/account',
		'/admin/games',
		'/auth',
		'/api/play/start',
		'/api/play/active',
		'/api/progress',
		'/leaderboard'
	])('keeps %s private and out of indexes, including errors', (path) => {
		const response = Response.json(
			{ code: 'unavailable' },
			{ status: 503, headers: { Vary: 'Accept-Encoding' } }
		);
		responsePolicy(response, path, false);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
		expect(response.headers.get('Vary')).toBe('Accept-Encoding, Cookie');
	});
	it('never publicly caches HTML or an authenticated response', () => {
		for (const [type, personal] of [
			['text/html', false],
			['application/json', true]
		] as const) {
			const response = new Response('', {
				headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600', Vary: 'Cookie' }
			});
			responsePolicy(response, '/', personal);
			expect(response.headers.get('Cache-Control')).toBe('private, no-store');
			expect(response.headers.get('Vary')).toBe('Cookie');
			expect(response.headers.has('X-Robots-Tag')).toBe(false);
		}
	});
	it.each(['/play', '/play/seed/12', '/share/12', '/seed/12', '/s/12'])(
		'excludes %s from indexing',
		(path) => {
			const response = new Response('');
			responsePolicy(response, path, false);
			expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
		}
	);
	it('retains only prerendered content routes in the sitemap', async () => {
		const paths = ['/', '/privacy', '/terms', '/how-it-works', '/about', '/faq'];
		const xml = await sitemap().text();
		expect(
			[...xml.matchAll(/<loc>https:\/\/morphi.one([^<]*)<\/loc>/g)].map((match) => match[1])
		).toEqual(paths);
		for (const path of paths) {
			expect(source(`src/routes/${path === '/' ? '' : path.slice(1) + '/'}+page.ts`)).toContain(
				'prerender = true'
			);
		}
		expect(source('src/lib/screens/HomeScreen.svelte').match(/<h1\b/g)).toHaveLength(1);
		expect(source('src/lib/components/Seo.svelte')).toContain('https://morphi.one${path}');
		expect(source('src/lib/components/Seo.svelte')).toContain('property="og:image"');
		expect(source('src/routes/play/+page.svelte')).toContain('name="robots" content="noindex"');
	});
	it('caches static media for a week and uses adapter-generated immutable asset headers in the guest artifact', () => {
		const headers = source('_headers');
		expect(headers).toContain('/audio/*\n  Cache-Control: public, max-age=604800');
		expect(headers).toContain('/og/*\n  Cache-Control: public, max-age=604800');
		expect(source('scripts/prepare-public-privacy.ts')).toContain(
			"readFile('.svelte-kit/cloudflare/_headers'"
		);
	});
	it('idle-loads only a peeked eligible family without issuing ranked starts or consuming rotation', () => {
		const preload = source('src/lib/ui/idle-preload.ts');
		expect(preload).toContain('selector.peek()');
		expect(preload).toContain('eligibleFamilies(');
		expect(preload).toContain('puzzleViews[family]()');
		expect(preload).toContain('puzzlePools[family]()');
		expect(preload).not.toContain('selector.next(');
		expect(preload).not.toContain('/api/play/start');
		const home = source('src/lib/screens/HomeScreen.svelte');
		expect(home).toContain('requestIdleCallback(preload)');
		expect(home).toContain('connection?.saveData');
		expect(home).toContain("['slow-2g', '2g']");
	});
});

describe('Slice 6 ranked recovery isolation', () => {
	function binding(row: Record<string, unknown> | null, active = true) {
		const first = vi
			.fn()
			.mockResolvedValueOnce(active ? { id: 'owner' } : null)
			.mockResolvedValueOnce(row);
		const bind = vi.fn().mockReturnValue({ first });
		const prepare = vi.fn().mockReturnValue({ bind });
		return { db: { prepare } as unknown as D1Database, prepare, bind };
	}
	it('reads only the current account and preserves its original seed and scoring version', async () => {
		const family = Object.keys(catalog)[0];
		const { db, prepare, bind } = binding({
			id: 'session',
			family,
			seed: '12',
			engineVersion: catalog[family].engineVersion,
			startedAt: 100,
			expiresAt: 10000,
			themeSnapshot: '{"seed":"12"}',
			scoreVersion: catalog[family].scoring.version,
			saving: 0
		});
		const result = await resumableRanked(db, 'owner', 200);
		expect(result).toMatchObject({
			id: 'session',
			family,
			seed: '12',
			startedAt: 100,
			saving: false,
			theme: { seed: '12' }
		});
		expect(bind).toHaveBeenNthCalledWith(2, 'owner', 200);
		expect(prepare.mock.calls[1][0]).toContain('abandoned_at IS NULL AND expires_at>?');
		expect(prepare.mock.calls[1][0]).toContain('completed_run');
	});
	it('offers a saving conflict without exposing seed data or allowing replacement', async () => {
		const { db } = binding({ id: 'saving', expiresAt: 1000, saving: 1, seed: 'secret' });
		expect(await resumableRanked(db, 'owner', 200)).toEqual({
			id: 'saving',
			expiresAt: 1000,
			saving: true
		});
	});
	it('rejects inactive accounts and exposes only an abandonable lock for incompatible engines', async () => {
		const inactive = binding(null, false);
		await expect(resumableRanked(inactive.db, 'owner')).rejects.toThrow('unavailable');
		expect(inactive.prepare).toHaveBeenCalledTimes(1);
		const { db } = binding({
			id: 'old',
			family: Object.keys(catalog)[0],
			engineVersion: 'old',
			expiresAt: 1234,
			saving: 0
		});
		expect(await resumableRanked(db, 'owner')).toEqual({
			id: 'old',
			expiresAt: 1234,
			saving: false
		});
	});
});
