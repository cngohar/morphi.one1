import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { generateTheme } from '../src/lib/engine/theme/generator.js';
import { THEME_CONFIG_VERSION, THEME_GENERATOR_VERSION } from '../src/lib/engine/theme/config.js';

const directory = 'docs/evidence/slice5-themes';
await mkdir(directory, { recursive: true });
const tiles = Array.from({ length: 60 }, (_, i) => {
	const family = (['memory', 'block', 'connect'] as const)[i % 3];
	const seed = String(100 + Math.floor(i / 3) * 7919);
	const t = generateTheme(seed, family);
	const radius = t.containerStyle!.radius;
	const clip = `clip-path:${t.containerStyle!.clip};`;
	const cells = Array.from(
		{ length: family === 'memory' ? 12 : family === 'connect' ? 25 : 64 },
		(_, j) => {
			const color = t.colors[(family === 'memory' ? Math.floor(j / 2) : j) % t.colors.length];
			const glyph = t.symbols[Math.floor(j / 2)];
			const fill = t.style.fill === 'outline' ? 'none' : color;
			return `<div style="${family === 'memory' ? `aspect-ratio:${t.style.aspect};` : ''}padding:${family === 'memory' ? t.style.border : 1}px;border-radius:${radius};${clip}background:${t.edge}"><div style="width:100%;height:100%;display:grid;place-items:center;border-radius:${radius};${clip}background:${family === 'memory' ? (j < 8 ? t.face : t.back) : j % 5 < 2 ? color : t.back}">${family === 'connect' && j % 6 === 0 ? `<svg viewBox="0 0 48 48"><path d="${t.symbols[Math.floor(j / 6)].path}" fill="${color}" fill-rule="evenodd" /></svg>` : family === 'memory' && j < 8 ? `<svg viewBox="0 0 48 48"><path d="${glyph.path}" fill="${fill}" fill-rule="evenodd" stroke="${color}" stroke-width="${t.style.fill === 'outline' ? 3 : 0}" /></svg>` : ''}</div></div>`;
		}
	).join('');
	const scatter = t.backdrop.items
		.map(
			(item) =>
				`<svg viewBox="0 0 60 60" style="position:absolute;left:${item.x}%;top:${item.y}%;width:20px;height:28px;transform:translate(-50%,-50%) rotate(${item.rotate}deg);color:${t.backdrop.color}">${family === 'connect' ? '<path d="M8 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M13 17v27h34V17" fill="none" stroke="currentColor" stroke-width="4" />' : family === 'memory' ? '<rect x="12" y="5" width="36" height="50" rx="5" fill="currentColor" />' : '<path d="M8 8H52V28H28V52H8Z" fill="currentColor" />'}</svg>`
		)
		.join('');
	return `<article style="background:${t.background};position:relative;isolation:isolate"><div style="position:absolute;inset:45px 0 70px;z-index:-1;opacity:0.2;pointer-events:none">${scatter}</div><h2>${family === 'memory' ? 'Memory' : family === 'connect' ? 'Connect' : 'Block'} · ${seed}</h2><div class="sample ${family}" style="gap:${family === 'memory' ? t.style.gap : 3}px">${cells}</div><p>${t.recipe} · ${Math.round(t.baseHue)}° · ${t.style.id}<br>${t.container} · ${t.backdrop.kind}${t.fallback ? ' · FALLBACK' : ''}</p><div class="swatches">${t.colors.map((c) => `<span style="background:${c}"></span>`).join('')}</div></article>`;
}).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Morphi.One — procedural theme review</title><style>*{box-sizing:border-box}body{font:14px system-ui;background:#f5f8fc;color:#1b2433;margin:24px}h1{font-size:28px;margin:0}header p{margin:8px 0 22px}main{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}article{border:1px solid #7a889e;padding:14px;break-inside:avoid}h2{font-size:15px;margin:0 0 12px}.sample{display:grid;height:210px;align-content:center;margin:0 auto}.memory{grid-template-columns:repeat(4,1fr);max-width:230px}.memory>div{aspect-ratio:1;display:grid;place-items:center}.connect{grid-template-columns:repeat(5,1fr);width:210px;gap:3px}.connect>div{aspect-ratio:1}.block{grid-template-columns:repeat(8,1fr);width:210px}.block>div{aspect-ratio:1}svg{width:68%;height:68%}p{font-size:12px;line-height:1.5;min-height:36px}.swatches{display:flex;gap:5px}.swatches span{width:24px;height:12px}@media(max-width:900px){main{grid-template-columns:repeat(2,1fr)}}@media print{main{grid-template-columns:repeat(3,1fr)}}</style><header><h1>Morphi.One · 60 procedural themes</h1><p>${THEME_CONFIG_VERSION} · ${THEME_GENERATOR_VERSION}. Slice 5 palette, silhouettes, editable container shapes and scattered backdrop review. Actual responsive previews remain in the admin theme editor.</p></header><main>${tiles}</main></html>`;
await writeFile(`${directory}/contact-sheet.html`, html);
const browser = await chromium.launch();
try {
	const page = await browser.newPage({
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1
	});
	await page.goto(pathToFileURL(resolve(`${directory}/contact-sheet.html`)).href);
	await page.screenshot({ path: `${directory}/contact-sheet.png`, fullPage: true });
} finally {
	await browser.close();
}
console.info(`${directory}/contact-sheet.html and contact-sheet.png written.`);
