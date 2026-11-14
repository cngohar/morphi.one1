<script lang="ts">
	import Game from './Game.svelte';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';

	let props: PuzzleViewProps = $props();

	function finish(score: number, seconds: number, moves: number, hintsUsedSession: boolean) {
		props.onfinish({
			score,
			title: t('klondike-solitaire.result.title'),
			summary: t('klondike-solitaire.result.summary', {
				moves,
				time: formatDuration(seconds)
			}),
			announcement: t('klondike-solitaire.result.announce', {
				score: formatNumber(score)
			}),
			stats: [
				{ label: t('klondike-solitaire.moves'), value: String(moves) },
				{ label: t('klondike-solitaire.score'), value: formatNumber(score) },
				{ label: t('klondike-solitaire.time'), value: formatDuration(seconds) }
			],
			endingValues: {
				moves,
				elapsed: formatDuration(seconds)
			},
			...(hintsUsedSession
				? {
						ending: {
							headline: t('ending.klondike-solitaire.headline'),
							subline: 'Solved with hint'
						}
					}
				: {})
		});
	}
</script>

<Game {...props} onfinish={finish} />
