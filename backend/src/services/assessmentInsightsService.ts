import { AssessmentResult, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { llmService } from './llmProvider';

type Trend = 'improving' | 'declining' | 'stable' | 'baseline';

export type AssessmentTypeSummary = {
  latestScore: number;
  previousScore: number | null;
  change: number | null;
  averageScore: number;
  bestScore: number;
  trend: Trend;
  interpretation: string;
  recommendations: string[];
  lastCompletedAt: string;
  historyCount: number;
  normalizedScore?: number;
  rawScore?: number;
  maxScore?: number;
  categoryBreakdown?: Record<string, {
    raw: number;
    normalized: number;
    interpretation: string;
  }>;
};

export type EnrichedAssessment = {
  id: string;
  assessmentType: string;
  score: number;
  interpretation: string;
  changeFromPrevious: number | null;
  trend: Trend;
  completedAt: string;
  responses: Record<string, unknown> | null;
  rawScore?: number | null;
  maxScore?: number | null;
  categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation: string }>;
};

export type AssessmentInsightsPayload = {
  history: EnrichedAssessment[];
  insights: {
    byType: Record<string, AssessmentTypeSummary>;
    aiSummary: string;
    overallTrend: Trend | 'mixed';
    wellnessScore?: {
      value: number;
      method: 'advanced-average';
      updatedAt: string;
    };
    updatedAt: string;
  };
};

export type AssessmentDetailContext = {
  assessmentType: string;
  completedAt?: string;
  responses: Array<{
    questionId: string;
    questionText: string;
    answerLabel: string;
    answerValue?: string | number | boolean | null;
    answerScore?: number;
  }>;
  rawScore?: number | null;
  maxScore?: number | null;
  score?: number;
};

const MAX_DETAIL_ASSESSMENTS = Number(process.env.AI_MAX_DETAIL_ASSESSMENTS ?? 3);
const MAX_RESPONSES_PER_ASSESSMENT = Number(process.env.AI_MAX_DETAIL_RESPONSES ?? 4);
const MAX_DETAIL_TEXT_LENGTH = Number(process.env.AI_MAX_DETAIL_LENGTH ?? 140);

const HIGHER_IS_BETTER = new Set([
  'emotionalintelligence',
  'emotionalintelligenceteique',
  'emotionalintelligenceei10',
  'emotionalintelligenceeq5'
]);

const NON_DIRECTIONAL_WELLNESS_TYPES = new Set([
  'personality',
  'personalityminiipip',
  'personalitybigfive10',
  'archetypes',
  'psychologicalarchetypes'
]);

const normalizeType = (type: string): string => type.toLowerCase().replace(/[^a-z0-9]/g, '');

const BASIC_OVERALL_ASSESSMENT_TYPES = new Set([
  'anxiety_gad2',
  'depression_phq2',
  'stress_pss4',
  'overthinking_rrs4',
  'trauma_pcptsd5',
  'emotional_intelligence_eq5',
  'personality_bigfive10'
].map(normalizeType));

const ADVANCED_ASSESSMENT_TYPES = new Set([
  'anxiety_assessment',
  'anxiety',
  'depression_phq9',
  'depression',
  'phq9',
  'stress_pss10',
  'stress',
  'emotional_intelligence_teique',
  'emotional_intelligence',
  'emotional_intelligence_ei10',
  'overthinking_ptq',
  'overthinking',
  'overthinking_brooding',
  'trauma_pcl5',
  'trauma',
  'trauma-fear',
  'traumafear',
  'personality_mini_ipip',
  'personality',
  'archetypes',
  'psychological_archetypes',
  'psychologicalarchetypes'
].map(normalizeType));

const isBasicOverallAssessmentType = (type: string): boolean => BASIC_OVERALL_ASSESSMENT_TYPES.has(normalizeType(type));

const isAdvancedAssessmentType = (type: string): boolean => {
  const normalized = normalizeType(type);
  if (!normalized || isBasicOverallAssessmentType(type)) {
    return false;
  }
  return ADVANCED_ASSESSMENT_TYPES.has(normalized);
};

