import { expect, test, type Browser } from '@playwright/test';
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { createAuth } from '../../src/lib/server/auth.js';
import { totp } from '../../src/lib/server/admin-totp.js';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

test.use({ baseURL: 'http://localhost:5173' });
const origin = 'http://localhost:5173';
const users: { id: string; role: string | null }[] = [];
let taxonomyName = '';

async function fixture(role: 'admin' | 'moderator' | 'support' | null = null) {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const helpers = (
			await betterAuth({
				...createAuth(proxy.env.DB, {
					baseURL: origin,
					secret: proxy.env.BETTER_AUTH_SECRET,
					googleClientId: '',
					googleClientSecret: ''
				}).options,
				plugins: [testUtils()]
			}).$context
		).test;
		const user = await helpers.saveUser(
			helpers.createUser({ email: `${crypto.randomUUID()}@example.test`, name: 'Support fixture' })
		);
		users.push({ id: user.id, role });
		const login = await helpers.login({ userId: user.id });
		if (role) {
			const secret = new Uint8Array(20).fill(11),
				iv = randomBytes(12),
				cipher = createCipheriv(
					'aes-256-gcm',
					createHash('sha256').update(`operator-v1:${proxy.env.BETTER_AUTH_SECRET}`).digest(),
					iv
				);
			const data = Buffer.concat([cipher.update(secret), cipher.final(), cipher.getAuthTag()]);
			await proxy.env.DB.batch([
				proxy.env.DB.prepare('INSERT INTO admin_actor(id,role) VALUES(?,?)').bind(user.id, role),
				proxy.env.DB.prepare(
					'INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES(?,?)'
				).bind(user.id, JSON.stringify({ iv: Array.from(iv), data: Array.from(data) }))
			]);
		} else {
			await proxy.env.DB.prepare(
				'INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)'
			)
				.bind(
					user.id,
					`p_${user.id.slice(0, 8)}`,
					`p_${user.id.slice(0, 8)}`.toLowerCase(),
					Date.now()
				)
				.run();
		}
		return { id: user.id, login };
	} finally {
		await proxy.dispose();
	}
}

async function memberContext(browser: Browser, member: Awaited<ReturnType<typeof fixture>>) {
	const context = await browser.newContext({ baseURL: origin });
	await context.addCookies(member.login.cookies);
	return context;
}

async function operatorContext(browser: Browser, operator: Awaited<ReturnType<typeof fixture>>) {
	const context = await memberContext(browser, operator);
	const page = await context.newPage();
	await page.goto('/admin/sign-in');
	await page.getByRole('textbox').fill(totp(new Uint8Array(20).fill(11), Date.now()));
	await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/dashboard$/);
	return { context, page };
}

test.afterAll(async () => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		if (taxonomyName)
			await proxy.env.DB.prepare(
				'UPDATE support_ticket SET category_id=? WHERE category_id=(SELECT id FROM support_category WHERE normalized_name=?)'
			)
				.bind('general', taxonomyName.normalize('NFKC').toLocaleLowerCase('en-US'))
				.run();
		if (taxonomyName)
			await proxy.env.DB.prepare(
				'DELETE FROM support_category WHERE normalized_name=? AND is_default=0'
			)
				.bind(taxonomyName.normalize('NFKC').toLocaleLowerCase('en-US'))
				.run();
		for (const user of users)
			await proxy.env.DB.batch([
				proxy.env.DB.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(user.id),
				proxy.env.DB.prepare('DELETE FROM admin_actor WHERE id=?').bind(user.id),
				proxy.env.DB.prepare('DELETE FROM user WHERE id=?').bind(user.id)
			]);
	} finally {
		await proxy.dispose();
	}
});

