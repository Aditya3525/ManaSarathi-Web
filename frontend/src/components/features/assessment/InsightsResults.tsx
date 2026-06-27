import {
  AlertCircle,
  ArrowLeft,
  Brain,
  Download,
  Heart,
  Lightbulb,
  MessageCircle,
  Play,
  Share,
  Sparkles,
  Target,
  TrendingUp
} from 'lucide-react';
import jsPDF from 'jspdf';
import React, { useMemo, useState, useEffect } from 'react';

import { getApiBaseUrl } from '../../../config/apiConfig';
import {
  AssessmentHistoryEntry,
  AssessmentInsights
} from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import {
  saveAssessmentShareContext,
  type AssessmentShareContext,
} from '../../../utils/assessmentSharingContext';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Progress } from '../../ui/progress';
import { InsightsSkeleton } from '../../ui/skeleton-loaders';

import { deltaClassForType, trendLabelForType } from './assessmentUtils';
import { OVERALL_ASSESSMENT_OPTION_IDS } from './OverallAssessmentSelection';

interface InsightsResultsProps {
  insights: AssessmentInsights | null;
  history: AssessmentHistoryEntry[];
  onNavigate: (page: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  focusAssessmentType?: string | null;
}

const friendlyLabel = (type: string): string => {
  switch (type) {
    case 'anxiety':
      return 'Anxiety';
    case 'stress':
      return 'Stress';
    case 'emotionalIntelligence':
      return 'Emotional Intelligence';
    case 'overthinking':
      return 'Overthinking';
    default:
      return type
        .split(/(?=[A-Z])/)
        .join(' ')
        .replace(/^[a-z]/, (match) => match.toUpperCase());
  }
};

const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-red-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-green-600';
};

const getScoreBg = (score: number) => {
  if (score >= 70) return 'bg-red-50 border-red-200';
  if (score >= 40) return 'bg-yellow-50 border-yellow-200';
  return 'bg-green-50 border-green-200';
};

