<script lang="ts">
	import Game from './Game.svelte';
	import type { NonogramRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as NonogramRound) };
		delete value.variant;
		return value;
	});
	function finish(score: number, seconds: number, filled: number, mistakes: number, hints: number) {
		props.onfinish({
			score,
			title: t('nonogram.result.title'),
			summary: t('nonogram.result.summary', {
				filled,
				time: formatDuration(seconds),
				mistakes,
				hints
			}),
			announcement: t('nonogram.result.announce', { score: formatNumber(score) }),
			stats: [
				{ label: t('nonogram.filled'), value: String(filled) },
				{ label: t('nonogram.mistakes'), value: String(mistakes) },
				{ label: t('nonogram.hints'), value: String(hints) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { filled, mistakes, hints }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
