import { PrismaClient } from '@prisma/client';
import type { UserContext } from '../types/ai';

type ApproachMode = 'western' | 'eastern' | 'hybrid';

type RecommendationSource = 'library' | 'practice' | 'insight' | 'fallback';

type SentimentSnapshot = {
	label: 'positive' | 'neutral' | 'negative';
	score: number;
	dominantEmotion: string | null;
	keywords: string[];
	summary: string;
};

type RecommendationOptions = {
	userId: string;
	userContext: UserContext;
	approach: ApproachMode;
	sentiment?: SentimentSnapshot | null;
	wellnessScore?: number;
	maxItems?: number;
};

export type RecommendationItem = {
	id?: string;
	title: string;
	description?: string | null;
	type: 'content' | 'practice' | 'suggestion';
	approach?: string | null;
	duration?: string | number | null;
	tags?: string[];
	url?: string | null;
	reason: string;
	source: RecommendationSource;
	metadata?: Record<string, unknown>;
};

export type RecommendationResult = {
	items: RecommendationItem[];
	focusAreas: string[];
	rationale: string;
	fallbackUsed: boolean;
	fallbackMessage?: string;
};

const prisma = new PrismaClient();

const KEYWORD_FOCUS_MAP: Record<string, string> = {
	anxious: 'anxiety',
	anxiety: 'anxiety',
	worry: 'anxiety',
	overwhelmed: 'stress',
	stressed: 'stress',
	stress: 'stress',
	burnout: 'burnout',
	sleep: 'sleep',
	tired: 'fatigue',
	exhausted: 'fatigue',
	fatigue: 'fatigue',
	focus: 'focus',
	restless: 'anxiety',
	calm: 'relaxation',
	sad: 'mood',
	sadness: 'mood',
	depressed: 'mood',
	anger: 'anger',
	irritable: 'anger'
};

function toLower(value?: string | null): string | undefined {
	return value ? value.toLowerCase() : undefined;
}

function unique<T>(values: Iterable<T>): T[] {
	return Array.from(new Set(values));
}

function deriveFocusAreas(userContext: UserContext, sentiment?: SentimentSnapshot | null): string[] {
	const focusAreas = new Set<string>();

	// Assessment-driven focus
	const insightEntries = Object.entries(userContext.assessmentInsights?.byType ?? {});
	insightEntries.forEach(([type, summary]) => {
		const normalizedType = type.toLowerCase();
		if (summary.trend === 'declining' || (summary.latestScore ?? 0) >= 60) {
			focusAreas.add(normalizedType);
		}
		if ((summary.normalizedScore ?? summary.latestScore ?? 0) <= 40) {
			focusAreas.add(`${normalizedType}-support`);
		}
	});

	// Sentiment-driven focus
	if (sentiment?.dominantEmotion) {
		focusAreas.add(sentiment.dominantEmotion.toLowerCase());
	}
	sentiment?.keywords.forEach((keyword) => {
		const mapped = KEYWORD_FOCUS_MAP[keyword.toLowerCase()];
		if (mapped) {
			focusAreas.add(mapped);
		}
	});

	// Mood trends
	if (userContext.currentMood) {
		focusAreas.add(userContext.currentMood.toLowerCase());
	}
	if (userContext.moodTrend) {
		focusAreas.add(userContext.moodTrend.toLowerCase());
	}

	// Wellness score
	if ((userContext.wellnessScore ?? 100) < 60 || (userContext.wellbeingTrend ?? '').includes('declin')) {
		focusAreas.add('overall wellbeing');
	}

	return Array.from(focusAreas)
		.map((area) => area.trim().toLowerCase())
		.filter(Boolean);
}

function formatReason(
	item: Pick<RecommendationItem, 'type' | 'title'>,
	focusAreas: string[],
	context?: { category?: string | null; dominantEmotion?: string | null }
): string {
	const primaryFocus = focusAreas[0];
	const readableFocus = primaryFocus
		? primaryFocus.replace(/[-_]/g, ' ')
		: 'your current wellbeing goals';

	if (item.type === 'practice') {
		return `Guided practice selected to support ${readableFocus}.`;
	}

	if (item.type === 'content') {
		if (context?.category) {
			return `Curated ${context.category.toLowerCase()} resource that reinforces ${readableFocus}.`;
		}
		return `Helpful reading to build insight around ${readableFocus}.`;
	}

	if (context?.dominantEmotion) {
		return `Grounding micro-step to meet feelings of ${context.dominantEmotion}.`;
	}

	return `Supportive next step aligned with ${readableFocus}.`;
}

