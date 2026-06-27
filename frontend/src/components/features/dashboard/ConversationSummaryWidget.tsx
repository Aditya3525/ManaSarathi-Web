import { MessageSquare, TrendingUp, TrendingDown, Minus, Calendar, Target, Activity } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { getApiBaseUrl } from '../../../config/apiConfig';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';

interface ConversationSummaryWidgetProps {
  userId: string;
}

interface ConversationSummary {
  totalMessages: number;
  topTopics: string[];
  emotionalTrend: 'improving' | 'stable' | 'declining';
  engagementLevel: 'high' | 'medium' | 'low';
  keyInsights: string[];
  period?: string;
}

type TimePeriod = 7 | 30;

const TOPIC_LABELS: Record<string, string> = {
  anxiety: '😰 Anxiety',
  depression: '💙 Depression',
  stress: '😤 Stress',
  work: '💼 Work',
  relationships: '💑 Relationships',
  family: '👨‍👩‍👧‍👦 Family',
  sleep: '😴 Sleep',
  health: '💪 Health',
  goals: '🎯 Goals',
  daily_life: '🏠 Daily Life',
  education: '🎓 Education',
  financial: '💰 Financial',
  hobbies: '🎨 Hobbies',
  self_care: '🧘 Self Care',
  social: '📱 Social',
  other: '❓ Other'
};

const ENGAGEMENT_COLORS = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200'
};

const ENGAGEMENT_LABELS = {
  high: '🔥 Highly Active',
  medium: '⚡ Moderately Active',
  low: '💤 Light Activity'
};

export const ConversationSummaryWidget: React.FC<ConversationSummaryWidgetProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [period, setPeriod] = useState<TimePeriod>(7);

  const fetchSummary = useCallback(async (days: TimePeriod) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${getApiBaseUrl()}/chat/summary/${userId}?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation summary');
      }

      const result = await response.json();
      setSummary(result.data);
    } catch (err) {
      console.error('Error fetching conversation summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSummary(period);
  }, [fetchSummary, period]);

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Unable to Load Summary</CardTitle>
          <CardDescription className="text-red-700">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!summary || summary.totalMessages === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation Summary
          </CardTitle>
          <CardDescription>
            Start chatting with the AI to see your conversation summary
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const trendIcon = 
    summary.emotionalTrend === 'improving' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
    summary.emotionalTrend === 'declining' ? <TrendingDown className="h-4 w-4 text-red-600" /> :
    <Minus className="h-4 w-4 text-blue-600" />;

  const trendColor = 
    summary.emotionalTrend === 'improving' ? 'text-green-600' :
    summary.emotionalTrend === 'declining' ? 'text-red-600' :
    'text-blue-600';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation Summary
            </CardTitle>
            <CardDescription>
              Your AI chat activity overview
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={period === 7 ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange(7)}
              className="text-xs"
            >
              7 Days
            </Button>
            <Button
              variant={period === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange(30)}
              className="text-xs"
            >
              30 Days
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Messages Sent */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gray-500">
              <MessageSquare className="h-4 w-4" />
              <p className="text-xs font-medium">Messages</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.totalMessages}</p>
          </div>

          {/* Emotional Trend */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gray-500">
              <Activity className="h-4 w-4" />
              <p className="text-xs font-medium">Mood Trend</p>
            </div>
            <div className="flex items-center gap-2">
              {trendIcon}
              <p className={`text-xl font-bold capitalize ${trendColor}`}>
                {summary.emotionalTrend}
              </p>
            </div>
          </div>

          {/* Engagement Level */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gray-500">
              <Target className="h-4 w-4" />
              <p className="text-xs font-medium">Engagement</p>
            </div>
            <Badge 
              variant="outline" 
              className={`${ENGAGEMENT_COLORS[summary.engagementLevel]} text-xs font-semibold mt-1`}
            >
              {ENGAGEMENT_LABELS[summary.engagementLevel]}
            </Badge>
          </div>
        </div>

        {/* Top Topics */}
        {summary.topTopics && summary.topTopics.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4" />
              <h4 className="text-sm font-semibold">Top Discussion Topics</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.topTopics.slice(0, 3).map((topic, index) => {
                const safeTopic = topic ?? 'general';
                const topicLabel = TOPIC_LABELS[safeTopic] || safeTopic;

                return (
                <Badge 
                  key={`${safeTopic}-${index}`}
                  variant="secondary"
                  className="text-xs"
                >
                  <span className="mr-1">#{index + 1}</span>
                  {topicLabel}
                </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Key Insights */}
        {summary.keyInsights && summary.keyInsights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Key Insights</h4>
            <ul className="space-y-1">
              {summary.keyInsights.map((insight, index) => (
                <li 
                  key={index}
                  className="text-sm text-gray-600 flex items-start gap-2"
                >
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Important Moments */}
        {(summary as any).importantMoments && (summary as any).importantMoments.length > 0 && (
          <div className="space-y-2 pt-2 border-t text-left">
            <h4 className="text-sm font-semibold text-gray-700">Key Milestones & Breakthroughs</h4>
            <div className="space-y-2">
              {(summary as any).importantMoments.slice(0, 3).map((moment: any, index: number) => {
                const dateStr = new Date(moment.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                });
                
                const impactColors = {
                  high: 'bg-red-50 text-red-700 border-red-200',
                  medium: 'bg-orange-50 text-orange-700 border-orange-200',
                  low: 'bg-blue-50 text-blue-700 border-blue-200'
                };
                
                const impactColor = impactColors[moment.emotionalImpact as 'high' | 'medium' | 'low'] || impactColors.low;

                return (
                  <div key={moment.id || index} className="p-2.5 bg-slate-50 border rounded-lg space-y-1 hover:bg-slate-100/80 transition-colors">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">{moment.topic}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">{dateStr}</span>
                        <span className={`px-1 py-0.2 border rounded text-[9px] font-bold uppercase tracking-wider ${impactColor}`}>
                          {moment.emotionalImpact}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">
                      {moment.summary}
                    </p>
                    {moment.userMessage && (
                      <p className="text-[10px] text-slate-400 truncate">
                        &ldquo;{moment.userMessage}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Period Label */}
        <div className="pt-2 border-t text-xs text-gray-500 text-center">
          Last {period} days • Updated continuously
        </div>
      </CardContent>
    </Card>
  );
};
