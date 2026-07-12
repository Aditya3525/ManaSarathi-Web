import { Heart, MessageCircle, Sparkles, TrendingUp } from 'lucide-react';
import React from 'react';

import { Button } from '../../ui/button';

interface EmptyStateProps {
  onStarterClick?: (starter: string) => void;
  starters?: string[];
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onStarterClick,
  starters = [
    "I'm feeling anxious today",
    "Help me relax with a breathing exercise",
    "I want to improve my mood",
    "I'm having trouble sleeping"
  ]
}) => {
  const starterIcons = ['💭', '🧘', '✨', '🌙'];

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-12 sm:py-16 max-w-3xl mx-auto">
      {/* Animated Glowing Lotus Illustration */}
      <div className="relative mb-8 h-28 w-28 sm:h-32 sm:w-32 flex items-center justify-center">
        {/* Glowing pulsing background halo */}
        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-tr from-teal-400/20 via-emerald-400/20 to-indigo-500/20 blur-xl scale-125" style={{ animationDuration: '4s' }} />
        
        {/* Soft rotating dashed ring */}
        <div className="absolute inset-2 border border-dashed border-teal-500/20 rounded-full animate-spin" style={{ animationDuration: '24s' }} />
        
        {/* Central Lotus Container */}
        <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-white dark:bg-slate-900 shadow-md border border-teal-500/10 hover:scale-105 transition-transform duration-300">
          <span className="text-3xl leading-none select-none filter drop-shadow animate-breathe" role="img" aria-label="Lotus logo">🪷</span>
        </div>
        
        {/* Floating Sparkles */}
        <span className="absolute top-2 right-2 text-sm animate-pulse" style={{ animationDelay: '0.5s' }}>✨</span>
        <span className="absolute bottom-4 left-1 text-sm animate-pulse" style={{ animationDelay: '1.2s' }}>🌸</span>
        <span className="absolute top-6 left-3 text-xs opacity-60">💭</span>
      </div>

      {/* Welcome Message */}
      <div className="mb-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 mb-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text">
          Welcome to ManaSarathi
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
          I'm here whenever you want to talk. No pressure, no judgment — just a space to be yourself.
        </p>
      </div>

      {/* Starter Cards */}
      <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2">
        {starters.map((starter, index) => {
          const icon = starterIcons[index % starterIcons.length];
          return (
            <Button
              key={index}
              variant="outline"
              className="h-auto py-4 px-5 text-left justify-start hover:bg-teal-500/5 hover:border-teal-500/40 hover:text-teal-950 dark:hover:text-teal-200 transition-all duration-200 group border-border/60 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01]"
              onClick={() => onStarterClick && onStarterClick(starter)}
            >
              <div className="flex w-full items-center gap-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border border-teal-500/10 group-hover:from-teal-500/10 group-hover:to-emerald-500/10 group-hover:border-teal-500/20 transition-all duration-200">
                  <span className="text-lg leading-none">{icon}</span>
                </div>
                <div className="flex-1 break-words text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                  {starter}
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground/80 mt-8 text-center max-w-sm">
        💡 Tip: Select a suggestion card above or type anything to begin.
      </p>
    </div>
  );
};

export default EmptyState;
