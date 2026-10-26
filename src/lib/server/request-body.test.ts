import { describe, expect, it } from 'vitest';
import { boundAccountRequest } from './request-body.js';

describe('bounded account requests', () => {
	it('preserves a valid encoded form and its request metadata', async () => {
		const request = new Request('https://morphi.example/account/name', {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'https://morphi.example'
			},
			body: 'playerName=Player_28'
		});
		const bounded = await boundAccountRequest(request);
		expect(bounded?.headers.get('origin')).toBe('https://morphi.example');
		expect((await bounded?.formData())?.get('playerName')).toBe('Player_28');
	});
	it('rejects oversized bodies with and without Content-Length', async () => {
		expect(
			await boundAccountRequest(
				new Request('https://morphi.example', {
					method: 'POST',
					headers: { 'content-length': '20000' },
					body: 'x'
				})
			)
		).toBeNull();
		expect(
			await boundAccountRequest(
				new Request('https://morphi.example', { method: 'POST', body: 'x'.repeat(16_385) })
			)
		).toBeNull();
	});
});
