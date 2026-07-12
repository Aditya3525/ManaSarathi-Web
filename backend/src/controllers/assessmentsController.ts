import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import Joi from 'joi';
import { prisma } from '../config/database';
import { 
  AppError,
  NotFoundError, 
  BadRequestError,
  DatabaseError 
} from '../shared/errors/AppError';
import { AssessmentDetailContext, AssessmentInsightsPayload, buildAssessmentInsights } from '../services/assessmentInsightsService';
import { SCORE_HANDLERS } from '../services/assessments/basicAssessments';

type TemplateBaseType = 'anxiety' | 'stress' | 'trauma' | 'overthinking' | 'emotionalIntelligence' | 'personality' | 'depression';

const ASSESSMENT_TEMPLATE_MAP: Record<TemplateBaseType, { definitionId: string }> = {
  anxiety: { definitionId: 'anxiety_assessment' },
  stress: { definitionId: 'stress_pss10' },
  trauma: { definitionId: 'trauma_pcl5' },
  overthinking: { definitionId: 'overthinking_ptq' },
  emotionalIntelligence: { definitionId: 'emotional_intelligence_teique' },
  personality: { definitionId: 'personality_mini_ipip' },
  depression: { definitionId: 'depression_phq9' }
};

const TEMPLATE_TYPE_ALIASES: Record<string, TemplateBaseType> = {
  'anxiety_assessment': 'anxiety',
  'anxiety': 'anxiety',
  'gad7': 'anxiety',
  'gad-7': 'anxiety',
  'anxiety_gad7': 'anxiety',
  'stress_pss10': 'stress',
  'stressassessment': 'stress',
  'stresslevelcheck': 'stress',
  'pss10': 'stress',
  'trauma_pcl5': 'trauma',
  'traumafear': 'trauma',
  'trauma-fear': 'trauma',
  'pcl5': 'trauma',
  'overthinking_brooding': 'overthinking',
  'overthinkingpatterns': 'overthinking',
  'overthinking_ptq': 'overthinking',
  'ptq': 'overthinking',
  'emotional_intelligence_ei10': 'emotionalIntelligence',
  'emotional_intelligence_teique': 'emotionalIntelligence',
  'emotional-intelligence': 'emotionalIntelligence',
  'teique_sf': 'emotionalIntelligence',
  'personality_mini_ipip': 'personality',
  'personality': 'personality',
  'mini_ipip': 'personality',
  'archetypes': 'personality',
  'psychological_archetypes': 'personality',
  'psychologicalarchetypes': 'personality',
  'depression_phq9': 'depression',
  'phq9': 'depression',
  'phq-9': 'depression'
};

const SHORT_FORM_DEFINITION_ID_ALIASES: Record<string, string[]> = {
  anxiety_gad2: ['anxiety_gad2', 'gad2'],
  gad2: ['anxiety_gad2', 'gad2'],
  depression_phq2: ['depression_phq2', 'phq2'],
  phq2: ['depression_phq2', 'phq2'],
  stress_pss4: ['stress_pss4', 'pss4'],
  pss4: ['stress_pss4', 'pss4'],
  overthinking_rrs4: ['overthinking_rrs4', 'rrs4'],
  rrs4: ['overthinking_rrs4', 'rrs4'],
  trauma_pcptsd5: ['trauma_pcptsd5', 'pc_ptsd_5', 'pcptsd5'],
  pcptsd5: ['trauma_pcptsd5', 'pc_ptsd_5', 'pcptsd5'],
  emotional_intelligence_eq5: ['emotional_intelligence_eq5', 'eq5'],
  eq5: ['emotional_intelligence_eq5', 'eq5'],
  personality_bigfive10: ['personality_bigfive10', 'big_five_short', 'bigfive10'],
  bigfive10: ['personality_bigfive10', 'big_five_short', 'bigfive10']
};

type TemplateInterpretationBand = { max: number; label: string };

type TemplateDomain = {
  id: string;
  label: string;
  items: string[];
  minScore: number;
  maxScore: number;
  interpretationBands?: TemplateInterpretationBand[];
};

type TemplateScoring = {
  minScore: number;
  maxScore: number;
  interpretationBands: TemplateInterpretationBand[];
  reverseScored?: string[];
  domains?: TemplateDomain[];
  higherIsBetter?: boolean;
};

const GENERIC_ASSESSMENT_TYPE_VALUES = new Set(['basic', 'advanced', 'combined']);

const resolveAssessmentTypeKey = (definitionType: string | null | undefined, definitionId: string): string => {
  const trimmedType = typeof definitionType === 'string' ? definitionType.trim() : '';
  if (!trimmedType) {
    return definitionId;
  }

  if (GENERIC_ASSESSMENT_TYPE_VALUES.has(trimmedType.toLowerCase())) {
    return definitionId;
  }

  return trimmedType;
};

const TRAUMA_DOMAIN_DEFINITIONS: Array<{ id: string; label: string; items: string[] }> = [
  { id: 'intrusion', label: 'Intrusion', items: ['trauma_pcl5_pcl5_q1', 'trauma_pcl5_pcl5_q2', 'trauma_pcl5_pcl5_q3', 'trauma_pcl5_pcl5_q4', 'trauma_pcl5_pcl5_q5'] },
  { id: 'avoidance', label: 'Avoidance', items: ['trauma_pcl5_pcl5_q6', 'trauma_pcl5_pcl5_q7'] },
  { id: 'negative-mood', label: 'Negative Mood & Cognition', items: ['trauma_pcl5_pcl5_q8', 'trauma_pcl5_pcl5_q9', 'trauma_pcl5_pcl5_q10', 'trauma_pcl5_pcl5_q11', 'trauma_pcl5_pcl5_q12', 'trauma_pcl5_pcl5_q13', 'trauma_pcl5_pcl5_q14'] },
  { id: 'arousal', label: 'Arousal & Reactivity', items: ['trauma_pcl5_pcl5_q15', 'trauma_pcl5_pcl5_q16', 'trauma_pcl5_pcl5_q17', 'trauma_pcl5_pcl5_q18', 'trauma_pcl5_pcl5_q19', 'trauma_pcl5_pcl5_q20'] }
];

const TRAUMA_DOMAINS: TemplateDomain[] = TRAUMA_DOMAIN_DEFINITIONS.map((domain) => {
  const maxScore = domain.items.length * 4;
  const lowCutoff = Math.round(maxScore * 0.33);
  const moderateCutoff = Math.round(maxScore * 0.66);
  return {
    ...domain,
    minScore: 0,
    maxScore,
    interpretationBands: [
      { max: lowCutoff, label: 'Low activation' },
      { max: moderateCutoff, label: 'Moderate activation' },
      { max: maxScore, label: 'High activation' }
    ]
  };
});

const MINI_IPIP_REVERSE_ITEMS = [
  'personality_mini_ipip_mini_ipip_q3',
  'personality_mini_ipip_mini_ipip_q4',
  'personality_mini_ipip_mini_ipip_q7',
  'personality_mini_ipip_mini_ipip_q8',
  'personality_mini_ipip_mini_ipip_q11',
  'personality_mini_ipip_mini_ipip_q12',
  'personality_mini_ipip_mini_ipip_q15',
  'personality_mini_ipip_mini_ipip_q16',
  'personality_mini_ipip_mini_ipip_q18',
  'personality_mini_ipip_mini_ipip_q20'
];

const TEIQUE_REVERSE_ITEMS = [
  'emotional_intelligence_teique_teique_q2',
  'emotional_intelligence_teique_teique_q4',
  'emotional_intelligence_teique_teique_q5',
  'emotional_intelligence_teique_teique_q7',
  'emotional_intelligence_teique_teique_q8',
  'emotional_intelligence_teique_teique_q10',
  'emotional_intelligence_teique_teique_q12',
  'emotional_intelligence_teique_teique_q13',
  'emotional_intelligence_teique_teique_q14',
  'emotional_intelligence_teique_teique_q16',
  'emotional_intelligence_teique_teique_q18',
  'emotional_intelligence_teique_teique_q22',
  'emotional_intelligence_teique_teique_q25',
  'emotional_intelligence_teique_teique_q26',
  'emotional_intelligence_teique_teique_q28'
];

const buildMiniIpipDomain = (id: string, label: string, items: string[]): TemplateDomain => {
  const minScore = items.length * 1;
  const maxScore = items.length * 5;
  const subtleCutoff = minScore + Math.round(items.length * 1.5);
  const balancedCutoff = minScore + Math.round(items.length * 3);
  return {
    id,
    label,
    items,
    minScore,
    maxScore,
    interpretationBands: [
      { max: subtleCutoff, label: 'Subtle trait expression' },
      { max: balancedCutoff, label: 'Balanced trait expression' },
      { max: maxScore, label: 'Strong trait expression' }
    ]
  };
};

