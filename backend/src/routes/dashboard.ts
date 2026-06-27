import express, { Request, Response } from 'express';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { buildAssessmentInsights } from '../services/assessmentInsightsService';
import { recommendationService } from '../services/recommendationService';
import { EnhancedInsightsService } from '../services/enhancedInsightsService';
import { getAdaptiveNudges } from '../services/notificationService';
import { getCommunityInsights } from '../services/communityInsightsService';
import { dashboardModeService } from '../services/dashboardModeService';

const router = express.Router();
const prisma = new PrismaClient();
const enhancedInsightsService = new EnhancedInsightsService();

// All routes require authentication
router.use(authenticate as any);

/**
 * GET /api/dashboard/summary
 * Get comprehensive dashboard data for the authenticated user
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        approach: true,
        birthday: true,
        region: true,
        emergencyContact: true,
        emergencyPhone: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch assessment insights
    const assessments = await prisma.assessmentResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20
    });

    const assessmentInsights = assessments.length > 0
      ? await buildAssessmentInsights(assessments, { userName: user.firstName || user.name })
      : null;

    // Fetch recent mood entries
    const recentMoods = await prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 7
    });

    // Calculate weekly stats
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [weeklyPractices, weeklyMoodEntries, weeklyAssessments] = await Promise.all([
      prisma.userPlanModule.count({
        where: {
          userId,
          completed: true,
          completedAt: { gte: weekAgo }
        }
      }),
      prisma.moodEntry.count({
        where: {
          userId,
          createdAt: { gte: weekAgo }
        }
      }),
      prisma.assessmentResult.count({
        where: {
          userId,
          completedAt: { gte: weekAgo }
        }
      })
    ]);

    // Calculate streak
    const allMoodEntries = await prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < allMoodEntries.length; i++) {
      const entryDate = new Date(allMoodEntries[i].createdAt);
      entryDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (entryDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    const currentMood = recentMoods[0]?.mood ?? null;
    const moodTrend = deriveMoodTrend(recentMoods);

    // Get recommended practice
    let recommendedPractice = null;
    if (assessmentInsights && user.approach) {
      try {
        const userContext: any = {
          id: user.id,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          approach: user.approach as 'western' | 'eastern' | 'hybrid',
          assessmentInsights: {
            byType: assessmentInsights.insights.byType,
            recommendations: []
          },
          wellnessScore: assessmentInsights.insights.wellnessScore?.value,
          wellbeingTrend: assessmentInsights.insights.overallTrend,
          currentMood,
          moodTrend,
          recentMoodEntries: recentMoods.map((entry) => ({
            mood: entry.mood,
            createdAt: entry.createdAt,
          })),
          recentActivity: {
            weeklyPractices,
            weeklyMoodEntries,
            weeklyAssessments,
            currentStreak,
          },
        };

        const recommendations = await recommendationService.getPracticeRecommendations({
          userId,
          userContext,
          approach: user.approach as 'western' | 'eastern' | 'hybrid',
          wellnessScore: assessmentInsights.insights.wellnessScore?.value,
          maxItems: 1
        });

        if (recommendations.items.length > 0) {
          recommendedPractice = recommendations.items[0];
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      }
    }

    // Compile response
    const dashboardData = {
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        approach: user.approach,
        profileCompletion: calculateProfileCompletion(user),
        memberSince: user.createdAt.toISOString()
      },
      assessmentScores: assessmentInsights ? {
        anxiety: assessmentInsights.insights.byType['anxiety']?.latestScore ||
          assessmentInsights.insights.byType['anxiety_assessment']?.latestScore || null,
        stress: assessmentInsights.insights.byType['stress']?.latestScore || null,
        emotionalIntelligence: assessmentInsights.insights.byType['emotionalIntelligence']?.latestScore || null,
        wellnessScore: assessmentInsights.insights.wellnessScore?.value || null,
        byType: assessmentInsights.insights.byType,
        overallTrend: assessmentInsights.insights.overallTrend,
        aiSummary: assessmentInsights.insights.aiSummary,
        updatedAt: assessmentInsights.insights.updatedAt
      } : null,
      recentInsights: assessmentInsights ?
        generateInsightsFromAssessments(assessmentInsights.insights.byType, assessmentInsights.insights.aiSummary) : [],
      weeklyProgress: {
        practices: {
          completed: weeklyPractices,
          goal: 7,
          percentage: Math.round((weeklyPractices / 7) * 100)
        },
        moodCheckins: {
          completed: weeklyMoodEntries,
          goal: 7,
          percentage: Math.round((weeklyMoodEntries / 7) * 100)
        },
        assessments: {
          completed: weeklyAssessments,
          goal: 4,
          percentage: Math.round((weeklyAssessments / 4) * 100)
        },
        currentStreak: currentStreak
      },
      recentMoods: recentMoods.map(mood => ({
        mood: mood.mood,
        notes: mood.notes,
        createdAt: mood.createdAt.toISOString()
      })),
      recommendedPractice: recommendedPractice ? {
        id: recommendedPractice.id,
        title: recommendedPractice.title,
        description: recommendedPractice.description,
        type: recommendedPractice.type,
        duration: recommendedPractice.duration,
        tags: recommendedPractice.tags,
        reason: recommendedPractice.reason,
        approach: recommendedPractice.approach
      } : null
    };

    const serializedSummary = JSON.stringify(dashboardData);
    const etag = `W/"${createHash('sha1').update(serializedSummary).digest('hex')}"`;

    const ifNoneMatch = req.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Vary', 'Authorization');
      res.setHeader('ETag', etag);
      return res.status(304).end();
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('ETag', etag);
    res.type('application/json').send(serializedSummary);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

/**
 * GET /api/dashboard/mode
 * Resolve adaptive dashboard mode for the authenticated user.
 */
