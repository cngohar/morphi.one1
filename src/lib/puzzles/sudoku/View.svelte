<script lang="ts">
	import Game from './Game.svelte';
	import type { SudokuRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';

	let props: PuzzleViewProps = $props();
	const round = $derived(props.round as SudokuRound);

	function finish(game: SudokuRound, seconds: number, score: number) {
		const headline = t(
			game.status === 'won'
				? 'ending.sudoku.headline'
				: game.status === 'timeout'
					? 'ending.sudoku.timeUp'
					: game.mistakes === 3 && props.scoring.mistakeLimit === 3
						? 'ending.sudoku.threeMistakes'
						: 'ending.sudoku.lost'
		);
		const time = formatDuration(seconds);
		const hinted = game.status === 'won' && game.hintUsedSession;
		const summary = [
			game.status === 'won' ? t('ending.sudoku.subline', { time }) : headline,
			hinted ? t('word-guess.solvedWithHint') : ''
		]
			.filter(Boolean)
			.join(' · ');
		props.onfinish({
			score,
			title: headline,
			summary,
			announcement: `${headline} ${formatNumber(score)}`,
			stats: [
				{ label: t('game.time'), value: time },
				{ label: t('sudoku.mistakes'), value: formatNumber(game.mistakes) },
				{
					label: t('sudoku.hints'),
					value: hinted
						? `${formatNumber(game.hints)} · ${t('word-guess.solvedWithHint')}`
						: formatNumber(game.hints)
				}
			],
			endingValues: { time },
			ending: { headline, subline: game.status === 'won' ? summary : time },
			cap: game.status === 'timeout'
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