function friendlyLabel(type: string): string {
  switch (type) {
    case 'anxiety':
    case 'anxiety_assessment':
    case 'anxiety_gad2':
      return 'Anxiety';
    case 'stress':
    case 'stress_pss10':
    case 'stress_pss4':
      return 'Stress';
    case 'emotionalIntelligence':
    case 'emotional_intelligence_teique':
    case 'emotional_intelligence_eq5':
      return 'Emotional Intelligence';
    case 'overthinking':
    case 'overthinking_ptq':
    case 'overthinking_rrs4':
      return 'Overthinking';
    case 'depression':
    case 'depression_phq9':
    case 'depression_phq2':
      return 'Depression';
    case 'trauma':
    case 'trauma_pcl5':
    case 'trauma_pcptsd5':
      return 'Trauma & Fear';
    case 'personality':
    case 'personality_mini_ipip':
    case 'personality_bigfive10':
      return 'Personality';
    default:
      return type
        .split(/(?=[A-Z])/)
        .join(' ')
        .replace(/^[a-z]/, (m) => m.toUpperCase());
  }
}

function isHigherScoreBetter(type: string): boolean {
  return HIGHER_IS_BETTER.has(normalizeType(type));
}

function isNonDirectionalWellnessType(type: string): boolean {
  return NON_DIRECTIONAL_WELLNESS_TYPES.has(normalizeType(type));
}

export function interpretAssessmentScore(assessmentType: string, score: number): string {
  const normalizedType = assessmentType.toLowerCase().trim();
  const sanitizedType = normalizedType.replace(/[^a-z0-9]/g, '');

  const matchesType = (...aliases: string[]): boolean =>
    aliases.some((alias) =>
      alias === sanitizedType ||
      alias === normalizedType ||
      sanitizedType.includes(alias.replace(/[^a-z0-9]/g, ''))
    );

  const resolveBand = (bands: Array<{ max: number; label: string }>): string => {
    for (const band of bands) {
      if (score <= band.max) {
        return band.label;
      }
    }
    return bands[bands.length - 1]?.label ?? 'Needs interpretation';
  };

  if (matchesType('depressionphq2', 'phq2')) {
    const rawEquivalent = (score / 100) * 6;
    if (rawEquivalent <= 2) return 'Minimal depression symptoms';
    if (rawEquivalent <= 4) return 'Mild depression symptoms';
    return 'Elevated depression symptoms';
  }

  if (matchesType('anxietygad2', 'gad2')) {
    const rawEquivalent = (score / 100) * 6;
    if (rawEquivalent <= 2) return 'Minimal anxiety';
    if (rawEquivalent <= 4) return 'Mild anxiety symptoms';
    return 'Elevated anxiety symptoms';
  }

  if (matchesType('stresspss4', 'pss4')) {
    const rawEquivalent = (score / 100) * 16;
    if (rawEquivalent <= 5) return 'Low perceived stress';
    if (rawEquivalent <= 10) return 'Moderate perceived stress';
    return 'High perceived stress';
  }

  if (matchesType('overthinkingrrs4', 'rrs4')) {
    const rawEquivalent = (score / 100) * 12;
    if (rawEquivalent <= 3) return 'Low overthinking';
    if (rawEquivalent <= 8) return 'Moderate overthinking';
    return 'High overthinking';
  }

  if (matchesType('traumapcptsd5', 'pcptsd5', 'pcptsd')) {
    const rawEquivalent = (score / 100) * 5;
    if (rawEquivalent <= 2) return 'Low trauma symptom activation';
    return 'Further trauma assessment recommended';
  }

  if (matchesType('emotionalintelligenceeq5', 'eq5')) {
    const rawEquivalent = (score / 100) * 20;
    if (rawEquivalent <= 7) return 'Developing emotional intelligence';
    if (rawEquivalent <= 14) return 'Growing emotional intelligence';
    return 'Strong emotional intelligence';
  }

  if (matchesType('personalitybigfive10', 'bigfive10')) {
    const rawEquivalent = (score / 100) * 40;
    if (rawEquivalent <= 16) return 'Subtle trait expression';
    if (rawEquivalent <= 28) return 'Balanced trait expression';
    return 'Strong trait expression';
  }

  if (matchesType('phq9', 'phq', 'depression')) {
    if (score <= 20) return 'Minimal depression';
    if (score <= 40) return 'Mild depression';
    if (score <= 60) return 'Moderate depression';
    if (score <= 80) return 'Moderately severe depression';
    return 'Severe depression';
  }

  if (matchesType('anxietyassessment', 'anxiety')) {
    // GAD-7 scoring: raw score 0-21
    // Use raw score if available, otherwise approximate from normalized
    const rawEquivalent = (score / 100) * 21;
    if (rawEquivalent <= 4) return 'Minimal anxiety';
    if (rawEquivalent <= 9) return 'Mild anxiety';
    if (rawEquivalent <= 14) return 'Moderate anxiety';
    return 'Severe anxiety';
  }

  if (matchesType('gad7', 'gad')) {
    return resolveBand([
      { max: 39, label: 'Calm and manageable anxiety' },
      { max: 69, label: 'Noticeable anxiety patterns' },
      { max: 100, label: 'Intense anxiety needing support' }
    ]);
  }

  if (matchesType('stress')) {
    return resolveBand([
      { max: 39, label: 'Balanced stress load' },
      { max: 69, label: 'Elevated stress responses' },
      { max: 100, label: 'High stress—prioritize recovery' }
    ]);
  }

  if (matchesType('emotionalintelligence', 'emotional-awareness')) {
    return resolveBand([
      { max: 39, label: 'Developing emotional awareness' },
      { max: 69, label: 'Growing emotional intelligence' },
      { max: 100, label: 'Strong emotional intelligence' }
    ]);
  }

  if (matchesType('overthinking')) {
    return resolveBand([
      { max: 39, label: 'Clear and grounded thinking' },
      { max: 69, label: 'Occasional rumination' },
      { max: 100, label: 'Persistent overthinking loops' }
    ]);
  }

  if (matchesType('traumafear', 'trauma', 'fearresponse')) {
    return resolveBand([
      { max: 39, label: 'Grounded and feeling safe' },
      { max: 69, label: 'Sensitive to triggers—use gentle care' },
      { max: 100, label: 'High trauma activation—seek support' }
    ]);
  }

  if (matchesType('personalityminiipip', 'personality', 'archetypes')) {
    return resolveBand([
      { max: 39, label: 'Reserved personality expression' },
      { max: 69, label: 'Balanced Big Five trait blend' },
      { max: 100, label: 'Pronounced personality trait expression' }
    ]);
  }

  return resolveBand([
    { max: 25, label: 'Low intensity' },
    { max: 50, label: 'Moderate intensity' },
    { max: 75, label: 'Significant intensity' }
  ]);
}

