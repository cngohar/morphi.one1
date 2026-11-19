<script lang="ts">
	import Game from './Game.svelte';
	import type { OneLineRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';

	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as OneLineRound) };
		delete value.variant;
		return value;
	});
	function finish(game: OneLineRound, seconds: number, score: number) {
		const hinted = game.status === 'won' && game.hintUsedSession;
		const headline =
			game.status === 'won'
				? t('ending.one-line.headline')
				: game.status === 'timeout'
					? t('ending.one-line.timeUp')
					: game.status === 'wrong-verdict'
						? t('ending.one-line.wrongVerdict')
						: t('ending.one-line.lost');
		const summary = `${game.edgesCovered}/${game.edges.reduce((sum, edge) => sum + (edge.double ? 2 : 1), 0)} · ${formatDuration(seconds)}${hinted ? ` · ${t('one-line.hinted')}` : ''}`;
		props.onfinish({
			score,
			title: headline,
			summary,
			announcement: `${headline} ${formatNumber(score)}`,
			stats: [
				{ label: t('one-line.lines'), value: String(game.edgesCovered) },
				{ label: t('one-line.hints'), value: String(game.hintsUsed) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: {},
			ending: {
				headline,
				subline: game.status === 'wrong-verdict' ? t('one-line.verdictExplanation') : summary
			}
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
