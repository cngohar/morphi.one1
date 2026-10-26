import { t } from './accounts.messages.js';

const sizes = { portrait: [390, 844], landscape: [844, 390], desktop: [1280, 800] };
const parameters = new URLSearchParams(location.search);
const initialScreen = ['signin', 'name', 'profile', 'result', 'leaderboard'].includes(
	parameters.get('screen')
)
	? parameters.get('screen')
	: 'signin';
const initialViewport = Object.hasOwn(sizes, parameters.get('viewport'))
	? parameters.get('viewport')
	: 'portrait';
const select = (id, items) =>
	`<label>${t(`review.${id}`)}<select id="${id}">${items.map((item) => `<option value="${item}">${t(`review.${item}`)}</option>`).join('')}</select></label>`;
document.title = t('meta.title');
document.querySelector('#review').innerHTML =
	`<header class="review-header"><div class="review-heading"><div><p>${t('review.kicker')}</p><h1>${t('review.title')}</h1></div><a id="open" class="review-link" target="_blank" rel="noopener">${t('review.open')}</a></div><div class="review-controls">${select('screen', ['signin', 'name', 'profile', 'result', 'leaderboard'])}${select('viewport', ['portrait', 'landscape', 'desktop'])}${select('state', ['normal', 'cancelled', 'error', 'offline'])}<label class="check"><input type="checkbox" id="signedin" />${t('review.signedin')}</label></div></header><div class="review-stage"><div class="frame-wrap"><iframe title="${t('review.frame')}"></iframe></div></div><footer class="review-footer"><p>${t('review.note')}</p><p>${t('review.tip')}</p></footer>`;
const frame = document.querySelector('iframe');
const wrapper = document.querySelector('.frame-wrap');
const screen = document.querySelector('#screen');
const viewport = document.querySelector('#viewport');
const state = document.querySelector('#state');
const signedin = document.querySelector('#signedin');
screen.value = initialScreen;
viewport.value = initialViewport;
signedin.checked = initialScreen === 'profile';

function fit() {
	const [width, height] = sizes[viewport.value];
	const available = document.querySelector('.review-stage').clientWidth - 32;
	const scale = Math.min(1, available / width);
	frame.width = String(width);
	frame.height = String(height);
	frame.style.transform = `scale(${scale})`;
	wrapper.style.width = `${width * scale}px`;
	wrapper.style.height = `${height * scale}px`;
	const query = new URLSearchParams({ screen: screen.value, viewport: viewport.value });
	history.replaceState(null, '', `${location.pathname}?${query}`);
}

function load() {
	if (screen.value === 'profile') signedin.checked = true;
	const query = new URLSearchParams({
		screen: screen.value,
		state: state.value,
		user: signedin.checked ? 'signedin' : 'guest'
	});
	const url = `./accounts-screen.html?${query}`;
	frame.src = url;
	document.querySelector('#open').href = url;
	fit();
}

screen.addEventListener('change', load);
state.addEventListener('change', load);
signedin.addEventListener('change', load);
viewport.addEventListener('change', fit);
window.addEventListener('resize', fit);
window.addEventListener('message', (event) => {
	if (
		event.source !== frame.contentWindow ||
		event.origin !== location.origin ||
		event.data?.type !== 'morphi-account-preview'
	)
		return;
	if (!['signin', 'name', 'profile', 'result', 'leaderboard'].includes(event.data.screen)) return;
	screen.value = event.data.screen;
	signedin.checked = event.data.signedIn === true;
	const query = new URLSearchParams({
		screen: screen.value,
		state: state.value,
		user: signedin.checked ? 'signedin' : 'guest'
	});
	document.querySelector('#open').href = `./accounts-screen.html?${query}`;
	fit();
});
load();
