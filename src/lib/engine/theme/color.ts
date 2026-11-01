/** Cosmetic color math only. Never import this module into puzzle rules. */
export type Color = readonly [number, number, number];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgb(hex: string): Color {
	if (!/^#[\da-f]{6}$/i.test(hex)) throw new RangeError('theme_color');
	return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as Color;
}
export function hex(color: Color): string {
	return (
		'#' +
		color
			.map((v) =>
				Math.round(clamp(v) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}
export function luminance(color: string): number {
	const [r, g, b] = rgb(color).map(decode);
	return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
export function contrast(a: string, b: string): number {
	const x = luminance(a),
		y = luminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function blend(foreground: string, background: string, alpha: number): string {
	const a = rgb(foreground),
		b = rgb(background);
	return hex(a.map((v, i) => v * alpha + b[i] * (1 - alpha)) as unknown as Color);
}

/** OKLCH to sRGB; reduce chroma until in gamut instead of clipping hue. */
export function oklch(lightness: number, chroma: number, hue: number): string {
	const angle = (hue * Math.PI) / 180;
	let linear: number[] = [];
	for (let attempt = 0; attempt < 32; attempt++) {
		const a = chroma * Math.cos(angle),
			b = chroma * Math.sin(angle);
		const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
		const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
		const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
		linear = [
			4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
		];
		if (linear.every((v) => v >= 0 && v <= 1)) break;
		chroma *= 0.85;
	}
	return hex(linear.map((v) => encode(clamp(v))) as unknown as Color);
}
export function colorAtContrast(
	chroma: number,
	hue: number,
	target: number,
	ground = '#ffffff'
): string {
	let low = 0.05,
		high = 0.98;
	for (let i = 0; i < 24; i++) {
		const mid = (low + high) / 2;
		if (contrast(oklch(mid, chroma, hue), ground) < target) high = mid;
		else low = mid;
	}
	return oklch(low, chroma, hue);
}

// Machado, Oliveira & Fernandes 2009, published severity 1.0 matrices.
// Apply to LINEAR sRGB. These are not the gamma-space matrices in the handoff.
export const MACHADO = [
	[
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998]
	],
	[
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881]
	],
	[
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039]
	]
] as const;
export function simulate(color: string, mode: number): Color {
	const linear = rgb(color).map(decode);
	if (mode < 0) return linear as unknown as Color;
	return MACHADO[mode].map((row) =>
		clamp(row.reduce((sum, v, i) => sum + v * linear[i], 0))
	) as unknown as Color;
}
function lab([r, g, b]: Color): Color {
	const f = (v: number) => (v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116);
	const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
	const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
	const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
	return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function minimumDifference(colors: readonly string[]): number {
	let minimum = Infinity;
	for (let mode = -1; mode < 3; mode++) {
		const values = colors.map((c) => lab(simulate(c, mode)));
		for (let i = 0; i < values.length; i++)
			for (let j = i + 1; j < values.length; j++) {
				minimum = Math.min(minimum, Math.hypot(...values[i].map((v, k) => v - values[j][k])));
			}
	}
	return minimum;
}
