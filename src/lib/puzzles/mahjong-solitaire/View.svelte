<script lang="ts">
	import Game from './Game.svelte';
	import type { MahjongRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as MahjongRound) };
		delete value.variant;
		return value;
	});
	function finish(score: number, seconds: number, pairs: number, hints: number, shuffles: number) {
		props.onfinish({
			score,
			title: t('mahjong.result.title'),
			summary: t('mahjong.result.summary', {
				pairs,
				time: formatDuration(seconds),
				hints,
				shuffles
			}),
			announcement: t('mahjong.result.announce', { score: formatNumber(score) }),
			stats: [
				{
					label: t(round.rules.groupSize === 3 ? 'mahjong.triples' : 'mahjong.pairs'),
					value: String(pairs)
				},
				{ label: t('mahjong.hints'), value: String(hints) },
				{ label: t('mahjong.shuffles'), value: String(shuffles) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { pairs, hints, shuffles, elapsed: formatDuration(seconds) }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
