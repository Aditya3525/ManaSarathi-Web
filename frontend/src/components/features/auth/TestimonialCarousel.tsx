import { useEffect, useState } from 'react';

interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'ManaSarathi helped me understand my anxiety patterns. The daily check-ins became my anchor.',
    author: 'A.K.',
    role: 'Member for 3 months',
  },
  {
    quote:
      'I love how gentle the approach is. It never feels pushy, just present when I need it.',
    author: 'R.M.',
    role: 'Member for 6 months',
  },
  {
    quote:
      'The breathing exercises and mood tracking changed my morning routine completely.',
    author: 'S.P.',
    role: 'Member for 2 months',
  },
];

export function TestimonialCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % TESTIMONIALS.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const testimonial = TESTIMONIALS[activeIndex];

  return (
    <div className="min-h-[120px] space-y-3 rounded-2xl border border-border/50 bg-background/60 py-4 text-center backdrop-blur-sm">
      <p
        className="mx-auto max-w-md page-enter px-4 text-sm italic leading-relaxed text-muted-foreground sm:text-base"
        key={activeIndex}
      >
        &ldquo;{testimonial.quote}&rdquo;
      </p>
      <div>
        <span className="text-xs font-medium text-foreground">{testimonial.author}</span>
        {testimonial.role && (
          <span className="ml-1 text-xs text-muted-foreground">&middot; {testimonial.role}</span>
        )}
      </div>

    </div>
  );
}

export default TestimonialCarousel;