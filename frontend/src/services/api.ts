/**
 * API Service
 *
 * Centralised HTTP client for all back-end API endpoints.
 * Provides typed objects for each resource area and the shared types
 * used throughout the front-end.
 */

import { getApiBaseUrl } from '../config/apiConfig';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── User / Auth ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePhoto?: string | null;
  isOnboarded?: boolean;
  approach?: 'western' | 'eastern' | 'hybrid' | null;
  birthday?: string | null;
  gender?: string | null;
  region?: string | null;
  language?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  dataConsent?: boolean;
  clinicianSharing?: boolean;
  hasPassword?: boolean;
  securityQuestion?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Assessments ──────────────────────────────────────────────────────────────

export type AssessmentTrend = 'improving' | 'declining' | 'stable' | 'baseline';

export interface AssessmentTypeSummary {
  latestScore: number;
  previousScore: number | null;
  change: number | null;
  averageScore: number;
  bestScore: number;
  trend: AssessmentTrend;
  interpretation: string;
  recommendations: string[];
  lastCompletedAt: string;
  historyCount: number;
  normalizedScore?: number;
  rawScore?: number;
  maxScore?: number;
  categoryBreakdown?: Record<string, {
    raw: number;
    normalized: number;
    interpretation: string;
  }>;
}

export interface AssessmentInsights {
  byType: Record<string, AssessmentTypeSummary>;
  aiSummary: string;
  overallTrend: AssessmentTrend | 'mixed';
  wellnessScore?: {
    value: number;
    method: string;
    updatedAt: string;
  };
  updatedAt: string;
}

export interface AssessmentHistoryEntry {
  id: string;
  assessmentType: string;
  score: number;
  interpretation: string;
  changeFromPrevious: number | null;
  trend: AssessmentTrend;
  completedAt: string;
  responses: Record<string, unknown> | null;
  rawScore?: number | null;
  maxScore?: number | null;
  categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation: string }>;
}

export interface AssessmentOption {
  id: string;
  text: string;
  value: number;
  order: number;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  order?: number;
  domain?: string | null;
  reverseScored?: boolean;
  options: AssessmentOption[];
  responseType?: string;
  uiType?: 'likert' | 'binary' | 'multiple-choice';
}

export interface AvailableAssessment {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  timeEstimate: string;
  questions: number;
  tags: string;
  difficulty?: string;
  assessmentType?: string;
}

export interface AssessmentTemplate {
  id?: string;
  title: string;
  description: string;
  type?: string;
  category?: string;
  timeEstimate?: string;
  estimatedTime?: string;
  questions: AssessmentQuestion[];
  tags?: string;
  difficulty?: string;
  assessmentType: string;
  definitionId?: string;
  scoring: AssessmentTemplateScoring;
}

export interface AssessmentTemplateScoring {
  minScore?: number;
  maxScore?: number;
  interpretationBands?: Array<{ max: number; label: string }>;
  reverseScored?: string[];
  domains?: Array<{
    id?: string;
    label: string;
    items: string[];
    minScore?: number;
    maxScore?: number;
    interpretationBands?: Array<{ max: number; label: string }>;
  }>;
}

