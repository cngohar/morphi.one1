import { defineParams } from '@sveltejs/kit/params';

export const params = defineParams({
	family(value: string) {
		return ['block', 'memory', 'connect', 'block-puzzle'].includes(value) ? value : undefined;
	}
});
