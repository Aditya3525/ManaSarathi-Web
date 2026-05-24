/**
 * Enhanced UI Components with Framer Motion
 * UI UX Pro Max Design System Integration
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './button';
import { Card } from './card';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './utils';

/**
 * Motion-Enhanced Card Component
 * Soft Editorial Wellness style with hover effects
 */
type MotionOmitKeys = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onTransitionEnd' | 'style';

interface MotionCardProps extends Omit<React.ComponentProps<'div'>, MotionOmitKeys> {
  hoverable?: boolean;
  delay?: number;
}

export const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  ({ className, hoverable = true, delay = 0, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref as any}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          delay,
          ease: 'easeOut',
        }}
        whileHover={hoverable ? { y: -4 } : undefined}
        className={className}
        {...props}
      >
        <Card>{children}</Card>
      </motion.div>
    );
  }
);

MotionCard.displayName = 'MotionCard';

/**
 * Motion-Enhanced Button with Spring Animation
 */
interface MotionButtonProps extends Omit<React.ComponentProps<typeof Button>, MotionOmitKeys> {
  isLoading?: boolean;
}

const MotionButtonInner = motion(Button);

export const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <MotionButtonInner
        ref={ref as any}
        whileHover={{ scale: !disabled ? 1.02 : 1 }}
        whileTap={{ scale: !disabled ? 0.98 : 1 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 17,
        }}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="inline-block mr-2"
          >
            ⟳
          </motion.div>
        ) : null}
        {children}
      </MotionButtonInner>
    );
  }
);

MotionButton.displayName = 'MotionButton';

/**
 * Animated Progress Ring Component
 * For assessment progress tracking
 */
interface AnimatedProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function AnimatedProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  label,
}: AnimatedProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <motion.div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          className="text-primary"
          animate={{
            strokeDashoffset,
          }}
          transition={{
            duration: 0.8,
            ease: 'easeOut',
          }}
        />
      </svg>
      {label && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <div className="text-2xl font-semibold text-primary">{value}%</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Wellness Metric Card with Number Counter
 */
interface WellnessMetricProps {
  label: string;
  value: number;
  target?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  delay?: number;
}

export function WellnessMetric({
  label,
  value,
  target,
  icon,
  trend,
  delay = 0,
}: WellnessMetricProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        delay,
        ease: 'easeOut',
      }}
      className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm border-primary/10"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <motion.div
              className="text-2xl font-semibold text-primary"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: delay + 0.1,
              }}
            >
              {value}
            </motion.div>
            {target && (
              <div className="text-xs text-muted-foreground">/ {target}</div>
            )}
          </div>
        </div>
        {icon && (
          <motion.div
            className="text-primary/40"
            animate={{
              scale: trend === 'up' ? [1, 1.2, 1] : trend === 'down' ? [1, 0.8, 1] : [1, 1, 1],
            }}
            transition={{
              duration: 0.6,
              delay: delay + 0.2,
            }}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Animated Content Reveal
 * For progressive disclosure of content
 */
interface AnimatedRevealProps {
  children: React.ReactNode;
  isOpen: boolean;
  duration?: number;
}

export function AnimatedReveal({
  children,
  isOpen,
  duration = 0.3,
}: AnimatedRevealProps) {
  return (
    <motion.div
      initial={false}
      animate={{
        height: isOpen ? 'auto' : 0,
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
      }}
      transition={{
        duration,
        ease: 'easeInOut',
      }}
    >
      <div className="pt-2 pb-2">{children}</div>
    </motion.div>
  );
}

/**
 * Floating Action Button with Ripple Effect
 */
interface FloatingActionButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'size' | 'variant'> {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
}

export const FloatingActionButton = React.forwardRef<
  HTMLButtonElement,
  FloatingActionButtonProps
>(({ icon, label, onClick, className, ...props }, ref) => {
  const [ripples, setRipples] = React.useState<Array<{ id: string; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rippleId = `ripple-${Date.now()}`;
    setRipples((prev) => [
      ...prev,
      {
        id: rippleId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
    ]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 600);

    onClick?.();
  };

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center gap-2',
          'hover:shadow-xl transition-shadow',
          'overflow-hidden',
          className
        )}
        {...props}
      >
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            className="absolute rounded-full bg-white/40"
            initial={{
              width: 0,
              height: 0,
              left: ripple.x,
              top: ripple.y,
              x: '-50%',
              y: '-50%',
            }}
            animate={{
              width: 300,
              height: 300,
              x: '-50%',
              y: '-50%',
            }}
            transition={{
              duration: 0.6,
              ease: 'easeOut',
            }}
          />
        ))}
        <span className="relative z-10">{icon}</span>
        {label && <span className="relative z-10 text-sm font-medium">{label}</span>}
      </button>
    </motion.div>
  );
});

FloatingActionButton.displayName = 'FloatingActionButton';
