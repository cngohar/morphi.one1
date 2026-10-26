import { t } from './accounts.messages.js';

const parameters = new URLSearchParams(location.search);
const screens = ['signin', 'name', 'profile', 'result', 'leaderboard'];
let screen = screens.includes(parameters.get('screen')) ? parameters.get('screen') : 'signin';
let signedIn = parameters.get('user') === 'signedin' || screen === 'profile';
let player = t('demo.player');
let editing = false;
let profileTab = 'overview';
let nameError = '';
let notice = '';
let family = 'block';
let pairCount = '6';
const state = parameters.get('state') || 'normal';
const app = document.querySelector('#app');
const announcement = document.querySelector('#announcement');
const escape = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
	);
const text = (key, values) => escape(t(key, values));
const icon = (name) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${name === 'close' ? 'm6 6 12 12M18 6 6 18' : 'M12 5 5 12l7 7M5 12h14'}" /></svg>`;
const art = () => `<div class="block-art" aria-hidden="true">${'<i></i>'.repeat(12)}</div>`;
const button = (key, action, classes = 'button', extra = '') =>
	`<button type="button" class="${classes}" data-action="${action}" ${extra}>${text(key)}</button>`;
const noticeMarkup = (message) =>
	message ? `<p class="notice" role="status">${escape(message)}</p>` : '';

function header() {
	return `<header class="header"><button class="wordmark" data-action="home" aria-label="${text('nav.home')}">${text('brand')}</button><nav class="header-actions" aria-label="${text('nav.account')}">${screen !== 'signin' && screen !== 'name' ? button('nav.leaderboard', 'leaderboard', 'top-link') : ''}${signedIn && screen !== 'profile' && screen !== 'name' ? `<button class="icon-button" data-action="profile" aria-label="${text('nav.account')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></button>` : ''}<button class="icon-button" data-action="play" aria-label="${text('nav.close')}">${icon('close')}</button></nav></header>`;
}

function signin() {
	const errorKey = {
		cancelled: 'signin.cancelled',
		error: 'signin.error',
		offline: 'signin.offline'
	}[state];
	return `<main class="signin"><section class="intro"><p class="eyebrow">${text('signin.label')}</p><h1 tabindex="-1">${text('signin.title')}</h1><p class="description">${text('signin.description')}</p>${art()}</section><section class="auth-panel" aria-labelledby="auth-title"><h2 id="auth-title">${text('signin.account')}</h2><p>${text('signin.detail')}</p>${noticeMarkup(notice || (errorKey ? t(errorKey) : ''))}${button('signin.google', 'google', 'button secondary google')}${button('signin.guest', 'guest', 'text-button guest')}<p class="privacy">${text('signin.privacy')}</p><p class="optional">${text('signin.optional')}</p></section></main>`;
}

function nameScreen() {
	return `<main class="narrow"><p class="eyebrow">${text('name.label')}</p><h1 tabindex="-1">${text('name.title')}</h1><p class="description">${text('name.description')}</p><form class="name-form" novalidate><label for="player-name">${text('name.field')}</label><input id="player-name" name="playerName" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" value="${editing ? escape(player) : ''}" placeholder="${text('name.example')}" aria-describedby="name-hint${nameError ? ' name-error' : ''}" ${nameError ? 'aria-invalid="true"' : ''} /><p class="hint" id="name-hint">${text('name.hint')}</p>${nameError ? `<p class="notice" id="name-error" role="alert">${escape(nameError)}</p>` : ''}<button class="button" type="submit">${text('name.save')}</button></form>${editing ? button('nav.back', 'profile', 'text-button') : ''}</main>`;
}

