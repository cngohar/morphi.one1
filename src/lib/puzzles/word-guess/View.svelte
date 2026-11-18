<script lang="ts">
	import Game from './Game.svelte';
	import type { WordGuessRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as WordGuessRound) };
		delete value.variant;
		return value;
	});
	function finish(game: WordGuessRound, seconds: number, score: number) {
		const hinted = game.status === 'won' && game.hintUsedSession;
		const tries = `${game.status === 'won' ? game.guesses.length : 'X'}/${game.budget}`;
		const answers = game.boards.map((board) => board.answer).join(', ');
		props.onfinish({
			score,
			title: t('word-guess.result.title'),
			summary: `${t('word-guess.result.summary', { tries, answers })}${hinted ? ` · ${t('word-guess.solvedWithHint')}` : ''}`,
			announcement: t('word-guess.result.announce', { score: formatNumber(score) }),
			stats: [
				...(hinted
					? [{ label: t('word-guess.solvedWithHint'), value: String(game.hintsUsed) }]
					: []),
				{ label: t('word-guess.tries'), value: tries },
				{ label: t('word-guess.answers'), value: answers },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { tries },
			ending: {
				headline: t(
					game.status === 'won' ? 'ending.word-guess.headline' : 'ending.word-guess.lost'
				),
				subline: `${tries} · ${answers}`
			}
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
