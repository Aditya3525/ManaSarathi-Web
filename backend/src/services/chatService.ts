import { PrismaClient } from '@prisma/client';
import { llmService } from './llmProvider';
import { recommendationService, RecommendationResult } from './recommendationService';
import { UserContext, AIMessage } from '../types/ai';
import type { AssessmentInsightsPayload, AssessmentTypeSummary } from './assessmentInsightsService';
import { logger } from '../utils/logger';
import { conversationMemoryService } from './conversationMemoryService';
import { conversationService } from './conversationService';
import { structuredExercisesService } from './structuredExercisesService';
import { contextAwarenessService } from './contextAwarenessService';
import { progressDetectionService, type ProgressSignal } from './progressDetectionService';
import { crisisDetectionService } from './crisisDetectionService';

const prisma = new PrismaClient();
const chatLogger = logger.child({ module: 'ChatService' });

type ApproachMode = 'western' | 'eastern' | 'hybrid';

type SentimentSnapshot = {
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  dominantEmotion: string | null;
  keywords: string[];
  summary: string;
};

type EnhancedSentiment = {
  primary: {
    emotion: 'joy' | 'sadness' | 'anxiety' | 'anger' | 'fear' | 'neutral';
    confidence: number; // 0-1
    intensity: number; // 0-10
  };
  secondary: Array<{
    emotion: string;
    confidence: number;
  }>;
  tone: {
    formality: number; // 0-1 (casual to formal)
    urgency: number; // 0-1
    hopefulness: number; // 0-1
  };
  indicators: {
    crisisRisk: number; // 0-1
    progressIndicators: string[];
    concerningPatterns: string[];
  };
  linguisticFeatures: {
    questionCount: number;
    exclamationCount: number;
    negationCount: number;
    firstPersonCount: number;
    absoluteWords: string[]; // "always", "never", "completely"
  };
};

type CoachingDirectives = {
  westernFocus: string[];
  easternPractices: string[];
  hybridBridge: string[];
  reminders: string[];
};

type PendingRepairContext = {
  feedbackId: string;
  createdAt: Date;
  note: string | null;
  dislikedMessagePreview: string;
};

type AssessmentPromptAction = {
  actionRequired: 'trigger_gad2_assessment';
  assessmentType: 'anxiety_gad2';
  prompt: string;
  ctaLabel: string;
  daysSinceLastAssessment: number | null;
};

type ConversationMetadataState = {
  deEscalationAttempt?: number;
  lastDistressAt?: string;
  lastAssessmentPromptAt?: string;
};

type GenerateResponseOptions = {
  simpleLanguage?: boolean;
};

const POSITIVE_WORDS = [
  'calm',
  'hopeful',
  'relief',
  'better',
  'progress',
  'grateful',
  'steady',
  'improving'
];

const NEGATIVE_WORDS = [
  'anxious',
  'anxiety',
  'worried',
  'worry',
  'panic',
  'fear',
  'stressed',
  'stress',
  'overwhelmed',
  'tired',
  'exhausted',
  'sad',
  'hopeless',
  'lonely',
  'angry',
  'frustrated'
];

const EMOTION_KEYWORDS: Record<string, string[]> = {
  anxiety: ['anxious', 'worry', 'panic', 'nervous', 'fear'],
  stress: ['stress', 'overwhelmed', 'pressure', 'tense'],
  sadness: ['sad', 'down', 'hopeless', 'blue', 'numb'],
  anger: ['angry', 'frustrated', 'irritated', 'mad'],
  fatigue: ['tired', 'exhausted', 'drained', 'worn out']
};

const EASTERN_PRACTICES = [
  '5-minute diaphragmatic breathing (inhale 4, hold 4, exhale 6)',
  'Guided mindfulness body scan releasing jaw, shoulders, and belly',
  'Gentle seated spinal twist and cat-cow to release stagnant energy',
  'Loving-kindness meditation repeating warm, compassionate phrases'
];

const WESTERN_TECHNIQUES = [
  'Cognitive reframing: write the automatic thought, evidence for/against, and a balanced belief',
  'Behavioral activation: schedule a 10-minute nourishing activity in the next 24 hours',
  'Thought labeling: notice and name the thinking pattern (e.g., catastrophizing, mind-reading)',
  '5-4-3-2-1 sensory grounding to reset the nervous system'
];

const HYBRID_BRIDGES = [
  'Pair a grounding breath with one CBT reframe to anchor the new belief',
  'After journaling thoughts, seal the insight with a short compassion mantra',
  'Alternate cognitive reframing with a body-based release to integrate mind and body'
];

const APPROACH_DESCRIPTIONS: Record<ApproachMode, string> = {
  western:
    'Western clinical coaching: highlight thought patterns, behavioral experiments, CBT reframes, and evidence-based coping.',
  eastern:
    'Eastern contemplative coaching: weave in mindfulness, breathwork, somatic awareness, yoga/meditation rituals, and compassion.',
  hybrid:
    'Hybrid guidance: blend CBT-style reflection with mindful, body-based practices so the user experiences both cognitive clarity and calm.'
};