const MINI_IPIP_DOMAINS: TemplateDomain[] = [
  buildMiniIpipDomain('extraversion', 'Extraversion', ['personality_mini_ipip_mini_ipip_q1', 'personality_mini_ipip_mini_ipip_q2', 'personality_mini_ipip_mini_ipip_q3', 'personality_mini_ipip_mini_ipip_q4']),
  buildMiniIpipDomain('agreeableness', 'Agreeableness', ['personality_mini_ipip_mini_ipip_q5', 'personality_mini_ipip_mini_ipip_q6', 'personality_mini_ipip_mini_ipip_q7', 'personality_mini_ipip_mini_ipip_q8']),
  buildMiniIpipDomain('conscientiousness', 'Conscientiousness', ['personality_mini_ipip_mini_ipip_q9', 'personality_mini_ipip_mini_ipip_q10', 'personality_mini_ipip_mini_ipip_q11', 'personality_mini_ipip_mini_ipip_q12']),
  buildMiniIpipDomain('neuroticism', 'Neuroticism', ['personality_mini_ipip_mini_ipip_q13', 'personality_mini_ipip_mini_ipip_q14', 'personality_mini_ipip_mini_ipip_q15', 'personality_mini_ipip_mini_ipip_q16']),
  buildMiniIpipDomain('openness', 'Openness', ['personality_mini_ipip_mini_ipip_q17', 'personality_mini_ipip_mini_ipip_q18', 'personality_mini_ipip_mini_ipip_q19', 'personality_mini_ipip_mini_ipip_q20'])
];

const TEMPLATE_SCORING: Record<TemplateBaseType, TemplateScoring> = {
  anxiety: {
    minScore: 0,
    maxScore: 21,
    interpretationBands: [
      { max: 4, label: 'Minimal anxiety' },
      { max: 9, label: 'Mild anxiety' },
      { max: 14, label: 'Moderate anxiety' },
      { max: 21, label: 'Severe anxiety' }
    ],
    higherIsBetter: false
  },
  stress: {
    minScore: 0,
    maxScore: 40,
  reverseScored: ['stress_pss10_pss10_q4', 'stress_pss10_pss10_q5', 'stress_pss10_pss10_q6', 'stress_pss10_pss10_q7', 'stress_pss10_pss10_q9'],
    interpretationBands: [
      { max: 13, label: 'Low perceived stress' },
      { max: 26, label: 'Moderate perceived stress' },
      { max: 40, label: 'High perceived stress' }
    ],
    higherIsBetter: false
  },
  trauma: {
    minScore: 0,
    maxScore: 80,
    interpretationBands: [
      { max: 19, label: 'Minimal trauma-related distress' },
      { max: 39, label: 'Mild trauma activation' },
      { max: 59, label: 'Moderate trauma activation' },
      { max: 80, label: 'Severe trauma activation' }
    ],
    domains: TRAUMA_DOMAINS,
    higherIsBetter: false
  },
  overthinking: {
    minScore: 0,
    maxScore: 60,
    interpretationBands: [
      { max: 15, label: 'Low repetitive negative thinking' },
      { max: 30, label: 'Moderate repetitive negative thinking' },
      { max: 45, label: 'High repetitive negative thinking' },
      { max: 60, label: 'Very high repetitive negative thinking' }
    ],
    higherIsBetter: false
  },
  emotionalIntelligence: {
    minScore: 30,
    maxScore: 210,
    reverseScored: TEIQUE_REVERSE_ITEMS,
    interpretationBands: [
      { max: 90, label: 'Low trait emotional intelligence' },
      { max: 150, label: 'Average trait emotional intelligence' },
      { max: 210, label: 'High trait emotional intelligence' }
    ],
    higherIsBetter: true
  },
  personality: {
    minScore: 20,
    maxScore: 100,
    reverseScored: MINI_IPIP_REVERSE_ITEMS,
    interpretationBands: [
      { max: 45, label: 'Reserved personality expression' },
      { max: 80, label: 'Balanced personality expression' },
      { max: 100, label: 'Pronounced personality expression' }
    ],
    domains: MINI_IPIP_DOMAINS,
    higherIsBetter: true
  },
  depression: {
    minScore: 0,
    maxScore: 27,
    interpretationBands: [
      { max: 4, label: 'Minimal depression' },
      { max: 9, label: 'Mild depression' },
      { max: 14, label: 'Moderate depression' },
      { max: 19, label: 'Moderately severe depression' },
      { max: 27, label: 'Severe depression' }
    ],
    higherIsBetter: false
  }
};

type AssessmentDefinitionWithQuestions = Prisma.AssessmentDefinitionGetPayload<{
  include: {
    questions: {
      include: {
        options: true;
      };
    };
  };
}>;

type CategoryBreakdownEntry = {
  raw: number;
  normalized: number;
  interpretation?: string;
};

type VerifiedScorePayload = {
  score: number;
  rawScore: number | null;
  maxScore: number | null;
  categoryBreakdown?: Record<string, CategoryBreakdownEntry>;
};

type ParsedScoringDomain = {
  id: string;
  label: string;
  items: string[];
  minScore: number;
  maxScore: number;
  interpretationBands: TemplateInterpretationBand[] | undefined;
};

type ParsedScoringConfig = {
  algorithm?: 'SUM' | 'AVERAGE' | 'WEIGHTED_SUM' | 'CUSTOM_HOOK';
  customHookId?: string;
  minScore?: number;
  maxScore?: number;
  reverseScored?: string[];
  interpretationBands?: TemplateInterpretationBand[];
  domains?: ParsedScoringDomain[];
};

type ShortFormVerificationRule = {
  minScore: number;
  maxScore: number;
  questionBounds: Record<string, { min: number; max: number }>;
  reverseScored?: string[];
  interpretationBands: TemplateInterpretationBand[];
};

type AssessmentDefinitionCacheEntry = {
  value: AssessmentDefinitionWithQuestions | null;
  expiresAt: number;
};

type AssessmentTemplatesCacheEntry = {
  templates: any[];
  expiresAt: number;
};

