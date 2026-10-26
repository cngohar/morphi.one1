// Used only by the local admin command, never imported by the web app.
import { createHmac, timingSafeEqual } from 'node:crypto';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Uint8Array): string {
	let bits = 0,
		value = 0,
		result = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			result += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits) result += ALPHABET[(value << (5 - bits)) & 31];
	return result;
}
export function totp(secret: Uint8Array, timestamp: number): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30000)));
	const hash = createHmac('sha1', secret).update(counter).digest();
	const offset = hash[19]! & 15;
	const value = (hash.readUInt32BE(offset) & 0x7fffffff) % 1000000;
	return value.toString().padStart(6, '0');
}
export function verifyTotp(secret: Uint8Array, code: string, timestamp: number): boolean {
	if (!/^\d{6}$/.test(code)) return false;
	return [-30000, 0, 30000].some((shift) =>
		timingSafeEqual(Buffer.from(totp(secret, timestamp + shift)), Buffer.from(code))
	);
}
