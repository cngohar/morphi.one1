<script lang="ts">
	import Game from './Game.svelte';
	import { equalityPercent, type ShapeDivisionRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';

	let props: PuzzleViewProps = $props();
	const round = $derived(props.round as ShapeDivisionRound);
	function finish(game: ShapeDivisionRound, seconds: number, score: number) {
		const won = game.status === 'won';
		const headline = won
			? t(
					game.rules.scoring === 1
						? 'ending.shape-division.equality'
						: game.rules.relation === 1
							? 'ending.shape-division.equalArea'
							: 'ending.shape-division.headline'
				)
			: game.status === 'timeout'
				? t('ending.shape-division.timeUp')
				: t('ending.shape-division.lost');
		const hinted = won && game.hints.length > 0;
		const time = formatDuration(seconds);
		const summary = `${time}${won && game.rules.scoring === 1 ? ` · ${t('shape-division.equalityResult', { percent: equalityPercent(game) })}` : ''}${hinted ? ` · ${t('shape-division.hinted')}` : ''}`;
		props.onfinish({
			score,
			title: headline,
			summary,
			announcement: `${headline} ${formatNumber(score)}`,
			stats: [
				{ label: t('game.time'), value: time },
				{ label: t('shape-division.mistakes'), value: formatNumber(game.mistakes) },
				{
					label: t('shape-division.hints'),
					value: `${formatNumber(game.hints.length)}${hinted ? ` · ${t('shape-division.hinted')}` : ''}`
				}
			],
			endingValues: { pieces: game.rules.pieces },
			ending: { headline, subline: summary },
			cap: game.status === 'timeout'
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
