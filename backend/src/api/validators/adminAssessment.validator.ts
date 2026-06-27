import { z } from 'zod';

/**
 * Validation schemas for Admin Assessment Management
 */

// Interpretation band schema
const interpretationBandSchema = z.object({
  max: z.number().min(0),
  label: z.string().min(1).max(100),
  color: z.string().optional() // hex color or color name
});

// Domain configuration schema (for complex assessments like PCL-5)
const domainSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  questionIds: z.array(z.string()),
  minScore: z.number().min(0),
  maxScore: z.number().min(0),
  interpretationBands: z.array(interpretationBandSchema).optional()
});

// Scoring configuration schema
export const scoringConfigSchema = z.object({
  minScore: z.number().min(0),
  maxScore: z.number().min(0),
  interpretationBands: z.array(interpretationBandSchema).min(1),
  reverseScored: z.array(z.string()).optional(), // Question IDs that are reverse-scored
  domains: z.array(domainSchema).optional(), // Optional domain-based scoring
  higherIsBetter: z.boolean().optional() // For EQ/positive assessments
});

// Response option schema
const responseOptionSchema = z.object({
  id: z.string().optional(), // Optional for creating new
  value: z.number(),
  text: z.string().min(1).max(200),
  order: z.number().int().min(1)
});

// Question schema
const questionSchema = z.object({
  id: z.string().optional(), // Optional for creating new
  text: z.string().min(5).max(500),
  order: z.number().int().min(1),
  responseType: z.enum(['likert', 'likert_5', 'binary', 'multiple_choice']),
  domain: z.string().max(50).optional(),
  reverseScored: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  options: z.array(responseOptionSchema).min(2)
});

// Create assessment schema
export const createAssessmentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(200),
    type: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/, 'Type must be lowercase with underscores only'),
    category: z.string().min(3).max(50),
    description: z.string().min(10).max(2000),
    timeEstimate: z.string().max(50).optional(),
    timeframe: z.string().max(100).optional().nullable(),
    scoringConfig: scoringConfigSchema,
    questions: z.array(questionSchema).min(1).max(100),
    isActive: z.boolean().optional(),
    isBasicOverallOnly: z.boolean().optional(),
    visibleInMainList: z.boolean().optional()
  })
});

// Update assessment schema (all fields optional except id in params)
export const updateAssessmentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(200).optional(),
    type: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/).optional(),
    category: z.string().min(3).max(50).optional(),
    description: z.string().min(10).max(2000).optional(),
    timeEstimate: z.string().max(50).optional(),
    timeframe: z.string().max(100).optional().nullable(),
    scoringConfig: scoringConfigSchema.optional(),
    questions: z.array(questionSchema).min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    isBasicOverallOnly: z.boolean().optional(),
    visibleInMainList: z.boolean().optional()
  })
});

// Query parameters for listing assessments
export const listAssessmentsQuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().optional()
  })
});

// Preview assessment request
export const previewAssessmentSchema = z.object({
  body: z.object({
    responses: z.record(z.string()) // questionId -> response value
  })
});

// Validation helper types
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;
export type InterpretationBand = z.infer<typeof interpretationBandSchema>;
export type Domain = z.infer<typeof domainSchema>;
export type Question = z.infer<typeof questionSchema>;
export type ResponseOption = z.infer<typeof responseOptionSchema>;
