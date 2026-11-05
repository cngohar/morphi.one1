import { asset } from '$app/paths';
export type SoundKind =
	| 'flip'
	| 'match'
	| 'mismatch'
	| 'win'
	| 'pick'
	| 'deselect'
	| 'place'
	| 'invalid'
	| 'clear'
	| 'combo'
	| 'refill'
	| 'end'
	| 'deal'
	| 'connect-start'
	| 'connect-appear'
	| 'connect-extend'
	| 'connect-backtrack'
	| 'connect-pair'
	| 'connect-cut'
	| 'connect-redraw'
	| 'connect-invalid'
	| 'connect-win'
	| 'trio-match'
	| 'reshuffle'
	| 'timer-tick';
const kinds: SoundKind[] = [
	'flip',
	'match',
	'mismatch',
	'win',
	'pick',
	'deselect',
	'place',
	'invalid',
	'clear',
	'combo',
	'refill',
	'end',
	'deal',
	'connect-start',
	'connect-appear',
	'connect-extend',
	'connect-backtrack',
	'connect-pair',
	'connect-cut',
	'connect-redraw',
	'connect-invalid',
	'connect-win',
	'trio-match',
	'reshuffle',
	'timer-tick'
];
class SoundEngine {
	private context: AudioContext | null = null;
	private enabled = true;
	private buffers = new Map<SoundKind, AudioBuffer>();
	private loading = new Map<SoundKind, Promise<void>>();
	private active = new Set<AudioBufferSourceNode>();
	private warned = new Set<SoundKind>();
	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		if (!enabled) this.stop();
		else this.unlock();
	}
	private stop() {
		for (const node of this.active) {
			try {
				node.stop();
			} catch {
				/* Already ended. */
			}
		}
		this.active.clear();
	}
	unlock() {
		if (typeof window === 'undefined' || !this.enabled) return;
		try {
			if (!this.context) {
				this.context = new AudioContext();
				document.addEventListener('visibilitychange', () => {
					if (document.hidden) this.stop();
				});
			}
			if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
			for (const kind of kinds) this.load(kind);
		} catch {
			console.warn('morphi:audio_unavailable');
		}
	}
	private load(kind: SoundKind) {
		if (!this.context || this.buffers.has(kind) || this.loading.has(kind)) return;
		const context = this.context;
		const task = fetch(asset(`audio/${kind}.mp3`))
			.then(async (response) => {
				if (!response.ok) throw new Error('sound_asset');
				const buffer = await context.decodeAudioData(await response.arrayBuffer());
				this.buffers.set(kind, buffer);
			})
			.catch(() => {
				if (!this.warned.has(kind)) {
					this.warned.add(kind);
					console.warn('morphi:sound_asset_unavailable', { kind });
				}
			});
		this.loading.set(kind, task);
	}
	play(kind: SoundKind, step = 0) {
		if (!this.enabled || typeof document === 'undefined' || document.hidden) return;
		this.unlock();
		const context = this.context,
			buffer = this.buffers.get(kind);
		// Never play late feedback after an asset fetch completes.
		if (!context || context.state !== 'running' || !buffer) return;
		try {
			if (this.active.size >= 6) {
				const oldest = this.active.values().next().value;
				oldest?.stop();
				if (oldest) this.active.delete(oldest);
			}
			const node = context.createBufferSource(),
				gain = context.createGain();
			node.buffer = buffer;
			node.playbackRate.value =
				kind === 'match' || kind === 'trio-match' || kind === 'combo'
					? 1 + Math.min(Math.max(step, 0), 4) * 0.025
					: 1;
			gain.gain.value = kind === 'win' || kind === 'end' ? 0.24 : 0.18;
			node.connect(gain);
			gain.connect(context.destination);
			this.active.add(node);
			node.onended = () => {
				this.active.delete(node);
				node.disconnect();
				gain.disconnect();
			};
			node.start();
		} catch {
			console.warn('morphi:sound_playback_failed', { kind });
		}
	}
}
export const sound = new SoundEngine();
