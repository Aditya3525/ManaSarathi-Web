import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import {
  NotFoundError,
  BadRequestError,
  DatabaseError,
  ConflictError
} from '../../shared/errors/AppError';
import { ScoringConfig, Question as QuestionSchema } from '../../api/validators/adminAssessment.validator';
import { logActivity } from './activityLogController';

/**
 * Admin Assessment Management Controller
 * Handles CRUD operations for dynamic assessment creation
 */

// Helper: Calculate score for preview mode
const calculateAssessmentScore = (
  questions: any[],
  responses: Record<string, string>,
  scoringConfig: ScoringConfig
): {
  totalScore: number;
  normalizedScore: number;
  interpretation: string;
  domainScores?: Record<string, { score: number; normalized: number; interpretation: string }>;
} => {
  let totalScore = 0;
  const reverseSet = new Set(scoringConfig.reverseScored || []);
  const questionMap = new Map(questions.map(q => [q.id, q]));

  // Calculate total score
  for (const [questionId, responseValue] of Object.entries(responses)) {
    const question = questionMap.get(questionId);
    if (!question) continue;

    const option = question.options.find((opt: any) => String(opt.value) === String(responseValue));
    if (!option) continue;

    let score = Number(option.value);
    
    // Apply reverse scoring if applicable
    if (reverseSet.has(questionId)) {
      const maxOptionValue = Math.max(...question.options.map((opt: any) => opt.value));
      score = maxOptionValue - score;
    }

    totalScore += score;
  }

  // Normalize score to 0-100 scale
  const normalizedScore = scoringConfig.maxScore > 0 
    ? Math.round((totalScore / scoringConfig.maxScore) * 100)
    : 0;

  // Find interpretation
  const sortedBands = [...scoringConfig.interpretationBands].sort((a, b) => a.max - b.max);
  let interpretation = 'Unknown';
  for (const band of sortedBands) {
    if (totalScore <= band.max) {
      interpretation = band.label;
      break;
    }
  }

  // Calculate domain scores if domains are configured
  let domainScores: Record<string, any> | undefined;
  if (scoringConfig.domains && scoringConfig.domains.length > 0) {
    domainScores = {};
    
    for (const domain of scoringConfig.domains) {
      let domainScore = 0;
      
      for (const questionId of domain.questionIds) {
        const question = questionMap.get(questionId);
        if (!question || !responses[questionId]) continue;

        const option = question.options.find((opt: any) => String(opt.value) === String(responses[questionId]));
        if (!option) continue;

        let score = Number(option.value);
        if (reverseSet.has(questionId)) {
          const maxOptionValue = Math.max(...question.options.map((opt: any) => opt.value));
          score = maxOptionValue - score;
        }

        domainScore += score;
      }

      const domainNormalized = domain.maxScore > 0 
        ? Math.round((domainScore / domain.maxScore) * 100)
        : 0;

      let domainInterpretation = 'Unknown';
      if (domain.interpretationBands && domain.interpretationBands.length > 0) {
        const sortedDomainBands = [...domain.interpretationBands].sort((a, b) => a.max - b.max);
        for (const band of sortedDomainBands) {
          if (domainScore <= band.max) {
            domainInterpretation = band.label;
            break;
          }
        }
      }

      domainScores[domain.id] = {
        score: domainScore,
        normalized: domainNormalized,
        interpretation: domainInterpretation
      };
    }
  }

  return {
    totalScore,
    normalizedScore,
    interpretation,
    domainScores
  };
};

/**
 * GET /api/admin/assessments
 * List all assessments with filtering
 */