const formatChange = (change?: number | null): string | undefined => {
  if (change === undefined || change === null) return undefined;
  const rounded = Math.round(change);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded}`;
};

const relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const formatRelativeTime = (dateString: string): string => {
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) {
    return 'Unknown';
  }
  const diff = time - Date.now();
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'day', ms: 86_400_000 },
    { unit: 'hour', ms: 3_600_000 },
    { unit: 'minute', ms: 60_000 }
  ];

  for (const { unit, ms } of units) {
    const value = diff / ms;
    if (Math.abs(value) >= 1) {
      return relativeTimeFormat.format(Math.round(value), unit);
    }
  }

  return 'Just now';
};

const sanitizeFileName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'insights-report';

const BASIC_OVERALL_ASSESSMENT_SET = new Set([
  'basic_overall',
  'basicoverall',
  ...OVERALL_ASSESSMENT_OPTION_IDS
]);
const normalizeTypeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const BASIC_OVERALL_NORMALIZED_SET = new Set(Array.from(BASIC_OVERALL_ASSESSMENT_SET).map(normalizeTypeKey));

const FOCUS_ALIAS_MAP: Record<string, string[]> = {
  anxiety: ['anxiety', 'anxiety_assessment'],
  anxietyassessment: ['anxiety', 'anxiety_assessment'],
  depression: ['depression', 'depression_phq9', 'phq9'],
  depressionphq9: ['depression', 'depression_phq9', 'phq9'],
  phq9: ['depression', 'depression_phq9', 'phq9'],
  stress: ['stress', 'stress_pss10'],
  stresspss10: ['stress', 'stress_pss10'],
  emotionalintelligence: ['emotional_intelligence', 'emotionalIntelligence', 'emotional_intelligence_teique', 'emotional_intelligence_ei10'],
  emotional_intelligence: ['emotional_intelligence', 'emotionalIntelligence', 'emotional_intelligence_teique', 'emotional_intelligence_ei10'],
  emotionalintelligenceteique: ['emotional_intelligence', 'emotional_intelligence_teique', 'emotionalIntelligence'],
  emotionalintelligenceei10: ['emotional_intelligence_ei10', 'emotional_intelligence', 'emotionalIntelligence'],
  emotionalintelligenceeq5: ['emotional_intelligence_eq5'],
  overthinking: ['overthinking', 'overthinking_ptq', 'overthinking_brooding'],
  overthinkingptq: ['overthinking', 'overthinking_ptq'],
  overthinkingbrooding: ['overthinking', 'overthinking_brooding'],
  trauma: ['trauma', 'trauma_pcl5', 'trauma-fear', 'traumafear'],
  traumapcl5: ['trauma_pcl5', 'trauma', 'trauma-fear'],
  traumafear: ['trauma-fear', 'trauma', 'trauma_pcl5'],
  traumapcptsd5: ['trauma_pcptsd5'],
  personality: ['personality', 'personality_mini_ipip', 'archetypes', 'psychological_archetypes'],
  personalityminiipip: ['personality_mini_ipip', 'personality', 'archetypes'],
  archetypes: ['archetypes', 'personality', 'personality_mini_ipip'],
  personalitybigfive10: ['personality_bigfive10'],
  anxietygad2: ['anxiety_gad2'],
  depressionphq2: ['depression_phq2'],
  stresspss4: ['stress_pss4'],
  overthinkingrrs4: ['overthinking_rrs4']
};

const getFocusMatchSet = (focusType?: string | null): Set<string> | null => {
  if (!focusType) return null;
  const normalized = normalizeTypeKey(focusType);
  const aliases = FOCUS_ALIAS_MAP[normalized] ?? [focusType];
  return new Set(aliases.map((alias) => normalizeTypeKey(alias)));
};

type BasicOverallSnapshot = {
  id: string;
  completedAt: string;
  combinedScore: number;
  change: number | null;
  assessments: AssessmentHistoryEntry[];
};

const buildRecommendations = (
  insights: AssessmentInsights | null,
  focusSet: Set<string> | null
): Array<{ title: string; description: string; type: 'immediate' | 'daily' | 'support'; }> => {
  if (!insights) return [];

  const unique = new Set<string>();
  const recs: Array<{ title: string; description: string; type: 'immediate' | 'daily' | 'support'; }> = [];

  const entries = focusSet
    ? Object.entries(insights.byType).filter(([type]) => focusSet.has(normalizeTypeKey(type)))
    : Object.entries(insights.byType);

  entries.forEach(([, summary]) => {
    summary.recommendations.forEach((line) => {
      if (!unique.has(line)) {
        unique.add(line);
        recs.push({
          title: line.split('.')[0],
          description: line,
          type: summary.trend === 'improving' ? 'daily' : summary.trend === 'declining' ? 'immediate' : 'support'
        });
      }
    });
  });

  return recs.slice(0, 4);
};

const getRecommendationIcon = (type: 'immediate' | 'daily' | 'support') => {
  switch (type) {
    case 'immediate':
      return <Heart className="h-4 w-4" />;
    case 'daily':
      return <Target className="h-4 w-4" />;
    default:
      return <MessageCircle className="h-4 w-4" />;
  }
};

export function InsightsResults({ insights, history, onNavigate, isLoading, errorMessage, focusAssessmentType }: InsightsResultsProps) {
  const { push } = useToast();
  const [discussDialogOpen, setDiscussDialogOpen] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  const [personalRecs, setPersonalRecs] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    const fetchPersonalRecs = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      setRecsLoading(true);
      try {
        const response = await fetch(`${getApiBaseUrl()}/recommendations/personalized`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const resJson = await response.json();
          const items = resJson.data?.items || resJson.recommendations || [];
          setPersonalRecs(items);
        }
      } catch (err) {
        console.error('Failed to fetch personal recommendations in InsightsResults:', err);
      } finally {
        setRecsLoading(false);
      }
    };
    fetchPersonalRecs();
  }, []);

  const handleRecommendationClick = (rec: any) => {
    if (typeof window === 'undefined') return;

    if (rec.type === 'practice') {
      const payload = { id: rec.id, title: rec.title };
      window.sessionStorage.setItem('mw-practice-autostart', JSON.stringify(payload));
      window.sessionStorage.setItem('practices_search', rec.title);
      onNavigate('practices');
    } else if (rec.type === 'content' || rec.type === 'crisis-resource') {
      const payload = { id: rec.id, title: rec.title };
      window.sessionStorage.setItem('mw-content-autoopen', JSON.stringify(payload));
      window.sessionStorage.setItem('content_library_search', rec.title);
      onNavigate('library');
    } else {
      onNavigate('practices');
    }
  };

  const hasInsights = insights && Object.keys(insights.byType).length > 0;
  const focusSet = useMemo(() => getFocusMatchSet(focusAssessmentType), [focusAssessmentType]);

  const basicSummaryEntries = useMemo(() => {
    if (!insights) return [] as Array<[string, AssessmentInsights['byType'][string]]>;
    return Object.entries(insights.byType).filter(([type]) => BASIC_OVERALL_ASSESSMENT_SET.has(type));
  }, [insights]);

  const otherSummaryEntries = useMemo(() => {
    if (!insights) return [] as Array<[string, AssessmentInsights['byType'][string]]>;
    return Object.entries(insights.byType).filter(([type]) => !BASIC_OVERALL_ASSESSMENT_SET.has(type));
  }, [insights]);

  const combinedWellnessScore = insights?.wellnessScore ? Math.round(insights.wellnessScore.value) : null;
  const combinedWellnessUpdatedAt = insights?.wellnessScore?.updatedAt ?? null;

  const focusFilteredBasic = useMemo(() => {
    if (!focusSet) return basicSummaryEntries;
    return basicSummaryEntries.filter(([type]) => focusSet.has(normalizeTypeKey(type)));
  }, [basicSummaryEntries, focusSet]);

  const focusFilteredOther = useMemo(() => {
    if (!focusSet) return otherSummaryEntries;
    return otherSummaryEntries.filter(([type]) => focusSet.has(normalizeTypeKey(type)));
  }, [otherSummaryEntries, focusSet]);

  const hasFocusMatches = focusSet ? focusFilteredBasic.length + focusFilteredOther.length > 0 : false;
  const appliedFocusSet = focusSet && hasFocusMatches ? focusSet : null;
  const focusIncludesBasicOverall = appliedFocusSet
    ? Array.from(appliedFocusSet).some((key) => BASIC_OVERALL_NORMALIZED_SET.has(key))
    : false;

  const visibleBasicSummaryEntries = appliedFocusSet ? focusFilteredBasic : basicSummaryEntries;
  const visibleOtherSummaryEntries = appliedFocusSet ? focusFilteredOther : otherSummaryEntries;
  const nonBasicFocusedEntries = appliedFocusSet ? focusFilteredOther : [];

  const recommendations = buildRecommendations(insights, appliedFocusSet);

  const basicOverallHistoryMap = new Map<string, AssessmentHistoryEntry[]>();
  const filteredHistory = history.filter((entry) => {
    if (BASIC_OVERALL_ASSESSMENT_SET.has(entry.assessmentType)) {
      const key = entry.completedAt.slice(0, 16);
      const group = basicOverallHistoryMap.get(key);
      if (group) {
        group.push(entry);
      } else {
        basicOverallHistoryMap.set(key, [entry]);
      }
      return false;
    }
    return true;
  });

  const combinedHistorySnapshots: BasicOverallSnapshot[] = Array.from(basicOverallHistoryMap.entries())
    .map(([key, entries]) => {
      const sortedEntries = [...entries].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      const latest = sortedEntries[0];
      const combinedScore = Math.round(sortedEntries.reduce((acc, entry) => acc + entry.score, 0) / sortedEntries.length);
      return {
        id: `basic-overall-${key}`,
        completedAt: latest.completedAt,
        combinedScore,
        change: null,
        assessments: sortedEntries
      };
    })
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const combinedSnapshotsWithChange: BasicOverallSnapshot[] = combinedHistorySnapshots.map((snapshot, index) => {
    const next = combinedHistorySnapshots[index + 1];
    return {
      ...snapshot,
      change: next ? snapshot.combinedScore - next.combinedScore : null
    };
  });

  const groupedHistory = filteredHistory.reduce<Record<string, AssessmentHistoryEntry[]>>((acc, entry) => {
    if (!acc[entry.assessmentType]) {
      acc[entry.assessmentType] = [];
    }
    acc[entry.assessmentType].push(entry);
    return acc;
  }, {});

  Object.values(groupedHistory).forEach((entries) => {
    entries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  });

  const shouldShowCombinedSnapshots = !appliedFocusSet
    ? combinedSnapshotsWithChange.length > 0
    : Array.from(appliedFocusSet).some((key) => BASIC_OVERALL_NORMALIZED_SET.has(key)) && combinedSnapshotsWithChange.length > 0;

  const visibleCombinedSnapshots = shouldShowCombinedSnapshots
    ? combinedSnapshotsWithChange
    : [];

  const visibleGroupedHistoryEntries = appliedFocusSet
    ? Object.entries(groupedHistory).filter(([type]) => appliedFocusSet.has(normalizeTypeKey(type)))
    : Object.entries(groupedHistory);

  const hasTimelineData = visibleCombinedSnapshots.length > 0 || visibleGroupedHistoryEntries.length > 0;
  const focusLabel = focusAssessmentType ? friendlyLabel(focusAssessmentType) : null;
  const aiSummaryContent = useMemo(() => {
    if (!insights) return null;

    const baseSummary = insights.aiSummary?.trim();
    if (!appliedFocusSet) {
      return baseSummary || null;
    }

    const focusedEntries = Object.entries(insights.byType).filter(([type]) =>
      appliedFocusSet.has(normalizeTypeKey(type))
    );

    if (focusedEntries.length === 0) {
      return baseSummary || null;
    }

    const segments = focusedEntries
      .map(([type, summary]) => {
        const pieces: string[] = [];
        const interpretation = summary.interpretation?.trim();
        if (interpretation) {
          pieces.push(interpretation);
        }

        if (typeof summary.change === 'number') {
          const roundedChange = Math.round(summary.change);
          if (roundedChange !== 0) {
            const direction = roundedChange > 0 ? 'up' : 'down';
            pieces.push(`Recent score moved ${direction} by ${Math.abs(roundedChange)} points.`);
          }
        }

        if (pieces.length === 0) {
          const trendLabel = trendLabelForType(type, summary.trend);
          if (trendLabel) {
            pieces.push(`Trend is ${trendLabel.toLowerCase()}.`);
          }
        }

        const recommended = (summary.recommendations ?? []).filter(Boolean).slice(0, 2);
        if (recommended.length > 0) {
          pieces.push(`Suggested focus: ${recommended.join('; ')}`);
        }

        if (pieces.length === 0) {
          return null;
        }

        return `${friendlyLabel(type)}: ${pieces.join(' ')}`;
      })
      .filter((segment): segment is string => Boolean(segment));

    if (segments.length === 0) {
      return baseSummary || null;
    }

    const focusedSummary = `Focus highlights: ${segments.join(' ')}`;
    if (baseSummary) {
      return `${baseSummary} ${focusedSummary}`;
    }

    return focusedSummary;
  }, [appliedFocusSet, insights]);

  const showAISummary = hasInsights && Boolean(aiSummaryContent);

  const backNavigationTarget = appliedFocusSet && !focusIncludesBasicOverall ? 'assessments' : 'dashboard';
  const backNavigationLabel = backNavigationTarget === 'assessments' ? 'Back to Assessments' : 'Back to Dashboard';

  const shareCandidate = useMemo(() => {
    if (!insights) return null;

    const allEntries = Object.entries(insights.byType);
    const scopedEntries = appliedFocusSet
      ? allEntries.filter(([type]) => appliedFocusSet.has(normalizeTypeKey(type)))
      : allEntries;
    const entry = scopedEntries[0] ?? allEntries[0];

    if (!entry) return null;

    const [assessmentType, summary] = entry;
    return {
      assessmentType,
      assessmentLabel: friendlyLabel(assessmentType),
      latestScore: Math.round(summary.latestScore),
      trend: trendLabelForType(assessmentType, summary.trend),
      interpretation: summary.interpretation,
      recommendations: (summary.recommendations ?? []).filter(Boolean).slice(0, 4),
    };
  }, [appliedFocusSet, insights]);

  const openTherapistFlowWithContext = (source: AssessmentShareContext['source']) => {
    if (!shareCandidate) {
      push({
        type: 'warning',
        title: 'No insights to share yet',
        description: 'Complete an assessment first, then you can share selected results with a therapist.',
      });
      onNavigate('help');
      return;
    }

    const context: AssessmentShareContext = {
      source,
      assessmentType: shareCandidate.assessmentType,
      assessmentLabel: shareCandidate.assessmentLabel,
      latestScore: shareCandidate.latestScore,
      trend: shareCandidate.trend,
      interpretation: shareCandidate.interpretation,
      recommendations: shareCandidate.recommendations,
      wellnessScore: combinedWellnessScore ?? undefined,
      generatedAt: new Date().toISOString(),
    };

    saveAssessmentShareContext(context);
    onNavigate('help');
  };

  const openChatbotFlowWithContext = () => {
    if (!shareCandidate) {
      onNavigate('chatbot');
      return;
    }

    const context: AssessmentShareContext = {
      source: 'insights-discuss',
      assessmentType: shareCandidate.assessmentType,
      assessmentLabel: shareCandidate.assessmentLabel,
      latestScore: shareCandidate.latestScore,
      trend: shareCandidate.trend,
      interpretation: shareCandidate.interpretation,
      recommendations: shareCandidate.recommendations,
      wellnessScore: combinedWellnessScore ?? undefined,
      generatedAt: new Date().toISOString(),
    };

    saveAssessmentShareContext(context);
    onNavigate('chatbot');
  };

  const handleExportReport = async () => {
    if (!insights) {
      push({
        type: 'warning',
        title: 'No report to export',
        description: 'Complete an assessment first to export your report.',
      });
      return;
    }

    setIsExportingReport(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = 18;

      const ensureSpace = (needed = 8) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addWrappedText = (text: string, fontSize = 11, lineHeight = 6) => {
        if (!text.trim()) return;
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, contentWidth);
        ensureSpace(lines.length * lineHeight + 2);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight + 2;
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(10);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Wellbeing Insights Report', margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 5;
      if (focusLabel) {
        doc.text(`Focus: ${focusLabel}`, margin, y);
        y += 5;
      }
      if (combinedWellnessScore !== null) {
        doc.text(`Overall wellness score: ${combinedWellnessScore}%`, margin, y);
        y += 7;
      }

      if (aiSummaryContent) {
        addSectionTitle('AI Summary');
        addWrappedText(aiSummaryContent);
      }

      const reportEntries = [...visibleBasicSummaryEntries, ...visibleOtherSummaryEntries];
      if (reportEntries.length > 0) {
        addSectionTitle('Assessment Scores');
        reportEntries.slice(0, 12).forEach(([type, summary]) => {
          addWrappedText(
            `${friendlyLabel(type)}: ${Math.round(summary.latestScore)}% (${trendLabelForType(type, summary.trend)})`,
            11
          );
          addWrappedText(`Interpretation: ${summary.interpretation}`, 10, 5);
          if (typeof summary.change === 'number') {
            addWrappedText(`Recent change: ${formatChange(summary.change) ?? '0'} points`, 10, 5);
          }
          y += 2;
        });
      }

      if (recommendations.length > 0) {
        addSectionTitle('Recommended Actions');
        recommendations.forEach((recommendation, index) => {
          addWrappedText(`${index + 1}. ${recommendation.description}`, 10, 5);
        });
      }

      if (hasTimelineData) {
        addSectionTitle('Progress Timeline (Recent)');
        visibleGroupedHistoryEntries.slice(0, 3).forEach(([type, entries]) => {
          addWrappedText(`${friendlyLabel(type)}:`, 10, 5);
          entries.slice(0, 2).forEach((entry) => {
            addWrappedText(
              `- ${Math.round(entry.score)}% (${entry.interpretation}) on ${new Date(entry.completedAt).toLocaleDateString()}`,
              10,
              5
            );
          });
        });
      }

      const fileSuffix = focusLabel ? sanitizeFileName(focusLabel) : 'overall';
      doc.save(`wellbeing-insights-${fileSuffix}-${Date.now()}.pdf`);

      push({
        type: 'success',
        title: 'Report exported',
        description: 'Your insights report has been downloaded as a PDF.',
      });
    } catch (error) {
      console.error('Failed to export insights report:', error);
      push({
        type: 'error',
        title: 'Export failed',
        description: 'Unable to export your report right now. Please try again.',
      });
    } finally {
      setIsExportingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => onNavigate(backNavigationTarget)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backNavigationLabel}
            </Button>
            <Button onClick={() => onNavigate('dashboard')}>
              Go to Dashboard
            </Button>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl">Your Wellbeing Insights</h1>
            <p className="text-muted-foreground text-lg">
              {isLoading
                ? 'Syncing the latest assessments…'
                : appliedFocusSet
                  ? `Showing the latest results for ${focusLabel ?? 'this assessment'}`
                  : hasInsights
                    ? 'Based on your latest assessment history'
                    : 'Complete an assessment to unlock personalized insights'}
            </p>
            {appliedFocusSet && (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Viewing {focusLabel ?? 'selected assessment'}
              </Badge>
            )}
            {errorMessage && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 inline-block">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {isLoading && !hasInsights ? (
          <InsightsSkeleton />
        ) : hasInsights ? (
          <>
            {/* AI Summary Card */}
            {showAISummary && (
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Your Wellbeing Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {aiSummaryContent}
                  </p>
                </div>
              </CardContent>
              </Card>
            )}

            {combinedWellnessScore !== null && visibleBasicSummaryEntries.length > 0 && (!appliedFocusSet || focusIncludesBasicOverall) && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span>Basic Overall Assessment</span>
                    </div>
                    <Badge variant="outline" className="border-primary/40 bg-white/70 text-primary">
                      Combined score {combinedWellnessScore}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-1 space-y-2">
                      <p className="text-4xl font-semibold text-primary">{combinedWellnessScore}</p>
                      <p className="text-sm text-muted-foreground">
                        Overall wellbeing snapshot from your quick baseline.
                      </p>
                      {combinedWellnessUpdatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last refreshed {formatRelativeTime(combinedWellnessUpdatedAt)}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Sub-assessment scores
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                          {visibleBasicSummaryEntries.map(([type, summary]) => (
                          <div key={type} className="rounded-lg border bg-white/80 px-4 py-3 shadow-sm">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">{friendlyLabel(type)}</span>
                              <span className="font-semibold text-primary">{Math.round(summary.latestScore)}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{summary.interpretation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {appliedFocusSet && nonBasicFocusedEntries.map(([type, summary]) => (
              <Card key={type} className="border-primary/20">
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{friendlyLabel(type)}</span>
                    <Badge 
                      variant="secondary" 
                      className={summary.trend === 'baseline' 
                        ? 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-100 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700' 
                        : getScoreColor(summary.latestScore)
                      }
                    >
                      {trendLabelForType(type, summary.trend)}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed">{summary.interpretation}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-4 bg-muted/40">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Latest score</p>
                      <p className="text-3xl font-semibold text-primary mt-1">{Math.round(summary.latestScore)}%</p>
                      {summary.change !== null && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Change{' '}
                          <span className={deltaClassForType(type, summary.change)}>{formatChange(summary.change)}</span>
                          {' '}points
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Trend metrics</p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <li>Average {Math.round(summary.averageScore)}%</li>
                        <li>Best {Math.round(summary.bestScore)}%</li>
                        {summary.lastCompletedAt && (
                          <li>Last completed {formatRelativeTime(summary.lastCompletedAt)}</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {summary.categoryBreakdown && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {Object.keys(summary.categoryBreakdown).length === 1 && summary.categoryBreakdown.overall
                          ? 'Assessment Details'
                          : 'Symptom Categories'}
                      </p>
                      <div className="space-y-2">
                        {Object.entries(summary.categoryBreakdown).map(([category, details]) => (
                          <div key={category} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                            <div className="font-medium capitalize">{category === 'overall' ? 'Overall Score' : category.replace(/_/g, ' ')}</div>
                            <div className="text-right">
                              <p className="font-semibold text-primary">{Math.round(details.normalized)}%</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">{details.interpretation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {!appliedFocusSet && visibleOtherSummaryEntries.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleOtherSummaryEntries.map(([type, summary]) => (
                  <Card key={type} className={`border-2 ${getScoreBg(summary.latestScore)}`}>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="font-semibold">{friendlyLabel(type)}</h3>
                          <p className="text-xs text-muted-foreground">{summary.interpretation}</p>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={summary.trend === 'baseline' 
                            ? 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-100 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700' 
                            : getScoreColor(summary.latestScore)
                          }
                        >
                          {trendLabelForType(type, summary.trend)}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-semibold">{Math.round(summary.latestScore)}%</span>
                          {summary.change !== null && (
                            <span className="text-sm text-muted-foreground">
                              Change{' '}
                              <span className={deltaClassForType(type, summary.change)}>
                                {formatChange(summary.change)}
                              </span>
                            </span>
                          )}
                        </div>
                        <Progress value={summary.latestScore} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          Average {Math.round(summary.averageScore)}% • Best {Math.round(summary.bestScore)}%
                        </p>
                        {typeof summary.rawScore === 'number' && summary.maxScore && (
                          <p className="text-xs text-muted-foreground">
                            Raw score {Math.round(summary.rawScore)} / {summary.maxScore}
                          </p>
                        )}
                      </div>

                      {summary.categoryBreakdown && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {Object.keys(summary.categoryBreakdown).length === 1 && summary.categoryBreakdown.overall
                              ? 'Assessment Details'
                              : 'Symptom Categories'}
                          </p>
                          <div className="space-y-2">
                            {Object.entries(summary.categoryBreakdown).map(([category, details]) => (
                              <div key={category} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                <div className="font-medium capitalize">{category === 'overall' ? 'Overall Score' : category.replace(/_/g, ' ')}</div>
                                <div className="text-right">
                                  <p className="font-semibold text-primary">{Math.round(details.normalized)}%</p>
                                  <p className="text-[11px] text-muted-foreground leading-tight">{details.interpretation}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {(personalRecs.length > 0 || recommendations.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    Recommended Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Based on your momentum, try these gentle next steps:
                  </p>
                  
                  {recsLoading ? (
                    <div className="flex items-center justify-center p-8 text-sm text-muted-foreground animate-pulse">
                      Tailoring personalized recommendations...
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {personalRecs.length > 0
                        ? personalRecs.slice(0, 4).map((rec, index) => {
                            const isPractice = rec.type === 'practice';
                            return (
                              <Card key={rec.id || index} className="border hover:border-primary/20 transition-all hover:scale-[1.01]">
                                <CardContent className="p-4 flex flex-col justify-between h-full space-y-4">
                                  <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                      <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                                        {isPractice ? <Heart className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                                      </div>
                                      <div className="space-y-1">
                                        <h4 className="font-semibold text-sm leading-snug">{rec.title}</h4>
                                        {rec.reason && (
                                          <p className="text-xs text-primary/80 font-medium">
                                            💡 {rec.reason}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                          {rec.description}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleRecommendationClick(rec)}
                                  >
                                    {isPractice ? 'Start Practice' : 'Read Article'}
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })
                        : recommendations.map((rec, index) => (
                            <Card key={index} className="border hover:border-primary/20 transition-colors">
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    {getRecommendationIcon(rec.type)}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">{rec.title}</h4>
                                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => onNavigate('practices')}
                                >
                                  {rec.type === 'immediate' ? 'Start Now' : 'Explore Practice'}
                                </Button>
                              </CardContent>
                            </Card>
                          ))
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Progress Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!hasTimelineData ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Complete another assessment to start building your progress timeline.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => onNavigate('assessments')}>
                      Take Another Assessment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {visibleCombinedSnapshots.length > 0 && (!appliedFocusSet || focusIncludesBasicOverall) && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-base">Basic Overall Assessment</h3>
                          <span className="text-xs text-muted-foreground">{visibleCombinedSnapshots.length} snapshots</span>
                        </div>
                        <div className="space-y-2">
                          {visibleCombinedSnapshots.slice(0, 4).map((snapshot) => (
                            <div key={snapshot.id} className="space-y-3 rounded-lg border p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">
                                    {snapshot.assessments.length === 1 && (snapshot.assessments[0].assessmentType === 'basic_overall' || snapshot.assessments[0].assessmentType === 'basicoverall')
                                      ? 'Baseline Wellness Screening'
                                      : 'Combined wellbeing snapshot'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Completed {formatRelativeTime(snapshot.completedAt)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-semibold text-primary">{snapshot.combinedScore}%</p>
                                  {snapshot.change !== null && (
                                    <p className="text-xs text-muted-foreground">
                                      Change{' '}
                                      <span className={deltaClassForType('basic_overall_assessment', snapshot.change)}>
                                        {formatChange(snapshot.change)}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              {snapshot.assessments.length > 1 && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {snapshot.assessments.map((entry) => (
                                    <div key={`${snapshot.id}-${entry.assessmentType}`} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
                                      <span className="font-medium text-muted-foreground">{friendlyLabel(entry.assessmentType)}</span>
                                      <span className="font-semibold text-primary">{Math.round(entry.score)}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleGroupedHistoryEntries.map(([type, entries]) => (
                      <div key={type} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-base">{friendlyLabel(type)}</h3>
                          <span className="text-xs text-muted-foreground">{entries.length} results</span>
                        </div>
                        <div className="space-y-2">
                          {entries.slice(0, 4).map((entry) => (
                            <div
                              key={`${entry.id}-${entry.completedAt}`}
                              className="flex items-start justify-between gap-4 rounded-lg border p-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">{entry.interpretation}</p>
                                <p className="text-xs text-muted-foreground">
                                  Completed {formatRelativeTime(entry.completedAt)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-primary">{Math.round(entry.score)}%</p>
                                {entry.changeFromPrevious !== null && (
                                  <p className="text-xs text-muted-foreground">
                                    Change{' '}
                                    <span className={deltaClassForType(entry.assessmentType, entry.changeFromPrevious)}>
                                      {formatChange(entry.changeFromPrevious)}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-10 text-center space-y-4">
              <Brain className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-2xl font-semibold">No assessments yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Take your first wellbeing assessment to unlock AI-powered insights, personalised guidance, and track your progress over time.
              </p>
              <Button size="lg" onClick={() => onNavigate('assessments')} className="mt-2">
                Start an Assessment
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            className="flex-1"
            onClick={() => onNavigate('plan')}
          >
            <Play className="h-4 w-4 mr-2" />
            Create Personalised Plan
          </Button>

          <Button variant="outline" onClick={() => setDiscussDialogOpen(true)}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Discuss Results
          </Button>

          <Button variant="outline" onClick={handleExportReport} disabled={isExportingReport || !hasInsights}>
            <Download className="h-4 w-4 mr-2" />
            {isExportingReport ? 'Exporting...' : 'Export Report'}
          </Button>

          <Button variant="outline" onClick={() => openTherapistFlowWithContext('insights-share')}>
            <Share className="h-4 w-4 mr-2" />
            Share with Clinician
          </Button>
        </div>

        <Dialog open={discussDialogOpen} onOpenChange={setDiscussDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Discuss Your Results</DialogTitle>
              <DialogDescription>
                Choose where you want to continue the discussion.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Button
                className="w-full justify-start"
                onClick={() => {
                  setDiscussDialogOpen(false);
                  openChatbotFlowWithContext();
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Discuss with Chatbot
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setDiscussDialogOpen(false);
                  openTherapistFlowWithContext('insights-discuss');
                }}
              >
                <Share className="h-4 w-4 mr-2" />
                Discuss with Therapist
              </Button>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDiscussDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Important Notes */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-muted-foreground mt-1" />
              <div className="space-y-2">
                <h3 className="font-semibold">Important Notes</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• These results are based on self-reported assessments and are for informational purposes only.</p>
                  <p>• This is not a clinical diagnosis and should not replace professional medical advice.</p>
                  <p>• If you’re experiencing severe symptoms, please consult with a healthcare professional.</p>
                  <p>• Your results are private and encrypted — you control who sees them.</p>
                </div>
                <Button variant="link" className="p-0 h-auto text-sm" onClick={() => onNavigate('help')}>
                  Crisis Resources &amp; Professional Support →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
