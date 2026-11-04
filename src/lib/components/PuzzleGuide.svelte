<script lang="ts">
	import { puzzleVariant, scoreDefinition } from '#lib/scoring.js';
	import { scoreGuideValue } from '#lib/ui/puzzle-presentation.js';
	import { puzzleMetadata } from '#lib/puzzle-metadata.js';
	import type { PuzzleId } from '#lib/engine/contract.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	let {
		family,
		variant,
		scoring,
		section = 'all'
	}: {
		family: PuzzleId;
		variant?: string;
		scoring?: ScoreValues;
		section?: 'all' | 'how' | 'scoring' | 'scoring-tips' | 'right';
	} = $props();
	const guide = $derived(
		puzzleVariant(family, variant)?.help ?? puzzleMetadata[family].presentation.help
	);
	const values: ScoreValues = $derived(scoring ?? scoreDefinition(family, variant).defaults);
</script>

{#if section === 'all' || section === 'how'}<section class="guide-how">
		<h2>{t('v1.game.how')}</h2>
		<ol>
			{#each guide.steps as step, index (step)}<li>
					<span>{index + 1}</span>
					<p>{t(step as MessageKey)}</p>
				</li>{/each}
		</ol>
	</section>{/if}
{#if section === 'all' || section === 'scoring' || section === 'scoring-tips'}<section
		class="guide-scoring"
	>
		<h2>{t('v1.game.scoring')}</h2>
		<dl>
			{#each guide.rows as row (row.label)}<div>
					<dt>{t(row.label as MessageKey)}</dt>
					<dd>{scoreGuideValue(row, values)}</dd>
				</div>{/each}
		</dl>
		<p class="guide-note">{t(guide.note as MessageKey)}</p>
	</section>{/if}
{#if section === 'all' || section === 'right' || section === 'scoring-tips'}<section
		class="guide-tips"
	>
		<h2>{t('v1.game.tips')}</h2>
		<p>{t(guide.tips as MessageKey)}</p>
	</section>{/if}