router.get('/mode', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const modeResult = await dashboardModeService.computeMode(userId);

    return res.json({
      success: true,
      data: modeResult,
    });
  } catch (error) {
    console.error('Error resolving dashboard mode:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve dashboard mode',
    });
  }
});

/**
 * GET /api/dashboard/unified
 * Return a single payload for dashboard cards to reduce request fan-out.
 */
router.get('/unified', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const forceCommunityRefresh = String(req.query.forceCommunity || '').toLowerCase() === 'true';

    const [
      summary,
      weeklyProgress,
      mode,
      checkins,
      crisisEvents,
      intention,
      sleep,
      gratitude,
      nudges,
      assessmentReminder,
      habits,
      communityInsights,
    ] = await Promise.all([
      getDashboardSummaryData(userId),
      getWeeklyProgressData(userId),
      dashboardModeService.computeMode(userId),
      getCheckinSummaryData(userId, 2),
      getRecentCrisisEventsData(userId),
      getTodayIntentionData(userId),
      getSleepDashboardData(userId, 7),
      getGratitudeDashboardData(userId, 7),
      getAdaptiveNudges(userId),
      getAssessmentReminderData(userId),
      getHabitDashboardData(userId),
      getCommunityInsights(forceCommunityRefresh),
    ]);

    return res.json({
      success: true,
      data: {
        summary,
        weeklyProgress,
        mode,
        checkins,
        crisisEvents,
        intention,
        sleep,
        gratitude,
        nudges: {
          nudges,
          total: nudges.length,
        },
        assessmentReminder,
        habits,
        communityInsights,
      },
    });
  } catch (error) {
    console.error('Error fetching unified dashboard data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load unified dashboard data',
    });
  }
});

/**
 * GET /api/dashboard/insights
 * Get AI-generated insights based on user's assessment history
 */
