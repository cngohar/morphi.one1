<script lang="ts">
	import { tick } from 'svelte';
	import Symbol from './Symbol.svelte';
	import {
		memoryRoundRules,
		timeStrataTops,
		timeStrataOutcome,
		timeStrataClues,
		timeStrataCanSelect,
		type MemoryMove,
		type MemoryRound
	} from './logic.js';
	import { SYMBOLS, symbolLabel, type SymbolId } from './symbols.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { t } from '#lib/i18n/messages.js';

	let {
		game,
		locked,
		controlsLocked,
		status,
		symbolColors,
		resolvedTheme,
		onflip,
		oncancel,
		oncontinue,
		onutility
	}: {
		game: MemoryRound;
		locked: boolean;
		controlsLocked: boolean;
		status: string;
		symbolColors: Map<string, string>;
		resolvedTheme: ResolvedTheme | null;
		onflip: (index: number) => void;
		oncancel: () => void;
		oncontinue: () => void;
		onutility: (move: MemoryMove) => void;
	} = $props();

	const labels = ['I', 'II', 'III', 'IV'];
	const rules = $derived(memoryRoundRules(game));
	const tops = $derived(timeStrataTops(game));
	const clues = $derived(timeStrataClues(game));
	const echo = $derived((game.echo?.length ?? 0) > 0);
	const pending = $derived(game.revealed.length === 2 || echo);
	const outcome = $derived(timeStrataOutcome(game));
	const utilityMode = $derived(rules.canLiftTop || rules.canCycleTop || rules.canMoveToEmptyStack);
	const ruleState = $derived(ruleStatus());
	const utilityLocked = $derived(locked || controlsLocked || game.revealed.length > 0 || pending);
	let source = $state(0);
	let destination = $state(0);
	let continueButton: HTMLButtonElement;
	$effect(() => {
		if (pending && !controlsLocked) {
			// Each counted chain pair and free echo phase keeps its own confirmation focus.
			void game.moves;
			void tick().then(() => continueButton?.focus());
		}
	});
	$effect(() => {
		if (!game.stacks?.[source]?.length)
			source = game.stacks?.findIndex((stack) => stack.length > 0) ?? -1;
		if (game.stacks?.[destination]?.length !== 0)
			destination = game.stacks?.findIndex((stack) => stack.length === 0) ?? -1;
	});

	function glyphFor(symbol: SymbolId) {
		return resolvedTheme?.symbols[SYMBOLS.findIndex((entry) => entry.id === symbol)];
	}
	function nameFor(symbol: SymbolId): string {
		const glyph = glyphFor(symbol);
		return t(glyph ? `symbol.${glyph.label}` : symbolLabel(symbol));
	}
	function ruleStatus(): string {
		if (rules.adjacentStacksOnly) return t('memory.strataLinked.ring');
		if (rules.deepestStackOnly)
			return t('memory.strataSweep.height', {
				count: Math.max(...(game.stacks ?? []).map((stack) => stack.length))
			});
		if (rules.canLiftTop)
			return t(game.shelf ? 'memory.strataShelf.origin' : 'memory.strataShelf.empty', {
				stack: labels[game.shelf?.stack ?? 0]
			});
		if (rules.sinkMissedTops) return t('memory.strataSlip.state');
		if (rules.canCycleTop) return t('memory.strataCycle.state');
		if (rules.canMoveToEmptyStack) return t('memory.strataEmptyWell.state');
		if (rules.peekBelowTop) return t('memory.strataGlimpse.state');
		if (rules.chainExposedMatches)
			return t(game.chain ? 'memory.strataChain.active' : 'memory.strataChain.state');
		if (rules.revealExposedTops)
			return t(echo ? 'memory.strataEcho.active' : 'memory.strataEcho.state');
		if (rules.orderedSymbols) {
			const required = game.excavationOrder?.[game.orderCursor ?? 0];
			return required
				? t('memory.strataOrder.required', { symbol: nameFor(required) })
				: t('memory.strataOrder.complete');
		}
		return '';
	}
	function utility(): void {
		if (rules.canLiftTop) onutility(game.shelf ? { return: 1 } : { lift: source });
		else if (rules.canMoveToEmptyStack) onutility({ from: source, to: destination });
		else onutility({ cycle: source });
	}
