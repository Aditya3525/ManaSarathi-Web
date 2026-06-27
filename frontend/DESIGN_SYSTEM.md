# UI UX Pro Max Design System Implementation Guide

## Overview

This document outlines the complete implementation of the UI UX Pro Max design system with Framer Motion animations in the ManaSarathi web application. The design system follows a "Soft Editorial Wellness" aesthetic combining warm, muted colors with therapeutic animations.

## Design System Components

### 1. Color System - "Soft Editorial Wellness"

#### Light Mode
- **Neutral Scale**: #fefcfb (50) → #2d1f1a (900) - warm, muted brown/taupe tones
- **Primary**: #9b7c5a (warm brown) - main actionable color
- **Secondary**: #a8c9a4 (sage green) - supporting color
- **Accent**: #b8d4c8 (soft teal) - highlights and interactive elements
- **Semantic Colors**:
  - Success: #6fbd8f (healing green)
  - Warning: #d4a574 (warm sand)
  - Destructive: #c85a5a (warm red)
  - Info: #7fa3c2 (gentle blue)

#### Dark Mode
- **Surface**: #1a0f0a (very dark warm brown)
- **Primary**: #c9a572 (lighter warm brown)
- **Secondary**: #7fa97b (muted green)
- **Accent**: #8aada3 (dusty teal)
- All colors designed with proper contrast ratios (WCAG AA)

### 2. Typography System

**Font Stack**:
```css
--font-family-sans: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
--font-family-serif: "Playfair Display", "Georgia", serif;
--font-family-mono: "JetBrains Mono", "Cascadia Code", monospace;
```

**Fluid Typography Scale**:
- xs: 0.69rem - 0.8rem
- sm: 0.8rem - 0.94rem
- base: 0.94rem - 1.13rem
- lg: 1.06rem - 1.31rem
- xl: 1.25rem - 1.63rem
- 2xl: 1.44rem - 2rem
- 3xl: 1.69rem - 2.5rem
- 4xl: 2rem - 3.13rem
- 5xl: 2.38rem - 3.88rem

Scales responsively based on viewport width.

### 3. Motion System

**Duration Tokens**:
- `--duration-instant`: 75ms (quickest interactions)
- `--duration-fast`: 150ms (form interactions)
- `--duration-normal`: 250ms (default animations)
- `--duration-calm`: 350ms (page transitions, slower reveals)
- `--duration-slow`: 500ms (background animations)

**Easing Functions**:
- `--ease-default`: cubic-bezier(0.4, 0, 0.2, 1) (standard ease)
- `--ease-spring`: cubic-bezier(0.34, 1.56, 0.64, 1) (springy feel)
- `--ease-in`: cubic-bezier(0.4, 0, 1, 1) (ease in)
- `--ease-out`: cubic-bezier(0, 0, 0.2, 1) (ease out)
- `--ease-breathe`: cubic-bezier(0.45, 0.05, 0.55, 0.95) (breathing rhythm)

### 4. Elevation System

4-level shadow elevation with adjusted dark mode shadows:

```css
--elevation-1: 0 1px 3px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.2);
--elevation-2: 0 2px 8px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.3);
--elevation-3: 0 4px 16px rgba(0, 0, 0, 0.2), 0 12px 40px rgba(0, 0, 0, 0.4);
--elevation-4: 0 8px 24px rgba(0, 0, 0, 0.25), 0 16px 56px rgba(0, 0, 0, 0.5);
```

### 5. Gradient Library

- `--gradient-calm-sky`: #9b7c5a → #a8c9a4 (primary to secondary)
- `--gradient-healing-glow`: #9b7c5a → #b8d4c8 (primary to accent)
- `--gradient-ai-aura`: #a8c9a4 → #7fa3c2 (secondary to info)

Used for accent backgrounds, decorative elements, and emphasis.

## Framer Motion Components

Located in `src/components/ui/motion-wrapper.tsx`:

### Generic Wrappers

**MotionWrapper**
- Generic animation wrapper with predefined variants
- Variants: fade, slide, scale, slideUp, slideDown, slideLeft, slideRight
- Props: variant, duration, delay, className
- Example:
```tsx
<MotionWrapper variant="slideUp" duration={0.3}>
  <div>Content</div>
</MotionWrapper>
```