/**
 * GET /api/dashboard/insights
 * Get combined insights from assessments and chatbot conversations
 * Uses smart caching with daily expiration
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get combined insights (assessments + chatbot)
    let combinedInsights = await enhancedInsightsService.getDashboardInsights(userId);

    // If generation failed, try to fetch the last cached insight directly
    if (!combinedInsights) {
      const cached = await prisma.dashboardInsights.findUnique({ where: { userId } });
      if (cached && cached.insightsData) {
        try {
          combinedInsights = JSON.parse(cached.insightsData);
        } catch { }
      }
    }

    // If we have any insight (generated or cached), verify it has real data before returning
    if (combinedInsights) {
      const hasAssessmentData = combinedInsights.assessments.scores.length > 0;
      const hasChatData = combinedInsights.chatbot.summaries.length > 0;

      // Only return cached insights if they contain actual user data
      if (hasAssessmentData || hasChatData) {
        return res.json({
          insights: [],
          aiSummary: combinedInsights.aiSummary,
          overallTrend: 'baseline',
          wellnessScore: null,
          assessments: {
            count: combinedInsights.assessments.scores.length,
            averageScore: combinedInsights.assessments.scores.length > 0
              ? combinedInsights.assessments.scores.reduce((sum, s) => sum + s.score, 0) / combinedInsights.assessments.scores.length
              : 0,
            trend: 'stable',
            recentScores: combinedInsights.assessments.scores.slice(0, 5).map(s => s.score)
          },
          chatbot: {
            conversationCount: combinedInsights.chatbot.summaries.length,
            averageEmotionalState: combinedInsights.chatbot.emotionalStates.length > 0
              ? combinedInsights.chatbot.emotionalStates[0]
              : 'neutral',
            commonTopics: combinedInsights.chatbot.keyTopics,
            lastConversationDate: combinedInsights.chatbot.lastDate?.toISOString()
          },
          generatedAt: combinedInsights.generatedAt?.toISOString?.() || new Date().toISOString(),
          source: 'combined',
          cached: true
        });
      }
      // If cached data has no real content, fall through to assessment-only check
    }

    // If no insight ever existed, fallback to assessment-only logic
    const assessments = await prisma.assessmentResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20
    });

    if (assessments.length === 0) {
      return res.json({
        insights: [],
        aiSummary: 'Complete your first assessment or chat with our AI to receive personalized insights.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, name: true }
    });

    const assessmentInsights = await buildAssessmentInsights(
      assessments,
      { userName: user?.firstName || user?.name }
    );

    const insights = generateInsightsFromAssessments(
      assessmentInsights.insights.byType,
      assessmentInsights.insights.aiSummary
    );

    return res.json({
      insights,
      aiSummary: assessmentInsights.insights.aiSummary,
      overallTrend: assessmentInsights.insights.overallTrend,
      wellnessScore: assessmentInsights.insights.wellnessScore,
      source: 'assessments-only',
      cached: false
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

/**
 * POST /api/dashboard/insights/refresh
 * Force refresh of combined insights (bypasses cache)
 * Useful for manual refresh button in UI
 */
router.post('/insights/refresh', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Force regeneration by passing forceRefresh=true
    const combinedInsights = await enhancedInsightsService.getDashboardInsights(userId, true);

    if (!combinedInsights) {
      return res.json({
        success: true,
        message: 'No new insights to refresh yet',
        data: {
          assessments: {
            scores: [],
            insights: [],
            lastDate: null
          },
          chatbot: {
            summaries: [],
            emotionalStates: [],
            keyTopics: [],
            lastDate: null
          },
          aiSummary: 'Complete an assessment or chat with our AI to receive personalized insights.',
          generatedAt: new Date().toISOString(),
          source: 'combined',
          cached: false
        }
      });
    }

    res.json({
      success: true,
      message: 'Insights refreshed successfully',
      data: {
        assessments: combinedInsights.assessments,
        chatbot: combinedInsights.chatbot,
        aiSummary: combinedInsights.aiSummary,
        generatedAt: combinedInsights.generatedAt,
        source: 'combined',
        cached: false
      }
    });
  } catch (error) {
    console.error('Error refreshing insights:', error);
    res.status(500).json({
      error: 'Failed to refresh insights',
      message: 'An unexpected error occurred while refreshing insights.'
    });
  }
});

/**
 * GET /api/dashboard/weekly-progress
 * Get detailed weekly progress statistics
 */
