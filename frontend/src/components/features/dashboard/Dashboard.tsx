import { useQuery } from '@tanstack/react-query';
import { Award, Bell, BookOpen, Brain, Calendar, CheckCircle, ChevronRight, Headphones, Heart, Lightbulb, MessageCircle, Moon, MoreVertical, Play, Sparkles, Sun, Sunrise, Target, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAccessibility } from '../../../contexts/AccessibilityContext';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { useDevice } from '../../../hooks/use-device';
import {
  usePullToRefresh,
  useSaveMood,
  useRecommendedPractice,
} from '../../../hooks/useDashboardData';
import {
  dashboardApi,
  gratitudeApi,
  habitsApi,
  type AdaptiveNudge,
  type AssessmentReminder,
  type CommunityInsightsPayload,
  type DashboardUnifiedData,
  type DailyIntention,
  type GratitudeEntry,
  type MicroCheckin,
  type OneThingActionType,
  type SleepLog,
  type SleepStats,
  type UserHabit,
} from '../../../services/api';
import type { StoredUser } from '../../../services/auth';
import { Badge } from '../../ui/badge';
import { BottomNavigation, BottomNavigationSpacer } from '../../ui/bottom-navigation';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import {
  HorizontalScrollContainer,
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveStack
} from '../../ui/responsive-layout';
import { StaggerContainer, StaggerItem } from '../../ui/motion-wrapper';
import { MotionCard } from '../../ui/motion-enhanced';
import { EveningCheckin, MorningCheckin } from '../checkins';

import { DashboardCollapsibleSection } from './CollapsibleSection';
import { CrisisFollowUp } from './CrisisFollowUp';
import { DailyIntentionCard } from './DailyIntentionCard';
import {
  DashboardLoadingSkeleton,
  ErrorMessage,
  NetworkStatus,
  PullToRefreshIndicator,
  useOnlineStatus
} from './DashboardLoadingStates';
import { EnhancedInsightsCard } from './EnhancedInsightsCard';
import { GreetingHeader } from './GreetingHeader';
import { MoodSelector } from './MoodSelector';
import { SleepLogCard } from './SleepLogCard';
import { StatsRow } from './StatsRow';

import {
  DashboardCustomizer,
  DashboardTourPrompt,
  useWidgetVisibility
} from './';

interface DashboardProps {
  user: StoredUser | null;
  onNavigate: (page: string) => void;
  onLogout?: () => void;
  showTour?: boolean;
  onTourDismiss?: () => void;
  onTourComplete?: () => void;
  onTourCompleteComplete?: () => void;
}

const DASHBOARD_PRACTICE_AUTOSTART_KEY = 'mw-practice-autostart';

