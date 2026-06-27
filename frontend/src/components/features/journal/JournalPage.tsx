import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, PenSquare, Sparkles, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { journalApi } from '../../../services/api';
import type { StoredUser } from '../../../services/auth';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Textarea } from '../../ui/textarea';
import { StaggerContainer, StaggerItem } from '../../ui/motion-wrapper';

import { JournalInsight } from './JournalInsight';
import { WritingPrompt } from './WritingPrompt';

interface JournalPageProps {
  user: StoredUser | null;
  onNavigate: (page: string) => void;
}

const moodOptions = ['Great', 'Good', 'Okay', 'Struggling', 'Anxious'];

const computeStreak = (entryDates: string[]): number => {
  const uniqueDates = new Set(
    entryDates.map((value) => {
      const date = new Date(value);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    })
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= uniqueDates.size; offset += 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    if (!uniqueDates.has(current.toISOString())) {
      break;
    }
    streak += 1;
  }

  return streak;
};

export function JournalPage({ user, onNavigate }: JournalPageProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string>('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const promptQuery = useQuery({
    queryKey: ['journal', 'prompt'],
    queryFn: () => journalApi.getPrompt(),
    staleTime: 5 * 60 * 1000,
  });

  const entriesQuery = useQuery({
    queryKey: ['journal', 'entries'],
    queryFn: () => journalApi.getEntries(30),
    staleTime: 60 * 1000,
  });

  const reflectionQuery = useQuery({
    queryKey: ['journal', 'reflection'],
    queryFn: () => journalApi.getReflection(),
    staleTime: 10 * 60 * 1000,
  });

  const saveEntry = useMutation({
    mutationFn: () =>
      journalApi.createEntry({
        prompt: promptQuery.data?.success ? promptQuery.data.data?.prompt : undefined,
        content: content.trim(),
        mood: mood || undefined,
      }),
    onSuccess: async () => {
      setContent('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] }),
        queryClient.invalidateQueries({ queryKey: ['journal', 'reflection'] }),
      ]);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => journalApi.deleteEntry(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] }),
        queryClient.invalidateQueries({ queryKey: ['journal', 'reflection'] }),
      ]);
    },
  });

  const entries = useMemo(
    () => (entriesQuery.data?.success ? (entriesQuery.data.data?.entries ?? []) : []),
    [entriesQuery.data]
  );
  const streak = useMemo(() => computeStreak(entries.map((entry) => entry.createdAt)), [entries]);

  const activePrompt = promptQuery.data?.success
    ? promptQuery.data.data?.prompt
    : 'Write about one moment from today that stayed with you. What did you notice in your thoughts and body?';

  const reflection = reflectionQuery.data?.success ? reflectionQuery.data.data : null;

  return (
    <div className="min-h-screen bg-background page-enter">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">Your Journal</h1>
              <p className="text-sm text-muted-foreground truncate">
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'You'} • {streak}-day reflection streak
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {entries.length} entries this month
          </Badge>
        </div>

        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Today&apos;s Prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed">{activePrompt}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!content.trim()) {
                  setContent(`${activePrompt}\n\n`);
                }
              }}
            >
              Start writing with prompt
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PenSquare className="h-4 w-4" />
              Write
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <WritingPrompt
              onUsePrompt={(prompt) => {
                setContent((prev) => (prev ? prev : `${prompt}\n\n`));
              }}
            />

            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write freely. This space is for honest reflection, not perfect wording."
              className="min-h-[220px]"
              maxLength={8000}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{content.length} / 8000 characters</span>
              <span>{content.trim().length < 30 ? 'Try writing at least 30 characters.' : 'Ready to save.'}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {moodOptions.map((option) => (
                <Button
                  key={option}
                  variant={mood === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMood(option)}
                >
                  {option}
                </Button>
              ))}
            </div>

            {saveEntry.isError && (
              <p className="text-sm text-red-600">Unable to save your journal entry right now.</p>
            )}

            <Button
              onClick={() => saveEntry.mutate()}
              disabled={saveEntry.isPending || content.trim().length < 30}
            >
              {saveEntry.isPending ? 'Saving...' : 'Save entry'}
            </Button>
          </CardContent>
        </Card>

        {reflection && (
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50/70 via-background to-orange-50/60">
            <CardHeader>
              <CardTitle className="text-base">Weekly Reflection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{reflection.aiSummary}</p>
              {Array.isArray(reflection.patterns?.recurringThemes) && reflection.patterns.recurringThemes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reflection.patterns.recurringThemes.slice(0, 5).map((theme) => (
                    <Badge key={theme} variant="outline">
                      {theme}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground">No entries yet. Start with a short reflection above.</p>
            )}

            <StaggerContainer staggerDelay={0.1}>
              {entries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                const preview = entry.content.length > 220 ? `${entry.content.slice(0, 220)}...` : entry.content;
                const tags = Array.isArray(entry.tags) ? entry.tags : [];

                return (
                  <StaggerItem key={entry.id}>
                    <div className="rounded-lg border border-border/70 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                          {entry.prompt && <p className="text-xs text-primary">Prompt: {entry.prompt}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.mood && <Badge variant="secondary">{entry.mood}</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEntry.mutate(entry.id)}
                            disabled={deleteEntry.isPending}
                            aria-label="Delete journal entry"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {isExpanded ? entry.content : preview}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {tags.slice(0, 6).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {entry.content.length > 220 && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </CardContent>
        </Card>

        <JournalInsight
          insight="You tend to reflect more deeply on weekends. Your recent entries show increasing self-compassion language."
          entryCount={entries.length}
        />
      </div>
    </div>
  );
}

export default JournalPage;
