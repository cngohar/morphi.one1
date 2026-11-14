<script lang="ts">
	import Game from './Game.svelte';
	import type { TangramRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as TangramRound) };
		delete value.variant;
		return value;
	});
	function finish(score: number, seconds: number, pieces: number, hints: number) {
		props.onfinish({
			score,
			title: t('tangram.result.title'),
			summary: `${t(hints ? 'tangram.helped' : 'tangram.clean')}. ${t('tangram.result.summary', { pieces, time: formatDuration(seconds), hints })}`,
			announcement: t('tangram.result.announce', { score: formatNumber(score) }),
			stats: [
				{ label: t('tangram.pieces'), value: String(pieces) },
				{ label: t('tangram.hints'), value: String(hints) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { pieces, hints, elapsed: formatDuration(seconds) }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