router.get('/weekly-progress', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [weeklyPractices, weeklyMoodEntries, weeklyAssessments, allMoodEntries] = await Promise.all([
      prisma.userPlanModule.findMany({
        where: {
          userId,
          completed: true,
          completedAt: { gte: weekAgo }
        },
        select: {
          completedAt: true,
          module: {
            select: {
              title: true,
              type: true
            }
          }
        }
      }),
      prisma.moodEntry.findMany({
        where: {
          userId,
          createdAt: { gte: weekAgo }
        },
        select: {
          mood: true,
          createdAt: true
        }
      }),
      prisma.assessmentResult.findMany({
        where: {
          userId,
          completedAt: { gte: weekAgo }
        },
        select: {
          assessmentType: true,
          score: true,
          completedAt: true
        }
      }),
      prisma.moodEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ]);

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < allMoodEntries.length; i++) {
      const entryDate = new Date(allMoodEntries[i].createdAt);
      entryDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (entryDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      practices: {
        completed: weeklyPractices.length,
        goal: 7,
        percentage: Math.round((weeklyPractices.length / 7) * 100),
        details: weeklyPractices.map(p => ({
          title: p.module.title,
          type: p.module.type,
          completedAt: p.completedAt?.toISOString()
        }))
      },
      moodCheckins: {
        completed: weeklyMoodEntries.length,
        goal: 7,
        percentage: Math.round((weeklyMoodEntries.length / 7) * 100),
        moodDistribution: calculateMoodDistribution(weeklyMoodEntries)
      },
      assessments: {
        completed: weeklyAssessments.length,
        goal: 4,
        percentage: Math.round((weeklyAssessments.length / 4) * 100),
        types: Array.from(new Set(weeklyAssessments.map(a => a.assessmentType)))
      },
      streak: {
        current: currentStreak,
        message: getStreakMessage(currentStreak)
      }
    });
  } catch (error) {
    console.error('Error fetching weekly progress:', error);
    res.status(500).json({ error: 'Failed to load weekly progress' });
  }
});

/**
 * GET /api/dashboard/recommended-practice
 * Get AI-recommended practice based on assessment insights
 */
router.get('/recommended-practice', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        approach: true
      }
    });

    if (!user || !user.approach) {
      return res.json({ recommendedPractice: null });
    }

    // Get assessment insights and recent activity context
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [assessments, recentMoodEntries, weeklyPractices, weeklyMoodEntries] = await Promise.all([
      prisma.assessmentResult.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 10
      }),
      prisma.moodEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 7
      }),
      prisma.userPlanModule.count({
        where: {
          userId,
          completed: true,
          completedAt: { gte: weekAgo }
        }
      }),
      prisma.moodEntry.count({
        where: {
          userId,
          createdAt: { gte: weekAgo }
        }
      })
    ]);

    if (assessments.length === 0) {
      return res.json({ recommendedPractice: null });
    }

    const assessmentInsights = await buildAssessmentInsights(
      assessments,
      { userName: user.firstName || user.name }
    );

    const userContext: any = {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      approach: user.approach as 'western' | 'eastern' | 'hybrid',
      assessmentInsights: {
        byType: assessmentInsights.insights.byType,
        recommendations: []
      },
      wellnessScore: assessmentInsights.insights.wellnessScore?.value,
      wellbeingTrend: assessmentInsights.insights.overallTrend,
      currentMood: recentMoodEntries[0]?.mood ?? null,
      moodTrend: deriveMoodTrend(recentMoodEntries),
      recentMoodEntries: recentMoodEntries.map((entry) => ({
        mood: entry.mood,
        emotion: entry.emotion,
        emotionGroup: entry.emotionGroup,
        intensity: entry.intensity,
        trigger: entry.trigger,
        createdAt: entry.createdAt,
      })),
      recentActivity: {
        weeklyPractices,
        weeklyMoodEntries,
      },
    };

    const recommendations = await recommendationService.getPracticeRecommendations({
      userId,
      userContext,
      approach: user.approach as 'western' | 'eastern' | 'hybrid',
      wellnessScore: assessmentInsights.insights.wellnessScore?.value,
      maxItems: 3
    });

    res.json({
      recommendations: recommendations.items,
      focusAreas: recommendations.focusAreas,
      rationale: recommendations.rationale
    });
  } catch (error) {
    console.error('Error fetching recommended practice:', error);
    res.status(500).json({ error: 'Failed to load recommendations' });
  }
});