export interface AssessmentSessionSummary {
  id: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  selectedTypes: string[];
  completedTypes: string[];
  pendingTypes: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Mood ─────────────────────────────────────────────────────────────────────

export interface MoodEntry {
  id: string;
  mood: string;
  notes: string | null;
  emotion?: string | null;
  emotionGroup?: string | null;
  intensity?: number | null;
  trigger?: string | null;
  createdAt: string;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  userId: string;
  prompt: string | null;
  content: string;
  mood: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalPrompt {
  prompt: string;
  emotion: string;
  approach: string;
}

export interface JournalReflection {
  id: string;
  userId: string;
  weekOf: string;
  patterns: {
    recurringThemes: string[];
    emotionalTrend: string;
    insights: string[];
  };
  aiSummary: string;
  createdAt: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface UserPlanState {
  id?: string;
  userId: string;
  moduleId: string;
  completed: boolean;
  progress: number;
  completedAt?: string | null;
  updatedAt?: string | null;
  scheduledFor?: string | null;
  notes?: string | null;
}

export interface PlanModuleWithState {
  id: string;
  title: string;
  description: string | null;
  type: string;
  duration?: string | number | null;
  order: number;
  isCompleted?: boolean;
  completedAt?: string | null;
  progress?: number;
  userState?: UserPlanState | null;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressEntry {
  id: string;
  metric: string;
  value: number;
  unit?: string | null;
  notes?: string | null;
  date: string;
}

// ─── Engagement ───────────────────────────────────────────────────────────────

export interface UserEngagementRecord {
  id: string;
  userId: string;
  contentId: string;
  completed: boolean;
  rating: number | null;
  timeSpent: number | null;
  moodBefore: string | null;
  moodAfter: string | null;
  effectiveness: number | null;
  createdAt: string;
  updatedAt: string;
  content?: {
    id: string;
    title: string;
    type: string;
    thumbnailUrl?: string | null;
  } | null;
}

// ─── Checkins ─────────────────────────────────────────────────────────────────

export interface MicroCheckin {
  id: string;
  userId: string;
  type: 'morning' | 'evening' | 'post-chat';
  responses: Record<string, any>;
  mood?: string | null;
  createdAt: string;
}

export interface CheckinSummary {
  checkins: MicroCheckin[];
  avgEnergy: number | null;
  avgDayRating: number | null;
  totalCheckins: number;
  days: number;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  messageCount?: number;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  type?: 'user' | 'bot' | 'system' | null;
  metadata?: any;
  [key: string]: any;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ExerciseRecommendationsResponse {
  exercises: Array<{
    title: string;
    description: string;
    type: string;
    duration?: string;
    instructions?: string[];
  }>;
  rationale?: string;
}

// ─── Dashboard, Sleep, Intentions, Crisis, Habits, Gratitude Types ───

export interface CrisisEvent {
  id: string;
  userId: string;
  detectedAt: string;
  resolved: boolean;
  followUpResponse: 'better' | 'same' | 'struggling' | null;
  resolvedAt?: string | null;
}

export interface DailyIntention {
  id: string;
  userId: string;
  intention: string;
  isCustom: boolean;
  completed: boolean | null;
  reflection: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SleepLog {
  id: string;
  userId: string;
  bedTime: string;
  wakeTime: string;
  quality: number;
  factors?: string[] | null;
  duration: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SleepStats {
  periodDays: number;
  totalLogs: number;
  averageQuality: number | null;
  averageDuration: number | null;
  commonFactors: Array<{ factor: string; count: number }>;
}

export interface GratitudeEntry {
  id: string;
  userId: string;
  items: string[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserHabit {
  id: string;
  userId: string;
  title: string;
  cue: string;
  practiceId: string | null;
  active: boolean;
  streak: number;
  lastCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdaptiveNudge {
  id: string;
  type: string;
  title: string;
  message: string;
  actionLabel?: string | null;
  actionType?: string | null;
  actionData?: Record<string, unknown> | null;
  severity?: 'success' | 'warning' | 'info' | null;
  dismissible?: boolean;
  createdAt: string;
  ctaLabel?: string | null;
  ctaPage?: string | null;
}

export interface AssessmentReminder {
  shouldRemind: boolean;
  reason: 'first-assessment' | 'stale-assessment' | 'recent-assessment';
  thresholdDays: number;
  daysSinceLastAssessment: number | null;
  lastCompletedAt: string | null;
  lastAssessmentType: string | null;
  message: string;
}

export interface CommunityInsightsPayload {
  metrics: Array<{
    id?: string;
    label: string;
    value: string | number;
    description: string;
    icon?: string;
    unit?: string | null;
    sampleSize?: number | null;
  }>;
  generatedAt: string;
}

export type OneThingActionType =
  | 'mood'
  | 'habit'
  | 'checkin'
  | 'assessment'
  | 'chat'
  | 'practice'
  | 'default';

export interface DashboardMode {
  mode: 'default' | 'crisis' | 'recovery' | 'maintenance' | 'focus';
  priorityWidgets: string[];
  collapsedWidgets: string[];
  message?: string | null;
  oneThingToday?: {
    title: string;
    description: string;
    actionType: OneThingActionType;
    actionData?: Record<string, any>;
  } | null;
}

export interface DashboardSummaryData {
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    approach: string | null;
    profileCompletion: number;
    memberSince: string;
  };
  assessmentScores: {
    anxiety: number | null;
    stress: number | null;
    emotionalIntelligence: number | null;
    wellnessScore: number | null;
    byType: Record<string, any>;
    overallTrend: string;
    aiSummary: string;
    updatedAt: string;
  } | null;
  recentInsights: Array<{
    type: 'ai-summary' | 'pattern' | 'progress';
    title: string;
    description: string;
    icon: string;
    severity?: 'success' | 'warning' | 'info';
    timestamp: string;
  }>;
  weeklyProgress: {
    practices: {
      completed: number;
      goal: number;
      percentage: number;
    };
    moodCheckins: {
      completed: number;
      goal: number;
      percentage: number;
    };
    assessments: {
      completed: number;
      goal: number;
      percentage: number;
    };
    currentStreak: number;
  };
  recentMoods: Array<{
    mood: string;
    notes: string | null;
    createdAt: string;
  }>;
  recommendedPractice: {
    id?: string;
    title: string;
    description: string | null;
    type: string;
    duration: string | number | null;
    tags: string[] | string | null;
    reason: string;
    approach: string | null;
  } | null;
}

export interface WeeklyProgressData {
  practices: {
    completed: number;
    goal: number;
    percentage: number;
    details: Array<{
      title: string;
      type: string;
      completedAt: string | null;
    }>;
  };
  moodCheckins: {
    completed: number;
    goal: number;
    percentage: number;
    moodDistribution: Record<string, number>;
  };
  assessments: {
    completed: number;
    goal: number;
    percentage: number;
    types: string[];
  };
  streak: {
    current: number;
    message: string;
  };
}

export interface DashboardUnifiedData {
  summary: DashboardSummaryData | null;
  weeklyProgress: WeeklyProgressData | null;
  mode: DashboardMode | null;
  checkins?: {
    checkins: MicroCheckin[];
    avgEnergy: number | null;
    avgDayRating: number | null;
    totalCheckins: number;
    days: number;
  } | null;
  crisisEvents?: CrisisEvent[] | null;
  intention: DailyIntention | null;
  sleep?: {
    history: {
      logs: SleepLog[];
      days: number;
      total: number;
    };
    stats: SleepStats;
  } | null;
  gratitude?: {
    entries: GratitudeEntry[];
    days: number;
    total: number;
  } | null;
  nudges?: {
    nudges: AdaptiveNudge[];
    total: number;
  } | null;
  assessmentReminder: AssessmentReminder | null;
  habits?: {
    habits: UserHabit[];
    total: number;
  } | null;
  communityInsights: CommunityInsightsPayload | null;
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

const getToken = (): string | null => localStorage.getItem('token');

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
    });

    // For blob responses (export endpoints) we handle them separately
    if (options.headers && (options.headers as any)['Accept']?.includes('blob')) {
      if (!response.ok) {
        return { success: false, error: `Request failed with status ${response.status}` };
      }
      return { success: true, data: response as unknown as T };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.error || `Request failed with status ${response.status}` };
    }

    // Backend wraps responses in { success, data } — pass through directly
    if ('success' in data) {
      return data as ApiResponse<T>;
    }

    return { success: true, data: data as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  return response.blob();
}

// ─── assessmentsApi ───────────────────────────────────────────────────────────

export const assessmentsApi = {
  listAssessments: () =>
    request<AssessmentHistoryEntry[]>('/assessments'),

  getAvailableAssessments: () =>
    request<AvailableAssessment[]>('/assessments/available'),

  getAssessmentTemplates: (types?: string[]) => {
    const params = types?.length ? `?types=${types.join(',')}` : '';
    return request<{ templates: AssessmentTemplate[] }>(`/assessments/templates${params}`);
  },

  submitAssessment: (payload: {
    assessmentType: string;
    responses: Record<string, number | string>;
    score: number;
    rawScore?: number;
    maxScore?: number;
    sessionId?: string;
    responseDetails?: Array<{
      questionId: string;
      questionText: string;
      answerLabel: string;
      answerValue: string | number | null;
      answerScore?: number;
    }>;
    categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation?: string }>;
  }) =>
    request<{
      assessment: AssessmentHistoryEntry;
      history: AssessmentHistoryEntry[];
      insights: AssessmentInsights;
      session?: AssessmentSessionSummary;
    }>('/assessments', { method: 'POST', body: JSON.stringify(payload) }),

  submitCombinedAssessments: (payload: {
    sessionId: string;
    assessments: Array<{
      assessmentType: string;
      responses: Record<string, string>;
      score: number;
      rawScore: number;
      maxScore: number;
      categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation?: string }>;
      responseDetails: Array<{
        questionId: string;
        questionText: string;
        answerLabel: string;
        answerValue: string | number | null;
        answerScore?: number;
      }>;
    }>;
  }) =>
    request<{
      session: AssessmentSessionSummary;
      insights: AssessmentInsights;
      history: AssessmentHistoryEntry[];
    }>('/assessments/submit-combined', { method: 'POST', body: JSON.stringify(payload) }),

