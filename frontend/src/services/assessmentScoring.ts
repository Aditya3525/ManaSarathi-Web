import { AssessmentTemplateScoring } from './api';

const roundTo = (value: number, precision = 1) => {
	const factor = Math.pow(10, precision);
	return Math.round(value * factor) / factor;
};

const ensureNumber = (value: string | number | undefined): number => {
	if (value === undefined) return NaN;
	if (typeof value === 'number') return value;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? NaN : parsed;
};

const pickInterpretation = (
	rawScore: number,
	bands: Array<{ max: number; label: string }> | undefined,
	fallback: string
): string => {
	if (!bands || !bands.length) return fallback;
	for (const band of bands) {
		if (rawScore <= band.max) {
			return band.label;
		}
	}
	return bands[bands.length - 1]?.label ?? fallback;
};

const normalizeScore = (raw: number, min: number, max: number): number => {
	if (max === min) return 0;
	const bounded = Math.min(Math.max(raw, min), max);
	return ((bounded - min) / (max - min)) * 100;
};

export interface ScoringOption {
	value: string;
	score: number;
}

export interface ScoringQuestion {
	id: string;
	options: ScoringOption[];
	reverseScored?: boolean;
	domain?: string | null;
}

export interface ScoreAdvancedInput {
	assessmentType: string;
	answers: Record<string, string>;
	questions: ScoringQuestion[];
	scoring: AssessmentTemplateScoring;
}

export interface ScoreAdvancedResult {
	rawScore: number;
	minScore: number;
	maxScore: number;
	normalizedScore: number;
	normalizedScoreRounded: number;
	interpretation: string;
	categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation: string }>;
}

const computeQuestionStats = (question: ScoringQuestion) => {
	const scores = question.options.map((option) => option.score);
	const min = Math.min(...scores);
	const max = Math.max(...scores);
	return { min, max };
};

const resolveOptionScore = (question: ScoringQuestion, answer: string): number => {
	const matched = question.options.find((option) => option.value === answer);
	if (matched) return matched.score;
	const parsed = ensureNumber(answer);
	if (!Number.isNaN(parsed)) return parsed;
	return question.options[0]?.score ?? 0;
};

export const scoreAdvancedAssessment = ({
	assessmentType,
	answers,
	questions,
	scoring
}: ScoreAdvancedInput): ScoreAdvancedResult => {
	const reverseSet = new Set(scoring.reverseScored ?? []);
	const valueMap = new Map<string, number>();

	let rawScore = 0;
	let computedMinTotal = 0;
	let computedMaxTotal = 0;

	questions.forEach((question) => {
		const { min, max } = computeQuestionStats(question);
		const answerValue = answers[question.id];
		const rawValue = resolveOptionScore(question, answerValue);
		const boundedValue = Math.min(Math.max(rawValue, min), max);
		const isReverse = reverseSet.has(question.id) || question.reverseScored;
		const adjusted = isReverse ? min + max - boundedValue : boundedValue;

		valueMap.set(question.id, adjusted);
		rawScore += adjusted;
		computedMinTotal += min;
		computedMaxTotal += max;
	});

	const minScore = scoring.minScore ?? computedMinTotal;
	const maxScore = scoring.maxScore ?? computedMaxTotal;

	const normalizedScore = normalizeScore(rawScore, minScore, maxScore);
	const normalizedScoreRounded = roundTo(normalizedScore);

	const interpretation = pickInterpretation(
		rawScore,
		scoring.interpretationBands,
		`${assessmentType} score`
	);

	let categoryBreakdown: ScoreAdvancedResult['categoryBreakdown'];

	if (scoring.domains && scoring.domains.length > 0) {
		categoryBreakdown = scoring.domains.reduce<Record<string, { raw: number; normalized: number; interpretation: string }>>(
			(acc, domain) => {
				const items = (domain.items && domain.items.length > 0)
					? domain.items
					: questions
							.filter((q) => q.domain === domain.id || q.domain === domain.label)
							.map((q) => q.id);

				const domainRaw = items.reduce((sum, itemId) => sum + (valueMap.get(itemId) ?? 0), 0);
				const domainMin = domain.minScore ?? 0;
				const domainMax = domain.maxScore ?? 0;
				const domainNormalized = normalizeScore(domainRaw, domainMin, domainMax);
				const domainInterpretation = pickInterpretation(
					domainRaw,
					domain.interpretationBands,
					`${domain.label} intensity`
				);

				acc[domain.label] = {
					raw: roundTo(domainRaw, 2),
					normalized: roundTo(domainNormalized),
					interpretation: domainInterpretation
				};
				return acc;
			},
			{}
		);
	}

	return {
		rawScore: roundTo(rawScore, 2),
		minScore,
		maxScore,
		normalizedScore,
		normalizedScoreRounded,
		interpretation,
		categoryBreakdown
	};
};
