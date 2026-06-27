/**
 * Assessment Validation Schemas
 */

import { z } from 'zod';

/**
 * Assessment Response Schema
 */
const assessmentResponseSchema = z.record(
  z.string(),
  z.union([z.number(), z.string(), z.boolean()])
);

/**
 * Submit Assessment Schema
 */
export const submitAssessmentSchema = z.object({
  body: z.object({
    assessmentType: z.string({
      required_error: 'Assessment type is required',
    }).min(1, 'Assessment type cannot be empty'),
    
    responses: assessmentResponseSchema.refine(
      (responses) => Object.keys(responses).length > 0,
      { message: 'At least one response is required' }
    ),
    
    sessionId: z.string().optional(),
    
    completedAt: z
      .string()
      .datetime('Invalid date format')
      .optional(),
  }),
});

/**
 * Start Assessment Session Schema
 */
export const startAssessmentSessionSchema = z.object({
  body: z.object({
    selectedTypes: z
      .array(z.string())
      .min(1, 'At least one assessment type must be selected')
      .max(10, 'Cannot select more than 10 assessment types'),
  }),
});

/**
 * Update Assessment Session Status Schema
 */
export const updateAssessmentSessionSchema = z.object({
  params: z.object({
    sessionId: z.string(),
  }),
  body: z.object({
    status: z.enum(['completed', 'cancelled'], {
      errorMap: () => ({ message: 'Status must be either "completed" or "cancelled"' }),
    }),
  }),
});

/**
 * Get Assessment History Schema
 */
export const getAssessmentHistorySchema = z.object({
  query: z.object({
    assessmentType: z.string().optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative number')
      .transform(Number)
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative',
      })
      .optional(),
  }),
});

/**
 * Get Assessment Templates Schema
 */
export const getAssessmentTemplatesSchema = z.object({
  query: z.object({
    types: z
      .string()
      .transform((val) => val.split(',').map((t) => t.trim()))
      .optional(),
  }),
});

/**
 * Export type inference helpers
 */
export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>['body'];
export type StartAssessmentSessionInput = z.infer<typeof startAssessmentSessionSchema>['body'];
export type UpdateAssessmentSessionInput = z.infer<typeof updateAssessmentSessionSchema>['body'];
export type GetAssessmentHistoryQuery = z.infer<typeof getAssessmentHistorySchema>['query'];
export type GetAssessmentTemplatesQuery = z.infer<typeof getAssessmentTemplatesSchema>['query'];