const ASSESSMENT_DEFINITION_CACHE_TTL_MS = (() => {
  const configured = Number(process.env.ASSESSMENT_DEFINITION_CACHE_TTL_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return 5 * 60 * 1000;
})();

const ASSESSMENT_TEMPLATES_CACHE_TTL_MS = (() => {
  const configured = Number(process.env.ASSESSMENT_TEMPLATES_CACHE_TTL_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return 5 * 60 * 1000;
})();

const assessmentDefinitionCache = new Map<string, AssessmentDefinitionCacheEntry>();
const assessmentTemplatesCache = new Map<string, AssessmentTemplatesCacheEntry>();

const buildAssessmentTemplatesCacheKey = (requestedTypes: string[]): string => {
  if (requestedTypes.length === 0) {
    return '__default__';
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  requestedTypes.forEach((type) => {
    const value = type.trim().toLowerCase();
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    normalized.push(value);
  });

  return normalized.length > 0 ? normalized.join('|') : '__default__';
};

const SHORT_FORM_VERIFICATION_RULES: Record<string, ShortFormVerificationRule> = {
  anxiety_gad2: {
    minScore: 0,
    maxScore: 6,
    questionBounds: {
      gad2_q1: { min: 0, max: 3 },
      gad2_q2: { min: 0, max: 3 }
    },
    interpretationBands: [
      { max: 2, label: 'Minimal anxiety' },
      { max: 4, label: 'Mild anxiety symptoms' },
      { max: 6, label: 'Elevated anxiety symptoms' }
    ]
  },
  depression_phq2: {
    minScore: 0,
    maxScore: 6,
    questionBounds: {
      phq2_q1: { min: 0, max: 3 },
      phq2_q2: { min: 0, max: 3 }
    },
    interpretationBands: [
      { max: 2, label: 'Minimal depression symptoms' },
      { max: 4, label: 'Mild depression symptoms' },
      { max: 6, label: 'Elevated depression symptoms' }
    ]
  },
  stress_pss4: {
    minScore: 0,
    maxScore: 16,
    questionBounds: {
      pss4_q1: { min: 0, max: 4 },
      pss4_q2: { min: 0, max: 4 },
      pss4_q3: { min: 0, max: 4 },
      pss4_q4: { min: 0, max: 4 }
    },
    reverseScored: ['pss4_q2', 'pss4_q3'],
    interpretationBands: [
      { max: 5, label: 'Low perceived stress' },
      { max: 10, label: 'Moderate perceived stress' },
      { max: 16, label: 'High perceived stress' }
    ]
  },
  overthinking_rrs4: {
    minScore: 0,
    maxScore: 12,
    questionBounds: {
      rrs4_q1: { min: 0, max: 3 },
      rrs4_q2: { min: 0, max: 3 },
      rrs4_q3: { min: 0, max: 3 },
      rrs4_q4: { min: 0, max: 3 }
    },
    interpretationBands: [
      { max: 3, label: 'Low overthinking' },
      { max: 8, label: 'Moderate overthinking' },
      { max: 12, label: 'High overthinking' }
    ]
  },
  trauma_pcptsd5: {
    minScore: 0,
    maxScore: 5,
    questionBounds: {
      pcptsd5_q1: { min: 0, max: 1 },
      pcptsd5_q2: { min: 0, max: 1 },
      pcptsd5_q3: { min: 0, max: 1 },
      pcptsd5_q4: { min: 0, max: 1 },
      pcptsd5_q5: { min: 0, max: 1 }
    },
    interpretationBands: [
      { max: 2, label: 'Low trauma symptom activation' },
      { max: 5, label: 'Further trauma assessment recommended' }
    ]
  },
  emotional_intelligence_eq5: {
    minScore: 0,
    maxScore: 20,
    questionBounds: {
      eq5_q1: { min: 0, max: 4 },
      eq5_q2: { min: 0, max: 4 },
      eq5_q3: { min: 0, max: 4 },
      eq5_q4: { min: 0, max: 4 },
      eq5_q5: { min: 0, max: 4 }
    },
    interpretationBands: [
      { max: 7, label: 'Developing emotional intelligence' },
      { max: 14, label: 'Growing emotional intelligence' },
      { max: 20, label: 'Strong emotional intelligence' }
    ]
  },
  personality_bigfive10: {
    minScore: 0,
    maxScore: 40,
    questionBounds: {
      bigfive10_q1: { min: 0, max: 4 },
      bigfive10_q2: { min: 0, max: 4 },
      bigfive10_q3: { min: 0, max: 4 },
      bigfive10_q4: { min: 0, max: 4 },
      bigfive10_q5: { min: 0, max: 4 },
      bigfive10_q6: { min: 0, max: 4 },
      bigfive10_q7: { min: 0, max: 4 },
      bigfive10_q8: { min: 0, max: 4 },
      bigfive10_q9: { min: 0, max: 4 },
      bigfive10_q10: { min: 0, max: 4 }
    },
    reverseScored: ['bigfive10_q2', 'bigfive10_q6', 'bigfive10_q8', 'bigfive10_q9', 'bigfive10_q10'],
    interpretationBands: [
      { max: 16, label: 'Subtle trait expression' },
      { max: 28, label: 'Balanced trait expression' },
      { max: 40, label: 'Strong trait expression' }
    ]
  }
};

const cloneInterpretationBands = (bands: TemplateInterpretationBand[] | undefined): TemplateInterpretationBand[] | undefined => {
  if (!bands) return undefined;
  return bands.map((band) => ({ ...band }));
};

const cloneDomains = (domains: TemplateDomain[] | undefined): TemplateDomain[] | undefined => {
  if (!domains) return undefined;
  return domains.map((domain) => ({
    ...domain,
    items: [...domain.items],
    interpretationBands: cloneInterpretationBands(domain.interpretationBands)
  }));
};

const cloneScoring = (scoring: TemplateScoring): TemplateScoring => ({
  minScore: scoring.minScore,
  maxScore: scoring.maxScore,
  interpretationBands: cloneInterpretationBands(scoring.interpretationBands) ?? [],
  reverseScored: scoring.reverseScored ? [...scoring.reverseScored] : undefined,
  domains: cloneDomains(scoring.domains),
  higherIsBetter: scoring.higherIsBetter
});

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeToPercent = (rawScore: number, minScore: number, maxScore: number): number => {
  if (!Number.isFinite(rawScore) || !Number.isFinite(minScore) || !Number.isFinite(maxScore) || maxScore <= minScore) {
    return 0;
  }

  const bounded = Math.min(Math.max(rawScore, minScore), maxScore);
  return roundToOneDecimal(((bounded - minScore) / (maxScore - minScore)) * 100);
};

const resolveInterpretationBand = (
  bands: TemplateInterpretationBand[] | undefined,
  value: number
): string | undefined => {
  if (!bands || bands.length === 0) {
    return undefined;
  }

  for (const band of bands) {
    if (value <= band.max) {
      return band.label;
    }
  }

  return bands[bands.length - 1]?.label;
};

const parseInterpretationBands = (rawBands: unknown): TemplateInterpretationBand[] | undefined => {
  if (!Array.isArray(rawBands)) {
    return undefined;
  }

  const parsedBands = rawBands
    .map((band) => {
      if (!band || typeof band !== 'object') {
        return null;
      }
      const candidate = band as Record<string, unknown>;
      const max = toFiniteNumber(candidate.max);
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';

      if (max === null || !label) {
        return null;
      }

      return { max, label };
    })
    .filter((band): band is TemplateInterpretationBand => band !== null)
    .sort((a, b) => a.max - b.max);

  return parsedBands.length > 0 ? parsedBands : undefined;
};

const parseScoringConfig = (rawConfig: string | null | undefined): ParsedScoringConfig | null => {
  if (!rawConfig) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    const algorithm = (parsed.algorithm === 'SUM' || parsed.algorithm === 'AVERAGE' || parsed.algorithm === 'WEIGHTED_SUM' || parsed.algorithm === 'CUSTOM_HOOK')
      ? parsed.algorithm
      : undefined;
    const customHookId = typeof parsed.customHookId === 'string' ? parsed.customHookId : undefined;
    const minScore = toFiniteNumber(parsed.minScore) ?? undefined;
    const maxScore = toFiniteNumber(parsed.maxScore) ?? undefined;
    const interpretationBands = parseInterpretationBands(parsed.interpretationBands);
    const reverseScored = Array.isArray(parsed.reverseScored)
      ? parsed.reverseScored.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined;

    const domains = Array.isArray(parsed.domains)
      ? parsed.domains
          .map((domain, index) => {
            if (!domain || typeof domain !== 'object') {
              return null;
            }

            const candidate = domain as Record<string, unknown>;
            const rawItems = Array.isArray(candidate.items)
              ? candidate.items
              : Array.isArray(candidate.questionIds)
                ? candidate.questionIds
                : [];

            const items = rawItems.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0
            );

            const id =
              typeof candidate.id === 'string' && candidate.id.trim().length > 0
                ? candidate.id
                : `domain-${index + 1}`;
            const label =
              typeof candidate.label === 'string' && candidate.label.trim().length > 0
                ? candidate.label
                : id;

            return {
              id,
              label,
              items,
              minScore: toFiniteNumber(candidate.minScore) ?? 0,
              maxScore: toFiniteNumber(candidate.maxScore) ?? 0,
              interpretationBands: parseInterpretationBands(candidate.interpretationBands)
            } satisfies ParsedScoringDomain;
          })
          .filter((domain): domain is ParsedScoringDomain => domain !== null)
      : undefined;

    return {
      algorithm,
      customHookId,
      minScore,
      maxScore,
      interpretationBands,
      reverseScored,
      domains: domains && domains.length > 0 ? domains : undefined
    };
  } catch (error) {
    return null;
  }
};

const resolveShortFormVerificationRule = (assessmentType: string): ShortFormVerificationRule | null => {
  const normalized = assessmentType.trim().toLowerCase();
  const aliasCandidates = SHORT_FORM_DEFINITION_ID_ALIASES[normalized] ?? [];
  const candidates = [normalized, ...aliasCandidates];

  for (const candidate of candidates) {
    const rule = SHORT_FORM_VERIFICATION_RULES[candidate];
    if (rule) {
      return rule;
    }
  }

  return null;
};

const mapResponseTypeToUi = (responseType: string): 'likert' | 'binary' | 'multiple-choice' => {
  switch (responseType) {
    case 'binary':
    case 'yes_no':
      return 'binary';
    case 'multiple_choice':
    case 'multiple-choice':
      return 'multiple-choice';
    default:
      return 'likert';
  }
};

const resolveTemplateType = (rawType: string): TemplateBaseType | null => {
  if (!rawType) return null;
  if (rawType in ASSESSMENT_TEMPLATE_MAP) {
    return rawType as TemplateBaseType;
  }

  const trimmed = rawType.trim();
  const lower = trimmed.toLowerCase();

  const directMatch = (Object.keys(ASSESSMENT_TEMPLATE_MAP) as TemplateBaseType[]).find(
    (key) => key.toLowerCase() === lower
  );
  if (directMatch) {
    return directMatch;
  }

  const alias = TEMPLATE_TYPE_ALIASES[lower];
  return alias ?? null;
};

const buildDefinitionCandidates = (assessmentType: string): string[] => {
  const candidates = new Set<string>();

  const addCandidate = (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    candidates.add(trimmed);
    candidates.add(trimmed.toLowerCase());
  };

  addCandidate(assessmentType);

  const normalized = assessmentType.trim().toLowerCase();
  (SHORT_FORM_DEFINITION_ID_ALIASES[normalized] ?? []).forEach((candidate) => addCandidate(candidate));

  const resolvedBaseType = resolveTemplateType(assessmentType);
  if (resolvedBaseType) {
    addCandidate(resolvedBaseType);
    addCandidate(ASSESSMENT_TEMPLATE_MAP[resolvedBaseType].definitionId);
  }

  return Array.from(candidates);
};

const findDefinitionByCandidates = (
  definitions: AssessmentDefinitionWithQuestions[],
  candidates: string[]
): AssessmentDefinitionWithQuestions | null => {
  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();
    const matched = definitions.find(
      (definition) =>
        definition.id.toLowerCase() === lowerCandidate || definition.type.toLowerCase() === lowerCandidate
    );
    if (matched) {
      return matched;
    }
  }

  return null;
};