/**
 * GET /api/dashboard/nudges
 * Returns adaptive nudges and milestone celebrations for the authenticated user.
 */
router.get('/nudges', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const nudges = await getAdaptiveNudges(userId);

    return res.json({
      success: true,
      data: {
        nudges,
        total: nudges.length,
      },
    });
  } catch (error) {
    console.error('Error fetching adaptive nudges:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch adaptive nudges',
    });
  }
});

/**
 * GET /api/dashboard/community-insights
 * Returns anonymized, cached community-level insights.
 */
router.get('/community-insights', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const forceRefresh = String(req.query.force || '').toLowerCase() === 'true';
    const insights = await getCommunityInsights(forceRefresh);

    return res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Error fetching community insights:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch community insights',
    });
  }
});

const ASSESSMENT_REMINDER_THRESHOLD_DAYS = 21;

async function getDashboardSummaryData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      approach: true,
      birthday: true,
      region: true,
      emergencyContact: true,
      emergencyPhone: true,
      createdAt: true,
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [assessments, recentMoods, weeklyPractices, weeklyMoodEntries, weeklyAssessments, allMoodEntries] = await Promise.all([
    prisma.assessmentResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20
    }),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 7
    }),
    prisma.userPlanModule.count({
      where: {
        userId,
        completed: true,
        completedAt: { gte: weekAgo }
      }
    }),
    prisma.moodEntry.count({
      where: {
        userId,
        createdAt: { gte: weekAgo }
      }
    }),
    prisma.assessmentResult.count({
      where: {
        userId,
        completedAt: { gte: weekAgo }
      }
    }),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ]);

  const assessmentInsights = assessments.length > 0
    ? await buildAssessmentInsights(assessments, { userName: user.firstName || user.name })
    : null;

  let recommendedPractice = null;
  if (assessmentInsights && user.approach) {
    try {
      const userContext: any = {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        approach: user.approach as 'western' | 'eastern' | 'hybrid',
        assessmentInsights: {
          byType: assessmentInsights.insights.byType,
          recommendations: []
        },
        wellnessScore: assessmentInsights.insights.wellnessScore?.value
      };

      const recommendations = await recommendationService.getPracticeRecommendations({
        userId,
        userContext,
        approach: user.approach as 'western' | 'eastern' | 'hybrid',
        wellnessScore: assessmentInsights.insights.wellnessScore?.value,
        maxItems: 1
      });

      if (recommendations.items.length > 0) {
        recommendedPractice = recommendations.items[0];
      }
    } catch (error) {
      console.error('Error fetching recommendations for unified dashboard:', error);
    }
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      approach: user.approach,
      profileCompletion: calculateProfileCompletion(user),
      memberSince: user.createdAt.toISOString()
    },
    assessmentScores: assessmentInsights ? {
      anxiety: assessmentInsights.insights.byType['anxiety']?.latestScore ||
        assessmentInsights.insights.byType['anxiety_assessment']?.latestScore || null,
      stress: assessmentInsights.insights.byType['stress']?.latestScore || null,
      emotionalIntelligence: assessmentInsights.insights.byType['emotionalIntelligence']?.latestScore || null,
      wellnessScore: assessmentInsights.insights.wellnessScore?.value || null,
      byType: assessmentInsights.insights.byType,
      overallTrend: assessmentInsights.insights.overallTrend,
      aiSummary: assessmentInsights.insights.aiSummary,
      updatedAt: assessmentInsights.insights.updatedAt
    } : null,
    recentInsights: assessmentInsights
      ? generateInsightsFromAssessments(assessmentInsights.insights.byType, assessmentInsights.insights.aiSummary)
      : [],
    weeklyProgress: {
      practices: {
        completed: weeklyPractices,
        goal: 7,
        percentage: Math.round((weeklyPractices / 7) * 100)
      },
      moodCheckins: {
        completed: weeklyMoodEntries,
        goal: 7,
        percentage: Math.round((weeklyMoodEntries / 7) * 100)
      },
      assessments: {
        completed: weeklyAssessments,
        goal: 4,
        percentage: Math.round((weeklyAssessments / 4) * 100)
      },
      currentStreak: calculateCurrentMoodStreak(allMoodEntries)
    },
    recentMoods: recentMoods.map((mood) => ({
      mood: mood.mood,
      notes: mood.notes,
      createdAt: mood.createdAt.toISOString()
    })),
    recommendedPractice: recommendedPractice ? {
      title: recommendedPractice.title,
      description: recommendedPractice.description,
      type: recommendedPractice.type,
      duration: recommendedPractice.duration,
      tags: recommendedPractice.tags,
      reason: recommendedPractice.reason,
      approach: recommendedPractice.approach
    } : null
  };
}

