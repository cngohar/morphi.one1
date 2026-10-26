import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { createDatabase } from './db/index.js';
import * as schema from './db/schema.js';

export interface AuthSettings {
	baseURL: string;
	secret: string;
	googleClientId: string;
	googleClientSecret: string;
}

export function googleIsConfigured(settings: AuthSettings): boolean {
	return Boolean(settings.googleClientId.trim() && settings.googleClientSecret.trim());
}

export function createAuth(
	binding: D1Database,
	settings: AuthSettings,
	plugins: BetterAuthPlugin[] = []
) {
	return betterAuth({
		appName: 'Morphi',
		baseURL: settings.baseURL,
		secret: settings.secret,
		database: drizzleAdapter(createDatabase(binding), { provider: 'sqlite', schema }),
		emailAndPassword: { enabled: false },
		socialProviders: googleIsConfigured(settings)
			? {
					google: {
						clientId: settings.googleClientId,
						clientSecret: settings.googleClientSecret,
						prompt: 'select_account',
						accessType: 'online'
					}
				}
			: {},
		trustedOrigins: [new URL(settings.baseURL).origin],
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			freshAge: 60 * 5,
			cookieCache: { enabled: false }
		},
		user: { deleteUser: { enabled: true } },
		account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
		rateLimit: {
			enabled: true,
			storage: 'database',
			window: 60,
			max: 60,
			customRules: { '/sign-in/social': { window: 60, max: 10 } }
		},
		advanced: {
			disableOriginCheck: false,
			disableCSRFCheck: false,
			useSecureCookies: new URL(settings.baseURL).protocol === 'https:',
			defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] }
		},
		// Log only event codes, never provider errors containing identity or tokens.
		logger: {
			log: (level) => console.error(JSON.stringify({ event: 'auth_library_event', level }))
		},
		plugins
	});
}

export type Auth = ReturnType<typeof createAuth>;
