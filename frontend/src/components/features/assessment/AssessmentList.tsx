import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Clock,
  Heart,
  Play,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info
} from 'lucide-react';
import React, { useState } from 'react';

import { useDevice } from '../../../hooks/use-device';
import { useAvailableAssessments } from '../../../hooks/useAssessments';
import {
  AssessmentHistoryEntry,
  AssessmentInsights,
  AssessmentTrend
} from '../../../services/api';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { InlineLoading } from '../../ui/loading-spinner';
import { Progress } from '../../ui/progress';
import { 
  ResponsiveContainer, 
  ResponsiveCollapsibleSection
} from '../../ui/responsive-layout';
import { StaggerContainer, StaggerItem } from '../../ui/motion-wrapper';

// Type for available assessment from API
interface AvailableAssessment {
  id: string;
  title: string;
  category: string;
  description: string;
  timeEstimate: string;
  type: string;
  questions: number;
  tags: string;
}

import { AssessmentTrendsVisualization } from './AssessmentTrendsVisualization';
import { friendlyAssessmentLabel, trendLabelForType, deltaClassForType, isHigherScoreBetter } from './assessmentUtils';
import { OVERALL_ASSESSMENT_OPTION_IDS } from './OverallAssessmentSelection';

interface AssessmentListProps {
  onStartAssessment: (assessmentId: string) => void;
  onStartCombinedAssessment: () => void;
  onNavigate: (page: string) => void;
  onViewAssessmentResults: (assessmentType: string | null) => void;
  insights: AssessmentInsights | null;
  history: AssessmentHistoryEntry[];
  isLoading: boolean;
  isStartingCombinedAssessment?: boolean;
  errorMessage?: string | null;
}

interface AssessmentCardConfig {
  id: string;
  title: string;
  description: string;
  duration: string;
  questions: number;
  icon: React.ReactNode;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category: 'required' | 'recommended' | 'optional' | 'advanced';
  typeKey?: string;
  tags?: string[]; // All tags for this assessment
}

interface AssessmentCardState extends AssessmentCardConfig {
  completed: boolean;
  lastTaken?: string;
  score?: number;
  trend?: AssessmentTrend;
  change?: number | null;
  recommendations?: string[];
  trendLabel?: string;
}

// Map assessment category to appropriate icon
const getCategoryIcon = (category: string): React.ReactNode => {
  const normalizedCategory = category.toLowerCase();
  
  if (normalizedCategory.includes('anxiety')) {
    return <Brain className="h-6 w-6" />;
  } else if (normalizedCategory.includes('depression')) {
    return <Heart className="h-6 w-6" />;
  } else if (normalizedCategory.includes('stress')) {
    return <Target className="h-6 w-6" />;
  } else if (normalizedCategory.includes('emotional')) {
    return <Sparkles className="h-6 w-6" />;
  } else if (normalizedCategory.includes('overthinking') || normalizedCategory.includes('rumination')) {
    return <Zap className="h-6 w-6" />;
  } else if (normalizedCategory.includes('trauma') || normalizedCategory.includes('ptsd')) {
    return <Shield className="h-6 w-6" />;
  } else if (normalizedCategory.includes('personality')) {
    return <Users className="h-6 w-6" />;
  }
  
  // Default icon
  return <BarChart3 className="h-6 w-6" />;
};

// Map assessment type to difficulty level
const getAssessmentDifficulty = (type: string, questionCount: number): 'Beginner' | 'Intermediate' | 'Advanced' => {
  if (type === 'Basic') return 'Beginner';
  if (questionCount >= 20) return 'Advanced';
  if (questionCount >= 10) return 'Intermediate';
  return 'Beginner';
};

// Map assessment to category (required/recommended/optional/advanced)
const getAssessmentCategory = (category: string): 'required' | 'recommended' | 'optional' | 'advanced' => {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory.includes('anxiety') || normalizedCategory.includes('depression') || normalizedCategory.includes('stress')) {
    return 'required';
  } else if (normalizedCategory.includes('emotional') || normalizedCategory.includes('overthinking')) {
    return 'recommended';
  } else if (normalizedCategory.includes('advanced') || normalizedCategory.includes('personality') || normalizedCategory.includes('trauma')) {
    return 'advanced';
  }
  return 'optional';
};

const GENERIC_TYPE_KEYS = new Set(['basic', 'advanced', 'combined']);

const resolveAssessmentTypeKey = (type: string | undefined, id: string): string => {
  const normalizedType = type?.trim().toLowerCase() ?? '';
  if (!normalizedType || GENERIC_TYPE_KEYS.has(normalizedType)) {
    return id;
  }
  return type!.trim();
};