async function getWeeklyProgressData(userId: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [weeklyPractices, weeklyMoodEntries, weeklyAssessments, allMoodEntries] = await Promise.all([
    prisma.userPlanModule.findMany({
      where: {
        userId,
        completed: true,
        completedAt: { gte: weekAgo }
      },
      select: {
        completedAt: true,
        module: {
          select: {
            title: true,
            type: true
          }
        }
      }
    }),
    prisma.moodEntry.findMany({
      where: {
        userId,
        createdAt: { gte: weekAgo }
      },
      select: {
        mood: true,
        createdAt: true
      }
    }),
    prisma.assessmentResult.findMany({
      where: {
        userId,
        completedAt: { gte: weekAgo }
      },
      select: {
        assessmentType: true,
        score: true,
        completedAt: true
      }
    }),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ]);

  const currentStreak = calculateCurrentMoodStreak(allMoodEntries);

  return {
    practices: {
      completed: weeklyPractices.length,
      goal: 7,
      percentage: Math.round((weeklyPractices.length / 7) * 100),
      details: weeklyPractices.map((p) => ({
        title: p.module.title,
        type: p.module.type,
        completedAt: p.completedAt?.toISOString() ?? null
      }))
    },
    moodCheckins: {
      completed: weeklyMoodEntries.length,
      goal: 7,
      percentage: Math.round((weeklyMoodEntries.length / 7) * 100),
      moodDistribution: calculateMoodDistribution(weeklyMoodEntries)
    },
    assessments: {
      completed: weeklyAssessments.length,
      goal: 4,
      percentage: Math.round((weeklyAssessments.length / 4) * 100),
      types: Array.from(new Set(weeklyAssessments.map((assessment) => assessment.assessmentType)))
    },
    streak: {
      current: currentStreak,
      message: getStreakMessage(currentStreak)
    }
  };
}

