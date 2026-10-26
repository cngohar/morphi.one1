import { replayBatch, workloads } from './benchmark.js';
import { cpus } from 'node:os';
const output = [];
for (const workload of workloads) {
	replayBatch(workload.name, 100);
	const times: number[] = [];
	let heapMax = process.memoryUsage().heapUsed;
	for (let run = 0; run < 5; run++) {
		const start = process.cpuUsage();
		const result = replayBatch(workload.name, 1000);
		const cpu = process.cpuUsage(start);
		times.push((cpu.user + cpu.system) / 1000 / result.iterations);
		heapMax = Math.max(heapMax, process.memoryUsage().heapUsed);
	}
	times.sort((a, b) => a - b);
	output.push({
		workload: workload.name,
		moves: workload.moves.length,
		runs: 5,
		replaysPerRun: 1000,
		medianCpuMs: times[2],
		p95CpuMs: times[4],
		observedHeapBytes: heapMax,
		processPeakRssKiB: process.resourceUsage().maxRSS
	});
}
console.info(
	JSON.stringify(
		{
			runtime: process.version,
			device: cpus()[0]?.model,
			network: 'none, pure replay',
			state: 'warmed',
			measurements: output
		},
		null,
		2
	)
);