const baseAssessments: AssessmentCardConfig[] = [
  {
    id: 'anxiety_assessment',
    title: 'Anxiety Assessment (GAD-7)',
    description: 'A standardized 7-question assessment for generalized anxiety disorder screening.',
    duration: '2-3 minutes',
    questions: 7,
    icon: <Brain className="h-6 w-6" />,
    difficulty: 'Beginner',
    category: 'required',
    typeKey: 'anxiety_assessment'
  },
  {
    id: 'depression',
    title: 'Depression Assessment (PHQ-9)',
    description: 'Nine-item Patient Health Questionnaire for tracking depressive symptoms.',
    duration: '5-7 minutes',
    questions: 9,
    icon: <Heart className="h-6 w-6" />,
    difficulty: 'Beginner',
    category: 'required',
    typeKey: 'depression_phq9'
  },
  {
    id: 'stress',
    title: 'Stress (PSS-10)',
    description: 'Standard 10-item Perceived Stress Scale to understand stress over the past month.',
    duration: '5-6 minutes',
    questions: 10,
    icon: <Target className="h-6 w-6" />,
    difficulty: 'Beginner',
    category: 'required',
    typeKey: 'stress_pss10'
  },
  {
    id: 'emotional-intelligence',
    title: 'Emotional Intelligence (TEIQue-SF)',
    description: 'Comprehensive 30-item trait emotional intelligence inventory.',
    duration: '8-10 minutes',
    questions: 30,
    icon: <Sparkles className="h-6 w-6" />,
    difficulty: 'Intermediate',
    category: 'recommended',
    typeKey: 'emotional_intelligence_teique'
  },
  {
    id: 'overthinking',
    title: 'Overthinking (PTQ)',
    description: 'Fifteen-item Perseverative Thinking Questionnaire for repetitive thought loops.',
    duration: '6-7 minutes',
    questions: 15,
    icon: <Zap className="h-6 w-6" />,
    difficulty: 'Intermediate',
    category: 'recommended',
    typeKey: 'overthinking_ptq'
  },
  {
    id: 'trauma-fear',
    title: 'Trauma & Fear Response (PCL-5)',
    description: 'Standard 20-item PTSD Checklist for DSM-5 (optional, sensitive content).',
    duration: '8-10 minutes',
    questions: 20,
    icon: <Shield className="h-6 w-6" />,
    difficulty: 'Advanced',
    category: 'optional',
    typeKey: 'trauma_pcl5'
  },
  {
    id: 'archetypes',
    title: 'Personality (Mini-IPIP)',
    description: 'Twenty-item Mini-IPIP to understand your Big Five personality blend.',
    duration: '6-7 minutes',
    questions: 20,
    icon: <Users className="h-6 w-6" />,
    difficulty: 'Advanced',
    category: 'optional',
    typeKey: 'personality_mini_ipip'
  }
];

const trendChipClasses: Record<AssessmentTrend | 'baseline', string> = {
  improving: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  declining: 'bg-rose-50 text-rose-700 border border-rose-200',
  stable: 'bg-blue-50 text-blue-700 border border-blue-200',
  baseline: 'bg-slate-100 text-slate-600 border border-slate-200'
};

const relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const BASIC_OVERALL_ASSESSMENT_SET = new Set([
  'basic_overall',
  'basicoverall',
  ...OVERALL_ASSESSMENT_OPTION_IDS
]);

interface CombinedHistorySnapshot {
  id: string;
  completedAt: string;
  combinedScore: number;
  change: number | null;
  assessments: AssessmentHistoryEntry[];
}

const getRelativeTime = (dateString?: string): string | undefined => {
  if (!dateString) return undefined;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return undefined;
  const now = Date.now();
  const diffMs = target - now;

  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'day', ms: 86_400_000 },
    { unit: 'hour', ms: 3_600_000 },
    { unit: 'minute', ms: 60_000 }
  ];

  for (const { unit, ms } of units) {
    const value = diffMs / ms;
    if (Math.abs(value) >= 1) {
      return relativeTimeFormat.format(Math.round(value), unit);
    }
  }

  return 'Just now';
};

