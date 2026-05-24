import { PrismaClient } from '@prisma/client';
import type { UserContext } from '../types/ai';
import { crisisDetectionService, CrisisLevel } from './crisisDetectionService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const recommendationLogger = logger.child({ module: 'EnhancedRecommendation' });

type ApproachMode = 'western' | 'eastern' | 'hybrid';
type RecommendationSource = 'library' | 'practice' | 'insight' | 'crisis' | 'fallback';

export interface EnhancedRecommendationContext {
  user: {
    id: string;
    approach: ApproachMode;
    wellnessScore: number;
    recentMood?: string;
    assessmentResults: Array<{
      type: string;
      score: number;
      trend?: string;
      normalizedScore?: number;
    }>;
    chatSentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    completedContent: string[];
    engagementHistory: Array<{
      contentId: string;
      completed: boolean;
      rating?: number | null;
      effectiveness?: number | null;
      timeSpent?: number | null;
    }>;
  };
  currentState: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    availableTime?: number; // minutes
    environment?: 'home' | 'work' | 'public' | 'nature';
    crisisLevel?: CrisisLevel;
    immediateNeed?: boolean;
  };
}

export interface EnhancedRecommendationItem {
  id?: string;
  title: string;
  description?: string | null;
  type: 'content' | 'practice' | 'suggestion' | 'crisis-resource';
  contentType?: string;
  category?: string;
  approach?: string | null;
  duration?: number | null; // seconds or minutes
  difficulty?: string | null;
  tags?: string[];
  focusAreas?: string[];
  url?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  reason: string;
  source: RecommendationSource;
  priority: number; // 1-10, higher = more urgent
  immediateRelief?: boolean;
  effectiveness?: number | null;
  metadata?: Record<string, unknown>;
}

export interface EnhancedRecommendationResult {
  items: EnhancedRecommendationItem[];
  focusAreas: string[];
  rationale: string;
  crisisLevel: CrisisLevel;
  immediateAction: boolean;
  fallbackUsed: boolean;
  fallbackMessage?: string;
}

