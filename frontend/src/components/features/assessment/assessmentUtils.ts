import { AssessmentTrend } from '../../../services/api';

const sanitizeType = (type?: string): string =>
  (type ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const HIGHER_SCORE_BETTER_KEYS = [
  'emotionalintelligence',
  'teiquesf',
  'personality',
  'personalityminiipip',
];

export const isHigherScoreBetter = (type?: string): boolean => {
  const normalized = sanitizeType(type);
  if (!normalized) return false;
  return HIGHER_SCORE_BETTER_KEYS.some((pattern) => normalized.includes(pattern));
};

export const friendlyAssessmentLabel = (type: string): string => {
  switch (type) {
    case 'anxiety':
    case 'anxiety_assessment':
      return 'Anxiety';
    case 'basic_overall':
    case 'basicoverall':
      return 'Baseline Wellness Screening';
    case 'depression':
    case 'depression_phq9':
    case 'phq9':
      return 'Depression';
    case 'stress':
    case 'stress_pss10':
      return 'Stress';
    case 'emotionalIntelligence':
    case 'emotional-intelligence':
    case 'emotional_intelligence':
    case 'emotional_intelligence_teique':
    case 'emotional_intelligence_ei10':
    case 'emotional_intelligence_eq5':
    case 'teique_sf':
      return 'Emotional Intelligence';
    case 'overthinking':
    case 'overthinking_ptq':
    case 'overthinking_brooding':
      return 'Overthinking';
    case 'trauma-fear':
    case 'traumaFear':
    case 'trauma':
    case 'trauma_pcl5':
    case 'trauma_pcptsd5':
      return 'Trauma & Fear Response';
    case 'archetypes':
    case 'psychologicalArchetypes':
    case 'psychological_archetypes':
    case 'personality_mini_ipip':
    case 'personality':
      return 'Personality (Mini-IPIP)';
    case 'personality_bigfive10':
      return 'Personality Snapshot (Big Five)';
    default:
      return type
        .replace(/[-_]/g, ' ')
        .split(/(?=[A-Z])/)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[a-z]/, (match) => match.toUpperCase());
  }
};

export const trendLabelForType = (
  type: string | undefined,
  trend: AssessmentTrend | 'mixed'
): string => {
  if (trend === 'mixed') return 'Mixed';
  if (trend === 'baseline') return 'Initial Score';
  if (trend === 'stable') return 'Stable';

  const higherIsBetter = isHigherScoreBetter(type);

  if (trend === 'improving') {
    return 'Improving';
  }

  if (trend === 'declining') {
    return higherIsBetter ? 'Declining' : 'Worsening';
  }

  return trend;
};

export const trendColor = (trend: AssessmentTrend | 'mixed'): string => {
  switch (trend) {
    case 'improving':
      return 'text-emerald-600';
    case 'declining':
      return 'text-rose-600';
    case 'stable':
      return 'text-blue-600';
    case 'mixed':
      return 'text-amber-600';
    default:
      return 'text-slate-600';
  }
};

export const deltaClassForType = (
  type: string | undefined,
  change: number | null | undefined
): string => {
  if (change === null || change === undefined || change === 0) {
    return 'text-slate-500';
  }

  const higherIsBetter = isHigherScoreBetter(type);
  const positiveChange = change > 0;
  const isImprovement = higherIsBetter ? positiveChange : !positiveChange;

  return isImprovement ? 'text-emerald-600' : 'text-rose-600';
};
