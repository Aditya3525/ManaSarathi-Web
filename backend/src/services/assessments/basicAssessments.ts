export interface AssessmentScoreResult {
  rawScore: number;
  maxScore: number;
  normalizedScore: number;
  normalizedScoreRounded: number;
  interpretation: string;
  categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation?: string }>;
}

type ResponseMap = Record<string, unknown>;

const roundTo = (value: number, precision = 1) => {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
};

const ensureNumeric = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return fallback;
};

const getRawResponseValue = (responses: ResponseMap, id: string): unknown => {
  const match = Object.keys(responses).find((k) => k.endsWith(id));
  return match ? responses[match] : responses[id];
};

const normalize = (raw: number, min: number, max: number): number => {
  if (max === min) return 0;
  const bounded = Math.min(Math.max(raw, min), max);
  return ((bounded - min) / (max - min)) * 100;
};

const yesNoToNumber = (value: unknown): number => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['yes', 'y', 'true', '1'].includes(normalized)) return 1;
    if (['no', 'n', 'false', '0'].includes(normalized)) return 0;
  }
  if (typeof value === 'number') {
    if (value <= 0) return 0;
    return 1;
  }
  return 0;
};

const buildInterpretation = (score: number, thresholds: Array<{ max: number; message: string }>, fallback: string) => {
  for (const band of thresholds) {
    if (score <= band.max) {
      return band.message;
    }
  }
  return fallback;
};

const TEIQUE_REVERSE_ITEM_IDS = new Set([
  'teique_q2',
  'teique_q4',
  'teique_q5',
  'teique_q7',
  'teique_q8',
  'teique_q10',
  'teique_q12',
  'teique_q13',
  'teique_q14',
  'teique_q16',
  'teique_q18',
  'teique_q22',
  'teique_q25',
  'teique_q26',
  'teique_q28'
]);