const formatChange = (change?: number | null): string | undefined => {
  if (change === undefined || change === null) return undefined;
  const rounded = Math.round(change);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded}`;
};

export function AssessmentList({ onStartAssessment, onStartCombinedAssessment, onNavigate, onViewAssessmentResults, insights, history, isLoading, isStartingCombinedAssessment, errorMessage }: AssessmentListProps) {
  const device = useDevice();
  const [activeFilter, setActiveFilter] = useState<'all' | 'required' | 'recommended' | 'optional' | 'advanced'>('all');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(!device.isMobile);
  
  // Fetch available assessments from the backend
  const { data: availableAssessmentsData, isLoading: isLoadingAssessments, error: assessmentsError } = useAvailableAssessments();
  
  const summaryByType = insights?.byType ?? {};
  const combinedWellnessScore = insights?.wellnessScore ? Math.round(insights.wellnessScore.value) : null;
  const combinedWellnessUpdatedAt = insights?.wellnessScore?.updatedAt;
  const combinedWellnessRelativeTime = combinedWellnessUpdatedAt ? getRelativeTime(combinedWellnessUpdatedAt) : null;

  const resolveSummary = (typeKey?: string) => {
    if (!typeKey) return undefined;
    if (summaryByType[typeKey]) return summaryByType[typeKey];

    switch (typeKey) {
      case 'anxiety_assessment':
        return summaryByType.anxiety ?? summaryByType['anxiety_assessment'];
      case 'depression_phq9':
      case 'depression':
      case 'phq9':
        return (
          summaryByType.depression_phq9 ??
          summaryByType.depression ??
          summaryByType.phq9
        );
      case 'stress_pss10':
        return summaryByType.stress ?? summaryByType['stress'];
      case 'emotional_intelligence_teique':
      case 'emotional_intelligence':
      case 'emotional-intelligence':
      case 'emotionalIntelligence':
        return (
          summaryByType.emotional_intelligence_teique ??
          summaryByType.emotionalIntelligence ??
          summaryByType.emotional_intelligence ??
          summaryByType.emotional_intelligence_ei10 ??
          summaryByType.emotional_intelligence_eq5
        );
      case 'emotional_intelligence_ei10':
        return (
          summaryByType.emotional_intelligence_ei10 ??
          summaryByType.emotional_intelligence_teique ??
          summaryByType.emotionalIntelligence ??
          summaryByType['emotional-intelligence'] ??
          summaryByType.emotional_intelligence_eq5
        );
      case 'overthinking_brooding':
        return (
          summaryByType.overthinking_brooding ??
          summaryByType.overthinking ??
          summaryByType.overthinking_ptq
        );
      case 'overthinking_ptq':
      case 'overthinking':
        return (
          summaryByType.overthinking_ptq ??
          summaryByType.overthinking ??
          summaryByType.overthinking_brooding
        );
      case 'trauma_pcl5':
      case 'trauma':
        return (
          summaryByType.trauma_pcl5 ??
          summaryByType.trauma ??
          summaryByType['trauma-fear'] ??
          summaryByType.trauma_pcptsd5
        );
      case 'personality_mini_ipip':
      case 'archetypes':
      case 'personality':
        return (
          summaryByType.personality_mini_ipip ??
          summaryByType.personality ??
          summaryByType.archetypes
        );
      default:
        return undefined;
    }
  };

  // Convert available assessments from backend to AssessmentCardConfig format
  const dynamicAssessments: AssessmentCardConfig[] = (availableAssessmentsData || []).map((assessment: AvailableAssessment) => {
    // Parse tags from comma-separated string, fallback to category mapping
    const tags = assessment.tags ? assessment.tags.split(',').map((t: string) => t.trim()) : [];
    
    // Determine primary category from tags or fallback to getAssessmentCategory
    let primaryCategory: 'required' | 'recommended' | 'optional' | 'advanced' = 'optional';
    if (tags.includes('required')) {
      primaryCategory = 'required';
    } else if (tags.includes('recommended')) {
      primaryCategory = 'recommended';
    } else if (tags.includes('advanced')) {
      primaryCategory = 'advanced';
    } else if (tags.includes('optional')) {
      primaryCategory = 'optional';
    } else {
      // Fallback to original category mapping
      primaryCategory = getAssessmentCategory(assessment.category);
    }
    
    return {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      duration: assessment.timeEstimate,
      questions: assessment.questions,
      icon: getCategoryIcon(assessment.category),
      difficulty: getAssessmentDifficulty(assessment.type, assessment.questions),
      category: primaryCategory,
      // Some legacy rows use generic types (e.g. Advanced/Basic), which are not unique.
      // Fall back to ID so retake opens the correct template.
      typeKey: resolveAssessmentTypeKey(assessment.type, assessment.id),
      tags: tags.length > 0 ? tags : ['all']
    };
  });

  // Only show assessments that actually exist in the database.
  // Previously this fell back to hardcoded `baseAssessments`, which showed
  // phantom entries for templates that hadn't been created yet.
  const assessmentsSource = dynamicAssessments;

  const assessments: AssessmentCardState[] = assessmentsSource.map((assessment) => {
    const typeKey = assessment.typeKey;
    const summary = resolveSummary(typeKey);

    return {
      ...assessment,
      completed: Boolean(summary),
      lastTaken: summary ? getRelativeTime(summary.lastCompletedAt) : undefined,
      score: summary ? Math.round(summary.latestScore) : undefined,
      trend: summary?.trend,
      change: summary?.change ?? null,
      recommendations: summary?.recommendations,
      trendLabel: summary ? trendLabelForType(typeKey ?? assessment.id, summary.trend) : undefined
    };
  });

  // Filter assessments based on active filter
  // Show assessments that have the selected tag (allows assessments to appear in multiple tabs)
  const filteredAssessments = activeFilter === 'all' 
    ? assessments 
    : assessments.filter(a => a.tags?.includes(activeFilter) || a.category === activeFilter);

  // Count assessments by category (including tags)
  const categoryCount = {
    all: assessments.length,
    required: assessments.filter(a => a.tags?.includes('required') || a.category === 'required').length,
    recommended: assessments.filter(a => a.tags?.includes('recommended') || a.category === 'recommended').length,
    optional: assessments.filter(a => a.tags?.includes('optional') || a.category === 'optional').length,
    advanced: assessments.filter(a => a.tags?.includes('advanced') || a.category === 'advanced').length
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'required':
        return 'bg-red-100 text-red-800';
      case 'recommended':
        return 'bg-yellow-100 text-yellow-800';
      case 'optional':
        return 'bg-green-100 text-green-800';
      case 'advanced':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCompletionStats = () => {
    const total = assessments.length;
    const completed = assessments.filter((a) => a.completed).length;
    const required = assessments.filter((a) => a.category === 'required');
    const requiredCompleted = required.filter((a) => a.completed).length;

    return {
      total,
      completed,
      required: required.length,
      requiredCompleted,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100)
    };
  };

  const stats = getCompletionStats();
  const showLoadingState = isLoading && history.length === 0 && Object.keys(summaryByType).length === 0;

  const basicOverallHistoryMap = new Map<string, AssessmentHistoryEntry[]>();
  const individualHistory = history.filter((entry) => {
    if (BASIC_OVERALL_ASSESSMENT_SET.has(entry.assessmentType)) {
      const key = entry.completedAt.slice(0, 16);
      const existing = basicOverallHistoryMap.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        basicOverallHistoryMap.set(key, [entry]);
      }
      return false;
    }
    return true;
  });

  const combinedHistorySnapshots: CombinedHistorySnapshot[] = Array.from(basicOverallHistoryMap.entries())
    .map(([key, entries]) => {
      const sortedEntries = [...entries].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      const latest = sortedEntries[0];
      const eligibleEntries = sortedEntries.filter((entry) => {
        const type = entry.assessmentType.toLowerCase();
        return !(type.includes('personality') || type.includes('bigfive') || type.includes('mini_ipip') || type.includes('archetype'));
      });
      const combinedScore = eligibleEntries.length > 0
        ? Math.round(
            eligibleEntries.reduce((acc, entry) => {
              const val = isHigherScoreBetter(entry.assessmentType) ? entry.score : 100 - entry.score;
              return acc + val;
            }, 0) / eligibleEntries.length
          )
        : 100;
      return {
        id: `basic-overall-${key}`,
        completedAt: latest.completedAt,
        combinedScore,
        change: null,
        assessments: sortedEntries
      };
    })
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const combinedHistoryWithChange: CombinedHistorySnapshot[] = combinedHistorySnapshots.map((snapshot, index) => {
    const next = combinedHistorySnapshots[index + 1];
    return {
      ...snapshot,
      change: next ? snapshot.combinedScore - next.combinedScore : null
    };
  });

  // Show loading state while fetching assessments
  if (isLoadingAssessments) {
    return (
      <ResponsiveContainer spacing={device.isMobile ? 'small' : 'medium'} className="min-h-screen bg-background pb-safe page-enter">
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <InlineLoading size={device.isMobile ? 'sm' : 'md'} />
          <p className="text-muted-foreground">Loading assessments...</p>
        </div>
      </ResponsiveContainer>
    );
  }

  // Show error state if assessments failed to load (with fallback to hardcoded)
  if (assessmentsError && dynamicAssessments.length === 0) {
    console.error('Failed to load assessments:', assessmentsError);
    // Continue rendering with fallback baseAssessments
  }

  return (
    <ResponsiveContainer spacing={device.isMobile ? 'small' : 'medium'} className="min-h-screen bg-background pb-safe page-enter">
      {/* Header - Responsive */}
      <div className={`bg-gradient-to-r from-primary/10 to-accent/10 ${device.isMobile ? 'p-4' : 'p-6'}`}>
        <div className="max-w-4xl mx-auto">
          {!device.isMobile && (
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('dashboard')}
                className="min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <h1 className={device.isMobile ? 'text-2xl font-bold' : 'text-3xl font-bold'}>
              Wellbeing Assessments
            </h1>
            <p className={`text-muted-foreground ${device.isMobile ? 'text-sm' : 'text-lg'}`}>
              Science-based assessments to understand your wellbeing patterns
            </p>

            {/* TOP SUMMARY MODULE - Mobile optimized: Combined score + progress + primary CTA */}
            <Card className="shadow-sm">
              <CardContent className={device.isMobile ? 'p-4 space-y-4' : 'p-6 space-y-4'}>
                {/* Combined Wellness Score */}
                {insights?.wellnessScore && (
                  <div className={`p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20 ${
                    device.isMobile ? 'space-y-2' : ''
                  }`}>
                    <div className={`flex items-center ${device.isMobile ? 'flex-col text-center' : 'justify-between'} gap-3`}>
                      <div className="space-y-1">
                        <p className="font-semibold text-base md:text-lg">Combined Wellness Score</p>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          From your baseline assessment
                        </p>
                      </div>
                      <div className={device.isMobile ? 'text-center' : 'text-right'}>
                        <div className="text-3xl md:text-4xl font-bold text-primary">
                          {Math.round(insights.wellnessScore.value)}
                        </div>
                        <div className="text-xs text-muted-foreground">/ 100</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Individual Assessment Progress */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <p className="font-medium text-sm md:text-base">Individual Assessment Progress</p>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {stats.completed} of {stats.total} completed • {stats.requiredCompleted}/{stats.required} required
                      </p>
                    </div>
                    {!device.isMobile && (
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-primary">
                          {stats.percentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">Complete</div>
                      </div>
                    )}
                  </div>
                  <Progress value={stats.percentage} className="h-2" />
                  {device.isMobile && (
                    <div className="text-right">
                      <span className="text-lg font-semibold text-primary">{stats.percentage}%</span>
                      <span className="text-xs text-muted-foreground ml-1">complete</span>
                    </div>
                  )}
                  {showLoadingState && (
                    <InlineLoading message="Syncing your assessment history..." size="sm" />
                  )}
                  {errorMessage && (
                    <p className="text-sm text-destructive" role="alert">
                      {errorMessage}
                    </p>
                  )}
                </div>

                {/* Primary CTA - Full width on mobile */}
                <div className={device.isMobile ? 'space-y-2 pt-2' : 'flex items-center justify-between gap-4 pt-2'}>
                  {!device.isMobile && (
                    <p className="text-sm text-muted-foreground flex-1">
                      Revisit the quick baseline to refresh personalized insights
                    </p>
                  )}
                  <Button
                    onClick={onStartCombinedAssessment}
                    disabled={isStartingCombinedAssessment}
                    className="w-full md:w-auto min-h-[44px] touch-manipulation"
                    size={device.isMobile ? 'default' : 'default'}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isStartingCombinedAssessment ? 'Preparing…' : 
                      device.isMobile ? 'Start Baseline Assessment' : 'Start Basic Overall Assessment'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* FILTER CONTROLS - Sticky on scroll (mobile), segmented control */}
        <div className={`sticky ${device.isMobile ? 'top-0' : 'top-4'} z-40 bg-background/95 backdrop-blur-sm ${
          device.isMobile ? 'py-3 -mx-4 px-4 border-b' : 'py-4'
        }`}>
          <div className={`flex gap-2 ${device.isMobile ? 'overflow-x-auto scrollbar-hide snap-x' : 'flex-wrap'}`}>
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('all')}
              className={`${device.isMobile ? 'min-w-[80px] snap-start' : ''} min-h-[44px] touch-manipulation whitespace-nowrap`}
              aria-current={activeFilter === 'all' ? 'page' : undefined}
            >
              All ({categoryCount.all})
            </Button>
            <Button
              variant={activeFilter === 'required' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('required')}
              className={`${device.isMobile ? 'min-w-[100px] snap-start' : ''} min-h-[44px] touch-manipulation whitespace-nowrap`}
              aria-current={activeFilter === 'required' ? 'page' : undefined}
            >
              Required ({categoryCount.required})
            </Button>
            <Button
              variant={activeFilter === 'recommended' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('recommended')}
              className={`${device.isMobile ? 'min-w-[130px] snap-start' : ''} min-h-[44px] touch-manipulation whitespace-nowrap`}
              aria-current={activeFilter === 'recommended' ? 'page' : undefined}
            >
              Recommended ({categoryCount.recommended})
            </Button>
            <Button
              variant={activeFilter === 'optional' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('optional')}
              className={`${device.isMobile ? 'min-w-[100px] snap-start' : ''} min-h-[44px] touch-manipulation whitespace-nowrap`}
              aria-current={activeFilter === 'optional' ? 'page' : undefined}
            >
              Optional ({categoryCount.optional})
            </Button>
            <Button
              variant={activeFilter === 'advanced' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('advanced')}
              className={`${device.isMobile ? 'min-w-[110px] snap-start' : ''} min-h-[44px] touch-manipulation whitespace-nowrap`}
              aria-current={activeFilter === 'advanced' ? 'page' : undefined}
            >
              Advanced ({categoryCount.advanced})
            </Button>
          </div>
          {activeFilter !== 'all' && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filteredAssessments.length} {activeFilter} {filteredAssessments.length === 1 ? 'assessment' : 'assessments'}
            </p>
          )}
        </div>

        {/* Trends Visualization - tablet and desktop only */}
        {(history.length > 0 || insights) && !device.isMobile && (
          <div className="mb-6">
            <AssessmentTrendsVisualization history={history} insights={insights} />
          </div>
        )}

        {/* ASSESSMENT LIST - Mobile optimized cards */}
        <div className="space-y-3 md:space-y-4">
          {/* Basic Overall Assessment Card - Featured */}
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className={device.isMobile ? 'p-4' : 'p-6'}>
              <div className={`flex ${device.isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                {/* Icon + Content */}
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-3 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 shrink-0">
                    <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg md:text-xl font-semibold">Basic Overall Assessment</h2>
                      {combinedWellnessScore !== null && (
                        <Badge variant="outline" className="border-primary text-primary bg-primary/10 text-xs">
                          Score {combinedWellnessScore}/100
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {device.isMobile 
                        ? 'Quick 7-question snapshot to refresh your wellness score'
                        : 'Re-run the seven-question onboarding snapshot to refresh your combined wellness score and unlock the most up-to-date recommendations.'}
                    </p>
                    {combinedWellnessScore !== null && !device.isMobile && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" />
                          <span>Score {combinedWellnessScore}</span>
                        </div>
                        {combinedWellnessRelativeTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Last {combinedWellnessRelativeTime}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {device.isMobile && combinedWellnessRelativeTime && (
                      <p className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Last taken {combinedWellnessRelativeTime}
                      </p>
                    )}
                  </div>
                </div>

                {/* CTAs - Stack vertically on mobile */}
                <div className={`flex ${device.isMobile ? 'flex-col' : 'flex-col-reverse sm:flex-row'} gap-2 ${
                  device.isMobile ? 'w-full' : 'sm:items-center'
                }`}>
                  {combinedWellnessScore !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewAssessmentResults(null)}
                      className={`${device.isMobile ? 'w-full' : 'sm:min-w-[130px]'} min-h-[44px] touch-manipulation`}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={onStartCombinedAssessment}
                    disabled={isStartingCombinedAssessment}
                    className={`${device.isMobile ? 'w-full' : 'sm:min-w-[130px]'} min-h-[44px] touch-manipulation`}
                  >
                    {isStartingCombinedAssessment ? (
                      'Preparing…'
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retake
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Assessment Cards - Mobile optimized */}
          {filteredAssessments.length === 0 && !isLoadingAssessments && (
            <Card className="shadow-sm border-dashed">
              <CardContent className={device.isMobile ? 'p-6' : 'p-8'}>
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-3 rounded-full bg-muted">
                    <BarChart3 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base">No assessments available yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Assessment templates haven't been created in the system yet. 
                      You can still take the Basic Overall Assessment above to get your wellness score.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <StaggerContainer staggerDelay={0.12}>
            {filteredAssessments.map((assessment) => (
              <StaggerItem key={assessment.id}>
                <Card
              className={`transition-all shadow-sm ${
                assessment.completed ? 'border-green-200 bg-green-50/30' : 'hover:border-primary/20'
              }`}
            >
              <CardContent className={device.isMobile ? 'p-4' : 'p-6'}>
                {/* Mobile: Vertical layout | Tablet+: Horizontal */}
                <div className={`flex ${device.isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                  {/* Icon + Title + Meta */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2.5 md:p-3 rounded-lg shrink-0 ${
                        assessment.completed ? 'bg-green-100' : 'bg-primary/10'
                      }`}
                    >
                      <div className={assessment.completed ? 'text-green-600' : 'text-primary'}>
                        {assessment.icon}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Title + Badges */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h3 className={`font-semibold ${device.isMobile ? 'text-base' : 'text-lg'} leading-tight`}>
                            {assessment.title}
                          </h3>
                          {assessment.completed && (
                            <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600 shrink-0 mt-0.5" aria-label="Completed" />
                          )}
                        </div>
                        
                        {/* Status badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {assessment.trend && (
                            <Badge
                              className={`text-xs font-medium ${trendChipClasses[assessment.trend]}`}
                              aria-label={`Status: ${assessment.trendLabel ?? assessment.trend}`}
                            >
                              {assessment.trendLabel ?? (assessment.trend === 'baseline'
                                ? 'Initial Score'
                                : assessment.trend.charAt(0).toUpperCase() + assessment.trend.slice(1))}
                              {assessment.change !== null &&
                                assessment.change !== undefined &&
                                assessment.change !== 0 && (
                                  <span
                                    className={`ml-1 ${deltaClassForType(assessment.typeKey ?? assessment.id, assessment.change)}`}
                                  >
                                    ({formatChange(assessment.change)})
                                  </span>
                                )}
                            </Badge>
                          )}
                          {assessment.completed && assessment.score !== undefined && (
                            <Badge variant="outline" className="text-xs border-primary text-primary bg-primary/5">
                              Score: {assessment.score}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Description - truncate on mobile */}
                      <p className={`text-muted-foreground leading-relaxed ${device.isMobile ? 'text-sm line-clamp-2' : 'text-sm'}`}>
                        {assessment.description}
                      </p>

                      {/* Meta row: duration, questions, category */}
                      <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm flex-wrap">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
                          <span>{assessment.duration}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {assessment.questions} questions
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`${getCategoryColor(assessment.category)} text-xs`}
                          aria-label={`Category: ${assessment.category}`}
                        >
                          {assessment.category}
                        </Badge>
                        {!device.isMobile && (
                          <Badge 
                            variant="outline" 
                            className={`${getDifficultyColor(assessment.difficulty)} text-xs`}
                            aria-label={`Difficulty: ${assessment.difficulty}`}
                          >
                            {assessment.difficulty}
                          </Badge>
                        )}
                      </div>

                      {/* Last taken info */}
                      {assessment.completed && assessment.lastTaken && (
                        <p className="text-xs md:text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 inline mr-1" aria-hidden="true" />
                          Last taken {assessment.lastTaken}
                        </p>
                      )}

                      {/* Recommendations - collapsible on mobile */}
                      {assessment.completed && assessment.recommendations && assessment.recommendations.length > 0 && !device.isMobile && (
                        <ResponsiveCollapsibleSection
                          title="Insights"
                          defaultOpen={false}
                          icon={<Info className="h-4 w-4" />}
                        >
                          <div className="text-sm">
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-2">
                              {assessment.recommendations.slice(0, 2).map((rec) => (
                                <li key={rec}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        </ResponsiveCollapsibleSection>
                      )}
                    </div>
                  </div>

                  {/* CTAs - Full width on mobile, side-by-side on tablet+ */}
                  <div className={`flex ${device.isMobile ? 'flex-col w-full' : 'flex-col'} gap-2 ${
                    device.isMobile ? '' : 'min-w-[140px]'
                  }`}>
                    {assessment.completed ? (
                      <>
                        <Button 
                          onClick={() => onStartAssessment(assessment.typeKey || assessment.id)} 
                          size="sm"
                          className={`${device.isMobile ? 'w-full' : ''} min-h-[44px] touch-manipulation`}
                          aria-label={`Retake ${assessment.title}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retake
                        </Button>
                        <Button 
                          onClick={() => onViewAssessmentResults(assessment.typeKey ?? assessment.id ?? null)} 
                          variant="outline" 
                          size="sm"
                          className={`${device.isMobile ? 'w-full' : ''} min-h-[44px] touch-manipulation`}
                          aria-label={`View results for ${assessment.title}`}
                        >
                          <ChevronRight className="h-4 w-4 mr-2" />
                          View Results
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={() => onStartAssessment(assessment.typeKey || assessment.id)} 
                        className={`${device.isMobile ? 'w-full' : ''} min-h-[44px] touch-manipulation`}
                        size={device.isMobile ? 'default' : 'sm'}
                        aria-label={`Start ${assessment.title}`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Assessment
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* RECENT ASSESSMENT HISTORY - Collapsible on mobile */}
        {history.length > 0 && (
          <ResponsiveCollapsibleSection
            title="Recent Assessment History"
            defaultOpen={!device.isMobile}
            summary={`${history.length} ${history.length === 1 ? 'entry' : 'entries'} • Latest: ${combinedHistoryWithChange[0] ? getRelativeTime(combinedHistoryWithChange[0].completedAt) : 'N/A'}`}
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <Card className="border-none shadow-none">
              <CardContent className={device.isMobile ? 'p-0 space-y-4' : 'p-4 space-y-4'}>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Track how your scores are evolving across wellbeing areas
                </p>
                
                <div className="space-y-3 md:space-y-4">
                  {/* Combined History */}
                  {combinedHistoryWithChange.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Basic Overall Assessment
                      </h4>
                      {combinedHistoryWithChange.slice(0, device.isMobile ? 3 : 5).map((snapshot) => (
                        <div key={snapshot.id} className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 md:p-4">
                          <div className={`flex items-start ${device.isMobile ? 'flex-col gap-2' : 'justify-between gap-4'}`}>
                            <div className="space-y-1">
                              <p className="text-xs md:text-sm font-medium text-muted-foreground">
                                {snapshot.assessments.length === 1 && (snapshot.assessments[0].assessmentType === 'basic_overall' || snapshot.assessments[0].assessmentType === 'basicoverall')
                                  ? 'Baseline Wellness Screening'
                                  : 'Combined wellbeing snapshot'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Completed {getRelativeTime(snapshot.completedAt)}
                              </p>
                            </div>
                            <div className={`space-y-1 ${device.isMobile ? 'w-full text-left' : 'text-right'}`}>
                              <p className="text-xl md:text-2xl font-semibold text-primary">
                                {snapshot.combinedScore}%
                              </p>
                              {snapshot.change !== null && (
                                <p className="text-xs md:text-sm text-muted-foreground">
                                  Change {formatChange(snapshot.change)} points
                                </p>
                              )}
                            </div>
                          </div>
                          {snapshot.assessments.length > 1 && (
                            <div className={`grid ${device.isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2 pt-1`}>
                              {snapshot.assessments.map((entry) => (
                                <div
                                  key={`${snapshot.id}-${entry.assessmentType}`}
                                  className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-xs"
                                >
                                  <span className="font-medium text-muted-foreground truncate">
                                    {friendlyAssessmentLabel(entry.assessmentType)}
                                  </span>
                                  <span className="font-semibold text-primary ml-2">
                                    {Math.round(entry.score)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {device.isMobile && combinedHistoryWithChange.length > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                          className="w-full min-h-[44px] touch-manipulation"
                        >
                          {isHistoryExpanded ? 'Show less' : `Show ${combinedHistoryWithChange.length - 3} more`}
                          {isHistoryExpanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Individual History */}
                  {individualHistory.length > 0 && (
                    <div className="space-y-3">
                      {individualHistory.slice(0, device.isMobile ? 5 : 10).map((entry) => (
                        <div
                          key={`${entry.id}-${entry.completedAt}`}
                          className={`flex ${device.isMobile ? 'flex-col' : 'items-start justify-between'} gap-3 rounded-lg border p-3 md:p-4`}
                        >
                          <div className="space-y-1 flex-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {friendlyAssessmentLabel(entry.assessmentType)}
                            </p>
                            <p className="text-sm md:text-base font-semibold">{entry.interpretation}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              Completed {getRelativeTime(entry.completedAt)}
                            </p>
                          </div>
                          <div className={`space-y-1 ${device.isMobile ? 'w-full text-left' : 'text-right'}`}>
                            <p className="text-xl md:text-2xl font-semibold text-primary">
                              {Math.round(entry.score)}%
                            </p>
                            {entry.changeFromPrevious !== null && (
                              <p className="text-xs md:text-sm text-muted-foreground">
                                Change {formatChange(entry.changeFromPrevious)} points
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {combinedHistoryWithChange.length === 0 && individualHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent history available yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </ResponsiveCollapsibleSection>
        )}

        {/* PRIVACY & SAFETY - Collapsed by default on mobile */}
        <ResponsiveCollapsibleSection
          title="Privacy & Safety"
          defaultOpen={!device.isMobile}
          summary="Your data is confidential and encrypted"
          icon={<Shield className="h-4 w-4" />}
        >
          <Card className="border-none shadow-none">
            <CardContent className={device.isMobile ? 'p-0 space-y-3' : 'p-4 space-y-3'}>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                All assessments are confidential and encrypted. Your responses help us provide personalized 
                recommendations. You can pause and resume anytime. If you experience distress during any 
                assessment, please stop and reach out for support.
              </p>
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs md:text-sm min-h-[44px] touch-manipulation" 
                onClick={() => onNavigate('help')}
              >
                Crisis Resources &amp; Support <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>
      </div>
    </ResponsiveContainer>
  );
}