function profileGames() {
	const labels = ['profile.game', 'profile.high', 'profile.rounds', 'profile.last', 'profile.band'];
	return `<section class="foundation-card"><div class="card-heading"><h2>${text('profile.games')}</h2>${button('profile.allGames', 'tab-games', 'text-button')}</div>${state === 'empty' ? `<p class="profile-empty">${text('profile.empty')}</p>` : `<div class="family-head">${labels.map((key) => `<span>${text(key)}</span>`).join('')}</div>${['block', 'memory'].map((game) => `<button class="family-row" data-action="detail-${game}"><span><span class="family-thumb" aria-hidden="true">${game === 'block' ? '<span class="mini-block"><i></i><i></i><i></i><i></i></span>' : '◇'}</span>${text(`game.${game}`)}</span><span data-label="${text('profile.high')}"><strong>${text(`game.${game}Best`)}</strong></span><span data-label="${text('profile.rounds')}">${game === 'block' ? '14' : '10'}</span><span data-label="${text('profile.last')}">${text('profile.today')}</span><span><span class="band">${text(game === 'block' ? 'profile.band3' : 'profile.band2')}</span></span></button>`).join('')}`}<p class="family-note">${text('profile.familyNote')}</p></section>`;
}
function profileActivity() {
	return `<section class="foundation-card"><h2>${text('profile.recent')}</h2>${state === 'empty' ? `<p class="profile-empty">${text('profile.empty')}</p>` : `<ul class="recent-activity"><li><span><strong>${text('profile.today')}</strong>${text('profile.activityToday')}</span></li><li><span><strong>${text('profile.yesterday')}</strong>${text('profile.activityYesterday')}</span></li></ul>`}${button('profile.allActivity', 'tab-activity', 'text-button activity-link')}</section>`;
}
function achievementSlot() {
	return `<section class="foundation-card"><div class="card-heading"><h2>${text('profile.achievements')}</h2><small>${text('profile.showcase')}</small></div><div class="achievement-slots"><div><b>1st</b><small>${text('profile.first')}</small></div><div><b>×3</b><small>${text('profile.combo')}</small></div><div><b>?</b><small>${text('profile.locked')}</small></div></div></section>`;
}
function accountSlot() {
	return `<section class="foundation-card"><h2>${text('profile.account')}</h2><p>${text('profile.connection')}</p><small>${text(state === 'offline' ? 'profile.offlineDetail' : 'profile.connectionDetail')}</small><div class="rail-account-actions">${button('profile.signout', 'signout', 'text-button')}${button('profile.delete', 'delete', 'text-button')}</div></section>`;
}
function profile() {
	const left = {
		overview: profileGames() + profileActivity(),
		games: profileGames(),
		activity: profileActivity(),
		achievements: achievementSlot(),
		settings: `<section class="foundation-card"><h2>${text('profile.settings')}</h2>${button('profile.edit', 'edit', 'text-button')}<label class="profile-setting"><input type="checkbox" checked />${text('profile.sound')}</label></section>${accountSlot()}`
	}[profileTab];
	return `<main class="foundation"><section class="identity-band"><div class="preset-avatar" aria-hidden="true">${escape(player[0].toLowerCase())}</div><div class="identity-name"><h1 tabindex="-1">${escape(player)}</h1><p>${text('profile.since')}</p></div><div class="level-slot"><span class="level-tag">${text('profile.level')}</span><div class="xp-line"><span>${text('profile.xp')}</span><span class="xp-track" aria-hidden="true"><i></i></span></div><small>${text('profile.nextLevel')}</small></div><div class="identity-actions">${button('profile.edit', 'edit', 'text-button')}${button('profile.play', 'play')}</div></section>${state === 'offline' ? `<div class="save-status"><strong>${text('profile.offline')}</strong></div>` : ''}<nav class="profile-tabs" role="tablist" aria-label="${text('profile.label')}">${['overview', 'games', 'achievements', 'activity', 'settings'].map((tab) => `<button id="tab-${tab}" role="tab" aria-controls="profile-panel" aria-selected="${profileTab === tab}" tabindex="${profileTab === tab ? '0' : '-1'}" data-action="tab-${tab}">${text(`profile.${tab}`)}</button>`).join('')}</nav><section class="aggregate-strip">${[
		['24', 'profile.rounds'],
		['2', 'profile.families'],
		['9', 'profile.rankedRounds'],
		['#28', 'profile.rank']
	]
		.map(
			([value, key]) =>
				`<div><strong>${state === 'empty' ? '—' : value}</strong><span>${text(key)}</span></div>`
		)
		.join(
			''
		)}</section><div class="foundation-grid"><div class="foundation-left" id="profile-panel" role="tabpanel" aria-labelledby="tab-${profileTab}">${left}</div><aside class="profile-rail"><section class="foundation-card"><h2>${text('profile.progression')}</h2><p>${text('profile.mastery')}</p><small>${text('profile.bronze')}</small><span class="mastery-track" aria-hidden="true"><i></i></span></section>${achievementSlot()}${accountSlot()}</aside></div></main>`;
}
function profileDetail(game) {
	const dialog = document.createElement('dialog');
	dialog.className = 'profile-detail';
	dialog.setAttribute('aria-labelledby', 'profile-detail-title');
	dialog.innerHTML = `<h2 id="profile-detail-title">${text(`game.${game}`)}</h2><p>${text('profile.detailNote')}</p><dl><div><dt>${text('profile.high')}</dt><dd>${text(`game.${game}Best`)}</dd></div><div><dt>${text('profile.rounds')}</dt><dd>${game === 'block' ? '14' : '10'}</dd></div><div><dt>${text('profile.band')}</dt><dd>${text(game === 'block' ? 'profile.band3' : 'profile.band2')}</dd></div><div><dt>${text('profile.last')}</dt><dd>${text('profile.today')}</dd></div></dl>${button('profile.closeDetail', 'close-detail')}`;
	app.append(dialog);
	dialog.showModal();
 globalThis.MorphiMotion?.dismissOnBackdrop(dialog,()=>dialog.close());
	dialog.addEventListener(
		'close',
		() => {
			dialog.remove();
			app.querySelector(`[data-action="detail-${game}"]`)?.focus();
		},
		{ once: true }
	);
}