test('members create private tickets, retry ambiguous writes, read replies and delete conversations', async ({
	browser
}) => {
	const member = await fixture(),
		other = await fixture(),
		moderator = await fixture('moderator'),
		context = await memberContext(browser, member),
		page = await context.newPage();
	await page.setViewportSize({ width: 390, height: 844 });
	const pageResponse = await page.goto('/account/support');
	expect(pageResponse?.headers()['cache-control']).toContain('private, no-store');
	expect(pageResponse?.headers()['x-robots-tag']).toBe('noindex');
	await expect(page.getByRole('heading', { name: 'All tickets', exact: true })).toBeVisible();
	await expect(page.getByText('No support tickets yet.', { exact: true })).toBeVisible();
	for (const label of ['Subject', 'Category', 'Priority', 'Message'])
		await expect(page.getByLabel(label)).toBeVisible();

	const token = crypto.randomUUID().slice(0, 8),
		subject = `Support ${token}`,
		message = `<img src=x onerror=alert(1)> & [plain text](https://example.invalid)
Second line`;
	await page.getByLabel('Subject').fill(subject);
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill(message);
	await page.getByLabel('Subject').focus();
	for (const label of ['Category', 'Priority', 'Message']) {
		await page.keyboard.press('Tab');
		await expect(page.getByLabel(label)).toBeFocused();
	}
	const create = page.getByRole('button', { name: 'Create ticket', exact: true });
	await page.keyboard.press('Tab');
	await expect(create).toBeFocused();

	const requestIds: string[] = [];
	let ownerKey = '',
		ticketId = '';
	await page.route(
		(url) => url.pathname === '/api/support',
		async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			const body = route.request().postDataJSON() as { requestId: string; ownerKey: string };
			requestIds.push(body.requestId);
			ownerKey = body.ownerKey;
			if (requestIds.length === 1) {
				const response = await route.fetch();
				ticketId = (await response.json()).ticketId as string;
				await route.abort('failed');
				return;
			}
			await route.continue();
		}
	);
	await page.keyboard.press('Enter');
	await expect(
		page.getByRole('status').filter({ hasText: 'Support is unavailable right now.' })
	).toBeVisible();
	await expect(page.getByLabel('Subject')).toHaveValue(subject);
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(message);
	const stored = await page.evaluate(
		() =>
			`${Object.values(localStorage).join('\n')}\n${Object.values(sessionStorage).join('\n')}\n${document.cookie}`
	);
	expect(stored).not.toContain(subject);
	expect(stored).not.toContain(message);
	const retry = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/support' && response.request().method() === 'POST'
	);
	await create.click();
	const retryResponse = await retry;
	expect(retryResponse.status()).toBe(200);
	expect(requestIds).toHaveLength(2);
	expect(requestIds[1]).toBe(requestIds[0]);
	expect((await retryResponse.json()).ticketId).toBe(ticketId);
	await expect(page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
	const messageBody = page.getByTestId('support-message').first().locator('.message-body');
	await expect(messageBody).toContainText('<img src=x onerror=alert(1)>');
	await expect(messageBody).toHaveCSS('white-space', 'pre-wrap');
	expect(await messageBody.locator('img, a, script').count()).toBe(0);

	const listResponse = await context.request.get('/api/support');
	expect(listResponse.status()).toBe(200);
	expect(listResponse.headers()['cache-control']).toContain('private, no-store');
	expect(listResponse.headers()['x-robots-tag']).toBe('noindex');
	expect((await listResponse.json()).tickets.map((ticket: { id: string }) => ticket.id)).toEqual([
		ticketId
	]);
	const conversationResponse = await context.request.get(`/api/support/${ticketId}`);
	expect(conversationResponse.headers()['x-robots-tag']).toBe('noindex');
	expect((await conversationResponse.json()).messages[0].body).toBe(message);

	const otherContext = await memberContext(browser, other),
		otherPage = await otherContext.newPage();
	await otherPage.goto('/account/support');
	await expect(otherPage.getByRole('heading', { name: 'All tickets', exact: true })).toBeVisible();
	let otherOwnerKey = '';
	await otherPage.route(
		(url) => url.pathname === '/api/support',
		async (route) => {
			if (route.request().method() === 'POST')
				otherOwnerKey = (route.request().postDataJSON() as { ownerKey: string }).ownerKey;
			await route.continue();
		}
	);
	await otherPage.getByLabel('Subject').fill(`Other ${token}`);
	await otherPage
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Separate member ticket');
	const otherCreate = otherPage.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/support' && response.request().method() === 'POST'
	);
	await otherPage.getByRole('button', { name: 'Create ticket', exact: true }).click();
	const otherCreateResponse = await otherCreate;
	const separateTicketId = ((await otherCreateResponse.json()) as { ticketId: string }).ticketId;
	await expect(
		otherPage.getByRole('heading', { name: `Other ${token}`, exact: true })
	).toBeVisible();
	const deniedRead = await otherContext.request.get(`/api/support/${ticketId}`);
	expect(deniedRead.status()).toBe(404);
	const deniedWrite = await otherContext.request.post(`/api/support/${ticketId}`, {
		headers: { origin, 'content-type': 'application/json' },
		data: {
			ownerKey: otherOwnerKey,
			requestId: crypto.randomUUID(),
			action: 'reply',
			message: 'Cross-account attempt'
		}
	});
	expect(deniedWrite.status()).toBe(404);
	expect((await otherContext.request.get('/api/support')).status()).toBe(200);

	const guest = await browser.newContext({ baseURL: origin });
	expect((await guest.request.get('/api/support')).status()).toBe(401);
	expect((await guest.request.get(`/api/support/${ticketId}`)).status()).toBe(401);
	const guestPage = await guest.newPage();
	await guestPage.goto('/account/support');
	await expect(guestPage).toHaveURL(/\/account\/sign-in$/);
	await guest.close();

	await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Member follow-up');
	await page.getByRole('button', { name: 'Send reply', exact: true }).click();
	await expect(page.getByTestId('support-message')).toHaveCount(2);
	await page.getByRole('button', { name: 'Back to tickets', exact: true }).click();

	const staff = await operatorContext(browser, moderator);
	await staff.page.goto('/admin/support');
	await expect(
		staff.page.getByRole('heading', { name: 'Member support', exact: true })
	).toBeVisible();
	await staff.page.getByRole('button', { name: subject, exact: false }).click();
	await staff.page.getByLabel('Category').selectOption('general');
	await staff.page.getByLabel('Priority').selectOption('normal');
	await staff.page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(staff.page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
	const staffReply = 'A staff reply with plain text.';
	await staff.page.getByRole('textbox', { name: 'Message', exact: true }).fill(staffReply);
	await staff.page.getByRole('button', { name: 'Send reply', exact: true }).click();
	await expect(staff.page.getByTestId('support-message').last()).toContainText(staffReply);
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 }
	]) {
		await staff.page.setViewportSize(viewport);
		await expect(staff.page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
		expect(
			await staff.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await staff.page.screenshot({
			path: `build/v1.3.3/support-staff-${viewport.width}x${viewport.height}.png`,
			fullPage: true,
			animations: 'disabled'
		});
	}
	await staff.page.getByRole('button', { name: 'Back to tickets', exact: true }).click();
	await staff.page.getByRole('button', { name: `Other ${token}`, exact: false }).click();
	await staff.page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Staff closes this other ticket.');
	await staff.page.getByRole('button', { name: 'Reply and close', exact: true }).click();
	await expect(
		staff.page.getByText('This ticket is closed. You can still read the conversation.')
	).toBeVisible();
	const otherConversation = await otherContext.request.get(`/api/support/${separateTicketId}`);
	const otherResult = (await otherConversation.json()) as {
		ticket: { state: string };
		messages: { body: string }[];
	};
	expect(otherResult.ticket.state).toBe('closed');
	expect(otherResult.messages.at(-1)?.body).toBe('Staff closes this other ticket.');
	await staff.context.close();
	await otherContext.close();

	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(page.getByText('Unread staff reply', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: subject, exact: false }).click();
	await expect(page.getByTestId('support-message').last()).toContainText(staffReply);
	await expect(page.getByTestId('support-message').last()).toContainText('Staff');
	const cookies = await context.cookies();
	const recoveryDraft = 'Member follow-up after staff reply';
	await context.clearCookies();
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill(recoveryDraft);
	const deniedReply = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === `/api/support/${ticketId}` &&
			response.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Send reply', exact: true }).click();
	const deniedReplyResponse = await deniedReply;
	expect(deniedReplyResponse.status()).toBe(401);
	await expect(page.getByRole('status').filter({ hasText: 'Your session expired.' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
		recoveryDraft
	);
	await context.addCookies(cookies);
	const retriedReply = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === `/api/support/${ticketId}` &&
			response.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Send reply', exact: true }).click();
	const retriedReplyResponse = await retriedReply;
	expect(retriedReplyResponse.status()).toBe(200);
	expect(retriedReplyResponse.request().postDataJSON().requestId).toBe(
		deniedReplyResponse.request().postDataJSON().requestId
	);
	await expect(page.getByTestId('support-message')).toHaveCount(4);
	await expect(page.getByTestId('support-message').last()).toContainText(recoveryDraft);
	await page.getByRole('button', { name: 'Back to tickets', exact: true }).click();
	await expect(page.getByText('Unread staff reply', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: subject, exact: false }).click();
	await page.getByRole('button', { name: 'Close ticket', exact: true }).click();
	await expect(
		page.getByText('This ticket is closed. You can still read the conversation.')
	).toBeVisible();
	const closedReply = await context.request.post(`/api/support/${ticketId}`, {
		headers: { origin, 'content-type': 'application/json' },
		data: { ownerKey, requestId: crypto.randomUUID(), action: 'reply', message: 'After close' }
	});
	expect(closedReply.status()).toBe(409);
	expect((await closedReply.json()).code).toBe('support_closed');

	const badOrigin = await context.request.post('/api/support', {
		headers: { origin: 'https://other.example', 'content-type': 'application/json' },
		data: {}
	});
	expect(badOrigin.status()).toBe(403);
	expect(badOrigin.headers()['cache-control']).toContain('private, no-store');
	const tooLarge = await context.request.post('/api/support', {
		headers: { origin, 'content-type': 'application/json' },
		data: JSON.stringify({ message: 'x'.repeat(33_000) })
	});
	expect(tooLarge.status()).toBe(413);
	expect(tooLarge.headers()['x-robots-tag']).toBe('noindex');

	await page.getByRole('button', { name: 'Back to tickets', exact: true }).click();
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await expect(page.getByRole('heading', { name: 'All tickets', exact: true })).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await page.screenshot({
			path: `build/v1.3.3/support-${viewport.width}x${viewport.height}.png`,
			fullPage: true,
			animations: 'disabled'
		});
	}

	await page.goto('/account');
	await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
	const settings = page.getByRole('tab', { name: 'Settings', exact: true });
	await settings.click();
	await expect(settings).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: 'Delete account', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Delete account', exact: true }).click();
	await expect(page).toHaveURL(/\/account\/sign-in\?deleted=1$/);
	expect((await context.request.get('/api/support')).status()).toBe(401);
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		expect(
			await proxy.env.DB.prepare('SELECT count(*) count FROM support_ticket WHERE user_id=?')
				.bind(member.id)
				.first<{ count: number }>()
		).toMatchObject({ count: 0 });
		expect(
			await proxy.env.DB.prepare('SELECT count(*) count FROM support_message WHERE ticket_id=?')
				.bind(ticketId)
				.first<{ count: number }>()
		).toMatchObject({ count: 0 });
	} finally {
		await proxy.dispose();
		await context.close();
	}
});

