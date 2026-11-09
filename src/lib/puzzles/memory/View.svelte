<script lang="ts">
	import Game from './Game.svelte';
	import { cardsPerMatch, type MemoryRound } from './logic.js';
	import { familyName } from '#lib/ui/puzzle-presentation.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived(props.round as MemoryRound);

	function finish(score: number, seconds: number, moves: number) {
		const size = cardsPerMatch(round);
		const kind = size === 3 ? 'trios' : size === 4 ? 'quads' : undefined;
		const summary = t(kind ? `memory.${kind}.summary` : 'result.summary', {
			pairs: round.pairs,
			moves,
			time: formatDuration(seconds)
		});
		props.onfinish({
			score,
			title: familyName('memory'),
			summary,
			announcement: t('result.announce', { score: formatNumber(score), summary }),
			stats: [
				{ label: t(kind ? `memory.${kind}.label` : 'v1.game.pairs'), value: String(round.pairs) },
				{ label: t('v1.game.mismatches'), value: String(moves - round.pairs) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { pairs: round.pairs, time: formatDuration(seconds) }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
