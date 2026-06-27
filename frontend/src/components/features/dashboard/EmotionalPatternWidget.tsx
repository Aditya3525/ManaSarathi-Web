import { TrendingUp, TrendingDown, Minus, Smile, Meh, Frown } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { getApiBaseUrl } from '../../../config/apiConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { Skeleton } from '../../ui/skeleton';

interface EmotionalPatternWidgetProps {
  userId: string;
}

interface EmotionalPattern {
  predominant: string;
  recentShift: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface ConversationMemory {
  emotionalPatterns?: {
    predominant?: string;
    recentShift?: string;
  };
  sentimentDistribution?: {
    positive?: number;
    neutral?: number;
    negative?: number;
  };
}

const MOOD_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  positive: {
    label: 'Positive',
    icon: <Smile className="h-4 w-4" />,
    color: 'text-green-600'
  },
  neutral: {
    label: 'Neutral',
    icon: <Meh className="h-4 w-4" />,
    color: 'text-yellow-600'
  },
  negative: {
    label: 'Negative',
    icon: <Frown className="h-4 w-4" />,
    color: 'text-red-600'
  }
};

const PREDOMINANT_MOODS: Record<string, { label: string; color: string }> = {
  anxious: { label: 'Anxious', color: 'text-orange-600' },
  stressed: { label: 'Stressed', color: 'text-red-600' },
  calm: { label: 'Calm', color: 'text-blue-600' },
  hopeful: { label: 'Hopeful', color: 'text-green-600' },
  sad: { label: 'Sad', color: 'text-purple-600' },
  content: { label: 'Content', color: 'text-teal-600' },
  overwhelmed: { label: 'Overwhelmed', color: 'text-red-700' },
  stable: { label: 'Stable', color: 'text-emerald-600' },
  uncertain: { label: 'Uncertain', color: 'text-gray-600' },
  motivated: { label: 'Motivated', color: 'text-indigo-600' }
};

const SHIFT_ICONS: Record<string, React.ReactNode> = {
  improving: <TrendingUp className="h-4 w-4 text-green-600" />,
  declining: <TrendingDown className="h-4 w-4 text-red-600" />,
  stable: <Minus className="h-4 w-4 text-blue-600" />,
  fluctuating: <Minus className="h-4 w-4 text-yellow-600 animate-pulse" />
};

export const EmotionalPatternWidget: React.FC<EmotionalPatternWidgetProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useState<EmotionalPattern | null>(null);

  useEffect(() => {
    const fetchEmotionalPattern = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`${getApiBaseUrl()}/chat/memory/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch emotional patterns');
        }

        const result = await response.json();
        const memory: ConversationMemory = result.data;

        // Extract emotional pattern data
        const emotionalPattern: EmotionalPattern = {
          predominant: memory.emotionalPatterns?.predominant || 'stable',
          recentShift: memory.emotionalPatterns?.recentShift || 'stable',
          positive: memory.sentimentDistribution?.positive || 0,
          neutral: memory.sentimentDistribution?.neutral || 0,
          negative: memory.sentimentDistribution?.negative || 0
        };

        setPattern(emotionalPattern);
      } catch (err) {
        console.error('Error fetching emotional patterns:', err);
        setError(err instanceof Error ? err.message : 'Failed to load emotional patterns');
      } finally {
        setLoading(false);
      }
    };

    fetchEmotionalPattern();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Unable to Load Emotional Patterns</CardTitle>
          <CardDescription className="text-red-700">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!pattern) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Emotional Patterns
          </CardTitle>
          <CardDescription>
            Start chatting with the AI to see your emotional patterns
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const total = pattern.positive + pattern.neutral + pattern.negative;
  const hasData = total > 0;

  const positivePercent = hasData ? Math.round((pattern.positive / total) * 100) : 0;
  const neutralPercent = hasData ? Math.round((pattern.neutral / total) * 100) : 0;
  const negativePercent = hasData ? Math.round((pattern.negative / total) * 100) : 0;

  const predominantMood = PREDOMINANT_MOODS[pattern.predominant] || { 
    label: pattern.predominant, 
    color: 'text-gray-600' 
  };
  
  const shiftIcon = SHIFT_ICONS[pattern.recentShift] || SHIFT_ICONS.stable;

  return (
    <Card className="shadow-md border border-slate-100 hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-b">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Smile className="h-5 w-5 text-emerald-600 animate-bounce" style={{ animationDuration: '3s' }} />
          Emotional Patterns
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Your emotional tone in recent conversations
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {/* Sentiment Distribution */}
        {hasData ? (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sentiment Distribution</h4>
            
            {/* Positive Sentiment */}
            <div className="space-y-1 hover:translate-x-1 transition-transform duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-green-50">{MOOD_LABELS.positive.icon}</div>
                  <span className={`text-xs font-medium ${MOOD_LABELS.positive.color}`}>
                    {MOOD_LABELS.positive.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {positivePercent}%
                </span>
              </div>
              <Progress 
                value={positivePercent} 
                className="h-2 bg-green-50"
                indicatorClassName="bg-green-500"
              />
            </div>

            {/* Neutral Sentiment */}
            <div className="space-y-1 hover:translate-x-1 transition-transform duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-yellow-50">{MOOD_LABELS.neutral.icon}</div>
                  <span className={`text-xs font-medium ${MOOD_LABELS.neutral.color}`}>
                    {MOOD_LABELS.neutral.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {neutralPercent}%
                </span>
              </div>
              <Progress 
                value={neutralPercent} 
                className="h-2 bg-yellow-50"
                indicatorClassName="bg-yellow-500"
              />
            </div>

            {/* Negative Sentiment */}
            <div className="space-y-1 hover:translate-x-1 transition-transform duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-red-50">{MOOD_LABELS.negative.icon}</div>
                  <span className={`text-xs font-medium ${MOOD_LABELS.negative.color}`}>
                    {MOOD_LABELS.negative.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {negativePercent}%
                </span>
              </div>
              <Progress 
                value={negativePercent} 
                className="h-2 bg-red-50"
                indicatorClassName="bg-red-500"
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <Smile className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">No sentiment data available yet</p>
          </div>
        )}

        {/* Predominant Mood & Recent Shift */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div className="space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/50 transition-colors text-left">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Predominant Mood</p>
            <p className={`text-sm font-bold ${predominantMood.color}`}>
              {predominantMood.label}
            </p>
          </div>
          <div className="space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/50 transition-colors text-left">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Recent Shift</p>
            <div className="flex items-center gap-1.5">
              {shiftIcon}
              <p className="text-sm font-bold text-slate-700 capitalize">
                {pattern.recentShift}
              </p>
            </div>
          </div>
        </div>

        {/* Insight Message */}
        {hasData && (
          <div className="bg-sky-50/50 border border-sky-100 rounded-lg p-3 mt-3 text-left">
            <p className="text-xs text-sky-800 font-medium leading-relaxed">
              {positivePercent >= 50 ? (
                <span>💙 You&apos;re expressing mostly positive emotions. Keep nurturing what&apos;s working!</span>
              ) : negativePercent >= 50 ? (
                <span>🌟 You&apos;re navigating challenging emotions. Consider trying a mindfulness exercise.</span>
              ) : (
                <span>⚖️ Your emotional tone is balanced. Keep checking in with yourself regularly.</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
