import type { MessageKey } from '#lib/i18n/messages.js';

/** Reviewed publication candidate. Publication/deployment status lives in PRIVACY_REVIEW.md. */
export const privacyPolicy = {
	version: '2026-11-05-member-support',
	updatedOn: '2026-11-05',
	operatorName: 'Ali Gohar',
	contactEmail: 'cngohar@gmail.com',
	audience: 'general',
	sections: [
		{ id: 'about', heading: 'privacy.about.title', paragraphs: ['privacy.about.body'] },
		{
			id: 'information',
			heading: 'privacy.information.title',
			paragraphs: [
				'privacy.information.google',
				'privacy.information.progress',
				'privacy.information.security',
				'privacy.information.requests',
				'privacy.information.support'
			]
		},
		{
			id: 'use',
			heading: 'privacy.use.title',
			paragraphs: ['privacy.use.body', 'privacy.use.google']
		},
		{ id: 'public', heading: 'privacy.public.title', paragraphs: ['privacy.public.body'] },
		{
			id: 'device',
			heading: 'privacy.device.title',
			paragraphs: [
				'privacy.device.cookies',
				'privacy.device.storage',
				'privacy.device.checkpoint',
				'privacy.device.guest'
			]
		},
		{
			id: 'providers',
			heading: 'privacy.providers.title',
			paragraphs: ['privacy.providers.body', 'privacy.providers.marketing'],
			links: [
				{ label: 'privacy.providers.google', href: 'https://policies.google.com/privacy' },
				{ label: 'privacy.providers.cloudflare', href: 'https://www.cloudflare.com/privacypolicy/' }
			]
		},
		{
			id: 'analytics',
			heading: 'privacy.analytics.title',
			paragraphs: ['privacy.analytics.body', 'privacy.analytics.limits'],
			links: [
				{
					label: 'privacy.analytics.details',
					href: 'https://developers.cloudflare.com/web-analytics/data-metrics/'
				}
			]
		},
		{
			id: 'retention',
			heading: 'privacy.retention.title',
			paragraphs: [
				'privacy.retention.account',
				'privacy.retention.support',
				'privacy.retention.session',
				'privacy.retention.records'
			]
		},
		{
			id: 'choices',
			heading: 'privacy.choices.title',
			paragraphs: ['privacy.choices.account', 'privacy.choices.device', 'privacy.choices.google'],
			links: [
				{ label: 'privacy.choices.connections', href: 'https://myaccount.google.com/connections' }
			]
		},
		{ id: 'changes', heading: 'privacy.changes.title', paragraphs: ['privacy.changes.body'] }
	] satisfies {
		id: string;
		heading: MessageKey;
		paragraphs: MessageKey[];
		links?: { label: MessageKey; href: string }[];
	}[]
};