function determineTrend(type: string, change: number | null): Trend {
  if (change === null) return 'baseline';

  // Personality/archetype assessments are descriptive profiles, not directional risk metrics.
  if (isNonDirectionalWellnessType(type)) return 'stable';

  const improvementThreshold = 5;
  const betterIfHigher = isHigherScoreBetter(type);

  if (Math.abs(change) < improvementThreshold) return 'stable';

  const isImproving = betterIfHigher ? change > 0 : change < 0;
  return isImproving ? 'improving' : 'declining';
}

function calculateRecommendations(type: string, summary: AssessmentTypeSummary): string[] {
  const recs: string[] = [];
  const trend = summary.trend;
  const interpretation = summary.interpretation.toLowerCase();
  const label = friendlyLabel(type);

  if (trend === 'improving') {
    recs.push(`Great job improving your ${label.toLowerCase()} score—keep reinforcing the routines that helped.`);
  }

  if (trend === 'declining') {
    recs.push(`Recent ${label.toLowerCase()} patterns show some setbacks. Consider revisiting coping strategies or reaching out for support.`);
  }

  if ((type === 'anxiety' || type === 'anxiety_assessment') && summary.latestScore >= 60) {
    recs.push('Try a guided breathing or mindfulness practice to regulate your nervous system.');
    recs.push('Consider incorporating daily relaxation exercises like progressive muscle relaxation.');
  }

  if ((type === 'anxiety' || type === 'anxiety_assessment') && summary.latestScore >= 40 && summary.latestScore < 60) {
    recs.push('Practice grounding techniques when feeling anxious or restless.');
  }

  // GAD-7 specific recommendations based on interpretation
  if (type === 'anxiety' || type === 'anxiety_assessment') {
    const interpretation = summary.interpretation.toLowerCase();
    if (interpretation.includes('severe')) {
      recs.push('Your anxiety levels are high. Consider reaching out to a professional for support.');
    } else if (interpretation.includes('moderate')) {
      recs.push('Set aside a daily 5-minute thought download to ease worry loops.');
    }
  }

  if (type === 'stress' && summary.latestScore >= 60) {
    recs.push('Break larger tasks into smaller steps and schedule decompression windows during the day.');
  }

  if (type === 'overthinking' && summary.latestScore >= 60) {
    recs.push('Use cognitive reframing: write worries down, challenge them, and focus on what you can control.');
  }

  if (type === 'emotionalIntelligence' && summary.latestScore < 50) {
    recs.push('Practice naming emotions throughout the day and reflect on what triggered them.');
  }

  if (type.includes('personality')) {
    recs.push('Notice which traits feel most energizing and design weekly activities that let them shine.');
  }

  if (recs.length === 0) {
    recs.push(`Continue tracking your ${label.toLowerCase()} to build long-term awareness.`);
  }

  return Array.from(new Set(recs));
}

function ensurePlainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeParseJSON(raw: Prisma.JsonValue | string | null): Record<string, unknown> | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return ensurePlainObject(parsed);
    } catch (error) {
      return null;
    }
  }

  return ensurePlainObject(raw);
}

function safeParseResponses(raw: Prisma.JsonValue | string | null): Record<string, unknown> | null {
  return safeParseJSON(raw);
}

function safeParseCategoryBreakdown(raw: Prisma.JsonValue | string | null): Record<string, { raw: number; normalized: number; interpretation: string }> | null {
  const parsed = safeParseJSON(raw);
  if (!parsed) return null;

  const entries = Object.entries(parsed).map(([key, value]) => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Record<string, unknown>;
    const rawScore = typeof candidate.raw === 'number' ? candidate.raw : Number(candidate.raw ?? NaN);
    const normalized = typeof candidate.normalized === 'number' ? candidate.normalized : Number(candidate.normalized ?? NaN);
    const interpretation = typeof candidate.interpretation === 'string' ? candidate.interpretation : '';

    if (Number.isNaN(rawScore) || Number.isNaN(normalized)) {
      return null;
    }

    return [key, { raw: rawScore, normalized, interpretation }];
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as Array<[string, { raw: number; normalized: number; interpretation: string }]>);
}

