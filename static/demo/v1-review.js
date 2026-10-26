(() => {
	const copy = globalThis.MorphiV1Messages;
	const t = (key) => copy[key] ?? key;
	const screens = [
		'home',
		'signin',
		'name',
		'profile',
		'leaderboard',
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
	const sizes = { portrait: [390, 844], landscape: [844, 390], desktop: [1280, 800] };
	const params = new URLSearchParams(location.search);
	const accountScreens = ['signin', 'name', 'profile', 'leaderboard'];
	let accountPreview = accountScreens.includes(params.get('screen'));
	let accountSignedIn = params.get('user') === 'signedin' || params.get('screen') === 'profile';
	const frameUrl = (query) => `./${accountPreview ? 'accounts-screen' : 'v1-screen'}.html?${query}`;
	const select = (id, values, prefix = 'review') =>
		`<label>${t(`review.${id}`)}<select id="${id}">${values.map((value) => `<option value="${value}">${t(`${prefix}.${value}`)}</option>`).join('')}</select></label>`;
	document.title = t('review.title');
	document.querySelector('#review').innerHTML =
		`<header class="review-header"><div class="review-heading"><div><p class="eyebrow">${t('review.kicker')}</p><h1>${t('review.title')}</h1></div><a id="open" class="btn small" target="_blank" rel="noopener">${t('review.open')}</a></div><div class="review-controls">${select('screen', screens, 'view')}${select('viewport', Object.keys(sizes))}${select('state', ['normal', 'error', 'empty', 'offline', 'reauth', 'locked', 'saveerror'])}${select('role', ['admin', 'moderator', 'support', 'player'])}<button id="complete" class="btn">${t('review.finish')}</button><button id="reset" class="btn">${t('review.reset')}</button></div></header><div class="review-stage"><div class="frame-wrap"><iframe title="${t('review.frame')}"></iframe></div></div><footer class="review-note"><p>${t('review.note')}</p><p>${t('review.instructions')}</p><p>${t('review.gates')}</p></footer>`;
	const frame = document.querySelector('iframe');
	const fields = Object.fromEntries(
		['screen', 'viewport', 'state', 'role'].map((id) => [id, document.getElementById(id)])
	);
	for (const [key, values] of Object.entries({
		screen: screens,
		viewport: Object.keys(sizes),
		state: ['normal', 'error', 'empty', 'offline', 'reauth', 'locked', 'saveerror'],
		role: ['admin', 'moderator', 'support', 'player']
	})) {
		fields[key].value = values.includes(params.get(key)) ? params.get(key) : values[0];
	}
	function fit() {
		const [width, height] = sizes[fields.viewport.value];
		const scale = Math.min(
			1,
			Math.max(160, document.querySelector('.review-stage').clientWidth - 32) / width
		);
		frame.width = String(width);
		frame.height = String(height);
		frame.style.transform = `scale(${scale})`;
		const wrap = document.querySelector('.frame-wrap');
		wrap.style.width = `${width * scale}px`;
		wrap.style.height = `${height * scale}px`;
	}
	function updateLink() {
		const query = new URLSearchParams(
			Object.entries(fields).map(([key, field]) => [key, field.value])
		);
		if (accountPreview) query.set('user', accountSignedIn ? 'signedin' : 'guest');
		document.querySelector('#open').href = frameUrl(query);
		try {
			history.replaceState(null, '', `${location.pathname}?${query}`);
		} catch {
			/* file: review still works */
		}
		return query;
	}
	function load() {
		accountPreview = accountScreens.includes(fields.screen.value);
		if (fields.screen.value === 'profile') accountSignedIn = true;
		frame.src = frameUrl(updateLink());
		fit();
	}
	for (const [key, field] of Object.entries(fields))
		field.addEventListener(
			'change',
			key === 'viewport'
				? () => {
						fit();
						updateLink();
					}
				: load
		);
	document.querySelector('#reset').addEventListener('click', load);
	document
		.querySelector('#complete')
		.addEventListener('click', () =>
			frame.contentWindow.postMessage(
				{ type: 'morphi-v1-complete' },
				location.origin === 'null' ? '*' : location.origin
			)
		);
	window.addEventListener('resize', fit);
	window.addEventListener('message', (event) => {
		if (
			event.source !== frame.contentWindow ||
			event.origin !== location.origin ||
			!['morphi-v1-preview', 'morphi-account-preview'].includes(event.data?.type) ||
			!screens.includes(event.data.screen)
		)
			return;
		accountPreview = event.data.type === 'morphi-account-preview';
		if (accountPreview) accountSignedIn = event.data.signedIn === true;
		fields.screen.value = event.data.screen;
		updateLink();
	});
	load();
})();
