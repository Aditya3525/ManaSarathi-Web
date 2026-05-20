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

export interface AssessmentTemplate {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  timeEstimate: string;
  questions: number;
  tags: string;
  difficulty?: string;
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
  createdAt: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface PlanModuleWithState {
  id: string;
  title: string;
  description: string | null;
  type: string;
  duration?: string | null;
  order: number;
  isCompleted: boolean;
  completedAt?: string | null;
  progress?: number;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressEntry {
  id: string;
  metricName: string;
  value: number;
  unit?: string | null;
  notes?: string | null;
  recordedAt: string;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  messageCount?: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
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
    request<AssessmentTemplate[]>('/assessments/available'),

  getAssessmentTemplates: (types?: string[]) => {
    const params = types?.length ? `?types=${types.join(',')}` : '';
    return request<AssessmentTemplate[]>(`/assessments/templates${params}`);
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

export const chatApi = {
  sendMessage: (content: string, conversationId?: string) =>
    request<{ message: ConversationMessage; response: ConversationMessage; exerciseRecommendations?: ExerciseRecommendationsResponse }>(
      '/chat/message',
      { method: 'POST', body: JSON.stringify({ message: content, conversationId }) }
    ),

  getChatHistory: () =>
    request<ConversationMessage[]>('/chat/history'),

  getConversationStarters: () =>
    request<{ starters: string[] }>('/chat/starters'),

  getProactiveCheckIn: () =>
    request<{ message: string | null; shouldShow: boolean }>('/chat/check-in'),

  getMoodBasedGreeting: () =>
    request<{ greeting: string }>('/chat/greeting'),

  getExerciseRecommendations: (context: Record<string, unknown>) =>
    request<ExerciseRecommendationsResponse>('/chat/exercises', {
      method: 'POST',
      body: JSON.stringify(context),
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

  logMood: (mood: string, notes?: string) =>
    request<MoodEntry>('/mood', {
      method: 'POST',
      body: JSON.stringify({ mood, notes }),
    }),

  deleteMoodEntry: (id: string) =>
    request<void>(`/mood/${id}`, { method: 'DELETE' }),

  getMoodStats: () =>
    request<Record<string, unknown>>('/mood/stats'),
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
      body: JSON.stringify({ metricName: metric, value, notes }),
    }),

  getProgressHistory: () =>
    request<ProgressEntry[]>('/progress'),
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
    format: 'pdf' | 'json' | 'csv',
    sections?: string[]
  ): Promise<void> => {
    const blob = await requestBlob('/privacy/export', {
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

  deleteAccount: () =>
    request<void>('/privacy/delete-account', { method: 'DELETE' }),
};

// ─── adminApi ─────────────────────────────────────────────────────────────────

export const adminApi = {
  listAssessments: () =>
    request<unknown[]>('/admin/assessments'),

  getAssessment: (id: string) =>
    request<unknown>(`/admin/assessments/${id}`),

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