**PageTransition**
- Full-page route transition component
- Uses AnimatePresence for cleanup
- Duration: 350ms (--duration-calm)
- Easing: easeInOut
- Example:
```tsx
<PageTransition key={currentPage} variant="fade">
  {renderCurrentPage()}
</PageTransition>
```

### List Animations

**StaggerContainer** + **StaggerItem**
- Parent-child pattern for sequential animations
- Default stagger delay: 100ms between items
- Example:
```tsx
<StaggerContainer>
  {items.map((item, i) => (
    <StaggerItem key={i}>
      <Item data={item} />
    </StaggerItem>
  ))}
</StaggerContainer>
```

### Interactive Components

**HoverScale**
- Scale on hover (1 → 1.05) with tap feedback (0.98)
- Spring timing for snappy feedback
- Example:
```tsx
<HoverScale>
  <Card>Interactive Card</Card>
</HoverScale>
```

**Pulse**
- Infinite 2s breathing pulse (scale 1 → 1.03)
- For loading states, active indicators

**Bounce**
- Infinite 1s bounce on y-axis (-8px)
- For attention-grabbing elements

**Reveal**
- Text/content reveal from sides with opacity transition
- Configurable position (left, right, top)
- Default duration: 600ms

## Enhanced UI Components

Located in `src/components/ui/motion-enhanced.tsx`:

### MotionCard
- Card with auto-entrance animation
- Hover lift effect (-4px)
- Props: hoverable, delay
- Example:
```tsx
<MotionCard hoverable delay={0.1}>
  Animated card content
</MotionCard>
```

### MotionButton
- Button with spring scale animation on interaction
- Loading spinner support
- Example:
```tsx
<MotionButton isLoading={loading} onClick={handleClick}>
  Click me
</MotionButton>
```

### AnimatedProgressRing
- Circular progress indicator with animated stroke
- For assessment/wellness progress tracking
- Props: value (0-100), size, strokeWidth, label
- Example:
```tsx
<AnimatedProgressRing value={65} label="Weekly Goal" />
```

### WellnessMetric
- Metric display with auto-counter and trend animation
- Props: label, value, target, icon, trend (up/down/stable), delay
- Example:
```tsx
<WellnessMetric
  label="Mood Score"
  value={8}
  target={10}
  trend="up"
  icon={<TrendIcon />}
/>
```

### AnimatedReveal
- Progressive disclosure with smooth height/opacity transition
- Props: isOpen, duration
- Example:
```tsx
<AnimatedReveal isOpen={expanded}>
  Hidden content
</AnimatedReveal>
```

### FloatingActionButton
- Circular button with ripple effect on click
- Hover/tap animations
- Props: icon, label, onClick
- Example:
```tsx
<FloatingActionButton
  icon={<PlusIcon />}
  label="New"
  onClick={handleNew}
/>
```

## Application Integration

### 1. Page Transitions (App.tsx)
```tsx
import { PageTransition } from './components/ui/motion-wrapper';

// In render
<PageTransition key={currentPage} variant="fade">
  <Suspense fallback={<RouteLoadingFallback />}>
    {renderCurrentPage()}
  </Suspense>
</PageTransition>
```

### 2. Dashboard Cards
```tsx
import { MotionCard, WellnessMetric } from './components/ui/motion-enhanced';

<MotionCard delay={0.1}>
  <WellnessMetric label="Wellness Score" value={8} target={10} />
</MotionCard>
```

### 3. Chat Messages
```tsx
<StaggerContainer>
  {messages.map((msg, i) => (
    <StaggerItem key={i}>
      <ChatMessage message={msg} />
    </StaggerItem>
  ))}
</StaggerContainer>
```

### 4. Journal Entries
```tsx
<HoverScale>
  <JournalEntry entry={entry} />
</HoverScale>
```

## Accessibility

### Color Contrast
- All color combinations meet WCAG AA minimum (4.5:1 for text, 3:1 for UI)
- Tested in both light and dark modes
- High contrast mode supported via CSS variables

