/** Owner-authorized offline asset generation. Never imported by the app. */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const palette =
	'Original Morphi.One tactile puzzle UI. Dry close warm felt, ceramic and wood. Single immediate fast gesture, clean short decay. No speech, music, arcade beeps or background noise. ';
export const sounds = [
	[
		'flip',
		0.5,
		'A single light folded-paper flick with a tiny porcelain fingertip tick. Gesture under 100 milliseconds.'
	],
	[
		'match',
		0.5,
		'Two small porcelain halves click together, with a warm hollow resonant sparkle rising very slightly. Successful matching pair, under 300 milliseconds.'
	],
	[
		'mismatch',
		0.5,
		'Two soft felt-covered pebbles brush past each other and land with a gentle uneven double wooden knock. Friendly wrong pair, no harsh buzzer. Under 300 milliseconds.'
	],
	[
		'win',
		1.0,
		'Three tiny ceramic tiles tumble into a satisfying final fit, airy crystalline dust and a warm resonant finish. Celebratory completion flourish under 800 milliseconds.'
	],
	[
		'pick',
		0.5,
		'A small walnut puzzle piece lifts off felt with a delicate dry suction tick. Under 100 milliseconds.'
	],
	[
		'deselect',
		0.5,
		'A light wooden puzzle piece settles back onto a felt tray, muted soft tap. Under 100 milliseconds.'
	],
	[
		'place',
		0.5,
		'A chunky ceramic-coated wooden tile fits snugly into a grid, close warm clack with a tiny felt bottom. Under 150 milliseconds.'
	],
	[
		'invalid',
		0.5,
		'A wooden tile softly bumps a cork edge and recoils, two muted fluttery taps, gentle unavailable feedback. Under 200 milliseconds.'
	],
	[
		'clear',
		0.7,
		'Eight tiny ceramic beads unzip in a crisp flowing cascade from left to right, followed by a soft airy sweep. Satisfying cleared puzzle line. Under 600 milliseconds.'
	],
	[
		'combo',
		0.8,
		'Two interlocking cascades of small hollow porcelain clicks, brighter than a single clear, finished with a short warm shimmer. Multiple lines cleared together. Under 700 milliseconds.'
	],
	[
		'refill',
		0.5,
		'Three walnut puzzle pieces gently slide into a felt tray with a compact triplet of distinct close ticks. Under 250 milliseconds.'
	],
	[
		'end',
		0.8,
		'A final wooden tile rolls softly to rest against two ceramic tiles, warm low hollow resonance fading peacefully. Puzzle round complete, calm and inviting. Under 600 milliseconds.'
	],
	[
		'deal',
		0.6,
		'A short delicate fan of paper cards sliding through the air, ending in a soft ceramic tile click. Start of a fresh puzzle, under 500 milliseconds.'
	],
	[
		'connect-start',
		0.5,
		'One soft ceramic dot touches a felt grid, a clear restrained tap. Path begins, under 150 milliseconds.'
	],
	[
		'connect-appear',
		0.6,
		'An original Connect puzzle board arriving: a brief inward ripple of small ceramic grid cells, then two dots landing together with a warm paired tick. No paper cards. Under 500 milliseconds.'
	],
	[
		'connect-extend',
		0.5,
		'A single quiet flowing wooden bead slide across a felt grid, crisp and short, under 150 milliseconds.'
	],
	[
		'connect-backtrack',
		0.5,
		'A single tiny ceramic path bead slides backward along felt and settles softly, descending and shorter than a forward draw. Under 200 milliseconds.'
	],
	[
		'connect-pair',
		0.5,
		'Two small ceramic dots join with a warm resonant double tick, a gentle completed connection, under 300 milliseconds.'
	],
	[
		'connect-cut',
		0.5,
		'A small line of felt beads retracts with a soft quick descending zip, friendly path cut, under 300 milliseconds.'
	],
	[
		'connect-redraw',
		0.5,
		'A muted dry wooden eraser flick and tiny low tick, calm redraw cost, under 200 milliseconds.'
	],
	[
		'connect-invalid',
		0.5,
		'A Connect path tip touches a closed ceramic edge and gently springs back with a short muted felt bump. No harsh buzzer, under 200 milliseconds.'
	],
	[
		'connect-win',
		0.8,
		'A full grid of tiny ceramic dots joins in one airy left-to-right cascade ending in a warm clear completion chord, under 700 milliseconds.'
	],
	[
		'trio-match',
		0.6,
		'Three small porcelain tiles click together in one quick cluster, a warm hollow resonant finish, a touch fuller than a single pair click. Successful set of three, under 350 milliseconds.'
	],
	[
		'reshuffle',
		0.6,
		'A handful of small walnut and ceramic tiles slide softly across felt and settle into new spots, a short dry scatter with two gentle rests. Cards moving to new places after a miss, under 400 milliseconds.'
	],
	[
		'timer-tick',
		0.5,
		'A tiny dry wooden tick on felt, quiet and steady, a single soft click. Under 80 milliseconds.'
	]
] as const;

