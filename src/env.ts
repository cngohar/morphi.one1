import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	ELEVENLABS_API_KEY: {
		schema: (value) => value ?? ''
	}
});
