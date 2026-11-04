import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

const base = '1303c9c4bdb1718bb558886dc43b7b48c597a02a';

// Retrospective integrity check; cannot establish that the pre-Slice-1 HEAD gate ran.
it('keeps the annotated owner-confirmed base tag at the frozen acceptance commit', () => {
	const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
	expect(git('cat-file', '-t', 'v1.2-local-complete')).toBe('tag');
	expect(git('rev-parse', 'v1.2-local-complete^{commit}')).toBe(base);
	expect(git('merge-base', base, 'HEAD')).toBe(base);
	expect(git('show', '-s', '--format=%s', base)).toBe('Record combined local acceptance');
});
