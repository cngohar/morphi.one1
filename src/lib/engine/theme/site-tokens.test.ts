import { describe, expect, it } from 'vitest';
import defaults from './site-tokens.json' with { type: 'json' };
import { THEME_CONFIG } from './config.js';
import { generateTheme } from './generator.js';
import { themeStyle } from './style.js';
import { siteTokenIssues, validateSiteTokens } from './site-tokens.js';

describe('site tokens', () => {
	it('accepts the existing safe CSS defaults and bounded cosmetic edits', () => {
		expect(validateSiteTokens(defaults)).toBe(true);
		expect(siteTokenIssues(defaults)).toEqual([]);
		expect(validateSiteTokens({ ...defaults, '--radius-18': '22px', '--space-12': '10px' })).toBe(
			true
		);
	});
	it('rejects new keys, CSS injection, unit changes and unsafe line dimensions', () => {
		for (const patch of [
			{ '--new-token': '2px' },
			{ '--bg': '#ffffff;background:url(https://example.com)' },
			{ '--radius-18': '100vh' },
			{ '--space-12': '9999px' },
			{ '--line-1': '0px' },
			{ '--memory-radius': 'clamp(1px, 1vmin, 999px)' },
			{ '--shape-hexagon-clip': 'polygon(0% 0%,0% 0%,0% 0%,0% 0%,0% 0%,0% 0%)' },
			{ '--dialog-backdrop-opacity': '0.99' }
		])
			expect(validateSiteTokens({ ...defaults, ...patch })).toBe(false);
	});
	it('resolves editable container shapes into immutable round snapshots', () => {
		for (const container of ['circle', 'squircle', 'hexagon']) {
			const config = structuredClone(THEME_CONFIG);
			config.profiles.default.containers = [container];
			config.siteTokens['--shape-circle-radius'] = '45%';
			config.siteTokens['--shape-squircle-radius'] = '24%';
			config.siteTokens['--shape-hexagon-clip'] =
				'polygon(20% 0%,80% 0%,100% 50%,80% 100%,20% 100%,0% 50%)';
			const theme = generateTheme('42', 'memory', config);
			const snapshot = themeStyle(theme);
			if (container === 'hexagon')
				expect(snapshot).toContain(config.siteTokens['--shape-hexagon-clip']);
			else expect(snapshot).toContain(`--memory-radius:${container === 'circle' ? '45%' : '24%'}`);
			config.siteTokens['--shape-circle-radius'] = '10%';
			expect(themeStyle(theme)).toBe(snapshot);
		}
	});
	it('rejects unreadable site text independently from generated puzzle palettes', () => {
		expect(siteTokenIssues({ ...defaults, '--ink': defaults['--bg'] })).toContain(
			'text_contrast:--ink:--bg'
		);
	});
});
