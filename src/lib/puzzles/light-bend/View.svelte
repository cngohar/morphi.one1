<script lang="ts">
	import Game from './Game.svelte';
	import { lightBendStarGrade, lightBendTurned, type LightBendRound } from './logic.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';

	let props: PuzzleViewProps = $props();
	const round = $derived.by(() => {
		const value = { ...(props.round as LightBendRound) };
		delete value.variant;
		return value;
	});
	function finish(score: number, seconds: number, crystals: number, hints: number) {
		const stars = lightBendStarGrade(round);
		const turned = lightBendTurned(round);
		props.onfinish({
			score,
			title: t('light-bend.result.title'),
			summary: t('light-bend.result.summary', {
				crystals,
				time: formatDuration(seconds),
				mirrors: turned,
				par: round.par,
				stars
			}),
			announcement: t('light-bend.result.announce', { score: formatNumber(score) }),
			stats: [
				{ label: t('light-bend.stars'), value: String(stars) },
				{ label: t('light-bend.par'), value: String(round.par) },
				{ label: t('light-bend.mirrors'), value: String(turned) },
				{ label: t('light-bend.hintsLeft'), value: String(hints) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			],
			endingValues: { crystals, stars, elapsed: formatDuration(seconds) }
		});
	}
</script>

<Game {...props} {round} onfinish={finish} />
