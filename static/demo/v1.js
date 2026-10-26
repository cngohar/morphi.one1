(() => {
	const copy = globalThis.MorphiV1Messages;
	const esc = (value) =>
		String(value).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
		);
	const t = (key, values = {}) =>
		esc(
			Object.entries(values).reduce(
				(text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
				copy[key] ?? key
			)
		);
	const screens = [
		'home',
		'memory',
		'block',
		'play',
		'result',
		'terms',
		'privacy',
		'login',
		'recovery',
		'dashboard',
		'status',
		'moderation',
		'queue',
		'audit',
		'operator'
	];
	const parameters = new URLSearchParams(location.search);
	let view = screens.includes(parameters.get('screen')) ? parameters.get('screen') : 'home';
	let scenario = parameters.get('state') ?? 'normal';
	const role = ['admin', 'moderator', 'support', 'player'].includes(parameters.get('role'))
		? parameters.get('role')
		: 'admin';
	const app = document.querySelector('#app');
	const motion = globalThis.MorphiMotion;
	if (!motion) console.warn('morphi:demo_motion_unavailable');
	let doorPlaying = false;
	let lastDoorRect = null;
	let family = 'memory',
		round = 1,
		stay = null,
		ranked = true,
		banned = false,
		hidden = false,
		renamed = false,
		resolved = false,
		loginStep = false,
		recentAuth = false,
		auditPage = 1,
		lookupDone = true;
	let cardOpen = [],
		matched = new Set(),
		selectedPiece = 0,
		placed = new Set(),
		timer = null;
	let reports = [
		{ id: 'CASE-DEMO-04', kind: 'username', target: 'player_demo_28' },
		{ id: 'CASE-DEMO-05', kind: 'score', target: 'run_demo_104' }
	];
	let audit = [
		['14:32', 'score:read', 'run_demo_104', '—', t('admin.audit.sampleReason')],
		['14:26', 'flags:toggle', 'ranked', 'off → on', 'CASE-DEMO-03'],
		['13:50', 'score:hide', 'run_demo_098', 'eligible → hidden', 'CASE-DEMO-02']
	];
	const shapes = [
		'<circle cx="24" cy="24" r="14" fill="currentColor"/>',
		'<path d="M24 7 42 39H6Z" fill="currentColor"/>',
		'<rect x="10" y="10" width="28" height="28" rx="6" fill="currentColor"/>',
		'<path d="m24 5 19 19-19 19L5 24Z" fill="currentColor"/>',
		'<path d="M18 7h12v11h11v12H30v11H18V30H7V18h11Z" fill="currentColor"/>',
		'<path d="m24 5 17 10v19L24 44 7 34V15Z" fill="currentColor"/>'
	];
	const icons = {
		play: 'm9 5 11 7-11 7Z',
		close: 'm6 6 12 12M18 6 6 18',
		sound: 'M4 10v4h4l5 4V6l-5 4Zm13-3a7 7 0 0 1 0 10',
		mute: 'M4 10v4h4l5 4V6l-5 4Zm13 0 5 5m0-5-5 5',
		expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
		dashboard: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
		status: 'M12 3v9m-6-7a9 9 0 1 0 12 0',
		moderation: 'M5 4h14v16H5Zm4 5h6m-6 5h6',
		queue: 'M4 5h16v14H4Zm4 4h8m-8 5h5',
		audit: 'M6 3h12v18H6Zm3 5h6m-6 4h6m-6 4h4',
		operator: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z',
		arrow: 'M4 12h16m-6-6 6 6-6 6'
	};
	const icon = (id) =>
		`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[id] ?? icons.arrow}"/></svg>`;
	const brand = () =>
		`<a class="brand" href="?screen=home" data-view="home">${t('brand').replace('.', '<span class="dot">.</span>')}</a>`;
	const button = (key, action, classes = '') =>
		`<button type="button" class="btn ${classes}" data-action="${action}">${t(key)}</button>`;
	const link = (key, target, classes = '') =>
		`<a class="${classes}" href="?screen=${target}" data-view="${target}">${t(key)}</a>`;
	const footer = () =>
		`<footer class="site-footer" data-safe>${link('nav.privacy', 'privacy')}<span aria-hidden="true">·</span>${link('nav.terms', 'terms')}</footer>`;
	const publicHeader = (sound = true) =>
		`<header class="public-header" data-safe>${brand()}<nav>${button('nav.account', 'account', 'small')}${sound ? `<button class="icon-btn" type="button" data-action="sound" aria-label="${t('nav.mute')}">${icon('sound')}</button>` : ''}</nav></header>`;
	const status = (key, warn = false) =>
		`<span class="status${warn ? ' warn' : ''}">${t(key)}</span>`;
	const alert = (key, type = 'error') =>
		`<div class="notice ${type}" role="${type === 'error' ? 'alert' : 'status'}">${t(key)}</div>`;
	const heading = (title, body, actions = '') =>
		`<div class="admin-heading"><div><p class="eyebrow">${t('admin.workspace')}</p><h1>${t(title)}</h1><p>${t(body)}</p></div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
	function inform(key, type = 'success') {
		const target = document.querySelector('.page-feedback') ?? document.querySelector('#announcer');
		target.innerHTML = alert(key, type);
	}
	function drawFamily() {
		return crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0 ? 'memory' : 'block';
	}
	function navigate(next) {
		clearTimeout(timer);
		motion?.clear();
		const homeGhost =
			view === 'home' && next === 'play' ? motion?.ghost(app.querySelector('.home-page')) : null;
		document.querySelector('dialog')?.remove();
		if (next === 'result' && ['memory', 'block'].includes(view))
			lastDoorRect =
				app.querySelector('.memory-board,.block-board')?.getBoundingClientRect() ?? null;
		view = next;
		if (next === 'memory' || next === 'block') {
			family = next;
			stay = next;
			resetBoard();
		}
		if (next === 'play') {
			if (stay !== null || round === 1) family = drawFamily();
			stay = null;
			resetBoard();
		}
		render(Boolean(homeGhost));
		if (homeGhost) motion.homeExit(homeGhost, app.querySelector('.game-stage'));
		else if (next === 'result') motion?.arrive(app.querySelector('.result-main'));
		else if (['memory', 'block'].includes(next) && !doorPlaying && lastDoorRect)
			motion?.doorReady(app.querySelector('.puzzle-page'), lastDoorRect);
		try {
			const query = new URLSearchParams({ screen: view, state: scenario, role });
			history.replaceState(null, '', `${location.pathname}?${query}`);
		} catch {
			/* file: demo */
		}
		if (parent !== window)
			parent.postMessage(
				{ type: 'morphi-v1-preview', screen: view },
				location.origin === 'null' ? '*' : location.origin
			);
		document.querySelector('h1')?.setAttribute('tabindex', '-1');
		(next === 'play'
			? app.querySelector('[data-card],[data-piece]')
			: document.querySelector('h1')
		)?.focus({ preventScroll: true });
	}
	function resetBoard() {
		cardOpen = [];
		matched = new Set();
		placed = new Set();
		selectedPiece = 0;
	}
	function scatter() {
		const layer = app.querySelector('.home-scatter');
		if (!layer) return;
		layer.replaceChildren();
		const width = innerWidth,
			height = innerHeight;
		const safe = Array.from(app.querySelectorAll('[data-safe]')).map((node) =>
			node.getBoundingClientRect()
		);
		const placed = [];
		const draws = new Uint32Array(1024);
		crypto.getRandomValues(draws);
		let draw = 0;
		const random = () => draws[draw++ % draws.length] / 4294967296;
		const drawings = [
			'<circle cx="24" cy="24" r="18"/>',
			'<path d="M24 4 46 42H2Z"/>',
			'<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="5"/>',
			'<path d="M24 2 44 13v22L24 46 4 35V13Z"/>',
			'<path d="m24 0 7 17 17 7-17 7-7 17-7-17L0 24l17-7Z"/>',
			'<path d="m24 2 22 22-22 22L2 24Z"/>',
			'<rect x="3" y="3" width="18" height="18" rx="4"/><rect x="3" y="25" width="18" height="18" rx="4"/><rect x="25" y="25" width="18" height="18" rx="4"/>',
			'<rect x="7" y="2" width="34" height="44" rx="8"/><path d="m24 14 9 10-9 10-9-10Z" fill="none" stroke="var(--bg)" stroke-width="2"/>',
			'<rect x="9" y="2" width="30" height="44" rx="8"/><g fill="var(--bg)"><circle cx="24" cy="12" r="3"/><circle cx="24" cy="24" r="3"/><circle cx="24" cy="36" r="3"/></g>',
			'<path d="M5 12h13a7 7 0 1 1 13 0h12v12a7 7 0 1 0 0 13v8H5Z"/>'
		];
		const total = width < 600 ? 9 : 18;
		const kinds = [0, 6, 1, 7, 2, 8, 3, 9, 4, 5];
		const offset = Math.floor(random() * kinds.length);
		for (let attempt = 0; attempt < 180 && placed.length < total; attempt++) {
			const size = 20 + random() * 20,
				x = 12 + random() * (width - 64),
				y = 80 + random() * Math.max(0, height - 140);
			const rect = { left: x, top: y, right: x + size, bottom: y + size };
			const collision = (other) =>
				rect.left < other.right + 22 &&
				rect.right > other.left - 22 &&
				rect.top < other.bottom + 22 &&
				rect.bottom > other.top - 22;
			if (safe.some(collision) || placed.some(collision)) continue;
			const kind = kinds[(placed.length + offset) % kinds.length];
			const item = document.createElement('i');
			item.dataset.shape = String(kind);
			Object.assign(item.style, {
				left: `${x}px`,
				top: `${y}px`,
				width: `${size}px`,
				height: `${size}px`,
				transform: `rotate(${random() * 36 - 18}deg)`,
				color: [
					'var(--primary)',
					'var(--accent)',
					'var(--success)',
					'var(--violet)',
					'var(--warning-fill)'
				][placed.length % 5]
			});
			item.innerHTML = `<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">${drawings[kind]}</svg>`;
			layer.append(item);
			placed.push(rect);
		}
	}
	function home() {
		return `<div class="home-page"><div class="home-scatter" aria-hidden="true"></div>${publicHeader()}<main class="home-main"><div class="home-copy"><p class="eyebrow" data-safe>${t('home.tag')}</p><h1 aria-label="${t('home.title')}" data-safe><span>${t('home.line1')}</span><span class="headline-tail"><span>${t('home.line2')}</span> <span>${t('home.line3')}</span></span></h1></div><div class="home-play"><div class="play-orbit" data-safe><div class="orbit-rotator" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i class="orbit-arm" style="--angle:${index * 45}deg"><i class="orbit-tile" style="--tile-color:${['var(--success)', 'var(--accent)', 'var(--warning-fill)', 'var(--accent)', 'var(--success)', 'var(--warning-fill)', 'var(--violet)', 'var(--primary)'][index]}"></i></i>`).join('')}</div><a class="play-circle" href="?screen=play" data-view="play">${t('home.play')}</a></div><div class="mystery-tiles" aria-hidden="true" data-safe><i>?</i><i>?</i><i>?</i></div></div><div class="info-chips" data-safe><span>${t('home.free')}</span><span>${t('home.optional')}</span><span>${t('home.fresh')}</span></div></main>${footer()}</div>`;
	}
	function guideHow() {
		return `<section class="guide-how"><h2>${t('game.how')}</h2><ol>${[1, 2, 3].map((index) => `<li><span>${index}</span><p>${t(`game.${family}.step${index}`)}</p></li>`).join('')}</ol></section>`;
	}
	function guideScoring() {
		return `<section class="guide-scoring"><h2>${t('game.scoring')}</h2><dl>${[1, 2, 3, 4].map((index) => `<div><dt>${t(`game.${family}.row${index}`)}</dt><dd>${t(`game.${family}.value${index}`)}</dd></div>`).join('')}</dl><p class="guide-note">${t(`game.${family}.scoringNote`)}</p></section>`;
	}
	function guideTips() {
		return `<section class="guide-tips"><h2>${t('game.tips')}</h2><p>${t(`game.${family}.tips`)}</p></section>`;
	}
	function guideRight() {
		return `<section class="guide-high"><h2>${t('game.best')}</h2><strong>${family === 'memory' ? '7,850' : '2,400'}</strong><p>${t('game.familyHigh', { game: copy[`game.${family}`] })}</p></section>${guideTips()}<section class="guide-surprise">${link('nav.surprise', 'play')}<p>${t('game.surpriseNote')}</p></section>`;
	}
	function helpButtons() {
		return `<div class="help-controls">${button('game.how', 'help-how')}${button('game.helpScoring', 'help-scoring')}</div>`;
	}
	function openHelp(kind, anchor) {
		const dialog = document.createElement('dialog');
		dialog.className = 'help-dialog';
		dialog.setAttribute('aria-labelledby', 'help-title');
		dialog.innerHTML = `<header><h2 id="help-title">${t(kind === 'how' ? 'game.how' : 'game.helpScoring')}</h2><button class="icon-btn" data-help-close aria-label="${t('game.back')}">${icon('close')}</button></header>${kind === 'how' ? guideHow() : guideScoring() + guideTips()}<button class="btn primary" data-help-close>${t('game.back')}</button>`;
		document.body.append(dialog);
		dialog.showModal();
		motion?.dismissOnBackdrop(dialog,close);
  motion?.dialogOpen(dialog, anchor);
		function close() {
			const current = anchor.isConnected
				? anchor
				: app.querySelector(`[data-action="help-${kind}"]`);
			motion?.dialogExit(dialog, current);
			dialog.close();
			dialog.remove();
			current?.focus();
		}
		dialog
			.querySelectorAll('[data-help-close]')
			.forEach((node) => node.addEventListener('click', close));
		dialog.addEventListener('cancel', (event) => {
			event.preventDefault();
			close();
		});
	}
	function board() {
		const memory = family === 'memory';
		const symbols = [0, 3, 1, 4, 2, 5, 1, 0, 5, 2, 4, 3];
		const colors = [
			'var(--primary)',
			'var(--accent)',
			'var(--success)',
			'var(--ink-2)',
			'var(--warning-text)',
			'var(--primary-strong)'
		];
		const cards = symbols
			.map((symbol, index) => {
				const visible = cardOpen.includes(index) || matched.has(index);
				return `<button type="button" class="memory-card${visible ? ' revealed' : ''}${matched.has(index) ? ' matched' : ''}" data-card="${index}" aria-label="${t('game.card', { index: index + 1 })}${visible ? `, ${t('game.symbol', { symbol: symbol + 1 })}` : ''}" aria-pressed="${visible}" ${matched.has(index) ? 'disabled' : ''}>${visible ? `<svg viewBox="0 0 48 48" aria-hidden="true" style="color:${colors[symbol]}">${shapes[symbol]}</svg>` : '<span class="back" aria-hidden="true"></span>'}</button>`;
			})
			.join('');
		const cells = Array.from({ length: 64 }, (_, index) => {
			const filled =
				placed.has(index) ||
				[32, 40, 48, 49, 50, 52, 53, 54, 55, 56, 57, 58, 60, 61].includes(index);
			return `<button type="button" class="block-cell${filled ? ' filled' : ''}" data-cell="${index}" aria-label="${t('game.cell', { index: index + 1 })}" ${filled ? 'disabled' : ''}></button>`;
		}).join('');
		const tray = Array.from(
			{ length: 3 },
			(_, index) =>
				`<button class="block-piece${selectedPiece === index ? ' selected' : ''}" data-piece="${index}" type="button" aria-label="${t('game.piece', { index: index + 1 })}" aria-pressed="${selectedPiece === index}">${[
					0, 1, 2, 3, 4, 5, 6, 7, 8
				]
					.map(
						(cell) =>
							`<i style="visibility:${
								[
									[0, 3, 6],
									[0, 1, 3, 4],
									[3, 4, 5]
								][index].includes(cell)
									? 'visible'
									: 'hidden'
							}"></i>`
					)
					.join('')}</button>`
		).join('');
		const playing = view === 'play' || doorPlaying;
		const hud = playing
			? [
					['game.score', memory ? matched.size * 500 : 1250],
					[memory ? 'game.pairs' : 'game.lines', memory ? `${matched.size / 2} / 6` : '9'],
					[memory ? 'game.mismatches' : 'game.streak', memory ? '0' : '2']
				]
			: [
					['game.score', memory ? '0' : '1,250'],
					['game.best', memory ? '7,850' : '2,400']
				];
		return `<div class="game-stage ${playing ? 'playing' : 'ready'}"><div class="game-meta"><strong>${t(`game.${family}`)}</strong><span>${t('game.round', { round })}</span></div><div class="game-hud">${hud.map(([key, value]) => `<div><span>${t(key)}</span><strong>${value}</strong></div>`).join('')}</div><div class="board-field"><div ${playing ? '' : 'inert'}>${memory ? `<div class="memory-board">${cards}</div>` : `<div class="block-board">${cells}</div><div class="block-tray">${tray}</div>`}</div>${playing ? '' : `<button class="board-play" data-action="door-start">${t('home.play')}</button>`}</div><div class="game-bottom"><span>${t('game.local')}</span><span aria-live="polite" id="board-status"></span></div></div>`;
	}
	function puzzle() {
		return `<div class="puzzle-page ${doorPlaying ? 'door-playing' : 'door-ready'}" data-family="${family}">${publicHeader()}<header class="page-heading"><p class="eyebrow">${t(`game.${family}.eyebrow`)}</p><h1>${t(`game.${family}`)}</h1>${doorPlaying ? '' : `<p class="door-intro">${t(`game.${family}.intro`)}</p>`}</header>${scenario === 'error' ? `<div class="content-page">${alert('game.error')}${button('game.retry', 'retry')}</div>` : `${doorPlaying ? helpButtons() : ''}<main class="puzzle-layout">${doorPlaying ? '' : `<aside class="puzzle-copy">${guideHow()}${guideScoring()}</aside>`}${board()}${doorPlaying ? '' : `<aside class="puzzle-copy">${guideRight()}</aside>`}</main>`}${doorPlaying ? '' : footer()}</div>`;
	}
	function core() {
		return `<div class="core-page" data-family="${family}">${publicHeader()}<main class="core-wrap"><h1>${t(`game.${family}`)}</h1>${helpButtons()}${scenario === 'error' ? `<div class="stack">${alert('game.error')}${button('game.retry', 'retry')}</div>` : board()}</main></div>`;
	}
	function result() {
		const memory = family === 'memory';
		return `<div class="result-page">${publicHeader(false)}<main class="result-main"><p class="eyebrow">${t('result.tag')} · ${t(`game.${family}`)}</p><h1>${t('result.title')}</h1><section class="result-score"><p class="eyebrow">${t('result.score')}</p><div class="result-number">${memory ? '5,320' : '1,650'}</div><p class="result-high">${t('game.best')} <strong>${memory ? '7,850' : '2,400'}</strong></p></section><dl class="result-stats">${(memory
			? [
					['game.pairs', '6 / 6'],
					['game.mismatches', '4'],
					['game.time', '1:12']
				]
			: [
					['game.lines', '12'],
					['game.moves', '38'],
					['game.streak', '3']
				]
		)
			.map(([key, value]) => `<div><dt>${t(key)}</dt><dd>${value}</dd></div>`)
			.join(
				''
			)}</dl><div class="result-next"><button class="btn primary" data-action="next">${t('game.next')}</button><p>${t('result.mystery')}</p></div><section class="result-save"><div><h2>${t('result.save')}</h2><p>${t('result.saveBody')}</p><p class="device-note">${t(scenario === 'offline' ? 'result.pending' : scenario === 'error' ? 'result.rejected' : 'result.local')}</p></div><button class="google-ink" data-action="account"><span aria-hidden="true">G</span>${t('result.google')}</button></section></main>${footer()}</div>`;
	}
	function terms() {
		return `${publicHeader()}<main class="content-page"><h1>${t('terms.title')}</h1><p class="muted">${t('terms.updated')}</p><p>${t('terms.intro')}</p>${['play', 'eligibility', 'names', 'data', 'service', 'contact'].map((key) => `<section><h2>${t(`terms.${key}.title`)}</h2><p>${t(`terms.${key}.body`)}</p></section>`).join('')}</main>${footer()}`;
	}
	function privacy() {
		return `${publicHeader()}<main class="content-page"><h1>${t('privacy.title')}</h1><p>${t('privacy.intro')}</p><section><p>${t('privacy.events')}</p><p>${t('privacy.choice')}</p></section><section><label><input type="checkbox" id="measurement" checked />${t('privacy.optout')}</label></section><div class="page-feedback"></div></main>${footer()}`;
	}
	function login() {
		const recovery = view === 'recovery';
		return `<main class="admin-login"><section class="login-card">${brand()}<p class="eyebrow">${t('admin.brand')}</p><h1>${t(recovery ? 'admin.recovery.title' : loginStep ? 'admin.2fa.title' : 'admin.login.title')}</h1><p>${t(recovery ? 'admin.recovery.body' : loginStep ? 'admin.2fa.body' : 'admin.login.body')}</p><div class="page-feedback">${scenario === 'locked' ? alert('admin.locked') : scenario === 'error' ? alert('admin.error') : scenario === 'offline' ? alert('admin.offline', 'warning') : ''}</div>${recovery || loginStep ? `<form id="login-form"><label class="field">${t(recovery ? 'admin.recovery.code' : 'admin.code')}<input name="code" ${recovery ? 'autocomplete="off"' : 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"'} required ${scenario === 'locked' || scenario === 'offline' ? 'disabled' : ''}/></label><button class="btn primary" ${scenario === 'locked' || scenario === 'offline' ? 'disabled' : ''}>${t(recovery ? 'admin.recovery.action' : 'admin.verify')}</button></form>${recovery ? `<p>${t('admin.recovery.help')}</p>${link('nav.back', 'login', 'recovery-link')}` : link('admin.recovery', 'recovery', 'recovery-link')}` : `<button class="btn primary" data-action="google" ${scenario === 'locked' || scenario === 'offline' ? 'disabled' : ''}>${t('admin.google')}</button>`}</section></main>`;
	}
	const can = (page) =>
		role === 'admin' ||
		(['moderation'].includes(page) && ['moderator', 'support'].includes(role)) ||
		(page === 'queue' && role === 'moderator');
	function adminShell(content) {
		const pages = ['dashboard', 'status', 'moderation', 'queue', 'audit', 'operator'].filter(can);
		return `<div class="admin-shell"><aside class="admin-sidebar">${brand()}<p class="eyebrow">${t('admin.workspace')}</p><nav class="admin-nav">${pages.map((page) => `<a href="?screen=${page}" data-view="${page}" class="${view === page ? 'active' : ''}" ${view === page ? 'aria-current="page"' : ''}>${icon(page)}${t(`admin.nav.${page}`)}</a>`).join('')}</nav><div class="admin-person"><strong>${t('admin.owner')}</strong><p>${t('admin.role', { role: t(`review.${role}`) })}</p>${link('admin.logout', 'login')}</div></aside><div class="admin-body"><header class="admin-top"><span>${t('admin.brand')}</span><span>${t('admin.date')} · ${t('admin.sample')}</span></header><main class="admin-main"><div class="page-feedback"></div>${content}</main></div></div>`;
	}
	function dashboard() {
		const metric = (key, value, caption = '') =>
			`<article class="metric"><p>${t(`admin.metric.${key}`)}</p><strong>${value}</strong>${caption ? `<small>${t(caption)}</small>` : ''}</article>`;
		const count = scenario === 'empty';
		return `${heading('admin.dashboard.title', 'admin.dashboard.description')}<div class="metric-grid">${metric('accounts', count ? '0' : '128')}${metric('runs', count ? '0' : '842')}${metric('completion', count ? '—' : '69.8%', 'admin.dashboard.caption')}${metric('entries', count ? '0' : '57')}</div><div class="dashboard-columns"><section class="admin-card"><h2>${t('admin.dashboard.chart')}</h2>${count ? alert('admin.empty', 'warning') : `<div class="chart">${[88, 116, 93, 142, 158, 114, 131].map((n, i) => `<div class="chart-col"><span>${n}</span><div class="chart-bar" style="height:${n / 1.6}px"></div><span>${18 + i} Oct</span></div>`).join('')}</div>`}</section><section class="admin-card"><h2>${t('admin.dashboard.split')}</h2>${['memory', 'block'].map((game, i) => `<div class="split-row"><span>${t(`game.${game}`)}</span><strong>${count ? '0' : i === 0 ? '482' : '360'}</strong><div class="split-track"><i style="width:${count ? 0 : i === 0 ? 57 : 43}%"></i></div></div>`).join('')}<div class="dashboard-foot"><span><strong>${count ? '0' : '610'}</strong>${t('admin.metric.starts')}</span><span><strong>${count ? '0' : '426'}</strong>${t('admin.metric.claims')}</span></div></section></div><div class="dashboard-foot"><span><strong>${count ? '0' : '3'}</strong>${t('admin.metric.hidden')}</span><span><strong>${count ? '0' : '2'}</strong>${t('admin.metric.bans')}</span><span><strong>${count ? '0' : '4'}</strong>${t('admin.metric.deletions')}</span></div><section class="admin-card" style="margin-top:20px"><h2>${t('admin.dashboard.funnel')}</h2><p>${t('admin.dashboard.funnelNote')}</p><p style="margin-top:12px"><a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">${t('admin.dashboard.traffic')}</a></p><p>${t('admin.dashboard.trafficNote')}</p></section>`;
	}
	function rankedStatus() {
		return `${heading('admin.status.title', 'admin.status.description')}<section class="admin-card"><div class="ranked-control"><span class="switch-state${ranked ? '' : ' off'}" aria-hidden="true"></span><div><h2>${t(ranked ? 'admin.status.on' : 'admin.status.off')}</h2><p>${t('admin.status.available')}</p></div>${status(ranked ? 'admin.status.on' : 'admin.status.off', !ranked)}</div><p>${t('admin.status.body')}</p><div class="actions" style="margin-top:22px">${button(ranked ? 'admin.status.disable' : 'admin.status.enable', 'ranked', ranked ? 'danger' : 'primary')}</div></section><section class="admin-card"><h2>${t('admin.status.detail')}</h2>${status('admin.status.available')}<p style="margin-top:12px">${t('admin.status.pending')}</p></section>`;
	}
	function moderation() {
		return `${heading('admin.moderation.title', 'admin.moderation.description')}<form class="lookup" id="lookup"><label class="field">${t('admin.lookup.label')}<input name="reference" value="player_demo_28" maxlength="64" placeholder="${t('admin.lookup.placeholder')}" required /></label><button class="btn primary">${t('admin.lookup.action')}</button></form>${scenario === 'empty' ? alert('admin.empty', 'warning') : lookupDone ? `<section class="admin-card"><div class="player-head"><div class="avatar" aria-hidden="true">P</div><div><h2>${t(renamed ? 'admin.player.renamed' : 'admin.player.nameValue')}</h2><p>player_demo_28</p></div>${status(banned ? 'admin.player.banned' : 'admin.player.active', banned)}</div><dl class="data-list"><div><dt>${t('admin.player.id')}</dt><dd>player_demo_28</dd></div><div><dt>${t('admin.player.name')}</dt><dd>${t(renamed ? 'admin.player.renamed' : 'admin.player.nameValue')}</dd></div></dl>${role !== 'support' ? `<div class="actions">${button('admin.player.rename', 'rename', 'small')}${button(banned ? 'admin.player.unban' : 'admin.player.ban', banned ? 'unban' : 'ban', 'small danger')}</div>` : ''}<p class="readonly">${t('admin.player.banNote')}</p></section><section class="admin-card"><h2>${t('admin.run')}</h2><div class="table-wrap"><table><thead><tr>${['id', 'game', 'score', 'state'].map((key) => `<th scope="col">${t(`admin.run.${key}`)}</th>`).join('')}<th></th></tr></thead><tbody><tr><td><code>run_demo_104</code></td><td>${t('game.memory')}</td><td>5,320</td><td>${status(hidden ? 'admin.run.hidden' : 'admin.run.visible', hidden)}</td><td>${role !== 'support' ? button(hidden ? 'admin.run.restore' : 'admin.run.hide', hidden ? 'restore' : 'hide', 'small') : ''}</td></tr></tbody></table></div></section>` : ''}`;
	}
	function queue() {
		return `${heading('admin.queue.title', 'admin.queue.description')}<section class="admin-card"><div class="queue-tools"><p>${t('admin.queue.noMessage')}</p>${button('admin.queue.add', 'report', 'small')}</div>${scenario === 'empty' ? alert('admin.empty', 'warning') : `<div class="table-wrap"><table><thead><tr>${['case', 'kind', 'target', 'status'].map((key) => `<th scope="col">${t(`admin.queue.${key}`)}</th>`).join('')}<th></th></tr></thead><tbody>${reports.map((report, index) => `<tr><td><code>${esc(report.id)}</code></td><td>${t(`admin.queue.${report.kind}`)}</td><td><code>${esc(report.target)}</code></td><td>${status(resolved && index === 0 ? 'admin.queue.resolved' : 'admin.queue.open', !(resolved && index === 0))}</td><td><div class="actions">${link('admin.queue.inspect', 'moderation', 'btn small')}${index === 0 && !resolved ? button('admin.queue.resolve', 'resolve', 'small') : ''}</div></td></tr>`).join('')}</tbody></table></div>`}</section>`;
	}
	function auditLog() {
		const rows = scenario === 'empty' ? [] : audit.slice((auditPage - 1) * 5, auditPage * 5);
		return `${heading('admin.audit.title', 'admin.audit.description')}<section class="admin-card">${
			rows.length
				? `<div class="table-wrap"><table><thead><tr>${['when', 'who', 'action', 'target', 'change', 'reason'].map((key) => `<th scope="col">${t(`admin.audit.${key}`)}</th>`).join('')}</tr></thead><tbody>${rows
						.map(
							(row) =>
								`<tr><td>${esc(row[0])}</td><td>${t('admin.owner')}</td>${row
									.slice(1)
									.map((value) => `<td>${esc(value)}</td>`)
									.join('')}</tr>`
						)
						.join('')}</tbody></table></div>`
				: alert('admin.audit.none', 'warning')
		}<div class="pagination"><button class="btn small" data-action="previous" ${auditPage === 1 ? 'disabled' : ''}>${t('admin.audit.previous')}</button><span>${t('admin.audit.page', { page: auditPage })}</span><button class="btn small" data-action="more" ${auditPage * 5 >= audit.length ? 'disabled' : ''}>${t('admin.audit.next')}</button></div></section>`;
	}
	function operator() {
		return `${heading('admin.operator.title', 'admin.operator.description')}<section class="admin-card"><form id="privacy-form" class="privacy-form"><label class="field">${t('admin.player.id')}<input name="target" value="player_demo_28" maxlength="64" required /></label><label class="field">${t('admin.operator.reference')}<input name="case" value="CASE-DEMO-07" maxlength="64" required /></label><label class="check-field"><input type="checkbox" name="verified" />${t('admin.operator.identity')}</label><p class="muted">${t('admin.operator.scope')}</p><div class="actions"><button type="submit" class="btn" name="intent" value="export">${t('admin.operator.export')}</button><button type="submit" class="btn danger" name="intent" value="delete">${t('admin.operator.delete')}</button></div><p class="muted">${t('admin.operator.deleteBody')}</p></form></section>`;
	}
	function render(preserveMotion = false) {
		if (!preserveMotion) motion?.clear();
		document.body.classList.toggle(
			'design-public',
			['home', 'memory', 'block', 'play', 'result', 'terms', 'privacy'].includes(view)
		);
		clearTimeout(timer);
		if (view === 'memory' || view === 'block') family = view;
		document.title = `${copy[`view.${view}`]} · ${copy.brand}`;
		if (
			[
				'home',
				'memory',
				'block',
				'play',
				'result',
				'terms',
				'privacy',
				'login',
				'recovery'
			].includes(view)
		)
			app.innerHTML = (
				{ home, puzzle, play: core, result, terms, privacy, login, recovery: login }[view] ?? puzzle
			)();
		else if (!can(view))
			app.innerHTML = adminShell(
				`${heading('admin.denied.title', 'admin.denied.body')}${link('nav.home', 'home', 'btn')}`
			);
		else
			app.innerHTML = adminShell(
				scenario === 'error' || scenario === 'offline'
					? `${alert(scenario === 'error' ? 'admin.error' : 'admin.offline', scenario === 'error' ? 'error' : 'warning')}${button('admin.retry', 'retry')}`
					: { dashboard, status: rankedStatus, moderation, queue, audit: auditLog, operator }[
							view
						]()
			);
		if (view === 'home') {
			scatter();
			motion?.orbit(app.querySelector('.home-page'));
		}
		if (['home', 'memory', 'block'].includes(view)) document.title = copy[`meta.${view}`];
	}
	function record(action, target, before, after, reason) {
		audit.unshift(['14:45', action, target, `${before} → ${after}`, reason]);
	}
	const actions = {
		ranked: 'admin.audit.ranked',
		hide: 'admin.audit.hide',
		restore: 'admin.audit.restore',
		ban: 'admin.audit.ban',
		unban: 'admin.audit.unban',
		rename: 'admin.audit.rename',
		resolve: 'admin.audit.resolve',
		report: 'admin.audit.report',
		export: 'admin.audit.export',
		delete: 'admin.audit.delete'
	};
	function allowed(action) {
		return (
			role === 'admin' ||
			(role === 'moderator' &&
				['hide', 'restore', 'ban', 'unban', 'rename', 'resolve', 'report'].includes(action))
		);
	}
	function openAction(action, context = {}) {
		if (!allowed(action)) return inform('admin.denied.body', 'error');
		if (scenario === 'offline') return inform('admin.offline', 'error');
		const sensitive = ['ranked', 'delete', 'export'].includes(action);
		const fresh = sensitive && !recentAuth;
		const dialog = document.createElement('dialog');
		dialog.setAttribute('aria-labelledby', 'dialog-title');
		dialog.innerHTML = `<form id="action-form" novalidate><h2 id="dialog-title">${t(fresh ? 'dialog.fresh' : action === 'delete' ? 'dialog.delete' : 'dialog.confirm')}</h2>${fresh ? `<p>${t('dialog.freshBody')}</p>${button('dialog.google', 'reauth-google', 'primary')}<div id="reauth-fields" hidden><label class="field">${t('admin.code')}<input name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" /></label></div>` : `<p>${t(actions[action])} · ${action === 'ranked' ? 'ranked' : action === 'resolve' ? 'CASE-DEMO-04' : action === 'report' ? 'CASE-DEMO-06' : 'player_demo_28'}</p>${action === 'rename' ? `<label class="field">${t('dialog.name')}<input name="name" value="Player_28" maxlength="20" /></label>` : ''}${action === 'report' ? `<label class="field">${t('admin.queue.reference')}<input name="case" value="CASE-DEMO-06" maxlength="64" /></label>` : ''}${action === 'delete' ? `<p>${t('admin.operator.deleteBody')}</p><label class="check-field"><input type="checkbox" name="confirm" />${t('dialog.deleteConfirm')}</label>` : ''}${['delete', 'export'].includes(action) ? `<p>${esc(context.case)}</p>` : `<label class="field">${t('dialog.reason')}<textarea name="reason" minlength="3" maxlength="240"></textarea><small>${t('dialog.reasonHint')}</small></label>`}`}
  <div class="dialog-feedback"></div><div class="actions"><button class="btn" type="button" data-action="cancel">${t('dialog.cancel')}</button><button class="btn ${action === 'delete' ? 'danger' : 'primary'}" type="submit">${t(fresh ? 'admin.verify' : 'dialog.apply')}</button></div></form>`;
		document.body.append(dialog);
		dialog.showModal();
		motion?.dismissOnBackdrop(dialog,()=>dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
		dialog.querySelector('form').addEventListener('submit', (event) => {
			event.preventDefault();
			const values = new FormData(event.currentTarget);
			const error = (key) => {
				dialog.querySelector('.dialog-feedback').innerHTML = alert(key);
			};
			if (fresh) {
				if (
					dialog.querySelector('#reauth-fields').hidden ||
					!/^\d{6}$/.test(String(values.get('code') ?? ''))
				)
					return error('admin.code.invalid');
				recentAuth = true;
				dialog.close();
				openAction(action, context);
				return;
			}
			const reason = ['delete', 'export'].includes(action)
				? String(context.case)
				: String(values.get('reason') ?? '').trim();
			if (reason.length < 3 || reason.length > 240) return error('dialog.reasonInvalid');
			if (action === 'rename' && !/^[a-zA-Z0-9_]{3,20}$/.test(String(values.get('name') ?? '')))
				return error('dialog.nameInvalid');
			if (action === 'report' && !/^[a-zA-Z0-9_-]{3,64}$/.test(String(values.get('case') ?? '')))
				return error('admin.lookup.invalid');
			if (action === 'delete' && !values.has('confirm')) return error('dialog.deleteInvalid');
			if (scenario === 'saveerror') return error('dialog.fail');
			if (action === 'ranked') {
				record(
					copy[actions[action]],
					'ranked',
					ranked ? 'on' : 'off',
					ranked ? 'off' : 'on',
					reason
				);
				ranked = !ranked;
			}
			if (action === 'hide' || action === 'restore') {
				record(
					copy[actions[action]],
					'run_demo_104',
					hidden ? 'hidden' : 'eligible',
					action === 'hide' ? 'hidden' : 'eligible',
					reason
				);
				hidden = action === 'hide';
			}
			if (action === 'ban' || action === 'unban') {
				record(
					copy[actions[action]],
					'player_demo_28',
					banned ? 'banned' : 'eligible',
					action === 'ban' ? 'banned' : 'eligible',
					reason
				);
				banned = action === 'ban';
			}
			if (action === 'rename') {
				record(
					copy[actions[action]],
					'player_demo_28',
					copy['admin.player.nameValue'],
					String(values.get('name')),
					reason
				);
				renamed = true;
				copy['admin.player.renamed'] = String(values.get('name'));
			}
			if (action === 'resolve') {
				record(copy[actions[action]], 'CASE-DEMO-04', 'open', 'resolved', reason);
				resolved = true;
			}
			if (action === 'report') {
				reports.push({
					id: String(values.get('case')),
					kind: 'username',
					target: 'player_demo_28'
				});
				record(copy[actions[action]], String(values.get('case')), '—', 'open', reason);
			}
			if (action === 'export' || action === 'delete')
				record(
					copy[actions[action]],
					context.target,
					'active',
					action === 'export' ? 'export prepared' : 'deleted',
					context.case
				);
			dialog.close();
			render();
			inform(
				action === 'delete'
					? 'admin.operator.done'
					: action === 'export'
						? 'admin.operator.exported'
						: 'dialog.done'
			);
			if (action === 'delete') document.querySelector('#privacy-form')?.remove();
		});
	}
	app.addEventListener('click', (event) => {
		const target = event.target.closest(
			'[data-view],[data-action],[data-card],[data-piece],[data-cell]'
		);
		if (!target) return;
		if (target.hasAttribute('data-view')) {
			event.preventDefault();
			navigate(target.dataset.view);
			return;
		}
		if (target.hasAttribute('data-card')) {
			if (view !== 'play' && !doorPlaying) return;
			const index = Number(target.dataset.card);
			if (matched.has(index) || cardOpen.includes(index) || cardOpen.length === 2) return;
			cardOpen.push(index);
			const symbols = [0, 3, 1, 4, 2, 5, 1, 0, 5, 2, 4, 3];
			if (cardOpen.length === 2 && symbols[cardOpen[0]] === symbols[cardOpen[1]]) {
				cardOpen.forEach((card) => matched.add(card));
				cardOpen = [];
			}
			render();
			if (matched.size === 12) {
				timer = setTimeout(() => navigate('result'), 500);
			} else if (cardOpen.length === 2) {
				timer = setTimeout(() => {
					cardOpen = [];
					render();
				}, 700);
			} else document.querySelector(`[data-card="${index}"]`)?.focus();
			return;
		}
		if (target.hasAttribute('data-piece')) {
			if (view !== 'play' && !doorPlaying) return;
			selectedPiece = Number(target.dataset.piece);
			render();
			document.querySelector('#board-status').textContent = copy['game.selected'];
			return;
		}
		if (target.hasAttribute('data-cell')) {
			if (view !== 'play' && !doorPlaying) return;
			placed.add(Number(target.dataset.cell));
			render();
			document.querySelector('#board-status').textContent = copy['game.placed'];
			return;
		}
		const action = target.dataset.action;
		if (action === 'help-how' || action === 'help-scoring')
			return openHelp(action === 'help-how' ? 'how' : 'scoring', target);
		if (action === 'door-start') {
			if (doorPlaying) return;
			motion?.clear();
			const before = app.querySelector('.memory-board,.block-board').getBoundingClientRect();
			const columns = Array.from(app.querySelectorAll('.puzzle-copy'))
				.map((node) => motion?.ghost(node))
				.filter(Boolean);
			doorPlaying = true;
			render(true);
			motion?.door(
				app.querySelector('.memory-board,.block-board'),
				before,
				columns,
				app.querySelector('.help-controls')
			);
			const first = app.querySelector('[data-card],[data-piece]');
			first?.focus({ preventScroll: true });
			return;
		}
		if (Object.hasOwn(actions, action)) return openAction(action);
		if (action === 'next') {
			target.disabled = true;
			target.setAttribute('aria-busy', 'true');
			target.textContent = copy['game.dealing'];
			// This logical deadline is independent of motion callbacks.
			timer = setTimeout(() => {
				round++;
				if (stay) doorPlaying = false;
				family = stay ?? (family === 'memory' ? 'block' : 'memory');
				resetBoard();
				navigate(stay ?? 'play');
			}, 300);
		}
		if (action === 'retry') {
			scenario = 'normal';
			render();
		}
		if (action === 'google') {
			loginStep = true;
			render();
			document.querySelector('[name=code]')?.focus();
		}
		if (action === 'sound') {
			const muted = target.getAttribute('aria-pressed') !== 'true';
			target.setAttribute('aria-pressed', String(muted));
			target.setAttribute('aria-label', copy[muted ? 'nav.unmute' : 'nav.mute']);
			target.innerHTML = icon(muted ? 'mute' : 'sound');
		}
		if (action === 'fullscreen') {
			void (
				document.fullscreenElement
					? document.exitFullscreen()
					: document.documentElement.requestFullscreen()
			).catch(() => {});
		}
		if (action === 'previous') {
			auditPage = Math.max(1, auditPage - 1);
			render();
		}
		if (action === 'more') {
			auditPage++;
			render();
		}
		if (action === 'account') location.href = './accounts-screen.html?screen=signin';
	});
	document.addEventListener('click', (event) => {
		const target = event.target.closest('dialog [data-action]');
		if (!target) return;
		if (target.dataset.action === 'cancel') target.closest('dialog').close();
		if (target.dataset.action === 'reauth-google') {
			target.hidden = true;
			const fields = document.querySelector('#reauth-fields');
			fields.hidden = false;
			fields.querySelector('input').focus();
		}
	});
	app.addEventListener('submit', (event) => {
		event.preventDefault();
		const form = event.target;
		const values = new FormData(form);
		if (form.id === 'login-form') {
			const valid =
				view === 'recovery'
					? /^[a-zA-Z0-9-]{6,64}$/.test(String(values.get('code') ?? ''))
					: /^\d{6}$/.test(String(values.get('code') ?? ''));
			if (!valid)
				return inform(
					view === 'recovery' ? 'admin.recovery.invalid' : 'admin.code.invalid',
					'error'
				);
			if (['error', 'offline', 'locked'].includes(scenario)) return inform('admin.error', 'error');
			navigate(role === 'admin' ? 'dashboard' : 'moderation');
		}
		if (form.id === 'lookup') {
			const id = String(values.get('reference') ?? '');
			if (!/^[a-zA-Z0-9_-]{3,64}$/.test(id)) return inform('admin.lookup.invalid', 'error');
			if (!['player_demo_28', 'run_demo_104'].includes(id))
				return inform('admin.lookup.missing', 'warning');
			lookupDone = true;
			record(copy['admin.audit.inspection'], id, '—', 'inspected', 'CASE-DEMO-04');
			render();
		}
		if (form.id === 'privacy-form') {
			const context = {
				case: String(values.get('case') ?? ''),
				target: String(values.get('target') ?? '')
			};
			if (
				!values.has('verified') ||
				!/^[a-zA-Z0-9_-]{3,64}$/.test(context.case) ||
				!/^[a-zA-Z0-9_-]{3,64}$/.test(context.target)
			)
				return inform('admin.operator.unverified', 'error');
			if (context.target !== 'player_demo_28') return inform('admin.lookup.missing', 'warning');
			openAction(event.submitter.value, context);
		}
	});
	app.addEventListener('change', (event) => {
		if (event.target.id === 'measurement') inform('privacy.saved');
	});
	window.addEventListener('message', (event) => {
		if (
			event.source !== parent ||
			event.origin !== location.origin ||
			event.data?.type !== 'morphi-v1-complete'
		)
			return;
		if (['play', 'memory', 'block'].includes(view)) navigate('result');
	});
	if (view === 'play') family = drawFamily();
	if (view === 'memory' || view === 'block') {
		family = view;
		stay = view;
	}
	addEventListener('resize', () => {
		if (view === 'home') scatter();
	});
	render();
	if (parent !== window)
		parent.postMessage(
			{ type: 'morphi-v1-preview', screen: view },
			location.origin === 'null' ? '*' : location.origin
		);
})();