export const scorePhq2 = (responses: ResponseMap): AssessmentScoreResult => {
  const items = ['phq2_q1', 'phq2_q2'];
  const scores = items.map((id) => ensureNumeric(responses[id]));
  if (scores.some((score) => Number.isNaN(score))) {
    throw new Error('Invalid PHQ-2 responses');
  }

  const rawScore = scores.reduce((sum, value) => sum + Math.min(Math.max(value, 0), 3), 0);
  const maxScore = 6;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 2, message: 'Minimal depressive symptoms' },
    { max: 4, message: 'Mild depressive symptoms—monitor and care for your mood.' }
  ], 'Elevated depressive symptoms—consider speaking with a professional.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scoreGad2 = (responses: ResponseMap): AssessmentScoreResult => {
  const items = ['gad2_q1', 'gad2_q2'];
  const scores = items.map((id) => ensureNumeric(responses[id]));
  if (scores.some((score) => Number.isNaN(score))) {
    throw new Error('Invalid GAD-2 responses');
  }

  const rawScore = scores.reduce((sum, value) => sum + Math.min(Math.max(value, 0), 3), 0);
  const maxScore = 6;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 2, message: 'Minimal anxiety symptoms' },
    { max: 4, message: 'Mild anxiety—use grounding or breathing practices.' }
  ], 'Elevated anxiety—consider deeper support or coping strategies.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scorePhq9 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 9 }, (_, index) => `phq9_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid PHQ-9 responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 0), 3));
  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const maxScore = ids.length * 3;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 4, message: 'Minimal depressive symptoms.' },
    { max: 9, message: 'Mild depressive symptoms—continue supportive routines.' },
    { max: 14, message: 'Moderate depressive symptoms—consider additional support.' },
    { max: 19, message: 'Moderately severe depressive symptoms—reach out to a professional.' }
  ], 'Severe depressive symptoms—seek professional care promptly.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scorePss4 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = ['pss4_q1', 'pss4_q2', 'pss4_q3', 'pss4_q4'];
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid PSS-4 responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 0), 4));
  // Reverse score questions 2 and 3
  const adjusted = bounded.map((value, index) => {
    if (index === 1 || index === 2) {
      return 4 - value;
    }
    return value;
  });

  const rawScore = adjusted.reduce((sum, value) => sum + value, 0);
  const maxScore = 16;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 4, message: 'Low perceived stress—keep reinforcing supportive routines.' },
    { max: 8, message: 'Moderate stress—notice triggers and schedule recovery time.' },
    { max: 12, message: 'High stress load—prioritise rest, boundaries, and support.' }
  ], 'Very high stress—consider additional help to rebalance.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scorePss10 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 10 }, (_, index) => `pss10_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid PSS-10 responses');
  }

  const maxPerItem = 4;
  const minPerItem = 0;
  const reverseSet = new Set(['pss10_q4', 'pss10_q5', 'pss10_q6', 'pss10_q7', 'pss10_q9']);

  const adjusted = rawValues.map((value, index) => {
    const bounded = Math.min(Math.max(value, minPerItem), maxPerItem);
    const questionId = ids[index];
    if (reverseSet.has(questionId)) {
      return minPerItem + maxPerItem - bounded;
    }
    return bounded;
  });

  const rawScore = adjusted.reduce((sum, value) => sum + value, 0);
  const maxScore = maxPerItem * ids.length;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 13, message: 'Low perceived stress—keep nurturing your coping strategies.' },
    { max: 26, message: 'Moderate stress—notice patterns and schedule recovery time.' }
  ], 'High stress—prioritise support and restorative practices.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scoreRrs4 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = ['rrs4_q1', 'rrs4_q2', 'rrs4_q3', 'rrs4_q4'];
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid RRS-4 responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 1), 4));
  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const minScore = 4;
  const maxScore = 16;
  const normalizedScore = normalize(rawScore, minScore, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 7, message: 'Low rumination—thought patterns recover easily.' },
    { max: 11, message: 'Moderate rumination—use journaling or grounding to reset loops.' }
  ], 'High rumination—practice cognitive reframing or seek support.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scoreBrooding = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 5 }, (_, index) => `brooding_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid Brooding Subscale responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 1), 4));
  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const minScore = ids.length * 1;
  const maxScore = ids.length * 4;
  const normalizedScore = normalize(rawScore, minScore, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 10, message: 'Low brooding—helpful thought shifting skills present.' },
    { max: 15, message: 'Moderate brooding—notice loops and practise gentle redirection.' }
  ], 'High brooding—use grounding or reframing tools and consider extra support.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scorePtq = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 15 }, (_, index) => `ptq_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid PTQ responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 0), 4));
  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const maxScore = ids.length * 4;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 15, message: 'Low repetitive negative thinking.' },
    { max: 30, message: 'Moderate repetitive negative thinking—monitor thought loops.' },
    { max: 45, message: 'High repetitive negative thinking—use grounding or reframing supports.' }
  ], 'Very high repetitive negative thinking—consider structured cognitive support.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scorePcptsd5 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = ['pcptsd5_q1', 'pcptsd5_q2', 'pcptsd5_q3', 'pcptsd5_q4', 'pcptsd5_q5'];
  const rawScore = ids.reduce((sum, id) => sum + yesNoToNumber(responses[id]), 0);
  const maxScore = 5;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 1, message: 'Minimal trauma activation at the moment.' },
    { max: 3, message: 'Notable trauma reminders—monitor and practice grounding.' }
  ], 'High trauma activation—consider professional trauma-informed support.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scorePcl5 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 20 }, (_, index) => `pcl5_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid PCL-5 responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 0), 4));
  const boundedMap = ids.reduce<Record<string, number>>((acc, id, index) => {
    acc[id] = bounded[index];
    return acc;
  }, {});

  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const maxScore = ids.length * 4;
  const normalizedScore = normalize(rawScore, 0, maxScore);

  const interpretation = buildInterpretation(rawScore, [
    { max: 19, message: 'Minimal trauma-related distress at present.' },
    { max: 39, message: 'Mild trauma activation—monitor triggers and practise grounding.' },
    { max: 59, message: 'Moderate trauma activation—consider structured support.' }
  ], 'Severe trauma activation—seek trauma-informed professional care.');

  type DomainKey = 'intrusion' | 'avoidance' | 'mood' | 'arousal';

  const DOMAIN_MAP: Record<DomainKey, string[]> = {
    intrusion: ['pcl5_q1', 'pcl5_q2', 'pcl5_q3', 'pcl5_q4', 'pcl5_q5'],
    avoidance: ['pcl5_q6', 'pcl5_q7'],
    mood: ['pcl5_q8', 'pcl5_q9', 'pcl5_q10', 'pcl5_q11', 'pcl5_q12', 'pcl5_q13', 'pcl5_q14'],
    arousal: ['pcl5_q15', 'pcl5_q16', 'pcl5_q17', 'pcl5_q18', 'pcl5_q19', 'pcl5_q20']
  };

  const domainLabels: Record<DomainKey, string> = {
    intrusion: 'Intrusion',
    avoidance: 'Avoidance',
    mood: 'Negative Mood & Cognition',
    arousal: 'Arousal & Reactivity'
  };

  const domainBreakdown = Object.entries(DOMAIN_MAP).reduce<Record<string, { raw: number; normalized: number; interpretation: string }>>(
    (acc, [domain, questionIds]) => {
  const domainRaw = questionIds.reduce((sum, id) => sum + (boundedMap[id] ?? 0), 0);
      const domainMax = questionIds.length * 4;
      const domainNormalized = normalize(domainRaw, 0, domainMax);
      const domainInterpretation = buildInterpretation(domainRaw, [
        { max: Math.round(domainMax * 0.33), message: 'Low activation in this cluster.' },
        { max: Math.round(domainMax * 0.66), message: 'Moderate activation to track.' }
      ], 'High activation—apply grounding tools and seek support.');

      acc[domainLabels[domain as DomainKey]] = {
        raw: roundTo(domainRaw, 2),
        normalized: roundTo(domainNormalized),
        interpretation: domainInterpretation
      };
      return acc;
    },
    {}
  );

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation,
    categoryBreakdown: domainBreakdown
  };
};

