import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	BETTER_AUTH_URL: { schema: (value) => value ?? 'http://localhost:5173' },
	BETTER_AUTH_SECRET: { schema: (value) => value ?? '' },
	GOOGLE_CLIENT_ID: { schema: (value) => value ?? '' },
	GOOGLE_CLIENT_SECRET: { schema: (value) => value ?? '' },
	ELEVENLABS_API_KEY: {
		schema: (value) => value ?? ''
	}
});