export const listAssessments = async (req: Request, res: Response) => {
  try {
    const { category, isActive, search } = req.query;

    const where: any = {};
    if (category) where.category = String(category);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { type: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const assessments = await prisma.assessmentDefinition.findMany({
      where,
      include: {
        questions: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = assessments.map(assessment => ({
      id: assessment.id,
      name: assessment.name,
      type: assessment.type,
      category: assessment.category,
      description: assessment.description,
      timeEstimate: assessment.timeEstimate,
      isActive: assessment.isActive,
      questionCount: assessment.questions.length,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('List assessments error:', error);
    throw new DatabaseError('Failed to fetch assessments');
  }
};

/**
 * GET /api/admin/assessments/:id
 * Get full assessment with questions and scoring
 */
export const getAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assessment = await prisma.assessmentDefinition.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!assessment) {
      throw new NotFoundError('Assessment');
    }

    // Parse scoring config
    let scoringConfig = null;
    if (assessment.scoringConfig) {
      try {
        scoringConfig = JSON.parse(assessment.scoringConfig);
      } catch (e) {
        console.warn('Failed to parse scoring config:', e);
      }
    }

    res.json({
      success: true,
      data: {
        ...assessment,
        scoringConfig,
        questions: assessment.questions.map(q => ({
          ...q,
          metadata: q.metadata ? JSON.parse(q.metadata) : null
        }))
      }
    });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Get assessment error:', error);
    throw new DatabaseError('Failed to fetch assessment');
  }
};

/**
 * POST /api/admin/assessments
 * Create new assessment
 */
export const createAssessment = async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      category,
      description,
      timeEstimate,
      timeframe,
      scoringConfig,
      questions,
      isActive = true,
      tags,
      isBasicOverallOnly = false,
      visibleInMainList = true
    } = req.body;

    // Check for duplicate type
    const existing = await prisma.assessmentDefinition.findFirst({
      where: { type }
    });

    if (existing) {
      throw new ConflictError('Assessment type already exists');
    }

    // Validate scoring config
    if (scoringConfig.maxScore <= 0) {
      throw new BadRequestError('Max score must be greater than 0');
    }

    // Get admin user ID from request
    const adminId = (req as any).admin?.id;

    // Create assessment with questions in transaction
    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessmentDefinition.create({
        data: {
          name,
          type,
          category,
          description,
          timeEstimate,
          timeframe,
          scoringConfig: JSON.stringify(scoringConfig),
          isActive,
          tags: tags || 'all',
          createdBy: adminId,
          isBasicOverallOnly,
          visibleInMainList
        }
      });

      // Create questions with options
      for (const question of questions) {
        const createdQuestion = await tx.assessmentQuestion.create({
          data: {
            assessmentId: created.id,
            text: question.text,
            order: question.order,
            responseType: question.responseType,
            domain: question.domain || null,
            reverseScored: question.reverseScored || false,
            metadata: question.metadata ? JSON.stringify(question.metadata) : null
          }
        });

        // Create options
        for (const option of question.options) {
          await tx.responseOption.create({
            data: {
              questionId: createdQuestion.id,
              value: option.value,
              text: option.text,
              order: option.order
            }
          });
        }
      }

      return created;
    });

    // Log activity
    const adminEmail = (req as any).admin?.email || 'unknown';
    await logActivity(
      adminEmail,
      'CREATE',
      'ASSESSMENT',
      assessment.id,
      assessment.name,
      { type: assessment.type, category, isActive },
      req
    );

    res.status(201).json({
      success: true,
      data: { id: assessment.id, type: assessment.type },
      message: 'Assessment created successfully'
    });
  } catch (error) {
    if (error instanceof ConflictError || error instanceof BadRequestError) throw error;
    console.error('Create assessment error:', error);
    throw new DatabaseError('Failed to create assessment');
  }
};

/**
 * PUT /api/admin/assessments/:id
 * Update assessment
 */
export const updateAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if assessment exists
    const existing = await prisma.assessmentDefinition.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('Assessment');
    }

    // If type is being changed, check for conflicts
    if (updateData.type && updateData.type !== existing.type) {
      const conflict = await prisma.assessmentDefinition.findFirst({
        where: { type: updateData.type, id: { not: id } }
      });

      if (conflict) {
        throw new ConflictError('Assessment type already exists');
      }
    }

    await prisma.$transaction(async (tx) => {
      // Prepare update data
      const data: any = {};
      if (updateData.name) data.name = updateData.name;
      if (updateData.type) data.type = updateData.type;
      if (updateData.category) data.category = updateData.category;
      if (updateData.description) data.description = updateData.description;
      if (updateData.timeEstimate !== undefined) data.timeEstimate = updateData.timeEstimate;
      if (updateData.timeframe !== undefined) data.timeframe = updateData.timeframe;
      if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
      if (updateData.tags !== undefined) data.tags = updateData.tags;
      if (updateData.scoringConfig) data.scoringConfig = JSON.stringify(updateData.scoringConfig);
      if (updateData.isBasicOverallOnly !== undefined) data.isBasicOverallOnly = updateData.isBasicOverallOnly;
      if (updateData.visibleInMainList !== undefined) data.visibleInMainList = updateData.visibleInMainList;

      // Update assessment
      await tx.assessmentDefinition.update({
        where: { id },
        data
      });

      // If questions are provided, replace all questions
      if (updateData.questions) {
        // Delete existing questions (cascade will delete options)
        await tx.assessmentQuestion.deleteMany({
          where: { assessmentId: id }
        });

        // Create new questions
        for (const question of updateData.questions) {
          const createdQuestion = await tx.assessmentQuestion.create({
            data: {
              assessmentId: id,
              text: question.text,
              order: question.order,
              responseType: question.responseType,
              domain: question.domain || null,
              reverseScored: question.reverseScored || false,
              metadata: question.metadata ? JSON.stringify(question.metadata) : null
            }
          });

          // Create options
          for (const option of question.options) {
            await tx.responseOption.create({
              data: {
                questionId: createdQuestion.id,
                value: option.value,
                text: option.text,
                order: option.order
              }
            });
          }
        }
      }
    });

    // Log activity
    const adminEmail = (req as any).admin?.email || 'unknown';
    const updatedAssessment = await prisma.assessmentDefinition.findUnique({ where: { id } });
    await logActivity(
      adminEmail,
      'UPDATE',
      'ASSESSMENT',
      id,
      updatedAssessment?.name || existing.name,
      { changes: Object.keys(updateData) },
      req
    );

    res.json({
      success: true,
      message: 'Assessment updated successfully'
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
    console.error('Update assessment error:', error);
    throw new DatabaseError('Failed to update assessment');
  }
};

