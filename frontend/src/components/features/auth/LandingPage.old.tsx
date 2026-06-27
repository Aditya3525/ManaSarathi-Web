import {
  ArrowRight,
  Heart,
  Brain,
  Users,
  Shield,
  CheckCircle,
  Sparkles,
  MessageCircle,
  Target,
  TrendingUp,
  Lock,
  Globe,
  Moon,
  Sun,
  AlertTriangle,
  Eye,
  EyeOff,
  Menu,
  X
} from 'lucide-react';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';

import { getServerBaseUrl } from '../../../config/apiConfig';
import { useAccessibility } from '../../../contexts/AccessibilityContext';
import { useAnalytics } from '../../../hooks/use-analytics';
import { useDevice } from '../../../hooks/use-device';
import { validateSignupEmail } from '../../../utils/emailValidation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Separator } from '../../ui/separator';
import { Switch } from '../../ui/switch';

import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { HeroSection } from './HeroSection';
import { MetricsSection } from './MetricsSection';
import { TestimonialsSection } from './TestimonialsSection';
import { DEMO_LOGIN_EMAIL, DEMO_LOGIN_PASSWORD } from './defaultCredentials';

interface LandingPageProps {
  onSignUp: (userData: { email: string; password: string }) => void;
  onLogin: (credentials: { email: string; password: string }) => void;
  onAdminLogin?: (credentials: { email: string; password: string }) => void;
  authError?: string | null;
  loginError?: { message?: string; error?: string; suggestion?: string; verificationUrl?: string } | null;
  onChooseLoginAsUser?: (rememberChoice?: boolean) => Promise<void> | void;
  onChooseLoginAsAdmin?: (rememberChoice?: boolean) => Promise<void> | void;
  onNavigate?: (page: string) => void;
}

type CookiePreferences = {
  analytics: boolean;
  personalization: boolean;
  marketing: boolean;
};

type InfoDialogContent = {
  title: string;
  description: string;
};

const COOKIE_PREFERENCES_KEY = 'mw-cookie-preferences-v1';
const NEWSLETTER_INTEREST_KEY = 'mw-newsletter-interest-v1';
const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  analytics: true,
  personalization: true,
  marketing: false,
};

