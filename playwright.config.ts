import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 120_000,
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{
			name: 'firefox-themes',
			testMatch: ['themes.spec.ts', 'card.spec.ts', 'app-card.spec.ts', 'connect.spec.ts'],
			use: { browserName: 'firefox' }
		},
		{
			name: 'webkit-themes',
			testMatch: ['themes.spec.ts', 'card.spec.ts', 'app-card.spec.ts', 'connect.spec.ts'],
			use: { browserName: 'webkit' }
		}
	],
	webServer: {
		command: 'bun run dev --host 127.0.0.1',
		url: 'http://127.0.0.1:5173',
		reuseExistingServer: true,
		timeout: 120_000
	}
});