const fetchAssessmentDefinitionForVerification = async (
  assessmentType: string
): Promise<AssessmentDefinitionWithQuestions | null> => {
  const cacheKey = assessmentType.trim().toLowerCase();
  const now = Date.now();
  const cached = assessmentDefinitionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached) {
    assessmentDefinitionCache.delete(cacheKey);
  }

  const candidates = buildDefinitionCandidates(assessmentType);
  if (candidates.length === 0) {
    assessmentDefinitionCache.set(cacheKey, {
      value: null,
      expiresAt: now + ASSESSMENT_DEFINITION_CACHE_TTL_MS
    });
    return null;
  }

  const definitions = await prisma.assessmentDefinition.findMany({
    where: {
      isActive: true,
      OR: [{ type: { in: candidates } }, { id: { in: candidates } }]
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  const matched = findDefinitionByCandidates(definitions, candidates);

  assessmentDefinitionCache.set(cacheKey, {
    value: matched,
    expiresAt: now + ASSESSMENT_DEFINITION_CACHE_TTL_MS
  });

  return matched;
};

const preloadAssessmentDefinitionsForVerification = async (assessmentTypes: string[]): Promise<void> => {
  const now = Date.now();
  const pendingLookups: Array<{ cacheKey: string; candidates: string[] }> = [];
  const candidateSet = new Set<string>();

  for (const assessmentType of assessmentTypes) {
    const cacheKey = assessmentType.trim().toLowerCase();
    if (!cacheKey) {
      continue;
    }

    const cached = assessmentDefinitionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      continue;
    }

    if (cached) {
      assessmentDefinitionCache.delete(cacheKey);
    }

    const candidates = buildDefinitionCandidates(assessmentType);
    if (candidates.length === 0) {
      assessmentDefinitionCache.set(cacheKey, {
        value: null,
        expiresAt: now + ASSESSMENT_DEFINITION_CACHE_TTL_MS
      });
      continue;
    }

    pendingLookups.push({ cacheKey, candidates });
    candidates.forEach((candidate) => candidateSet.add(candidate));
  }

  if (pendingLookups.length === 0 || candidateSet.size === 0) {
    return;
  }

  const definitions = await prisma.assessmentDefinition.findMany({
    where: {
      isActive: true,
      OR: [{ type: { in: Array.from(candidateSet) } }, { id: { in: Array.from(candidateSet) } }]
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  pendingLookups.forEach(({ cacheKey, candidates }) => {
    const matched = findDefinitionByCandidates(definitions, candidates);
    assessmentDefinitionCache.set(cacheKey, {
      value: matched,
      expiresAt: now + ASSESSMENT_DEFINITION_CACHE_TTL_MS
    });
  });
};

const resolveQuestionOptionValue = (option: AssessmentDefinitionWithQuestions['questions'][number]['options'][number]): number => {
  if (typeof option.value === 'number' && Number.isFinite(option.value)) {
    return option.value;
  }
  return option.order - 1;
};

const resolveSubmittedResponseValue = (
  submittedValue: unknown,
  question: AssessmentDefinitionWithQuestions['questions'][number]
): number | null => {
  const asString =
    typeof submittedValue === 'string' || typeof submittedValue === 'number'
      ? String(submittedValue).trim()
      : null;

  if (asString !== null && asString.length > 0) {
    for (const option of question.options) {
      const optionValue = resolveQuestionOptionValue(option);
      if (asString === option.id || asString === String(optionValue)) {
        return optionValue;
      }
    }

    const parsed = Number(asString);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof submittedValue === 'boolean') {
    return submittedValue ? 1 : 0;
  }

  return null;
};

const computeVerifiedScoreFromDefinition = (
  assessmentType: string,
  definition: AssessmentDefinitionWithQuestions,
  responses: Record<string, unknown>
): VerifiedScorePayload => {
  const parsedScoring = parseScoringConfig(definition.scoringConfig);

  // Fallback to custom hook handler if specified
  if (parsedScoring?.algorithm === 'CUSTOM_HOOK') {
    const hookId = parsedScoring.customHookId || assessmentType;
    const handler = SCORE_HANDLERS[hookId];
    if (handler) {
      try {
        const result = handler(responses as any);
        return {
          score: result.normalizedScore,
          rawScore: roundToOneDecimal(result.rawScore),
          maxScore: result.maxScore,
          categoryBreakdown: result.categoryBreakdown as any
        };
      } catch (err) {
        console.warn(`Custom scoring hook failed for ${hookId}:`, err);
      }
    }
  }

  const baseType = resolveTemplateType(assessmentType);
  const builtInScoring = baseType ? cloneScoring(TEMPLATE_SCORING[baseType]) : null;
  const shortRule = resolveShortFormVerificationRule(assessmentType);

  const reverseScored = new Set<string>([
    ...(parsedScoring?.reverseScored ?? []),
    ...(builtInScoring?.reverseScored ?? []),
    ...(shortRule?.reverseScored ?? [])
  ]);

  const questionBounds = new Map<string, { min: number; max: number }>();
  const adjustedByQuestion = new Map<string, number>();
  let rawScore = 0;
  let fallbackMinScore = 0;
  let fallbackMaxScore = 0;

  for (const question of definition.questions) {
    const optionValues = question.options.map(resolveQuestionOptionValue);
    const minValue = optionValues.length > 0 ? Math.min(...optionValues) : 0;
    const maxValue = optionValues.length > 0 ? Math.max(...optionValues) : 0;
    questionBounds.set(question.id, { min: minValue, max: maxValue });

    fallbackMinScore += minValue;
    fallbackMaxScore += maxValue;

    const submittedValue = resolveSubmittedResponseValue(responses[question.id], question);
    if (submittedValue === null) {
      continue;
    }

    const boundedValue = Math.min(Math.max(submittedValue, minValue), maxValue);
    const adjustedValue = reverseScored.has(question.id) || question.reverseScored
      ? minValue + maxValue - boundedValue
      : boundedValue;

    adjustedByQuestion.set(question.id, adjustedValue);
    rawScore += adjustedValue;
  }

  const configuredMinScore =
    parsedScoring?.minScore ?? builtInScoring?.minScore ?? shortRule?.minScore ?? fallbackMinScore;
  const configuredMaxScore =
    parsedScoring?.maxScore ?? builtInScoring?.maxScore ?? shortRule?.maxScore ?? fallbackMaxScore;

  let normalizedScore = normalizeToPercent(rawScore, configuredMinScore, configuredMaxScore);
  
  if (parsedScoring?.algorithm === 'AVERAGE') {
    const answeredQuestions = definition.questions.filter(q => responses[q.id] !== undefined);
    const answeredCount = answeredQuestions.length;
    const averageRaw = answeredCount > 0 ? rawScore / answeredCount : 0;
    const avgMin = definition.questions.length > 0 ? configuredMinScore / definition.questions.length : 0;
    const avgMax = definition.questions.length > 0 ? configuredMaxScore / definition.questions.length : 0;
    normalizedScore = normalizeToPercent(averageRaw, avgMin, avgMax);
  }

  const scoringDomains =
    parsedScoring?.domains?.map((domain) => {
      // Dynamically resolve items from questions if not explicitly specified
      const items = (domain.items && domain.items.length > 0)
        ? domain.items
        : definition.questions
            .filter(q => q.domain === domain.id || q.domain === domain.label)
            .map(q => q.id);

      return {
        id: domain.id,
        label: domain.label,
        items,
        minScore: domain.minScore,
        maxScore: domain.maxScore,
        interpretationBands: domain.interpretationBands
      };
    }) ?? builtInScoring?.domains;

  const categoryBreakdown: Record<string, CategoryBreakdownEntry> = {};
  if (scoringDomains && scoringDomains.length > 0) {
    for (const domain of scoringDomains) {
      if (domain.items.length === 0) {
        continue;
      }
      const domainRaw = domain.items.reduce((sum, questionId) => sum + (adjustedByQuestion.get(questionId) ?? 0), 0);

      const fallbackDomainMin = domain.items.reduce((sum, questionId) => {
        const bounds = questionBounds.get(questionId);
        return sum + (bounds?.min ?? 0);
      }, 0);
      const fallbackDomainMax = domain.items.reduce((sum, questionId) => {
        const bounds = questionBounds.get(questionId);
        return sum + (bounds?.max ?? 0);
      }, 0);

      const domainMin = (domain.minScore !== undefined && domain.minScore !== null) ? domain.minScore : fallbackDomainMin;
      const domainMax = (domain.maxScore !== undefined && domain.maxScore !== null && domain.maxScore > domainMin)
        ? domain.maxScore
        : fallbackDomainMax;

      categoryBreakdown[domain.label] = {
        raw: roundToOneDecimal(domainRaw),
        normalized: normalizeToPercent(domainRaw, domainMin, domainMax),
        interpretation: resolveInterpretationBand(domain.interpretationBands, domainRaw)
      };
    }
  }

  return {
    score: normalizedScore,
    rawScore: roundToOneDecimal(rawScore),
    maxScore: configuredMaxScore,
    categoryBreakdown: Object.keys(categoryBreakdown).length > 0 ? categoryBreakdown : undefined
  };
};

const computeVerifiedScoreFromShortRule = (
  rule: ShortFormVerificationRule,
  responses: Record<string, unknown>
): VerifiedScorePayload => {
  const getShortFormResponseValue = (questionId: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(responses, questionId)) {
      return responses[questionId];
    }

    const normalizedQuestionId = questionId.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fallbackEntry = Object.entries(responses).find(([responseKey]) => {
      const normalizedKey = responseKey.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return normalizedKey.endsWith(normalizedQuestionId);
    });

    return fallbackEntry ? fallbackEntry[1] : undefined;
  };

  const reverseSet = new Set(rule.reverseScored ?? []);
  let rawScore = 0;

  Object.entries(rule.questionBounds).forEach(([questionId, bounds]) => {
    const parsed = toFiniteNumber(getShortFormResponseValue(questionId));
    if (parsed === null) {
      return;
    }

    const boundedValue = Math.min(Math.max(parsed, bounds.min), bounds.max);
    const adjustedValue = reverseSet.has(questionId)
      ? bounds.min + bounds.max - boundedValue
      : boundedValue;

    rawScore += adjustedValue;
  });

  return {
    score: normalizeToPercent(rawScore, rule.minScore, rule.maxScore),
    rawScore: roundToOneDecimal(rawScore),
    maxScore: rule.maxScore
  };
};

const computeFallbackVerifiedScore = (
  responses: Record<string, unknown>,
  providedScore: number | null | undefined,
  providedRawScore: number | null | undefined,
  providedMaxScore: number | null | undefined
): VerifiedScorePayload => {
  const numericResponses = Object.values(responses)
    .map((value) => toFiniteNumber(value))
    .filter((value): value is number => value !== null);

  const rawScore =
    typeof providedRawScore === 'number' && Number.isFinite(providedRawScore)
      ? providedRawScore
      : numericResponses.reduce((sum, value) => sum + value, 0);

  const maxScore =
    typeof providedMaxScore === 'number' && Number.isFinite(providedMaxScore) && providedMaxScore > 0
      ? providedMaxScore
      : numericResponses.length > 0
        ? Math.max(rawScore, numericResponses.length)
        : null;

  const normalizedScore =
    maxScore && maxScore > 0
      ? normalizeToPercent(rawScore, 0, maxScore)
      : typeof providedScore === 'number' && Number.isFinite(providedScore)
        ? roundToOneDecimal(Math.min(Math.max(providedScore, 0), 100))
        : 0;

  return {
    score: normalizedScore,
    rawScore: roundToOneDecimal(rawScore),
    maxScore
  };
};

const verifyAssessmentSubmission = async (
  assessmentType: string,
  responses: Record<string, unknown>,
  providedScore: number | null | undefined,
  providedRawScore: number | null | undefined,
  providedMaxScore: number | null | undefined,
  providedCategoryBreakdown: unknown
): Promise<VerifiedScorePayload> => {
  // Short-form overall assessments are authored in-app and may use stable lightweight IDs.
  // Prioritize deterministic short-form rules before DB-template verification to avoid ID-prefix mismatches.
  const shortRule = resolveShortFormVerificationRule(assessmentType);
  if (shortRule) {
    return computeVerifiedScoreFromShortRule(shortRule, responses);
  }

  let definition: AssessmentDefinitionWithQuestions | null = null;
  try {
    definition = await fetchAssessmentDefinitionForVerification(assessmentType);
  } catch (error) {
    console.warn('Skipping template lookup during assessment verification', {
      assessmentType,
      error
    });
  }

  if (definition) {
    const verifiedFromDefinition = computeVerifiedScoreFromDefinition(assessmentType, definition, responses);
    return {
      ...verifiedFromDefinition,
      categoryBreakdown: verifiedFromDefinition.categoryBreakdown
    };
  }

  throw new BadRequestError(`Invalid or inactive assessment type: ${assessmentType}`);
};

const formatAssessmentTemplate = (
  baseType: TemplateBaseType,
  definition: AssessmentDefinitionWithQuestions
) => {
  const scoring = cloneScoring(TEMPLATE_SCORING[baseType]);
  const reverseSet = new Set(scoring.reverseScored ?? []);
  const domainLookup = new Map<string, string>();

  scoring.domains?.forEach((domain) => {
    domain.items.forEach((item) => {
      domainLookup.set(item, domain.label);
    });
  });

  return {
    assessmentType: baseType,
    definitionId: definition.id,
    title: definition.name,
    description: definition.description ?? '',
    estimatedTime: definition.timeEstimate ?? null,
    timeframe: definition.timeframe ?? null,
    scoring,
    questions: definition.questions
      .sort((a, b) => a.order - b.order)
      .map((question) => ({
        id: question.id,
        text: question.text,
        responseType: question.responseType,
        uiType: mapResponseTypeToUi(question.responseType),
        reverseScored: reverseSet.has(question.id),
        domain: domainLookup.get(question.id) ?? null,
        options: question.options
          .sort((a, b) => a.order - b.order)
          .map((option) => {
            const numericValue =
              typeof option.value === 'number' && !Number.isNaN(option.value)
                ? option.value
                : option.order - 1;

            return {
              id: option.id,
              value: numericValue,
              text: option.text,
              order: option.order
            };
          })
      }))
  };
};

// Format custom/dynamic assessment templates (those not in TEMPLATE_SCORING)
const formatCustomAssessmentTemplate = (
  definition: AssessmentDefinitionWithQuestions
) => {
  // Parse scoring config from the definition
  let scoring: any = {
    minScore: 0,
    maxScore: 0,
    interpretationBands: []
  };

  if (definition.scoringConfig) {
    try {
      const parsed = JSON.parse(definition.scoringConfig);
      scoring = {
        minScore: parsed.minScore ?? 0,
        maxScore: parsed.maxScore ?? 0,
        interpretationBands: parsed.interpretationBands ?? [],
        reverseScored: parsed.reverseScored ?? [],
        domains: parsed.domains ?? []
      };
    } catch (e) {
      console.warn('Failed to parse scoring config for custom assessment:', e);
    }
  }

  const reverseSet = new Set(scoring.reverseScored ?? []);
  const domainLookup = new Map<string, string>();

  scoring.domains?.forEach((domain: any) => {
    if (domain.questionIds) {
      domain.questionIds.forEach((qId: string) => {
        domainLookup.set(qId, domain.label);
      });
    }
  });

  return {
    assessmentType: resolveAssessmentTypeKey(definition.type, definition.id),
    definitionId: definition.id,
    title: definition.name,
    description: definition.description ?? '',
    estimatedTime: definition.timeEstimate ?? null,
    timeframe: definition.timeframe ?? null,
    scoring,
    questions: definition.questions
      .sort((a, b) => a.order - b.order)
      .map((question) => ({
        id: question.id,
        text: question.text,
        responseType: question.responseType,
        uiType: mapResponseTypeToUi(question.responseType),
        reverseScored: reverseSet.has(question.id) || question.reverseScored || false,
        domain: question.domain || domainLookup.get(question.id) || null,
        options: question.options
          .sort((a, b) => a.order - b.order)
          .map((option) => {
            const numericValue =
              typeof option.value === 'number' && !Number.isNaN(option.value)
                ? option.value
                : option.order - 1;

            return {
              id: option.id,
              value: numericValue,
              text: option.text,
              order: option.order
            };
          })
      }))
  };
};

// Static catalog of supported assessments (could be stored in DB in future)
const ASSESSMENT_CATALOG = [
  { id: 'depression', title: 'Depression Assessment (PHQ-9)', questions: 9 },
  { id: 'anxiety', title: 'Anxiety Assessment (GAD-7)', questions: 7 },
  { id: 'stress', title: 'Stress Assessment (PSS-10)', questions: 10 },
  { id: 'overthinking', title: 'Overthinking (Perseverative Thinking Questionnaire - PTQ)', questions: 15 },
  { id: 'emotionalIntelligence', title: 'Emotional Intelligence (TEIQue-SF)', questions: 30 },
  { id: 'trauma', title: 'Trauma & Fear Response (PCL-5)', questions: 20 },
  { id: 'personality_mini_ipip', title: 'Personality (Mini-IPIP)', questions: 20 }
];

// Allow both old and new assessment type names for backward compatibility
const VALID_ASSESSMENT_TYPES = [
  ...ASSESSMENT_CATALOG.map(a => a.id),
  'anxiety_assessment', // Legacy name for anxiety assessment
  'depression_phq9',
  'phq9',
  'stress_pss10',
  'overthinking_brooding',
  'overthinking_ptq',
  'trauma_pcl5',
  'emotional_intelligence_ei10',
  'emotional_intelligence_teique',
  'personality',
  'mini_ipip',
  'personality_bigfive10',
  // Basic assessment types (short screening versions)
  'anxiety_gad2',
  'depression_phq2',
  'stress_pss4',
  'overthinking_rrs4',
  'trauma_pcptsd5',
  'emotional_intelligence_eq5'
];

const submitSchema = Joi.object({
  assessmentType: Joi.string().required(), // Accept any string - will validate against database
  responses: Joi.object().required(),
  responseDetails: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().required(),
        questionText: Joi.string().required(),
        answerLabel: Joi.string().allow('', null).default(''),
        answerValue: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).allow(null),
        answerScore: Joi.number().optional()
      })
    )
    .optional(),
  score: Joi.number().min(0).max(100).optional(),
  rawScore: Joi.number().optional(),
  maxScore: Joi.number().optional(),
  categoryBreakdown: Joi.object().optional()
});

