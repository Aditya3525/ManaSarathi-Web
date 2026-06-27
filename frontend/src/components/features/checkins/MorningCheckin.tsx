import { Sunrise } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { checkinsApi } from '../../../services/api';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Slider } from '../../ui/slider';

interface MorningCheckinProps {
  onComplete?: () => void;
}

const energyLabel = (value: number): string => {
  if (value <= 1) return 'Very low';
  if (value === 2) return 'Low';
  if (value === 3) return 'Steady';
  if (value === 4) return 'Good';
  return 'High';
};

const energyEmoji = (value: number): string => {
  if (value <= 1) return '😴';
  if (value === 2) return '😕';
  if (value === 3) return '🙂';
  if (value === 4) return '😊';
  return '⚡';
};

export function MorningCheckin({ onComplete }: MorningCheckinProps) {
  const [energyLevel, setEnergyLevel] = useState(3);
  const [dreading, setDreading] = useState('');
  const [lookingForward, setLookingForward] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 9) return 'Good morning';
    if (hour < 12) return 'Morning check-in';
    return 'Midday reset';
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await checkinsApi.createCheckin({
        type: 'morning',
        responses: {
          energyLevel,
          dreading: dreading.trim() || undefined,
          lookingForward: lookingForward.trim() || undefined
        }
      });

      if (!response.success) {
        setError(response.error || 'Unable to save your check-in right now.');
        return;
      }

      setDreading('');
      setLookingForward('');
      onComplete?.();
    } catch (submitError) {
      console.error('Morning check-in failed:', submitError);
      setError('Unable to save your check-in right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-orange-50/30 to-sky-50/50 dark:bg-card dark:border-border dark:bg-none shadow-[var(--shadow-soft)] page-enter">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Sunrise className="h-5 w-5 text-amber-500" />
          {greeting}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Start your day with one honest pulse-check.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Energy level</span>
            <span className="text-muted-foreground">
              {energyEmoji(energyLevel)} {energyLabel(energyLevel)} ({energyLevel}/5)
            </span>
          </div>
          <Slider
            min={1}
            max={5}
            step={1}
            value={[energyLevel]}
            onValueChange={(value) => setEnergyLevel(value[0] ?? 3)}
            aria-label="Morning energy level"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="morning-dreading">
            What are you dreading today? (optional)
          </label>
          <Input
            id="morning-dreading"
            value={dreading}
            onChange={(event) => setDreading(event.target.value)}
            placeholder="One thing weighing on your mind"
            maxLength={180}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="morning-looking-forward">
            What are you looking forward to? (optional)
          </label>
          <Input
            id="morning-looking-forward"
            value={lookingForward}
            onChange={(event) => setLookingForward(event.target.value)}
            placeholder="A small moment you want to notice"
            maxLength={180}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full md:w-auto"
        >
          {isSubmitting ? 'Saving...' : 'Save morning check-in'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default MorningCheckin;