function matchesFocus(text: string | null | undefined, focusAreas: string[]): boolean {
	if (!text) return false;
	const lower = text.toLowerCase();
	return focusAreas.some((area) => lower.includes(area));
}

async function fetchContentSuggestions(
	focusAreas: string[],
	approach: ApproachMode
): Promise<RecommendationItem[]> {
	const records = await prisma.content.findMany({
		where: { isPublished: true },
		orderBy: { createdAt: 'desc' },
		take: 40
	});

	const preferredApproach = approach.toLowerCase();

	return records
		.filter((content) => {
			const contentApproach = toLower(content.approach);
			const approachMatches = !contentApproach || [preferredApproach, 'hybrid', 'all'].includes(contentApproach);
			if (!approachMatches) return false;

			if (focusAreas.length === 0) return true;

			const tagValues = content.tags
				? content.tags.split(',').map((tag) => tag.trim().toLowerCase())
				: [];

			return (
				matchesFocus(content.category, focusAreas) ||
				matchesFocus(content.title, focusAreas) ||
				matchesFocus(content.description, focusAreas) ||
				tagValues.some((tag) => focusAreas.includes(tag))
			);
		})
		.map<RecommendationItem>((content) => ({
			id: content.id,
			title: content.title,
			description: content.description,
			type: 'content',
			approach: content.approach,
			duration: content.duration,
			tags: content.tags ? content.tags.split(',').map((tag) => tag.trim()) : undefined,
			url: content.content,
			reason: formatReason(
				{ type: 'content', title: content.title },
				focusAreas,
				{ category: content.category }
			),
			source: 'library',
			metadata: {
				category: content.category,
				difficulty: content.difficulty
			}
		}));
}

async function fetchPracticeSuggestions(
	focusAreas: string[],
	approach: ApproachMode
): Promise<RecommendationItem[]> {
	const practices = await prisma.practice.findMany({
		where: { isPublished: true },
		orderBy: { createdAt: 'desc' },
		take: 40
	});

	const preferredApproach = approach.toLowerCase();

	return practices
		.filter((practice) => {
			const practiceApproach = toLower(practice.approach);
			const approachMatches = !practiceApproach || [preferredApproach, 'hybrid', 'all'].includes(practiceApproach);
			if (!approachMatches) return false;

			if (focusAreas.length === 0) return true;

			const tagValues = practice.tags
				? practice.tags.split(',').map((tag) => tag.trim().toLowerCase())
				: [];

			return (
				matchesFocus(practice.type, focusAreas) ||
				matchesFocus(practice.description, focusAreas) ||
				tagValues.some((tag) => focusAreas.includes(tag))
			);
		})
		.map<RecommendationItem>((practice) => ({
			id: practice.id,
			title: practice.title,
			description: practice.description,
			type: 'practice',
			approach: practice.approach,
			duration: practice.duration,
			tags: practice.tags ? practice.tags.split(',').map((tag) => tag.trim()) : undefined,
			url: practice.audioUrl || practice.videoUrl || practice.youtubeUrl,
			reason: formatReason({ type: 'practice', title: practice.title }, focusAreas),
			source: 'practice',
			metadata: {
				format: practice.format,
				difficulty: practice.difficulty
			}
		}));
}

function buildFallbackRecommendations(focusAreas: string[], sentiment?: SentimentSnapshot | null): RecommendationItem[] {
	if (focusAreas.length === 0 && !sentiment) {
		return [
			{
				title: 'Take a mindful minute',
				type: 'suggestion',
				reason: 'Grounding practice to reconnect with your breath before continuing the conversation.',
				source: 'fallback'
			}
		];
	}

	const primary = focusAreas[0] ?? sentiment?.dominantEmotion ?? 'wellbeing';
	const readable = primary.replace(/[-_]/g, ' ');

	const suggestions: RecommendationItem[] = [];

	if (primary.includes('anxiety') || primary.includes('worry')) {
		suggestions.push({
			title: 'Box breathing for calm',
			type: 'suggestion',
			reason: 'A quick 4-4-4-4 breathing pattern to regulate anxious energy.',
			source: 'fallback'
		});
	}

	if (primary.includes('stress') || primary.includes('overwhelm')) {
		suggestions.push({
			title: 'Micro-break reset',
			type: 'suggestion',
			reason: 'Step away for two minutes, stretch, and name one thing you need right now.',
			source: 'fallback'
		});
	}

	if (primary.includes('sleep')) {
		suggestions.push({
			title: 'Wind-down ritual',
			type: 'suggestion',
			reason: 'Dim lights, do gentle stretches, and journal one worry to revisit tomorrow.',
			source: 'fallback'
		});
	}

	if (suggestions.length === 0) {
		suggestions.push({
			title: `Compassion pause for ${readable}`,
			type: 'suggestion',
			reason: `Place a hand over your heart, take three slow breaths, and offer yourself a kind phrase.`,
			source: 'fallback'
		});
	}

	return suggestions;
}