export const listAssessments = async (_req: Request, res: Response) => {
  res.json({ success: true, data: ASSESSMENT_CATALOG });
};

/**
 * Get available assessments from database (excludes basic overall assessments)
 * Returns only active assessments that are visible in the main assessment list
 */
export const getAvailableAssessments = async (_req: Request, res: Response) => {
  try {
    const assessments = await prisma.assessmentDefinition.findMany({
      where: {
        isActive: true,
        visibleInMainList: true,
        isBasicOverallOnly: false,
        NOT: {
          id: 'basic_overall'
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        description: true,
        timeEstimate: true,
        tags: true,
        _count: {
          select: { questions: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    const formattedAssessments = assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.name,
      category: assessment.category,
      description: assessment.description,
      timeEstimate: assessment.timeEstimate || 'Not specified',
      type: resolveAssessmentTypeKey(assessment.type, assessment.id),
      questions: assessment._count?.questions ?? 0,
      tags: assessment.tags || 'all'
    }));

    res.json({ success: true, data: formattedAssessments });
  } catch (error) {
    console.error('Error fetching available assessments:', error);

    // Keep assessments discoverable if DB lookup fails.
    const fallbackAssessments = ASSESSMENT_CATALOG.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      category: 'mental_health',
      description: '',
      timeEstimate: 'Not specified',
      type: assessment.id,
      questions: assessment.questions,
      tags: 'all'
    }));

    res.json({ success: true, data: fallbackAssessments });
  }
};


