import { Moon } from 'lucide-react';
import React, { useState } from 'react';

import { checkinsApi } from '../../../services/api';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Slider } from '../../ui/slider';

interface EveningCheckinProps {
  onComplete?: () => void;
}

const dayLabel = (value: number): string => {
  if (value <= 1) return 'Tough day';
  if (value === 2) return 'Below average';
  if (value === 3) return 'Okay';
  if (value === 4) return 'Good day';
  return 'Great day';
};

const dayEmoji = (value: number): string => {
  if (value <= 1) return '😔';
  if (value === 2) return '😕';
  if (value === 3) return '🙂';
  if (value === 4) return '😊';
  return '🌟';
};

export function EveningCheckin({ onComplete }: EveningCheckinProps) {
  const [overallDay, setOverallDay] = useState(3);
  const [wentWell, setWentWell] = useState('');
  const [energyCompared, setEnergyCompared] = useState('');
  const [grateful, setGrateful] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    const wentWellValue = wentWell.trim() || undefined;
    const energyComparedValue = energyCompared.trim() || undefined;
    const gratefulValue = grateful.trim() || undefined;

    try {
      const response = await checkinsApi.createCheckin({
        type: 'evening',
        responses: {
          dayRating: overallDay,
          smallWin: wentWellValue,
          overallDay,
          wentWell: wentWellValue,
          energyCompared: energyComparedValue,
          grateful: gratefulValue,
        },
      });

      if (!response.success) {
        setError(response.error || 'Unable to save your check-in right now.');
        return;
      }

      setWentWell('');
      setEnergyCompared('');
      setGrateful('');
      onComplete?.();
    } catch (submitError) {
      console.error('Evening check-in failed:', submitError);
      setError('Unable to save your check-in right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-violet-50/30 to-background dark:bg-card dark:border-border dark:bg-none shadow-[var(--shadow-soft)] page-enter">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Moon className="h-5 w-5 text-indigo-500" />
          Evening Reflection
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Close your day with a moment of reflection.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">How was your day overall?</span>
            <span className="text-muted-foreground">
              {dayEmoji(overallDay)} {dayLabel(overallDay)} ({overallDay}/5)
            </span>
          </div>
          <Slider
            min={1}
            max={5}
            step={1}
            value={[overallDay]}
            onValueChange={(value) => setOverallDay(value[0] ?? 3)}
            aria-label="Overall day rating"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="evening-went-well">
            What went well today? (optional)
          </label>
          <Input
            id="evening-went-well"
            value={wentWell}
            onChange={(event) => setWentWell(event.target.value)}
            placeholder="A moment that made you smile"
            maxLength={180}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="evening-energy-compare">
            How did your energy compare to this morning? (optional)
          </label>
          <Input
            id="evening-energy-compare"
            value={energyCompared}
            onChange={(event) => setEnergyCompared(event.target.value)}
            placeholder="Higher, lower, or about the same"
            maxLength={180}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="evening-grateful">
            What are you grateful for? (optional)
          </label>
          <Input
            id="evening-grateful"
            value={grateful}
            onChange={(event) => setGrateful(event.target.value)}
            placeholder="Something small or big"
            maxLength={180}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto">
          {isSubmitting ? 'Saving...' : 'Save evening reflection'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default EveningCheckin;