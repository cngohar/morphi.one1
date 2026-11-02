<script lang="ts">
	import { puzzleMetadata } from '#lib/puzzle-metadata.js';
	import type { PuzzleId } from '#lib/engine/contract.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	let {
		family,
		scoring,
		section = 'all'
	}: {
		family: PuzzleId;
		scoring?: ScoreValues;
		section?: 'all' | 'how' | 'scoring' | 'scoring-tips' | 'right';
	} = $props();
	const key = (suffix: string) => `v1.game.${family}.${suffix}` as MessageKey;
	const fields = $derived(puzzleMetadata[family].scoring.fields);
	const values: ScoreValues = $derived(scoring ?? puzzleMetadata[family].scoring.defaults);
	function scoreValue(row: number) {
		const field = fields[row - 1];
		if (!field) return t(key(`value${row}`));
		const negative = family === 'memory' ? row > 1 : family === 'connect' && row === 4;
		return `${negative ? '−' : '+'}${new Intl.NumberFormat('en').format(values[field]!)}`;
	}
</script>

{#if section === 'all' || section === 'how'}<section class="guide-how">
		<h2>{t('v1.game.how')}</h2>
		<ol>
			{#each [1, 2, 3] as number (number)}<li>
					<span>{number}</span>
					<p>{t(key(`step${number}`))}</p>
				</li>{/each}
		</ol>
	</section>{/if}
{#if section === 'all' || section === 'scoring' || section === 'scoring-tips'}<section
		class="guide-scoring"
	>
		<h2>{t('v1.game.scoring')}</h2>
		<dl>
			{#each [1, 2, 3, 4] as number (number)}<div>
					<dt>{t(key(`row${number}`))}</dt>
					<dd>{scoreValue(number)}</dd>
				</div>{/each}
		</dl>
		<p class="guide-note">{t(key('scoringNote'))}</p>
	</section>{/if}
{#if section === 'all' || section === 'right' || section === 'scoring-tips'}<section
		class="guide-tips"
	>
		<h2>{t('v1.game.tips')}</h2>
		<p>{t(key('tips'))}</p>
	</section>{/if}
