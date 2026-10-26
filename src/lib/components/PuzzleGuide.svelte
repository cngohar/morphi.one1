<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	let {
		family,
		section = 'all'
	}: {
		family: 'block' | 'memory';
		section?: 'all' | 'how' | 'scoring' | 'scoring-tips' | 'right';
	} = $props();
	const key = (suffix: string) => `v1.game.${family}.${suffix}` as MessageKey;
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
					<dd>{t(key(`value${number}`))}</dd>
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