test('operator permissions keep the support role out and restrict taxonomy to admins', async ({
	browser
}) => {
	const support = await fixture('support'),
		moderator = await fixture('moderator'),
		admin = await fixture('admin');
	const supportStaff = await operatorContext(browser, support);
	expect((await supportStaff.context.request.get('/admin/support/data')).status()).toBe(403);
	expect((await supportStaff.context.request.get('/admin/support')).status()).toBe(403);
	await supportStaff.context.close();

	const mod = await operatorContext(browser, moderator);
	await mod.page.goto('/admin/support');
	await expect(mod.page.getByRole('heading', { name: 'All tickets', exact: true })).toBeVisible();
	await expect(mod.page.getByRole('heading', { name: 'Categories and priorities' })).toHaveCount(0);
	const taxonomyDenied = await mod.context.request.post('/admin/support/data/taxonomy', {
		headers: { origin, 'content-type': 'application/json' },
		data: {
			ownerKey: '',
			requestId: crypto.randomUUID(),
			action: 'save',
			kind: 'category',
			name: 'Denied'
		}
	});
	expect(taxonomyDenied.status()).toBe(403);
	await mod.context.close();

	const staffAdmin = await operatorContext(browser, admin);
	await staffAdmin.page.goto('/admin/support');
	const taxonomy = staffAdmin.page.locator('section[aria-labelledby="support-taxonomy-title"]');
	await expect(taxonomy.getByRole('heading', { name: 'Categories and priorities' })).toBeVisible();
	taxonomyName = `Case ${crypto.randomUUID().slice(0, 8)}`;
	const addCategory = taxonomy
		.getByRole('button', { name: 'Add', exact: true })
		.first()
		.locator('..');
	await addCategory.getByLabel('Name').fill(taxonomyName);
	await addCategory.getByRole('button', { name: 'Add', exact: true }).click();
	const category = taxonomy.getByLabel(`Name: ${taxonomyName}`);
	await expect(category).toBeVisible();
	await category
		.locator('xpath=ancestor::form[1]')
		.getByRole('button', { name: 'Delete and reassign' })
		.click();
	await expect(category).toHaveCount(0);
	await staffAdmin.context.close();
});
