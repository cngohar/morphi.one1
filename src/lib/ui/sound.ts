export type SoundKind =
	'flip' | 'match' | 'mismatch' | 'win' | 'pick' | 'place' | 'invalid' | 'clear' | 'end';

class SoundEngine {
	private context: AudioContext | null = null;
	private enabled = true;

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	unlock(): void {
		this.ensureContext();
	}

	play(kind: SoundKind, step = 0): void {
		if (!this.enabled) {
			return;
		}

		const context = this.ensureContext();
		if (!context) {
			return;
		}

		switch (kind) {
			case 'flip':
				this.tone(context, 560, 0, 0.055, 'sine', 0.035);
				break;
			case 'match': {
				const lift = 1 + Math.min(Math.max(step, 0), 4) * 0.06;
				this.tone(context, 660 * lift, 0, 0.09, 'sine', 0.055);
				this.tone(context, 880 * lift, 0.08, 0.14, 'sine', 0.05);
				break;
			}
			case 'mismatch':
				this.tone(context, 170, 0, 0.12, 'triangle', 0.045);
				this.tone(context, 130, 0.1, 0.14, 'triangle', 0.035);
				break;
			case 'win':
				[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
					this.tone(context, frequency, index * 0.085, 0.22, 'sine', 0.05);
				});
				break;
			case 'pick':
				this.tone(context, 360, 0, 0.05, 'sine', 0.035);
				break;
			case 'place':
				this.tone(context, 240, 0, 0.06, 'sine', 0.045);
				break;
			case 'invalid':
				this.tone(context, 120, 0, 0.09, 'square', 0.035);
				break;
			case 'clear': {
				const lift = Math.min(Math.max(step, 0), 8) * 40;
				this.tone(context, 520 + lift, 0, 0.1, 'sine', 0.05);
				this.tone(context, 780 + lift, 0.06, 0.14, 'sine', 0.04);
				break;
			}
			case 'end':
				this.tone(context, 280, 0, 0.18, 'sine', 0.05);
				this.tone(context, 180, 0.12, 0.24, 'sine', 0.04);
				break;
		}
	}

	private ensureContext(): AudioContext | null {
		if (typeof window === 'undefined') {
			return null;
		}

		try {
			if (!this.context) {
				this.context = new window.AudioContext();
			}

			if (this.context.state === 'suspended') {
				void this.context.resume().catch(() => undefined);
			}

			return this.context;
		} catch {
			return null;
		}
	}

	private tone(
		context: AudioContext,
		frequency: number,
		delay: number,
		duration: number,
		type: OscillatorType,
		volume: number
	): void {
		try {
			const start = context.currentTime + delay;
			const oscillator = context.createOscillator();
			const gain = context.createGain();

			oscillator.type = type;
			oscillator.frequency.setValueAtTime(frequency, start);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

			oscillator.connect(gain);
			gain.connect(context.destination);
			oscillator.start(start);
			oscillator.stop(start + duration + 0.02);
		} catch {
			// Audio is feedback, never a blocker.
		}
	}
}

export const sound = new SoundEngine();