const SOMATIC_SIGNAL_PATTERN = /(tense|body|chest|tight|breathe|breath|racing heart|stomach|ground(?:ed|ing)?|shaky|restless|heartbeat)/i;
const COGNITIVE_LOOP_PATTERN = /(can't stop thinking|cant stop thinking|thoughts|in my head|what if|always|never|stupid|catastroph|overthink|ruminat|looping)/i;

export class ChatService {

  async generateAIResponse(
    userId: string,
    userMessage: string,
    sessionId?: string,
    conversationId?: string,
    options: GenerateResponseOptions = {}
  ): Promise<{
    response: string;
    provider?: string;
    model?: string;
    usage?: any;
    botMessage?: any;
    context?: string;
    conversationId?: string;
    conversationTitle?: string;
    recommendations?: RecommendationResult;
    recommendationsMeta?: {
      fallbackUsed: boolean;
      message?: string;
    };
    fallbackMeta?: {
      message: string;
      reason?: string;
    };
    assessmentPrompt?: AssessmentPromptAction | null;
  }> {
    let approachMode: ApproachMode = 'hybrid';
    let sentimentSnapshot: SentimentSnapshot | null = null;
    let recommendationResult: RecommendationResult | null = null;
    let progressSignals: ProgressSignal[] = [];
    let pendingRepairContext: PendingRepairContext | null = null;
    let assessmentPrompt: AssessmentPromptAction | null = null;
    let activeConversationId = conversationId;
    let newConversationCreated = false;
    let generatedTitle: string | undefined;

    try {
      // Create conversation if none provided
      if (!activeConversationId) {
        const newConversation = await conversationService.createConversation(userId);
        activeConversationId = newConversation.id;
        newConversationCreated = true;
        chatLogger.info({ userId, conversationId: activeConversationId }, 'Created new conversation');
      }

      // Check for crisis language first — keyword matching remains the primary
      // safety net, with sentiment and AI-assisted scoring as additive signals.
      const keywordCrisis = this.detectCrisisLanguage(userMessage);
      const distressSignal = this.detectDistressSignal(userMessage);
      const enhancedCrisisSentiment = await this.analyzeSentimentFastPass(userMessage);
      const computedCrisisRisk = enhancedCrisisSentiment?.indicators?.crisisRisk ?? 0;

      const shouldRunAiCrisisAssessment =
        keywordCrisis ||
        distressSignal ||
        computedCrisisRisk >= 0.6 ||
        (computedCrisisRisk >= 0.35
          && enhancedCrisisSentiment.primary.confidence >= 0.8
          && ['sadness', 'fear'].includes(enhancedCrisisSentiment.primary.emotion));

      let aiCrisisScore = 0;
      let aiCrisisReasoning = 'not-needed';
      if (shouldRunAiCrisisAssessment) {
        const aiCrisis = await crisisDetectionService.assessCrisisWithAI(userMessage);
        aiCrisisScore = aiCrisis.score;
        aiCrisisReasoning = aiCrisis.reasoning;
      }

      const isCrisis =
        keywordCrisis ||
        aiCrisisScore >= 8 ||
        (aiCrisisScore >= 7 && computedCrisisRisk >= 0.65);

      if (isCrisis) {
        chatLogger.warn({ userId, keywordCrisis, computedCrisisRisk, aiCrisisScore, aiCrisisReasoning }, 'Crisis language detected in chat message');

        const conversationMeta = activeConversationId
          ? await this.getConversationMetadataState(activeConversationId, userId)
          : {};
        const previousAttempt = Math.max(0, Math.floor(conversationMeta.deEscalationAttempt ?? 0));
        const nextAttempt = Math.min(previousAttempt + 1, 2);
        const resourcesShared = nextAttempt >= 2;

        // Save user message with crisis flag
        await this.saveChatMessage(
          userId,
          userMessage,
          'user',
          {
            crisis: true,
            deEscalationAttempt: nextAttempt,
            resourcesShared,
            crisisSignals: {
              keywordMatch: keywordCrisis,
              sentimentRisk: computedCrisisRisk,
              aiScore: aiCrisisScore,
              aiReasoning: aiCrisisReasoning
            }
          },
          activeConversationId
        );

        // Fetch user region for localised crisis resources
        const crisisUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { region: true }
        });

        if (activeConversationId) {
          await this.setConversationMetadataState(activeConversationId, {
            ...conversationMeta,
            deEscalationAttempt: nextAttempt,
            lastDistressAt: new Date().toISOString(),
          });
        }

        // Save crisis response
        const crisisResponse = resourcesShared
          ? this.getEscalatedCrisisResponse(crisisUser?.region)
          : this.getGroundingDeEscalationResponse();
        const botMessage = await this.saveChatMessage(
          userId,
          crisisResponse,
          'system',
          {
            crisis: true,
            deEscalationAttempt: nextAttempt,
            resourcesShared,
          },
          activeConversationId
        );

        // Persist crisis event for follow-up workflows and analytics.
        try {
          const confidence = Math.max(
            keywordCrisis ? 0.95 : 0,
            computedCrisisRisk,
            aiCrisisScore / 10
          );

          const crisisLevel =
            aiCrisisScore >= 9 || computedCrisisRisk >= 0.9
              ? 'CRITICAL'
              : aiCrisisScore >= 7 || computedCrisisRisk >= 0.7 || keywordCrisis
                ? 'HIGH'
                : 'MODERATE';

          await prisma.crisisEvent.create({
            data: {
              userId,
              conversationId: activeConversationId,
              crisisLevel,
              confidence,
              indicators: JSON.stringify({
                keywordMatch: keywordCrisis,
                sentimentRisk: computedCrisisRisk,
                aiScore: aiCrisisScore,
                aiReasoning: aiCrisisReasoning
              }),
              actionTaken: JSON.stringify({
                response: resourcesShared
                  ? 'crisis-escalation-resources'
                  : 'crisis-de-escalation-grounding',
                deEscalationAttempt: nextAttempt,
                resourcesShared,
                localizedByRegion: Boolean(crisisUser?.region),
                channel: 'chat'
              }),
              resolved: false,
              detectedAt: new Date()
            }
          });

          // Record the crisis as an important moment in conversation memory
          await conversationMemoryService.recordImportantMoment(
            userId,
            'Crisis Intervention',
            resourcesShared ? 'Safety escalation with helpline resources shared' : 'Safety grounding sequence activated',
            'high',
            userMessage.slice(0, 200),
            crisisResponse.slice(0, 200)
          );
        } catch (crisisEventError) {
          chatLogger.warn({ userId, err: crisisEventError }, 'Failed to persist crisis event record');
        }

        // Update conversation timestamp
        if (activeConversationId) {
          await conversationService.updateLastMessageTime(activeConversationId);

          // Generate title if this is a new conversation
          if (newConversationCreated) {
            generatedTitle = await conversationService.generateConversationTitle(activeConversationId);
          }
        }

        return {
          response: crisisResponse,
          provider: 'crisis-system',
          model: 'intervention',
          botMessage,
          context: resourcesShared ? 'crisis-intervention' : 'crisis-de-escalation',
          conversationId: activeConversationId,
          conversationTitle: generatedTitle
        };
      }

      if (activeConversationId) {
        await this.resetDeEscalationState(activeConversationId, userId);
      }

      // Get user context and latest wellbeing metrics
      const userContext = await this.getUserContext(userId);

      // --- PREMIUM PAYWALL CHECK ---
      const userForPaywall = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPremium: true }
      });

      if (!userForPaywall?.isPremium) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const messageCount = await prisma.chatMessage.count({
          where: {
            userId,
            type: 'user',
            createdAt: { gte: startOfToday }
          }
        });

        // Limit to 5 free messages per day
        if (messageCount >= 5) {
          const paywallResponse = "You've reached your daily limit of 5 free AI therapy messages. Please upgrade to ManaSarathi Premium from your Subscription settings to unlock unlimited AI conversations, deeper personalized insights, and premium therapeutic exercises.";
          
          const botMessage = await this.saveChatMessage(
            userId,
            paywallResponse,
            'system',
            { isPaywall: true },
            activeConversationId
          );
          
          if (activeConversationId) {
             await conversationService.updateLastMessageTime(activeConversationId);
          }
          
          return {
            response: paywallResponse,
            provider: 'system',
            model: 'paywall',
            botMessage,
            context: 'paywall',
            conversationId: activeConversationId,
            conversationTitle: generatedTitle
          };
        }
      }
      // -----------------------------
      if (options.simpleLanguage) {
        userContext.simpleLanguage = true;
      }
      try {
        progressSignals = await progressDetectionService.detectProgress(userId);
      } catch (progressError) {
        chatLogger.warn({ userId, err: progressError }, 'Failed to compute progress signals');
      }

      approachMode = this.determineConversationApproach(userContext, userMessage);
      sentimentSnapshot = this.estimateSentiment(userMessage, enhancedCrisisSentiment);

      // Get conversation memory context
      const memoryContext = await conversationMemoryService.getMemory(userId);

      // Get contextual awareness (time of day, recent events)
      const contextInsight = contextAwarenessService.getContextualInsight({
        userId,
        recentEvents: [], // This would come from a future tracking system
        emotionalState: sentimentSnapshot.label,
        emotion: sentimentSnapshot.dominantEmotion || 'neutral',
        energyLevel: 'medium', // Could be inferred from messages
        userName: userContext.firstName
      });

      // Check if user is requesting an exercise
      const exerciseRequest = this.detectExerciseRequest(userMessage);
      if (exerciseRequest) {
        // Map sentiment emotion to exercise emotion type
        const emotionMap: Record<string, 'anxiety' | 'stress' | 'anger' | 'depression' | 'overwhelm'> = {
          'anxiety': 'anxiety',
          'stress': 'stress',
          'anger': 'anger',
          'sadness': 'depression',
          'fatigue': 'overwhelm'
        };

        const emotion = sentimentSnapshot.dominantEmotion
          ? (emotionMap[sentimentSnapshot.dominantEmotion] || 'stress')
          : 'stress';

        const recommendedExercise = structuredExercisesService.getRecommendedExercise({
          emotion,
          timeAvailable: exerciseRequest.timeAvailable || 10,
          experienceLevel: 'beginner'
        });

        if (recommendedExercise) {
          const exercisePayload = structuredExercisesService.formatExerciseForChat(recommendedExercise);
          const exerciseResponse = exercisePayload.content;

          // Save user message
          await this.saveChatMessage(userId, userMessage, 'user', {
            sentiment: sentimentSnapshot,
            exerciseRequested: true
          }, activeConversationId);

          // Save exercise response
          const botMessage = await this.saveChatMessage(userId, exerciseResponse, 'bot', {
            provider: 'structured-exercise',
            exerciseType: recommendedExercise.type,
            ...exercisePayload.metadata
          }, activeConversationId);

          // Update conversation memory
          await conversationMemoryService.updateMemory(userId, userMessage, 'user');

          // Update conversation timestamp
          if (activeConversationId) {
            await conversationService.updateLastMessageTime(activeConversationId);

            // Generate title if this is a new conversation
            if (newConversationCreated) {
              generatedTitle = await conversationService.generateConversationTitle(activeConversationId);
            }
          }

          return {
            response: exerciseResponse,
            provider: 'structured-exercise',
            model: recommendedExercise.type,
            botMessage,
            context: 'exercise-delivery',
            conversationId: activeConversationId,
            conversationTitle: generatedTitle
          };
        }
      }

      assessmentPrompt = await this.getAssessmentPromptAction({
        userId,
        conversationId: activeConversationId,
        userMessage,
        sentiment: sentimentSnapshot,
      });

      if (assessmentPrompt) {
        const promptResponse = assessmentPrompt.prompt;

        await this.saveChatMessage(
          userId,
          userMessage,
          'user',
          {
            sentiment: sentimentSnapshot,
            assessmentPromptTriggered: true,
          },
          activeConversationId
        );

        const botMessage = await this.saveChatMessage(
          userId,
          promptResponse,
          'bot',
          {
            provider: 'assessment-prompt',
            approach: approachMode,
            sentiment: sentimentSnapshot,
            actionRequired: assessmentPrompt.actionRequired,
            assessmentPrompt,
          },
          activeConversationId
        );

        await Promise.all([
          conversationMemoryService.updateMemory(userId, userMessage, 'user'),
          conversationMemoryService.updateMemory(userId, promptResponse, 'bot'),
        ]);

        if (activeConversationId) {
          await conversationService.updateLastMessageTime(activeConversationId);

          if (newConversationCreated) {
            generatedTitle = await conversationService.generateConversationTitle(activeConversationId);
          }
        }

        return {
          response: promptResponse,
          provider: 'assessment-prompt',
          model: 'system',
          botMessage,
          context: 'assessment-trigger',
          conversationId: activeConversationId,
          conversationTitle: generatedTitle,
          assessmentPrompt,
        };
      }

      const directives = this.buildCoachingDirectives(approachMode, userContext, sentimentSnapshot);

      // Fetch independent context inputs in parallel to reduce pre-LLM latency.
      const [chatHistory, resolvedRecommendationResult, feedbackSummary, resolvedPendingRepairContext] = await Promise.all([
        this.getChatHistory(userId, 8),
        recommendationService.getContentRecommendations({
          userId,
          userContext,
          approach: approachMode,
          sentiment: sentimentSnapshot,
          wellnessScore: userContext.wellnessScore,
          maxItems: 4
        }).catch((recommendationError) => {
          chatLogger.warn({ userId, err: recommendationError }, 'Recommendation query failed, using emergency recommendation set');
          return this.buildEmergencyRecommendationSet(sentimentSnapshot);
        }),
        this.buildFeedbackSummary(userId).catch((feedbackError) => {
          chatLogger.warn({ userId, err: feedbackError }, 'Feedback summary lookup failed');
          return null;
        }),
        this.getPendingRepairContext(userId).catch((repairError) => {
          chatLogger.warn({ userId, err: repairError }, 'Pending repair context lookup failed');
          return null;
        })
      ]);

      recommendationResult = resolvedRecommendationResult;
      pendingRepairContext = resolvedPendingRepairContext;

      const historyMessages: AIMessage[] = chatHistory
        .reverse()
        .map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      const systemPrompt = this.buildSystemPrompt({
        approach: approachMode,
        userContext,
        sentiment: sentimentSnapshot,
        directives,
        progressSignals,
        recommendations: recommendationResult.items,
        memoryContext,
        contextInsight,
        feedbackSummary: feedbackSummary ?? undefined,
        repairContext: pendingRepairContext ?? undefined
      });

      const promptMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userMessage }
      ];

      const conversationContext = {
        user: { ...userContext, approachEngine: approachMode },
        messages: promptMessages,
        sessionId: sessionId || `session_${userId}_${Date.now()}`,
        timestamp: new Date(),
        recommendations: recommendationResult.items
      };

      chatLogger.info(
        {
          userId,
          approach: approachMode,
          wellnessScore: userContext.wellnessScore ?? null,
          sentimentLabel: sentimentSnapshot?.label ?? null
        },
        'Generating AI response'
      );

      const aiResponse = await llmService.generateResponse(
        promptMessages,
        {
          maxTokens: this.getMaxTokensForApproach(approachMode),
          temperature: this.getTemperatureForApproach(approachMode)
        },
        conversationContext
      );

      if (recommendationResult.fallbackUsed) {
        chatLogger.warn({ userId }, 'Falling back to default recommendations');
      }

      const refusalAdjustedContent = this.recoverOvercautiousRefusal(
        aiResponse.content,
        userMessage,
        approachMode,
        aiResponse.provider,
        keywordCrisis
      );

      // ---- Post-processing safety layer ----
      const processedContent = this.postProcessResponse(refusalAdjustedContent);
      const finalResponseContent = this.ensureNonEmptyResponse(
        processedContent,
        userMessage,
        approachMode,
        aiResponse.provider
      );

      // Save user message and update memory together to avoid extra serial round-trips.
      await Promise.all([
        this.saveChatMessage(userId, userMessage, 'user', {
          sentiment: sentimentSnapshot,
          recommendations: recommendationResult.items
        }, activeConversationId),
        conversationMemoryService.updateMemory(userId, userMessage, 'user')
      ]);

      const botMessage = await this.saveChatMessage(userId, finalResponseContent, 'bot', {
        provider: aiResponse.provider,
        model: aiResponse.model,
        processingTime: aiResponse.processingTime,
        tokensUsed: aiResponse.usage?.total_tokens,
        approach: approachMode,
        wellnessScore: userContext.wellnessScore,
        sentiment: sentimentSnapshot,
        directives,
        recommendations: recommendationResult.items,
        recommendationFocus: recommendationResult.focusAreas,
        recommendationRationale: recommendationResult.rationale
      }, activeConversationId);

      if (pendingRepairContext) {
        await this.markRepairContextResolved(pendingRepairContext.feedbackId);
      }

      // Update conversation memory with bot response
      await conversationMemoryService.updateMemory(userId, finalResponseContent, 'bot');

      // Check and record important moments (emotional peaks/breakthroughs)
      try {
        const hasHighIntensity = enhancedCrisisSentiment && enhancedCrisisSentiment.primary && enhancedCrisisSentiment.primary.intensity >= 8.5;
        const isSevereNegative = sentimentSnapshot && sentimentSnapshot.label === 'negative' && ['sadness', 'fear', 'anger'].includes(sentimentSnapshot.dominantEmotion || '');
        const isSignificantPositive = sentimentSnapshot && sentimentSnapshot.label === 'positive' && ['joy', 'surprise'].includes(sentimentSnapshot.dominantEmotion || '');

        if (hasHighIntensity || isSevereNegative || isSignificantPositive) {
          let topic = 'General';
          if (sentimentSnapshot?.dominantEmotion) {
            topic = sentimentSnapshot.dominantEmotion;
          }
          
          let summary = 'Significant emotional moment';
          let impact: 'high' | 'medium' | 'low' = 'low';

          if (hasHighIntensity) {
            summary = `Intense expression of ${sentimentSnapshot?.dominantEmotion || 'emotion'}`;
            impact = 'high';
          } else if (isSevereNegative) {
            summary = `Expression of distress (${sentimentSnapshot?.dominantEmotion || 'grief'})`;
            impact = 'medium';
          } else if (isSignificantPositive) {
            summary = `Expression of breakthrough or positive shift (${sentimentSnapshot?.dominantEmotion || 'clarity'})`;
            impact = 'medium';
          }

          await conversationMemoryService.recordImportantMoment(
            userId,
            topic,
            summary,
            impact,
            userMessage.slice(0, 200),
            finalResponseContent.slice(0, 200)
          );
        }
      } catch (memError) {
        chatLogger.warn({ err: memError, userId }, 'Failed to record breakthrough important moment');
      }

      // Update conversation timestamp
      if (activeConversationId) {
        await conversationService.updateLastMessageTime(activeConversationId);

        // Generate title if this is a new conversation
        if (newConversationCreated) {
          generatedTitle = await conversationService.generateConversationTitle(activeConversationId);
        }
      }

      chatLogger.info(
        {
          userId,
          conversationId: activeConversationId,
          provider: aiResponse.provider,
          durationMs: aiResponse.processingTime,
          recommendationFallback: recommendationResult.fallbackUsed
        },
        'AI response generated successfully'
      );

      return {
        response: finalResponseContent,
        provider: aiResponse.provider,
        model: aiResponse.model,
        usage: aiResponse.usage,
        botMessage,
        context: `ai-${aiResponse.provider?.toLowerCase()}`,
        conversationId: activeConversationId,
        conversationTitle: generatedTitle,
        recommendations: recommendationResult,
        recommendationsMeta: {
          fallbackUsed: recommendationResult.fallbackUsed,
          message: recommendationResult.fallbackMessage
        }
      };
    } catch (error: any) {
      chatLogger.error({ userId, conversationId: activeConversationId, err: error }, 'Failed to generate AI response, returning fallback');

      // Save user message even on error (preserve metadata if we already computed it)
      await this.saveChatMessage(userId, userMessage, 'user', {
        sentiment: sentimentSnapshot,
        approach: approachMode,
        error: error.message,
        recommendations: recommendationResult?.items ?? []
      }, activeConversationId);

      const fallbackPayload = recommendationResult ?? this.buildEmergencyRecommendationSet(sentimentSnapshot);
      const fallbackResponse = this.getFallbackResponse(userMessage, approachMode);
      const botMessage = await this.saveChatMessage(userId, fallbackResponse, 'bot', {
        provider: 'fallback',
        approach: approachMode,
        sentiment: sentimentSnapshot,
        error: error.message,
        recommendations: fallbackPayload.items ?? []
      }, activeConversationId);

      // Update conversation timestamp even on error
      if (activeConversationId) {
        await conversationService.updateLastMessageTime(activeConversationId);

        // Generate title if this is a new conversation
        if (newConversationCreated) {
          generatedTitle = await conversationService.generateConversationTitle(activeConversationId);
        }
      }

      return {
        response: fallbackResponse,
        provider: 'fallback',
        model: 'system',
        botMessage,
        context: 'fallback',
        conversationId: activeConversationId,
        conversationTitle: generatedTitle,
        recommendations: fallbackPayload,
        recommendationsMeta: {
          fallbackUsed: true,
          message:
            fallbackPayload.fallbackMessage ??
            'We shared a few grounding prompts while our personalised assistant restarts.'
        },
        fallbackMeta: {
          message: 'I shared a supportive prompt while we bring the assistant back online.',
          reason: error?.message
        }
      };
    }
  }

  private async getUserContext(userId: string): Promise<UserContext> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [user, insight, activeGoals, todayIntention, sleepLogs, gratitudeEntries] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          assessments: {
            orderBy: { completedAt: 'desc' },
            take: 5
          },
          moodEntries: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          microCheckins: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          journalEntries: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              prompt: true,
              mood: true,
              tags: true,
              createdAt: true
            }
          }
        }
      }),
      (prisma as any).assessmentInsight?.findUnique({
        where: { userId }
      }) ?? null,
      prisma.conversationGoal.findMany({
        where: { userId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take: 5
      }),
      prisma.dailyIntention.findFirst({
        where: {
          userId,
          createdAt: {
            gte: startOfToday
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.sleepLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 7
      }),
      ((prisma as any).gratitudeEntry
        ? (prisma as any).gratitudeEntry.findMany({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000))
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 6
        })
        : Promise.resolve([])) as Promise<Array<{ id: string; items: unknown; note?: string | null; createdAt: Date }>>
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    let parsedSummary: AssessmentInsightsPayload | null = null;
    if (insight?.summary) {
      try {
        const rawSummary = typeof insight.summary === 'string' ? insight.summary : JSON.stringify(insight.summary);
        parsedSummary = JSON.parse(rawSummary) as AssessmentInsightsPayload;
      } catch (error) {
        parsedSummary = null;
      }
    }

    const insightsByType: Record<string, AssessmentTypeSummary> | undefined =
      parsedSummary?.insights?.byType ?? undefined;
    const wellnessScore =
      insight?.wellnessScore ?? parsedSummary?.insights?.wellnessScore?.value ?? undefined;
    const wellbeingTrend = insight?.overallTrend ?? parsedSummary?.insights?.overallTrend ?? undefined;
    const aiSummary = insight?.aiSummary ?? parsedSummary?.insights?.aiSummary ?? undefined;

    // Parse assessment responses for detailed context
    const detailedAssessments = (user.assessments ?? []).map((assessment: typeof user.assessments[number]) => {
      let responses: Record<string, unknown> | null = null;
      try {
        responses = JSON.parse(assessment.responses);
      } catch (e) {
        responses = null;
      }

      return {
        assessmentType: assessment.assessmentType,
        score: assessment.score,
        completedAt: assessment.completedAt,
        responses,
        interpretation: this.interpretAssessmentScore(assessment.assessmentType, assessment.score),
        specificConcerns: this.extractSpecificConcerns(assessment.assessmentType, responses)
      };
    });

    const moodTrend = this.analyzeMoodTrend(user.moodEntries ?? []);
    const { age, ageGroup } = this.calculateAgeInfo(user.birthday || undefined);
    const recentCheckins = (user.microCheckins ?? []).map((checkin) => ({
      id: checkin.id,
      type: checkin.type,
      mood: checkin.mood,
      createdAt: checkin.createdAt,
      responses:
        checkin.responses && typeof checkin.responses === 'object' && !Array.isArray(checkin.responses)
          ? (checkin.responses as Record<string, unknown>)
          : {}
    }));
    const recentJournals = (user.journalEntries ?? []).map((entry) => ({
      id: entry.id,
      prompt: entry.prompt,
      mood: entry.mood,
      createdAt: entry.createdAt,
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
        : []
    }));
    const recentMoodEntries = (user.moodEntries ?? []).map((entry) => ({
      mood: entry.mood,
      emotion: entry.emotion,
      emotionGroup: entry.emotionGroup,
      intensity: entry.intensity,
      trigger: entry.trigger,
      createdAt: entry.createdAt
    }));
    const recentSleepLogs = (sleepLogs ?? []).map((log) => ({
      id: log.id,
      bedTime: log.bedTime,
      wakeTime: log.wakeTime,
      quality: log.quality,
      duration: log.duration,
      factors: Array.isArray(log.factors)
        ? log.factors.filter((factor): factor is string => typeof factor === 'string')
        : [],
      createdAt: log.createdAt
    }));

    const recentGratitudeEntries = (gratitudeEntries ?? []).map((entry) => {
      const rawItems = Array.isArray(entry.items) ? entry.items : [];
      return {
        id: entry.id,
        items: rawItems.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
        note: entry.note ?? null,
        createdAt: entry.createdAt,
      };
    });

    const sleepDurations = recentSleepLogs
      .map((log) => (typeof log.duration === 'number' ? log.duration : null))
      .filter((value): value is number => value !== null);
    const sleepAverages = {
      weeklyDuration: sleepDurations.length > 0
        ? Number((sleepDurations.reduce((sum, value) => sum + value, 0) / sleepDurations.length).toFixed(2))
        : null,
      weeklyQuality: recentSleepLogs.length > 0
        ? Number((recentSleepLogs.reduce((sum, log) => sum + log.quality, 0) / recentSleepLogs.length).toFixed(2))
        : null
    };

    // Privacy enforcement: if the user has NOT given data consent,
    // exclude detailed assessment scores, mood entries, and personal metrics
    // from the AI prompt context. We still allow the approach and basic profile.
    const privacyRestricted = !user.dataConsent;

    return {
      id: user.id,
      name: user.name,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      age,
      ageGroup,
      region: user.region || undefined,
      language: user.language || undefined,
      approach: user.approach as 'western' | 'eastern' | 'hybrid' | undefined,
      approachEngine: user.approach as 'western' | 'eastern' | 'hybrid' | undefined,
      recentAssessments: privacyRestricted ? [] : detailedAssessments,
      recentCheckins: privacyRestricted ? [] : recentCheckins,
      recentJournals: privacyRestricted ? [] : recentJournals,
      recentMoodEntries: privacyRestricted ? [] : recentMoodEntries,
      todayIntention: privacyRestricted
        ? undefined
        : todayIntention
          ? {
            id: todayIntention.id,
            intention: todayIntention.intention,
            isCustom: todayIntention.isCustom,
            completed: todayIntention.completed,
            reflection: todayIntention.reflection,
            createdAt: todayIntention.createdAt
          }
          : undefined,
          recentGratitudeEntries: privacyRestricted ? [] : recentGratitudeEntries,
      recentSleepLogs: privacyRestricted ? [] : recentSleepLogs,
      sleepAverages: privacyRestricted ? undefined : sleepAverages,
      currentMood: privacyRestricted ? undefined : (user.moodEntries ?? [])[0]?.mood,
      moodTrend: privacyRestricted ? undefined : moodTrend,
      hasCompletedAssessments: privacyRestricted ? false : (user.assessments ?? []).length > 0,
      preferences: {
        emergencyContact: user.emergencyContact,
        dataConsent: user.dataConsent,
        clinicianSharing: user.clinicianSharing
      },
      wellnessScore: privacyRestricted ? undefined : wellnessScore,
      wellbeingTrend: privacyRestricted ? undefined : wellbeingTrend,
      aiSummary: privacyRestricted ? undefined : aiSummary,
      assessmentInsights: privacyRestricted
        ? undefined
        : insightsByType
          ? {
            byType: insightsByType as Record<string, AssessmentTypeSummary>,
            recommendations: this.collectRecommendations(
              insightsByType as Record<string, AssessmentTypeSummary>
            )
          }
          : undefined,
      activeGoals: (activeGoals ?? []).map(g => ({
        goalType: g.goalType,
        title: g.title,
        progress: g.progress,
        status: g.status
      }))
    };
  }

  private collectRecommendations(byType: Record<string, AssessmentTypeSummary>): string[] {
    const recommendations = new Set<string>();
    Object.values(byType).forEach((summary) => {
      summary.recommendations?.forEach((rec) => recommendations.add(rec));
    });
    return Array.from(recommendations);
  }

  private determineConversationApproach(userContext: UserContext, userMessage: string): ApproachMode {
    const normalized = userMessage.toLowerCase();
    const somaticCue = SOMATIC_SIGNAL_PATTERN.test(normalized);
    const cognitiveCue = COGNITIVE_LOOP_PATTERN.test(normalized);

    if (somaticCue && !cognitiveCue) {
      return 'eastern';
    }

    if (cognitiveCue && !somaticCue) {
      return 'western';
    }

    if (somaticCue && cognitiveCue) {
      return userContext.approach || 'hybrid';
    }

    const easternCue = /meditat|mindful|breath|yoga|chakra|ayurveda|pranayama|grounding/.test(normalized);
    const westernCue = /thought|pattern|trigger|therapy|cognitive|cbt|journal/.test(normalized);

    if (easternCue && westernCue) {
      return userContext.approach || 'hybrid';
    }
    if (easternCue) {
      return 'eastern';
    }
    if (westernCue) {
      return 'western';
    }

    if (userContext.approach) {
      return userContext.approach;
    }

    if (userContext.assessmentInsights?.byType) {
      const anxietySummary = userContext.assessmentInsights.byType['anxiety'];
      const stressSummary = userContext.assessmentInsights.byType['stress'];
      if (anxietySummary && anxietySummary.latestScore >= 60) {
        return 'hybrid';
      }
      if (stressSummary && stressSummary.latestScore >= 60) {
        return 'eastern';
      }
    }

    return 'hybrid';
  }

  private estimateSentiment(message: string, enhancedSentiment?: EnhancedSentiment): SentimentSnapshot {
    if (enhancedSentiment) {
      const negativeEmotions = new Set(['sadness', 'anxiety', 'anger', 'fear']);
      const positiveEmotions = new Set(['joy']);
      const primaryEmotion = enhancedSentiment.primary.emotion;

      const label: SentimentSnapshot['label'] = positiveEmotions.has(primaryEmotion)
        ? 'positive'
        : negativeEmotions.has(primaryEmotion)
          ? 'negative'
          : 'neutral';

      const scaledScore = Math.round((enhancedSentiment.primary.confidence * enhancedSentiment.primary.intensity) / 2.5);
      const score = label === 'positive'
        ? Math.max(1, scaledScore)
        : label === 'negative'
          ? -Math.max(1, scaledScore)
          : 0;

      const aiKeywords = [
        ...enhancedSentiment.indicators.progressIndicators,
        ...enhancedSentiment.indicators.concerningPatterns,
      ];

      return {
        label,
        score,
        dominantEmotion: primaryEmotion === 'neutral' ? null : primaryEmotion,
        keywords: Array.from(new Set(aiKeywords)).slice(0, 6),
        summary: `Sentiment ${label} (score ${score})${primaryEmotion !== 'neutral' ? ` with ${primaryEmotion} tone` : ''}`
      };
    }

    const lower = message.toLowerCase();
    let score = 0;
    const matchedKeywords = new Set<string>();

    POSITIVE_WORDS.forEach((word) => {
      if (lower.includes(word)) {
        score += 1;
        matchedKeywords.add(word);
      }
    });

    NEGATIVE_WORDS.forEach((word) => {
      if (lower.includes(word)) {
        score -= 1;
        matchedKeywords.add(word);
      }
    });

    let dominantEmotion: string | null = null;
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      if (keywords.some((keyword) => lower.includes(keyword))) {
        dominantEmotion = emotion;
        break;
      }
    }

    const label = score <= -2 ? 'negative' : score >= 2 ? 'positive' : 'neutral';

    return {
      label,
      score,
      dominantEmotion,
      keywords: Array.from(matchedKeywords),
      summary: `Sentiment ${label} (score ${score})${dominantEmotion ? ` with ${dominantEmotion} tone` : ''}`
    };
  }

  private async analyzeSentimentFastPass(message: string): Promise<EnhancedSentiment> {
    const heuristicSentiment = this.analyzeEnhancedSentiment(message);
    const trimmedMessage = message.trim();

    if (!trimmedMessage || trimmedMessage.length < 8) {
      return heuristicSentiment;
    }

    try {
      const fastPassResponse = await llmService.generateResponse(
        [
          {
            role: 'system',
            content: `You are a sentiment fast-pass classifier for a mental wellness chat app.
Return strictly valid JSON, and nothing else.

Schema:
{
  "primaryEmotion": "joy|sadness|anxiety|anger|fear|neutral",
  "confidence": number, // 0 to 1
  "intensity": number, // 0 to 10
  "crisisRisk": number, // 0 to 1
  "secondaryEmotions": [{ "emotion": string, "confidence": number }],
  "progressIndicators": string[],
  "concerningPatterns": string[],
  "tone": { "formality": number, "urgency": number, "hopefulness": number }
}

Rules:
- Keep values conservative.
- Use "neutral" if uncertain.
- crisisRisk must only be high for direct self-harm or severe safety risk language.
- Output JSON only.`
          },
          {
            role: 'user',
            content: trimmedMessage,
          }
        ],
        {
          temperature: 0,
          maxTokens: 220,
          timeout: 1800,
        }
      );

      const parsed = this.parseFastPassSentiment(fastPassResponse.content);
      if (!parsed) {
        return heuristicSentiment;
      }

      const primaryEmotion = this.normalizeFastPassEmotion(parsed.primaryEmotion);

      const secondary = Array.isArray(parsed.secondaryEmotions)
        ? parsed.secondaryEmotions
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const emotion = typeof entry.emotion === 'string' ? entry.emotion : null;
            const confidence = this.clampNumber(entry.confidence, 0, 1, 0.4);
            if (!emotion) return null;
            return { emotion, confidence };
          })
          .filter((entry): entry is { emotion: string; confidence: number } => Boolean(entry))
          .slice(0, 2)
        : heuristicSentiment.secondary;

      return {
        primary: {
          emotion: primaryEmotion,
          confidence: this.clampNumber(parsed.confidence, 0, 1, heuristicSentiment.primary.confidence),
          intensity: this.clampNumber(parsed.intensity, 0, 10, heuristicSentiment.primary.intensity),
        },
        secondary,
        tone: {
          formality: this.clampNumber(parsed.tone?.formality, 0, 1, heuristicSentiment.tone.formality),
          urgency: this.clampNumber(parsed.tone?.urgency, 0, 1, heuristicSentiment.tone.urgency),
          hopefulness: this.clampNumber(parsed.tone?.hopefulness, 0, 1, heuristicSentiment.tone.hopefulness),
        },
        indicators: {
          crisisRisk: this.clampNumber(parsed.crisisRisk, 0, 1, heuristicSentiment.indicators.crisisRisk),
          progressIndicators: this.sanitizeStringArray(parsed.progressIndicators, heuristicSentiment.indicators.progressIndicators),
          concerningPatterns: this.sanitizeStringArray(parsed.concerningPatterns, heuristicSentiment.indicators.concerningPatterns),
        },
        linguisticFeatures: heuristicSentiment.linguisticFeatures,
      };
    } catch (error) {
      return heuristicSentiment;
    }
  }

  private parseFastPassSentiment(content: string): {
    primaryEmotion?: unknown;
    confidence?: unknown;
    intensity?: unknown;
    crisisRisk?: unknown;
    secondaryEmotions?: Array<{ emotion?: unknown; confidence?: unknown }>;
    progressIndicators?: unknown;
    concerningPatterns?: unknown;
    tone?: { formality?: unknown; urgency?: unknown; hopefulness?: unknown };
  } | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return parsed as {
        primaryEmotion?: unknown;
        confidence?: unknown;
        intensity?: unknown;
        crisisRisk?: unknown;
        secondaryEmotions?: Array<{ emotion?: unknown; confidence?: unknown }>;
        progressIndicators?: unknown;
        concerningPatterns?: unknown;
        tone?: { formality?: unknown; urgency?: unknown; hopefulness?: unknown };
      };
    } catch {
      return null;
    }
  }

  private normalizeFastPassEmotion(value: unknown): EnhancedSentiment['primary']['emotion'] {
    const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
    if (normalized === 'joy' || normalized === 'sadness' || normalized === 'anxiety' || normalized === 'anger' || normalized === 'fear') {
      return normalized;
    }
    return 'neutral';
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, value));
  }

  private sanitizeStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const cleaned = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return cleaned.length > 0 ? cleaned.slice(0, 5) : fallback;
  }

  /**
   * Enhanced sentiment analysis with granular emotion detection
   */
  private analyzeEnhancedSentiment(message: string): EnhancedSentiment {
    const lower = message.toLowerCase();

    // Emotion scoring
    const emotionScores: Record<string, number> = {
      joy: 0,
      sadness: 0,
      anxiety: 0,
      anger: 0,
      fear: 0
    };

    // Joy indicators
    const joyWords = ['happy', 'great', 'wonderful', 'excited', 'grateful', 'better', 'good', 'progress', 'improving', 'hopeful', 'optimistic', 'proud'];
    joyWords.forEach(word => {
      if (lower.includes(word)) emotionScores.joy += 1;
    });

    // Sadness indicators
    const sadnessWords = ['sad', 'depressed', 'down', 'low', 'empty', 'numb', 'hopeless', 'worthless', 'lonely', 'isolated', 'dark', 'heavy'];
    sadnessWords.forEach(word => {
      if (lower.includes(word)) emotionScores.sadness += 1;
    });

    // Anxiety indicators
    const anxietyWords = ['anxious', 'worried', 'nervous', 'panic', 'overwhelmed', 'racing thoughts', 'can\'t stop', 'what if', 'scared', 'tense', 'on edge'];
    anxietyWords.forEach(word => {
      if (lower.includes(word)) emotionScores.anxiety += 1;
    });

    // Anger indicators
    const angerWords = ['angry', 'frustrated', 'annoyed', 'irritated', 'furious', 'mad', 'hate', 'unfair', 'rage'];
    angerWords.forEach(word => {
      if (lower.includes(word)) emotionScores.anger += 1;
    });

    // Fear indicators
    const fearWords = ['afraid', 'terrified', 'scared', 'fear', 'frightened', 'threatening', 'danger', 'unsafe'];
    fearWords.forEach(word => {
      if (lower.includes(word)) emotionScores.fear += 1;
    });

    // Determine primary emotion
    const maxScore = Math.max(...Object.values(emotionScores));
    let primaryEmotion: 'joy' | 'sadness' | 'anxiety' | 'anger' | 'fear' | 'neutral' = 'neutral';

    if (maxScore > 0) {
      const primaryEntry = Object.entries(emotionScores).find(([_, score]) => score === maxScore);
      if (primaryEntry) {
        primaryEmotion = primaryEntry[0] as 'joy' | 'sadness' | 'anxiety' | 'anger' | 'fear';
      }
    }

    // Calculate confidence (0-1)
    const totalEmotionWords = Object.values(emotionScores).reduce((a, b) => a + b, 0);
    const confidence = maxScore > 0 ? Math.min(maxScore / 5, 1) : 0.5;

    // Calculate intensity (0-10)
    const intensity = maxScore > 0 ? Math.min(maxScore * 2, 10) : 5;

    // Get secondary emotions
    const secondary = Object.entries(emotionScores)
      .filter(([emotion, score]) => emotion !== primaryEmotion && score > 0)
      .map(([emotion, score]) => ({
        emotion,
        confidence: Math.min(score / 5, 1)
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);

    // Analyze tone
    const formalWords = ['therefore', 'thus', 'furthermore', 'regarding', 'consequently'];
    const casualWords = ['like', 'kinda', 'sorta', 'yeah', 'stuff', 'things'];
    const formalityScore = formalWords.filter(w => lower.includes(w)).length;
    const casualScore = casualWords.filter(w => lower.includes(w)).length;
    const formality = formalityScore > casualScore ? 0.7 : casualScore > formalityScore ? 0.3 : 0.5;

    const urgencyWords = ['urgent', 'immediately', 'asap', 'emergency', 'critical', 'desperate', 'can\'t wait', 'right now'];
    const urgency = Math.min(urgencyWords.filter(w => lower.includes(w)).length / 3, 1);

    const hopeWords = ['hope', 'maybe', 'try', 'possibly', 'chance', 'looking forward', 'optimistic'];
    const hopelessWords = ['hopeless', 'pointless', 'useless', 'no point', 'give up', 'can\'t see'];
    const hopeScore = hopeWords.filter(w => lower.includes(w)).length;
    const hopelessScore = hopelessWords.filter(w => lower.includes(w)).length;
    const hopefulness = hopeScore > hopelessScore ? 0.7 : hopelessScore > hopeScore ? 0.2 : 0.5;

    // Crisis risk indicators
    const crisisWords = ['suicide', 'kill myself', 'end it all', 'better off dead', 'self-harm', 'hurt myself', 'no reason to live'];
    const crisisRisk = Math.min(crisisWords.filter(w => lower.includes(w)).length / 2, 1);

    // Progress indicators
    const progressWords = ['better', 'improving', 'progress', 'working', 'trying', 'learning', 'growing'];
    const progressIndicators = progressWords.filter(w => lower.includes(w));

    // Concerning patterns
    const concerningWords = ['always anxious', 'never happy', 'can\'t cope', 'falling apart', 'losing control', 'can\'t function'];
    const concerningPatterns = concerningWords.filter(w => lower.includes(w));

    // Linguistic features
    const questionCount = (message.match(/\?/g) || []).length;
    const exclamationCount = (message.match(/!/g) || []).length;
    const negationWords = ['not', 'no', 'never', 'nothing', 'nobody', 'nowhere', 'neither', 'none'];
    const negationCount = negationWords.filter(w => lower.includes(w)).length;
    const firstPersonWords = ['i ', 'i\'m', 'i\'ve', 'i\'ll', 'my ', 'me ', 'myself'];
    const firstPersonCount = firstPersonWords.filter(w => lower.includes(w)).length;
    const absoluteWords = ['always', 'never', 'completely', 'totally', 'entirely', 'absolutely', 'every', 'all', 'none'];
    const foundAbsolutes = absoluteWords.filter(w => lower.includes(w));

    return {
      primary: {
        emotion: primaryEmotion,
        confidence,
        intensity
      },
      secondary,
      tone: {
        formality,
        urgency,
        hopefulness
      },
      indicators: {
        crisisRisk,
        progressIndicators,
        concerningPatterns
      },
      linguisticFeatures: {
        questionCount,
        exclamationCount,
        negationCount,
        firstPersonCount,
        absoluteWords: foundAbsolutes
      }
    };
  }

  private buildCoachingDirectives(
    approach: ApproachMode,
    userContext: UserContext,
    sentiment: SentimentSnapshot
  ): CoachingDirectives {
    const byType = (userContext.assessmentInsights?.byType ?? {}) as Record<string, AssessmentTypeSummary>;
    const westernFocus: string[] = [];
    const easternPractices: string[] = [];
    const hybridBridge: string[] = [];
    const reminders: string[] = [];

    const anxietySummary = byType['anxiety'];
    const stressSummary = byType['stress'];
    const overthinkingSummary = byType['overthinking'];
    const emotionalIntelligenceSummary = byType['emotionalIntelligence'];

    if (anxietySummary && anxietySummary.latestScore >= 60) {
      westernFocus.push('Name anxious prediction loops and guide a CBT-style reframe with evidence.');
      easternPractices.push('Lead a calming breath such as 4-7-8 breathing to quiet the nervous system.');
    }

    if (stressSummary && stressSummary.latestScore >= 60) {
      westernFocus.push('Break overwhelming tasks into micro-steps and prioritise one action they can take.');
      easternPractices.push('Suggest a five-minute mindful walk noticing breath and sensations.');
    }

    if (overthinkingSummary && overthinkingSummary.latestScore >= 60) {
      westernFocus.push('Encourage thought-labeling and a worry journal to park looping thoughts.');
      easternPractices.push('Offer a sound-based grounding meditation to interrupt rumination.');
    }

    if (emotionalIntelligenceSummary && emotionalIntelligenceSummary.latestScore < 50) {
      westernFocus.push('Help them name the emotion, the trigger, and the need underneath it.');
      easternPractices.push('Invite a compassion-based mantra repeating “I am allowed to feel and release this.”');
    }

    if (sentiment.label === 'negative') {
      westernFocus.push('Affirm their feeling, then co-create a realistic experiment or boundary to regain control.');
      reminders.push('Keep tone warm, trauma-informed, and avoid minimizing difficult emotions.');
    } else if (sentiment.label === 'positive') {
      westernFocus.push('Reinforce what is working and highlight strengths they mentioned.');
      reminders.push('Celebrate progress briefly, then invite them to anchor the helpful pattern.');
    } else {
      reminders.push('Balance validation with gentle curiosity to surface underlying needs.');
    }

    if (userContext.wellnessScore && userContext.wellnessScore < 55) {
      hybridBridge.push('Mention their wellness index and encourage tracking one daily micro-win.');
    }

    if (approach === 'hybrid') {
      hybridBridge.push(...HYBRID_BRIDGES.slice(0, 2));
    } else if (approach === 'western') {
      westernFocus.push('Use evidence-based language (CBT, behavioral activation, journaling prompts).');
    } else if (approach === 'eastern') {
      easternPractices.push('Guide a short mindfulness ritual or somatic release aligned with their energy.');
    }

    if (easternPractices.length === 0) {
      easternPractices.push(...EASTERN_PRACTICES.slice(0, 2));
    }

    if (westernFocus.length === 0) {
      westernFocus.push(...WESTERN_TECHNIQUES.slice(0, 2));
    }

    if (hybridBridge.length === 0) {
      hybridBridge.push(HYBRID_BRIDGES[0]);
    }

    if (reminders.length === 0) {
      reminders.push('Close with a gentle invitation to share how the suggestion lands and offer professional resources if distress escalates.');
    }

    return {
      westernFocus: Array.from(new Set(westernFocus)).slice(0, 3),
      easternPractices: Array.from(new Set(easternPractices)).slice(0, 3),
      hybridBridge: Array.from(new Set(hybridBridge)).slice(0, 2),
      reminders: Array.from(new Set(reminders)).slice(0, 2)
    };
  }

  private buildSystemPrompt(args: {
    approach: ApproachMode;
    userContext: UserContext;
    sentiment: SentimentSnapshot;
    directives: CoachingDirectives;
    progressSignals?: ProgressSignal[];
    recommendations?: RecommendationResult['items'];
    memoryContext?: any;
    contextInsight?: any;
    feedbackSummary?: string;
    repairContext?: PendingRepairContext;
  }): string {
    const {
      approach,
      userContext,
      sentiment,
      directives,
      progressSignals = [],
      recommendations = [],
      memoryContext,
      contextInsight,
      feedbackSummary,
      repairContext
    } = args;

    const wellnessText = userContext.wellnessScore
      ? `${userContext.wellnessScore.toFixed(1)} / 100`
      : 'not yet calculated';

    const trendText = userContext.wellbeingTrend ?? 'trend unavailable';
    const culturalPromptSection = this.buildCulturalPromptSection(userContext);
    const simpleLanguageSection = this.buildSimpleLanguageSection(Boolean(userContext.simpleLanguage));

    const recommendationHighlights = userContext.assessmentInsights?.recommendations?.slice(0, 2) ?? [];
    const recommendationText = recommendationHighlights.length
      ? `Key personalised recommendations so far:\n- ${recommendationHighlights.join('\n- ')}`
      : 'No stored recommendations yet—use the insights below to craft new ones.';

    const domainText = userContext.assessmentInsights?.byType
      ? `Latest assessment signals:\n${Object.entries(
        userContext.assessmentInsights.byType as Record<string, AssessmentTypeSummary>
      )
        .slice(0, 4)
        .map(([type, summary]) => {
          const label = type
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (c) => c.toUpperCase());
          return `- ${label.trim()}: score ${Math.round(summary.latestScore || 0)} (normalized ${Math.round(
            summary.normalizedScore || 0
          )}, trend ${summary.trend})`;
        })
        .join('\n')}`
      : null;

    const recommendationLines = recommendations.slice(0, 3).map((item) => {
      const sourceTag = item.source === 'library' ? 'library' : 'fallback';
      return `- ${item.title} (${item.type}) → ${item.reason} [${sourceTag}]`;
    });

    const recommendationSection = recommendationLines.length
      ? `Recommended resources to consider next:\n${recommendationLines.join('\n')}`
      : null;

    const progressSection = progressSignals.length
      ? `Progress signals to optionally acknowledge (mention at most one naturally):\n${progressSignals
        .slice(0, 4)
        .map((signal) => `${signal.direction === 'improving' ? '✅' : '⚠️'} ${signal.detail}`)
        .join('\n')}`
      : null;

    const repairSection = repairContext
      ? `CONVERSATIONAL REPAIR CONTEXT:\nThe user marked your previous response as unhelpful on ${repairContext.createdAt.toLocaleString()}.\nDisliked reply excerpt: "${repairContext.dislikedMessagePreview}"${repairContext.note ? `\nWhat the user said would help: "${repairContext.note}"` : ''}\nFor this response, begin with a short acknowledgement and ask what support they want right now before giving suggestions.`
      : null;

    const checkinSection = userContext.recentCheckins && userContext.recentCheckins.length > 0
      ? `Recent micro check-ins:\n${userContext.recentCheckins
        .slice(0, 4)
        .map((checkin) => {
          const responses = checkin.responses || {};
          if (checkin.type === 'morning') {
            const energy = typeof responses.energyLevel === 'number' ? responses.energyLevel : 'n/a';
            const dreading = typeof responses.dreading === 'string' ? responses.dreading : null;
            const lookingForward = typeof responses.lookingForward === 'string' ? responses.lookingForward : null;
            return `- Morning check-in: energy ${energy}/5${dreading ? `, dreading "${dreading}"` : ''}${lookingForward ? `, looking forward to "${lookingForward}"` : ''}`;
          }
          if (checkin.type === 'evening') {
            const dayRating =
              typeof responses.dayRating === 'number'
                ? responses.dayRating
                : typeof responses.overallDay === 'number'
                  ? responses.overallDay
                  : 'n/a';
            const smallWin =
              typeof responses.smallWin === 'string'
                ? responses.smallWin
                : typeof responses.wentWell === 'string'
                  ? responses.wentWell
                  : null;
            const grateful = typeof responses.grateful === 'string' ? responses.grateful : null;
            const energyCompared = typeof responses.energyCompared === 'string' ? responses.energyCompared : null;
            return `- Evening reflection: day ${dayRating}/5${smallWin ? `, small win "${smallWin}"` : ''}${grateful ? `, grateful for "${grateful}"` : ''}${energyCompared ? `, energy vs morning "${energyCompared}"` : ''}`;
          }
          const helpfulness = typeof responses.helpfulness === 'number' ? responses.helpfulness : 'n/a';
          return `- Post-chat check-in: helpfulness ${helpfulness}/5`;
        })
        .join('\n')}`
      : null;

    const journalSection = userContext.recentJournals && userContext.recentJournals.length > 0
      ? `Recent journal themes (do not quote private content):\n${userContext.recentJournals
        .slice(0, 4)
        .map((entry) => {
          const tagsText = entry.tags.length > 0 ? entry.tags.join(', ') : 'general reflection';
          const moodText = entry.mood ? `mood ${entry.mood}` : 'mood unspecified';
          return `- ${new Date(entry.createdAt).toLocaleDateString()}: ${moodText}; themes: ${tagsText}`;
        })
        .join('\n')}\nUse this as light context only. Never claim to have read exact private journal wording.`
      : null;

    const directivesText = [
      directives.westernFocus.length
        ? `Conversation focus (western):
- ${directives.westernFocus.join('\n- ')}`
        : null,
      directives.easternPractices.length
        ? `Somatic / mindfulness suggestions (eastern):
- ${directives.easternPractices.join('\n- ')}`
        : null,
      directives.hybridBridge.length
        ? `Bridge ideas to blend mind and body work:
- ${directives.hybridBridge.join('\n- ')}`
        : null,
      directives.reminders.length
        ? `Coaching reminders:
- ${directives.reminders.join('\n- ')}`
        : null
    ]
      .filter(Boolean)
      .join('\n\n');

    // Build conversation memory context
    let memorySection = '';
    if (memoryContext) {
      memorySection += `\nCONVERSATION MEMORY (You MUST use this history to personalize your response and demonstrate you remember the user's situation):\n`;
      if (memoryContext.recentTopics && memoryContext.recentTopics.length > 0) {
        memorySection += `\nRECENT CONVERSATION TOPICS:\n`;
        memorySection += memoryContext.recentTopics.slice(0, 5).map((topic: any) =>
          `- ${topic.topic} (mentioned ${topic.effectiveMentions ?? topic.mentions ?? 0} times, last on ${new Date(topic.lastMentioned).toLocaleDateString()})`
        ).join('\n');
      }

      if (memoryContext.recurringThemes && memoryContext.recurringThemes.length > 0) {
        memorySection += `\n\nRECURRING THEMES TO BE AWARE OF:\n`;
        memorySection += memoryContext.recurringThemes.slice(0, 3).map((theme: string) => `- ${theme}`).join('\n');
      }

      if (memoryContext.emotionalPatterns) {
        const { predominant, recentShift } = memoryContext.emotionalPatterns;
        if (predominant) {
          memorySection += `\n\nEMOTIONAL PATTERNS:\n`;
          memorySection += `Predominant mood: ${predominant}\n`;
          if (recentShift) {
            memorySection += `Recent shift: ${recentShift}\n`;
          }
        }
      }

      if (memoryContext.conversationStyle) {
        memorySection += `\nCONVERSATION STYLE:\n`;
        memorySection += `User prefers ${memoryContext.conversationStyle.preferredLength} responses and engages at ${memoryContext.conversationStyle.responsiveness} level.\n`;
      }
    }

    // Build contextual awareness section
    let contextSection = '';
    if (contextInsight) {
      contextSection = contextAwarenessService.buildContextPrompt(contextInsight);
    }

    // Build active goals section
    let goalsSection = '';
    if (userContext.activeGoals && userContext.activeGoals.length > 0) {
      goalsSection = `\nACTIVE WELLBEING GOALS:\n`;
      goalsSection += userContext.activeGoals.map(g =>
        `- ${g.title} (${g.goalType.replace(/_/g, ' ')}) — ${g.progress}% complete`
      ).join('\n');
      goalsSection += `\nGently reference these goals when relevant to motivate progress, but do not force them into every response.`;
    }

    return [
      `You are a compassionate wellbeing coach. ${APPROACH_DESCRIPTIONS[approach]}`,
      `Overall mental wellness score: ${wellnessText}. Trend: ${trendText}.`,
      userContext.aiSummary ? `Previous AI summary cue: ${userContext.aiSummary}` : null,
      domainText,
      `Latest message sentiment: ${sentiment.summary}. Keywords: ${sentiment.keywords.length ? sentiment.keywords.join(', ') : 'none detected'
      }`,
      culturalPromptSection,
      simpleLanguageSection,
      recommendationText,
      recommendationSection,
      progressSection,
      repairSection,
      checkinSection,
      journalSection,
      directivesText,
      memorySection || null,
      contextSection || null,
      goalsSection || null,
      this.buildAssessmentDetailSection(userContext),
      this.buildMoodSection(userContext),
      this.buildIntentionSection(userContext),
      this.buildGratitudeSection(userContext),
      this.buildSleepSection(userContext),
      feedbackSummary || null,
      `CONVERSATIONAL PERSONALITY (core identity):
You are ManaSarathi — a warm, grounded friend who genuinely cares and has wellness expertise.
You speak like a real person having a real conversation, not a chatbot following a script.

YOUR APPROACH STYLE (${approach}):
${approach === 'western'
  ? `You lean on cognitive and behavioral tools. When suggesting something, naturally weave in ideas like reframing thoughts, noticing thinking patterns, behavioral experiments, or evidence-based coping — but as a friend would mention them, not as a textbook would list them. Example: "Have you noticed that thought might be a bit of catastrophizing? Sometimes it helps to ask — what's the actual evidence here?"`
  : approach === 'eastern'
  ? `You lean on contemplative and body-based wisdom. When the moment calls for it, naturally suggest breathwork, mindfulness, somatic awareness, gentle movement, or compassion practices — but as a friend who practices these, not as an instructor. Example: "Hmm, it sounds like your body is holding a lot of that tension. Want to try a few slow breaths together?"`
  : `You blend cognitive clarity with body-based calm. Sometimes that means helping someone reframe a thought, sometimes it means guiding them into a breath — read what they need. Example: "That's a heavy thought to carry. Let's look at it together — and maybe take a breath first."`
}

HOW TO RESPOND:
- Start with what feels natural. Sometimes that's validation, sometimes it's a question, sometimes it's just sitting with what they said.
- Don't follow a formula. Read the room. If they said something heavy, don't rush to offer a "practical tip" — just hold space first.
- Only ask a question when you genuinely need to understand something better, or when a gentle check-in would feel natural. Do NOT end every response with a question.
- If the user is venting, let them vent. Reflect back what you heard. You don't always need to fix things.
- If the user shares good news or progress, celebrate it genuinely. Don't immediately pivot to "what else can we work on?"
- Match the user's energy and tone. Casual user → casual reply. Distressed user → calm, grounded reply. Playful user → match that lightness.
- Shorter is almost always better. A heartfelt 2-sentence reply beats a structured 5-paragraph essay.
- Use natural language. Say "That sounds really tough" not "I acknowledge the difficulty you are experiencing."
- Use contractions (I'm, you're, that's, it's) — they sound human.
- Occasionally use gentle conversational phrases like "hmm", "you know", "honestly" to feel more natural.
- When suggesting something, frame it as a friend would: "Have you tried..." or "Something that helps a lot of people is..." — never "Step 1: Do X. Step 2: Do Y."

WHEN TO ASK QUESTIONS:
- When you need clarity: "When you say overwhelmed, what does that feel like for you?"
- When checking in after they've been quiet: "How are things going today?"
- When they mention something you want to explore: "Tell me more about that?"
- Do NOT ask a question at the end of every single response. Sometimes the right move is a warm statement that leaves space: "I'm glad you shared that with me."

NEVER:
- Use formulaic section headers (### Practical Next Step, ### Check-in) in responses.
- Say "everything will be fine", "just stay positive", or any toxic positivity.
- Give clinical diagnoses, medication names, or dosage advice.
- Claim "I understand exactly how you feel."
- Give preachy monologues or motivational speeches.
- Minimize suffering with "at least...", "others have it worse", or "it's not that bad."
- End every response with a question.

ALWAYS:
- Acknowledge difficulty without minimizing it.
- Offer suggestions as gentle invitations, not instructions.
- Keep responses under ~120 words. Aim for 40–80 words when brevity fits the moment.
- Be trauma-informed: never push someone to share more than they want.
- Remind about professional help if severe distress or risk is disclosed.
- You are a wellness companion, NOT a licensed therapist — never claim otherwise.`
      ,
      `FORMAT (strict):
- Write in natural paragraphs, not bullet-point lists (unless listing exercises).
- Use Markdown only when it genuinely helps (bold for emphasis, not for rigid structure).
- Avoid walls of text. One or two short paragraphs is usually enough.
- Do NOT use rigid section headers. Flow naturally like a real conversation.`
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildCulturalPromptSection(userContext: UserContext): string | null {
    if (!userContext.region && !userContext.language) {
      return null;
    }

    const locationText = userContext.region
      ? `User location context: ${userContext.region}.`
      : null;
    const languageText = userContext.language
      ? `Preferred language context: ${userContext.language}.`
      : null;

    return [
      'CULTURAL ADAPTATION GUIDANCE:',
      locationText,
      languageText,
      '- Avoid assumptions about identity, family structure, religion, or finances.',
      '- Use culturally respectful language and practical examples that can fit local context.',
      '- Prefer globally understandable wording over niche idioms or region-specific slang.',
      '- When suggesting external support, acknowledge local or community resources may vary by region.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSimpleLanguageSection(simpleLanguageEnabled: boolean): string | null {
    if (!simpleLanguageEnabled) {
      return null;
    }

    return [
      'SIMPLE LANGUAGE MODE (must follow):',
      '- Use short, direct sentences and common words.',
      '- Explain one idea at a time and avoid jargon.',
      '- If a clinical term is needed, define it in plain language immediately.',
      '- Offer one clear next step before asking the closing question.',
      '- Keep tone warm and respectful while staying easy to understand.'
    ].join('\n');
  }

  private getTemperatureForApproach(approach: ApproachMode): number {
    switch (approach) {
      case 'western':
        return 0.55;
      case 'eastern':
        return 0.7;
      default:
        return 0.65;
    }
  }

  private getMaxTokensForApproach(approach: ApproachMode): number {
    switch (approach) {
      case 'western':
        return 220;
      case 'eastern':
        return 240;
      default:
        return 240;
    }
  }

  private recoverOvercautiousRefusal(
    content: string,
    userMessage: string,
    approach: ApproachMode,
    provider?: string,
    keywordCrisis = false
  ): string {
    const trimmed = content.trim();
    if (!trimmed) {
      return content;
    }

    const refusalPatterns: RegExp[] = [
      /i can(?:not|'t)\s+(?:provide|assist|help|engage).{0,160}(?:self-harm|suicide|harming yourself)/i,
      /if you[’']?re experiencing thoughts of self-harm or suicide/i,
      /i can(?:not|'t)\s+engage in this conversation/i,
      /i can(?:not|'t)\s+provide a response that includes a monologue/i,
      /^(?:i can(?:not|'t)|sorry,\s*i can(?:not|'t))\s+(?:help|assist)(?:\s+with that)?\.?$/i
    ];

    const looksLikeRefusal = refusalPatterns.some((pattern) => pattern.test(trimmed));
    if (!looksLikeRefusal) {
      return content;
    }

    if (keywordCrisis || this.detectCrisisLanguage(userMessage)) {
      return content;
    }

    chatLogger.warn({ provider }, 'Recovered non-crisis provider refusal with supportive fallback response');
    return this.getFallbackResponse(userMessage, approach);
  }

  /**
   * Post-processing safety layer — filters AI responses for quality and safety.
   * Runs after LLM output and before saving to DB.
   */
  private postProcessResponse(content: string): string {
    let processed = content;

    // 1. Toxic positivity filter — replace banned phrases with safer alternatives
    const toxicReplacements: [RegExp, string][] = [
      [/everything will be (fine|okay|ok|alright)/gi, 'things can feel difficult right now, and that\'s valid'],
      [/just (stay|be|think) positive/gi, 'it\'s okay to feel what you\'re feeling'],
      [/look on the bright side/gi, 'let\'s gently explore what might help'],
      [/others have it worse/gi, 'your experience matters'],
      [/it('s| is) not that bad/gi, 'what you\'re going through is real'],
      [/I understand exactly how you feel/gi, 'I hear you, and what you\'re sharing matters'],
    ];

    for (const [pattern, replacement] of toxicReplacements) {
      if (pattern.test(processed)) {
        chatLogger.warn({ pattern: pattern.source }, 'Post-processing: replaced toxic positivity phrase');
        processed = processed.replace(pattern, replacement);
      }
    }

    // 2. Clinical claims filter — log warnings for medication/diagnostic language
    const clinicalPatterns = [
      /\b(prescri(?:be|ption)|dosage|milligrams?|mg\b)/i,
      /\b(diagnos(?:e|is|ed)|you (?:have|suffer from) (?:depression|anxiety|PTSD|bipolar|OCD))/i,
    ];

    for (const pattern of clinicalPatterns) {
      if (pattern.test(processed)) {
        chatLogger.warn({ pattern: pattern.source }, 'Post-processing: clinical language detected in AI response');
      }
    }

    // 3. Length enforcement — truncate at sentence boundary if over 200 words
    const words = processed.split(/\s+/);
    if (words.length > 200) {
      const truncated = words.slice(0, 200).join(' ');
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('?'),
        truncated.lastIndexOf('!')
      );
      processed = lastSentenceEnd > 0 ? truncated.slice(0, lastSentenceEnd + 1) : truncated + '...';
      chatLogger.warn({ originalWords: words.length }, 'Post-processing: response truncated for length');
    }

    // 4. Enforce readable structure when model output is a dense paragraph
    processed = this.ensureStructuredMarkdown(processed);

    return processed;
  }

  private ensureStructuredMarkdown(content: string): string {
    const trimmed = content.trim();
    if (!trimmed) return trimmed;

    const hasStructure = /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+\.\s)/m.test(trimmed);
    if (hasStructure) {
      return trimmed;
    }

    const sentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length <= 3) {
      return trimmed;
    }

    // Split dense text into 2-3 short, natural paragraphs separated by double newlines,
    // ensuring the closing question forms its own paragraph.
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    const questionCandidate = [...sentences].reverse().find((s) => s.includes('?'));

    sentences.forEach((sentence) => {
      if (sentence === questionCandidate) {
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
        paragraphs.push(sentence);
      } else {
        currentParagraph.push(sentence);
        if (currentParagraph.length >= 2) {
          paragraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
      }
    });

    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '));
    }

    return paragraphs.join('\n\n');
  }

  private ensureNonEmptyResponse(
    content: string,
    userMessage: string,
    approach: ApproachMode,
    provider?: string
  ): string {
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    const fallback = this.getFallbackResponse(userMessage, approach);
    chatLogger.warn({ provider, approach }, 'AI provider returned empty content; using fallback response');
    return fallback;
  }

  /**
   * Build a detailed per-assessment section for the system prompt.
   * Surfaces individual assessment scores, interpretations, and specific concerns.
   */
  private buildAssessmentDetailSection(userContext: UserContext): string | null {
    if (!userContext.recentAssessments || userContext.recentAssessments.length === 0) {
      return null;
    }

    const lines = userContext.recentAssessments.slice(0, 4).map((a: any) => {
      const concerns = a.specificConcerns?.length
        ? ` (concerns: ${a.specificConcerns.join(', ')})`
        : '';
      const dateStr = a.completedAt
        ? new Date(a.completedAt).toLocaleDateString()
        : 'unknown date';
      return `- ${a.assessmentType}: score ${a.score} — ${a.interpretation}${concerns} [${dateStr}]`;
    });

    return `DETAILED ASSESSMENT HISTORY:\n${lines.join('\n')}\nUse this context to personalize your responses. Reference relevant concerns when appropriate, but do not recite scores.`;
  }

  /**
   * Build a mood section for the system prompt.
   */
  private buildMoodSection(userContext: UserContext): string | null {
    const granularMoods = (userContext.recentMoodEntries ?? [])
      .filter((entry) => Boolean(entry.emotion))
      .slice(0, 4);

    if (!userContext.currentMood && !userContext.moodTrend && granularMoods.length === 0) {
      return null;
    }

    const parts: string[] = [];
    if (userContext.currentMood) {
      parts.push(`Current mood: ${userContext.currentMood}`);
    }
    if (userContext.moodTrend) {
      parts.push(`Mood trend: ${userContext.moodTrend}`);
    }

    if (granularMoods.length > 0) {
      const emotionLine = granularMoods
        .map((entry) => {
          const intensityText = typeof entry.intensity === 'number' ? `intensity ${entry.intensity}/10` : null;
          const triggerText = entry.trigger ? `trigger: ${entry.trigger}` : null;
          const details = [intensityText, triggerText].filter(Boolean).join(', ');
          return details ? `${entry.emotion} (${details})` : entry.emotion;
        })
        .join(', ');

      parts.push(`Granular emotions: ${emotionLine}`);
    }

    return `USER MOOD:\n${parts.join('. ')}.`;
  }

  private buildIntentionSection(userContext: UserContext): string | null {
    if (!userContext.todayIntention) {
      return null;
    }

    const status = userContext.todayIntention.completed === null
      ? 'not yet reflected'
      : userContext.todayIntention.completed
        ? 'completed'
        : 'not completed';

    const reflectionText = userContext.todayIntention.reflection
      ? ` Reflection: "${userContext.todayIntention.reflection}".`
      : '';

    return `TODAY'S INTENTION:\n"${userContext.todayIntention.intention}" (status: ${status}).${reflectionText}`;
  }

  private buildGratitudeSection(userContext: UserContext): string | null {
    const entries = (userContext.recentGratitudeEntries ?? [])
      .filter((entry) => Array.isArray(entry.items) && entry.items.length > 0)
      .slice(0, 3);

    if (entries.length === 0) {
      return null;
    }

    const lines = entries.map((entry) => {
      const gratitudeItems = entry.items.slice(0, 3).join(', ');
      const dateText = new Date(entry.createdAt).toLocaleDateString();
      const noteText = entry.note ? ` Note: ${entry.note}` : '';
      return `- ${dateText}: grateful for ${gratitudeItems}.${noteText}`;
    });

    return `RECENT GRATITUDE CONTEXT:\n${lines.join('\n')}\nIf relevant, acknowledge these as strengths and protective factors without sounding repetitive.`;
  }

  private buildSleepSection(userContext: UserContext): string | null {
    const latestSleep = userContext.recentSleepLogs?.[0];
    const averages = userContext.sleepAverages;

    if (!latestSleep && !averages) {
      return null;
    }

    const lines: string[] = [];

    if (latestSleep) {
      const durationText = typeof latestSleep.duration === 'number'
        ? `${latestSleep.duration.toFixed(1)} hours`
        : 'duration unavailable';
      const factorsText = latestSleep.factors.length > 0
        ? `, disrupted by ${latestSleep.factors.slice(0, 3).join(', ')}`
        : '';
      lines.push(`Last sleep log: ${durationText}, quality ${latestSleep.quality}/5${factorsText}.`);
    }

    if (averages && (averages.weeklyDuration !== null || averages.weeklyQuality !== null)) {
      const avgDuration = averages.weeklyDuration !== null ? `${averages.weeklyDuration.toFixed(1)} hours` : 'n/a';
      const avgQuality = averages.weeklyQuality !== null ? `${averages.weeklyQuality.toFixed(1)}/5` : 'n/a';
      lines.push(`7-day average sleep: ${avgDuration}, quality ${avgQuality}.`);
    }

    if (lines.length === 0) {
      return null;
    }

    return `SLEEP CONTEXT:\n${lines.join(' ')}`;
  }

  /**
   * Query recent message feedback to build an adaptive hint for the AI.
   */
  private async buildFeedbackSummary(userId: string): Promise<string | null> {
    try {
      const recentFeedback = await prisma.chatFeedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { helpful: true }
      });

      if (recentFeedback.length === 0) {
        return this.buildLegacyFeedbackSummary(userId);
      }

      const liked = recentFeedback.filter((entry) => entry.helpful).length;
      const disliked = recentFeedback.length - liked;

      const total = liked + disliked;
      if (total < 2) return null; // Not enough data

      const likeRate = Math.round((liked / total) * 100);

      let hint = `USER FEEDBACK PATTERN: ${liked} liked / ${disliked} disliked out of ${total} rated responses (${likeRate}% approval).`;
      if (likeRate < 50) {
        hint += '\nThe user has been dissatisfied with recent responses. Try shorter, more empathetic replies with fewer suggestions.';
      } else if (likeRate >= 80) {
        hint += '\nThe user responds well to your current style. Maintain this approach.';
      }

      return hint;
    } catch (error) {
      chatLogger.warn({ error }, 'Failed to build feedback summary');
      return null;
    }
  }

  private async buildLegacyFeedbackSummary(userId: string): Promise<string | null> {
    const recentBotMessages = await prisma.chatMessage.findMany({
      where: { userId, type: 'bot' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { metadata: true }
    });

    let liked = 0;
    let disliked = 0;

    for (const msg of recentBotMessages) {
      if (!msg.metadata) continue;
      try {
        const meta = JSON.parse(msg.metadata);
        if (meta.feedback === 'liked') liked++;
        if (meta.feedback === 'disliked') disliked++;
      } catch {
        // Skip unparseable metadata payloads
      }
    }

    const total = liked + disliked;
    if (total < 2) {
      return null;
    }

    const likeRate = Math.round((liked / total) * 100);
    let hint = `USER FEEDBACK PATTERN: ${liked} liked / ${disliked} disliked out of ${total} rated responses (${likeRate}% approval).`;

    if (likeRate < 50) {
      hint += '\nThe user has been dissatisfied with recent responses. Try shorter, more empathetic replies with fewer suggestions.';
    } else if (likeRate >= 80) {
      hint += '\nThe user responds well to your current style. Maintain this approach.';
    }

    return hint;
  }

  private async getPendingRepairContext(userId: string): Promise<PendingRepairContext | null> {
    const pendingFeedback = await prisma.chatFeedback.findFirst({
      where: {
        userId,
        helpful: false,
        resolvedAt: null
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        note: true,
        message: {
          select: {
            content: true
          }
        }
      }
    });

    if (!pendingFeedback) {
      return null;
    }

    const thirtyMinutesMs = 30 * 60 * 1000;
    if (Date.now() - pendingFeedback.createdAt.getTime() > thirtyMinutesMs) {
      return null;
    }

    const preview = pendingFeedback.message.content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    return {
      feedbackId: pendingFeedback.id,
      createdAt: pendingFeedback.createdAt,
      note: pendingFeedback.note,
      dislikedMessagePreview: preview
    };
  }

  private async markRepairContextResolved(feedbackId: string): Promise<void> {
    try {
      await prisma.chatFeedback.update({
        where: { id: feedbackId },
        data: { resolvedAt: new Date() }
      });
    } catch (error) {
      chatLogger.warn({ feedbackId, error }, 'Failed to mark feedback as repair-resolved');
    }
  }

  /**
   * Interpret assessment scores to provide meaningful context
   */
  private interpretAssessmentScore(assessmentType: string, score: number): string {
    switch (assessmentType.toLowerCase()) {
      case 'phq-9':
      case 'depression':
        if (score <= 4) return 'minimal depression';
        if (score <= 9) return 'mild depression';
        if (score <= 14) return 'moderate depression';
        if (score <= 19) return 'moderately severe depression';
        return 'severe depression';

      case 'gad-7':
      case 'anxiety':
        if (score <= 4) return 'minimal anxiety';
        if (score <= 9) return 'mild anxiety';
        if (score <= 14) return 'moderate anxiety';
        return 'severe anxiety';

      case 'stress':
        if (score <= 3) return 'low stress';
        if (score <= 6) return 'moderate stress';
        if (score <= 8) return 'high stress';
        return 'very high stress';

      case 'emotionalintelligence':
        if (score >= 8) return 'high emotional intelligence';
        if (score >= 6) return 'moderate emotional intelligence';
        return 'developing emotional intelligence';

      default:
        return score > 5 ? 'elevated concerns' : 'manageable levels';
    }
  }

  /**
   * Extract specific concerns from assessment responses
   */
  private extractSpecificConcerns(assessmentType: string, responses: any): string[] {
    if (!responses || typeof responses !== 'object') return [];

    const concerns: string[] = [];

    try {
      // PHQ-9 specific concerns
      if (assessmentType.toLowerCase().includes('phq') || assessmentType.toLowerCase().includes('depression')) {
        if (responses['sleep'] && parseInt(responses['sleep']) > 2) concerns.push('sleep difficulties');
        if (responses['appetite'] && parseInt(responses['appetite']) > 2) concerns.push('appetite changes');
        if (responses['concentration'] && parseInt(responses['concentration']) > 2) concerns.push('concentration issues');
        if (responses['energy'] && parseInt(responses['energy']) > 2) concerns.push('low energy');
        if (responses['selfEsteem'] && parseInt(responses['selfEsteem']) > 2) concerns.push('self-esteem issues');
      }

      // GAD-7 specific concerns
      if (assessmentType.toLowerCase().includes('gad') || assessmentType.toLowerCase().includes('anxiety')) {
        if (responses['restless'] && parseInt(responses['restless']) > 2) concerns.push('restlessness');
        if (responses['worry'] && parseInt(responses['worry']) > 2) concerns.push('excessive worry');
        if (responses['irritable'] && parseInt(responses['irritable']) > 2) concerns.push('irritability');
        if (responses['relaxing'] && parseInt(responses['relaxing']) > 2) concerns.push('difficulty relaxing');
      }

      // General stress concerns
      if (assessmentType.toLowerCase().includes('stress')) {
        if (responses['overwhelmed'] && parseInt(responses['overwhelmed']) > 2) concerns.push('feeling overwhelmed');
        if (responses['physical'] && parseInt(responses['physical']) > 2) concerns.push('physical stress symptoms');
      }

    } catch (e) {
      // If parsing fails, return empty array
    }

    return concerns;
  }

  /**
   * Analyze mood trend from recent entries
   */
  private analyzeMoodTrend(moodEntries: any[]): string {
    if (moodEntries.length === 0) return 'no mood data available';
    if (moodEntries.length === 1) return 'limited mood data';

    const moodValues: { [key: string]: number } = {
      'Great': 5,
      'Good': 4,
      'Okay': 3,
      'Struggling': 2,
      'Anxious': 1
    };

    const recent = moodEntries.slice(0, 3).map(entry => moodValues[entry.mood] || 3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

    if (recent.length >= 2) {
      const isImproving = recent[0] > recent[1];
      const isDeclining = recent[0] < recent[1];

      if (isImproving) return 'mood improving';
      if (isDeclining) return 'mood declining';
    }

    if (avg >= 4) return 'generally positive mood';
    if (avg <= 2) return 'consistently low mood';
    return 'variable mood';
  }

  /**
   * Calculate age and age group from birthday
   */
  private calculateAgeInfo(birthday?: Date): { age?: number; ageGroup?: 'teen' | 'young-adult' | 'adult' | 'middle-aged' | 'senior' } {
    if (!birthday) {
      return { age: undefined, ageGroup: undefined };
    }

    const today = new Date();
    const birthDate = new Date(birthday);

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Determine age group
    let ageGroup: 'teen' | 'young-adult' | 'adult' | 'middle-aged' | 'senior';

    if (age >= 13 && age <= 19) {
      ageGroup = 'teen';
    } else if (age >= 20 && age <= 29) {
      ageGroup = 'young-adult';
    } else if (age >= 30 && age <= 49) {
      ageGroup = 'adult';
    } else if (age >= 50 && age <= 64) {
      ageGroup = 'middle-aged';
    } else {
      ageGroup = 'senior';
    }

    return { age, ageGroup };
  }

  private async getChatHistory(userId: string, limit: number = 10): Promise<any[]> {
    return await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Get more to account for user/bot pairs
    });
  }

  async saveChatMessage(
    userId: string,
    content: string,
    type: 'user' | 'bot' | 'system',
    metadata?: any,
    conversationId?: string
  ): Promise<any> {
    // If no conversationId provided, this should never happen in normal flow
    // but we'll handle it for backward compatibility
    if (!conversationId) {
      throw new Error('conversationId is required for saving chat messages');
    }

    return await prisma.chatMessage.create({
      data: {
        conversationId,
        userId,
        content,
        type,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  }

  detectCrisisLanguage(message: string): boolean {
    const criticalCrisisPatterns = [
      /\b(suicide|suicidal|kill myself|end my life|end it all|don'?t want to live)\b/i,
      /\b(want to die|better off dead|no reason to live)\b/i,
      /\b(self[ -]?harm|cutting|overdose)\b/i,
      /\b(plan to (die|hurt))\b/i,
      /\b(hurt myself|harm myself|not worth living)\b/i
    ];

    return criticalCrisisPatterns.some(pattern => pattern.test(message));
  }

  detectDistressSignal(message: string): boolean {
    const distressPatterns = [
      /\b(hopeless|worthless|no point)\b/i,
      /\b(can'?t go on|give up)\b/i,
      /\b(severe|extreme|unbearable) (pain|depression|anxiety)\b/i,
      /\b(struggling|barely coping|barely holding on)\b/i,
      /\b(can'?t handle|too much)\b/i
    ];

    return distressPatterns.some(pattern => pattern.test(message));
  }

  detectExerciseRequest(message: string): { requested: boolean; timeAvailable?: number } | null {
    const lowerMessage = message.toLowerCase();

    // Exercise keywords
    const exerciseKeywords = [
      'exercise', 'breathing', 'meditation', 'mindfulness', 'relaxation',
      'grounding', 'calm down', 'technique', 'practice', 'cbt',
      'thought record', 'muscle relaxation', 'body scan'
    ];

    const hasExerciseKeyword = exerciseKeywords.some(keyword => lowerMessage.includes(keyword));

    const explicitExerciseIntentPatterns = [
      'breathing exercise',
      'grounding exercise',
      'mindfulness exercise',
      'relaxation exercise',
      'meditation exercise',
      'give me an exercise',
      'suggest an exercise',
      'recommend an exercise',
      'can we do a breathing',
      'guide me through breathing',
      'walk me through a breathing',
      'walk me through meditation',
      'what exercise should i do',
      'which exercise should i do',
      'what breathing technique'
    ];

    const hasExplicitExerciseIntent = explicitExerciseIntentPatterns.some(pattern =>
      lowerMessage.includes(pattern)
    );

    // Check for request patterns
    const requestPatterns = [
      'can you help me',
      'give me',
      'show me',
      'teach me',
      'walk me through',
      'guide me',
      'i want to try',
      'i need',
      'help me',
      'what should i do'
    ];

    const hasRequestPattern = requestPatterns.some(pattern => lowerMessage.includes(pattern));

    // Require explicit exercise intent OR a combination of generic request + exercise keyword.
    // This prevents false positives for messages such as assessment discussions
    // that ask for a plan but do not request an exercise.
    const shouldTriggerExerciseMode = hasExplicitExerciseIntent || (hasExerciseKeyword && hasRequestPattern);

    if (shouldTriggerExerciseMode) {
      // Try to extract time available
      let timeAvailable: number | undefined;

      const timeMatch = lowerMessage.match(/(\d+)\s*(minute|min|hour)/);
      if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2];
        timeAvailable = unit.includes('hour') ? value * 60 : value;
      } else if (lowerMessage.includes('quick') || lowerMessage.includes('short')) {
        timeAvailable = 5;
      } else if (lowerMessage.includes('long') || lowerMessage.includes('detailed')) {
        timeAvailable = 15;
      }

      return {
        requested: true,
        timeAvailable
      };
    }

    return null;
  }

  getCrisisResponse(region?: string | null): string {
    // Region-aware crisis resources
    const crisisResources: Record<string, string> = {
      US: `• **National Suicide Prevention Lifeline**: 988 or 1-800-273-8255
• **Crisis Text Line**: Text HOME to 741741
• **Emergency Services**: 911`,

      IN: `• **iCall**: +91 9152987821 (Mon–Sat, 8am–10pm IST)
• **Vandrevala Foundation**: 1860-2662-345 (24/7)
• **AASRA**: +91 9820466726 (24/7)
• **Emergency Services**: 112`,

      GB: `• **Samaritans**: 116 123 (24/7, free)
• **SHOUT Crisis Text Line**: Text SHOUT to 85258
• **Emergency Services**: 999`,

      AU: `• **Lifeline Australia**: 13 11 14 (24/7)
• **Beyond Blue**: 1300 22 4636
• **Emergency Services**: 000`,

      CA: `• **Crisis Services Canada**: 1-833-456-4566 (24/7)
• **Crisis Text Line**: Text HOME to 686868
• **Emergency Services**: 911`,

      // Default / unknown region — show international + US
      DEFAULT: `• **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/
• **Befrienders Worldwide**: https://befrienders.org
• **National Suicide Prevention Lifeline (US)**: 988 or 1-800-273-8255
• **Crisis Text Line (US)**: Text HOME to 741741`
    };

        let key = 'DEFAULT';
    if (region) {
      const normalized = region.toLowerCase().trim();
      if (normalized === 'us' || normalized === 'united states' || normalized === 'north america' || normalized === 'usa') {
        key = 'US';
      } else if (normalized === 'in' || normalized === 'india') {
        key = 'IN';
      } else if (normalized === 'uk' || normalized === 'united kingdom' || normalized === 'gb' || normalized === 'great britain') {
        key = 'GB';
      } else if (normalized === 'ca' || normalized === 'canada') {
        key = 'CA';
      } else if (normalized === 'au' || normalized === 'australia') {
        key = 'AU';
      }
    }
    const resources = crisisResources[key] || crisisResources['DEFAULT'];

    return `I'm very concerned about your safety and wellbeing. If you're having thoughts of hurting yourself, please reach out for immediate help:

🆘 **Crisis Resources:**
${resources}

You are not alone, and there are people who want to help you. Please consider reaching out to a trusted friend, family member, or professional.

Would you like me to help you find local resources?`;
  }

  getFallbackResponse(userMessage: string, approach?: 'western' | 'eastern' | 'hybrid'): string {
    const lowerMessage = userMessage.toLowerCase();
    const mode = approach || 'hybrid';

    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
      if (mode === 'eastern') {
        return "I sense that anxiety is weighing on you. Let's bring your awareness gently to this moment. Try placing one hand on your belly and breathing slowly — in through your nose for four counts, out through your mouth for six. Anxiety often lives in our anticipation of the future; right now, you are safe. What does your body feel in this present breath?";
      }
      if (mode === 'western') {
        return "I can hear that you're feeling anxious. Anxiety can be really overwhelming, but you're taking a positive step by reaching out. Let's try to identify the thought pattern — sometimes writing down the specific worry helps us evaluate it more clearly. What's the main thought driving these feelings right now?";
      }
      return "I can hear that you're feeling anxious. That takes courage to share. Let's try something: take a slow breath and notice one thing around you. Sometimes grounding ourselves in the present helps loosen anxiety's grip. What's been on your mind lately that's contributing to these feelings?";
    }

    if (lowerMessage.includes('sad') || lowerMessage.includes('depressed')) {
      if (mode === 'eastern') {
        return "Sadness, like all feelings, is a visitor — it arrives, stays awhile, and passes. There is no need to push it away. Can you sit quietly with it for a moment, perhaps with a hand on your heart, and offer yourself the same compassion you would give a dear friend? What feels most heavy right now?";
      }
      if (mode === 'western') {
        return "I'm sorry you're feeling this way. Those feelings are valid, and it's important that you're talking about them. One strategy that can help is behavioural activation — doing one small, manageable activity even when motivation is low. Is there something small that usually brings you a bit of comfort?";
      }
      return "I'm sorry you're feeling this way. Those feelings are valid, and it's important that you're talking about them. Sometimes when we're feeling down, it can help to focus on small, manageable things. Is there something small that usually brings you a bit of comfort?";
    }

    if (lowerMessage.includes('stress') || lowerMessage.includes('overwhelmed')) {
      if (mode === 'eastern') {
        return "When stress overwhelms us, it often means we are carrying more than this moment requires. Let's try a brief body scan: close your eyes, notice where tension gathers — jaw, shoulders, belly — and breathe gently into that space. What is the most pressing weight you are holding right now?";
      }
      if (mode === 'western') {
        return "Feeling overwhelmed can be really difficult to manage. Let's break this down using a problem-solving approach: list everything on your plate, then categorise each item as 'urgent', 'important', or 'can wait'. What's the most pressing thing you're dealing with right now?";
      }
      return "Feeling overwhelmed can be really difficult to manage. It sounds like you have a lot on your plate right now. Sometimes it helps to break things down into smaller, more manageable pieces. What's the most pressing thing you're dealing with right now?";
    }

    // Default empathetic response — approach-aware
    if (mode === 'eastern') {
      return "Thank you for sharing with me. In this moment, simply being present with what arises is enough. While I'm having some technical difficulties, I want you to know that your feelings are worthy of your own gentle attention. How are you feeling right now, in this breath?";
    }
    if (mode === 'western') {
      return "Thank you for sharing with me. I can hear that you're going through something difficult right now. While I'm having some technical difficulties, I want you to know that your feelings are important and valid. Can you tell me more about the specific situation so we can work through it together?";
    }
    return "Thank you for sharing with me. I can hear that you're going through something difficult right now. While I'm having some technical difficulties, I want you to know that your feelings are important and valid. How are you feeling in this moment?";
  }

  private parseConversationMetadata(rawMetadata: unknown): ConversationMetadataState {
    if (!rawMetadata) {
      return {};
    }

    let parsed: unknown = rawMetadata;

    if (typeof rawMetadata === 'string') {
      try {
        parsed = JSON.parse(rawMetadata);
      } catch {
        return {};
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const record = parsed as Record<string, unknown>;
    const metadata: ConversationMetadataState = {};

    if (typeof record.deEscalationAttempt === 'number' && Number.isFinite(record.deEscalationAttempt)) {
      metadata.deEscalationAttempt = Math.max(0, Math.floor(record.deEscalationAttempt));
    }

    if (typeof record.lastDistressAt === 'string') {
      metadata.lastDistressAt = record.lastDistressAt;
    }

    if (typeof record.lastAssessmentPromptAt === 'string') {
      metadata.lastAssessmentPromptAt = record.lastAssessmentPromptAt;
    }

    return metadata;
  }

  private async getConversationMetadataState(conversationId: string, userId: string): Promise<ConversationMetadataState> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      select: { metadata: true },
    });

    if (!conversation) {
      return {};
    }

    return this.parseConversationMetadata(conversation.metadata);
  }

  private async setConversationMetadataState(conversationId: string, metadata: ConversationMetadataState): Promise<void> {
    const cleaned: ConversationMetadataState = {};

    if (typeof metadata.deEscalationAttempt === 'number' && Number.isFinite(metadata.deEscalationAttempt)) {
      cleaned.deEscalationAttempt = Math.max(0, Math.floor(metadata.deEscalationAttempt));
    }

    if (typeof metadata.lastDistressAt === 'string') {
      cleaned.lastDistressAt = metadata.lastDistressAt;
    }

    if (typeof metadata.lastAssessmentPromptAt === 'string') {
      cleaned.lastAssessmentPromptAt = metadata.lastAssessmentPromptAt;
    }

    const hasValues = Object.keys(cleaned).length > 0;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: hasValues ? JSON.stringify(cleaned) : null,
      },
    });
  }

  private async resetDeEscalationState(conversationId: string, userId: string): Promise<void> {
    try {
      const metadata = await this.getConversationMetadataState(conversationId, userId);
      if (!metadata.deEscalationAttempt || metadata.deEscalationAttempt <= 0) {
        return;
      }

      await this.setConversationMetadataState(conversationId, {
        ...metadata,
        deEscalationAttempt: 0,
      });
    } catch (error) {
      chatLogger.warn({ conversationId, userId, error }, 'Failed to reset de-escalation state');
    }
  }

  private getGroundingDeEscalationResponse(): string {
    return [
      'I hear how intense this feels right now, and I am here with you.',
      '',
      'Let\'s take one slow step together before anything else:',
      '- Inhale gently for 4 counts',
      '- Exhale slowly for 6 counts',
      '- Name 3 things you can see around you right now',
      '',
      'When you\'re ready, tell me those 3 things so we can keep grounding together.'
    ].join('\n');
  }

  private getEscalatedCrisisResponse(region?: string | null): string {
    return [
      'Thank you for staying with me and sharing this. Because this still feels very heavy, I want to make sure you have immediate human support as well:',
      '',
      this.getCrisisResponse(region)
    ].join('\n\n');
  }

  private async getAssessmentPromptAction(args: {
    userId: string;
    conversationId?: string;
    userMessage: string;
    sentiment: SentimentSnapshot;
  }): Promise<AssessmentPromptAction | null> {
    const { userId, conversationId, userMessage, sentiment } = args;
    if (!conversationId) {
      return null;
    }

    const lowerMessage = userMessage.toLowerCase();
    if (/assessment|gad-?2|gad-?7|questionnaire|test/i.test(lowerMessage)) {
      return null;
    }

    const anxietySignal =
      sentiment.dominantEmotion === 'anxiety' ||
      (sentiment.label === 'negative' && /(anx|panic|worried|worry|overwhelm|racing)/i.test(lowerMessage));

    if (!anxietySignal) {
      return null;
    }

    const latestAnxietyAssessment = await prisma.assessmentResult.findFirst({
      where: {
        userId,
        assessmentType: {
          in: ['anxiety_gad2', 'gad2', 'anxiety_assessment', 'anxiety', 'gad7', 'gad-7'],
        },
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    const daysSinceLastAssessment = latestAnxietyAssessment
      ? Math.max(0, Math.floor((Date.now() - latestAnxietyAssessment.completedAt.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const needsAssessmentCheck = daysSinceLastAssessment === null || daysSinceLastAssessment >= 14;
    if (!needsAssessmentCheck) {
      return null;
    }

    const conversationMetadata = await this.getConversationMetadataState(conversationId, userId);
    const lastPromptAt = conversationMetadata.lastAssessmentPromptAt
      ? new Date(conversationMetadata.lastAssessmentPromptAt)
      : null;

    if (lastPromptAt && !Number.isNaN(lastPromptAt.getTime())) {
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      if (Date.now() - lastPromptAt.getTime() < twelveHoursMs) {
        return null;
      }
    }

    await this.setConversationMetadataState(conversationId, {
      ...conversationMetadata,
      lastAssessmentPromptAt: new Date().toISOString(),
    });

    return {
      actionRequired: 'trigger_gad2_assessment',
      assessmentType: 'anxiety_gad2',
      prompt: 'I notice you\'re describing strong anxiety right now. Would you be open to a quick 2-minute anxiety check (GAD-2) so we can tailor support more precisely?',
      ctaLabel: 'Start quick anxiety check',
      daysSinceLastAssessment,
    };
  }

  private buildEmergencyRecommendationSet(sentiment?: SentimentSnapshot | null): RecommendationResult {
    const focus = sentiment?.dominantEmotion?.toLowerCase() ?? 'wellbeing';
    const recommendations: RecommendationResult = {
      items: [
        {
          title: 'Two-minute grounding breath',
          type: 'suggestion',
          reason: 'Pause, inhale for four counts, hold for four, exhale for six to settle your nervous system.',
          source: 'fallback',
          metadata: { fallback: true, focus }
        },
        {
          title: 'Compassion check-in',
          type: 'suggestion',
          reason: 'Place a hand on your heart and name one kind thing you can tell yourself right now.',
          source: 'fallback',
          metadata: { fallback: true, focus }
        },
        {
          title: 'Micro-journal prompt',
          type: 'suggestion',
          reason: 'Write down what feels heavy, what you need, and one small action to support that need today.',
          source: 'fallback',
          metadata: { fallback: true, focus }
        }
      ],
      focusAreas: [focus],
      rationale: 'Default support suggestions while personalised recommendations are restored.',
      fallbackUsed: true,
      fallbackMessage: 'We shared a few quick grounding ideas while we reconnect to personalised content.'
    };

    return recommendations;
  }

  async getConversationInsights(userId: string): Promise<any> {
    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const userMessages = recentMessages.filter(m => m.type === 'user');
    const totalMessages = userMessages.length;

    // Basic insights
    let anxietyMentions = 0;
    let depressionMentions = 0;
    let stressMentions = 0;

    const anxietyKeywords = ['anxious', 'anxiety', 'worried', 'nervous', 'panic'];
    const depressionKeywords = ['depressed', 'depression', 'sad', 'hopeless', 'empty'];
    const stressKeywords = ['stressed', 'stress', 'overwhelmed', 'pressure'];

    for (const message of userMessages) {
      const content = message.content.toLowerCase();

      if (anxietyKeywords.some(keyword => content.includes(keyword))) {
        anxietyMentions++;
      }
      if (depressionKeywords.some(keyword => content.includes(keyword))) {
        depressionMentions++;
      }
      if (stressKeywords.some(keyword => content.includes(keyword))) {
        stressMentions++;
      }
    }

    return {
      totalMessages,
      messageFrequency: {
        anxiety: anxietyMentions,
        depression: depressionMentions,
        stress: stressMentions
      },
      period: '7 days',
      insights: {
        mostDiscussedTopic: anxietyMentions >= depressionMentions && anxietyMentions >= stressMentions
          ? 'anxiety'
          : depressionMentions >= stressMentions
            ? 'depression'
            : 'stress',
        engagementLevel: totalMessages > 10 ? 'high' : totalMessages > 5 ? 'medium' : 'low'
      }
    };
  }

  /**
   * Get AI provider status for debugging
   */
  async getProviderStatus(): Promise<any> {
    return await llmService.getProviderStatus();
  }

  /**
   * Test AI providers
   */
  async testProviders(): Promise<any> {
    return await llmService.testAllProviders();
  }

  /**
   * Clear chat history for user
   */
  async clearChatHistory(userId: string): Promise<void> {
    await prisma.chatMessage.deleteMany({
      where: { userId }
    });
  }

  /**
   * Get conversation topic suggestions based on user context and history
   */
  async getConversationStarters(userId: string): Promise<string[]> {
    try {
      const context = await this.getUserContext(userId);
      const memory = await conversationMemoryService.getMemory(userId);
      const starters: string[] = [];

      // Based on assessment scores
      const anxietyScore = context.assessmentInsights?.byType?.anxiety?.latestScore;
      const depressionScore = context.assessmentInsights?.byType?.depression?.latestScore;
      const stressScore = context.assessmentInsights?.byType?.stress?.latestScore;

      if (anxietyScore && anxietyScore > 60) {
        starters.push("I've been feeling kind of anxious lately");
      }
      if (depressionScore && depressionScore > 60) {
        starters.push("I've been feeling really down recently");
      }
      if (stressScore && stressScore > 60) {
        starters.push("Work has been stressing me out");
      }

      // Based on time since last chat
      const lastMessage = await prisma.chatMessage.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (lastMessage) {
        const daysSince = Math.floor((Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSince > 3) {
          starters.push(`It's been a while — how have you been?`);
        } else if (daysSince === 0) {
          starters.push("Pick up where we left off earlier");
        }
      }

      // Based on recurring themes from memory
      if (memory.recurringThemes?.includes('work')) {
        starters.push("How's work been going?");
      }
      if (memory.recurringThemes?.includes('relationships')) {
        starters.push("Something's been on my mind about a relationship");
      }
      if (memory.recurringThemes?.includes('sleep')) {
        starters.push("I haven't been sleeping well");
      }

      // Progress check
      if (context.wellnessScore) {
        if (context.wellbeingTrend === 'improving') {
          starters.push("I think I've been making some progress");
        } else if (context.wellbeingTrend === 'declining') {
          starters.push("I feel like things have been harder lately");
        }
      }

      // Time-based suggestions
      const hour = new Date().getHours();
      if (hour >= 21 || hour <= 5) {
        starters.push("Can't sleep tonight");
      } else if (hour >= 6 && hour <= 9) {
        starters.push("Help me start today on a good note");
      }

      // Always include general options
      if (starters.length < 4) {
        starters.push("I want to try a breathing exercise");
        starters.push("I just need someone to talk to");
        starters.push("Something good happened today!");
        starters.push("Help me sort through my thoughts");
      }

      // Return max 6 starters
      return starters.slice(0, 6);
    } catch (error) {
      chatLogger.error({ userId, err: error }, 'Failed to generate conversation starters');
      // Return default starters on error
      return [
        "How are you feeling today?",
        "I want to try a breathing exercise",
        "I just need someone to talk to",
        "Something good happened today!"
      ];
    }
  }

  /**
   * Get last chat time for a user
   */
  private async getLastChatTime(userId: string): Promise<Date> {
    const lastMessage = await prisma.chatMessage.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return lastMessage?.createdAt || new Date(0);
  }

  /**
   * Generate contextual smart reply suggestions
   */
  generateSmartReplies(
    userMessage: string,
    botResponse: string,
    sentiment: SentimentSnapshot | null
  ): string[] {
    const replies: string[] = [];
    const lowerBot = botResponse.toLowerCase();
    const lowerUser = userMessage.toLowerCase();

    // Question-based replies
    if (lowerBot.includes('how are you feeling') || lowerBot.includes('how do you feel')) {
      if (sentiment?.dominantEmotion === 'anxiety') {
        replies.push("😰 Anxious and worried");
      }
      if (sentiment?.dominantEmotion === 'sadness') {
        replies.push("😔 Sad and down");
      }
      replies.push("😊 Pretty good actually");
      replies.push("😐 Okay, I guess");
      replies.push("😣 Not great, to be honest");
    } else if (lowerBot.includes('tell me more') || lowerBot.includes('can you elaborate')) {
      replies.push("💭 Let me explain in detail");
      replies.push("🤷 I'm not sure how to describe it");
      replies.push("⏭️ Let's move on to something else");
    } else if (lowerBot.includes('breathing') || lowerBot.includes('exercise') || lowerBot.includes('meditation')) {
      replies.push("✅ Let's do it right now");
      replies.push("📌 Save this for later");
      replies.push("🔄 Try something different instead");
    } else if (lowerBot.includes('would you like') || lowerBot.includes('do you want')) {
      replies.push("✅ Yes, please");
      replies.push("❌ No, thanks");
      replies.push("🤔 I'm not sure yet");
    } else if (lowerBot.match(/\?$/)) {
      // Generic question
      replies.push("✅ Yes");
      replies.push("❌ No");
      replies.push("🤔 Maybe");
    }

    // Sentiment-based suggestions
    if (sentiment?.label === 'negative' && replies.length < 3) {
      replies.push("😢 I need more support");
      replies.push("🆘 This is really hard right now");
    } else if (sentiment?.label === 'positive' && replies.length < 3) {
      replies.push("💪 I'm feeling better about this");
      replies.push("🙏 Thank you, that helps");
    }

    // Context-based suggestions
    if (lowerBot.includes('progress') || lowerBot.includes('improvement')) {
      replies.push("📊 Show me my progress");
    }
    if (lowerBot.includes('assessment') || lowerBot.includes('check-in')) {
      replies.push("📝 Take an assessment");
    }

    // Always include general options
    if (replies.length < 4) {
      replies.push("💬 Tell me more about that");
      replies.push("🔄 Change topic");
    }

    // Remove duplicates and limit to 4
    return Array.from(new Set(replies)).slice(0, 4);
  }

  /**
   * Generate AI-powered conversation summary
   */
  async generateConversationSummary(userId: string, sessionId?: string): Promise<{
    summary: string;
    keyInsights: string[];
    emotionalTrends: string[];
    topicsDiscussed: string[];
    actionItems: string[];
    overallSentiment: string;
  }> {
    try {
      // Get recent messages (session or last 20)
      const messages = await prisma.chatMessage.findMany({
        where: {
          userId,
          ...(sessionId && { sessionId })
        },
        orderBy: { createdAt: 'desc' },
        take: sessionId ? undefined : 20
      });

      if (messages.length === 0) {
        return {
          summary: 'No conversation to summarize yet.',
          keyInsights: [],
          emotionalTrends: [],
          topicsDiscussed: [],
          actionItems: [],
          overallSentiment: 'neutral'
        };
      }

      // Format conversation for AI
      const conversationText = messages.reverse().map(msg =>
        `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`
      ).join('\n');

      // Get memory for context
      const memory = await conversationMemoryService.getMemory(userId);

      // Generate summary using AI
      const summaryPrompt = `Please analyze this wellbeing conversation and provide a structured summary:

Conversation:
${conversationText}

Recurring themes from user's history: ${memory.recurringThemes?.join(', ') || 'None'}

Provide a JSON response with:
1. summary: A brief 2-3 sentence overview of the conversation
2. keyInsights: Array of 3-5 key insights about the user's mental state
3. emotionalTrends: Array of 2-3 emotional patterns observed
4. topicsDiscussed: Array of main topics covered
5. actionItems: Array of suggested next steps or exercises
6. overallSentiment: One word - positive, negative, or neutral

Format as valid JSON only.`;

      const response = await llmService.generateResponse(
        [{ role: 'user', content: summaryPrompt }],
        {
          temperature: 0.3,
          maxTokens: 800
        }
      );

      // Parse AI response
      let summaryData;
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          summaryData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (error) {
        // Fallback to basic summary
        return {
          summary: `Conversation covered ${messages.length} messages discussing wellbeing topics.`,
          keyInsights: ['User engaged in therapeutic conversation'],
          emotionalTrends: ['Mixed emotions observed'],
          topicsDiscussed: memory.recurringThemes || ['General wellbeing'],
          actionItems: ['Continue regular check-ins'],
          overallSentiment: 'neutral'
        };
      }

      return {
        summary: summaryData.summary || '',
        keyInsights: summaryData.keyInsights || [],
        emotionalTrends: summaryData.emotionalTrends || [],
        topicsDiscussed: summaryData.topicsDiscussed || [],
        actionItems: summaryData.actionItems || [],
        overallSentiment: summaryData.overallSentiment || 'neutral'
      };
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      throw error;
    }
  }

  /**
   * Get personalized check-in prompt based on user patterns
   */
  async getProactiveCheckIn(userId: string): Promise<{
    shouldCheckIn: boolean;
    message: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    try {
      const context = await this.getUserContext(userId);
      const memory = await conversationMemoryService.getMemory(userId);

      // Get last message timestamp
      const lastMessage = await prisma.chatMessage.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (!lastMessage) {
        return {
          shouldCheckIn: false,
          message: '',
          reason: 'No conversation history',
          priority: 'low'
        };
      }

      const hoursSinceLastChat = (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60);
      const daysSinceLastChat = Math.floor(hoursSinceLastChat / 24);

      // High priority check-ins
      // 1. User mentioned crisis keywords recently
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      const hasCrisisIndicators = recentMessages.some(msg =>
        msg.type === 'user' && (
          msg.content.toLowerCase().includes('hopeless') ||
          msg.content.toLowerCase().includes('can\'t go on') ||
          msg.content.toLowerCase().includes('overwhelmed')
        )
      );

      if (hasCrisisIndicators && hoursSinceLastChat >= 4) {
        return {
          shouldCheckIn: true,
          message: "I've been thinking about our last conversation. How are you feeling now? I'm here if you need support.",
          reason: 'Crisis follow-up',
          priority: 'high'
        };
      }

      // 2. High anxiety/depression scores + no contact for 2 days
      const anxietyScore = context.assessmentInsights?.byType?.anxiety?.latestScore || 0;
      const depressionScore = context.assessmentInsights?.byType?.depression?.latestScore || 0;

      if ((anxietyScore > 60 || depressionScore > 60) && daysSinceLastChat >= 2) {
        return {
          shouldCheckIn: true,
          message: `Hi! I noticed it's been ${daysSinceLastChat} days since we last talked. How have you been managing your ${anxietyScore > 60 ? 'anxiety' : 'mood'}?`,
          reason: 'High scores + inactive',
          priority: 'high'
        };
      }

      // Medium priority check-ins
      // 3. Consistent user but missed their pattern
      if (memory.averageSessionsPerWeek && memory.averageSessionsPerWeek >= 3 && daysSinceLastChat >= 3) {
        return {
          shouldCheckIn: true,
          message: `Hey there! I noticed we haven't chatted in a few days. Everything okay? I'm here whenever you need to talk.`,
          reason: 'Pattern deviation',
          priority: 'medium'
        };
      }

      // 4. User showed improvement, check-in to maintain progress
      const wellnessTrend = context.wellnessInsights?.trend;
      if (wellnessTrend === 'improving' && daysSinceLastChat >= 5) {
        return {
          shouldCheckIn: true,
          message: "You were making great progress! How are you maintaining your positive momentum? I'd love to hear an update.",
          reason: 'Progress maintenance',
          priority: 'medium'
        };
      }

      // Low priority check-ins
      // 5. Regular weekly check-in
      if (daysSinceLastChat >= 7) {
        return {
          shouldCheckIn: true,
          message: "It's been a week! I wanted to check in and see how things are going. What's been on your mind lately?",
          reason: 'Weekly check-in',
          priority: 'low'
        };
      }

      // No check-in needed
      return {
        shouldCheckIn: false,
        message: '',
        reason: 'Recent contact',
        priority: 'low'
      };
    } catch (error) {
      console.error('Error generating proactive check-in:', error);
      return {
        shouldCheckIn: false,
        message: '',
        reason: 'Error',
        priority: 'low'
      };
    }
  }

  /**
   * Generate mood-based greeting
   */
  async getMoodBasedGreeting(userId: string): Promise<string> {
    try {
      const context = await this.getUserContext(userId);
      const memory = await conversationMemoryService.getMemory(userId);

      const userName = context.firstName || 'there';
      const hour = new Date().getHours();

      // Time-based greeting base
      let timeGreeting = '';
      if (hour < 12) timeGreeting = 'Good morning';
      else if (hour < 17) timeGreeting = 'Good afternoon';
      else timeGreeting = 'Good evening';

      // Get recent sentiment trend
      const recentMessages = await prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      // Check for improvement trend
      const wellnessTrend = context.wellnessInsights?.trend;
      const anxietyScore = context.assessmentInsights?.byType?.anxiety?.latestScore || 0;
      const depressionScore = context.assessmentInsights?.byType?.depression?.latestScore || 0;

      // Personalized greeting based on context
      if (wellnessTrend === 'improving') {
        return `Hey ${userName} 🌟 You've been making some really nice progress. How are you feeling today?`;
      }

      if (anxietyScore > 70) {
        return `Hey ${userName}. I'm here. Take a breath — no rush. What's on your mind?`;
      }

      if (depressionScore > 70) {
        return `Hey ${userName}. I know things might feel heavy right now. I'm here to listen.`;
      }

      if (wellnessTrend === 'declining') {
        return `Hey ${userName}. How are you doing? I'm here if you want to talk.`;
      }

      // Check recurring themes
      if (memory.recurringThemes?.includes('work') && hour >= 9 && hour <= 17) {
        return `Hey ${userName}! How's your day going so far?`;
      }

      if (memory.recurringThemes?.includes('sleep') && (hour < 7 || hour > 22)) {
        return `Hey ${userName}. How did you sleep? I'm here if you want to chat.`;
      }

      // Default natural greetings
      const naturalGreetings = [
        `Hey ${userName} 👋 How are you doing?`,
        `Hi ${userName}! What's on your mind today?`,
        `Good to see you, ${userName}. How are things?`,
        `Hey there, ${userName}. How's your day going?`
      ];

      return naturalGreetings[Math.floor(Math.random() * naturalGreetings.length)];
    } catch (error) {
      console.error('Error generating mood-based greeting:', error);
      return 'Hello! How are you feeling today?';
    }
  }

  /**
   * Get contextual exercise recommendations based on current state
   */
  async getContextualExerciseRecommendations(
    userId: string,
    currentMessage?: string
  ): Promise<{
    exercises: Array<{
      id: string;
      name: string;
      type: 'breathing' | 'mindfulness' | 'cbt' | 'grounding' | 'movement';
      duration: string;
      difficulty: 'easy' | 'medium' | 'advanced';
      description: string;
      matchReason: string;
      benefit: string;
    }>;
    priority: 'high' | 'medium' | 'low';
    contextualNote: string;
  }> {
    try {
      const context = await this.getUserContext(userId);
      const exercises: Array<{
        id: string;
        name: string;
        type: 'breathing' | 'mindfulness' | 'cbt' | 'grounding' | 'movement';
        duration: string;
        difficulty: 'easy' | 'medium' | 'advanced';
        description: string;
        matchReason: string;
        benefit: string;
      }> = [];

      // Analyze current message if provided
      let enhancedSentiment: EnhancedSentiment | null = null;
      if (currentMessage) {
        enhancedSentiment = this.analyzeEnhancedSentiment(currentMessage);
      }

      // Get assessment scores
      const anxietyScore = context.assessmentInsights?.byType?.anxiety?.latestScore || 0;
      const depressionScore = context.assessmentInsights?.byType?.depression?.latestScore || 0;
      const stressScore = context.assessmentInsights?.byType?.stress?.latestScore || 0;

      // Determine priority
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if ((enhancedSentiment?.indicators?.crisisRisk ?? 0) > 0.5 || anxietyScore > 70 || depressionScore > 70) {
        priority = 'high';
      } else if (anxietyScore < 40 && depressionScore < 40 && stressScore < 40) {
        priority = 'low';
      }

      // HIGH ANXIETY - Breathing exercises
      if (anxietyScore > 60 || enhancedSentiment?.primary.emotion === 'anxiety') {
        exercises.push({
          id: 'breathing-478',
          name: '4-7-8 Breathing',
          type: 'breathing',
          duration: '5 minutes',
          difficulty: 'easy',
          description: 'Breathe in for 4 counts, hold for 7, exhale for 8. Repeat 4 times.',
          matchReason: 'Your anxiety levels suggest immediate calming techniques',
          benefit: 'Activates parasympathetic nervous system, reduces anxiety within minutes'
        });

        exercises.push({
          id: 'breathing-box',
          name: 'Box Breathing',
          type: 'breathing',
          duration: '5 minutes',
          difficulty: 'easy',
          description: 'Breathe in-4, hold-4, out-4, hold-4. Visualize tracing a box.',
          matchReason: 'Great for racing thoughts and panic',
          benefit: 'Used by Navy SEALs for stress management'
        });
      }

      // HIGH DEPRESSION - Activation exercises
      if (depressionScore > 60 || enhancedSentiment?.primary.emotion === 'sadness') {
        exercises.push({
          id: 'mindfulness-body-scan',
          name: 'Body Scan Meditation',
          type: 'mindfulness',
          duration: '10 minutes',
          difficulty: 'medium',
          description: 'Slowly bring awareness to each part of your body, from toes to head.',
          matchReason: 'Helps reconnect with your body when feeling numb or disconnected',
          benefit: 'Increases body awareness and reduces dissociation'
        });

        exercises.push({
          id: 'movement-gentle-walk',
          name: 'Mindful Walking',
          type: 'movement',
          duration: '10 minutes',
          difficulty: 'easy',
          description: 'Walk slowly, noticing each step, breath, and sensation.',
          matchReason: 'Gentle activation for when energy is low',
          benefit: 'Releases endorphins without overwhelming effort'
        });
      }

      // HIGH STRESS - Grounding techniques
      if (stressScore > 60 || (enhancedSentiment?.tone?.urgency ?? 0) > 0.7) {
        exercises.push({
          id: 'grounding-54321',
          name: '5-4-3-2-1 Grounding',
          type: 'grounding',
          duration: '5 minutes',
          difficulty: 'easy',
          description: 'Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste.',
          matchReason: 'Perfect for overwhelm and stress',
          benefit: 'Brings you back to present moment immediately'
        });
      }

      // ANGER - Release techniques
      if (enhancedSentiment?.primary.emotion === 'anger') {
        exercises.push({
          id: 'breathing-progressive-relax',
          name: 'Progressive Muscle Relaxation',
          type: 'breathing',
          duration: '10 minutes',
          difficulty: 'medium',
          description: 'Tense and release each muscle group, from feet to head.',
          matchReason: 'Releases physical tension from anger',
          benefit: 'Reduces muscle tension and calms the nervous system'
        });
      }

      // RACING THOUGHTS - CBT exercises
      if ((enhancedSentiment?.linguisticFeatures?.questionCount ?? 0) > 3 || anxietyScore > 50) {
        exercises.push({
          id: 'cbt-thought-record',
          name: 'Thought Record',
          type: 'cbt',
          duration: '10 minutes',
          difficulty: 'medium',
          description: 'Write down: Situation → Thought → Emotion → Evidence For/Against → Balanced Thought',
          matchReason: 'Helpful for repetitive worry thoughts',
          benefit: 'Interrupts rumination and provides perspective'
        });
      }

      // LOW MOOD - Compassion practices
      if ((enhancedSentiment?.tone?.hopefulness ?? 1) < 0.3) {
        exercises.push({
          id: 'mindfulness-loving-kindness',
          name: 'Loving-Kindness Meditation',
          type: 'mindfulness',
          duration: '5 minutes',
          difficulty: 'easy',
          description: 'Repeat: "May I be safe, may I be happy, may I be healthy, may I be at ease"',
          matchReason: 'Builds self-compassion when you\'re being hard on yourself',
          benefit: 'Increases self-compassion and reduces self-criticism'
        });
      }

      // Default recommendations if nothing matches
      if (exercises.length === 0) {
        exercises.push({
          id: 'breathing-deep',
          name: 'Deep Breathing',
          type: 'breathing',
          duration: '3 minutes',
          difficulty: 'easy',
          description: 'Breathe deeply into your belly for 4 counts, exhale for 6.',
          matchReason: 'A gentle practice for any time',
          benefit: 'Quick stress relief and centering'
        });
      }

      // Generate contextual note
      let contextualNote = '';
      if (priority === 'high') {
        contextualNote = 'I sense you might be struggling right now. These exercises can provide immediate relief. Would you like to try one together?';
      } else if (priority === 'medium') {
        contextualNote = 'Based on how you\'re feeling, these exercises might be helpful. Pick one that resonates with you.';
      } else {
        contextualNote = 'Here are some practices to maintain your wellness. Consider making one part of your daily routine.';
      }

      // Limit to top 4 exercises
      return {
        exercises: exercises.slice(0, 4),
        priority,
        contextualNote
      };
    } catch (error) {
      console.error('Error generating exercise recommendations:', error);
      // Fallback recommendations
      return {
        exercises: [
          {
            id: 'breathing-basic',
            name: 'Deep Breathing',
            type: 'breathing',
            duration: '5 minutes',
            difficulty: 'easy',
            description: 'Take slow, deep breaths',
            matchReason: 'Universal calming technique',
            benefit: 'Reduces stress and anxiety'
          }
        ],
        priority: 'low',
        contextualNote: 'Take a moment to breathe and center yourself.'
      };
    }
  }
}

export const chatService = new ChatService();