function result() {
	return `<main class="result-layout"><section class="result-heading"><p class="eyebrow">${text('result.label')}</p><h1 tabindex="-1">${text('result.title')}</h1>${art()}</section><section class="result-content" aria-label="${text('result.scoreLabel')}"><p class="score-label">${text('result.scoreLabel')}</p><p class="score">${text('result.score')}</p><p class="best">${text('result.best')}</p><p class="summary">${text('result.summary')}</p>${button('result.next', 'next')}<div class="save-prompt">${signedIn ? `<strong>${text(state === 'offline' ? 'result.pending' : 'result.saved')}</strong><p>${text('result.unranked')}</p>` : `<strong>${text('result.save')}</strong><p>${text('result.saveDetail')}</p>${button('result.saveAction', 'signin', 'text-button')}<p>${text('result.local')}</p>`}</div>${noticeMarkup(notice)}</section></main>`;
}

function leaderboard() {
	const names = ['board.name1', 'board.name2', 'board.name3'];
	const rows = names
		.map(
			(name, i) =>
				`<tr><td>${text(`demo.number${i + 1}`)}</td><td>${text(name)}</td><td>${family === 'block' ? text(`board.block${i + 1}`) : escape(Math.floor((Number(t(`board.memory${i + 1}`).replaceAll(',', '')) * Number(pairCount)) / 6).toLocaleString('en-US'))}</td></tr>`
		)
		.join('');
	return `<main class="board-main"><div class="page-top"><div><p class="eyebrow">${text('board.label')}</p><h1 tabindex="-1">${text('board.title')}</h1></div></div><p class="description">${text('board.description')}</p><div class="tabs" role="group" aria-label="${text('nav.leaderboard')}">${button('game.block', 'block', '', `aria-pressed="${family === 'block'}"`)}${button('game.memory', 'memory', '', `aria-pressed="${family === 'memory'}"`)}</div>${family === 'memory' ? `<div class="pair-filter"><label for="pair-count">${text('board.group')}</label><select id="pair-count">${['6', '8', '10'].map((count) => `<option value="${count}" ${pairCount === count ? 'selected' : ''}>${text('game.pairs', { count })}</option>`).join('')}</select></div>` : ''}${state === 'offline' ? noticeMarkup(t('board.offline')) : `<table aria-label="${text(family === 'block' ? 'game.block' : 'game.memory')}"><thead><tr><th scope="col">${text('board.rank')}</th><th scope="col">${text('board.player')}</th><th scope="col">${text('board.score')}</th></tr></thead><tbody>${rows}</tbody></table>${signedIn && family === 'block' ? `<div class="your-position"><div><p class="hint">${text('board.yourRank')}</p><p>${text('board.position')}${text('demo.separator')}${text('board.you', { name: player })}</p></div><strong>${text('board.positionScore')}</strong></div>` : ''}`}<div class="board-invite"><p>${text(signedIn ? (family === 'block' ? 'board.returnDetail' : 'board.noRankDetail') : 'board.guest')}</p>${button(signedIn ? 'board.playRanked' : 'nav.signin', signedIn ? 'ranked' : 'signin', signedIn ? 'button' : 'button secondary')}</div><p class="explanation">${text('board.fairness')}</p>${noticeMarkup(notice)}</main>`;
}

function render(focus = true) {
	if (screen === 'result') {
		location.replace('./v1-screen.html?screen=result');
		return;
	}
	document.title = t('meta.title');
	app.innerHTML = `<div class="shell">${header()}${{ signin, name: nameScreen, profile, result, leaderboard }[screen]()}<footer class="footer"><a href="./v1-screen.html?screen=privacy">${text('footer.privacy')}</a><span aria-hidden="true">·</span><a href="./v1-screen.html?screen=terms">${text('footer.terms')}</a></footer></div>`;
	if (focus) app.querySelector('h1')?.focus({ preventScroll: true });
	if (window.parent !== window)
		window.parent.postMessage(
			{ type: 'morphi-account-preview', screen, signedIn },
			location.origin === 'null' ? '*' : location.origin
		);
}

