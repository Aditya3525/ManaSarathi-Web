import { PrismaClient } from '@prisma/client';
import { LLMService } from './llmProvider';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const llmService = new LLMService();
const serviceLogger = logger.child({ module: 'ChatbotService' });

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ConversationInsights {
  emotionalState: string;
  keyTopics: string[];
  urgencyLevel: string;
}

export class ChatbotService {
  /**
   * Start a new conversation session
   */
  async startConversation(userId: string): Promise<string> {
    try {
      const conversation = await prisma.chatbotConversation.create({
        data: {
          userId,
          messages: JSON.stringify([]),
          startedAt: new Date(),
        },
      });

      serviceLogger.info({ conversationId: conversation.id, userId }, 'Started new conversation');
      return conversation.id;
    } catch (error) {
      serviceLogger.error({ error, userId }, 'Failed to start conversation');
      throw error;
    }
  }

  /**
   * Add a message to an ongoing conversation
   */
  async addMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    try {
      const conversation = await prisma.chatbotConversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (conversation.userId !== userId) {
        throw new Error('Unauthorized access to conversation');
      }

      // Parse existing messages
      const messages: ChatMessage[] = JSON.parse(conversation.messages);
      
      // Add new message
      messages.push({
        role,
        content,
        timestamp: new Date(),
      });

      // Update conversation
      await prisma.chatbotConversation.update({
        where: { id: conversationId },
        data: {
          messages: JSON.stringify(messages),
          updatedAt: new Date(),
        },
      });

      serviceLogger.debug(
        { conversationId, role, messageLength: content.length },
        'Added message to conversation'
      );
    } catch (error) {
      serviceLogger.error({ error, conversationId }, 'Failed to add message');
      throw error;
    }
  }

  /**
   * End a conversation and generate AI summary
   */
  async endConversation(conversationId: string, userId: string): Promise<void> {
    try {
      const conversation = await prisma.chatbotConversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (conversation.userId !== userId) {
        throw new Error('Unauthorized access to conversation');
      }

      const messages: ChatMessage[] = JSON.parse(conversation.messages);

      // Generate AI summary and extract insights
      const summary = await this.generateConversationSummary(messages);
      const insights = this.extractInsights(messages);

      // Update conversation with summary and insights
      await prisma.chatbotConversation.update({
        where: { id: conversationId },
        data: {
          endedAt: new Date(),
          summary: summary,
          summaryGeneratedAt: new Date(),
          emotionalState: insights.emotionalState,
          keyTopics: JSON.stringify(insights.keyTopics),
          urgencyLevel: insights.urgencyLevel,
          updatedAt: new Date(),
        },
      });

      // Invalidate dashboard insights cache
      await this.invalidateDashboardCache(conversation.userId);

      serviceLogger.info(
        { 
          conversationId, 
          messageCount: messages.length,
          emotionalState: insights.emotionalState,
          topicCount: insights.keyTopics.length,
        },
        'Ended conversation with AI summary'
      );
    } catch (error) {
      serviceLogger.error({ error, conversationId }, 'Failed to end conversation');
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string) {
    try {
      const conversation = await prisma.chatbotConversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return null;
      }

      return {
        ...conversation,
        messages: JSON.parse(conversation.messages) as ChatMessage[],
        keyTopics: JSON.parse(conversation.keyTopics) as string[],
      };
    } catch (error) {
      serviceLogger.error({ error, conversationId }, 'Failed to get conversation');
      throw error;
    }
  }

  /**
   * Get recent conversations for a user
   */
  async getUserConversations(userId: string, limit: number = 20) {
    try {
      const conversations = await prisma.chatbotConversation.findMany({
        where: {
          userId,
          endedAt: { not: null },
        },
        orderBy: { endedAt: 'desc' },
        take: limit,
      });

      return conversations.map((conv: any) => ({
        ...conv,
        messages: JSON.parse(conv.messages) as ChatMessage[],
        keyTopics: JSON.parse(conv.keyTopics) as string[],
      }));
    } catch (error) {
      serviceLogger.error({ error, userId }, 'Failed to get user conversations');
      throw error;
    }
  }

  /**
   * Generate AI summary of conversation
   */
  private async generateConversationSummary(messages: ChatMessage[]): Promise<string> {
    if (messages.length === 0) {
      return 'Empty conversation.';
    }

    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const assistantMessages = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n');

    const prompt = `Summarize this wellbeing chatbot conversation in 2-3 sentences. Focus on:
1. Main concerns or topics discussed
2. User's emotional state or journey
3. Key insights or breakthroughs (if any)

User messages:
${userMessages}

Assistant responses:
${assistantMessages}

Provide a compassionate, professional summary (max 150 words):`;

    try {
      serviceLogger.debug({ messageCount: messages.length }, 'Generating AI conversation summary');
      
      const response = await llmService.generateResponse(
        [
          { 
            role: 'system', 
            content: 'You are a wellbeing professional summarizing conversations. Be compassionate, accurate, and concise.' 
          },
          { role: 'user', content: prompt },
        ],
        { 
          maxTokens: 200, 
          temperature: 0.5,
          model: 'gpt-oss:20b-cloud'
        }
      );

      // Handle AIResponse object - extract content string
      const summaryText = typeof response === 'string' ? response : response?.content || '';
      
      if (summaryText && summaryText.trim().length > 0) {
        serviceLogger.info('AI conversation summary generated successfully');
        return summaryText.trim();
      }

      serviceLogger.warn('AI returned empty summary, using fallback');
      return this.generateFallbackSummary(messages);
    } catch (error) {
      serviceLogger.error({ error }, 'Failed to generate AI summary, using fallback');
      return this.generateFallbackSummary(messages);
    }
  }

  /**
   * Extract insights from conversation using pattern matching
   */
  private extractInsights(messages: ChatMessage[]): ConversationInsights {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.toLowerCase())
      .join(' ');

    // Detect emotional state
    let emotionalState = 'neutral';
    const emotionalPatterns = {
      anxious: ['anxious', 'worried', 'nervous', 'panic', 'fear', 'scared'],
      sad: ['sad', 'depressed', 'down', 'hopeless', 'empty', 'lonely'],
      stressed: ['stressed', 'overwhelmed', 'pressure', 'burden', 'exhausted'],
      angry: ['angry', 'frustrated', 'mad', 'furious', 'irritated'],
      positive: ['happy', 'good', 'better', 'improving', 'hopeful', 'grateful'],
    };

    for (const [state, keywords] of Object.entries(emotionalPatterns)) {
      if (keywords.some(keyword => userContent.includes(keyword))) {
        emotionalState = state;
        break;
      }
    }

    // Extract key topics
    const topicKeywords = {
      'work stress': ['work', 'job', 'career', 'boss', 'colleague', 'deadline'],
      'relationships': ['relationship', 'partner', 'family', 'friend', 'marriage', 'divorce'],
      'sleep': ['sleep', 'insomnia', 'tired', 'rest', 'nightmare', 'wake up'],
      'anxiety': ['anxiety', 'anxious', 'panic', 'worry', 'fear'],
      'depression': ['depression', 'sad', 'hopeless', 'suicidal', 'worthless'],
      'self-care': ['exercise', 'meditation', 'hobby', 'self-care', 'relax'],
      'trauma': ['trauma', 'abuse', 'ptsd', 'flashback', 'trigger'],
      'health': ['health', 'illness', 'pain', 'medication', 'doctor'],
      'grief': ['grief', 'loss', 'death', 'mourning', 'bereaved'],
      'confidence': ['confidence', 'self-esteem', 'insecure', 'doubt', 'inadequate'],
    };

    const keyTopics: string[] = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const matchCount = keywords.filter(keyword => userContent.includes(keyword)).length;
      if (matchCount >= 1) {
        keyTopics.push(topic);
      }
    }

    // Determine urgency level
    let urgencyLevel = 'low';
    const urgentKeywords = ['crisis', 'harm', 'suicide', 'kill', 'emergency', 'urgent', 'dying'];
    const moderateKeywords = ['can\'t cope', 'desperate', 'severe', 'unbearable', 'breaking down'];

    if (urgentKeywords.some(keyword => userContent.includes(keyword))) {
      urgencyLevel = 'high';
    } else if (moderateKeywords.some(keyword => userContent.includes(keyword))) {
      urgencyLevel = 'medium';
    }

    serviceLogger.debug(
      { emotionalState, topicCount: keyTopics.length, urgencyLevel },
      'Extracted conversation insights'
    );

    return { emotionalState, keyTopics, urgencyLevel };
  }

  /**
   * Generate fallback summary when AI is unavailable
   */
  private generateFallbackSummary(messages: ChatMessage[]): string {
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const assistantMessageCount = messages.filter(m => m.role === 'assistant').length;
    
    const insights = this.extractInsights(messages);
    const topicsText = insights.keyTopics.length > 0 
      ? ` Topics discussed: ${insights.keyTopics.slice(0, 3).join(', ')}.`
      : '';

    return `Conversation included ${userMessageCount} user messages and ${assistantMessageCount} responses about wellbeing.${topicsText} Emotional state: ${insights.emotionalState}.`;
  }

  /**
   * Invalidate dashboard insights cache when new chat data is available
   */
  private async invalidateDashboardCache(userId: string): Promise<void> {
    try {
      await prisma.dashboardInsights.deleteMany({
        where: { userId },
      });
      serviceLogger.debug({ userId }, 'Invalidated dashboard insights cache');
    } catch (error) {
      serviceLogger.warn({ error, userId }, 'Failed to invalidate cache (non-critical)');
    }
  }

  /**
   * Get conversation statistics for a user
   */
  async getConversationStats(userId: string) {
    try {
      const totalConversations = await prisma.chatbotConversation.count({
        where: { userId, endedAt: { not: null } },
      });

      const recentConversations = await prisma.chatbotConversation.findMany({
        where: {
          userId,
          endedAt: { not: null },
        },
        orderBy: { endedAt: 'desc' },
        take: 10,
      });

      // Aggregate emotional states
      const emotionalStates = recentConversations
        .map((c: any) => c.emotionalState)
        .filter(Boolean);

      const emotionalStateCount = emotionalStates.reduce((acc: Record<string, number>, state: string) => {
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Aggregate topics
      const allTopics = recentConversations
        .flatMap((c: any) => JSON.parse(c.keyTopics) as string[]);

      const topicCount = allTopics.reduce((acc: Record<string, number>, topic: string) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get most common topics (top 5)
      const topTopics = Object.entries(topicCount)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([topic]) => topic);

      return {
        totalConversations,
        recentConversations: recentConversations.length,
        emotionalStates: emotionalStateCount,
        topTopics,
        lastConversationDate: recentConversations[0]?.endedAt || null,
      };
    } catch (error) {
      serviceLogger.error({ error, userId }, 'Failed to get conversation stats');
      throw error;
    }
  }
}

export const chatbotService = new ChatbotService();