export function Dashboard({ user: userProp, onNavigate, onLogout, showTour = false, onTourDismiss, onTourComplete }: DashboardProps) {
  const [todayMood, setTodayMood] = useState<string>('');
  const [gratitudeInput, setGratitudeInput] = useState<string>('');
  const [gratitudeNote, setGratitudeNote] = useState<string>('');
  const [isSavingGratitude, setIsSavingGratitude] = useState(false);
  const [habitTitleInput, setHabitTitleInput] = useState<string>('');
  const [habitCueInput, setHabitCueInput] = useState<string>('');
  const [isSavingHabit, setIsSavingHabit] = useState(false);
  const [isCompletingHabitId, setIsCompletingHabitId] = useState<string | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [showCollapsedModeWidgets, setShowCollapsedModeWidgets] = useState(false);
  const moodCheckRef = useRef<HTMLDivElement>(null);
  const habitsSectionRef = useRef<HTMLDivElement>(null);
  const activeUserId = userProp?.id ?? null;
  const { t } = useTranslation();
  const { settings: accessibilitySettings, setSetting: setAccessibilitySetting } = useAccessibility();
  const { checkIsUserAdmin } = useAdminAuth();
  const { visibility, updateVisibility, isVisible } = useWidgetVisibility(activeUserId);
  const device = useDevice();

  // Fetch dashboard data
  const {
    data: unifiedDashboardResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'unified', activeUserId],
    queryFn: () => dashboardApi.getUnified(),
    enabled: Boolean(activeUserId),
    staleTime: 60 * 1000,
  });

  const unifiedDashboardData: DashboardUnifiedData | null = unifiedDashboardResponse?.success
    ? (unifiedDashboardResponse.data ?? null)
    : null;
  const dashboardData = unifiedDashboardData?.summary ?? null;
  const weeklyData = unifiedDashboardData?.weeklyProgress ?? null;
  const dashboardLoadError = useMemo(() => {
    if (error instanceof Error) {
      return error.message;
    }

    if (unifiedDashboardResponse && !unifiedDashboardResponse.success) {
      return unifiedDashboardResponse.error || 'Failed to load dashboard data';
    }

    return null;
  }, [error, unifiedDashboardResponse]);

  const saveMood = useSaveMood();
  const isOnline = useOnlineStatus();

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const isAdmin = await checkIsUserAdmin();
      setIsUserAdmin(isAdmin);
    };
    checkAdmin();
  }, [checkIsUserAdmin]);

  // Pull-to-refresh for mobile
  const { isRefreshing, pullProgress, shouldTrigger } = usePullToRefresh(async () => {
    await refetch();
  });

  const handleTourSkip = useCallback(() => {
    onTourDismiss?.();
  }, [onTourDismiss]);

  const handleTourComplete = useCallback(() => {
    onTourComplete?.();
    onTourDismiss?.();
  }, [onTourComplete, onTourDismiss]);

  // Guard against cross-user cache bleed if stale summary payload doesn't match active session.
  const summaryUser = dashboardData?.user;
  const user = summaryUser && userProp && summaryUser.id !== userProp.id
    ? userProp
    : (summaryUser || userProp);
  const assessmentScores = dashboardData?.assessmentScores;
  const weeklyProgress = weeklyData || dashboardData?.weeklyProgress;
  const recommendedPractice = dashboardData?.recommendedPractice;

  const { data: recommendationsRes } = useRecommendedPractice();
  const recommendedPractices = recommendationsRes?.recommendations ?? [];

  // Helper to get streak info from either weeklyProgress format
  const getStreakInfo = () => {
    if (!weeklyProgress) return { current: 0, message: 'Start your journey today!' };
    if ('streak' in weeklyProgress) {
      return weeklyProgress.streak;
    }
    return {
      current: weeklyProgress.currentStreak || 0,
      message: weeklyProgress.currentStreak > 0
        ? `${weeklyProgress.currentStreak} day${weeklyProgress.currentStreak !== 1 ? 's' : ''} strong! 🔥`
        : 'Start your journey today!'
    };
  };

  const streakInfo = getStreakInfo();
  const currentHour = new Date().getHours();

  const isHabitCompletedToday = useCallback((lastCompletedAt?: string | null) => {
    if (!lastCompletedAt) {
      return false;
    }

    const completed = new Date(lastCompletedAt);
    return completed.toDateString() === new Date().toDateString();
  }, []);

  const checkins = useMemo(
    () => (unifiedDashboardData?.checkins?.checkins ?? []) as MicroCheckin[],
    [unifiedDashboardData?.checkins?.checkins]
  );

  const { hasMorningCheckin, hasEveningCheckin } = useMemo(() => {
    const today = new Date();
    const isToday = (input: string | Date): boolean => {
      const date = new Date(input);
      return date.toDateString() === today.toDateString();
    };

    return {
      hasMorningCheckin: checkins.some((entry) => entry.type === 'morning' && isToday(entry.createdAt)),
      hasEveningCheckin: checkins.some((entry) => entry.type === 'evening' && isToday(entry.createdAt)),
    };
  }, [checkins]);

  const recentCrisisEvent = unifiedDashboardData?.crisisEvents?.[0];

  const todayIntention: DailyIntention | null = unifiedDashboardData?.intention ?? null;

  const latestSleepLog: SleepLog | null = unifiedDashboardData?.sleep?.history?.logs?.[0] ?? null;

  const sleepStats: SleepStats | null = unifiedDashboardData?.sleep?.stats ?? null;

  const gratitudeEntries: GratitudeEntry[] = unifiedDashboardData?.gratitude?.entries ?? [];

  const adaptiveNudges: AdaptiveNudge[] = unifiedDashboardData?.nudges?.nudges ?? [];

  const assessmentReminder: AssessmentReminder | null = unifiedDashboardData?.assessmentReminder ?? null;

  const habits: UserHabit[] = useMemo(
    () => unifiedDashboardData?.habits?.habits ?? [],
    [unifiedDashboardData?.habits?.habits]
  );

  const communityInsights: CommunityInsightsPayload | null = unifiedDashboardData?.communityInsights ?? null;

  const dashboardMode = unifiedDashboardData?.mode ?? null;

  const isModeDefault = !dashboardMode || dashboardMode.mode === 'default';

  const collapsedWidgetIds = useMemo(
    () => new Set(dashboardMode?.collapsedWidgets ?? []),
    [dashboardMode]
  );

  const priorityWidgetIds = useMemo(
    () => new Set(dashboardMode?.priorityWidgets ?? []),
    [dashboardMode]
  );

  useEffect(() => {
    setShowCollapsedModeWidgets(false);
  }, [dashboardMode?.mode]);

  const isModeSectionVisible = useCallback((sectionId: string, baseVisible = true) => {
    if (!baseVisible) {
      return false;
    }

    if (isModeDefault) {
      return true;
    }

    if (priorityWidgetIds.has(sectionId)) {
      return true;
    }

    if (collapsedWidgetIds.has(sectionId)) {
      return showCollapsedModeWidgets;
    }

    return true;
  }, [collapsedWidgetIds, isModeDefault, priorityWidgetIds, showCollapsedModeWidgets]);

  const gratitudeItemsPreview = useMemo(() => {
    return gratitudeInput
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 3);
  }, [gratitudeInput]);

  const handleSaveGratitude = useCallback(async () => {
    if (isSavingGratitude) {
      return;
    }

    const items = gratitudeItemsPreview;
    if (items.length === 0) {
      return;
    }

    setIsSavingGratitude(true);
    try {
      const response = await gratitudeApi.createEntry({
        items,
        note: gratitudeNote.trim().length > 0 ? gratitudeNote.trim() : undefined,
      });

      if (!response.success) {
        throw new Error(response.error || 'Unable to save gratitude entry');
      }

      setGratitudeInput('');
      setGratitudeNote('');

      await refetch();
    } catch (error) {
      console.error('Failed to save gratitude entry:', error);
    } finally {
      setIsSavingGratitude(false);
    }
  }, [
    gratitudeItemsPreview,
    gratitudeNote,
    isSavingGratitude,
    refetch,
  ]);

  const handleCreateHabit = useCallback(async () => {
    if (isSavingHabit) {
      return;
    }

    const title = habitTitleInput.trim();
    const cue = habitCueInput.trim();
    if (!title || !cue) {
      return;
    }

    setIsSavingHabit(true);
    try {
      const response = await habitsApi.createHabit({ title, cue });
      if (!response.success) {
        throw new Error(response.error || 'Unable to create habit');
      }

      setHabitTitleInput('');
      setHabitCueInput('');

      await refetch();
    } catch (error) {
      console.error('Failed to create habit loop:', error);
    } finally {
      setIsSavingHabit(false);
    }
  }, [
    habitCueInput,
    habitTitleInput,
    isSavingHabit,
    refetch,
  ]);

  const handleCompleteHabit = useCallback(async (habitId: string) => {
    if (isCompletingHabitId) {
      return;
    }

    setIsCompletingHabitId(habitId);
    try {
      const response = await habitsApi.completeHabit(habitId);
      if (!response.success) {
        throw new Error(response.error || 'Unable to complete habit');
      }

      await refetch();
    } catch (error) {
      console.error('Failed to complete habit loop:', error);
    } finally {
      setIsCompletingHabitId(null);
    }
  }, [isCompletingHabitId, refetch]);

  const handleCheckinComplete = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Mood selection handler with API call
  const handleMoodSelect = useCallback(async (mood: string) => {
    setTodayMood(mood);
    try {
      await Promise.all([
        saveMood.mutateAsync({ mood }),
        refetch(),
      ]);
    } catch (error) {
      console.error('Failed to save mood:', error);
    }
  }, [refetch, saveMood]);

  const launchPracticeFromDashboard = useCallback((practice?: { id?: string | null; title?: string | null }) => {
    const practiceId = typeof practice?.id === 'string' ? practice.id : null;
    const practiceTitle = typeof practice?.title === 'string' ? practice.title : null;

    if (typeof window !== 'undefined') {
      const payload = JSON.stringify({
        id: practiceId,
        title: practiceTitle,
        source: 'dashboard',
        createdAt: Date.now(),
      });
      window.sessionStorage.setItem(DASHBOARD_PRACTICE_AUTOSTART_KEY, payload);
    }

    onNavigate('practices');
  }, [onNavigate]);



  const getProfileCompletion = () => {
    if (!user) return 0;
    // Use profileCompletion from API if available
    if ('profileCompletion' in user && typeof user.profileCompletion === 'number') {
      return user.profileCompletion;
    }
    return 0;
  };

  const profileCompletion = getProfileCompletion();

  // Format score to whole number (no decimals)
  const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return '0';
    return Math.round(score).toString();
  };

  // Get interpretation from backend data or fallback to simple label
  const getScoreInterpretation = (type: string, score: number): string => {
    // Try to get interpretation from backend byType data
    if (assessmentScores?.byType) {
      const typeData = assessmentScores.byType[type] || assessmentScores.byType[`${type}_assessment`];
      if (typeData?.interpretation) {
        return typeData.interpretation;
      }
    }

    // Fallback to simple labels if no interpretation available
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Moderate';
    return 'Needs attention';
  };

  // Resolve primary recommended practice (using the first item from the list returned by `/recommended-practice` or falling back to `/summary` item)
  const primaryPractice = recommendedPractices[0] || recommendedPractice;

  // Use recommended practice from AI engine or fallback to approach-based defaults
  const practiceTitle = primaryPractice?.title || (() => {
    switch (user?.approach) {
      case 'western': return "CBT Reflection Exercise";
      case 'eastern': return "Guided Mindful Breathing";
      case 'hybrid': return "Blended Mindfulness & CBT Practice";
      default: return "10-Minute Calm Breathing";
    }
  })();

  const practiceDescription = primaryPractice?.description || "Begin your wellness journey with this practice";
  const practiceDuration = typeof primaryPractice?.duration === 'number'
    ? primaryPractice.duration
    : (primaryPractice?.duration ? parseInt(String(primaryPractice.duration)) : 10);

  const practiceType = primaryPractice?.type || (() => {
    switch (user?.approach) {
      case 'western': return "CBT";
      case 'eastern': return "Meditation";
      case 'hybrid': return "Mindfulness";
      default: return "Breathing";
    }
  })();

  const practiceTags = primaryPractice?.tags || (() => {
    switch (user?.approach) {
      case 'western': return ['CBT technique', 'Thought tracking', '5–10 min'];
      case 'eastern': return ['Meditation', 'Breathwork', 'Grounding'];
      case 'hybrid': return ['Mindfulness', 'Cognitive reframing', 'Balanced'];
      default: return ['Anxiety relief', 'Beginner friendly', '10 min'];
    }
  })();

  const handleToggleDarkMode = () => {
    const next = !accessibilitySettings.darkMode;
    setAccessibilitySetting('darkMode', next, {
      announce: `Dark mode ${next ? 'enabled' : 'disabled'}`
    });
  };

  const isLoggingMood = saveMood.isPending;
  const currentStreak = streakInfo.current;
  const wellnessScore = assessmentScores?.wellnessScore != null
    ? Math.round(assessmentScores.wellnessScore)
    : null;
  const wellnessTrend = useMemo(() => {
    const trend = assessmentScores?.overallTrend?.toLowerCase();
    if (!trend) {
      return null;
    }

    if (trend.includes('improv') || trend.includes('up')) {
      return 5;
    }

    if (trend.includes('declin') || trend.includes('down')) {
      return -5;
    }

    return null;
  }, [assessmentScores?.overallTrend]);
  const weeklyCheckInCount = weeklyProgress?.moodCheckins?.completed ?? 0;
  const completedHabitsCount = useMemo(
    () => habits.filter((habit) => isHabitCompletedToday(habit.lastCompletedAt)).length,
    [habits, isHabitCompletedToday],
  );
  const totalHabitsCount = habits.length;
  const insightCount = (dashboardData?.recentInsights?.length ?? 0) + adaptiveNudges.length + (communityInsights?.metrics.length ?? 0);

  const handleStatClick = useCallback((stat: string) => {
    if (stat === 'habits') {
      habitsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (stat === 'checkins' || stat === 'streak') {
      moodCheckRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (stat === 'wellness') {
      onNavigate('assessments');
    }
  }, [onNavigate]);

  const showInsightsWidget = isModeSectionVisible('recent-insights', isVisible('recent-insights'));
  const showThisWeekWidget = isModeSectionVisible('this-week', isVisible('this-week'));
  const isFullWidth = !(showInsightsWidget && showThisWeekWidget);
  const hasCollapsedModeWidgets = !isModeDefault && (dashboardMode?.collapsedWidgets?.length ?? 0) > 0;

  // Loading state
  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  // Error state
  if (dashboardLoadError) {
    return (
      <ErrorMessage
        title="Failed to load dashboard"
        message={dashboardLoadError}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      <DashboardTourPrompt
        open={showTour}
        onSkip={handleTourSkip}
        onComplete={handleTourComplete}
      />

      {/* Pull-to-refresh indicator for mobile */}
      <PullToRefreshIndicator
        pullProgress={pullProgress}
        isRefreshing={isRefreshing}
        shouldTrigger={shouldTrigger}
      />

      {/* Network status banner when offline */}
      {!isOnline && <NetworkStatus isOnline={isOnline} />}

      <div className="min-h-screen bg-background pb-safe page-enter">
        {/* Header - Responsive */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-start mb-4 md:mb-6">
              {/* Header title */}
              <div className="space-y-1 md:space-y-2 flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
                  Your Wellbeing Dashboard
                </h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  {t('dashboard.howFeeling')}
                </p>
                {!isModeDefault && dashboardMode?.message && (
                  <p className="text-xs md:text-sm text-primary font-medium">
                    {dashboardMode.message}
                  </p>
                )}
              </div>

              {/* Header Actions - Responsive */}
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">

                {/* Mobile: Overflow menu */}
                {device.isMobile ? (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleToggleDarkMode}
                      aria-label={accessibilitySettings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                      className="h-9 w-9 rounded-full"
                    >
                      {accessibilitySettings.darkMode ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onNavigate('profile')}>
                          Profile
                        </DropdownMenuItem>
                        {profileCompletion < 100 && (
                          <DropdownMenuItem onClick={() => onNavigate('profile')}>
                            Complete profile ({profileCompletion}%)
                          </DropdownMenuItem>
                        )}
                        {isUserAdmin && (
                          <DropdownMenuItem onClick={() => onNavigate('admin')}>
                            Admin Dashboard
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <div className="w-full">
                            <DashboardCustomizer
                              visibility={visibility}
                              onVisibilityChange={updateVisibility}
                            />
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (onLogout) onLogout();
                          }}
                          className="text-red-600"
                        >
                          Logout
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  /* Desktop: Full buttons */
                  <>
                    <DashboardCustomizer
                      visibility={visibility}
                      onVisibilityChange={updateVisibility}
                    />
                    {profileCompletion < 100 && (
                      <div className="text-right">
                        <p className="text-sm font-medium">Profile {profileCompletion}% complete</p>
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => onNavigate('profile')}>
                          Complete setup →
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleToggleDarkMode}
                      aria-label={accessibilitySettings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                      className="h-9 w-9 rounded-full"
                    >
                      {accessibilitySettings.darkMode ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                    </Button>
                    {isUserAdmin && (
                      <Button variant="outline" onClick={() => onNavigate('admin')}>
                        Admin Panel
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => onNavigate('profile')}>
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (onLogout) onLogout();
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Logout
                    </Button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <ResponsiveContainer spacing="medium">
            {/* Tier 1: The Breathe Zone - Always visible */}
            <div className="space-y-4 page-enter">
              {isModeSectionVisible('greeting-header', isVisible('greeting-header')) && (
                <GreetingHeader userName={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || undefined} />
              )}

              {isModeSectionVisible('mood-check', isVisible('mood-check')) && (
                <div ref={moodCheckRef}>
                  <Card className="border-primary/10 shadow-[var(--shadow-card)]">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-center text-sm text-muted-foreground mb-3">
                        How are you feeling right now?
                      </p>
                      <MoodSelector
                        onSelect={(mood) => {
                          void handleMoodSelect(mood);
                        }}
                        selectedMood={todayMood}
                        disabled={isLoggingMood}
                      />
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                          {isLoggingMood
                            ? 'Saving your check-in...'
                            : todayMood
                              ? `Mood saved as ${todayMood}. Recommendations will adapt for today.`
                              : 'Choose a mood to personalize your dashboard.'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

            </div>

            {/* Tier 2: The Pulse - Compact stats */}
            {isModeSectionVisible('stats-row', isVisible('stats-row')) && (
              <StatsRow
                streak={currentStreak}
                wellnessScore={wellnessScore}
                wellnessTrend={wellnessTrend}
                weeklyCheckIns={weeklyCheckInCount}
                habitsCompleted={completedHabitsCount}
                habitsTotal={totalHabitsCount}
                onStatClick={handleStatClick}
              />
            )}

            {/* Tier 3: The Depth - Existing widgets */}
            <div className="space-y-2">


              {isModeSectionVisible('crisis-follow-up', isVisible('crisis-follow-up')) && recentCrisisEvent && (
                <CrisisFollowUp
                  event={recentCrisisEvent}
                  onRespond={() => {
                    void refetch();
                  }}
                  onNavigate={onNavigate}
                />
              )}

              {isModeSectionVisible('checkins', isVisible('checkins')) && currentHour < 12 && (
                <DashboardCollapsibleSection
                  title="Morning Check-in"
                  summary={hasMorningCheckin ? 'Completed' : 'Start your day with a pulse-check'}
                  icon={<Sunrise className="h-4 w-4" />}
                  defaultOpen={!hasMorningCheckin}
                >
                  {hasMorningCheckin ? (
                    <p className="text-sm text-muted-foreground">Morning check-in already completed today.</p>
                  ) : (
                    <MorningCheckin onComplete={() => void handleCheckinComplete()} />
                  )}
                </DashboardCollapsibleSection>
              )}

              {isModeSectionVisible('checkins', isVisible('checkins')) && currentHour >= 17 && (
                <DashboardCollapsibleSection
                  title="Evening Reflection"
                  summary={hasEveningCheckin ? 'Completed' : 'Wind down with a quick reflection'}
                  icon={<Moon className="h-4 w-4" />}
                  defaultOpen={!hasEveningCheckin}
                >
                  {hasEveningCheckin ? (
                    <p className="text-sm text-muted-foreground">Evening reflection already completed today.</p>
                  ) : (
                    <EveningCheckin onComplete={() => void handleCheckinComplete()} />
                  )}
                </DashboardCollapsibleSection>
              )}

              {(
                (isModeSectionVisible('smart-nudges', isVisible('smart-nudges')) && adaptiveNudges.length > 0)
                || (isModeSectionVisible('community-insights', isVisible('community-insights')) && Boolean(communityInsights?.metrics.length))
                || (isModeSectionVisible('assessment-reminder', isVisible('assessment-reminder')) && Boolean(assessmentReminder?.shouldRemind))
              ) && (
                  <DashboardCollapsibleSection
                    title="Insights & Nudges"
                    summary={`${insightCount} recent signals`}
                    icon={<Lightbulb className="h-4 w-4" />}
                    badge={insightCount > 0 ? insightCount : undefined}
                  >
                    <div className="space-y-3">
                      {isModeSectionVisible('smart-nudges', isVisible('smart-nudges')) && adaptiveNudges.length > 0 && (
                        <Card className="border-primary/30 bg-primary/5">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              Smart Nudges
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <StaggerContainer staggerDelay={0.08}>
                              {adaptiveNudges.map((nudge) => (
                                <StaggerItem key={nudge.id}>
                                  <div className="rounded-md border bg-background p-3">
                                    <p className="text-sm text-foreground">{nudge.message}</p>
                                    {nudge.ctaLabel && nudge.ctaPage && (
                                      <Button
                                        variant="link"
                                        className="px-0 h-auto mt-1"
                                        onClick={() => onNavigate(nudge.ctaPage)}
                                      >
                                        {nudge.ctaLabel}
                                      </Button>
                                    )}
                                  </div>
                                </StaggerItem>
                              ))}
                            </StaggerContainer>
                          </CardContent>
                        </Card>
                      )}

                      {isModeSectionVisible('community-insights', isVisible('community-insights')) && communityInsights && communityInsights.metrics.length > 0 && (
                        <Card className="border-slate-300/70 bg-slate-50/60 dark:bg-card dark:border-border">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-slate-700" />
                              Community Insights
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Anonymous trends from the community to reduce isolation and normalize progress.
                            </p>

                            <div className="grid gap-3 md:grid-cols-3">
                              <StaggerContainer staggerDelay={0.12}>
                                {communityInsights.metrics.map((metric) => (
                                  <StaggerItem key={metric.id}>
                                    <div className="rounded-md border bg-background p-3 space-y-1">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {metric.label}
                                      </p>
                                      <p className="text-xl font-semibold text-foreground">
                                        {metric.value}{metric.unit === 'percent' ? '%' : ''}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {metric.description}
                                      </p>
                                    </div>
                                  </StaggerItem>
                                ))}
                              </StaggerContainer>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Updated {new Date(communityInsights.generatedAt).toLocaleString()} • sample size up to {Math.max(...communityInsights.metrics.map((metric) => metric.sampleSize), 0)} users
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      {isModeSectionVisible('assessment-reminder', isVisible('assessment-reminder')) && assessmentReminder?.shouldRemind && (
                        <Card className="border-amber-300/70 bg-amber-50/60 dark:bg-card dark:border-border">
                          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Assessment Reminder</p>
                              <h3 className="text-lg font-semibold text-foreground">Time for a check-in</h3>
                              <p className="text-sm text-muted-foreground">
                                {assessmentReminder.message}
                              </p>
                            </div>
                            <Button
                              className={device.isMobile ? 'w-full min-h-[44px] touch-manipulation' : ''}
                              onClick={() => onNavigate('assessments')}
                            >
                              <Bell className="h-4 w-4 mr-2" />
                              Retake Assessment
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </DashboardCollapsibleSection>
                )}

              {isModeSectionVisible('gratitude', isVisible('gratitude')) && (
                <Card className="border-emerald-300/70 bg-emerald-50/50 dark:bg-card dark:border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base md:text-lg flex items-center gap-2">
                      <Heart className="h-5 w-5 text-emerald-600" />
                      Daily Gratitude Prompt
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Name 3 things you&apos;re grateful for today.
                    </p>
                    <Input
                      value={gratitudeInput}
                      onChange={(event) => setGratitudeInput(event.target.value)}
                      placeholder="coffee, sunshine, a kind conversation"
                    />
                    <Input
                      value={gratitudeNote}
                      onChange={(event) => setGratitudeNote(event.target.value)}
                      placeholder="Optional note"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {gratitudeItemsPreview.length > 0
                          ? `${gratitudeItemsPreview.length}/3 items ready`
                          : 'Tip: separate items with commas'}
                      </p>
                      <Button
                        onClick={() => void handleSaveGratitude()}
                        disabled={isSavingGratitude || gratitudeItemsPreview.length === 0}
                        className={device.isMobile ? 'w-full min-h-[44px] touch-manipulation' : ''}
                      >
                        {isSavingGratitude ? 'Saving...' : 'Save gratitude entry'}
                      </Button>
                    </div>

                    {gratitudeEntries.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent gratitude</p>
                        <StaggerContainer staggerDelay={0.1}>
                          {gratitudeEntries.slice(0, 2).map((entry) => (
                            <StaggerItem key={entry.id}>
                              <p className="text-sm text-foreground">
                                {entry.items.slice(0, 3).join(', ')}
                              </p>
                            </StaggerItem>
                          ))}
                        </StaggerContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {isModeSectionVisible('habits', isVisible('habits')) && (
                <div ref={habitsSectionRef}>
                  <DashboardCollapsibleSection
                    title="My Habits"
                    summary={`${completedHabitsCount}/${totalHabitsCount} completed today`}
                    icon={<CheckCircle className="h-4 w-4" />}
                    badge={`${completedHabitsCount}/${totalHabitsCount}`}
                    defaultOpen={totalHabitsCount === 0}
                  >
                    <Card className="border-cyan-300/70 bg-cyan-50/50 dark:bg-card dark:border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base md:text-lg flex items-center gap-2">
                          <Target className="h-5 w-5 text-cyan-700" />
                          Habit Loops
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Build cue-based habits you can complete in under five minutes.
                        </p>

                        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                          <Input
                            value={habitTitleInput}
                            onChange={(event) => setHabitTitleInput(event.target.value)}
                            placeholder="Habit title (e.g. 3 calming breaths)"
                          />
                          <Input
                            value={habitCueInput}
                            onChange={(event) => setHabitCueInput(event.target.value)}
                            placeholder="Cue (e.g. After morning coffee)"
                          />
                          <Button
                            onClick={() => void handleCreateHabit()}
                            disabled={isSavingHabit || habitTitleInput.trim().length < 3 || habitCueInput.trim().length < 3}
                            className={device.isMobile ? 'min-h-[44px] touch-manipulation' : ''}
                          >
                            {isSavingHabit ? 'Saving...' : 'Add loop'}
                          </Button>
                        </div>

                        {habits.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No active habit loops yet. Add one cue and one tiny action to get started.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <StaggerContainer>
                              {habits.slice(0, 4).map((habit) => {
                                const completedToday = isHabitCompletedToday(habit.lastCompletedAt);
                                return (
                                  <StaggerItem key={habit.id}>
                                    <div className="rounded-md border bg-background p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">{habit.title}</p>
                                        <p className="text-xs text-muted-foreground">Cue: {habit.cue}</p>
                                        <p className="text-xs text-muted-foreground">Streak: {habit.streak} day{habit.streak === 1 ? '' : 's'}</p>
                                      </div>
                                      <Button
                                        variant={completedToday ? 'secondary' : 'outline'}
                                        onClick={() => void handleCompleteHabit(habit.id)}
                                        disabled={completedToday || isCompletingHabitId === habit.id}
                                        className={device.isMobile ? 'w-full min-h-[44px] touch-manipulation md:w-auto' : ''}
                                      >
                                        {completedToday
                                          ? 'Completed today'
                                          : isCompletingHabitId === habit.id
                                            ? 'Saving...'
                                            : 'Mark complete'}
                                      </Button>
                                    </div>
                                  </StaggerItem>
                                );
                              })}
                            </StaggerContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </DashboardCollapsibleSection>
                </div>
              )}

              {isModeSectionVisible('intentions-sleep', isVisible('intentions-sleep')) && (
                <ResponsiveGrid columns="custom" className="lg:grid-cols-2" gap="medium">
                  <DailyIntentionCard
                    intention={todayIntention}
                    currentHour={currentHour}
                    onUpdated={() => {
                      void refetch();
                    }}
                  />

                  <SleepLogCard
                    latestLog={latestSleepLog}
                    stats={sleepStats}
                    onLogged={() => {
                      void refetch();
                    }}
                  />
                </ResponsiveGrid>
              )}

              {/* Priority 1: Quick Actions (Visible on all devices) */}
              {isModeSectionVisible('quick-actions', isVisible('quick-actions')) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base md:text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {device.isMobile ? (
                      <StaggerContainer>
                        <ResponsiveStack spacing="compact">
                          <StaggerItem>
                            <Button
                              className="w-full justify-between h-auto py-3 text-left"
                              onClick={() => onNavigate('assessments')}
                            >
                              <div className="flex items-center gap-3">
                                <Brain className="h-5 w-5" />
                                <div>
                                  <div className="font-medium">Take Assessment</div>
                                  <div className="text-xs opacity-90">Get personalized insights</div>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </StaggerItem>

                          <StaggerItem>
                            <Button
                              variant="outline"
                              className="w-full justify-between h-auto py-3 text-left touch-manipulation min-h-[44px]"
                              onClick={() => onNavigate('chatbot')}
                            >
                              <div className="flex items-center gap-3">
                                <MessageCircle className="h-5 w-5" />
                                <span className="font-medium">Chat with AI</span>
                              </div>
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </StaggerItem>

                          <StaggerItem>
                            <Button
                              variant="outline"
                              className="w-full justify-between h-auto py-3 text-left touch-manipulation min-h-[44px]"
                              onClick={() => onNavigate('library')}
                            >
                              <div className="flex items-center gap-3">
                                <BookOpen className="h-5 w-5" />
                                <span className="font-medium">Browse Library</span>
                              </div>
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </StaggerItem>

                          <StaggerItem>
                            <Button
                              variant="outline"
                              className="w-full justify-between h-auto py-3 text-left touch-manipulation min-h-[44px]"
                              onClick={() => onNavigate('journal')}
                            >
                              <div className="flex items-center gap-3">
                                <BookOpen className="h-5 w-5" />
                                <span className="font-medium">Journal</span>
                              </div>
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </StaggerItem>

                          <StaggerItem>
                            <Button
                              variant="outline"
                              className="w-full justify-between h-auto py-3 text-left touch-manipulation min-h-[44px]"
                              onClick={() => onNavigate('progress')}
                            >
                              <div className="flex items-center gap-3">
                                <TrendingUp className="h-5 w-5" />
                                <span className="font-medium">View Progress</span>
                              </div>
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </StaggerItem>
                        </ResponsiveStack>
                      </StaggerContainer>
                    ) : (
                      <StaggerContainer>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          <StaggerItem className="h-full">
                            <Button
                              className="w-full h-full justify-start py-4 px-4"
                              onClick={() => onNavigate('assessments')}
                            >
                              <div className="flex items-center gap-3">
                                <Brain className="h-5 w-5" />
                                <div className="text-left">
                                  <div className="font-medium">Take Assessment</div>
                                  <div className="text-xs opacity-90">Get personalized insights</div>
                                </div>
                              </div>
                            </Button>
                          </StaggerItem>

                          <StaggerItem className="h-full">
                            <Button
                              variant="outline"
                              className="w-full h-full justify-start py-4 px-4"
                              onClick={() => onNavigate('chatbot')}
                            >
                              <div className="flex items-center gap-3">
                                <MessageCircle className="h-5 w-5" />
                                <span className="font-medium">Chat with AI</span>
                              </div>
                            </Button>
                          </StaggerItem>

                          <StaggerItem className="h-full">
                            <Button
                              variant="outline"
                              className="w-full h-full justify-start py-4 px-4"
                              onClick={() => onNavigate('library')}
                            >
                              <div className="flex items-center gap-3">
                                <BookOpen className="h-5 w-5" />
                                <span className="font-medium">Browse Library</span>
                              </div>
                            </Button>
                          </StaggerItem>

                          <StaggerItem className="h-full">
                            <Button
                              variant="outline"
                              className="w-full h-full justify-start py-4 px-4"
                              onClick={() => onNavigate('journal')}
                            >
                              <div className="flex items-center gap-3">
                                <BookOpen className="h-5 w-5" />
                                <span className="font-medium">Journal</span>
                              </div>
                            </Button>
                          </StaggerItem>

                          <StaggerItem className="h-full">
                            <Button
                              variant="outline"
                              className="w-full h-full justify-start py-4 px-4"
                              onClick={() => onNavigate('progress')}
                            >
                              <div className="flex items-center gap-3">
                                <TrendingUp className="h-5 w-5" />
                                <span className="font-medium">View Progress</span>
                              </div>
                            </Button>
                          </StaggerItem>
                        </div>
                      </StaggerContainer>
                    )}
                  </CardContent>
                </Card>
              )}



              {/* Priority 2: Today's Practice */}
              {isModeSectionVisible('today-practice', isVisible('today-practice')) && (
                <DashboardCollapsibleSection
                  title="Recommended Practices"
                  summary="Personalized for your mood"
                  icon={<Headphones className="h-4 w-4" />}
                  defaultOpen={!device.isMobile}
                >
                  <Card className={device.isMobile ? '' : 'lg:col-span-2'}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <Play className="h-5 w-5 text-primary" />
                        Today&apos;s Practice
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Primary Practice - Prominent CTA */}
                      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4">
                        <div className={device.isMobile ? "space-y-3" : "flex items-start justify-between"}>
                          <div className="space-y-2 flex-1">
                            <h3 className="text-lg font-semibold text-foreground">{practiceTitle}</h3>
                            <p className="text-sm text-muted-foreground">
                              {practiceDescription}
                            </p>
                            <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground flex-wrap">
                              {practiceType && <span className="font-medium">{practiceType}</span>}
                              {practiceDuration && <span>{practiceDuration} min</span>}
                              {(() => {
                                const normalizedTags = Array.isArray(practiceTags)
                                  ? practiceTags
                                  : typeof practiceTags === 'string' && practiceTags.trim().length > 0
                                    ? [practiceTags]
                                    : [];

                                return normalizedTags
                                  .slice(0, device.isSmallPhone ? 1 : 2)
                                  .map((tag) => <span key={tag}>• {tag}</span>);
                              })()}
                              {(() => {
                                const normalizedTags = Array.isArray(practiceTags)
                                  ? practiceTags
                                  : typeof practiceTags === 'string' && practiceTags.trim().length > 0
                                    ? [practiceTags]
                                    : [];

                                return device.isSmallPhone && normalizedTags.length > 1 ? (
                                  <span>+{normalizedTags.length - 1}</span>
                                ) : null;
                              })()}
                            </div>
                            {primaryPractice?.reason && (
                              <p className="text-xs text-primary/80 italic mt-2">
                                💡 {primaryPractice.reason}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => launchPracticeFromDashboard({
                              id: primaryPractice?.id,
                              title: practiceTitle,
                            })}
                            className={device.isMobile ? "w-full min-h-[44px] touch-manipulation" : ""}
                          >
                            Start Practice
                          </Button>
                        </div>
                      </div>

                      {/* Secondary Practices - Collapsible on mobile */}
                      {recommendedPractices.length > 1 && (
                        device.isMobile ? (
                          <DashboardCollapsibleSection
                            title="More Practices"
                            icon={<Heart className="h-4 w-4" />}
                            defaultOpen={false}
                            summary={`${recommendedPractices.length - 1} additional practices available`}
                          >
                              <ResponsiveStack spacing="compact">
                                {recommendedPractices.slice(1, 3).map((practice) => (
                                  <Button
                                    key={practice.id || practice.title}
                                    variant="outline"
                                    className="justify-start h-auto p-3 text-left w-full min-h-[44px] touch-manipulation whitespace-normal"
                                    onClick={() => launchPracticeFromDashboard({
                                      id: practice.id,
                                      title: practice.title,
                                    })}
                                  >
                                    <div className="space-y-1 w-full min-w-0">
                                      <div className="flex items-center gap-2">
                                        <Heart className="h-4 w-4" />
                                        <span className="font-medium text-sm">{practice.title}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {practice.description || `${practice.duration}m practice`}
                                      </p>
                                    </div>
                                  </Button>
                                ))}
                              </ResponsiveStack>
                          </DashboardCollapsibleSection>
                        ) : (
                          <div className="grid md:grid-cols-2 gap-4">
                            {recommendedPractices.slice(1, 3).map((practice) => (
                              <Button
                                key={practice.id || practice.title}
                                variant="outline"
                                className="justify-start h-auto p-4 text-left w-full whitespace-normal"
                                onClick={() => launchPracticeFromDashboard({
                                  id: practice.id,
                                  title: practice.title,
                                })}
                              >
                                <div className="space-y-1 w-full min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Heart className="h-4 w-4" />
                                    <span className="font-medium">{practice.title}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {practice.description || `${practice.duration}m practice`}
                                  </p>
                                </div>
                              </Button>
                            ))}
                          </div>
                        )
                      )}
                    </CardContent>
                  </Card>
                </DashboardCollapsibleSection>
              )}



              {/* Priority 5: Enhanced AI Insights, This Week & Navigation Shortcuts */}
              {(showInsightsWidget || showThisWeekWidget || isModeSectionVisible('navigation-shortcuts', isVisible('navigation-shortcuts'))) && (
                <ResponsiveGrid
                  columns="custom"
                  className={showInsightsWidget && showThisWeekWidget ? "lg:grid-cols-2 items-start" : "grid-cols-1"}
                  gap="medium"
                >
                  {showInsightsWidget && <EnhancedInsightsCard onNavigate={onNavigate} isFullWidth={isFullWidth} />}

                  {showThisWeekWidget && (
                    <>
                      {device.isMobile ? (
                        <DashboardCollapsibleSection
                          title="This Week"
                          icon={<Calendar className="h-5 w-5 text-primary" />}
                          defaultOpen={false}
                          summary={weeklyProgress ? `${weeklyProgress.practices.completed}/${weeklyProgress.practices.goal} practices • ${streakInfo.current}-day streak` : 'Loading...'}
                        >
                          {weeklyProgress ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-sm">Daily practices</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {weeklyProgress.practices.completed}/{weeklyProgress.practices.goal}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <span className="text-sm">Mood check-ins</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {weeklyProgress.moodCheckins.completed}/{weeklyProgress.moodCheckins.goal}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                  <span className="text-sm">Assessments</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {weeklyProgress.assessments.completed} completed
                                </Badge>
                              </div>

                              <div className="pt-3 border-t">
                                <div className="flex items-center gap-2 text-sm">
                                  <Award className={`h-4 w-4 ${streakInfo.current > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                                  <span className="text-muted-foreground">{streakInfo.message}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Loading progress...</p>
                          )}
                        </DashboardCollapsibleSection>
                      ) : (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Calendar className="h-5 w-5 text-primary" />
                              This Week
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {weeklyProgress ? (
                              <>
                                <div className={isFullWidth ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "space-y-3"}>
                                  <div className={isFullWidth ? "p-4 rounded-xl bg-muted/40 border flex flex-col justify-between h-full min-h-[100px]" : "flex items-center justify-between"}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span className="text-sm font-medium">Daily practices</span>
                                    </div>
                                    <Badge variant="secondary" className={isFullWidth ? "mt-2 self-start text-sm px-2.5 py-0.5" : "text-xs"}>
                                      {weeklyProgress.practices.completed}/{weeklyProgress.practices.goal}
                                    </Badge>
                                  </div>

                                  <div className={isFullWidth ? "p-4 rounded-xl bg-muted/40 border flex flex-col justify-between h-full min-h-[100px]" : "flex items-center justify-between"}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      <span className="text-sm font-medium">Mood check-ins</span>
                                    </div>
                                    <Badge variant="secondary" className={isFullWidth ? "mt-2 self-start text-sm px-2.5 py-0.5" : "text-xs"}>
                                      {weeklyProgress.moodCheckins.completed}/{weeklyProgress.moodCheckins.goal}
                                    </Badge>
                                  </div>

                                  <div className={isFullWidth ? "p-4 rounded-xl bg-muted/40 border flex flex-col justify-between h-full min-h-[100px]" : "flex items-center justify-between"}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                      <span className="text-sm font-medium">Assessments</span>
                                    </div>
                                    <Badge variant="secondary" className={isFullWidth ? "mt-2 self-start text-sm px-2.5 py-0.5" : "text-xs"}>
                                      {weeklyProgress.assessments.completed} completed
                                    </Badge>
                                  </div>
                                </div>

                                <div className="pt-3 border-t">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Award className={`h-4.5 w-4.5 ${streakInfo.current > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                                    <span className="text-muted-foreground font-medium">{streakInfo.message}</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">Loading progress...</p>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </ResponsiveGrid>
              )}

              {/* Navigation Shortcuts */}
              {isModeSectionVisible('navigation-shortcuts', isVisible('navigation-shortcuts')) && (
                <ResponsiveGrid columns="custom" className="grid-cols-2 md:grid-cols-4" gap="small">
                  <Button
                    variant="ghost"
                    className="h-20 flex-col gap-2"
                    onClick={() => onNavigate('assessments')}
                  >
                    <Brain className="h-6 w-6 text-primary" />
                    <span className="text-sm">Assessments</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-20 flex-col gap-2"
                    onClick={() => onNavigate('practices')}
                  >
                    <Heart className="h-6 w-6 text-primary" />
                    <span className="text-sm">Practices</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-20 flex-col gap-2"
                    onClick={() => onNavigate('library')}
                  >
                    <BookOpen className="h-6 w-6 text-primary" />
                    <span className="text-sm">Library</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-20 flex-col gap-2"
                    onClick={() => onNavigate('help')}
                  >
                    <Heart className="h-6 w-6 text-primary" />
                    <span className="text-sm">Help</span>
                  </Button>
                </ResponsiveGrid>
              )}

            </div>

            {/* Spacer for bottom navigation on mobile */}
            <BottomNavigationSpacer />
          </ResponsiveContainer>
        </div>

        {/* Bottom Navigation - Mobile only */}
        <BottomNavigation
          currentPage="dashboard"
          onNavigate={onNavigate}
        />
      </div>
    </>
  );
}
