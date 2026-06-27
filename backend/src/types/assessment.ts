export type ScoringAlgorithm = 'SUM' | 'AVERAGE' | 'WEIGHTED_SUM' | 'CUSTOM_HOOK';

export interface InterpretationBand {
  minScore: number;
  maxScore: number;
  label: string;
  clinicalNote?: string;
}

export interface AssessmentDomain {
  id: string;
  label: string;
  description?: string;
  minScore: number;
  maxScore: number;
  interpretationBands: InterpretationBand[];
}

export interface AssessmentScoringConfig {
  algorithm: ScoringAlgorithm;
  customHookId?: string; // e.g., 'personality_mini_ipip', 'teique'
  minScore: number;
  maxScore: number;
  overallInterpretationBands: InterpretationBand[];
  domains?: AssessmentDomain[];
}
