import { ArrowRight, Play, Shield, Sparkles } from 'lucide-react';
import React from 'react';

import { Logo } from '../../common/Logo';

import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

interface HeroSectionProps {
  onStartJourney: () => void;
  onSignUp: () => void;
  onDemo?: () => void;
}

export function HeroSection({ onStartJourney, onSignUp, onDemo }: HeroSectionProps) {
  return (
    <section 
      className="relative overflow-hidden bg-gradient-to-br from-background via-muted/20 to-accent/10 px-6 py-20 md:py-24 lg:py-32"
      aria-labelledby="hero-heading"
    >
      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl animate-pulse" style={{animationDelay: '1.5s'}} />
      </div>
      
      <div className="relative mx-auto max-w-7xl space-y-16">
        {/* Main Grid */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left Column - Text Content */}
          <div className="space-y-6 md:space-y-8">
            <Badge 
              variant="secondary" 
              className="flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              New: Mini-IPIP personality insights
            </Badge>
            
            {/* Headline - Elegant serif typography */}
            <h1 
              id="hero-heading"
              className="text-4xl font-light leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              <span className="flex items-center gap-3 font-serif italic text-primary">
                <Logo className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
                ManaSarathi
              </span>
              <span className="mt-3 block text-[0.7em] font-sans font-medium tracking-tight text-foreground/90">
                Your personal wellbeing companion
              </span>
            </h1>
            
            {/* Subheading - Light weight, higher class feel */}
            <p className="max-w-lg text-base font-light leading-relaxed text-muted-foreground sm:text-lg">
              Pair clinically grounded assessments with daily micro-practices, reflective journaling, and an empathetic AI guide who meets you exactly where you are.
            </p>

            {/* CTA Buttons - Sleek rounded pill shape */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center pt-4">
              <Button 
                size="lg" 
                className="group min-h-[52px] rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" 
                onClick={onStartJourney}
              >
                Start your free journey
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="group min-h-[52px] rounded-full border border-border/80 px-8 py-4 text-base font-semibold text-foreground transition-all duration-200 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" 
                onClick={onDemo || onSignUp}
              >
                <Play className="mr-2 h-3.5 w-3.5 fill-current" aria-hidden="true" />
                See a demo
              </Button>
            </div>
          </div>

          {/* Right Column - Beautiful framed portrait image */}
          <div className="relative flex items-center justify-center" aria-hidden="true">
            {/* Subtle glowing ring behind the image */}
            <div className="absolute -inset-1.5 rounded-[2.2rem] bg-gradient-to-tr from-primary/20 via-accent/10 to-transparent opacity-70 blur-md" />
            
            <div className="relative rounded-[2rem] border border-border/40 bg-background/50 p-3 shadow-xl backdrop-blur-sm">
              <picture>
                <source
                  srcSet="https://images.unsplash.com/photo-1687180948607-9ba1dd045e10?crop=entropy&cs=tinysrgb&fit=max&fm=webp&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbWVkaXRhdGlvbiUyMHdlbGxuZXNzfGVufDF8fHx8MTc1NjcxMDg4Nnww&ixlib=rb-4.1.0&q=80&w=800 800w, https://images.unsplash.com/photo-1687180948607-9ba1dd045e10?crop=entropy&cs=tinysrgb&fit=max&fm=webp&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbWVkaXRhdGlvbiUyMHdlbGxuZXNzfGVufDF8fHx8MTc1NjcxMDg4Nnww&ixlib=rb-4.1.0&q=80&w=1080 1080w"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  type="image/webp"
                />
                <img
                  src="https://images.unsplash.com/photo-1687180948607-9ba1dd045e10?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxf|calm%20meditation%20wellness|en|1|||1756710886|&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Person practicing mindful meditation in a serene natural setting – ManaSarathi wellness companion helps you find calm"
                  className="h-[360px] w-full rounded-[1.5rem] object-cover shadow-sm lg:h-[460px] lg:w-[480px]"
                  loading="eager"
                  width={480}
                  height={460}
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </div>

        {/* Full-width bottom section for Trust indicators */}
        <div className="border-t border-border/40 pt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data secure & encrypted • Trusted by teams at
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-foreground/85">
            <span className="transition-colors hover:text-primary">Mindful Care</span>
            <span className="text-muted-foreground/30" aria-hidden="true">•</span>
            <span className="transition-colors hover:text-primary">Wellness Institute</span>
            <span className="text-muted-foreground/30" aria-hidden="true">•</span>
            <span className="transition-colors hover:text-primary">Serenity Health</span>
          </div>
        </div>
      </div>
    </section>
  );
}