export const getAssessmentTemplates = async (req: Request, res: Response) => {
  try {
    const typesParam = Array.isArray(req.query.types)
      ? req.query.types.join(',')
      : typeof req.query.types === 'string'
        ? req.query.types
        : '';

    const requestedTypes = typesParam
      ? typesParam.split(',').map((type) => type.trim()).filter(Boolean)
      : (Object.keys(ASSESSMENT_TEMPLATE_MAP) as TemplateBaseType[]);

    const templatesCacheKey = buildAssessmentTemplatesCacheKey(requestedTypes);
    const now = Date.now();
    const cachedTemplates = assessmentTemplatesCache.get(templatesCacheKey);

    if (cachedTemplates && cachedTemplates.expiresAt > now) {
      res.json({ success: true, data: { templates: cachedTemplates.templates } });
      return;
    }

    if (cachedTemplates) {
      assessmentTemplatesCache.delete(templatesCacheKey);
    }

    // Separate built-in types from custom/dynamic types
    const builtInTypes: TemplateBaseType[] = [];
    const customTypes: string[] = [];
    
    for (const type of requestedTypes) {
      const resolved = resolveTemplateType(type);
      if (resolved && resolved in ASSESSMENT_TEMPLATE_MAP) {
        builtInTypes.push(resolved);
      } else {
        // Treat as custom assessment type
        customTypes.push(type);
      }
    }

    const templates: any[] = [];

    // Fetch built-in assessment templates
    if (builtInTypes.length > 0) {
      const resolvedBaseTypes = Array.from(new Set(builtInTypes));
      const definitionIds = resolvedBaseTypes.map((type) => ASSESSMENT_TEMPLATE_MAP[type].definitionId);

      const definitions = await prisma.assessmentDefinition.findMany({
        where: { id: { in: definitionIds } },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' }
          }
        }
      });

      const definitionById = new Map(
        definitions.map((definition) => [definition.id, definition] as const)
      );

      const builtInTemplates = resolvedBaseTypes
        .map((baseType) => {
          const mapping = ASSESSMENT_TEMPLATE_MAP[baseType];
          const definition = definitionById.get(mapping.definitionId);
          if (!definition) {
            return null;
          }
          return formatAssessmentTemplate(baseType, definition);
        })
        .filter((template): template is ReturnType<typeof formatAssessmentTemplate> => template !== null);
      
      templates.push(...builtInTemplates);
    }

    // Fetch custom/dynamic assessment templates by type
    if (customTypes.length > 0) {
      const customCandidateMap = new Map<string, string[]>();
      const expandedCustomCandidates = new Set<string>();

      for (const customType of customTypes) {
        const normalized = customType.trim().toLowerCase();
        const expanded = Array.from(
          new Set([
            customType,
            normalized,
            ...(SHORT_FORM_DEFINITION_ID_ALIASES[normalized] ?? [])
          ])
        );

        customCandidateMap.set(customType, expanded);
        expanded.forEach((candidate) => expandedCustomCandidates.add(candidate));
      }

      const customDefinitions = await prisma.assessmentDefinition.findMany({
        where: {
          isActive: true,
          OR: [
            { type: { in: Array.from(expandedCustomCandidates) } },
            { id: { in: Array.from(expandedCustomCandidates) } }
          ]
        },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' }
          }
        }
      });

      const selectedDefinitionIds = new Set<string>();
      for (const requestedType of customTypes) {
        const candidates = customCandidateMap.get(requestedType) ?? [requestedType];
        const matchedDefinition = findDefinitionByCandidates(customDefinitions, candidates);
        if (!matchedDefinition || selectedDefinitionIds.has(matchedDefinition.id)) {
          continue;
        }

        templates.push(formatCustomAssessmentTemplate(matchedDefinition));
        selectedDefinitionIds.add(matchedDefinition.id);
      }
    }

    if (!templates.length) {
      res.status(404).json({ success: false, error: 'Assessment templates not found' });
      return;
    }

    assessmentTemplatesCache.set(templatesCacheKey, {
      templates,
      expiresAt: now + ASSESSMENT_TEMPLATES_CACHE_TTL_MS
    });

    res.json({ success: true, data: { templates } });
  } catch (error) {
    console.error('Get assessment templates error', error);
    res.status(500).json({ success: false, error: 'Unable to fetch assessment templates' });
  }
};

