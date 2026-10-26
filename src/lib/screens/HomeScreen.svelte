<script lang="ts">
	import { measure } from '#lib/ui/measurement.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { t } from '#lib/i18n/messages.js';
	import { motion } from '#lib/ui/motion.js';
	import { sound } from '#lib/ui/sound.js';
	import { loadSoundEnabled, saveSoundEnabled } from '#lib/ui/storage.js';
	let root: HTMLDivElement;
	let ready = $state(false);
	let starting = $state(false),
		enabled = $state(true);
	const colors = [
		'var(--success)',
		'var(--accent)',
		'var(--warning-fill)',
		'var(--accent)',
		'var(--success)',
		'var(--warning-fill)',
		'var(--violet)',
		'var(--primary)'
	];
	const paths = [
		'M24 4 46 42H2Z',
		'M24 2 44 13v22L24 46 4 35V13Z',
		'm24 2 22 22-22 22L2 24Z',
		'M3 3h18v18H3Zm0 22h18v18H3Zm22 0h18v18H25Z',
		'M8 2h32v44H8Zm9 12v20h14V14Z',
		'M5 12h13a7 7 0 1 1 13 0h12v12a7 7 0 1 0 0 13v8H5Z'
	];
	let scatter = $state<{ x: number; y: number; size: number; kind: number; angle: number }[]>([]);
	function dealScatter() {
		try {
			const bounds = root.getBoundingClientRect();
			const safe = Array.from(root.querySelectorAll<HTMLElement>('[data-safe]')).map((n) =>
				n.getBoundingClientRect()
			);
			const draws = crypto.getRandomValues(new Uint32Array(1024));
			let i = 0;
			const next = () => draws[i++ % draws.length] / 4294967296;
			const placed: typeof scatter = [];
			for (
				let attempt = 0;
				attempt < 180 && placed.length < (innerWidth < 600 ? 9 : 18);
				attempt++
			) {
				const size = 20 + next() * 20,
					x = 12 + next() * Math.max(0, bounds.width - 64),
					y = 80 + next() * Math.max(0, bounds.height - 140);
				if (
					safe.some(
						(r) =>
							x < r.right - bounds.left + 22 &&
							x + size > r.left - bounds.left - 22 &&
							y < r.bottom - bounds.top + 22 &&
							y + size > r.top - bounds.top - 22
					) ||
					placed.some((r) => Math.abs(x - r.x) < size + 22 && Math.abs(y - r.y) < size + 22)
				)
					continue;
				placed.push({ x, y, size, kind: Math.floor(next() * 8), angle: next() * 36 - 18 });
			}
			scatter = placed;
		} catch {
			console.warn('morphi:home_scatter_unavailable');
		}
	}
	onMount(() => {
		ready = true;
		enabled = loadSoundEnabled();
		sound.setEnabled(enabled);
		dealScatter();
		const stop = motion.orbit(root);
		window.addEventListener('resize', dealScatter);
		return () => {
			stop();
			window.removeEventListener('resize', dealScatter);
		};
	});
	function toggle() {
		enabled = !enabled;
		sound.setEnabled(enabled);
		saveSoundEnabled(enabled);
	}
	function play() {
		if (starting) return;
		starting = true;
		measure('play_clicked');
		sound.unlock();
		try {
			motion.homeExit(root);
		} catch {
			console.warn('morphi:home_motion_unavailable');
		}
		void goto(resolve('/play')).catch(() => {
			starting = false;
			console.error('morphi:navigation_failed');
		});
	}
</script>

<div class="home-page" bind:this={root}>
	<div class="home-scatter" aria-hidden="true">
		{#each scatter as item, index (index)}<i
				style={`left:${item.x}px;top:${item.y}px;width:${item.size}px;height:${item.size}px;transform:rotate(${item.angle}deg);color:${colors[index % colors.length]}`}
				><svg viewBox="0 0 48 48" fill="currentColor"
					>{#if item.kind === 6}<circle cx="24" cy="24" r="18" />{:else if item.kind === 7}<circle
							cx="24"
							cy="24"
							r="16"
							fill="none"
							stroke="currentColor"
							stroke-width="5"
						/>{:else}<path d={paths[item.kind]} />{/if}</svg
				></i
			>{/each}
	</div>
	<SiteHeader soundEnabled={enabled} ontogglesound={toggle} />
	<main class="home-main">
		<div class="home-copy">
			<p class="eyebrow" data-safe>{t('v1.home.tag')}</p>
			<h1 data-safe aria-label={t('v1.home.title')}>
				<span>{t('v1.home.line1')}</span><span class="headline-tail"
					><span>{t('v1.home.line2')}</span> <span>{t('v1.home.line3')}</span></span
				>
			</h1>
		</div>
		<div class="home-play">
			<div class="play-orbit" data-safe>
				<div class="orbit-rotator" aria-hidden="true">
					{#each colors as color, index (index)}<i
							class="orbit-arm"
							style={`--angle:${index * 45}deg`}
							><i class="orbit-tile" style={`--tile-color:${color}`}></i></i
						>{/each}
				</div>
				<button
					class="play-circle"
					onclick={play}
					disabled={starting || !ready}
					aria-busy={starting}>{t('home.play')}</button
				>
			</div>
			<div class="mystery-tiles" aria-hidden="true" data-safe><i>?</i><i>?</i><i>?</i></div>
		</div>
		<div class="info-chips" data-safe>
			<span>{t('v1.home.free')}</span><span>{t('v1.home.optional')}</span><span
				>{t('v1.home.fresh')}</span
			>
		</div>
	</main>
	<SiteFooter />
</div>

<style>
	.home-page {
		display: flex;
		flex-direction: column;
		position: relative;
	}
	.home-play {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.play-circle {
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: var(--surface);
		cursor: pointer;
	}
	.eyebrow {
		text-transform: uppercase;
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 5px;
	}
</style>