export function LandingPage({
  onSignUp,
  onLogin,
  onAdminLogin,
  authError,
  loginError,
  onChooseLoginAsUser,
  onChooseLoginAsAdmin,
  onNavigate
}: LandingPageProps) {
  const device = useDevice();
  const analytics = useAnalytics();
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState(DEMO_LOGIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState(DEMO_LOGIN_PASSWORD);
  const [adminEmail, setAdminEmail] = useState(DEMO_LOGIN_EMAIL);
  const [adminPassword, setAdminPassword] = useState(DEMO_LOGIN_PASSWORD);
  const [activeModal, setActiveModal] = useState<null | 'start' | 'signup' | 'login' | 'admin'>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHeaderSticky, setIsHeaderSticky] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupValidationError, setSignupValidationError] = useState<string | null>(null);
  const [rememberAdminDestinationChoice, setRememberAdminDestinationChoice] = useState(false);
  const [isCookieDialogOpen, setIsCookieDialogOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState<InfoDialogContent | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_COOKIE_PREFERENCES;
    }

    try {
      const storedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      return storedPreferences
        ? { ...DEFAULT_COOKIE_PREFERENCES, ...JSON.parse(storedPreferences) }
        : DEFAULT_COOKIE_PREFERENCES;
    } catch {
      return DEFAULT_COOKIE_PREFERENCES;
    }
  });

  const passwordChecks = {
    minLength: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z\d]/.test(password),
  };
  const isStrongSignupPassword = Object.values(passwordChecks).every(Boolean);
  const signupEmailValidation = validateSignupEmail(email);
  const isValidSignupEmail = signupEmailValidation.isValid;

  // Carousel state for features section
  const [activeFeaturesIndex, setActiveFeaturesIndex] = useState(0);

  // Features carousel ref
  const featuresContainerRef = useRef<HTMLDivElement>(null);

  const isStartJourneyOpen = activeModal === 'start';
  const isSignupOpen = activeModal === 'signup';
  const isLoginOpen = activeModal === 'login';
  const isAdminOpen = activeModal === 'admin';

  useEffect(() => {
    if (isLoginOpen) {
      setLoginEmail(DEMO_LOGIN_EMAIL);
      setLoginPassword(DEMO_LOGIN_PASSWORD);
    }
  }, [isLoginOpen]);

  useEffect(() => {
    if (isAdminOpen) {
      setAdminEmail(DEMO_LOGIN_EMAIL);
      setAdminPassword(DEMO_LOGIN_PASSWORD);
    }
  }, [isAdminOpen]);

  useEffect(() => {
    if (loginError?.suggestion !== 'choose_admin_or_user') {
      setRememberAdminDestinationChoice(false);
    }
  }, [loginError?.suggestion]);

  const { settings: accessibilitySettings, setSetting: setAccessibilitySetting } = useAccessibility();

  // Sticky header on scroll + scroll depth tracking
  useEffect(() => {
    const scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false };

    const handleScroll = () => {
      setIsHeaderSticky(window.scrollY > 100);

      // Track scroll depth
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      Object.keys(scrollDepthTracked).forEach((depth) => {
        const depthNum = parseInt(depth);
        if (scrollPercent >= depthNum && !scrollDepthTracked[depthNum]) {
          scrollDepthTracked[depthNum] = true;
          analytics.trackScrollDepth(depthNum);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [analytics]);

  const closeModal = () => setActiveModal(null);
  const openModal = (modal: Exclude<typeof activeModal, null>) => {
    setActiveModal(modal);
    setMobileMenuOpen(false); // Close mobile menu when opening a modal
    analytics.trackButtonClick(`open_${modal}_modal`, 'landing_page');
  };
  const updateCookiePreference = (key: keyof CookiePreferences, value: boolean) => {
    setCookiePreferences((current) => ({ ...current, [key]: value }));
  };
  const saveCookiePreferences = () => {
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(cookiePreferences));
    setIsCookieDialogOpen(false);
  };
  const acceptAllCookies = () => {
    const acceptedPreferences: CookiePreferences = {
      analytics: true,
      personalization: true,
      marketing: true,
    };
    setCookiePreferences(acceptedPreferences);
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(acceptedPreferences));
    setIsCookieDialogOpen(false);
  };
  const showInfoDialog = (title: string, description: string) => {
    setInfoDialog({ title, description });
  };
  const handleNewsletterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setNewsletterMessage({ type: 'error', text: 'Enter a valid email address to subscribe.' });
      return;
    }

    localStorage.setItem(NEWSLETTER_INTEREST_KEY, trimmedEmail);
    setNewsletterEmail('');
    setNewsletterMessage({
      type: 'success',
      text: 'Thanks — your interest is saved and newsletter delivery will be connected before launch.',
    });
  };

  const differentiators = useMemo(
    () => [
      {
        icon: Sparkles,
        title: 'Personalized every day',
        description: 'Adaptive plans blend therapy techniques, breathwork, and mindful rituals based on your current mood and engagement.'
      },
      {
        icon: MessageCircle,
        title: 'Empathetic AI guide',
        description: 'Evidence-based conversational AI keeps check-ins warm yet clinically grounded, escalating to humans when needed.'
      },
      {
        icon: Globe,
        title: 'Designed for every background',
        description: 'Inclusive content authored with clinicians and community advocates ensures cultural resonance and accessibility.'
      },
      {
        icon: Lock,
        title: 'Enterprise-grade security',
        description: 'Zero-trust architecture with encryption in transit and at rest, SOC 2 controls, and granular consent management.'
      }
    ],
    []
  );

  const faqs = useMemo(
    () => [
      {
        question: 'Is this a replacement for therapy?',
        answer:
          'We complement—not replace—licensed care. Our platform offers psychoeducation, self-care tools, and structured check-ins, and can seamlessly hand off to clinicians when deeper support is needed.'
      },
      {
        question: 'Who can see my assessment results?',
        answer:
          'You decide. Assessments and daily reflections are private by default. You can share summaries with clinicians, loved ones, or keep them personal.'
      },
      {
        question: 'How quickly will I see results?',
        answer:
          'Most members report improved emotional awareness within the first week, and noticeable reductions in stress and anxiety within 14–21 days of consistent practice.'
      },
      {
        question: 'Do you support teams or schools?',
        answer:
          'Yes. We offer dedicated onboarding, analytics dashboards, and tailored resource packs for organizations, universities, and coaches.'
      }
    ],
    []
  );

  const featureHighlights = useMemo(
    () => [
      {
        icon: MessageCircle,
        title: 'AI Therapist Chat',
        description: '24/7 conversational support with empathetic, clinically informed AI guidance.',
        ctaLabel: 'Start a guided chat'
      },
      {
        icon: TrendingUp,
        title: 'Progress Tracking',
        description: 'Monitor your wellbeing journey with trendlines, streaks, and progress reflections.',
        ctaLabel: 'Track your progress'
      },
      {
        icon: Heart,
        title: 'Mindful Practices',
        description: 'Guided meditation, yoga, and breathing sessions curated for your current energy.',
        ctaLabel: 'Explore practices'
      },
      {
        icon: Users,
        title: 'Expert Content',
        description: 'A curated library of therapeutic videos and articles authored with clinicians.',
        ctaLabel: 'Discover expert guides'
      }
    ],
    []
  );

  const scrollToFeature = useCallback((index: number) => {
    const container = featuresContainerRef.current;
    const child = container?.children[index] as HTMLElement | undefined;

    if (!container || !child) return;

    container.scrollTo({
      left: child.offsetLeft - container.offsetLeft,
      behavior: 'smooth'
    });
    setActiveFeaturesIndex(index);
  }, []);

  const handleFeatureLearnMore = (featureTitle: string) => {
    analytics.trackButtonClick(`feature_${featureTitle.toLowerCase().replace(/\s+/g, '_')}`, 'landing_page');
    openModal('start');
  };

  useEffect(() => {
    const container = featuresContainerRef.current;
    if (!container || !device.isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Array.from(container.children).indexOf(entry.target);
            if (index !== -1) {
              setActiveFeaturesIndex(index);
            }
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    Array.from(container.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [device.isMobile]);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      if (!isValidSignupEmail) {
        setSignupValidationError(signupEmailValidation.message || 'Please enter a valid email address.');
        analytics.trackFormSubmit('signup', false);
        return;
      }
      if (!isStrongSignupPassword) {
        setSignupValidationError('Use at least 8 characters with uppercase, lowercase, number, and special character.');
        analytics.trackFormSubmit('signup', false);
        return;
      }
      setSignupValidationError(null);
      analytics.trackFormSubmit('signup', true);
      onSignUp({ email, password });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail && loginPassword) {
      analytics.trackFormSubmit('login', true);
      onLogin({ email: loginEmail, password: loginPassword });
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminEmail && adminPassword && onAdminLogin) {
      analytics.trackFormSubmit('admin_login', true);
      onAdminLogin({ email: adminEmail, password: adminPassword });
    }
  };

  const handleGoogleAuth = () => {
    analytics.trackButtonClick('google_oauth', 'landing_page');
    const frontendOrigin = encodeURIComponent(window.location.origin);
    window.location.href = `${getServerBaseUrl()}/api/auth/google?frontend_origin=${frontendOrigin}`;
  };

  const handleToggleDarkMode = () => {
    const next = !accessibilitySettings.darkMode;
    setAccessibilitySetting('darkMode', next, {
      announce: `Dark mode ${next ? 'enabled' : 'disabled'}`
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Responsive Sticky Header */}
      <header
        className={`
          sticky top-0 z-50 border-b bg-background/95 backdrop-blur transition-shadow supports-[backdrop-filter]:bg-background/75
          ${isHeaderSticky ? 'shadow-md' : ''}
        `}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 md:py-4">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary sm:px-3">
              ManaSarathi
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:text-sm lg:inline-flex">
              Guided support for calmer days
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            <a href="#how-it-works" className="transition-colors hover:text-primary">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-primary">
              Features
            </a>
            <a href="#faq" className="transition-colors hover:text-primary">
              FAQ
            </a>
          </nav>

          {/* CTA Buttons & Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleDarkMode}
              aria-label={accessibilitySettings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={accessibilitySettings.darkMode}
              className="h-9 w-9 rounded-full border-border/60 text-muted-foreground hover:text-foreground sm:h-10 sm:w-10"
            >
              {accessibilitySettings.darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Mobile: Compact Start Button */}
            <Button
              className="h-9 px-3 text-sm font-medium sm:h-10 sm:px-4 lg:hidden"
              onClick={() => openModal('start')}
            >
              Start free
            </Button>

            {/* Desktop: Full Buttons */}
            <div className="hidden items-center gap-3 lg:flex">
              <Button variant="ghost" className="text-sm font-medium" onClick={() => openModal('login')}>
                Log in
              </Button>
              <Button className="text-sm font-medium" onClick={() => openModal('start')}>
                Start for free
              </Button>
            </div>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-background px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-3">
              <a
                href="#how-it-works"
                className="flex h-11 min-h-[44px] items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it works
              </a>
              <a
                href="#features"
                className="flex h-11 min-h-[44px] items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#faq"
                className="flex h-11 min-h-[44px] items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                className="h-11 min-h-[44px] justify-start text-sm font-medium"
                onClick={() => openModal('login')}
              >
                Log in
              </Button>
            </nav>
          </div>
        )}
      </header>

      <main id="main-content">
        <HeroSection
          onStartJourney={() => openModal('start')}
          onSignUp={() => openModal('signup')}
        />

        <MetricsSection />

        {/* How It Works Section - Enhanced with better icons */}
        <section id="how-it-works" className="bg-muted/30 px-4 py-12 sm:px-6 md:py-16 lg:py-24" aria-labelledby="how-it-works-heading">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 space-y-3 text-center md:mb-16 md:space-y-4">
              <h2 id="how-it-works-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                How it works
              </h2>
              <p className="mx-auto max-w-2xl text-base font-medium text-foreground/70 sm:text-lg md:text-xl">
                Three simple steps to understand and improve your wellbeing
              </p>
            </div>

            {/* Mobile: Vertical List with Connector Line */}
            <ol className="relative space-y-8 md:hidden">
              {/* Connector Line */}
              <div
                className="absolute left-6 top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20"
                aria-hidden="true"
              />

              <li className="relative flex gap-4">
                <div className="z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xl font-bold text-primary shadow-md">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Assess</h3>
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    Take science-based assessments to understand your anxiety, stress levels, and personality strengths.
                  </p>
                </div>
              </li>

              <li className="relative flex gap-4">
                <div className="z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xl font-bold text-primary shadow-md">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Understand</h3>
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    Receive clear, personalized insights and recommendations based on your mental health profile.
                  </p>
                </div>
              </li>

              <li className="relative flex gap-4">
                <div className="z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xl font-bold text-primary shadow-md">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Target className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Act</h3>
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    Follow your personalized plan combining therapy, meditation, and mindfulness practices with AI guidance.
                  </p>
                </div>
              </li>
            </ol>

            {/* Tablet+: Card Grid */}
            <div className="hidden gap-6 md:grid md:gap-8 lg:grid-cols-3">
              <Card className="group relative overflow-hidden border-2 shadow-md transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                <CardContent className="space-y-4 p-6 text-center md:p-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                    <Brain className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Assess</h3>
                  <p className="text-base text-foreground/70">
                    Take science-based assessments to understand your anxiety, stress levels, and personality strengths.
                  </p>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden border-2 shadow-md transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                <CardContent className="space-y-4 p-6 text-center md:p-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                    <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Understand</h3>
                  <p className="text-base text-foreground/70">
                    Receive clear, personalized insights and recommendations based on your wellbeing profile.
                  </p>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden border-2 shadow-md transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                <CardContent className="space-y-4 p-6 text-center md:p-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                    <Target className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Act</h3>
                  <p className="text-base text-foreground/70">
                    Follow your personalized plan combining therapy, meditation, and mindfulness practices with AI guidance.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section - Enhanced Cards with Hover */}
        <section id="features" className="px-4 py-12 sm:px-6 md:py-16 lg:py-24" aria-labelledby="features-heading">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 space-y-3 text-center md:mb-12 md:space-y-4 lg:mb-16">
              <h2 id="features-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Complete wellbeing support
              </h2>
              <p className="mx-auto max-w-2xl text-base font-medium text-foreground/70 sm:text-lg md:text-xl">
                Everything you need for your wellbeing journey in one compassionate platform
              </p>
            </div>

            {/* Mobile: Horizontal Carousel */}
            <div className="md:hidden">
              <div
                ref={featuresContainerRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="region"
                aria-label="Features carousel"
              >
                {featureHighlights.map(({ icon: Icon, title, description, ctaLabel }, index) => (
                  <Card
                    key={title}
                    className="group min-w-[88vw] flex-shrink-0 snap-center border-2 shadow-md transition-all duration-300 hover:border-primary/30 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`Feature ${index + 1} of ${featureHighlights.length}: ${title}`}
                  >
                    <CardContent className="space-y-3 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">{title}</h3>
                      <p className="text-base leading-relaxed text-foreground/70">{description}</p>
                      <button
                        type="button"
                        onClick={() => handleFeatureLearnMore(title)}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Progress Indicators */}
              <div className="mt-6 space-y-3">
                <p className="text-center text-xs font-medium text-muted-foreground">
                  Feature {activeFeaturesIndex + 1} of {featureHighlights.length}
                </p>
                <div className="flex justify-center gap-2" role="tablist" aria-label="Features pagination">
                  {featureHighlights.map((feature, index) => (
                    <button
                      key={feature.title}
                      type="button"
                      role="tab"
                      aria-selected={activeFeaturesIndex === index}
                      aria-label={`View ${feature.title}`}
                      onClick={() => scrollToFeature(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${activeFeaturesIndex === index
                        ? 'w-8 bg-primary'
                        : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                        }`}
                    />
                  ))}
                </div>
                <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                  Showing feature {activeFeaturesIndex + 1}: {featureHighlights[activeFeaturesIndex]?.title}
                </div>
              </div>
            </div>

            {/* Tablet: 2x2 Grid */}
            <div className="hidden gap-6 md:grid md:grid-cols-2 lg:hidden">
              {featureHighlights.map(({ icon: Icon, title, description, ctaLabel }) => (
                <Card
                  key={title}
                  className="group border-2 shadow-md transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{title}</h3>
                    <p className="text-base text-foreground/70">{description}</p>
                    <button
                      type="button"
                      onClick={() => handleFeatureLearnMore(title)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: 4-column Grid */}
            <div className="hidden gap-6 lg:grid lg:grid-cols-4">
              {featureHighlights.map(({ icon: Icon, title, description, ctaLabel }) => (
                <Card
                  key={title}
                  className="group border-2 shadow-md transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{title}</h3>
                    <p className="text-base text-foreground/70">{description}</p>
                    <button
                      type="button"
                      onClick={() => handleFeatureLearnMore(title)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/20 px-6 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl space-y-12">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl lg:text-4xl">Why people choose ManaSarathi</h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
                Built alongside psychologists, coaches, and neurodiverse advocates to support modern wellbeing needs.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {differentiators.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="h-full border border-primary/10 bg-background/80 shadow-sm">
                  <CardContent className="space-y-3 p-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <TestimonialsSection />

        <section className="bg-muted/30 px-6 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border border-primary/10 bg-background/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Security and care you can trust</CardTitle>
                <CardDescription>
                  We go beyond compliance to keep your data secure and to respond with human care when moments get tough.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Shield className="h-4 w-4 text-primary" /> Privacy-first architecture
                  </h4>
                  <p>HIPAA-ready, SOC 2 aligned infrastructure with encryption in transit and at rest.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" /> Clinical review board
                  </h4>
                  <p>Content created with licensed therapists, mindfulness teachers, and DEI advisors.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Users className="h-4 w-4 text-primary" /> Escalation-ready support
                  </h4>
                  <p>Integrated crisis resources and optional handoff to emergency contacts or clinicians.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Lock className="h-4 w-4 text-primary" /> Fine-grained consent
                  </h4>
                  <p>Control exactly what you share, with whom, and for how long.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-primary/10 bg-primary/5 shadow-sm">
              <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground">Coaching & organizational plans</h3>
                  <p className="text-sm text-muted-foreground">
                    Support for therapists, coaches, schools, and workplaces looking to bring preventative mental wellness to their communities.
                  </p>
                </div>
                <Button variant="outline" className="border-primary text-primary" onClick={() => openModal('start')}>
                  Talk to our team
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="faq" className="px-6 py-16 lg:py-24" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-4xl space-y-6 sm:space-y-8">
            <div className="px-4 text-center sm:px-0">
              <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-3 text-base font-medium text-foreground/70 sm:text-lg">
                Still wondering if ManaSarathi is right for you? We&apos;ve got answers.
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              className="rounded-xl border border-border/60 bg-background shadow-sm"
            >
              {faqs.map(({ question, answer }, index) => (
                <AccordionItem
                  key={question}
                  value={question}
                  className="border-b border-border/40 last:border-b-0"
                >
                  <AccordionTrigger
                    className="px-4 py-4 text-left text-base font-semibold text-foreground transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-6 sm:text-lg [&[data-state=open]]:text-primary"
                    aria-controls={`faq-content-${index}`}
                  >
                    {question}
                  </AccordionTrigger>
                  <AccordionContent
                    id={`faq-content-${index}`}
                    className="px-4 pb-4 text-base leading-relaxed text-foreground/70 sm:px-6"
                  >
                    {answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-6 sm:pb-16" aria-labelledby="cta-heading">
          <Card className="mx-auto max-w-5xl overflow-hidden border-none bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 shadow-lg">
            <div className="grid gap-6 p-6 text-center sm:p-8 sm:text-left md:grid-cols-[1.5fr_1fr] md:items-center lg:p-10">
              <div className="space-y-3 sm:space-y-4">
                <h2 id="cta-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  Ready to feel more grounded?
                </h2>
                <p className="text-base font-medium text-foreground/70 sm:text-lg">
                  Start your tailored journey in minutes with assessments, AI coaching, and practices selected just for you.
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 md:items-end">
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:w-auto md:px-8"
                  onClick={() => openModal('signup')}
                >
                  Create your free account
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-full rounded-xl border-2 border-primary text-base font-semibold text-primary transition-all duration-200 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:w-auto md:px-8"
                  onClick={() => openModal('login')}
                >
                  I already have an account
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t bg-muted/20 px-4 py-10 sm:px-6 md:px-8 md:py-12 lg:py-16">
        <div className="mx-auto max-w-7xl space-y-8 md:space-y-12">
          {/* Priority Actions Section (Mobile First) */}
          <div className="space-y-4 lg:hidden">
            {/* Crisis Support - Always Visible */}
            <div className="rounded-lg border-2 border-red-600 bg-red-50 p-4 dark:bg-red-950/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
                <div className="flex-1 space-y-2">
                  <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">Crisis Support Available 24/7</h3>
                  <p className="text-xs text-red-800 dark:text-red-200">If you&apos;re in immediate danger, call emergency services.</p>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <a
                      href="tel:988"
                      className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                      aria-label="Call 988 Suicide and Crisis Lifeline"
                    >
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call 988
                    </a>
                    <a
                      href="/crisis"
                      className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-md border border-red-600 bg-white px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      More Resources
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Support */}
            <div className="flex flex-col gap-2 rounded-lg bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Need Help?</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href="mailto:support@wellbeingai.com"
                  className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Email Support
                </a>
                <a
                  href="#faq"
                  className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  Help Center
                </a>
              </div>
            </div>
          </div>

          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            {/* Brand Column */}
            <div className="space-y-4 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold text-foreground">ManaSarathi</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground max-w-xs">
                Evidence-based wellbeing support, anytime, anywhere.
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-background/60 p-3">
                <Shield className="h-4 w-4 text-primary" />
                <a href="/privacy" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Privacy-first
                </a>
                <span className="text-xs text-muted-foreground">•</span>
                <a href="/compliance" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  HIPAA-ready
                </a>
                <span className="text-xs text-muted-foreground">•</span>
                <a href="/security" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  SOC 2
                </a>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-2 pt-2" role="group" aria-label="Social media links">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-lg bg-background/80 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Follow us on Twitter"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-lg bg-background/80 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Follow us on LinkedIn"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-lg bg-background/80 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Follow us on Instagram"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </div>

              {/* Desktop Crisis Support */}
              <div className="hidden rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30 lg:block">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-red-900 dark:text-red-100">Crisis Support 24/7</p>
                    <a
                      href="tel:988"
                      className="inline-flex items-center text-sm font-bold text-red-700 underline-offset-2 hover:underline dark:text-red-400"
                    >
                      Call 988
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Column */}
            <nav className="space-y-4" aria-labelledby="footer-product">
              <h4 id="footer-product" className="text-sm font-semibold text-foreground">Product</h4>
              <ul className="space-y-1 text-sm text-foreground/70">
                <li>
                  <a href="#features" className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline">
                    How it works
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => openModal('start')}
                  >
                    AI Chat
                  </button>
                </li>
                <li>
                  <a href="#features" className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline">
                    Assessments
                  </a>
                </li>
                <li>
                  <a href="#features" className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline">
                    Practices
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Pricing', 'ManaSarathi is free during early access. If paid plans are introduced later, pricing will be shared clearly before any charge.')}
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </nav>

            {/* Company Column */}
            <nav className="space-y-4" aria-labelledby="footer-company">
              <h4 id="footer-company" className="text-sm font-semibold text-foreground">Company</h4>
              <ul className="space-y-1 text-sm text-foreground/70">
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('About ManaSarathi', 'ManaSarathi is a mental wellbeing platform combining assessments, mindful practices, journaling, and supportive AI guidance.')}
                  >
                    About us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Careers', 'We are not hiring right now, but future opportunities will be shared here as the platform grows.')}
                  >
                    Careers
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Blog', 'Wellbeing articles and product updates are coming soon.')}
                  >
                    Blog
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Press Kit', 'A public press kit is being prepared. For now, please use the product overview on this page.')}
                  >
                    Press Kit
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Partners', 'Partnership information is coming soon. We are focused on thoughtful, safety-first wellbeing collaborations.')}
                  >
                    Partners
                  </button>
                </li>
              </ul>
            </nav>

            {/* Resources Column */}
            <nav className="space-y-4" aria-labelledby="footer-resources">
              <h4 id="footer-resources" className="text-sm font-semibold text-foreground">Resources</h4>
              <ul className="space-y-1 text-sm text-foreground/70">
                <li>
                  <a href="#faq" className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline">
                    Help Center
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Contact Support', 'For urgent safety concerns, use crisis resources immediately. General support contact options will be available as the platform expands.')}
                  >
                    Contact Support
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Privacy Policy', 'ManaSarathi is designed around consent, minimal data collection, and user privacy controls. Signed-in users can manage sharing and privacy settings from their profile.')}
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 transition-colors hover:text-primary underline-offset-4 hover:underline"
                    onClick={() => showInfoDialog('Terms of Service', 'ManaSarathi provides wellbeing support and education, not emergency care or a replacement for professional medical advice.')}
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <a href="tel:988" className="inline-flex items-center py-2 text-red-600 transition-colors hover:text-red-700 underline-offset-4 hover:underline">
                    Crisis Resources
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="inline-flex items-center py-2 text-xs opacity-50 transition-opacity hover:opacity-100"
                    onClick={() => openModal('admin')}
                  >

                    Admin Access
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate('therapist-login');
                      } else {
                        window.location.assign('/therapist_login');
                      }
                    }}
                    className="inline-flex items-center py-2 text-xs opacity-50 transition-opacity hover:opacity-100"
                  >
                    Therapist Portal Access
                  </button>
                </li>
              </ul>
            </nav>

            {/* Newsletter Column - Enhanced with validation & consent */}
            <div className="space-y-4 md:col-span-2 lg:col-span-1">
              <h4 className="text-sm font-semibold text-foreground">Stay Connected</h4>
              <p className="text-sm leading-relaxed text-foreground/70">
                Monthly wellbeing tips and mindfulness practices.
              </p>
              <form
                className="space-y-3"
                onSubmit={handleNewsletterSubmit}
              >
                <div className="space-y-2">
                  <Label htmlFor="newsletter-email" className="text-xs text-foreground/70">
                    Email address
                  </Label>
                  <Input
                    id="newsletter-email"
                    type="email"
                    placeholder="your@email.com"
                    className="h-11 bg-background text-sm"
                    aria-label="Email address for newsletter"
                    aria-describedby="newsletter-consent"
                    inputMode="email"
                    autoComplete="email"
                    value={newsletterEmail}
                    onChange={(event) => {
                      setNewsletterEmail(event.target.value);
                      setNewsletterMessage(null);
                    }}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full text-sm font-medium"
                >
                  Subscribe
                </Button>
                <p id="newsletter-consent" className="text-xs leading-relaxed text-muted-foreground">
                  By subscribing, you agree to our{' '}
                  <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                    Privacy Policy
                  </a>
                  . Unsubscribe anytime.
                </p>
                {newsletterMessage && (
                  <p
                    className={`text-xs ${newsletterMessage.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}
                    role="status"
                    aria-live="polite"
                  >
                    {newsletterMessage.text}
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Back to Top Button */}
          <div className="flex justify-center pt-4 lg:hidden">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex h-11 min-w-[44px] items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Scroll back to top of page"
            >
              <ArrowRight className="h-4 w-4 rotate-[-90deg]" />
              Back to top
            </button>
          </div>

          <Separator className="bg-border/60" />

          {/* Bottom Bar - Legal & Copyright */}
          <div className="flex flex-col gap-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p className="flex items-center gap-1">
              © {new Date().getFullYear()} ManaSarathi. All rights reserved.
            </p>

            {/* Legal Links */}
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-6" aria-label="Legal and compliance links">
              <button
                type="button"
                className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                onClick={() => showInfoDialog('Privacy Policy', 'ManaSarathi is designed around consent, minimal data collection, and user privacy controls. Signed-in users can manage sharing and privacy settings from their profile.')}
              >
                Privacy
              </button>
              <button
                type="button"
                className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                onClick={() => showInfoDialog('Terms of Service', 'ManaSarathi provides wellbeing support and education, not emergency care or a replacement for professional medical advice.')}
              >
                Terms
              </button>
              <button
                type="button"
                className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                onClick={() => setIsCookieDialogOpen(true)}
              >
                Cookies
              </button>
              <button
                type="button"
                className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                onClick={() => setIsCookieDialogOpen(true)}
              >
                Manage Cookies
              </button>
              <button
                type="button"
                className="transition-colors hover:text-foreground hover:underline underline-offset-4"
                onClick={() => showInfoDialog('Accessibility', 'ManaSarathi includes theme, font, motion, and readability controls inside the app experience to support different access needs.')}
              >
                Accessibility
              </button>
            </nav>

            <p className="flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-red-500" aria-hidden="true" />
              <span>Made for people first</span>
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={isStartJourneyOpen} onOpenChange={(open) => (open ? openModal('start') : closeModal())}>
        <DialogContent className="max-w-[22rem] sm:max-w-sm md:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle>Start your journey</DialogTitle>
            <DialogDescription>Choose how you want to begin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button className="w-full" onClick={() => { closeModal(); handleGoogleAuth(); }}>
              Continue with Google
            </Button>
            <Button variant="outline" className="w-full" onClick={() => openModal('signup')}>
              Create an account
            </Button>
            <Button variant="outline" className="w-full" onClick={() => openModal('login')}>
              Log in
            </Button>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={closeModal}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSignupOpen} onOpenChange={(open) => (open ? openModal('signup') : closeModal())}>
        <DialogContent className="max-w-[22rem] sm:max-w-sm md:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle>Create your account</DialogTitle>
            <DialogDescription>Get personalized support, assessments, and daily nudges.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (signupValidationError) setSignupValidationError(null);
                }}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (signupValidationError) setSignupValidationError(null);
                  }}
                  placeholder="Create a strong password"
                  minLength={8}
                  className="pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  aria-label={showSignupPassword ? 'Hide signup password' : 'Show signup password'}
                >
                  {showSignupPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Password must include:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">{passwordChecks.minLength ? <CheckCircle className="h-3 w-3 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground" />} 8+ characters</li>
                  <li className="flex items-center gap-2">{passwordChecks.upper ? <CheckCircle className="h-3 w-3 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground" />} Uppercase letter</li>
                  <li className="flex items-center gap-2">{passwordChecks.lower ? <CheckCircle className="h-3 w-3 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground" />} Lowercase letter</li>
                  <li className="flex items-center gap-2">{passwordChecks.number ? <CheckCircle className="h-3 w-3 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground" />} Number</li>
                  <li className="flex items-center gap-2">{passwordChecks.special ? <CheckCircle className="h-3 w-3 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground" />} Special character</li>
                </ul>
              </div>
            </div>

            {(signupValidationError || authError) && <p className="text-sm text-destructive" role="alert">{signupValidationError || authError}</p>}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="flex-1" disabled={!isStrongSignupPassword || !isValidSignupEmail}>
                Get started
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
            </div>

            <Separator className="bg-border" />

            <Button type="button" variant="outline" className="flex w-full items-center gap-2" onClick={() => { closeModal(); handleGoogleAuth(); }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <button type="button" className="underline" onClick={() => openModal('login')}>
                Log in
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoginOpen} onOpenChange={(open) => (open ? openModal('login') : closeModal())}>
        <DialogContent className="max-w-[22rem] sm:max-w-sm md:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle>Welcome back</DialogTitle>
            <DialogDescription>Log in to continue your wellbeing journey.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder={DEMO_LOGIN_EMAIL}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            {(loginError?.error || loginError?.message || authError) && (
              <div className="space-y-2 text-sm text-destructive" role="alert">
                <p>{loginError?.error || loginError?.message || authError}</p>
                {loginError?.suggestion === 'choose_admin_or_user' && (
                  <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                    <p className="text-sm font-semibold text-foreground">Choose your destination</p>
                    <p className="text-xs text-muted-foreground">
                      {loginError?.message || 'This account can access both user and admin areas. Select where to continue.'}
                    </p>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={rememberAdminDestinationChoice}
                        onChange={(event) => setRememberAdminDestinationChoice(event.target.checked)}
                      />
                      Remember my choice on this device
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChooseLoginAsUser?.(rememberAdminDestinationChoice)}
                        disabled={!onChooseLoginAsUser}
                      >
                        Login as User
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onChooseLoginAsAdmin?.(rememberAdminDestinationChoice)}
                        disabled={!onChooseLoginAsAdmin}
                      >
                        Open Admin Dashboard
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="flex-1">
                Log in
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
            </div>

            <div className="text-right text-xs text-muted-foreground">
              <button
                type="button"
                className="text-primary underline-offset-4 transition hover:underline"
                onClick={() => {
                  closeModal();
                  setIsForgotPasswordOpen(true);
                }}
              >
                Forgot password?
              </button>
            </div>

            <Separator className="bg-border" />

            <Button type="button" variant="outline" className="flex w-full items-center gap-2" onClick={() => { closeModal(); handleGoogleAuth(); }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              New here?{' '}
              <button type="button" className="underline" onClick={() => openModal('signup')}>
                Create an account
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdminOpen} onOpenChange={(open) => (open ? openModal('admin') : closeModal())}>
        <DialogContent className="max-w-[22rem] sm:max-w-sm md:max-w-md">
          <DialogHeader className="space-y-2 text-center">
            <Shield className="mx-auto h-10 w-10 text-primary" />
            <DialogTitle>Admin access</DialogTitle>
            <DialogDescription>Secure sign-in for administrators.</DialogDescription>
          </DialogHeader>
          {(authError || loginError?.message) && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {authError || loginError?.message}
            </div>
          )}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { closeModal(); setAdminEmail(''); setAdminPassword(''); }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Log in as admin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCookieDialogOpen} onOpenChange={setIsCookieDialogOpen}>
        <DialogContent className="max-w-[22rem] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Essential cookies stay on for security. Choose the optional cookies ManaSarathi can use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Essential</p>
                  <p className="text-sm text-muted-foreground">Required for sign-in, security, and app stability.</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Always on</span>
              </div>
            </div>
            {([
              ['analytics', 'Analytics', 'Helps us understand app performance and improve important flows.'],
              ['personalization', 'Personalization', 'Keeps helpful preferences like language, accessibility, and experience settings.'],
              ['marketing', 'Marketing', 'Allows optional campaign and outreach measurement.'],
            ] as const).map(([key, title, description]) => (
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <Label htmlFor={`cookie-${key}`} className="font-medium">{title}</Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={`cookie-${key}`}
                  checked={cookiePreferences[key]}
                  onCheckedChange={(checked) => updateCookiePreference(key, checked)}
                  aria-label={`${title} cookies`}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={saveCookiePreferences}>Save choices</Button>
            <Button onClick={acceptAllCookies}>Accept all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(infoDialog)} onOpenChange={(open) => !open && setInfoDialog(null)}>
        <DialogContent className="max-w-[22rem] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{infoDialog?.title}</DialogTitle>
            <DialogDescription>{infoDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInfoDialog(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen} />
    </div>
  );
}
