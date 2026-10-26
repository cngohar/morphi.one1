<script lang="ts">
	import { motion } from '#lib/ui/motion.js';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import PuzzleGuide from '#lib/components/PuzzleGuide.svelte';
	import PlaySession from '#lib/screens/PlaySession.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { loadBestScore } from '#lib/ui/storage.js';
	import { formatNumber } from '#lib/ui/format.js';
	import { sound } from '#lib/ui/sound.js';
	let {
		family,
		data
	}: {
		family: 'memory' | 'block';
		data: { account: { signedIn: boolean; ownerKey: string | null } };
	} = $props();
	let root = $state<HTMLDivElement>();
	let ready = $state(false);
	let playing = $state(false),
		best = $state(0);
	const key = (suffix: string) => `v1.game.${family}.${suffix}` as MessageKey;
	onMount(() => {
		ready = true;
		best = loadBestScore(family);
	});
	function play() {
		sound.unlock();
		try {
			if (root) motion.doorExit(root);
		} catch {
			console.warn('morphi:door_motion_unavailable');
		}
		playing = true;
	}
</script>

<Seo
	title={t(family === 'memory' ? 'v1.memory.titleTag' : 'v1.block.titleTag')}
	description={t(family === 'memory' ? 'v1.memory.metaDescription' : 'v1.block.metaDescription')}
	path={family === 'memory' ? '/memory' : '/block-puzzle'}
	image={family}
/>
{#if playing}<PlaySession {data} fixedFamily={family} />{:else}
	<div bind:this={root} class="puzzle-page door-ready" data-family={family}>
		<SiteHeader />
		<header class="page-heading">
			<p class="eyebrow">{t(key('eyebrow'))}</p>
			<h1>{t(family === 'memory' ? 'v1.game.memory' : 'v1.game.block')}</h1>
			<p class="door-intro">{t(key('intro'))}</p>
		</header>
		<main class="puzzle-layout">
			<aside class="puzzle-copy">
				<PuzzleGuide {family} section="how" /><PuzzleGuide {family} section="scoring" />
			</aside>
			<div class="game-stage ready">
				<div class="game-meta">
					<strong>{t(family === 'memory' ? 'v1.game.memory' : 'v1.game.block')}</strong>
				</div>
				<div class="game-hud">
					<div><span>{t('v1.game.best')}</span><strong>{formatNumber(best)}</strong></div>
				</div>
				<div class="board-field">
					<div
						class:ready-memory={family === 'memory'}
						class:ready-block={family === 'block'}
						aria-hidden="true"
					>
						{#each Array.from({ length: family === 'memory' ? 12 : 64 }, (_, index) => index) as index (index)}<i
								class:occupied={family === 'block' &&
									[48, 49, 50, 52, 53, 54, 55, 56, 57, 60, 61].includes(index)}
								>{#if family === 'memory'}<b></b>{/if}</i
							>{/each}
					</div>
					<button class="board-play" disabled={!ready} onclick={play}>{t('home.play')}</button>
				</div>
			</div>
			<aside class="puzzle-copy">
				<section class="guide-high">
					<h2>{t('v1.game.best')}</h2>
					<strong>{formatNumber(best)}</strong>
				</section>
				<PuzzleGuide {family} section="right" />
				<section class="guide-surprise">
					<a href={resolve('/play')}>{t('v1.nav.surprise')}</a>
					<p>{t('v1.game.surpriseNote')}</p>
				</section>
			</aside>
		</main>
		<SiteFooter />
	</div>
{/if}

<style>
	.puzzle-page {
		display: flex;
		flex-direction: column;
	}
	.eyebrow {
		text-transform: uppercase;
	}
	.game-hud > div {
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 4px;
	}
	.board-play {
		border: 0;
		cursor: pointer;
	}
	.ready-memory {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 9px;
		width: min(100%, 390px);
		margin: auto;
	}
	.ready-memory i {
		aspect-ratio: 0.78;
		background: var(--memory-back);
		border: 1px solid var(--memory-edge);
		border-radius: 13px;
		display: grid;
		place-items: center;
	}
	.ready-memory b {
		width: 18px;
		height: 18px;
		border: 2px solid var(--surface);
		transform: rotate(45deg);
		border-radius: 3px;
	}
	.ready-block {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
		width: min(100%, 330px);
		margin: auto;
	}
	.ready-block i {
		aspect-ratio: 1;
		border-radius: 7px;
		background: var(--block-cell);
		border: 1px solid var(--border);
	}
	.ready-block .occupied {
		background: var(--accent);
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 1023px) {
		.puzzle-layout {
			grid-template-columns: 1fr !important;
			max-width: 620px;
		}
		.game-stage {
			grid-row: 1;
		}
		.puzzle-copy {
			grid-row: auto;
		}
	}
</style>
