// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: import('#lib/server/auth.js').Auth | null;
			user: import('#lib/server/auth.js').Auth['$Infer']['Session']['user'] | null;
			session: import('#lib/server/auth.js').Auth['$Infer']['Session']['session'] | null;
			accountStatus: 'ready' | 'unconfigured' | 'unavailable';
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
