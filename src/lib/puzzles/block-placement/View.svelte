<script lang="ts">
	import Game from './Game.svelte';
	import type { BlockRound, BlockEndReason } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	import { loadBlockHintSeen, saveBlockHintSeen } from '#lib/ui/storage.js';
	let props: PuzzleViewProps = $props();
	const showHint = !loadBlockHintSeen();
	saveBlockHintSeen();

	function finish(
		score: number,
		lines: number,
		pieces: number,
		endReason: BlockEndReason,
		streak: number
	) {
		const summary = t('block.result.summary', { lines, pieces });
		const timeUp = endReason === 'time-up';
		props.onfinish({
			score,
			title: t('block.result.title'),
			summary: t(
				timeUp
					? 'block.result.timeUp'
					: endReason === 'cap'
						? 'block.result.cap'
						: 'block.result.noFit',
				{ summary }
			),
			announcement: t('block.result.announce', { score: formatNumber(score), summary }),
			stats: [
				{ label: t('block.lines'), value: formatNumber(lines) },
				{ label: t('v1.game.moves'), value: formatNumber(pieces) },
				{ label: t('block.streak'), value: streak > 0 ? `×${streak}` : '—' }
			],
			endingValues: { score: formatNumber(score), pieces: formatNumber(pieces) },
			...(timeUp
				? {
						ending: {
							headline: t('ending.block.timeUp'),
							subline: t('ending.block.timeUp.subline', {
								score: formatNumber(score),
								pieces: formatNumber(pieces)
							})
						}
					}
				: {}),
			cap: endReason === 'cap'
		});
	}
</script>

<Game
	{...props}
	round={props.round as BlockRound}
	{showHint}
	onfinish={finish}
	oncomplete={props.oncomplete}
	traySide="right"
/>