### Motion Preferences
- All animations respect `prefers-reduced-motion` media query
- Animations disable to `animation: none` when reduced motion is enabled
- CSS class: `.animate-breathe`, `.page-enter`, etc. all support this

### Keyboard Navigation
- All interactive components maintain focus states
- Focus indicators use primary color with proper contrast
- Tab order preserved from underlying components

## Color Mode Support

### Light Mode (default)
- Applied via system preference or `data-theme="light"`
- Warm, muted palette optimized for daytime use
- Better for outdoor viewing

### Dark Mode
- Applied via `prefers-color-scheme: dark` or `data-theme="dark"` / `.dark` class
- Warmer dark surface (#1a0f0a) instead of cold black
- Adjusted primary/secondary for dark mode readability
- Reduced shadow intensity for dark surfaces

## Customization

### Adding New Colors
Edit `src/styles/design-tokens.css`:
```css
:root {
  --my-color: #abc123;
}
```

Then use in Tailwind: `bg-[var(--my-color)]`

### Adjusting Animation Speed
Modify `--duration-*` or `--ease-*` tokens in design-tokens.css

### Extending Motion Components
All Framer Motion components in motion-wrapper.tsx can be extended with additional variants:
```tsx
const newVariants = {
  hidden: { opacity: 0, ... },
  visible: { opacity: 1, ... }
};

<motion.div variants={newVariants} initial="hidden" animate="visible">
  Content
</motion.div>
```

## Browser Support

- Chrome/Edge 88+
- Firefox 87+
- Safari 14.1+
- Mobile: iOS 14.5+, Android 12+

Framer Motion handles fallbacks for older browsers (animations disable gracefully).

## Performance Optimization

### GPU Acceleration
- All animations use `transform` and `opacity` for 60fps performance
- Avoid animating `width`, `height`, `top`, `left`

### Lazy Loading
- Motion components only animate when visible
- Use Intersection Observer for large lists

### Reduced Motion
- Motion preferences honored automatically
- No animation overhead for users preferring reduced motion

## Troubleshooting

### Animations Not Showing
1. Check if `prefers-reduced-motion` is enabled
2. Verify Framer Motion is imported correctly
3. Ensure component has proper `initial`/`animate` props

### Color Not Applying
1. Check CSS variable name (must start with `--`)
2. Verify design-tokens.css is imported in main CSS
3. Use `var(--color-name)` format in Tailwind custom properties

### Performance Issues
1. Reduce number of simultaneously animating elements
2. Use `will-change: auto` on static elements
3. Profile with Chrome DevTools Performance tab

## File Structure

```
frontend/src/
├── styles/
│   ├── design-tokens.css       # Color, motion, typography tokens
│   ├── typography.css          # Font definitions
│   ├── animations.css          # CSS keyframes
│   └── index.css               # Main import
├── components/
│   └── ui/
│       ├── motion-wrapper.tsx  # Framer Motion utilities
│       ├── motion-enhanced.tsx # Enhanced UI components
│       ├── button.tsx          # Button component
│       ├── card.tsx            # Card component
│       └── ...                 # Other UI components
└── App.tsx                      # Page transition integration
```

## Next Steps

1. **Apply animations to feature screens**:
   - Dashboard: Stagger metrics cards
   - Chat: Stagger messages
   - Journal: Hover lift on entries
   - Practices: Reveal animations for practice content

2. **Enhance interactive elements**:
   - Replace button interactions with MotionButton
   - Add progress rings to assessments
   - Use WellnessMetric for stats

3. **Test across devices**:
   - Mobile (375px, 667px)
   - Tablet (768px, 1024px)
   - Desktop (1440px+)
   - Test with reduced motion enabled

4. **Monitor performance**:
   - Use Lighthouse for performance scoring
   - Profile with DevTools
   - Test on lower-end devices

## Resources

- **Framer Motion Docs**: https://www.framer.com/motion/
- **Design Tokens**: https://www.designtokens.org/
- **WCAG Accessibility**: https://www.w3.org/WAI/WCAG21/quickref/
- **CSS Variables**: https://developer.mozilla.org/en-US/docs/Web/CSS/--*

---

Last Updated: 2024
Design System: UI UX Pro Max - Soft Editorial Wellness Theme
Animation Framework: Framer Motion v11.18.2
