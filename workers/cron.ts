import { refreshDailyBoards } from '../src/lib/server/daily.js';

export default {
	async scheduled(controller, env) {
		try {
			await refreshDailyBoards(
				env.DB,
				env.DAILY_SEED_SECRET,
				env.CONFIG_CACHE,
				controller.scheduledTime,
				controller.cron === '0 0 1 * *',
				controller.cron === '0 0 * * *'
			);
		} catch (error) {
			console.error(JSON.stringify({ event: 'daily_cron_failed', cron: controller.cron }));
			throw error;
		}
	}
} satisfies ExportedHandler<Cloudflare.Env>;