function computeHistoryAndSummaries(assessments: AssessmentResult[]): {
  history: EnrichedAssessment[];
  summaries: Record<string, AssessmentTypeSummary>;
} {
  const history: EnrichedAssessment[] = [];
  const summaries: Record<string, AssessmentTypeSummary> = {};
  const grouped = new Map<string, AssessmentResult[]>();

  const sortedAssessments = [...assessments].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  const dedupedAssessments: AssessmentResult[] = [];
  const seenKeys = new Set<string>();

  sortedAssessments.forEach((record) => {
    const completedKey = Math.floor(record.completedAt.getTime() / 1000);
    const normalizedScore = typeof record.score === 'number' ? record.score : Number(record.score ?? 0);
    const rawScore = typeof (record as any).rawScore === 'number' ? (record as any).rawScore : null;
    const key = `${record.assessmentType}|${completedKey}|${normalizedScore}|${rawScore ?? 'null'}`;

    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    dedupedAssessments.push(record);
  });

  dedupedAssessments.forEach((record) => {
    const existing = grouped.get(record.assessmentType) || [];
    existing.push(record);
    grouped.set(record.assessmentType, existing);
  });

  grouped.forEach((records, type) => {
    const betterIfHigher = isHigherScoreBetter(type);
    let total = 0;
    let best = betterIfHigher ? -Infinity : Infinity;

    records.forEach((record, index) => {
      const previous = records[index + 1] ?? null;
      const change = previous ? record.score - previous.score : null;
      const trend = determineTrend(type, change);
      const interpretation = interpretAssessmentScore(type, record.score);
      const rawScore = typeof (record as any).rawScore === 'number' ? (record as any).rawScore : null;
      const maxScore = typeof (record as any).maxScore === 'number' ? (record as any).maxScore : null;
      const storedNormalized = typeof (record as any).normalizedScore === 'number' ? (record as any).normalizedScore : null;
      const categoryBreakdown = safeParseCategoryBreakdown((record as any).categoryScores ?? null);

      total += record.score;
      if (betterIfHigher) {
        best = Math.max(best, record.score);
      } else {
        best = Math.min(best, record.score);
      }

      history.push({
        id: record.id,
        assessmentType: type,
        score: record.score,
        interpretation,
        changeFromPrevious: change,
        trend,
        completedAt: record.completedAt.toISOString(),
        responses: safeParseResponses(record.responses),
        rawScore,
        maxScore,
        categoryBreakdown: categoryBreakdown ?? undefined
      });
    });

    const latest = records[0];
    const previous = records[1] ?? null;
    const avg = total / records.length;
    const change = previous ? latest.score - previous.score : null;
    const trend = determineTrend(type, change);
    const interpretation = interpretAssessmentScore(type, latest.score);
    const bestScore = betterIfHigher ? best : best === Infinity ? latest.score : best;

    const latestRawScore = typeof (latest as any).rawScore === 'number' ? (latest as any).rawScore : null;
    const latestMaxScore = typeof (latest as any).maxScore === 'number' ? (latest as any).maxScore : null;
    const latestStoredNormalized = typeof (latest as any).normalizedScore === 'number'
      ? (latest as any).normalizedScore
      : null;
    const latestCategoryBreakdown = safeParseCategoryBreakdown((latest as any).categoryScores ?? null);

    const scoreBasis = typeof latestStoredNormalized === 'number' ? latestStoredNormalized : latest.score;

    const normalizedScore = betterIfHigher
      ? Math.max(0, Math.min(100, scoreBasis))
      : isNonDirectionalWellnessType(type)
        ? Math.max(0, Math.min(100, scoreBasis))
        : Math.max(0, Math.min(100, 100 - scoreBasis));

    summaries[type] = {
      latestScore: latest.score,
      previousScore: previous ? previous.score : null,
      change,
      averageScore: Math.round(avg * 10) / 10,
      bestScore,
      trend,
      interpretation,
      recommendations: calculateRecommendations(type, {
        latestScore: latest.score,
        previousScore: previous ? previous.score : null,
        change,
        averageScore: Math.round(avg * 10) / 10,
        bestScore,
        trend,
        interpretation,
        recommendations: [],
        lastCompletedAt: latest.completedAt.toISOString(),
        historyCount: records.length,
        normalizedScore,
        rawScore: latestRawScore ?? undefined,
        maxScore: latestMaxScore ?? undefined,
        categoryBreakdown: latestCategoryBreakdown ?? undefined
      }),
      lastCompletedAt: latest.completedAt.toISOString(),
      historyCount: records.length,
      normalizedScore,
      rawScore: latestRawScore ?? undefined,
      maxScore: latestMaxScore ?? undefined,
      categoryBreakdown: latestCategoryBreakdown ?? undefined
    };
  });

  history.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  return { history, summaries };
}