export const scoreEq5 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = ['eq5_q1', 'eq5_q2', 'eq5_q3', 'eq5_q4', 'eq5_q5'];
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid EQ-5 responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 1), 5));
  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const minScore = 5;
  const maxScore = 25;
  const normalizedScore = normalize(rawScore, minScore, maxScore);

  const interpretation = buildInterpretation(normalizedScore, [
    { max: 49, message: 'Developing emotional intelligence—practice naming feelings and needs.' },
    { max: 74, message: 'Balanced emotional skills—keep reinforcing your strategies.' }
  ], 'Robust emotional intelligence—share and teach your tools!');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation
  };
};

export const scoreEi10 = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 10 }, (_, index) => `ei10_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(responses[id]));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid Emotional Intelligence responses');
  }

  const bounded = rawValues.map((value) => Math.min(Math.max(value, 1), 5));
  const rawScore = bounded.reduce((sum, value) => sum + value, 0);
  const minScore = ids.length * 1;
  const maxScore = ids.length * 5;
  const normalizedScore = normalize(rawScore, minScore, maxScore);

  const averageScore = rawScore / ids.length;

  const interpretation = buildInterpretation(averageScore, [
    { max: 2.4, message: 'Developing emotional intelligence—keep practising awareness and regulation skills.' },
    { max: 3.4, message: 'Balanced emotional skills—notice where you shine most.' }
  ], 'Strong emotional intelligence—consider sharing your strategies with others.');

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation,
    categoryBreakdown: {
      overall: {
        raw: roundTo(averageScore, 2),
        normalized: roundTo(normalizedScore),
        interpretation
      }
    }
  };
};

export const scoreTeique = (responses: ResponseMap): AssessmentScoreResult => {
  const ids = Array.from({ length: 30 }, (_, index) => `teique_q${index + 1}`);
  const rawValues = ids.map((id) => ensureNumeric(getRawResponseValue(responses, id)));
  if (rawValues.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid TEIQue responses');
  }

  const adjusted = rawValues.map((value, index) => {
    const bounded = Math.min(Math.max(value, 1), 7);
    const questionId = ids[index];
    if (TEIQUE_REVERSE_ITEM_IDS.has(questionId)) {
      return 8 - bounded;
    }
    return bounded;
  });

  const rawScore = adjusted.reduce((sum, value) => sum + value, 0);
  const minScore = ids.length * 1;
  const maxScore = ids.length * 7;
  const normalizedScore = normalize(rawScore, minScore, maxScore);
  const averageScore = rawScore / ids.length;

  let interpretation = 'Average trait emotional intelligence—continue practising awareness and regulation.';
  if (averageScore >= 5) {
    interpretation = 'High trait emotional intelligence—leverage these strengths to support yourself and others.';
  } else if (averageScore < 3) {
    interpretation = 'Low trait emotional intelligence—focus on naming emotions and gentle regulation tools.';
  }

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation,
    categoryBreakdown: {
      overall: {
        raw: roundTo(averageScore, 2),
        normalized: roundTo(normalizedScore),
        interpretation
      }
    }
  };
};

type TraitKey = 'extraversion' | 'conscientiousness' | 'neuroticism' | 'openness' | 'agreeableness';

const BIG_FIVE_QUESTIONS: Record<string, { trait: TraitKey; reverse?: boolean }> = {
  bigfive_q1: { trait: 'extraversion' },
  bigfive_q2: { trait: 'conscientiousness', reverse: true },
  bigfive_q3: { trait: 'neuroticism' },
  bigfive_q4: { trait: 'openness' },
  bigfive_q5: { trait: 'agreeableness' }
};

const MINI_IPIP_ITEMS: Array<{ id: string; trait: TraitKey; reverse?: boolean }> = [
  { id: 'mini_ipip_q1', trait: 'extraversion' },
  { id: 'mini_ipip_q2', trait: 'extraversion' },
  { id: 'mini_ipip_q3', trait: 'extraversion', reverse: true },
  { id: 'mini_ipip_q4', trait: 'extraversion', reverse: true },
  { id: 'mini_ipip_q5', trait: 'agreeableness' },
  { id: 'mini_ipip_q6', trait: 'agreeableness' },
  { id: 'mini_ipip_q7', trait: 'agreeableness', reverse: true },
  { id: 'mini_ipip_q8', trait: 'agreeableness', reverse: true },
  { id: 'mini_ipip_q9', trait: 'conscientiousness' },
  { id: 'mini_ipip_q10', trait: 'conscientiousness' },
  { id: 'mini_ipip_q11', trait: 'conscientiousness', reverse: true },
  { id: 'mini_ipip_q12', trait: 'conscientiousness', reverse: true },
  { id: 'mini_ipip_q13', trait: 'neuroticism' },
  { id: 'mini_ipip_q14', trait: 'neuroticism' },
  { id: 'mini_ipip_q15', trait: 'neuroticism', reverse: true },
  { id: 'mini_ipip_q16', trait: 'neuroticism', reverse: true },
  { id: 'mini_ipip_q17', trait: 'openness' },
  { id: 'mini_ipip_q18', trait: 'openness', reverse: true },
  { id: 'mini_ipip_q19', trait: 'openness' },
  { id: 'mini_ipip_q20', trait: 'openness', reverse: true }
];

const traitLabel = (trait: TraitKey) => {
  switch (trait) {
    case 'extraversion':
      return 'Extraversion';
    case 'conscientiousness':
      return 'Conscientiousness';
    case 'neuroticism':
      return 'Emotional Stability';
    case 'openness':
      return 'Openness';
    case 'agreeableness':
      return 'Agreeableness';
  }
};

const traitInterpretation = (trait: TraitKey, normalized: number): string => {
  if (normalized >= 70) {
    return `${traitLabel(trait)} is a key strength.`;
  }
  if (normalized >= 40) {
    return `${traitLabel(trait)} is balanced—notice situations where it fluctuates.`;
  }
  return `${traitLabel(trait)} could use nurturing—reflect on habits that support it.`;
};

export const scoreBigFive = (responses: ResponseMap): AssessmentScoreResult => {
  const traitTotals: Record<TraitKey, { raw: number; normalized: number }> = {
    extraversion: { raw: 0, normalized: 0 },
    conscientiousness: { raw: 0, normalized: 0 },
    neuroticism: { raw: 0, normalized: 0 },
    openness: { raw: 0, normalized: 0 },
    agreeableness: { raw: 0, normalized: 0 }
  };

  let completed = 0;
  let aggregateNormalized = 0;
  let aggregateRaw = 0;

  Object.entries(BIG_FIVE_QUESTIONS).forEach(([id, meta]) => {
    const value = ensureNumeric(responses[id], NaN);
    if (Number.isNaN(value)) {
      throw new Error('Invalid Big Five responses');
    }
    const bounded = Math.min(Math.max(value, 1), 5);
    const adjusted = meta.reverse ? 6 - bounded : bounded;
    const normalized = normalize(adjusted, 1, 5);

    traitTotals[meta.trait] = {
      raw: adjusted,
      normalized: roundTo(normalized)
    };

    aggregateNormalized += normalized;
    aggregateRaw += adjusted;
    completed += 1;
  });

  const normalizedScore = completed > 0 ? aggregateNormalized / completed : 0;
  const maxScore = 25;
  const rawScore = aggregateRaw;

  const interpretation = buildInterpretation(normalizedScore, [
    { max: 49, message: 'Personality traits are still taking shape—reflect on what energizes or drains you.' },
    { max: 74, message: 'Balanced trait expression—notice contexts that bring out your strengths.' }
  ], 'Strong, well-rounded trait expression—leverage these strengths in your routines.');

  const categoryBreakdown = Object.entries(traitTotals).reduce<Record<string, { raw: number; normalized: number; interpretation: string }>>((acc, [trait, scores]) => {
    acc[trait] = {
      raw: roundTo(scores.raw, 2),
      normalized: scores.normalized,
      interpretation: traitInterpretation(trait as TraitKey, scores.normalized)
    };
    return acc;
  }, {});

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation,
    categoryBreakdown
  };
};

export const scoreMiniIpip = (responses: ResponseMap): AssessmentScoreResult => {
  const traitTotals: Record<TraitKey, { sum: number; count: number }> = {
    extraversion: { sum: 0, count: 0 },
    conscientiousness: { sum: 0, count: 0 },
    neuroticism: { sum: 0, count: 0 },
    openness: { sum: 0, count: 0 },
    agreeableness: { sum: 0, count: 0 }
  };

  MINI_IPIP_ITEMS.forEach(({ id, trait, reverse }) => {
    const value = ensureNumeric(getRawResponseValue(responses, id), NaN);
    if (Number.isNaN(value)) {
      throw new Error('Invalid Mini-IPIP responses');
    }
    const bounded = Math.min(Math.max(value, 1), 5);
    const adjusted = reverse ? 6 - bounded : bounded;
    traitTotals[trait].sum += adjusted;
    traitTotals[trait].count += 1;
  });

  const totalItems = MINI_IPIP_ITEMS.length;
  const rawScore = Object.values(traitTotals).reduce((sum, { sum: traitSum }) => sum + traitSum, 0);
  const minScore = totalItems * 1;
  const maxScore = totalItems * 5;
  const normalizedScore = normalize(rawScore, minScore, maxScore);
  const overallAverage = rawScore / totalItems;

  const interpretTraitAverage = (average: number, trait: TraitKey) => {
    if (average >= 4) {
      return `High expression of ${traitLabel(trait).toLowerCase()}.`;
    }
    if (average <= 2) {
      return `Subtle expression of ${traitLabel(trait).toLowerCase()}.`;
    }
    return `Balanced expression of ${traitLabel(trait).toLowerCase()}.`;
  };

  let overallInterpretation = 'Balanced personality profile across traits—notice where you feel most at ease.';
  if (overallAverage >= 4) {
    overallInterpretation = 'Highly expressed personality traits—leverage them intentionally.';
  } else if (overallAverage <= 2) {
    overallInterpretation = 'Reserved personality expression—experiment with environments that feel energising.';
  }

  const categoryBreakdown = Object.entries(traitTotals).reduce<Record<string, { raw: number; normalized: number; interpretation: string }>>((acc, [trait, totals]) => {
    if (totals.count === 0) return acc;
    const average = totals.sum / totals.count;
    const normalizedTrait = normalize(average, 1, 5);
    acc[trait] = {
      raw: roundTo(average, 2),
      normalized: roundTo(normalizedTrait),
      interpretation: interpretTraitAverage(average, trait as TraitKey)
    };
    return acc;
  }, {});

  categoryBreakdown.overall = {
    raw: roundTo(overallAverage, 2),
    normalized: roundTo(normalizedScore),
    interpretation: overallInterpretation
  };

  return {
    rawScore,
    maxScore,
    normalizedScore,
    normalizedScoreRounded: roundTo(normalizedScore),
    interpretation: overallInterpretation,
    categoryBreakdown
  };
};

export const SCORE_HANDLERS: Record<string, (responses: ResponseMap) => AssessmentScoreResult> = {
  depression_phq2: scorePhq2,
  depression_phq9: scorePhq9,
  depression: scorePhq9,
  phq9: scorePhq9,
  anxiety_gad2: scoreGad2,
  stress_pss4: scorePss4,
  stress_pss10: scorePss10,
  stress: scorePss10,
  overthinking_rrs4: scoreRrs4,
  overthinking_brooding: scoreBrooding,
  overthinking_ptq: scorePtq,
  overthinking: scorePtq,
  ptq: scorePtq,
  trauma_pcptsd5: scorePcptsd5,
  trauma_pcl5: scorePcl5,
  trauma: scorePcl5,
  emotional_intelligence_eq5: scoreEq5,
  emotional_intelligence_ei10: scoreEi10,
  emotional_intelligence_teique: scoreTeique,
  emotional_intelligence: scoreTeique,
  emotionalIntelligence: scoreTeique,
  teique_sf: scoreTeique,
  personality_bigfive10: scoreBigFive,
  personality_mini_ipip: scoreMiniIpip,
  personality: scoreMiniIpip,
  mini_ipip: scoreMiniIpip
};