type GeneratedSound = { source: Buffer; bytes: Buffer; credits: number | null };
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function generateSounds(
	directory: string,
	generate: (sound: (typeof sounds)[number]) => Promise<GeneratedSound>
): Promise<void> {
	const manifestPath = join(directory, 'manifest.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
		sounds: Record<string, unknown>;
	};
	const staging = mkdtempSync(join(directory, '.generate-'));
	const published: string[] = [];
	try {
		for (const sound of sounds) {
			const [name, durationSeconds, description] = sound;
			if (existsSync(join(directory, `${name}.mp3`))) {
				if (!manifest.sounds[name]) throw new Error('Existing audio lacks provenance');
				continue;
			}
			const { source, bytes, credits } = await generate(sound);
			writeFileSync(join(staging, `${name}.mp3`), bytes);
			manifest.sounds[name] = {
				file: `${name}.mp3`,
				durationSeconds,
				prompt: palette + description,
				sha256: sha256(bytes),
				sourceSha256: sha256(source),
				processing:
					'Leading silence trimmed (-60 dBFS), -3 dB gain, padded/trimmed to requested duration, mono MP3 44.1 kHz / 64 kbps; decoded peak <= -1 dBFS',
				generatedAt: new Date().toISOString().slice(0, 10),
				credits
			};
		}
		writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
		for (const [name] of sounds) {
			const staged = join(staging, `${name}.mp3`);
			if (!existsSync(staged)) continue;
			const destination = join(directory, `${name}.mp3`);
			renameSync(staged, destination);
			published.push(destination);
		}
		renameSync(join(staging, 'manifest.json'), manifestPath);
	} catch (error) {
		for (const path of published) rmSync(path);
		throw error;
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
}

function ffmpeg(source: Buffer, arguments_: string[]): Buffer {
	const result = spawnSync(
		'ffmpeg',
		['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', ...arguments_],
		{
			input: source,
			maxBuffer: 8 * 1024 * 1024
		}
	);
	if (result.status !== 0) throw new Error('Audio processing failed');
	return result.stdout;
}

export function processSound(source: Buffer, durationSeconds: number): Buffer {
	if (source.length < 1000) throw new Error('Empty audio');
	const bytes = ffmpeg(source, [
		'-af',
		`silenceremove=start_periods=1:start_threshold=-60dB,volume=-3dB,apad,atrim=duration=${durationSeconds}`,
		'-ac',
		'1',
		'-ar',
		'44100',
		'-b:a',
		'64k',
		'-f',
		'mp3',
		'pipe:1'
	]);
	const pcm = ffmpeg(bytes, ['-ac', '1', '-ar', '44100', '-f', 'f32le', 'pipe:1']);
	let peak = 0;
	for (let offset = 0; offset < pcm.length; offset += 4)
		peak = Math.max(peak, Math.abs(pcm.readFloatLE(offset)));
	const seconds = pcm.length / 4 / 44100;
	console.log(
		`Processed audio: ${bytes.length} bytes, ${seconds.toFixed(3)} s, ${(20 * Math.log10(peak)).toFixed(2)} dBFS`
	);
	if (
		bytes.length >= 12000 ||
		Math.abs(seconds - durationSeconds) > 0.15 ||
		!Number.isFinite(peak) ||
		peak === 0 ||
		20 * Math.log10(peak) > -1
	)
		throw new Error('Audio acceptance check failed');
	return bytes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const local = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
		const apiKey = local.match(/^ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)?.[1]?.trim();
		if (!apiKey || spawnSync('ffmpeg', ['-version']).status !== 0)
			throw new Error('Local key or ffmpeg unavailable');
		const client = new ElevenLabsClient({ apiKey });
		const sourceDirectory = 'build/v1.3.1/audio-source';
		mkdirSync(sourceDirectory, { recursive: true });
		await generateSounds('static/audio', async ([name, durationSeconds, description]) => {
			const { data, rawResponse } = await client.textToSoundEffects
				.convert(
					{
						text: palette + description,
						durationSeconds,
						promptInfluence: 0.75,
						modelId: 'eleven_text_to_sound_v2',
						outputFormat: 'mp3_44100_128'
					},
					{ timeoutInSeconds: 120, maxRetries: 0 }
				)
				.withRawResponse();
			const source = Buffer.from(await new Response(data).arrayBuffer());
			const cost = rawResponse.headers.get('character-cost');
			const credits = cost !== null && /^\d+$/.test(cost) ? Number(cost) : null;
			console.log(`Generated ${name}; credits=${credits ?? 'not returned'}`);
			// Keep charged source audio for manual recovery if local processing fails.
			writeFileSync(join(sourceDirectory, `${name}.mp3`), source);
			return { source, bytes: processSound(source, durationSeconds), credits };
		});
	} catch (error) {
		// Provider requests, errors and response bodies can contain credentials.
		const safeReasons = ['Empty audio', 'Audio processing failed', 'Audio acceptance check failed'];
		if (error instanceof Error && safeReasons.includes(error.message)) console.error(error.message);
		console.error(
			'Sound generation failed; existing manifest preserved. No provider details logged.'
		);
		process.exitCode = 1;
	}
}
