<script lang="ts">
	import Game from './Game.svelte';
	import type { ConnectRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as ConnectRound) };
		delete value.variant;
		return value;
	});

	function finish(score: number, seconds: number, strokes: number, filled: number) {
		const filledPercent = Math.round((filled * 100) / (round.size * round.size));
		props.onfinish({
			score,
			title: t('connect.result.title'),
			summary: t('connect.result.summary', {
				pairs: round.pairs.length,
				time: formatDuration(seconds),
				filled: filledPercent
			}),
			announcement: t('connect.result.announce', { score: formatNumber(score) }),
			stats: [
				{ label: t('v1.game.pairs'), value: String(round.pairs.length) },
				{ label: t('connect.filled'), value: `${filledPercent}%` },
				{ label: t('connect.strokes'), value: String(strokes) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { filled: filledPercent }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
