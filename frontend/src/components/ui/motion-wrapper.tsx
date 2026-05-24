import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Motion Wrapper Component
 * Provides Framer Motion animations for UI elements
 * Integrates with UI UX Pro Max design system
 */

interface MotionWrapperProps {
  children: React.ReactNode;
  variant?: 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight';
  duration?: number;
  delay?: number;
  className?: string;
}

const variants = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
  },
  slideDown: {
    hidden: { opacity: 0, y: -16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  slideRight: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

export function MotionWrapper({
  children,
  variant = 'fade',
  duration = 0.4,
  delay = 0,
  className,
}: MotionWrapperProps) {
  const variantSet = variants[variant] || variants.fade;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variantSet}
      transition={{
        duration,
        delay,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Page Transition Component
 * Handles full page/route transitions with Framer Motion
 */
interface PageTransitionProps {
  children: React.ReactNode;
  key?: string;
  variant?: 'fade' | 'slide' | 'slideUp' | 'slideDown';
}

export function PageTransition({
  children,
  key,
  variant = 'fade',
}: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants[variant]}
        transition={{
          duration: 0.35,
          ease: 'easeInOut',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Stagger Container
 * Animates children in sequence
 */
interface StaggerContainerProps {
  children: React.ReactNode;
  staggerChildren?: number;
  staggerDelay?: number;
  delayChildren?: number;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerChildren = 0.1,
  staggerDelay,
  delayChildren = 0,
  className,
}: StaggerContainerProps) {
  const actualStagger = staggerDelay !== undefined ? staggerDelay : staggerChildren;
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: actualStagger,
            delayChildren,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger Item
 * Child element for StaggerContainer
 */
interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: 'easeOut' },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hover Scale Animation
 * Interactive scale effect on hover
 */
interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.05, className }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Pulse Animation
 * Gentle pulsing effect
 */
interface PulseProps {
  children: React.ReactNode;
  duration?: number;
  className?: string;
}

export function Pulse({ children, duration = 2, className }: PulseProps) {
  return (
    <motion.div
      animate={{ scale: [1, 1.03, 1] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Bounce Animation
 * Playful bounce effect
 */
interface BounceProps {
  children: React.ReactNode;
  duration?: number;
  className?: string;
}

export function Bounce({ children, duration = 1, className }: BounceProps) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Reveal Animation
 * Text/content reveal from left or top
 */
interface RevealProps {
  children: React.ReactNode;
  direction?: 'left' | 'top';
  duration?: number;
  className?: string;
}

export function Reveal({ children, direction = 'left', duration = 0.6, className }: RevealProps) {
  const initialState = direction === 'left' ? { x: -40 } : { y: 40 };

  return (
    <motion.div
      initial={{ ...initialState, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