function calculateWellnessScore(
  summaries: Record<string, AssessmentTypeSummary>,
  basicTypes: Set<string>,
  advancedTypes: Set<string>
): { value: number; updatedAt: string | null } | null {
  let total = 0;
  let count = 0;
  let latestCompletedAt: string | null = null;

  Object.entries(summaries).forEach(([type, summary]) => {
    const normalizedType = normalizeType(type);

    // Exclude basic overall assessment ('basic_overall') and basic component types
    if (normalizedType === 'basicoverall' || normalizedType === 'basic_overall') {
      return;
    }

    const isBasic = basicTypes.has(normalizedType);
    const isAdvanced = advancedTypes.has(normalizedType) && !isBasic;

    // Only consider advanced/required assessments for the combined Wellness score
    if (!isAdvanced) {
      return;
    }

    // Personality/archetype profiles are not risk scales and should not skew overall wellness.
    if (isNonDirectionalWellnessType(type)) {
      return;
    }

    const value = summary.normalizedScore ?? summary.latestScore;
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return;
    }

    total += value;
    count += 1;

    if (summary.lastCompletedAt) {
      if (!latestCompletedAt || new Date(summary.lastCompletedAt).getTime() > new Date(latestCompletedAt).getTime()) {
        latestCompletedAt = summary.lastCompletedAt;
      }
    }
  });

  if (count === 0) {
    return null;
  }

  const averaged = Math.round((total / count) * 10) / 10;
  return {
    value: averaged,
    updatedAt: latestCompletedAt
  };
}

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength - 1).trim()}…`;
};

const buildResponseHighlights = (
  detailedAssessments: AssessmentDetailContext[],
  summaries: Record<string, AssessmentTypeSummary>
): string => {
  if (!detailedAssessments.length) {
    return '';
  }

  const limitedAssessments = detailedAssessments.slice(0, Math.max(1, MAX_DETAIL_ASSESSMENTS));

  const highlightBlocks = limitedAssessments.map((detail) => {
    const summary = summaries[detail.assessmentType];
    const label = friendlyLabel(detail.assessmentType);
    const responses = detail.responses.slice(0, Math.max(1, MAX_RESPONSES_PER_ASSESSMENT));

    const responseLines = responses
      .map((response) => `- ${truncate(response.questionText, MAX_DETAIL_TEXT_LENGTH)} → ${truncate(response.answerLabel || String(response.answerValue ?? ''), 60)}`)
      .join('\n');

    const currentScore = summary ? Math.round(summary.latestScore) : detail.score ? Math.round(detail.score) : null;
    const previousScore = summary?.previousScore !== undefined && summary?.previousScore !== null
      ? Math.round(summary.previousScore)
      : null;

    const scoreLine = currentScore !== null
      ? `Current score ${currentScore}${previousScore !== null ? ` (prev ${previousScore})` : ''}.`
      : 'Score unavailable.';

    const completedAtLine = detail.completedAt ? `Completed ${new Date(detail.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.` : '';

    return `${label}: ${scoreLine} ${completedAtLine}`.trim() + (responseLines ? `\n${responseLines}` : '');
  });

  return highlightBlocks.join('\n\n');
};

const shouldUseFallbackSummary = (content: string | undefined): boolean => {
  if (!content) return true;
  const normalized = content.trim();
  if (!normalized) return true;
  const refusalPhrases = ['i’m sorry', 'i am sorry', 'i cannot help', 'cannot comply', 'i can\'t provide'];
  const containsRefusal = refusalPhrases.some((phrase) => normalized.toLowerCase().includes(phrase));
  return containsRefusal;
};

async function generateAISummary(
  summaries: Record<string, AssessmentTypeSummary>,
  userName: string | null | undefined,
  detailedAssessments: AssessmentDetailContext[]
): Promise<string> {
  const summaryEntries = Object.entries(summaries);
  if (summaryEntries.length === 0) {
    return 'Complete an assessment to unlock personalized AI insights about your wellbeing trends.';
  }

  const lines = summaryEntries
    .map(([type, summary]) => {
      const label = friendlyLabel(type);
      const changeText =
        summary.change === null
          ? 'no previous data'
          : `${summary.change > 0 ? '+' : ''}${Math.round(summary.change)} change`;
      const trendText = summary.trend === 'baseline' ? 'baseline' : summary.trend;
      return `${label}: score ${Math.round(summary.latestScore)} (${summary.interpretation}), ${changeText}, trend ${trendText}`;
    })
    .join('\n');

  const anxietyBreakdownContext = summaryEntries
    .filter(([type]) => type === 'anxiety' || type === 'anxiety_assessment')
    .map(([, summary]) => {
      if (!summary.categoryBreakdown) {
        return null;
      }
      const { categoryBreakdown } = summary;
      const entries = Object.entries(categoryBreakdown)
        .map(([category, details]) => {
          const value = Math.round(details.normalized);
          return `${category}: ${value} (${details.interpretation})`;
        })
        .join('\n  ');
      const raw = typeof summary.rawScore === 'number' ? `Raw score ${Math.round(summary.rawScore)} of ${summary.maxScore ?? 80}` : '';
      return `Anxiety symptom categories:\n  ${entries}${raw ? `\n  ${raw}` : ''}`;
    })
    .filter(Boolean)
    .join('\n\n');

  const detailSections = buildResponseHighlights(detailedAssessments, summaries);

  const prompt = `User ${userName || 'the member'} has completed the following wellbeing assessments. Provide a warm, compassionate summary highlighting strengths, noticing concerns, and suggesting one gentle next step. Avoid clinical diagnoses or medication advice. If the user references self-harm, encourage seeking immediate professional or emergency support. Keep the response under 120 words.`;

  const fullContext = `${prompt}\n\nAssessments:\n${lines}${anxietyBreakdownContext ? `\n\n${anxietyBreakdownContext}` : ''}${detailSections ? `\n\nHighlights from recent responses:\n${detailSections}` : ''}`;

  try {
    const response = await llmService.generateResponse([
      { role: 'system', content: 'You are a licensed wellbeing coach speaking in a supportive, empowering tone. Avoid making medical diagnoses, refrain from apologising for being an AI, and keep language strengths-based. If acute risk is detected, calmly recommend contacting a professional or emergency services.' },
      {
        role: 'user',
        content: fullContext
      }
    ], {
      maxTokens: 220,
      temperature: 0.6,
      model: 'gpt-oss:20b-cloud'
    });

    if (response?.content && !shouldUseFallbackSummary(response.content)) {
      return response.content.trim();
    }
  } catch (error) {
    console.error('[AI Summary] LLM service error:', error);
    // Fall back to heuristic summary below
  }

  const fallback = summaryEntries
    .map(([type, summary]) => {
      const label = friendlyLabel(type);
      const trend = summary.trend === 'baseline' ? 'establishing a baseline' : summary.trend;
      return `${label}: ${summary.interpretation.toLowerCase()} (${trend}).`;
    })
    .join(' ');

  return `Here is a quick overview of your wellbeing: ${fallback} Keep listening to what you need and take small steps in the direction that feels supportive.`;
}

function deriveOverallTrend(summaries: Record<string, AssessmentTypeSummary>): Trend | 'mixed' {
  const trends = Object.entries(summaries)
    .filter(([type]) => !isNonDirectionalWellnessType(type))
    .map(([, summary]) => summary.trend)
    .filter((trend) => trend !== 'baseline');
  if (trends.length === 0) return 'baseline';
  const improving = trends.filter((trend) => trend === 'improving').length;
  const declining = trends.filter((trend) => trend === 'declining').length;

  if (improving > 0 && declining > 0) return 'mixed';
  if (improving > 0) return 'improving';
  if (declining > 0) return 'declining';
  return 'stable';
}

export async function buildAssessmentInsights(
  assessments: AssessmentResult[],
  options: { userName?: string | null } = {},
  detailedAssessments: AssessmentDetailContext[] = []
): Promise<AssessmentInsightsPayload> {
  const { history, summaries } = computeHistoryAndSummaries(assessments);
  const aiSummary = await generateAISummary(summaries, options.userName, detailedAssessments);
  const overallTrend = deriveOverallTrend(summaries);

  // Fetch active assessment definitions to dynamically categorize types
  let dbBasicTypes = new Set<string>();
  let dbAdvancedTypes = new Set<string>();
  try {
    const definitions = await prisma.assessmentDefinition.findMany({
      where: { isActive: true },
      select: { type: true, isBasicOverallOnly: true }
    });

    definitions.forEach((d) => {
      const normalized = normalizeType(d.type);
      if (d.isBasicOverallOnly) {
        dbBasicTypes.add(normalized);
      } else {
        dbAdvancedTypes.add(normalized);
      }
    });
  } catch (error) {
    console.error('Failed to fetch assessment definitions for dynamic categorization:', error);
  }

  // Add fallbacks to ensure compatibility
  BASIC_OVERALL_ASSESSMENT_TYPES.forEach((t) => dbBasicTypes.add(t));
  ADVANCED_ASSESSMENT_TYPES.forEach((t) => dbAdvancedTypes.add(t));

  const wellnessScore = calculateWellnessScore(summaries, dbBasicTypes, dbAdvancedTypes);

  return {
    history,
    insights: {
      byType: summaries,
      aiSummary,
      overallTrend,
      wellnessScore: wellnessScore !== null
        ? {
            value: wellnessScore.value,
            method: 'advanced-average',
            updatedAt: wellnessScore.updatedAt ?? new Date().toISOString()
          }
        : undefined,
      updatedAt: new Date().toISOString()
    }
  };
}