async function getCheckinSummaryData(userId: string, days: number) {
  const checkinModel = (prisma as any).microCheckin;
  if (!checkinModel) {
    return {
      checkins: [],
      avgEnergy: null,
      avgDayRating: null,
      totalCheckins: 0,
      days,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const checkins = await checkinModel.findMany({
    where: {
      userId,
      createdAt: {
        gte: since
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const morningEnergyScores = checkins
    .filter((entry: any) => entry.type === 'morning')
    .map((entry: any) => asNumber((entry.responses as Record<string, unknown>)?.energyLevel))
    .filter((value: number | null): value is number => value !== null);

  const eveningDayRatings = checkins
    .filter((entry: any) => entry.type === 'evening')
    .map((entry: any) => {
      const responses = entry.responses as Record<string, unknown>;
      return asNumber(responses?.dayRating ?? responses?.overallDay);
    })
    .filter((value: number | null): value is number => value !== null);

  return {
    checkins,
    avgEnergy: average(morningEnergyScores),
    avgDayRating: average(eveningDayRatings),
    totalCheckins: checkins.length,
    days
  };
}

async function getRecentCrisisEventsData(userId: string) {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return prisma.crisisEvent.findMany({
    where: {
      userId,
      detectedAt: {
        gte: since
      },
      resolved: false,
      followUpResponse: null
    },
    orderBy: {
      detectedAt: 'desc'
    },
    take: 5
  });
}

async function getTodayIntentionData(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return prisma.dailyIntention.findFirst({
    where: {
      userId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async function getSleepDashboardData(userId: string, days: number) {
  const sleepModel = (prisma as any).sleepLog;
  if (!sleepModel) {
    return {
      history: { logs: [], days, total: 0 },
      stats: {
        periodDays: days,
        totalLogs: 0,
        averageQuality: null,
        averageDuration: null,
        commonFactors: [],
      }
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await sleepModel.findMany({
    where: {
      userId,
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const total = logs.length;
  const averageQuality = total > 0
    ? Number((logs.reduce((sum: number, log: any) => sum + log.quality, 0) / total).toFixed(2))
    : null;

  const durations = logs
    .map((log: any) => (typeof log.duration === 'number' ? log.duration : null))
    .filter((value: number | null): value is number => value !== null);

  const averageDuration = durations.length > 0
    ? Number((durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length).toFixed(2))
    : null;

  const factorCounts: Record<string, number> = {};
  logs.forEach((log: any) => {
    if (!Array.isArray(log.factors)) {
      return;
    }

    log.factors
      .filter((factor: unknown): factor is string => typeof factor === 'string' && factor.trim().length > 0)
      .forEach((factor: string) => {
        factorCounts[factor] = (factorCounts[factor] || 0) + 1;
      });
  });

  const commonFactors = Object.entries(factorCounts)
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    history: {
      logs,
      days,
      total,
    },
    stats: {
      periodDays: days,
      totalLogs: total,
      averageQuality,
      averageDuration,
      commonFactors,
    },
  };
}

async function getGratitudeDashboardData(userId: string, days: number) {
  const gratitudeModel = (prisma as any).gratitudeEntry;
  if (!gratitudeModel) {
    return {
      entries: [],
      days,
      total: 0,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const entries = await gratitudeModel.findMany({
    where: {
      userId,
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return {
    entries,
    days,
    total: entries.length,
  };
}

async function getAssessmentReminderData(userId: string) {
  const latestAssessment = await prisma.assessmentResult.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    select: {
      completedAt: true,
      assessmentType: true,
    }
  });

  if (!latestAssessment) {
    return {
      shouldRemind: true,
      reason: 'first-assessment',
      thresholdDays: ASSESSMENT_REMINDER_THRESHOLD_DAYS,
      daysSinceLastAssessment: null,
      lastCompletedAt: null,
      lastAssessmentType: null,
      message: 'You have not taken an assessment yet. A quick check-in helps personalize your support plan.'
    };
  }

  const now = Date.now();
  const completedAtMs = latestAssessment.completedAt.getTime();
  const daysSinceLastAssessment = Math.max(
    0,
    Math.floor((now - completedAtMs) / (1000 * 60 * 60 * 24))
  );

  const shouldRemind = daysSinceLastAssessment >= ASSESSMENT_REMINDER_THRESHOLD_DAYS;

  return {
    shouldRemind,
    reason: shouldRemind ? 'stale-assessment' : 'recent-assessment',
    thresholdDays: ASSESSMENT_REMINDER_THRESHOLD_DAYS,
    daysSinceLastAssessment,
    lastCompletedAt: latestAssessment.completedAt.toISOString(),
    lastAssessmentType: latestAssessment.assessmentType,
    message: shouldRemind
      ? `It's been ${daysSinceLastAssessment} days since your last assessment. Retaking it can help track your progress.`
      : 'Your assessments are up to date.'
  };
}

async function getHabitDashboardData(userId: string) {
  const habitModel = (prisma as any).userHabit;
  if (!habitModel) {
    return {
      habits: [],
      total: 0,
    };
  }

  const habits = await habitModel.findMany({
    where: {
      userId,
      active: true,
    },
    orderBy: [
      { active: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  return {
    habits,
    total: habits.length,
  };
}

// Helper functions
function calculateProfileCompletion(user: any): number {
  const fields = [
    user.firstName,
    user.lastName,
    user.birthday,
    user.region,
    user.approach,
    user.emergencyContact,
    user.emergencyPhone
  ];
  const completed = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  return Math.round((completed / fields.length) * 100);
}

function calculateCurrentMoodStreak(allMoodEntries: Array<{ createdAt: Date }>): number {
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < allMoodEntries.length; i++) {
    const entryDate = new Date(allMoodEntries[i].createdAt);
    entryDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (entryDate.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }

  return currentStreak;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function generateInsightsFromAssessments(byType: any, aiSummary: string): any[] {
  const insights: any[] = [];

  // Add AI summary as primary insight
  if (aiSummary) {
    insights.push({
      type: 'ai-summary',
      title: 'Your Wellbeing Overview',
      description: aiSummary,
      icon: 'sparkles',
      timestamp: new Date().toISOString()
    });
  }

  // Generate insights from assessment trends
  Object.entries(byType).forEach(([type, summary]: [string, any]) => {
    if (summary.trend === 'declining') {
      insights.push({
        type: 'pattern',
        title: `Pattern detected: ${friendlyLabel(type)}`,
        description: `Your ${friendlyLabel(type).toLowerCase()} levels show a declining trend. ${summary.recommendations?.[0] || 'Consider focusing on self-care practices.'}`,
        icon: 'trending-down',
        severity: 'warning',
        timestamp: summary.lastCompletedAt
      });
    }

    if (summary.trend === 'improving' && summary.latestScore < 40) {
      insights.push({
        type: 'progress',
        title: `Progress update: ${friendlyLabel(type)}`,
        description: `Great work! Your ${friendlyLabel(type).toLowerCase()} has improved ${Math.abs(summary.change || 0).toFixed(0)}% since your last assessment.`,
        icon: 'trending-up',
        severity: 'success',
        timestamp: summary.lastCompletedAt
      });
    }
  });

  return insights.slice(0, 5); // Limit to 5 insights
}

function friendlyLabel(type: string): string {
  const labels: Record<string, string> = {
    anxiety: 'Anxiety',
    anxiety_assessment: 'Anxiety',
    stress: 'Stress',
    emotionalIntelligence: 'Emotional Intelligence',
    overthinking: 'Overthinking',
    depression: 'Depression',
    trauma: 'Trauma Response'
  };
  return labels[type] || type.split(/(?=[A-Z])/).join(' ');
}

function calculateMoodDistribution(moodEntries: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  moodEntries.forEach(entry => {
    distribution[entry.mood] = (distribution[entry.mood] || 0) + 1;
  });
  return distribution;
}

function deriveMoodTrend(moodEntries: Array<{ mood?: string | null }>): string {
  if (moodEntries.length < 2) {
    return 'stable';
  }

  const scoreByMood: Record<string, number> = {
    anxious: -2,
    struggling: -2,
    sad: -2,
    overwhelmed: -2,
    low: -1,
    okay: 0,
    neutral: 0,
    good: 1,
    calm: 1,
    great: 2,
    happy: 2,
  };

  const values = moodEntries
    .map((entry) => {
      const normalized = String(entry.mood || '').trim().toLowerCase();
      return normalized in scoreByMood ? scoreByMood[normalized] : 0;
    });

  const latest = values[0] ?? 0;
  const priorAverage = values.slice(1).reduce((sum, value) => sum + value, 0) / Math.max(1, values.length - 1);
  const delta = latest - priorAverage;

  if (delta >= 1) {
    return 'improving';
  }

  if (delta <= -1) {
    return 'declining';
  }

  return 'stable';
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return 'Start your streak today!';
  if (streak === 1) return 'Great start! Keep it going.';
  if (streak < 7) return `${streak} days strong! Building momentum.`;
  if (streak < 30) return `${streak}-day streak! You\'re on fire! 🔥`;
  return `Amazing ${streak}-day streak! You\'re a wellness champion! 🏆`;
}

export default router;