function prioritiseRecommendations(items: RecommendationItem[], maxItems: number): RecommendationItem[] {
	const seen = new Set<string>();
	const pruned: RecommendationItem[] = [];

	for (const item of items) {
		const key = `${item.id ?? ''}-${item.title.toLowerCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		pruned.push(item);
		if (pruned.length >= maxItems) break;
	}

	return pruned;
}

function buildRationale(focusAreas: string[], count: number): string {
	if (focusAreas.length === 0) {
		return `Selected ${count} balanced resources to support general wellbeing and emotional regulation.`;
	}

	const readableAreas = focusAreas
		.slice(0, 3)
		.map((area) => area.replace(/[-_]/g, ' '))
		.join(', ');

	return `Prioritised ${count} items tuned for ${readableAreas}, blending quick wins with deeper guidance.`;
}

export const recommendationService = {
	async getContentRecommendations(options: RecommendationOptions): Promise<RecommendationResult> {
		const { userContext, approach, sentiment, wellnessScore, maxItems = 4 } = options;

		const focusAreas = deriveFocusAreas(userContext, sentiment);

		const [contentItems, practiceItems] = await Promise.all([
			fetchContentSuggestions(focusAreas, approach),
			fetchPracticeSuggestions(focusAreas, approach)
		]);

		let combined = [...contentItems, ...practiceItems];

		if (combined.length < maxItems) {
			combined = combined.concat(buildFallbackRecommendations(focusAreas, sentiment));
		}

		const prioritised = prioritiseRecommendations(combined, maxItems);

		const fallbackUsed = prioritised.some((item) => item.source === 'fallback');
		const rationale = buildRationale(focusAreas, prioritised.length);

		if ((wellnessScore ?? userContext.wellnessScore ?? 100) < 60 && !focusAreas.includes('overall wellbeing')) {
			focusAreas.push('overall wellbeing');
		}

		return {
			items: prioritised,
			focusAreas: unique(focusAreas),
			rationale,
			fallbackUsed,
			fallbackMessage: fallbackUsed
				? 'We shared a few grounding micro-practices while personalised recommendations are refreshed.'
				: undefined
		};
	},

	async getPracticeRecommendations(options: RecommendationOptions): Promise<RecommendationResult> {
		const { userContext, approach, sentiment, wellnessScore, maxItems = 3 } = options;

		const focusAreas = deriveFocusAreas(userContext, sentiment);

		const matchingPractices = await fetchPracticeSuggestions(focusAreas, approach);

		let prioritised = [...matchingPractices];

		if (prioritised.length < maxItems) {
			const allPractices = await prisma.practice.findMany({
				where: { isPublished: true },
				orderBy: { createdAt: 'desc' },
				take: 50
			});

			const fallbackPractices = allPractices.map<RecommendationItem>((practice) => ({
				id: practice.id,
				title: practice.title,
				description: practice.description,
				type: 'practice',
				approach: practice.approach,
				duration: practice.duration,
				tags: practice.tags ? practice.tags.split(',').map((tag) => tag.trim()) : undefined,
				url: practice.audioUrl || practice.videoUrl || practice.youtubeUrl,
				reason: `A general mindfulness practice to support your mental wellbeing.`,
				source: 'practice',
				metadata: {
					format: practice.format,
					difficulty: practice.difficulty
				}
			}));

			for (const fp of fallbackPractices) {
				if (prioritised.length >= maxItems) break;
				if (!prioritised.some((p) => p.id === fp.id)) {
					prioritised.push(fp);
				}
			}
		}

		prioritised = prioritised.slice(0, maxItems);

		if ((wellnessScore ?? userContext.wellnessScore ?? 100) < 60 && !focusAreas.includes('overall wellbeing')) {
			focusAreas.push('overall wellbeing');
		}

		return {
			items: prioritised,
			focusAreas: unique(focusAreas),
			rationale: `Selected ${prioritised.length} practice suggestions based on your profile and mood.`,
			fallbackUsed: prioritised.length > matchingPractices.length
		};
	}
};

export const recommendationServiceInstance = recommendationService;

export default recommendationService;
