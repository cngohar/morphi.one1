import type { MessageKey } from '#lib/i18n/messages.js';

export type ContentBlock =
	| { kind: 'heading' | 'paragraph'; text: MessageKey }
	| { kind: 'faq'; question: MessageKey; answer: MessageKey }
	| { kind: 'steps' };

export const dealSteps = ['play', 'deal', 'score', 'next'] as const;
export const explainers = {
	'how-it-works': {
		title: 'explainer.how.title',
		intro: 'explainer.how.intro',
		blocks: [
			{ kind: 'steps' },
			{ kind: 'heading', text: 'explainer.how.rules.title' },
			{ kind: 'paragraph', text: 'explainer.how.rules.body' }
		]
	},
	about: {
		title: 'explainer.about.title',
		intro: 'explainer.about.intro',
		blocks: [
			{ kind: 'heading', text: 'explainer.about.idea.title' },
			{ kind: 'paragraph', text: 'explainer.about.idea.body' },
			{ kind: 'heading', text: 'explainer.about.play.title' },
			{ kind: 'paragraph', text: 'explainer.about.play.body' },
			{ kind: 'heading', text: 'explainer.about.maker.title' },
			{ kind: 'paragraph', text: 'explainer.about.maker.body' }
		]
	},
	faq: {
		title: 'explainer.faq.title',
		intro: 'explainer.faq.intro',
		blocks: ['account', 'choose', 'next', 'scores', 'free', 'sound', 'data'].map((key) => ({
			kind: 'faq' as const,
			question: `explainer.faq.${key}.question` as MessageKey,
			answer: `explainer.faq.${key}.answer` as MessageKey
		}))
	}
} satisfies Record<string, { title: MessageKey; intro: MessageKey; blocks: ContentBlock[] }>;

export type ExplainerId = keyof typeof explainers;
