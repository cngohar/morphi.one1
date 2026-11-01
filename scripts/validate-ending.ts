export function validateEnding(
	id: string,
	ending: unknown,
	catalog: Readonly<Record<string, string>>
): void {
	const fail = () => {
		throw new Error(`Invalid ending declaration for ${id}`);
	};
	if (!ending || typeof ending !== 'object') return fail();
	const value = ending as Record<string, unknown>;
	if (
		(value.kind !== 'completion' && value.kind !== 'run_over') ||
		value.animation !== 'fade-rise' ||
		value.continue !== 'auto_500ms' ||
		typeof value.condition !== 'string' ||
		!value.condition.trim() ||
		!value.headlines ||
		typeof value.headlines !== 'object' ||
		!value.subline ||
		typeof value.subline !== 'object'
	)
		return fail();
	const headlines = value.headlines as Record<string, unknown>;
	const subline = value.subline as Record<string, unknown>;
	if (
		typeof headlines.default !== 'string' ||
		(id === 'block' &&
			(typeof headlines.cap !== 'string' || headlines.cap === headlines.default)) ||
		Object.values(headlines).some((key) => typeof key !== 'string' || !catalog[key]) ||
		typeof subline.key !== 'string' ||
		typeof catalog[subline.key] !== 'string' ||
		!Array.isArray(subline.values) ||
		subline.values.some((name: unknown) => typeof name !== 'string' || !/^\w+$/.test(name))
	)
		return fail();
	const placeholders = [...catalog[subline.key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
	if (
		new Set(subline.values).size !== subline.values.length ||
		[...new Set(placeholders)].sort().join(',') !== [...subline.values].sort().join(',')
	)
		return fail();
}
