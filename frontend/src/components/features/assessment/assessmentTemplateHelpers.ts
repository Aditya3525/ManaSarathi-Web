import { assessmentsApi, AssessmentTemplate } from '../../../services/api';

export interface AssessmentResponseDetail {
  questionId: string;
  questionText: string;
  answerLabel: string;
  answerValue: string;
  answerScore?: number;
}

export interface ComputedAssessmentScores {
  rawScore: number;
  normalizedScore: number;
  minScore: number;
  maxScore: number;
  interpretation?: string;
  categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation?: string }>;
}

const NORMALIZED_TYPE_MAP: Record<string, string> = {
  anxiety: 'anxiety_assessment',
  anxiety_assessment: 'anxiety_assessment',
  anxiety_gad2: 'anxiety_gad2',
  gad2: 'anxiety_gad2',
  depression: 'depression_phq9',
  depression_phq2: 'depression_phq2',
  depression_phq9: 'depression_phq9',
  phq2: 'depression_phq2',
  phq9: 'depression_phq9',
  stress: 'stress_pss10',
  stress_pss4: 'stress_pss4',
  stress_pss10: 'stress_pss10',
  pss4: 'stress_pss4',
  pss10: 'stress_pss10',
  overthinking: 'overthinking_ptq',
  overthinking_rrs4: 'overthinking_rrs4',
  overthinking_ptq: 'overthinking_ptq',
  rrs4: 'overthinking_rrs4',
  ptq: 'overthinking_ptq',
  trauma: 'trauma_pcl5',
  trauma_pcptsd5: 'trauma_pcptsd5',
  trauma_pcl5: 'trauma_pcl5',
  pcl5: 'trauma_pcl5',
  emotional_intelligence: 'emotional_intelligence_teique',
  emotional_intelligence_eq5: 'emotional_intelligence_eq5',
  emotional_intelligence_ei10: 'emotional_intelligence_teique',
  emotional_intelligence_teique: 'emotional_intelligence_teique',
  teique_sf: 'emotional_intelligence_teique',
  eq5: 'emotional_intelligence_eq5',
  personality: 'personality_mini_ipip',
  personality_bigfive10: 'personality_bigfive10',
  personality_mini_ipip: 'personality_mini_ipip',
  archetypes: 'personality_mini_ipip',
  mini_ipip: 'personality_mini_ipip',
  bigfive10: 'personality_bigfive10'
};

export const normalizeAssessmentType = (assessmentId: string): string => {
  const normalizedKey = assessmentId.trim().toLowerCase();
  return NORMALIZED_TYPE_MAP[normalizedKey] ?? normalizedKey;
};

export const loadAssessmentTemplate = async (assessmentId: string): Promise<AssessmentTemplate> => {
  const normalized = normalizeAssessmentType(assessmentId);
  const response = await assessmentsApi.getAssessmentTemplates([normalized]);

  if (!response.success || !response.data?.templates?.length) {
    throw new Error(`Unable to load assessment template for ${assessmentId}`);
  }

  return response.data.templates[0];
};

export const loadAssessmentTemplates = async (assessmentIds: string[]): Promise<Record<string, AssessmentTemplate>> => {
  const normalizedIds = Array.from(new Set(assessmentIds.map(normalizeAssessmentType)));
  if (!normalizedIds.length) {
    return {};
  }

  const response = await assessmentsApi.getAssessmentTemplates(normalizedIds);
  if (!response.success || !response.data?.templates) {
    throw new Error('Unable to load assessment templates');
  }

  const templateMap = new Map<string, AssessmentTemplate>();
  response.data.templates.forEach((template) => {
    templateMap.set(template.assessmentType, template);
  });

  const result: Record<string, AssessmentTemplate> = {};
  normalizedIds.forEach((id) => {
    const template = templateMap.get(id) ?? templateMap.get(normalizeAssessmentType(id));
    if (template) {
      result[id] = template;
    }
  });

  return result;
};

const toNumeric = (value: number | string | null | undefined, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeScore = (value: number, minScore: number, maxScore: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(minScore) || !Number.isFinite(maxScore) || maxScore === minScore) {
    return 0;
  }

  const bounded = Math.min(Math.max(value, minScore), maxScore);
  return Math.round(((bounded - minScore) / (maxScore - minScore)) * 1000) / 10;
};

