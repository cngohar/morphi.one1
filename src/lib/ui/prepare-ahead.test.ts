import { afterEach, expect, it, vi } from 'vitest';
import { createPreparationSlot } from './prepare-ahead.js';
afterEach(() => vi.restoreAllMocks());

it('overlaps work, deduplicates warmups and consumes a prepared candidate once', async () => {
	let finish!: (value: string) => void;
	const prepare = vi.fn(
		() =>
			new Promise<string>((resolve) => {
				finish = resolve;
			})
	);
	const slot = createPreparationSlot(prepare);
	const warming = slot.warm('memory');
	expect(slot.warm('memory')).toBe(warming);
	await Promise.resolve();
	expect(prepare).toHaveBeenCalledTimes(1);
	const taking = slot.take('memory');
	finish('ready');
	expect(await taking).toBe('ready');
	slot.warm('memory');
	await Promise.resolve();
	expect(prepare).toHaveBeenCalledTimes(2);
	slot.dispose();
	finish('late');
});

it('contains failed speculation and allows a later foreground retry', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const prepare = vi.fn().mockRejectedValueOnce(new Error('worker')).mockResolvedValue('retry');
	const slot = createPreparationSlot(prepare);
	await slot.warm('block');
	expect(await slot.take('block')).toBeNull();
	expect(await slot.take('block')).toBe('retry');
	expect(prepare.mock.calls.map(([family]) => family)).toEqual(['block', 'block']);
});

it('ignores stale work after a family switch or navigation', async () => {
	const resolvers: ((value: string) => void)[] = [];
	const signals: AbortSignal[] = [];
	const slot = createPreparationSlot((_, signal) => {
		signals.push(signal);
		return new Promise<string>((resolve) => resolvers.push(resolve));
	});
	const old = slot.warm('block');
	await Promise.resolve();
	const next = slot.warm('memory');
	await Promise.resolve();
	expect(signals[0].aborted).toBe(true);
	resolvers[0]('stale');
	expect(await old).toBeNull();
	slot.dispose();
	expect(signals[1].aborted).toBe(true);
	resolvers[1]('late');
	expect(await next).toBeNull();
	expect(await slot.warm('memory')).toBeNull();
});
