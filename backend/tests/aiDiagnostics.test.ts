import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to declare mock functions before vi.mock calls are evaluated
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    chatbotConversation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    assessmentResult: {
      findMany: vi.fn(),
    },
    moodEntry: {
      findMany: vi.fn(),
    },
    journalEntry: {
      findMany: vi.fn(),
    },
    journalReflection: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    dashboardInsights: {
      deleteMany: vi.fn(),
    },
    content: {
      findMany: vi.fn(),
    },
    practice: {
      findMany: vi.fn(),
    },
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  }
}));

// Mock @prisma/client globally
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => prismaMock),
  };
});

// Mock database config prisma as well
vi.mock('../src/config/database', () => {
  return { prisma: prismaMock, default: prismaMock };
});

// Import services to test
import { LLMService, llmService } from '../src/services/llmProvider';
import { chatbotService } from '../src/services/chatbotService';
import { crisisDetectionService } from '../src/services/crisisDetectionService';
import { interpretAssessmentScore, buildAssessmentInsights } from '../src/services/assessmentInsightsService';
import { journalService } from '../src/services/journalService';
import { enhancedRecommendationService } from '../src/services/enhancedRecommendationService';
import { AIProviderType } from '../src/types/ai';

describe('MaanSarathi AI Services Diagnostic Tests', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    // Clear LLM provider settings for deterministic environment tests
    const keysToClear = [
      'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3',
      'NVIDIA_API_KEY', 'NVIDIA_API_KEY_1', 'NVIDIA_API_KEY_2', 'NVIDIA_API_KEY_3',
      'HUGGINGFACE_API_KEY_1', 'HUGGINGFACE_API_KEY_2', 'HUGGINGFACE_API_KEY', 'HF_TOKEN',
      'OPENAI_API_KEY_1', 'OPENAI_API_KEY_2', 'OPENAI_API_KEY_3',
      'ANTHROPIC_API_KEY_1', 'ANTHROPIC_API_KEY_2',
      'OLLAMA_ENABLED',
    ];
    for (const key of keysToClear) {
      (process.env as any)[key] = '';
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // ==========================================
  // 1. LLM Fallback and Initialization (llmService)
  // ==========================================
  describe('LLM Service', () => {
    it('handles empty input messages gracefully', async () => {
      process.env.AI_LOCAL_FALLBACK_ENABLED = 'true';
      const response = await llmService.generateResponse([]);
      expect(response).toBeDefined();
      expect(response.provider).toBe('local-dev-fallback');
      expect(response.content).toContain('Local development mode is active');
    });

    it('throws error when no providers are configured and local fallback is disabled', async () => {
      process.env.AI_LOCAL_FALLBACK_ENABLED = 'false';
      process.env.NODE_ENV = 'production'; // bypass local fallback force

      const service = new LLMService();
      await expect(service.generateResponse([{ role: 'user', content: 'test' }])).rejects.toThrow();
    });

    it('sanitizes config by stripping incompatible models when falling back to OpenAI/Gemini from Ollama models', async () => {
      const mockOpenAI = {
        name: 'openai',
        isAvailable: vi.fn().mockResolvedValue(true),
        generateResponse: vi.fn().mockResolvedValue({
          content: 'openai reply',
          usage: { total_tokens: 10 },
          model: 'gpt-4o-mini',
          success: true
        }),
        testConnection: vi.fn().mockResolvedValue(true)
      };

      const service = new LLMService();
      const svc = service as any;
      svc.providers = new Map([[AIProviderType.OPENAI, mockOpenAI]]);
      svc.providerPriority = [AIProviderType.OPENAI];
      svc.providerState = new Map([[AIProviderType.OPENAI, { failureCount: 0, cooldownUntil: null }]]);

      // Call generateResponse with an Ollama-specific model
      const response = await service.generateResponse(
        [{ role: 'user', content: 'hello' }],
        { model: 'gpt-oss:20b-cloud' } as any
      );

      expect(response.content).toBe('openai reply');
      // Verify that model was stripped or not passed directly as 'gpt-oss:20b-cloud' to OpenAI
      const passedConfig = mockOpenAI.generateResponse.mock.calls[0][1];
      expect(passedConfig?.model).toBeUndefined();
    });

    it('cooldown state tracks consecutive failures correctly', async () => {
      process.env.AI_PROVIDER_MAX_FAILURES_BEFORE_COOLDOWN = '2';
      process.env.AI_PROVIDER_COOLDOWN_MS = '60000';
      
      const service = new LLMService();
      const fakeProvider = {
        name: 'fake-gemini',
        isAvailable: vi.fn().mockResolvedValue(true),
        generateResponse: vi.fn().mockRejectedValue(new Error('API Error')),
        testConnection: vi.fn().mockResolvedValue(false)
      };

      const svc = service as any;
      svc.providers = new Map([[AIProviderType.GEMINI, fakeProvider]]);
      svc.providerPriority = [AIProviderType.GEMINI];
      svc.providerState = new Map([[AIProviderType.GEMINI, { failureCount: 0, cooldownUntil: null }]]);

      // Attempt 1
      try { await service.generateResponse([{ role: 'user', content: 'hello' }]); } catch {}
      expect(svc.providerState.get(AIProviderType.GEMINI).failureCount).toBe(1);
      expect(svc.providerState.get(AIProviderType.GEMINI).cooldownUntil).toBeNull();

      // Attempt 2
      try { await service.generateResponse([{ role: 'user', content: 'hello' }]); } catch {}
      expect(svc.providerState.get(AIProviderType.GEMINI).failureCount).toBe(2);
      expect(svc.providerState.get(AIProviderType.GEMINI).cooldownUntil).not.toBeNull();
    });
  });

  // ==========================================
  // 2. Conversational Chatbot (chatbotService)
  // ==========================================
  describe('Chatbot Service', () => {
    it('handles startConversation database failures', async () => {
      prismaMock.chatbotConversation.create.mockRejectedValueOnce(new Error('DB connection timeout'));
      await expect(chatbotService.startConversation('user-1')).rejects.toThrow('DB connection timeout');
    });

    it('handles addMessage when conversation is not found', async () => {
      prismaMock.chatbotConversation.findUnique.mockResolvedValueOnce(null);
      await expect(chatbotService.addMessage('invalid-id', 'user', 'hello')).rejects.toThrow('Conversation not found');
    });

    it('handles addMessage database update failure and handles empty inputs', async () => {
      const conv = { id: 'c1', messages: JSON.stringify([]), userId: 'u1' };
      prismaMock.chatbotConversation.findUnique.mockResolvedValueOnce(conv);
      prismaMock.chatbotConversation.update.mockRejectedValueOnce(new Error('Write lock failure'));

      await expect(chatbotService.addMessage('c1', 'user', '')).rejects.toThrow('Write lock failure');
    });

    it('handles endConversation with empty messages and fallback summary generation', async () => {
      const conv = { id: 'c1', messages: JSON.stringify([]), userId: 'u1' };
      prismaMock.chatbotConversation.findUnique.mockResolvedValueOnce(conv);
      prismaMock.chatbotConversation.update.mockResolvedValueOnce({});
      prismaMock.dashboardInsights.deleteMany.mockResolvedValueOnce({ count: 1 });

      // Should complete without throwing, returning a fallback "Empty conversation."
      await chatbotService.endConversation('c1');
      expect(prismaMock.chatbotConversation.update).toHaveBeenCalledTimes(1);
      const updateData = prismaMock.chatbotConversation.update.mock.calls[0][0].data;
      expect(updateData.summary).toBe('Empty conversation.');
    });

    it('handles getConversationStats when user has no conversations', async () => {
      prismaMock.chatbotConversation.count.mockResolvedValueOnce(0);
      prismaMock.chatbotConversation.findMany.mockResolvedValueOnce([]);

      const stats = await chatbotService.getConversationStats('u1');
      expect(stats.totalConversations).toBe(0);
      expect(stats.recentConversations).toBe(0);
      expect(stats.topTopics).toEqual([]);
      expect(stats.lastConversationDate).toBeNull();
    });

    it('handles getConversationStats with malformed keyTopics JSON in database', async () => {
      prismaMock.chatbotConversation.count.mockResolvedValueOnce(1);
      prismaMock.chatbotConversation.findMany.mockResolvedValueOnce([
        {
          id: 'c1',
          emotionalState: 'anxious',
          keyTopics: 'invalid-json-[',
          endedAt: new Date()
        }
      ]);

      await expect(chatbotService.getConversationStats('u1')).rejects.toThrow();
    });
  });

  // ==========================================
  // 3. Crisis Detection (crisisDetectionService)
  // ==========================================
  describe('Crisis Detection Service', () => {
    it('assessCrisisWithAI handles AI response parsing errors safely', async () => {
      // Mock LLM to return invalid JSON
      vi.spyOn(llmService, 'generateResponse').mockResolvedValueOnce({
        content: 'not a json structure',
        usage: { total_tokens: 5 },
        model: 'fake',
        provider: 'fake',
        success: true
      } as any);

      const result = await crisisDetectionService.assessCrisisWithAI('I need help');
      expect(result.score).toBe(0);
      expect(result.reasoning).toBe('ai-unavailable');
    });

    it('detects crisis with empty context safely', async () => {
      const context = {
        assessments: [],
        recentMessages: [],
        moodHistory: []
      };

      const result = await crisisDetectionService.detectCrisisLevel('u1', context);
      expect(result.level).toBe('NONE');
      expect(result.confidence).toBe(0);
      expect(result.indicators).toEqual([]);
      expect(result.immediateAction).toBe(false);
    });

    it('flags CRITICAL crisis level for suicidal keywords with high weight', async () => {
      const context = {
        assessments: [],
        recentMessages: [
          { id: 'm1', conversationId: 'c1', userId: 'u1', content: 'I want to kill myself.', type: 'user', createdAt: new Date() }
        ],
        moodHistory: []
      };

      const result = await crisisDetectionService.detectCrisisLevel('u1', context);
      expect(result.level).toBe('CRITICAL');
      expect(result.immediateAction).toBe(true);
      expect(result.indicators).toContain('Critical crisis language detected in conversation');
    });

    it('handles assessments with extreme or negative scores safely', async () => {
      const context = {
        assessments: [
          { id: 'a1', userId: 'u1', assessmentType: 'depression_phq9', score: 150, completedAt: new Date() } as any
        ],
        recentMessages: [],
        moodHistory: []
      };

      const result = await crisisDetectionService.detectCrisisLevel('u1', context);
      // GAD/PHQ score >= 80 triggers HIGH
      expect(result.level).toBe('HIGH');
      expect(result.indicators).toContain('Severe depression symptoms detected (PHQ-9)');
    });
  });

  // ==========================================
  // 4. Assessment Insights (assessmentInsightsService)
  // ==========================================
  describe('Assessment Insights Service', () => {
    it('handles interpretAssessmentScore with unknown type and extreme scores', () => {
      // Unknown assessment type should use fallback bands (max: 25 -> low, max: 50 -> moderate, etc.)
      const scoreLow = interpretAssessmentScore('unknown-type', -10);
      const scoreHigh = interpretAssessmentScore('unknown-type', 200);

      expect(scoreLow).toBe('Low intensity');
      expect(scoreHigh).toBe('Significant intensity');
    });

    it('buildAssessmentInsights handles empty assessment history', async () => {
      const result = await buildAssessmentInsights([]);
      expect(result.history).toEqual([]);
      expect(result.insights.byType).toEqual({});
      expect(result.insights.overallTrend).toBe('baseline');
      expect(result.insights.wellnessScore).toBeUndefined();
    });

    it('buildAssessmentInsights handles invalid category breakdown JSON safely', async () => {
      const assessments = [
        {
          id: 'a1',
          userId: 'u1',
          assessmentType: 'depression_phq9',
          score: 50,
          completedAt: new Date(),
          responses: JSON.stringify({}),
          categoryScores: 'invalid-json-breakdown'
        } as any
      ];

      const result = await buildAssessmentInsights(assessments);
      expect(result.history[0].categoryBreakdown).toBeUndefined();
    });
  });

  // ==========================================
  // 5. Journaling Reflections (journalService)
  // ==========================================
  describe('Journal Service', () => {
    it('getPromptForState returns fallback for invalid/unknown emotions and approaches', () => {
      const prompt = journalService.getPromptForState('confused-emotion', 'mystical-approach');
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });

    it('extractTags handles empty inputs and inputs with special characters safely', () => {
      const tagsEmpty = journalService.extractTags('');
      const tagsSpecial = journalService.extractTags('!!! @#$ %^^ &** ()_+');

      expect(tagsEmpty).toEqual([]);
      expect(tagsSpecial).toBeDefined();
      expect(Array.isArray(tagsSpecial)).toBe(true);
    });

    it('generateWeeklyReflection handles user with no entries gracefully', async () => {
      prismaMock.journalEntry.findMany.mockResolvedValueOnce([]);
      prismaMock.journalReflection.upsert.mockResolvedValueOnce({ id: 'r1', aiSummary: 'fallback' });

      const reflection = await journalService.generateWeeklyReflection('u1');
      expect(reflection).toBeDefined();
      expect(prismaMock.journalReflection.upsert).toHaveBeenCalledTimes(1);
      const createData = prismaMock.journalReflection.upsert.mock.calls[0][0].create;
      expect(createData.aiSummary).toContain('No journal entries recorded this week yet');
    });
  });

  // ==========================================
  // 6. Recommendation Engine (enhancedRecommendationService)
  // ==========================================
  describe('Enhanced Recommendation Service', () => {
    it('getPersonalizedRecommendations handles empty user context and uses fallback', async () => {
      const context = {
        user: {
          id: 'u1',
          approach: 'hybrid' as const,
          wellnessScore: 50,
          assessmentResults: [],
          completedContent: [],
          engagementHistory: []
        },
        currentState: {}
      };

      prismaMock.content.findMany.mockResolvedValue([]);
      prismaMock.practice.findMany.mockResolvedValue([]);

      const result = await enhancedRecommendationService.getPersonalizedRecommendations(context);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.fallbackUsed).toBe(true);
      expect(result.items[0].source).toBe('fallback');
    });

    it('returns crisis resources when crisis level is HIGH or CRITICAL', async () => {
      const context = {
        user: {
          id: 'u1',
          approach: 'hybrid' as const,
          wellnessScore: 80,
          assessmentResults: [],
          completedContent: [],
          engagementHistory: []
        },
        currentState: {
          crisisLevel: 'HIGH' as const
        }
      };

      // Mock database return for crisis resources
      prismaMock.content.findMany.mockResolvedValueOnce([
        {
          id: 'cr1',
          title: 'Emergency Crisis Hotline',
          description: 'Call 988',
          type: 'CRISIS_RESOURCE',
          category: 'crisis',
          approach: 'hybrid',
          duration: 0,
          difficulty: 'all',
          content: 'url-link',
          isPublished: true
        }
      ]);

      const result = await enhancedRecommendationService.getPersonalizedRecommendations(context);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].type).toBe('crisis-resource');
      expect(result.items[0].reason).toContain('Crisis support resource');
    });

    it('getPersonalizedRecommendations is robust against missing optional/required array fields in context', async () => {
      const context = {
        user: {
          id: 'u1',
          approach: 'hybrid' as const,
          wellnessScore: 50,
          // Omit completedContent, engagementHistory, assessmentResults
        } as any,
        currentState: {}
      };

      prismaMock.content.findMany.mockResolvedValue([]);
      prismaMock.practice.findMany.mockResolvedValue([]);

      // This will verify if EnhancedRecommendationService crashes or handles missing fields gracefully.
      const result = await enhancedRecommendationService.getPersonalizedRecommendations(context);
      expect(result.items).toBeDefined();
    });
  });
});
