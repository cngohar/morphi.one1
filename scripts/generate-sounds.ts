/** Owner-authorized offline asset generation. Never imported by the app. */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const local = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const match = local.match(/^ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m);
const apiKey = process.env.ELEVENLABS_API_KEY || match?.[1]?.trim();
if (!apiKey) throw new Error('ELEVENLABS_API_KEY missing; no request sent');
const client = new ElevenLabsClient({ apiKey });
const palette =
	'Original Morphi.One tactile puzzle UI. Dry close warm felt, ceramic and wood. Single immediate fast gesture, clean short decay. No speech, music, arcade beeps or background noise. ';
const sounds = [
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
	]
] as const;
const previous = existsSync('static/audio/manifest.json')
	? (JSON.parse(readFileSync('static/audio/manifest.json', 'utf8')).sounds as Record<
			string,
			unknown
		>)
	: {};
const manifest: Record<string, unknown> = {};
for (const [name, durationSeconds, description] of sounds) {
	const path = `static/audio/${name}.mp3`;
	if (!existsSync(path)) {
		try {
			const stream = await client.textToSoundEffects.convert(
				{
					text: palette + description,
					durationSeconds,
					promptInfluence: 0.75,
					modelId: 'eleven_text_to_sound_v2',
					outputFormat: 'mp3_44100_128'
				},
				{ timeoutInSeconds: 120, maxRetries: 0 }
			);
			const buffer = Buffer.from(await new Response(stream).arrayBuffer());
			if (buffer.length < 1000) throw new Error('empty audio');
			writeFileSync(path, buffer);
			console.log(`Generated ${name}: ${buffer.length} bytes`);
		} catch (error) {
			// Never serialize provider request objects: they can contain credentials.
			console.error(
				`Generation failed for ${name}; status=${error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : 'unknown'}`
			);
			if (error && typeof error === 'object' && 'body' in error) {
				const body = error.body as { detail?: { status?: string; message?: string } };
				console.error(
					JSON.stringify({ providerStatus: body.detail?.status, message: body.detail?.message })
				);
			}
			process.exitCode = 1;
			break;
		}
	}
	const bytes = readFileSync(path);
	manifest[name] = previous[name] ?? {
		file: `${name}.mp3`,
		durationSeconds,
		prompt: palette + description,
		sha256: createHash('sha256').update(bytes).digest('hex')
	};
}
writeFileSync(
	'static/audio/manifest.json',
	JSON.stringify(
		{
			provider: 'ElevenLabs',
			model: 'eleven_text_to_sound_v2',
			sdk: '2.74.0',
			generated: '2026-10-25',
			sounds: manifest
		},
		null,
		2
	) + '\n'
);
