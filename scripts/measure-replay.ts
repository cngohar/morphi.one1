import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
const execute = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'morphi-replay-measure-'));
let worker: ReturnType<typeof spawn> | undefined;
let socket: WebSocket | undefined;
try {
	await execute('bun', [
		'build',
		'tests/vectors/benchmark-node.ts',
		'--target',
		'node',
		'--outfile',
		join(directory, 'node.mjs')
	]);
	console.info((await execute('node', [join(directory, 'node.mjs')])).stdout.trim());
	await execute('bun', [
		'build',
		'tests/vectors/worker.ts',
		'--target',
		'browser',
		'--outfile',
		join(directory, 'worker.mjs')
	]);
	await writeFile(
		join(directory, 'wrangler.jsonc'),
		JSON.stringify({
			name: 'morphi-replay-measure',
			main: './worker.mjs',
			compatibility_date: '2026-10-22',
			workers_dev: false
		})
	);
	worker = spawn(
		'bunx',
		[
			'wrangler',
			'dev',
			'--config',
			join(directory, 'wrangler.jsonc'),
			'--local',
			'--port',
			'8796',
			'--inspector-port',
			'9236',
			'--log-level',
			'error'
		],
		{ stdio: 'ignore' }
	);
	let targets: { webSocketDebuggerUrl: string }[] = [];
	for (let i = 0; i < 120; i++) {
		try {
			await fetch('http://127.0.0.1:8796');
			targets = (await (await fetch('http://127.0.0.1:9236/json/list')).json()) as typeof targets;
			if (targets.length) break;
		} catch {
			/* Local inspector booting. */
		}
		await delay(250);
	}
	if (!targets[0]) throw new Error('Local Worker inspector unavailable.');
	socket = new WebSocket(targets[0].webSocketDebuggerUrl);
	await new Promise<void>((resolve, reject) => {
		socket!.addEventListener('open', () => resolve(), { once: true });
		socket!.addEventListener('error', () => reject(new Error('Inspector connection failed')), {
			once: true
		});
	});
	let serial = 0;
	const contexts: number[] = [];
	const pending = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void }
	>();
	socket.addEventListener('message', (event) => {
		const packet = JSON.parse(String(event.data)) as {
			id?: number;
			method?: string;
			params?: { context?: { id: number } };
			result: unknown;
			error?: { message: string };
		};
		if (packet.method === 'Runtime.executionContextCreated' && packet.params?.context)
			contexts.push(packet.params.context.id);
		if (!packet.id) return;
		const call = pending.get(packet.id);
		pending.delete(packet.id);
		if (packet.error) call?.reject(new Error(packet.error.message));
		else call?.resolve(packet.result);
	});
	function request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
		return new Promise((resolve, reject) => {
			const id = ++serial;
			pending.set(id, { resolve: (value) => resolve(value as T), reject });
			socket!.send(JSON.stringify({ id, method, params }));
		});
	}
	interface Profile {
		nodes: { id: number; callFrame: { functionName: string }; children?: number[] }[];
		samples: number[];
		timeDeltas: number[];
	}
	await request('Runtime.enable');
	await fetch('http://127.0.0.1:8796');
	await delay(300);
	let contextId: number | undefined;
	for (const candidate of contexts) {
		const checked = await request<{ result?: { value?: string } }>('Runtime.evaluate', {
			expression: 'typeof globalThis.replayMorphiBatch',
			contextId: candidate,
			returnByValue: true
		});
		if (checked.result?.value === 'function') {
			contextId = candidate;
			break;
		}
	}
	if (contextId === undefined)
		throw new Error('Replay execution context not found: ' + JSON.stringify({ targets, contexts }));
	await request('Profiler.enable');
	await request('Profiler.setSamplingInterval', { interval: 100 });
	const measurements = [];
	for (const name of ['block-cap', 'memory-move-cap']) {
		await request('Runtime.evaluate', {
			contextId,
			expression: `globalThis.replayMorphiBatch('${name}',100)`,
			returnByValue: true
		});
		const times: number[] = [];
		let heapMax = 0,
			totalHeapMax = 0;
		for (let run = 0; run < 5; run++) {
			await request('Profiler.start');
			const evaluated = await request<{ exceptionDetails?: unknown }>('Runtime.evaluate', {
				contextId,
				expression: `globalThis.replayMorphiBatch('${name}',1000)`,
				returnByValue: true
			});
			if (evaluated.exceptionDetails) throw new Error('Worker replay failed.');
			const { profile } = await request<{ profile: Profile }>('Profiler.stop');
			const parents = new Map<number, number>();
			const names = new Map(profile.nodes.map((node) => [node.id, node.callFrame.functionName]));
			for (const node of profile.nodes)
				for (const child of node.children ?? []) parents.set(child, node.id);
			let micros = 0;
			for (let index = 0; index < profile.samples.length; index++) {
				let node: number | undefined = profile.samples[index];
				while (node !== undefined) {
					if (names.get(node) === 'replayBatch') {
						micros += profile.timeDeltas[index] ?? 0;
						break;
					}
					node = parents.get(node);
				}
			}
			times.push(micros / 1000 / 1000);
			const heap = await request<{ usedSize: number; totalSize: number }>('Runtime.getHeapUsage');
			heapMax = Math.max(heapMax, heap.usedSize);
			totalHeapMax = Math.max(totalHeapMax, heap.totalSize);
		}
		times.sort((a, b) => a - b);
		measurements.push({
			workload: name,
			runs: 5,
			replaysPerRun: 1000,
			medianSampledReplayCpuMs: times[2],
			p95SampledReplayCpuMs: times[4],
			maxObservedHeapUsedBytes: heapMax,
			maxObservedHeapAllocatedBytes: totalHeapMax
		});
	}
	console.info(
		JSON.stringify(
			{
				runtime: 'local workerd, V8 inspector CPU samples',
				network: 'none during replay; local inspector transport',
				state: 'warmed',
				memoryMethod:
					'Maximum of five post-batch heap observations; not an allocation-time peak or production-isolate guarantee.',
				measurements
			},
			null,
			2
		)
	);
} finally {
	socket?.close();
	worker?.kill();
	await rm(directory, { recursive: true, force: true });
}