  getAssessmentHistory: () =>
    request<{ history: AssessmentHistoryEntry[]; insights: AssessmentInsights }>('/assessments/history'),

  startAssessmentSession: (payload: { selectedTypes: string[] }) =>
    request<{ session: AssessmentSessionSummary }>('/assessments/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getActiveAssessmentSession: () =>
    request<{ session: AssessmentSessionSummary | null }>('/assessments/sessions/active'),

  getAssessmentSessionById: (sessionId: string) =>
    request<{ session: AssessmentSessionSummary }>(`/assessments/sessions/${sessionId}`),

  updateAssessmentSessionStatus: (sessionId: string, status: 'completed' | 'cancelled') =>
    request<{ session: AssessmentSessionSummary }>(`/assessments/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ─── chatApi ──────────────────────────────────────────────────────────────────

export interface SendMessageResponse {
  message: ConversationMessage;
  conversationId?: string;
  crisis?: boolean;
  smartReplies?: string[];
  assessmentPrompt?: any;
  exerciseRecommendations?: ExerciseRecommendationsResponse;
  response?: ConversationMessage;
}

export type ChatSendMessageResponse = SendMessageResponse;

export interface ProactiveCheckIn {
  shouldCheckIn: boolean;
  shouldShow?: boolean;
  message: string;
  priority: 'high' | 'low' | 'medium';
  reason?: string;
}

export const chatApi = {
  sendMessage: (
    content: string,
    conversationId?: string,
    options?: { simpleLanguage?: boolean }
  ) =>
    request<SendMessageResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        content,
        conversationId,
        simpleLanguage: options?.simpleLanguage,
      }),
    }),

  streamMessage: async (
    content: string,
    conversationId?: string,
    options?: { simpleLanguage?: boolean },
    onEvent?: (event: any) => void
  ): Promise<SendMessageResponse> => {
    const response = await fetch(`${getApiBaseUrl()}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({
        content,
        conversationId,
        simpleLanguage: options?.simpleLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start stream with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable body stream found on response');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let donePayload: SendMessageResponse | null = null;

    let streaming = true;
    try {
      while (streaming) {
        const { value, done } = await reader.read();
        if (done) {
          streaming = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          
          try {
            const dataStr = trimmed.slice(6);
            const parsed = JSON.parse(dataStr);
            if (onEvent) {
              onEvent(parsed);
            }
            if (parsed.type === 'done') {
              donePayload = parsed.payload;
            }
          } catch (e) {
            console.error('Failed to parse SSE message line', line, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!donePayload) {
      throw new Error('Stream ended without a done payload');
    }

    return donePayload;
  },

  getChatHistory: () =>
    request<ConversationMessage[]>('/chat/history'),

  getConversationStarters: () =>
    request<string[]>('/chat/starters'),

  getProactiveCheckIn: () =>
    request<ProactiveCheckIn>('/chat/check-in'),

  getMoodBasedGreeting: () =>
    request<{ greeting: string }>('/chat/greeting'),

  getExerciseRecommendations: (context: Record<string, unknown>) =>
    request<ExerciseRecommendationsResponse>('/chat/exercises', {
      method: 'POST',
      body: JSON.stringify(context),
    }),

  submitMessageFeedback: (
    messageId: string,
    feedback: 'liked' | 'disliked',
    note?: string
  ) =>
    request<{
      messageId: string;
      feedback: 'liked' | 'disliked';
      note: string | null;
      repairPrompt?: string | null;
    }>(`/chat/message/${messageId}/feedback`, {
      method: 'PUT',
      body: JSON.stringify({ feedback, note }),
    }),
};

// ─── conversationsApi ─────────────────────────────────────────────────────────

export const conversationsApi = {
  getConversations: (includeArchived = false) =>
    request<Conversation[]>(`/conversations?includeArchived=${includeArchived}`),

  getConversation: (conversationId: string) =>
    request<ConversationWithMessages>(`/conversations/${conversationId}`),

  createConversation: (title?: string) =>
    request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  updateConversation: (conversationId: string, updates: { title?: string; isArchived?: boolean }) =>
    request<Conversation>(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteConversation: (conversationId: string) =>
    request<void>(`/conversations/${conversationId}`, { method: 'DELETE' }),

  searchConversations: (query: string) =>
    request<Conversation[]>(`/conversations/search?q=${encodeURIComponent(query)}`),

  getConversationCount: (includeArchived = false) =>
    request<{ count: number }>(`/conversations/count?includeArchived=${includeArchived}`),

  archiveConversation: (conversationId: string, isArchived: boolean) =>
    request<void>(`/conversations/${conversationId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ isArchived }),
    }),

  generateTitle: (conversationId: string) =>
    request<{ title: string }>(`/conversations/${conversationId}/title`, { method: 'POST' }),

  exportConversation: (
    conversationId: string,
    format: 'pdf' | 'text' | 'json',
    includeSystemMessages = true
  ): Promise<Blob> =>
    requestBlob(
      `/conversations/${conversationId}/export?format=${format}&includeSystemMessages=${includeSystemMessages}`
    ),

  exportBulkConversations: (conversationIds: string[], format: 'text' | 'json'): Promise<Blob> =>
    requestBlob('/conversations/export/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationIds, format }),
    }),
};

// ─── moodApi ──────────────────────────────────────────────────────────────────

export const moodApi = {
  getMoodHistory: () =>
    request<MoodEntry[]>('/mood'),

  logMood: (payload: {
    mood: string;
    notes?: string;
    emotion?: string;
    emotionGroup?: string;
    intensity?: number;
    trigger?: string;
  }) =>
    request<MoodEntry>('/mood', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMoodEntry: (id: string) =>
    request<void>(`/mood/${id}`, { method: 'DELETE' }),

  getMoodStats: () =>
    request<Record<string, unknown>>('/mood/stats'),
};

// ─── journalApi ───────────────────────────────────────────────────────────────

export const journalApi = {
  getEntries: (days = 30) =>
    request<{ entries: JournalEntry[]; days: number; total: number }>(`/journal?days=${days}`),

  getPrompt: () =>
    request<JournalPrompt>('/journal/prompts'),

  getReflection: () =>
    request<JournalReflection>('/journal/reflection'),

  createEntry: (payload: { prompt?: string; content: string; mood?: string; tags?: string[] }) =>
    request<JournalEntry>('/journal', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteEntry: (id: string) =>
    request<{ message: string }>(`/journal/${id}`, { method: 'DELETE' }),
};

// ─── plansApi ─────────────────────────────────────────────────────────────────

export const plansApi = {
  getPersonalizedPlan: () =>
    request<{ modules: PlanModuleWithState[]; planId?: string }>('/plans/personalized'),

  getUserPlan: (userId: string) =>
    request<{ modules: PlanModuleWithState[] }>(`/plans/${userId}`),

  updateModuleProgress: (moduleId: string, progress: number) =>
    request<PlanModuleWithState>(`/plans/modules/${moduleId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ progress }),
    }),

  completeModule: (moduleId: string) =>
    request<PlanModuleWithState>(`/plans/modules/${moduleId}/complete`, { method: 'POST' }),
};

// ─── progressApi ──────────────────────────────────────────────────────────────

export const progressApi = {
  trackProgress: (metric: string, value: number, notes?: string) =>
    request<ProgressEntry>('/progress', {
      method: 'POST',
      body: JSON.stringify({ metric, value, notes }),
    }),

  getProgressHistory: () =>
    request<ProgressEntry[]>('/progress'),
};

// ─── engagementApi ────────────────────────────────────────────────────────────

export const engagementApi = {
  getMyEngagements: () =>
    request<UserEngagementRecord[]>('/content/engagements/me'),

  engageContent: (contentId: string, payload: {
    completed: boolean;
    rating?: number;
    timeSpent?: number;
    moodBefore?: string;
    moodAfter?: string;
    effectiveness?: number;
  }) =>
    request<UserEngagementRecord>(`/content/${contentId}/engage`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleBookmark: (contentId: string) =>
    request<{ bookmarked: boolean }>(`/content/${contentId}/bookmark`, {
      method: 'POST',
    }),

  getBookmarks: () =>
    request<{ content: any[]; practices: any[] }>('/content/bookmarks'),
};

// ─── checkinsApi ──────────────────────────────────────────────────────────────

export const checkinsApi = {
  createCheckin: (payload: { type: 'morning' | 'evening' | 'post-chat'; responses: Record<string, any>; mood?: string }) =>
    request<MicroCheckin>('/checkins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCheckinSummary: (days?: number) => {
    const params = days ? `?days=${days}` : '';
    return request<CheckinSummary>(`/checkins/summary${params}`);
  },
};

// ─── authApi ──────────────────────────────────────────────────────────────────

export const authApi = {
  updateSecurityQuestionWithPassword: (payload: {
    currentPassword: string;
    question: string;
    answer: string;
  }) =>
    request<{ user: User }>('/auth/security-question/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetPasswordAuthenticated: (payload: { answer: string; newPassword: string }) =>
    request<void>('/auth/password/reset-with-answer', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateApproachWithPassword: (payload: {
    password: string;
    approach: 'western' | 'eastern' | 'hybrid';
  }) =>
    request<{ user: User }>('/auth/approach/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── usersApi ─────────────────────────────────────────────────────────────────

export const usersApi = {
  // userId is accepted for compatibility; the server identifies the user via the JWT token.
  updateProfile: (userId: string, payload: Partial<User>) =>
    request<{ user: User }>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

// ─── privacyApi ───────────────────────────────────────────────────────────────

export const privacyApi = {
  getSettings: () =>
    request<{
      dataSharing: boolean;
      clinicianAccess: boolean;
      anonymousAnalytics: boolean;
      marketingEmails: boolean;
      researchParticipation: boolean;
      consentUpdatedAt?: string;
    }>('/privacy/settings'),

  updateSettings: (settings: Record<string, boolean>) =>
    request<{ consentUpdatedAt?: string }>('/privacy/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  exportData: async (
    format: 'pdf' | 'json' | 'csv' | 'text',
    sections?: string[]
  ): Promise<void> => {
    const blob = await requestBlob('/privacy/export-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, sections }),
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maan-sarathi-data.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  deleteAccount: (confirm?: string) =>
    request<void>('/privacy/delete-account', {
      method: 'POST',
      body: JSON.stringify({ confirmation: confirm }),
    }),
};

// ─── adminApi ─────────────────────────────────────────────────────────────────

export const adminApi = {
  listAssessments: () =>
    request<unknown[]>('/admin/assessments'),

  getAssessment: (id: string) =>
    request<unknown>(`/admin/assessments/${id}`),

  getAssessmentCategories: () =>
    request<string[]>('/admin/assessments/categories'),

  createAssessment: (payload: Record<string, unknown>) =>
    request<unknown>('/admin/assessments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAssessment: (id: string, payload: Record<string, unknown>) =>
    request<unknown>(`/admin/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAssessment: (id: string) =>
    request<void>(`/admin/assessments/${id}`, { method: 'DELETE' }),

  duplicateAssessment: (id: string) =>
    request<unknown>(`/admin/assessments/${id}/duplicate`, { method: 'POST' }),
};

// ─── crisisApi ────────────────────────────────────────────────────────────────

export const crisisApi = {
  getRecentEvents: () =>
    request<CrisisEvent[]>('/crisis/recent-events'),

  submitFollowUp: (payload: { eventId: string; response: 'better' | 'same' | 'struggling' }) =>
    request<CrisisEvent>('/crisis/follow-up', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── intentionsApi ────────────────────────────────────────────────────────────

export const intentionsApi = {
  getPresets: () =>
    request<string[]>('/intentions/presets'),

  getTodayIntention: () =>
    request<DailyIntention | null>('/intentions/today'),

  setTodayIntention: (payload: { intention: string; isCustom?: boolean }) =>
    request<DailyIntention>('/intentions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reflect: (id: string, payload: { completed: boolean; reflection?: string }) =>
    request<DailyIntention>(`/intentions/${id}/reflect`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getHistory: (days = 7) =>
    request<{ intentions: DailyIntention[]; days: number; total: number }>(`/intentions?days=${days}`),
};

// ─── sleepApi ─────────────────────────────────────────────────────────────────

export const sleepApi = {
  getStats: (days = 30) =>
    request<SleepStats>(`/sleep/stats?days=${days}`),

  getHistory: (days = 30) =>
    request<{ logs: SleepLog[]; days: number; total: number }>(`/sleep?days=${days}`),

  logSleep: (payload: {
    bedTime: string;
    wakeTime: string;
    quality: number;
    factors?: string[];
    notes?: string;
  }) =>
    request<SleepLog>('/sleep', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── gratitudeApi ─────────────────────────────────────────────────────────────

export const gratitudeApi = {
  getEntries: (days = 30) =>
    request<{ entries: GratitudeEntry[]; days: number; total: number }>(`/gratitude?days=${days}`),

  createEntry: (payload: { items: string[]; note?: string }) =>
    request<GratitudeEntry>('/gratitude', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── habitsApi ────────────────────────────────────────────────────────────────

export const habitsApi = {
  listHabits: (active?: boolean) => {
    const params = active !== undefined ? `?active=${active}` : '';
    return request<{ habits: UserHabit[]; total: number }>(`/habits${params}`);
  },

  createHabit: (payload: { title: string; cue: string; practiceId?: string }) =>
    request<UserHabit>('/habits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateHabit: (id: string, payload: { title?: string; cue?: string; practiceId?: string | null; active?: boolean }) =>
    request<UserHabit>(`/habits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  completeHabit: (id: string, payload?: { note?: string }) =>
    request<UserHabit & { completedToday: boolean }>(`/habits/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  deleteHabit: (id: string) =>
    request<{ id: string }>(`/habits/${id}`, {
      method: 'DELETE',
    }),
};

// ─── dashboardApi ─────────────────────────────────────────────────────────────

export const dashboardApi = {
  getSummary: () =>
    request<DashboardSummaryData>('/dashboard/summary'),

  getMode: () =>
    request<DashboardMode>('/dashboard/mode'),

  getUnified: (forceCommunity?: boolean) => {
    const params = forceCommunity ? '?forceCommunity=true' : '';
    return request<DashboardUnifiedData>(`/dashboard/unified${params}`);
  },

  getInsights: () =>
    request<{
      insights: Array<{
        type: 'ai-summary' | 'pattern' | 'progress';
        title: string;
        description: string;
        icon: string;
        severity?: 'success' | 'warning' | 'info';
        timestamp: string;
      }>;
      aiSummary: string;
      overallTrend?: string;
      wellnessScore?: number | null;
      assessments?: {
        count: number;
        averageScore: number;
        trend: string;
        recentScores: number[];
      };
      chatbot?: {
        conversationCount: number;
        averageEmotionalState: string;
        commonTopics: string[];
        lastConversationDate: string | null;
      };
      generatedAt?: string;
      source?: 'combined' | 'assessments-only';
      cached?: boolean;
    }>('/dashboard/insights'),

  refreshInsights: () =>
    request<{
      success: boolean;
      message: string;
      data: any;
    }>('/dashboard/insights/refresh', {
      method: 'POST',
    }),

  getWeeklyProgress: () =>
    request<WeeklyProgressData>('/dashboard/weekly-progress'),

  getRecommendedPractice: () =>
    request<{
      recommendations: any[];
      focusAreas: string[];
      rationale: string;
    }>('/dashboard/recommended-practice'),

  getNudges: () =>
    request<{
      success: boolean;
      data: {
        nudges: AdaptiveNudge[];
        total: number;
      };
    }>('/dashboard/nudges'),

  getCommunityInsights: (force?: boolean) => {
    const params = force ? '?force=true' : '';
    return request<{
      success: boolean;
      data: CommunityInsightsPayload;
    }>(`/dashboard/community-insights${params}`);
  },
};
