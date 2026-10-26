import { describe, expect, it } from 'vitest';
import { base32, totp, verifyTotp } from './admin-totp.js';
describe('local admin second factor', () => {
	it('matches the RFC 6238 SHA1 vector and rejects incorrect and expired codes', () => {
		const key = new TextEncoder().encode('12345678901234567890');
		expect(totp(key, 59000)).toBe('287082');
		expect(verifyTotp(key, '287082', 59000)).toBe(true);
		expect(verifyTotp(key, '287082', 150000)).toBe(false);
		expect(verifyTotp(key, '000000', 59000)).toBe(false);
		expect(verifyTotp(key, 'bad', 59000)).toBe(false);
		expect(base32(new TextEncoder().encode('foo'))).toBe('MZXW6');
	});
});