/**
 * DELETE /api/admin/assessments/:id
 * Soft delete assessment (set isActive = false)
 */
export const deleteAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assessment = await prisma.assessmentDefinition.findUnique({
      where: { id }
    });

    if (!assessment) {
      throw new NotFoundError('Assessment');
    }

    // Soft delete - set isActive to false
    await prisma.assessmentDefinition.update({
      where: { id },
      data: { isActive: false }
    });

    // Log activity
    const adminEmail = (req as any).admin?.email || 'unknown';
    await logActivity(
      adminEmail,
      'DELETE',
      'ASSESSMENT',
      id,
      assessment.name,
      { type: assessment.type },
      req
    );

    res.json({
      success: true,
      message: 'Assessment deactivated successfully'
    });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Delete assessment error:', error);
    throw new DatabaseError('Failed to delete assessment');
  }
};

/**
 * POST /api/admin/assessments/:id/duplicate
 * Duplicate assessment as template
 */
export const duplicateAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const original = await prisma.assessmentDefinition.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!original) {
      throw new NotFoundError('Assessment');
    }

    const adminId = (req as any).admin?.id;

    // Create duplicate with "(Copy)" suffix
    const duplicate = await prisma.$transaction(async (tx) => {
      const created = await tx.assessmentDefinition.create({
        data: {
          name: `${original.name} (Copy)`,
          type: `${original.type}_copy_${Date.now()}`,
          category: original.category,
          description: original.description,
          timeEstimate: original.timeEstimate,
          timeframe: original.timeframe,
          scoringConfig: original.scoringConfig,
          isActive: false, // Duplicates start as inactive
          createdBy: adminId,
          isBasicOverallOnly: original.isBasicOverallOnly,
          visibleInMainList: original.visibleInMainList
        }
      });

      // Copy questions and options
      for (const question of original.questions) {
        const createdQuestion = await tx.assessmentQuestion.create({
          data: {
            assessmentId: created.id,
            text: question.text,
            order: question.order,
            responseType: question.responseType,
            domain: question.domain,
            reverseScored: question.reverseScored,
            metadata: question.metadata
          }
        });

        for (const option of question.options) {
          await tx.responseOption.create({
            data: {
              questionId: createdQuestion.id,
              value: option.value,
              text: option.text,
              order: option.order
            }
          });
        }
      }

      return created;
    });

    res.status(201).json({
      success: true,
      data: { id: duplicate.id, type: duplicate.type },
      message: 'Assessment duplicated successfully'
    });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Duplicate assessment error:', error);
    throw new DatabaseError('Failed to duplicate assessment');
  }
};

/**
 * POST /api/admin/assessments/:id/preview
 * Calculate score for preview/test mode
 */
export const previewAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { responses } = req.body;

    const assessment = await prisma.assessmentDefinition.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    if (!assessment) {
      throw new NotFoundError('Assessment');
    }

    if (!assessment.scoringConfig) {
      throw new BadRequestError('Assessment has no scoring configuration');
    }

    const scoringConfig = JSON.parse(assessment.scoringConfig);
    const result = calculateAssessmentScore(assessment.questions, responses, scoringConfig);

    res.json({
      success: true,
      data: {
        assessmentName: assessment.name,
        assessmentType: assessment.type,
        ...result
      }
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    console.error('Preview assessment error:', error);
    throw new DatabaseError('Failed to preview assessment');
  }
};

/**
 * GET /api/admin/assessments/categories
 * Get list of unique categories
 */
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const assessments = await prisma.assessmentDefinition.findMany({
      select: { category: true },
      distinct: ['category']
    });

    const categories = assessments.map(a => a.category).sort();

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    throw new DatabaseError('Failed to fetch categories');
  }
};
