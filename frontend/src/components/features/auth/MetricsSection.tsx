import { BarChart3, CalendarCheck, Shield, Smile, TrendingUp } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { useDevice } from '../../../hooks/use-device';
import { Card, CardContent } from '../../ui/card';

interface Metric {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  helper: string;
  accent: string;
  bgAccent: string;
}

const METRICS: Metric[] = [
  {
    icon: Smile,
    value: '92%',
    label: 'Feel calmer in 2 weeks',
    helper: 'Based on post-program self-reports',
    accent: 'text-emerald-600',
    bgAccent: 'bg-emerald-500/10 group-hover:bg-emerald-500/20'
  },
  {
    icon: BarChart3,
    value: '4.8/5',
    label: 'Average member rating',
    helper: 'Across 5k+ coaching sessions',
    accent: 'text-blue-600',
    bgAccent: 'bg-blue-500/10 group-hover:bg-blue-500/20'
  },
  {
    icon: CalendarCheck,
    value: '3x',
    label: 'Faster habit formation',
    helper: 'When pairing practices with AI nudges',
    accent: 'text-violet-600',
    bgAccent: 'bg-violet-500/10 group-hover:bg-violet-500/20'
  },
  {
    icon: Shield,
    value: '100%',
    label: 'HIPAA-ready infrastructure',
    helper: 'Built with privacy and compliance first',
    accent: 'text-amber-600',
    bgAccent: 'bg-amber-500/10 group-hover:bg-amber-500/20'
  }
];

export function MetricsSection() {
  const device = useDevice();
  const [activeMetricIndex, setActiveMetricIndex] = useState(0);
  const metricsContainerRef = useRef<HTMLDivElement>(null);

  // Metrics carousel intersection observer
  useEffect(() => {
    const container = metricsContainerRef.current;
    if (!container || !device.isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Array.from(container.children).indexOf(entry.target);
            if (index !== -1) setActiveMetricIndex(index);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    Array.from(container.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [device.isMobile]);

  return (
    <section className="relative overflow-hidden border-y border-border/40 bg-gradient-to-b from-muted/20 via-background to-muted/20 px-4 py-20 sm:px-6 md:py-24" id="metrics">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
            Proven Results
          </div>
          <h2 className="text-2xl font-light text-foreground sm:text-3xl lg:text-4xl">
            Trusted by <span className="font-serif italic text-primary">thousands</span> on their wellness journey
          </h2>
        </div>

        {/* Mobile: Swipeable Carousel */}
        <div className="md:hidden">
          <div
            ref={metricsContainerRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="region"
            aria-label="Impact metrics carousel"
          >
            {METRICS.map(({ icon: Icon, value, label, helper, accent, bgAccent }, index) => (
              <Card
                key={label}
                className="group min-w-[80vw] flex-shrink-0 snap-center rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/25"
                role="group"
                aria-roledescription="slide"
                aria-label={`Metric ${index + 1} of ${METRICS.length}: ${label}`}
              >
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <span className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${bgAccent} ${accent} transition-all duration-300`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className={`text-4xl font-semibold tracking-tight ${accent}`}>{value}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-foreground">{label}</p>
                  <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">{helper}</p>
                </CardContent>
              </Card>
            ))}
          </div>


        </div>

        {/* Tablet: 2x2 Grid */}
        <div className="hidden grid-cols-2 gap-6 md:grid lg:hidden">
          {METRICS.map(({ icon: Icon, value, label, helper, accent, bgAccent }) => (
            <Card key={label} className="group rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/25 hover:-translate-y-0.5">
              <CardContent className="flex flex-col items-center p-8 text-center">
                <span className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${bgAccent} ${accent} transition-all duration-300`}>
                  <Icon className="h-6 w-6" />
                </span>
                <p className={`text-4xl font-semibold tracking-tight ${accent}`}>{value}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-foreground">{label}</p>
                <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">{helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop: 4-column Grid */}
        <div className="hidden gap-6 lg:grid lg:grid-cols-4">
          {METRICS.map(({ icon: Icon, value, label, helper, accent, bgAccent }) => (
            <Card key={label} className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/25 hover:-translate-y-0.5">
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <CardContent className="relative flex flex-col items-center p-8 text-center">
                <span className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${bgAccent} ${accent} transition-all duration-300 group-hover:scale-105`}>
                  <Icon className="h-6 w-6" />
                </span>
                <p className={`text-4xl font-semibold tracking-tight ${accent}`}>{value}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-foreground">{label}</p>
                <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">{helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
