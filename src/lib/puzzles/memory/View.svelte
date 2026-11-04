<script lang="ts">
	import Game from './Game.svelte';
	import { memoryVariantName, memoryVariant, type MemoryRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived(props.round as MemoryRound);

	function finish(score: number, seconds: number, moves: number) {
		const trios = memoryVariant(round) === 'memory:trios';
		const summary = t(trios ? 'memory.trios.summary' : 'result.summary', {
			pairs: round.pairs,
			moves,
			time: formatDuration(seconds)
		});
		props.onfinish({
			score,
			title: t('memory.variantLabel', { variant: t(memoryVariantName(round.variant)) }),
			summary,
			announcement: t('result.announce', { score: formatNumber(score), summary }),
			stats: [
				{ label: t(trios ? 'memory.trios.label' : 'v1.game.pairs'), value: String(round.pairs) },
				{ label: t('v1.game.mismatches'), value: String(moves - round.pairs) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { pairs: round.pairs, time: formatDuration(seconds) }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
