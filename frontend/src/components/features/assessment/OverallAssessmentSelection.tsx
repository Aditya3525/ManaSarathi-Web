import { CheckCircle2, Clock, Layers, ListChecks } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '../../ui/utils';

export interface OverallAssessmentOption {
  id: string;
  title: string;
  description: string;
  questions: number;
  estimatedTime: string;
  icon?: React.ReactNode;
}

interface OverallAssessmentSelectionProps {
  onSubmit: (selected: string[]) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  defaultSelected?: string[];
  errorMessage?: string | null;
  options?: OverallAssessmentOption[];
}

const OPTIONS: OverallAssessmentOption[] = [
  {
    id: 'anxiety_gad2',
    title: 'Anxiety (GAD-2)',
    description: 'Two quick check-in questions about recent anxious feelings.',
    questions: 2,
    estimatedTime: '2 minutes'
  },
  {
    id: 'depression_phq2',
    title: 'Depression (PHQ-2)',
    description: 'Notice mood shifts and energy with this brief screener.',
    questions: 2,
    estimatedTime: '2 minutes'
  },
  {
    id: 'stress_pss4',
    title: 'Stress (PSS-4)',
    description: 'Gauge how overwhelmed or in-control life has felt lately.',
    questions: 4,
    estimatedTime: '3 minutes'
  },
  {
    id: 'overthinking_rrs4',
    title: 'Overthinking (RRS-4)',
    description: 'Spot rumination loops and looping thought patterns.',
    questions: 4,
    estimatedTime: '3 minutes'
  },
  {
    id: 'trauma_pcptsd5',
    title: 'Trauma & Fear (PC-PTSD-5)',
    description: 'A gentle opt-in check around trauma reminders and safety.',
    questions: 5,
    estimatedTime: '3 minutes'
  },
  {
    id: 'emotional_intelligence_eq5',
    title: 'Emotional Intelligence (EQ-5)',
    description: 'Understand emotional awareness and regulation strengths.',
    questions: 5,
    estimatedTime: '4 minutes'
  },
  {
    id: 'personality_bigfive10',
    title: 'Personality (Big Five)',
    description: 'A quick look at five core personality traits and energies.',
    questions: 5,
    estimatedTime: '4 minutes'
  }
];

export const OVERALL_ASSESSMENT_OPTION_IDS = OPTIONS.map((option) => option.id);

export function OverallAssessmentSelection({ onSubmit, onCancel, isSubmitting, defaultSelected, errorMessage, options = OPTIONS }: OverallAssessmentSelectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  useEffect(() => {
    if (defaultSelected && defaultSelected.length) {
      setSelected(new Set(defaultSelected));
      return;
    }
    if (!defaultSelected || defaultSelected.length === 0) {
      setSelected(new Set());
    }
  }, [defaultSelected]);

  const totalMinutes = useMemo(() => {
    return options.filter((option) => selected.has(option.id)).reduce((minutes, option) => {
      const match = option.estimatedTime.match(/(\d+)/);
      if (match) {
        return minutes + Number(match[1]);
      }
      return minutes + 2;
    }, 0);
  }, [selected, options]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(options.map((option) => option.id)) : new Set());
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!selected.size || isSubmitting) return;
    onSubmit(Array.from(selected));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <ListChecks className="h-6 w-6" />
            <h1 className="text-3xl font-semibold">Build your first wellbeing snapshot</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Choose any quick check-ins you’d like to complete right now. You can always come back later to explore more detailed assessments.
          </p>

          {errorMessage && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 inline-flex items-center gap-2">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Checkbox
                id="toggle-all"
                checked={selected.size === options.length}
                onCheckedChange={(value) => toggleAll(Boolean(value))}
              />
              <label htmlFor="toggle-all" className="cursor-pointer select-none">
                Select all
              </label>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>{selected.size} of {options.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Approx. {totalMinutes || 2} minutes</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => {
            const isChecked = selected.has(option.id);
            return (
              <Card
                key={option.id}
                className={cn(
                  'transition-all cursor-pointer hover:shadow-lg border-2 h-full',
                  isChecked 
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                    : 'border-muted hover:border-primary/30'
                )}
                onClick={() => toggle(option.id)}
              >
                <CardHeader className="space-y-3 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">{option.title}</CardTitle>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggle(option.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${option.title}`}
                      className="h-5 w-5 flex-shrink-0"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {option.description}
                  </p>
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{option.estimatedTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" />
                      <span>{option.questions} Qs</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="border-t bg-gradient-to-r from-muted/50 to-muted/30 sticky bottom-0 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row md:flex-wrap gap-4 md:items-center md:justify-between">
          <Button 
            variant="outline" 
            onClick={onCancel} 
            className="w-full md:w-auto px-6 h-11"
          >
            Skip for now
          </Button>
          <Button
            size="lg"
            className="w-full md:w-auto px-8 h-11 text-base font-semibold"
            onClick={handleSubmit}
            disabled={!selected.size || Boolean(isSubmitting)}
          >
            {isSubmitting ? 'Preparing assessment...' : `Start ${selected.size} assessment${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