</script>

{#snippet face(index: number)}
	{@const card = game.cards[index]}
	<Symbol
		symbol={card.symbol}
		color={symbolColors.get(card.color) ?? card.color}
		glyph={glyphFor(card.symbol)}
		fillMode={resolvedTheme?.style.fill}
	/>
	<span class="face-name">{nameFor(card.symbol)}</span>
{/snippet}

<div
	class="strata"
	class:has-rules={!!ruleState}
	class:is-glimpse={rules.peekBelowTop}
	class:is-order={rules.orderedSymbols}
>
	{#if ruleState}
		<div class="rule-state">
			<p>{ruleState}</p>
			{#if rules.orderedSymbols}
				<ol class="order" aria-label={t('memory.strataOrder.sequence')}>
					{#each game.excavationOrder ?? [] as symbol, position (symbol)}
						<li
							class:cleared={position < (game.orderCursor ?? 0)}
							aria-current={position === (game.orderCursor ?? 0) ? 'step' : undefined}
							data-strata-order={position}
							aria-label={t('memory.strataOrder.position', {
								number: position + 1,
								symbol: nameFor(symbol)
							})}
						>
							<Symbol
								{symbol}
								color="var(--ink)"
								glyph={glyphFor(symbol)}
								fillMode={resolvedTheme?.style.fill}
							/>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}
	<div class="stacks">
		{#each tops as top, stack (stack)}
			{@const depth = game.stacks?.[stack].length ?? 0}
			<section class="pile" aria-label={t('memory.timeStrata.stack', { stack: labels[stack] })}>
				<div class="well">
					{#each Array.from({ length: Math.max(0, depth - 1) }).keys() as layer (layer)}
						<span class="covered" style:top={`${(layer + 1) * 4}px`} aria-hidden="true"></span>
					{/each}
					{#if top >= 0}
						{@const card = game.cards[top]}
						{@const faceUp = game.revealed.includes(top)}
						{#if echo && clues.includes(top)}
							<div
								class="strata-top is-face-up clue"
								role="img"
								data-strata-clue={top}
								aria-label={t('memory.strataEcho.clue', {
									stack: labels[stack],
									symbol: nameFor(card.symbol)
								})}
							>
								{@render face(top)}
								<span class="clue-label">{t('memory.strataEcho.readOnly')}</span>
							</div>
						{:else}
							<button
								type="button"
								class="strata-top"
								data-strata-top={stack}
								data-card-index={top}
								data-result={faceUp ? outcome : null}
								aria-label={t(faceUp ? 'memory.timeStrata.topUp' : 'memory.timeStrata.topDown', {
									stack: labels[stack],
									symbol: nameFor(card.symbol)
								})}
								aria-pressed={faceUp}
								disabled={locked || (!faceUp && !timeStrataCanSelect(game, top))}
								onclick={() => onflip(top)}
							>
								{#if faceUp}
									{@render face(top)}
								{:else}
									<span class="back-mark" aria-hidden="true"><i></i><i></i><i></i></span>
									<span class="top-label">{t('memory.timeStrata.top')}</span>
								{/if}
							</button>
						{/if}
					{:else}
						<div class="empty-well">{t('memory.timeStrata.empty')}</div>
					{/if}
				</div>
				<div class="pile-label">
					<strong>{t('memory.timeStrata.stack', { stack: labels[stack] })}</strong>
					<span>{t('memory.timeStrata.cards', { count: depth })}</span>
				</div>
				{#if rules.peekBelowTop}
					{@const clue = clues.find((index) => game.stacks?.[stack].includes(index))}
					<p class="below-clue" data-strata-clue={clue}>
						{#if clue !== undefined}{t('memory.strataGlimpse.below', {
								symbol: nameFor(game.cards[clue].symbol)
							})}{/if}
					</p>
				{/if}
			</section>
		{/each}
	</div>
	<p class="status" data-outcome={echo ? 'echo' : outcome}>
		{status || t('memory.timeStrata.ready')}
	</p>
	<div class="controls" class:with-utilities={utilityMode}>
		{#if game.shelf}
			{@const sample = game.cards[game.shelf.index]}
			<button
				type="button"
				class="shelf"
				data-strata-shelf
				data-card-index={game.shelf.index}
				aria-pressed={game.revealed.includes(game.shelf.index)}
				aria-label={t('memory.strataShelf.sample', {
					symbol: nameFor(sample.symbol),
					stack: labels[game.shelf.stack]
				})}
				disabled={locked ||
					(!game.revealed.includes(game.shelf.index) &&
						!timeStrataCanSelect(game, game.shelf.index))}
				onclick={() => onflip(game.shelf!.index)}
			>
				<Symbol
					symbol={sample.symbol}
					color={symbolColors.get(sample.color) ?? sample.color}
					glyph={glyphFor(sample.symbol)}
					fillMode={resolvedTheme?.style.fill}
				/>
				<span>{t('memory.strataShelf.face', { symbol: nameFor(sample.symbol) })}</span>
			</button>
		{/if}
		{#if utilityMode}
			<div class="utilities">
				{#if !game.shelf}
					<label>
						<span class="sr-only">{t('memory.strataUtility.source')}</span>
						<select bind:value={source} data-strata-source disabled={utilityLocked || source < 0}>
							{#each labels as label, stack (stack)}
								<option value={stack} disabled={!game.stacks?.[stack].length}
									>{t('memory.strataUtility.sourceStack', { stack: label })}</option
								>
							{/each}
						</select>
					</label>
				{/if}
				{#if rules.canMoveToEmptyStack}
					<label>
						<span class="sr-only">{t('memory.strataUtility.destination')}</span>
						<select
							bind:value={destination}
							data-strata-destination
							disabled={utilityLocked || destination < 0}
						>
							{#each labels as label, stack (stack)}
								<option value={stack} disabled={game.stacks?.[stack].length !== 0}
									>{t('memory.strataUtility.emptyStack', { stack: label })}</option
								>
							{/each}
						</select>
					</label>
				{/if}
				<button
					type="button"
					data-strata-utility={rules.canLiftTop
						? game.shelf
							? 'return'
							: 'lift'
						: rules.canMoveToEmptyStack
							? 'transfer'
							: 'cycle'}
					disabled={utilityLocked ||
						(!game.shelf && source < 0) ||
						(rules.canMoveToEmptyStack && destination < 0)}
					onclick={utility}
				>
					{t(
						rules.canLiftTop
							? game.shelf
								? 'memory.strataShelf.return'
								: 'memory.strataShelf.lift'
							: rules.canMoveToEmptyStack
								? 'memory.strataEmptyWell.move'
								: 'memory.strataCycle.cycle'
					)}
				</button>
			</div>
		{/if}
		<button
			type="button"
			class="continue"
			bind:this={continueButton}
			disabled={controlsLocked || !pending}
			onclick={oncontinue}
			>{t(echo ? 'memory.strataEcho.continue' : 'memory.timeStrata.continue')}</button
		>
		<button
			type="button"
			disabled={controlsLocked || pending || game.revealed.length !== 1}
			onclick={oncancel}>{t('memory.timeStrata.cancel')}</button
		>
	</div>
</div>

<style>
	.strata {
		--card-width: 108px;
		--card-height: 108px;
		display: grid;
		gap: 12px;
		width: 100%;
	}
	.stacks {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px 16px;
	}
	.pile {
		min-width: 0;
		display: grid;
		justify-items: center;
		gap: 4px;
	}
	.well {
		position: relative;
		width: var(--card-width);
		height: calc(var(--card-height) + 16px);
	}
	.covered,
	.strata-top,
	.empty-well {
		position: absolute;
		inset: 0 auto auto 0;
		width: var(--card-width);
		height: var(--card-height);
		border: 2px solid var(--memory-edge);
		border-radius: 12px;
		background: var(--memory-back);
	}
	.covered {
		pointer-events: none;
	}
	.strata-top {
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	.strata-top[aria-pressed='true'],
	.strata-top.is-face-up {
		background: var(--memory-face);
		border-color: var(--ink);
	}
	.strata-top[data-result='match'] {
		border-color: var(--success);
	}
	.strata-top[data-result='mismatch'],
	.strata-top[data-result='order-blocked'] {
		border-color: var(--danger);
	}
	.strata-top :global(.symbol) {
		width: 52px;
		height: 52px;
	}
	.strata-top:disabled {
		cursor: default;
	}
	.back-mark {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 36px;
	}
	.back-mark i {
		height: 3px;
		border-radius: 2px;
		background: var(--ink-2);
	}
	.back-mark i:nth-child(2) {
		width: 26px;
		align-self: center;
	}
	.back-mark i:nth-child(3) {
		width: 16px;
		align-self: center;
	}
	.top-label,
	.face-name,
	.pile-label {
		font-size: 12px;
		font-weight: 800;
		line-height: 1.35;
	}
	.top-label,
	.pile-label span {
		color: var(--ink-2);
	}
	.pile-label {
		text-align: center;
	}
	.pile-label strong,
	.pile-label span {
		display: block;
	}
	.empty-well {
		display: grid;
		place-items: center;
		border-style: dashed;
		background: transparent;
		color: var(--ink-2);
		font-size: 13px;
	}
	.status {
		margin: 0;
		min-height: 36px;
		font-size: 13px;
		font-weight: 800;
		text-align: center;
	}
	.controls {
		display: flex;
		justify-content: center;
		gap: 8px;
	}
	.controls.with-utilities {
		flex-wrap: wrap;
	}
	.utilities {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.utilities label {
		min-width: 0;
	}
	.rule-state {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 4px 8px;
		font-size: 12px;
		font-weight: 800;
		text-align: center;
	}
	.rule-state p {
		margin: 0;
	}
	.order {
		display: flex;
		gap: 2px;
		padding: 0;
		margin: 0;
		list-style: none;
	}
	.order li {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 1px solid transparent;
		border-radius: 4px;
	}
	.order li[aria-current='step'] {
		border-color: var(--ink);
		background: var(--memory-face);
	}
	.order .cleared {
		opacity: 0.4;
	}
	.order :global(.symbol) {
		width: 18px;
		height: 18px;
	}
	.below-clue {
		min-height: 16px;
		margin: 0;
		font-size: 11px;
		font-weight: 800;
		text-align: center;
	}
	.clue {
		cursor: default;
	}
	.clue-label {
		font-size: 10px;
		font-weight: 800;
	}
	.controls .shelf {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--memory-face);
	}
	.shelf :global(.symbol) {
		width: 24px;
		height: 24px;
	}
	.shelf[aria-pressed='true'] {
		border-color: var(--ink);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.controls button,
	.controls select {
		min-width: 44px;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--memory-edge);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 800;
		cursor: pointer;
	}
	.controls .continue {
		background: var(--ink);
		color: var(--surface);
	}
	.controls button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}
	@media (min-width: 1024px), (orientation: landscape) {
		.stacks {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) and (min-height: 561px) {
		.strata {
			--card-width: 128px;
			--card-height: 160px;
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		.strata {
			--card-width: 76px;
			--card-height: 88px;
			gap: 4px;
		}
		.stacks {
			gap: 8px;
		}
		.strata-top {
			gap: 4px;
		}
		.strata.has-rules {
			--card-height: 76px;
		}
		.has-rules .status {
			min-height: 30px;
		}
		.strata.is-glimpse,
		.strata.is-order {
			gap: 2px;
		}
		.is-glimpse .pile,
		.is-order .pile {
			gap: 2px;
		}
		.is-glimpse .pile-label {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			white-space: nowrap;
		}
		.is-glimpse .status,
		.is-order .status {
			min-height: 16px;
			line-height: 1.25;
		}
		.is-glimpse .below-clue {
			min-height: 14px;
			line-height: 1.25;
		}
		.has-rules .clue {
			padding: 4px;
			gap: 2px;
		}
		.has-rules .clue :global(.symbol) {
			width: 32px;
			height: 32px;
		}
		.has-rules .controls,
		.has-rules .utilities {
			gap: 4px;
		}
		.has-rules .controls button,
		.has-rules .controls select {
			font-size: 11px;
			padding: 6px 8px;
		}
		.strata-top :global(.symbol) {
			width: 40px;
			height: 40px;
		}
		.status,
		.controls button,
		.face-name,
		.pile-label {
			font-size: 11px;
		}
	}
</style>