function go(next) {
	screen = next;
	notice = '';
	nameError = '';
	render();
}

function deleteDialog() {
	const dialog = document.createElement('dialog');
	dialog.setAttribute('aria-labelledby', 'delete-title');
	dialog.setAttribute('aria-describedby', 'delete-description');
	dialog.innerHTML = `<h2 id="delete-title">${text('delete.title')}</h2><p id="delete-description">${text('delete.description')}</p>${button('delete.confirm', 'confirm-delete')}${button('delete.cancel', 'cancel-delete', 'text-button')}`;
	app.append(dialog);
	dialog.addEventListener('close', () => dialog.remove(), { once: true });
	dialog.showModal();
 globalThis.MorphiMotion?.dismissOnBackdrop(dialog,()=>dialog.close());
	dialog.querySelector('[data-action="cancel-delete"]').focus();
}

function act(action) {
	if (action === 'home') {
		location.href = './v1-screen.html?screen=home';
		return;
	}
	if (action.startsWith('tab-')) {
		profileTab = action.slice(4);
		render(false);
		app.querySelector(`[data-action="${action}"]`)?.focus();
		return;
	}
	if (action === 'detail-block' || action === 'detail-memory') {
		profileDetail(action.slice(7));
		return;
	}
	if (action === 'close-detail') {
		app.querySelector('dialog')?.close();
		return;
	}
	if (action === 'play') {
		location.href = './v1-screen.html?screen=play';
		return;
	}
	if (action === 'google') {
		if (state === 'offline') {
			notice = t('signin.offline');
			render();
			return;
		}
		if (state === 'error') {
			notice = t('signin.error');
			render();
			return;
		}
		if (state === 'cancelled') {
			notice = t('signin.cancelled');
			render();
			return;
		}
		signedIn = true;
		editing = false;
		go('name');
	} else if (action === 'guest') {
		signedIn = false;
		location.href = './v1-screen.html?screen=play';
	} else if (action === 'next' || action === 'ranked') {
		notice = t(action === 'next' ? 'demo.next' : 'demo.ranked');
		render(false);
		announcement.textContent = notice;
	} else if (action === 'edit') {
		editing = true;
		go('name');
	} else if (action === 'signout') {
		signedIn = false;
		go('signin');
	} else if (action === 'delete') deleteDialog();
	else if (action === 'cancel-delete') app.querySelector('dialog')?.close();
	else if (action === 'confirm-delete') {
		app.querySelector('dialog')?.close();
		signedIn = false;
		player = t('demo.player');
		go('signin');
		notice = t('delete.done');
		render();
	} else if (action === 'block' || action === 'memory') {
		family = action;
		render(false);
		app.querySelector(`[data-action="${action}"]`)?.focus();
	} else if (screens.includes(action)) go(action);
}

function guard(callback) {
	return (event) => {
		try {
			callback(event);
		} catch (error) {
			console.error('morphi:account_preview_failed', error);
			announcement.textContent = t('demo.failure');
		}
	};
}

app.addEventListener(
	'click',
	guard((event) => {
		const target = event.target.closest('[data-action]');
		if (target) act(target.dataset.action);
	})
);
app.addEventListener(
	'change',
	guard((event) => {
		if (event.target.id === 'pair-count') {
			pairCount = event.target.value;
			render(false);
			app.querySelector('#pair-count').focus();
		}
	})
);
app.addEventListener(
	'submit',
	guard((event) => {
		event.preventDefault();
		const value = new FormData(event.target).get('playerName')?.trim() || '';
		if (!/^[A-Za-z0-9_]{3,20}$/.test(value)) nameError = t('name.invalid');
		else if (['mira', 'noor', 'sam'].includes(value.toLowerCase())) nameError = t('name.taken');
		else {
			player = value;
			editing = false;
			go('profile');
			return;
		}
		render(false);
		const input = app.querySelector('#player-name');
		input.value = value;
		input.focus();
	})
);
render(false);

app.addEventListener('keydown', (event) => {
	const tab = event.target.closest('[role="tab"]');
	if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault();
	const tabs = ['overview', 'games', 'achievements', 'activity', 'settings'];
	const index = tabs.indexOf(profileTab);
	profileTab =
		event.key === 'Home'
			? tabs[0]
			: event.key === 'End'
				? tabs.at(-1)
				: tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
	render(false);
	app.querySelector(`#tab-${profileTab}`)?.focus();
});
