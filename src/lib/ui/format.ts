const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value: number): string {
	return numberFormat.format(Math.max(0, Math.floor(value)));
}

export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(seconds / 60);
	return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