const resolveInterpretation = (
  bands: Array<{ max: number; label: string }> | undefined,
  value: number
): string | undefined => {
  if (!bands || !bands.length) {
    return undefined;
  }
  for (const band of bands) {
    if (value <= band.max) {
      return band.label;
    }
  }
  return bands[bands.length - 1]?.label;
};

export const computeAssessmentScores = (
  template: AssessmentTemplate,
  answers: Record<string, string>
): ComputedAssessmentScores => {
  const reverseIds = new Set<string>(template.scoring.reverseScored ?? []);
  template.questions.forEach((question) => {
    if (question.reverseScored) {
      reverseIds.add(question.id);
    }
  });

  const questionMinMax = new Map<string, { min: number; max: number }>();
  template.questions.forEach((question) => {
    const numericValues = question.options.map((option) => toNumeric(option.value, option.order - 1));
    questionMinMax.set(question.id, {
      min: numericValues.length ? Math.min(...numericValues) : 0,
      max: numericValues.length ? Math.max(...numericValues) : 0
    });
  });

  let rawScore = 0;

  template.questions.forEach((question) => {
    const selectedOption = question.options.find((option) => String(option.value) === answers[question.id]);
    if (!selectedOption) {
      return;
    }

    const rawValue = toNumeric(selectedOption.value, selectedOption.order - 1);
    const { min, max } = questionMinMax.get(question.id) ?? { min: 0, max: 0 };

    const value = reverseIds.has(question.id) ? min + max - rawValue : rawValue;
    rawScore += value;
  });

  const minScore = toNumeric(template.scoring.minScore, 0);
  const maxScore = toNumeric(template.scoring.maxScore, rawScore);
  const normalizedScore = normalizeScore(rawScore, minScore, maxScore);

  const categoryBreakdown: Record<string, { raw: number; normalized: number; interpretation?: string }> = {};

  if (Array.isArray(template.scoring.domains)) {
    template.scoring.domains.forEach((domain) => {
      let domainRaw = 0;
      const items = (domain.items && domain.items.length > 0)
        ? domain.items
        : template.questions
            .filter((q) => q.domain === domain.id || q.domain === domain.label)
            .map((q) => q.id);

      items.forEach((itemId) => {
        const selectedOption = template.questions
          .find((question) => question.id === itemId)?.options
          .find((option) => String(option.value) === answers[itemId]);

        if (!selectedOption) {
          return;
        }

        const rawValue = toNumeric(selectedOption.value, selectedOption.order - 1);
        const { min, max } = questionMinMax.get(itemId) ?? { min: 0, max: 0 };
        const value = reverseIds.has(itemId) ? min + max - rawValue : rawValue;
        domainRaw += value;
      });

      const normalized = normalizeScore(domainRaw, toNumeric(domain.minScore, 0), toNumeric(domain.maxScore, domainRaw));
      const interpretation = resolveInterpretation(domain.interpretationBands, domainRaw);

      categoryBreakdown[domain.id] = {
        raw: Math.round(domainRaw * 10) / 10,
        normalized,
        interpretation
      };
    });
  }

  const overallInterpretation = resolveInterpretation(template.scoring.interpretationBands, rawScore);

  if (Object.keys(categoryBreakdown).length === 0) {
    categoryBreakdown.overall = {
      raw: Math.round(rawScore * 10) / 10,
      normalized: normalizedScore,
      interpretation: overallInterpretation
    };
  } else {
    categoryBreakdown.overall = {
      raw: Math.round(rawScore * 10) / 10,
      normalized: normalizedScore,
      interpretation: overallInterpretation
    };
  }

  return {
    rawScore: Math.round(rawScore * 10) / 10,
    normalizedScore,
    minScore,
    maxScore,
    interpretation: overallInterpretation,
    categoryBreakdown
  };
};

export const buildResponseDetails = (
  template: AssessmentTemplate,
  answers: Record<string, string>
): AssessmentResponseDetail[] => {
  return template.questions.reduce<AssessmentResponseDetail[]>((details, question) => {
    const value = answers[question.id];
    if (value === undefined) {
      return details;
    }

    const selectedOption = question.options.find((option) => String(option.value) === value);
    if (!selectedOption) {
      return details;
    }

    details.push({
      questionId: question.id,
      questionText: question.text,
      answerLabel: selectedOption.text,
      answerValue: String(selectedOption.value),
      answerScore: toNumeric(selectedOption.value, selectedOption.order - 1)
    });
    return details;
  }, []);
};