export class EnhancedRecommendationService {
  private parseStringList(raw?: string | null): string[] {
    if (!raw) return [];

    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((value) => String(value).trim().toLowerCase())
            .filter(Boolean);
        }
      } catch {
        // Fall through to comma-separated parsing.
      }
    }

    return trimmed
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  private overlapCount(left: string[], right: string[]): number {
    if (left.length === 0 || right.length === 0) return 0;
    const rightSet = new Set(right);
    let count = 0;
    for (const value of left) {
      if (rightSet.has(value)) count += 1;
    }
    return count;
  }

  private normalizeFocusAreas(focusAreas: string[]): string[] {
    return Array.from(
      new Set(
        focusAreas
          .map((area) => area.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  /**
   * Get personalized content recommendations with crisis awareness
   */
  async getPersonalizedRecommendations(
    context: EnhancedRecommendationContext,
    maxItems = 6
  ): Promise<EnhancedRecommendationResult> {
    recommendationLogger.info({ userId: context.user.id }, 'Generating enhanced recommendations');

    const focusAreas = this.deriveFocusAreas(context);
    const crisisLevel = context.currentState.crisisLevel || 'NONE';
    const immediateAction = crisisLevel === 'CRITICAL' || crisisLevel === 'HIGH';

    let items: EnhancedRecommendationItem[] = [];
    let fallbackUsed = false;

    try {
      // If crisis detected, prioritize crisis resources
      if (crisisLevel !== 'NONE') {
        const crisisResources = await this.getCrisisResources(crisisLevel);
        items.push(...crisisResources);
      }

      // If immediate relief needed, prioritize quick exercises
      if (context.currentState.immediateNeed || crisisLevel === 'MODERATE') {
        const immediateItems = await this.getImmediateReliefContent(
          context.user.approach,
          focusAreas,
          context.currentState.availableTime
        );
        items.push(...immediateItems);
      }

      // Get personalized content based on engagement history
      const personalizedContent = await this.getEngagementBasedContent(
        context.user.id,
        context.user.engagementHistory,
        context.user.approach,
        focusAreas
      );
      items.push(...personalizedContent);

      // Get practices matching current context
      const practices = await this.getContextualPractices(
        context.user.approach,
        focusAreas,
        context.currentState
      );
      items.push(...practices);

      // If not enough items, add general recommendations
      if (items.length < maxItems) {
        const general = await this.getGeneralContent(
          context.user.approach,
          focusAreas,
          context.user.completedContent
        );
        items.push(...general);
      }

      // If still not enough, use fallbacks
      if (items.length < 3) {
        const fallbacks = this.buildFallbackRecommendations(focusAreas, crisisLevel);
        items.push(...fallbacks);
        fallbackUsed = true;
      }

      // Sort by priority and limit
      items = this.prioritizeRecommendations(items, maxItems, context);

    } catch (error) {
      recommendationLogger.error({ err: error, userId: context.user.id }, 'Recommendation generation failed');
      items = this.buildFallbackRecommendations(focusAreas, crisisLevel);
      fallbackUsed = true;
    }

    const rationale = this.buildRationale(items, focusAreas, crisisLevel);

    return {
      items,
      focusAreas,
      rationale,
      crisisLevel,
      immediateAction,
      fallbackUsed,
      fallbackMessage: fallbackUsed
        ? 'Using curated fallback recommendations while personalizing your feed.'
        : undefined
    };
  }

  /**
   * Derive focus areas from user context
   */
  private deriveFocusAreas(context: EnhancedRecommendationContext): string[] {
    const areas = new Set<string>();

    // From assessments
    (context.user.assessmentResults || []).forEach((result) => {
      const type = result.type.toLowerCase();
      if (result.trend === 'declining' || result.score >= 60) {
        areas.add(type);
      }
      if ((result.normalizedScore || result.score) <= 40) {
        areas.add(`${type}-support`);
      }
    });

    // From mood
    if (context.user.recentMood) {
      const mood = context.user.recentMood.toLowerCase();
      if (['anxious', 'stressed', 'overwhelmed'].some(m => mood.includes(m))) {
        areas.add('anxiety');
        areas.add('stress-relief');
      }
      if (['sad', 'low', 'depressed'].some(m => mood.includes(m))) {
        areas.add('depression');
        areas.add('mood-support');
      }
    }

    // From wellness score
    if (context.user.wellnessScore < 60) {
      areas.add('overall-wellbeing');
    }

    // From chat sentiment
    if (context.user.chatSentiment === 'NEGATIVE') {
      areas.add('emotional-support');
    }

    return Array.from(areas);
  }

  /**
   * Get crisis-specific resources
   */
  private async getCrisisResources(level: CrisisLevel): Promise<EnhancedRecommendationItem[]> {
    const resources = await prisma.content.findMany({
      where: {
        isPublished: true,
        type: 'CRISIS_RESOURCE'
      },
      take: 3
    });

    return resources.map(content => ({
      id: content.id,
      title: content.title,
      description: content.description,
      type: 'crisis-resource' as const,
      contentType: content.type,
      category: content.category,
      approach: content.approach,
      duration: content.duration,
      difficulty: content.difficulty,
      url: content.content,
      reason: `Crisis support resource for ${level.toLowerCase()} risk level`,
      source: 'crisis' as const,
      priority: 10,
      immediateRelief: true,
      metadata: {
        crisisLevel: level
      }
    }));
  }

  /**
   * Get immediate relief content (quick exercises, grounding techniques)
   */
  private async getImmediateReliefContent(
    approach: ApproachMode,
    focusAreas: string[],
    availableTime?: number
  ): Promise<EnhancedRecommendationItem[]> {
    const maxDuration = availableTime ? availableTime * 60 : 600; // Default 10 min

    const content = await prisma.content.findMany({
      where: {
        isPublished: true,
        immediateRelief: true,
        approach: { in: [approach, 'hybrid'] },
        duration: { lte: maxDuration }
      },
      take: 3,
      orderBy: { effectiveness: 'desc' }
    });

    return content.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      type: 'content' as const,
      contentType: item.type,
      category: item.category,
      approach: item.approach,
      duration: item.duration,
      difficulty: item.difficulty,
      url: item.content,
      reason: 'Quick relief technique for immediate support',
      source: 'library' as const,
      priority: 9,
      immediateRelief: true,
      effectiveness: item.effectiveness
    }));
  }

  /**
   * Get content based on user's engagement history
   */
  private async getEngagementBasedContent(
    userId: string,
    engagementHistory: EnhancedRecommendationContext['user']['engagementHistory'],
    approach: ApproachMode,
    focusAreas: string[]
  ): Promise<EnhancedRecommendationItem[]> {
    const history = engagementHistory || [];
    const consumedIds = Array.from(new Set(history.map((entry) => entry.contentId).filter(Boolean)));
    const highRatedIds = Array.from(
      new Set(
        history
          .filter((entry) => (entry.rating || 0) >= 4 || (entry.effectiveness || 0) >= 7)
          .map((entry) => entry.contentId)
          .filter(Boolean)
      )
    );

    if (highRatedIds.length === 0) {
      return [];
    }

    const anchors = await prisma.content.findMany({
      where: {
        isPublished: true,
        id: { in: highRatedIds }
      },
      select: {
        id: true,
        category: true,
        tags: true,
        focusAreas: true,
        type: true
      }
    });

    if (anchors.length === 0) {
      return [];
    }

    const likedCategories = Array.from(
      new Set(
        anchors
          .map((anchor) => anchor.category?.trim().toLowerCase())
          .filter((value): value is string => Boolean(value))
      )
    );
    const likedTypes = Array.from(
      new Set(
        anchors
          .map((anchor) => anchor.type?.trim().toLowerCase())
          .filter((value): value is string => Boolean(value))
      )
    );
    const likedTags = Array.from(new Set(anchors.flatMap((anchor) => this.parseStringList(anchor.tags))));
    const likedFocusAreas = Array.from(new Set(anchors.flatMap((anchor) => this.parseStringList(anchor.focusAreas))));

    const normalizedFocusAreas = this.normalizeFocusAreas(focusAreas);

    const candidates = await prisma.content.findMany({
      where: {
        isPublished: true,
        id: { notIn: consumedIds },
        approach: { in: [approach, 'hybrid'] }
      },
      take: 80,
      orderBy: { createdAt: 'desc' }
    });

    const scored = candidates
      .map((candidate) => {
        const category = candidate.category?.trim().toLowerCase() || '';
        const type = candidate.type?.trim().toLowerCase() || '';
        const tags = this.parseStringList(candidate.tags);
        const candidateFocusAreas = this.parseStringList(candidate.focusAreas);

        const categoryMatched = category ? likedCategories.includes(category) : false;
        const typeMatched = type ? likedTypes.includes(type) : false;
        const tagMatches = this.overlapCount(tags, likedTags);
        const likedFocusMatches = this.overlapCount(candidateFocusAreas, likedFocusAreas);
        const activeFocusMatches = this.overlapCount(candidateFocusAreas, normalizedFocusAreas);

        const similarityScore =
          (categoryMatched ? 4 : 0) +
          (typeMatched ? 2 : 0) +
          tagMatches * 2 +
          likedFocusMatches * 3 +
          activeFocusMatches * 2;

        if (similarityScore <= 0) return null;

        return {
          candidate,
          similarityScore,
          categoryMatched,
          tagMatches,
          likedFocusMatches,
          activeFocusMatches
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => {
        if (left.similarityScore !== right.similarityScore) {
          return right.similarityScore - left.similarityScore;
        }
        return (right.candidate.effectiveness || 0) - (left.candidate.effectiveness || 0);
      })
      .slice(0, 3);

    if (scored.length === 0) {
      recommendationLogger.info({ userId }, 'No similarity matches from engagement history; skipping engagement-based picks');
      return [];
    }

    return scored.map((entry) => {
      const matchingSignals: string[] = [];
      if (entry.categoryMatched && entry.candidate.category) {
        matchingSignals.push(entry.candidate.category);
      }
      if (entry.tagMatches > 0) {
        matchingSignals.push('tags you engaged with');
      }
      if (entry.likedFocusMatches > 0 || entry.activeFocusMatches > 0) {
        matchingSignals.push('your current focus areas');
      }

      const reasonSuffix = matchingSignals.length > 0
        ? ` (${matchingSignals.join(', ')})`
        : '';

      return {
        id: entry.candidate.id,
        title: entry.candidate.title,
        description: entry.candidate.description,
        type: 'content' as const,
        contentType: entry.candidate.type,
        category: entry.candidate.category,
        approach: entry.candidate.approach,
        duration: entry.candidate.duration,
        difficulty: entry.candidate.difficulty,
        url: entry.candidate.content,
        reason: `Based on your positive engagement with similar content${reasonSuffix}`,
        source: 'library' as const,
        priority: 8,
        effectiveness: entry.candidate.effectiveness
      };
    });
  }

  /**
   * Get practices matching current context (time, environment, etc.)
   */
  private async getContextualPractices(
    approach: ApproachMode,
    focusAreas: string[],
    currentState: EnhancedRecommendationContext['currentState']
  ): Promise<EnhancedRecommendationItem[]> {
    const practices = await prisma.practice.findMany({
      where: {
        isPublished: true,
        approach: { in: [approach, 'hybrid', 'All'] },
        duration: currentState.availableTime
          ? { lte: currentState.availableTime }
          : undefined
      },
      take: 4,
      orderBy: { createdAt: 'desc' }
    });

    return practices.map(practice => ({
      id: practice.id,
      title: practice.title,
      description: practice.description,
      type: 'practice' as const,
      category: practice.type,
      approach: practice.approach,
      duration: practice.duration * 60, // Convert to seconds
      difficulty: practice.difficulty,
      audioUrl: practice.audioUrl,
      videoUrl: practice.videoUrl,
      url: practice.audioUrl || practice.videoUrl || practice.youtubeUrl,
      reason: this.buildPracticeReason(practice.type, focusAreas),
      source: 'practice' as const,
      priority: 6,
      metadata: {
        format: practice.format,
        requiredEquipment: practice.requiredEquipment ? JSON.parse(practice.requiredEquipment) : []
      }
    }));
  }

  /**
   * Get general content
   */
  private async getGeneralContent(
    approach: ApproachMode,
    focusAreas: string[],
    completedIds: string[]
  ): Promise<EnhancedRecommendationItem[]> {
    const normalizedFocusAreas = this.normalizeFocusAreas(focusAreas);
    const completed = completedIds || [];

    const candidates = await prisma.content.findMany({
      where: {
        isPublished: true,
        id: { notIn: completed },
        approach: { in: [approach, 'hybrid'] }
      },
      take: 80,
      orderBy: { completions: 'desc' }
    });

    const scored = candidates
      .map((item) => {
        if (normalizedFocusAreas.length === 0) {
          return { item, score: item.completions || 0 };
        }

        const contentSignals = [
          item.category || '',
          item.title || '',
          item.description || ''
        ]
          .join(' ')
          .toLowerCase();
        const tags = this.parseStringList(item.tags);
        const itemFocusAreas = this.parseStringList(item.focusAreas);

        const signalMatches = normalizedFocusAreas.filter((focusArea) =>
          contentSignals.includes(focusArea) || tags.includes(focusArea) || itemFocusAreas.includes(focusArea)
        );

        if (signalMatches.length === 0) {
          return null;
        }

        return {
          item,
          score: signalMatches.length * 3 + (item.effectiveness || 0),
          signalMatches
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    return scored.map((entry) => {
      const isFocusDriven = normalizedFocusAreas.length > 0;
      return {
        id: entry.item.id,
        title: entry.item.title,
        description: entry.item.description,
        type: 'content' as const,
        contentType: entry.item.type,
        category: entry.item.category,
        approach: entry.item.approach,
        duration: entry.item.duration,
        difficulty: entry.item.difficulty,
        url: entry.item.content,
        reason: isFocusDriven
          ? 'Selected for your active focus areas and current wellbeing signals'
          : 'Popular resource for general wellbeing',
        source: 'library' as const,
        priority: isFocusDriven ? 6 : 5,
        effectiveness: entry.item.effectiveness
      };
    });
  }

  /**
   * Build fallback recommendations
   */
  private buildFallbackRecommendations(
    focusAreas: string[],
    crisisLevel: CrisisLevel
  ): EnhancedRecommendationItem[] {
    if (crisisLevel === 'CRITICAL' || crisisLevel === 'HIGH') {
      return [
        {
          title: 'Crisis Support Hotline',
          description: 'Immediate professional support available 24/7',
          type: 'crisis-resource',
          reason: 'Urgent support recommended based on current indicators',
          source: 'fallback',
          priority: 10,
          immediateRelief: true,
          metadata: {
            phone: '988',
            text: '741741'
          }
        }
      ];
    }

    const primary = focusAreas[0] || 'general-wellbeing';
    return [
      {
        title: '5-4-3-2-1 Grounding Exercise',
        description: 'A quick sensory technique to calm anxiety and ground yourself in the present moment',
        type: 'suggestion',
        duration: 300,
        reason: `Grounding technique for ${primary}`,
        source: 'fallback',
        priority: 8,
        immediateRelief: true
      },
      {
        title: 'Box Breathing',
        description: 'Inhale for 4, hold for 4, exhale for 4, hold for 4. Repeat 4 times.',
        type: 'suggestion',
        duration: 120,
        reason: 'Quick breathing exercise for immediate calm',
        source: 'fallback',
        priority: 8,
        immediateRelief: true
      },
      {
        title: 'Self-Compassion Pause',
        description: 'Place a hand on your heart, take three slow breaths, and offer yourself kind words',
        type: 'suggestion',
        duration: 180,
        reason: 'Gentle self-care moment for emotional support',
        source: 'fallback',
        priority: 7
      }
    ];
  }

  /**
   * Prioritize and limit recommendations
   */
  private prioritizeRecommendations(
    items: EnhancedRecommendationItem[],
    maxItems: number,
    context: EnhancedRecommendationContext
  ): EnhancedRecommendationItem[] {
    // Remove duplicates by id/title
    const seen = new Set<string>();
    const unique = items.filter(item => {
      const key = item.id || item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by priority (high to low), then by effectiveness
    const sorted = unique.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return (b.effectiveness || 0) - (a.effectiveness || 0);
    });

    return sorted.slice(0, maxItems);
  }

  /**
   * Build reason for practice recommendation
   */
  private buildPracticeReason(type: string, focusAreas: string[]): string {
    const primary = focusAreas[0];
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    
    if (primary) {
      return `${typeLabel} practice to support ${primary.replace(/-/g, ' ')}`;
    }
    return `${typeLabel} practice for general wellbeing`;
  }

  /**
   * Build rationale for recommendations
   */
  private buildRationale(
    items: EnhancedRecommendationItem[],
    focusAreas: string[],
    crisisLevel: CrisisLevel
  ): string {
    if (crisisLevel === 'CRITICAL' || crisisLevel === 'HIGH') {
      return 'Crisis support resources prioritized based on detected risk indicators. Please reach out for immediate professional help.';
    }

    if (crisisLevel === 'MODERATE') {
      return `Immediate relief techniques prioritized. We're focusing on ${focusAreas.slice(0, 2).join(' and ')} with quick, accessible support.`;
    }

    if (focusAreas.length > 0) {
      const areas = focusAreas.slice(0, 3).map(a => a.replace(/-/g, ' ')).join(', ');
      return `Personalized for ${areas} based on your recent assessments and engagement patterns.`;
    }

    return `Balanced recommendations to support your overall wellbeing and continue your progress.`;
  }
}

// Export singleton instance
export const enhancedRecommendationService = new EnhancedRecommendationService();