export const submitAssessment = async (req: any, res: Response) => {
  try {
    const { error } = submitSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

  const { assessmentType, responses, responseDetails, score, rawScore, maxScore, categoryBreakdown } = req.body;
    const userId = req.user.id;

    const verifiedScore = await verifyAssessmentSubmission(
      assessmentType,
      responses as Record<string, unknown>,
      typeof score === 'number' ? score : null,
      typeof rawScore === 'number' ? rawScore : null,
      typeof maxScore === 'number' ? maxScore : null,
      categoryBreakdown
    );

    const record = await prisma.assessmentResult.create({
      data: {
        userId,
        assessmentType,
        score: verifiedScore.score,
        normalizedScore: verifiedScore.score,
        responses: JSON.stringify(responses),
        rawScore: verifiedScore.rawScore,
        maxScore: verifiedScore.maxScore,
        ...(verifiedScore.categoryBreakdown
          ? { categoryScores: verifiedScore.categoryBreakdown as unknown as Prisma.JsonObject }
          : {})
      }
    });

    const [user, assessments] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, name: true }
      }),
      prisma.assessmentResult.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 100
      })
    ]);

    const detailedContext: AssessmentDetailContext[] = Array.isArray(responseDetails) && responseDetails.length > 0
      ? [{
          assessmentType,
          completedAt: record.completedAt.toISOString(),
          responses: responseDetails.map((detail: any) => ({
            questionId: detail.questionId,
            questionText: detail.questionText,
            answerLabel: typeof detail.answerLabel === 'string' ? detail.answerLabel : '',
            answerValue: detail.answerValue ?? null,
            answerScore: typeof detail.answerScore === 'number' ? detail.answerScore : undefined
          })),
          rawScore: verifiedScore.rawScore,
          maxScore: verifiedScore.maxScore,
          score: verifiedScore.score
        }]
      : [];

    const insightsPayload = await buildAssessmentInsights(
      assessments,
      {
        userName: user?.firstName || user?.name || null
      },
      detailedContext
    );

    const insightId = randomUUID();
    await prisma.assessmentInsight.upsert({
      where: { userId },
      update: {
        summary: insightsPayload as any,
        overallTrend: insightsPayload.insights.overallTrend,
        aiSummary: insightsPayload.insights.aiSummary,
        wellnessScore: insightsPayload.insights.wellnessScore?.value ?? 0,
        updatedAt: new Date()
      },
      create: {
        id: insightId,
        userId,
        summary: insightsPayload as any,
        overallTrend: insightsPayload.insights.overallTrend,
        aiSummary: insightsPayload.insights.aiSummary,
        wellnessScore: insightsPayload.insights.wellnessScore?.value ?? 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const enrichedAssessment =
      insightsPayload.history.find(item => item.id === record.id) ?? insightsPayload.history[0] ?? null;

    res.status(201).json({
      success: true,
      data: {
        assessment: enrichedAssessment,
        history: insightsPayload.history,
        insights: insightsPayload.insights
      }
    });
  } catch (e) {
    console.error('Submit assessment error', e);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const getAssessmentHistory = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const [user, latestAssessment, storedInsights] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, name: true }
      }),
      prisma.assessmentResult.findFirst({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true }
      }),
      prisma.assessmentInsight.findUnique({ where: { userId } })
    ]);

    let cachedInsights: AssessmentInsightsPayload | null = null;

    if (storedInsights?.summary) {
      try {
        let parsed: unknown = null;

        if (typeof storedInsights.summary === 'string') {
          const normalized = storedInsights.summary.trim();

          // Gracefully ignore legacy/broken values like "[object Object]".
          if (normalized.startsWith('{') || normalized.startsWith('[')) {
            parsed = JSON.parse(normalized);
          }
        } else {
          parsed = storedInsights.summary;
        }

        if (parsed && typeof parsed === 'object' && 'insights' in parsed) {
          cachedInsights = parsed as AssessmentInsightsPayload;
        }
      } catch (error) {
        console.info('Ignoring malformed cached assessment insights payload');
      }
    }

    if (cachedInsights && storedInsights?.updatedAt) {
      const cacheIsFreshForLatestAssessment =
        !latestAssessment ||
        storedInsights.updatedAt.getTime() >= latestAssessment.completedAt.getTime();

      if (cacheIsFreshForLatestAssessment) {
        res.json({
          success: true,
          data: {
            history: cachedInsights.history,
            insights: cachedInsights.insights
          }
        });
        return;
      }
    }

    const assessments = await prisma.assessmentResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 100
    });

    if (cachedInsights && assessments.length === 0) {
      res.json({
        success: true,
        data: {
          history: cachedInsights.history,
          insights: cachedInsights.insights
        }
      });
      return;
    }

    const insightsPayload = await buildAssessmentInsights(
      assessments,
      {
        userName: user?.firstName || user?.name || null
      }
    );

    const historyInsightId = randomUUID();
    await prisma.assessmentInsight.upsert({
      where: { userId },
      update: {
        summary: insightsPayload as any,
        overallTrend: insightsPayload.insights.overallTrend,
        aiSummary: insightsPayload.insights.aiSummary,
        wellnessScore: insightsPayload.insights.wellnessScore?.value ?? 0,
        updatedAt: new Date()
      },
      create: {
        id: historyInsightId,
        userId,
        summary: insightsPayload as any,
        overallTrend: insightsPayload.insights.overallTrend,
        aiSummary: insightsPayload.insights.aiSummary,
        wellnessScore: insightsPayload.insights.wellnessScore?.value ?? 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        history: insightsPayload.history,
        insights: insightsPayload.insights
      }
    });
  } catch (e) {
    console.error('Get assessment history error', e);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

const ASSESSMENT_REMINDER_THRESHOLD_DAYS = 21;

export const getAssessmentReminder = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const latestAssessment = await prisma.assessmentResult.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: {
        completedAt: true,
        assessmentType: true,
      }
    });

    if (!latestAssessment) {
      res.json({
        success: true,
        data: {
          shouldRemind: true,
          reason: 'first-assessment',
          thresholdDays: ASSESSMENT_REMINDER_THRESHOLD_DAYS,
          daysSinceLastAssessment: null,
          lastCompletedAt: null,
          lastAssessmentType: null,
          message: 'You have not taken an assessment yet. A quick check-in helps personalize your support plan.'
        }
      });
      return;
    }

    const now = Date.now();
    const completedAtMs = latestAssessment.completedAt.getTime();
    const daysSinceLastAssessment = Math.max(
      0,
      Math.floor((now - completedAtMs) / (1000 * 60 * 60 * 24))
    );

    const shouldRemind = daysSinceLastAssessment >= ASSESSMENT_REMINDER_THRESHOLD_DAYS;

    res.json({
      success: true,
      data: {
        shouldRemind,
        reason: shouldRemind ? 'stale-assessment' : 'recent-assessment',
        thresholdDays: ASSESSMENT_REMINDER_THRESHOLD_DAYS,
        daysSinceLastAssessment,
        lastCompletedAt: latestAssessment.completedAt.toISOString(),
        lastAssessmentType: latestAssessment.assessmentType,
        message: shouldRemind
          ? `It's been ${daysSinceLastAssessment} days since your last assessment. Retaking it can help track your progress.`
          : 'Your assessments are up to date.'
      }
    });
  } catch (error) {
    console.error('Get assessment reminder error', error);
    res.status(500).json({ success: false, error: 'Unable to get assessment reminder' });
  }
};

// Assessment Session Management Functions

export const startAssessmentSession = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { selectedTypes } = req.body;

    if (!Array.isArray(selectedTypes) || selectedTypes.length === 0) {
      res.status(400).json({ success: false, error: 'selectedTypes must be a non-empty array' });
      return;
    }

    const session = await prisma.assessmentSession.create({
      data: {
        userId,
        selectedTypes: selectedTypes as any,
        status: 'pending',
        startedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          selectedTypes: session.selectedTypes as string[],
          completedTypes: [],
          pendingTypes: session.selectedTypes as string[],
          startedAt: session.startedAt.toISOString(),
          completedAt: null,
          completedAssessments: []
        }
      }
    });
  } catch (error) {
    console.error('Start assessment session error', error);
    res.status(500).json({ success: false, error: 'Unable to start assessment session' });
  }
};

export const getActiveAssessmentSession = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const session = await prisma.assessmentSession.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'in_progress'] }
      },
      include: {
        assessments: {
          select: {
            id: true,
            assessmentType: true,
            score: true,
            completedAt: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    if (!session) {
      res.json({ success: true, data: null });
      return;
    }

    const selectedTypes = session.selectedTypes as string[];
    const completedTypes = session.assessments.map(a => a.assessmentType);
    const pendingTypes = selectedTypes.filter(t => !completedTypes.includes(t));

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          selectedTypes,
          completedTypes,
          pendingTypes,
          startedAt: session.startedAt.toISOString(),
          completedAt: session.completedAt?.toISOString() || null,
          completedAssessments: session.assessments
        }
      }
    });
  } catch (error) {
    console.error('Get active assessment session error', error);
    res.status(500).json({ success: false, error: 'Unable to get active session' });
  }
};

