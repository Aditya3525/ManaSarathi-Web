import { RefreshCw, Sparkles, TrendingUp, MessageCircle, Brain, Clock, Database } from 'lucide-react';
import React from 'react';

import { useDevice } from '../../../hooks/use-device';
import { useInsights, useRefreshInsights } from '../../../hooks/useDashboardData';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';

interface EnhancedInsightsCardProps {
  onNavigate?: (page: string) => void;
  isFullWidth?: boolean;
}

export function EnhancedInsightsCard({ onNavigate, isFullWidth = false }: EnhancedInsightsCardProps) {
  const device = useDevice();
  const { data: insights, isLoading, error } = useInsights();
  const refreshInsights = useRefreshInsights();

  const handleRefresh = async () => {
    try {
      await refreshInsights.mutateAsync();
    } catch (error) {
      console.error('Failed to refresh insights:', error);
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Unable to load insights. Please try refreshing.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshInsights.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshInsights.isPending ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEnhancedData = insights?.assessments || insights?.chatbot;
  const isCombined = insights?.source === 'combined';
  const isCached = insights?.cached !== false;
  const showSplitLayout = isFullWidth && !device.isMobile && (insights?.aiSummary || insights?.wellnessScore);

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Data Source Badge */}
            {hasEnhancedData && (
              <Badge variant={isCombined ? "default" : "secondary"} className="text-xs">
                {isCombined ? (
                  <><Database className="h-3 w-3 mr-1" />Combined</>
                ) : (
                  <>Assessments only</>
                )}
              </Badge>
            )}

            {/* Refresh Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshInsights.isPending}
              className={device.isMobile ? "h-8 w-8 p-0" : "h-8"}
              title="Refresh insights"
            >
              <RefreshCw className={`h-4 w-4 ${refreshInsights.isPending ? 'animate-spin' : ''} ${device.isMobile ? '' : 'mr-2'}`} />
              {!device.isMobile && 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Last Updated */}
        {insights?.generatedAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Clock className="h-3 w-3" />
            <span>
              {isCached ? 'Last updated' : 'Generated'} {formatDate(insights.generatedAt)}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className={showSplitLayout ? "grid grid-cols-1 lg:grid-cols-5 gap-6" : "space-y-4"}>
        {/* Left Column: AI Summary or Empty State */}
        <div className={showSplitLayout ? "lg:col-span-3 space-y-4 flex flex-col justify-between" : "space-y-4"}>
          {/* AI Summary */}
          {insights?.aiSummary && (
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div style={{ maxHeight: '115px', overflowY: 'auto' }} className="pr-2">
                    <p className="text-sm leading-relaxed">{insights.aiSummary}</p>
                  </div>
                  {insights.overallTrend && (
                    <div className="flex items-center gap-2 text-xs pt-1">
                      <TrendingUp className={`h-3 w-3 ${insights.overallTrend === 'improving' ? 'text-green-600' :
                          insights.overallTrend === 'declining' ? 'text-red-600' :
                            'text-yellow-600'
                        }`} />
                      <span className="font-medium capitalize">{insights.overallTrend}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!insights?.aiSummary && !hasEnhancedData && (
            <div className="text-center space-y-3 py-6">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <p className="text-sm font-medium">No insights yet</p>
                <p className="text-xs text-muted-foreground">
                  Complete an assessment or chat with our AI to receive personalized insights
                </p>
              </div>
              <div className={device.isMobile ? "flex flex-col gap-2" : "flex gap-2 justify-center"}>
                <Button
                  size="sm"
                  onClick={() => onNavigate?.('assessments')}
                  className={device.isMobile ? "w-full min-h-[44px]" : ""}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Take Assessment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate?.('chatbot')}
                  className={device.isMobile ? "w-full min-h-[44px]" : ""}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Start Chat
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Wellness Score & Action Prompts */}
        {(insights?.wellnessScore || (hasEnhancedData && onNavigate)) && (
          <div className={showSplitLayout ? "lg:col-span-2 space-y-4 flex flex-col justify-between" : "space-y-4"}>
            {/* Wellness Score */}
            {insights?.wellnessScore && (
              <div className={showSplitLayout ? "bg-muted/20 border rounded-lg p-4 flex-1 flex flex-col justify-center" : "border-t pt-4"}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Wellness Score</span>
                  <span className="text-2xl font-bold text-primary">
                    {Math.round(insights.wellnessScore.value)}%
                  </span>
                </div>
                <Progress value={insights.wellnessScore.value} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  Calculated using {insights.wellnessScore.method}
                </p>
              </div>
            )}

            {/* Action Prompts */}
            {hasEnhancedData && onNavigate && (
              <div className={showSplitLayout ? "flex gap-2 pt-2" : "flex gap-2 pt-2 border-t"}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigate('progress')}
                  className={device.isMobile ? "flex-1 min-h-[44px]" : "flex-1 border"}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Progress
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigate('chatbot')}
                  className={device.isMobile ? "flex-1 min-h-[44px]" : "flex-1 border"}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat Now
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