export const getAssessmentSessionById = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        assessments: {
          select: {
            id: true,
            assessmentType: true,
            score: true,
            completedAt: true
          }
        }
      }
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const selectedTypes = session.selectedTypes as string[];
    const completedTypes = session.assessments.map(a => a.assessmentType);
    const pendingTypes = selectedTypes.filter(t => !completedTypes.includes(t));

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          selectedTypes,
          completedTypes,
          pendingTypes,
          startedAt: session.startedAt.toISOString(),
          completedAt: session.completedAt?.toISOString() || null,
          completedAssessments: session.assessments
        }
      }
    });
  } catch (error) {
    console.error('Get assessment session by ID error', error);
    res.status(500).json({ success: false, error: 'Unable to get session' });
  }
};

export const updateAssessmentSessionStatus = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const updated = await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: {
        status,
        ...(status === 'completed' && { completedAt: new Date() })
      },
      include: {
        assessments: {
          select: {
            id: true,
            assessmentType: true,
            score: true,
            completedAt: true
          }
        }
      }
    });

    const selectedTypes = updated.selectedTypes as string[];
    const completedTypes = updated.assessments.map(a => a.assessmentType);
    const pendingTypes = selectedTypes.filter(t => !completedTypes.includes(t));

    res.json({
      success: true,
      data: {
        session: {
          id: updated.id,
          status: updated.status,
          selectedTypes,
          completedTypes,
          pendingTypes,
          startedAt: updated.startedAt.toISOString(),
          completedAt: updated.completedAt?.toISOString() || null,
          completedAssessments: updated.assessments
        }
      }
    });
  } catch (error) {
    console.error('Update assessment session status error', error);
    res.status(500).json({ success: false, error: 'Unable to update assessment session' });
  }
};

export const submitCombinedAssessments = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId, assessments: combinedAssessments } = req.body;

    if (!sessionId || !Array.isArray(combinedAssessments) || combinedAssessments.length === 0) {
      res.status(400).json({ 
        success: false, 
        error: 'Session ID and assessments array are required' 
      });
      return;
    }

    // Verify session belongs to user
    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, userId },
      include: { assessments: true }
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Assessment session not found' });
      return;
    }

    const verificationTypes = combinedAssessments
      .map((assessment: any) => (typeof assessment?.assessmentType === 'string' ? assessment.assessmentType : ''))
      .filter((assessmentType: string): assessmentType is string => assessmentType.trim().length > 0);

    if (verificationTypes.length > 0) {
      try {
        await preloadAssessmentDefinitionsForVerification(verificationTypes);
      } catch (error) {
        console.warn('Skipping bulk template preload during combined assessment verification', {
          verificationTypes,
          error
        });
      }
    }

    // Create all assessment results in a transaction
    const verifiedCombinedAssessments = await Promise.all(
      combinedAssessments.map(async (assessment: any) => {
        const verified = await verifyAssessmentSubmission(
          assessment.assessmentType,
          (assessment.responses ?? {}) as Record<string, unknown>,
          typeof assessment.score === 'number' ? assessment.score : null,
          typeof assessment.rawScore === 'number' ? assessment.rawScore : null,
          typeof assessment.maxScore === 'number' ? assessment.maxScore : null,
          assessment.categoryBreakdown
        );

        return {
          ...assessment,
          score: verified.score,
          rawScore: verified.rawScore,
          maxScore: verified.maxScore,
          categoryBreakdown: verified.categoryBreakdown
        };
      })
    );

    const createdAssessments = await prisma.$transaction(
      verifiedCombinedAssessments.map((assessment) => {
        const categoryScoresValue = assessment.categoryBreakdown
          ? (assessment.categoryBreakdown as unknown as Prisma.JsonObject)
          : undefined;

        return prisma.assessmentResult.create({
          data: {
            userId,
            assessmentType: assessment.assessmentType,
            score: assessment.score,
            normalizedScore: assessment.score,
            responses: JSON.stringify(assessment.responses || {}),
            rawScore: assessment.rawScore,
            maxScore: assessment.maxScore,
            ...(categoryScoresValue ? { categoryScores: categoryScoresValue } : {}),
            sessionId
          }
        });
      })
    );

    // Update session status to completed
    const updatedSession = await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date()
      },
      include: {
        assessments: {
          select: {
            id: true,
            assessmentType: true,
            score: true,
            completedAt: true
          }
        }
      }
    });

    // Fetch all assessments for insights
    const [user, allAssessments] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, name: true }
      }),
      prisma.assessmentResult.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 100
      })
    ]);

    // Build comprehensive insights
    const assessmentDetailContexts: AssessmentDetailContext[] = createdAssessments.reduce((accumulator: AssessmentDetailContext[], created, index) => {
      const requestAssessment = verifiedCombinedAssessments[index];
      if (!requestAssessment || !Array.isArray(requestAssessment.responseDetails) || requestAssessment.responseDetails.length === 0) {
        return accumulator;
      }

      accumulator.push({
        assessmentType: requestAssessment.assessmentType,
        completedAt: created.completedAt.toISOString(),
        responses: requestAssessment.responseDetails.map((detail: any) => ({
          questionId: detail.questionId,
          questionText: detail.questionText,
          answerLabel: typeof detail.answerLabel === 'string' ? detail.answerLabel : '',
          answerValue: detail.answerValue ?? null,
          answerScore: typeof detail.answerScore === 'number' ? detail.answerScore : undefined
        })),
        rawScore: typeof requestAssessment.rawScore === 'number' ? requestAssessment.rawScore : null,
        maxScore: typeof requestAssessment.maxScore === 'number' ? requestAssessment.maxScore : null,
        score: typeof requestAssessment.score === 'number' ? requestAssessment.score : undefined
      });

      return accumulator;
    }, []);

    const insightsPayload = await buildAssessmentInsights(
      allAssessments,
      {
        userName: user?.firstName || user?.name || null
      },
      assessmentDetailContexts
    );

    // Save wellness score to database for combined onboarding assessment
    const wellnessScoreValue = insightsPayload.insights.wellnessScore?.value ?? 0;
    const insightId = randomUUID();
    await prisma.assessmentInsight.upsert({
      where: { userId },
      update: {
        summary: insightsPayload as any,
        overallTrend: insightsPayload.insights.overallTrend,
        aiSummary: insightsPayload.insights.aiSummary,
        wellnessScore: wellnessScoreValue,
        updatedAt: new Date()
      },
      create: {
        id: insightId,
        userId,
        summary: insightsPayload as any,
        overallTrend: insightsPayload.insights.overallTrend,
        aiSummary: insightsPayload.insights.aiSummary,
        wellnessScore: wellnessScoreValue,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const selectedTypes = updatedSession.selectedTypes as string[];
    const completedTypes = updatedSession.assessments.map(a => a.assessmentType);
    const pendingTypes = selectedTypes.filter(t => !completedTypes.includes(t));

    res.json({
      success: true,
      data: {
        assessments: createdAssessments,
        session: {
          id: updatedSession.id,
          status: updatedSession.status,
          selectedTypes,
          completedTypes,
          pendingTypes,
          startedAt: updatedSession.startedAt.toISOString(),
          completedAt: updatedSession.completedAt?.toISOString() || null,
          completedAssessments: updatedSession.assessments
        },
        history: insightsPayload.history,
        insights: insightsPayload.insights
      }
    });
  } catch (error) {
    console.error('Submit combined assessments error', error);
    res.status(500).json({ 
      success: false, 
      error: 'Unable to save combined assessments' 
    });
  }
};

/**
 * Get available screening choices for the Basic Overall Assessment selection.
 * Fetches all active assessment definitions that have isBasicOverallOnly: true
 */
export const getOverallAssessmentOptions = async (_req: Request, res: Response) => {
  try {
    const assessments = await prisma.assessmentDefinition.findMany({
      where: {
        isActive: true,
        isBasicOverallOnly: true
      },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        description: true,
        timeEstimate: true,
        questions: {
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formatted = assessments.map((assessment) => ({
      id: resolveAssessmentTypeKey(assessment.type, assessment.id), // client correlates options by type (e.g. 'anxiety_gad2')
      title: assessment.name,
      category: assessment.category,
      description: assessment.description,
      questions: assessment.questions.length,
      estimatedTime: assessment.timeEstimate || '2 minutes'
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Get overall assessment options error:', error);
    res.status(500).json({ success: false, error: 'Unable to fetch overall assessment options' });
  }
};
