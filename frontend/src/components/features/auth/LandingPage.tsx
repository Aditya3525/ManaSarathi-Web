import {
  ArrowRight,
  Heart,
  Brain,
  Users,
  Shield,
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
  X,
  Headphones,
  BookOpen,
  ChevronRight,
  Star,
  Leaf,
  Check
} from 'lucide-react';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';

import { Logo } from '../../common/Logo';

import { getServerBaseUrl } from '../../../config/apiConfig';
import { useAccessibility } from '../../../contexts/AccessibilityContext';
import { useAnalytics } from '../../../hooks/use-analytics';
import { useDevice } from '../../../hooks/use-device';
import { validateSignupEmail } from '../../../utils/emailValidation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Separator } from '../../ui/separator';
import { Switch } from '../../ui/switch';

import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { DEMO_LOGIN_EMAIL, DEMO_LOGIN_PASSWORD } from './defaultCredentials';

// ponytail: inline CSS for landing-page-specific styles that don't belong in the design system
const LANDING_STYLES = `
  .landing-hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .landing-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 20% 80%, var(--primary) / 0.08, transparent),
      radial-gradient(ellipse 60% 50% at 80% 20%, var(--secondary) / 0.12, transparent);
    pointer-events: none;
  }
  .landing-section { padding: clamp(3rem, 8vw, 6rem) 0; }
  .landing-container { max-width: 72rem; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem); }
  .landing-headline {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    line-height: 1.08;
    letter-spacing: -0.025em;
    font-weight: 700;
    text-wrap: balance;
    color: var(--foreground);
  }
  .landing-subhead {
    font-size: clamp(1rem, 2.2vw, 1.25rem);
    line-height: 1.6;
    max-width: 38rem;
    color: var(--muted-foreground);
  }
  .landing-section-title {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 700;
    text-wrap: balance;
    color: var(--foreground);
  }
  .landing-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    background: var(--card);
    padding: clamp(1.5rem, 3vw, 2rem);
    transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
  }
  .landing-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-elevation-2);
  }
  .landing-icon-wrap {
    width: 3rem; height: 3rem;
    border-radius: var(--radius-lg);
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    color: var(--primary);
    flex-shrink: 0;
  }
  .landing-step-number {
    width: 2.5rem; height: 2.5rem;
    border-radius: var(--radius-full);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 1rem;
    background: var(--primary);
    color: var(--primary-foreground);
    flex-shrink: 0;
  }
  .landing-step-line {
    width: 2px;
    flex: 1;
    background: linear-gradient(to bottom, var(--primary), var(--border));
    margin: 0.5rem 0;
    min-height: 2rem;
  }
  .landing-nav {
    position: sticky; top: 0; z-index: 50;
    background: color-mix(in oklab, var(--background) 85%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    transition: box-shadow var(--duration-fast) var(--ease-default);
  }
  .landing-nav.scrolled { box-shadow: var(--shadow-elevation-1); }
  .landing-footer {
    border-top: 1px solid var(--border);
    padding: clamp(2rem, 5vw, 4rem) 0;
    color: var(--muted-foreground);
  }
  .landing-cta-section {
    position: relative;
    overflow: hidden;
    background: var(--primary);
    color: var(--primary-foreground);
    border-radius: var(--radius-2xl);
    padding: clamp(2.5rem, 6vw, 4rem);
    text-align: center;
  }
  .landing-cta-section::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.08), transparent 60%);
    pointer-events: none;
  }
  .landing-feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: clamp(1rem, 2.5vw, 1.5rem);
  }
  .landing-stat { text-align: center; }
  .landing-stat-number {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    line-height: 1;
    color: var(--primary);
  }
  .landing-stat-label {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    margin-top: 0.25rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .landing-card:hover { transform: none; }
  }
`;

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

const COOKIE_PREFERENCES_KEY = 'mw-cookie-preferences-v1';
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
  const { settings: accessibilitySettings, setSetting: setAccessibilitySetting } = useAccessibility();

  // Auth form state
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
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_COOKIE_PREFERENCES;
    try {
      const stored = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      return stored ? { ...DEFAULT_COOKIE_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_COOKIE_PREFERENCES;
    } catch { return DEFAULT_COOKIE_PREFERENCES; }
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

  const isStartJourneyOpen = activeModal === 'start';
  const isSignupOpen = activeModal === 'signup';
  const isLoginOpen = activeModal === 'login';
  const isAdminOpen = activeModal === 'admin';

  useEffect(() => { if (isLoginOpen) { setLoginEmail(DEMO_LOGIN_EMAIL); setLoginPassword(DEMO_LOGIN_PASSWORD); } }, [isLoginOpen]);
  useEffect(() => { if (isAdminOpen) { setAdminEmail(DEMO_LOGIN_EMAIL); setAdminPassword(DEMO_LOGIN_PASSWORD); } }, [isAdminOpen]);
  useEffect(() => { if (loginError?.suggestion !== 'choose_admin_or_user') setRememberAdminDestinationChoice(false); }, [loginError?.suggestion]);

  // Sticky header
  useEffect(() => {
    const scrollDepthTracked: Record<number, boolean> = { 25: false, 50: false, 75: false, 100: false };
    const handleScroll = () => {
      setIsHeaderSticky(window.scrollY > 60);
      const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      Object.keys(scrollDepthTracked).forEach((depth) => {
        const d = parseInt(depth);
        if (scrollPercent >= d && !scrollDepthTracked[d]) { scrollDepthTracked[d] = true; analytics.trackScrollDepth(d); }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [analytics]);

  const closeModal = () => setActiveModal(null);
  const openModal = (modal: Exclude<typeof activeModal, null>) => {
    setActiveModal(modal);
    setMobileMenuOpen(false);
    analytics.trackButtonClick(`open_${modal}_modal`, 'landing_page');
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      if (!isValidSignupEmail) { setSignupValidationError(signupEmailValidation.message || 'Please enter a valid email address.'); analytics.trackFormSubmit('signup', false); return; }
      if (!isStrongSignupPassword) { setSignupValidationError('Use at least 8 characters with uppercase, lowercase, number, and special character.'); analytics.trackFormSubmit('signup', false); return; }
      setSignupValidationError(null);
      analytics.trackFormSubmit('signup', true);
      onSignUp({ email, password });
    }
  };
  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); if (loginEmail && loginPassword) { analytics.trackFormSubmit('login', true); onLogin({ email: loginEmail, password: loginPassword }); } };
  const handleAdminLogin = (e: React.FormEvent) => { e.preventDefault(); if (adminEmail && adminPassword && onAdminLogin) { analytics.trackFormSubmit('admin_login', true); onAdminLogin({ email: adminEmail, password: adminPassword }); } };
  const handleGoogleAuth = () => {
    analytics.trackButtonClick('google_oauth', 'landing_page');
    const frontendOrigin = encodeURIComponent(window.location.origin);
    window.location.href = `${getServerBaseUrl()}/api/auth/google?frontend_origin=${frontendOrigin}`;
  };
  const handleToggleDarkMode = () => {
    const next = !accessibilitySettings.darkMode;
    setAccessibilitySetting('darkMode', next, { announce: `Dark mode ${next ? 'enabled' : 'disabled'}` });
  };

  const updateCookiePreference = (key: keyof CookiePreferences, value: boolean) => setCookiePreferences((c) => ({ ...c, [key]: value }));
  const saveCookiePreferences = () => { localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(cookiePreferences)); setIsCookieDialogOpen(false); };
  const acceptAllCookies = () => { const all: CookiePreferences = { analytics: true, personalization: true, marketing: true }; setCookiePreferences(all); localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(all)); setIsCookieDialogOpen(false); };

  const features = useMemo(() => [
    { icon: MessageCircle, title: 'AI Companion', desc: '24/7 conversational support with empathetic, clinically informed guidance that remembers your journey.' },
    { icon: Brain, title: 'Clinical Assessments', desc: 'PHQ-9, GAD-7, PSS-10 and more — validated instruments with progress tracking over time.' },
    { icon: Headphones, title: 'Guided Practices', desc: 'Meditation, breathwork, yoga and grounding exercises curated to your current mood and energy.' },
    { icon: TrendingUp, title: 'Progress Insights', desc: 'Visual dashboards, mood heatmaps, streak tracking and AI-generated weekly summaries.' },
    { icon: BookOpen, title: 'Expert Library', desc: 'Curated articles, videos and therapeutic content authored with licensed clinicians.' },
    { icon: Users, title: 'Therapist Booking', desc: 'Find, book and manage sessions with verified therapists directly within the platform.' },
  ], []);

  const steps = useMemo(() => [
    { title: 'Assess', desc: 'Take clinically validated assessments to understand your baseline emotional wellbeing.' },
    { title: 'Practice', desc: 'Follow personalized daily plans blending breathwork, journaling, and mindful rituals.' },
    { title: 'Grow', desc: 'Track your progress with insights, streaks, and an AI companion that grows with you.' },
  ], []);

  const faqs = useMemo(() => [
    { q: 'Is this a replacement for therapy?', a: 'We complement — not replace — licensed care. Our platform offers psychoeducation, self-care tools, and structured check-ins, and can seamlessly hand off to clinicians when deeper support is needed.' },
    { q: 'Who can see my assessment results?', a: 'You decide. Assessments and daily reflections are private by default. You can share summaries with clinicians, loved ones, or keep them personal.' },
    { q: 'How quickly will I see results?', a: 'Most members report improved emotional awareness within the first week, and noticeable reductions in stress and anxiety within 14–21 days of consistent practice.' },
    { q: 'Do you support teams or schools?', a: 'Yes. We offer dedicated onboarding, analytics dashboards, and tailored resource packs for organizations, universities, and coaches.' },
  ], []);

  const stats = [
    { number: '10+', label: 'Validated Assessments' },
    { number: '50+', label: 'Guided Practices' },
    { number: '24/7', label: 'AI Companion' },
    { number: '100%', label: 'Private & Secure' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style dangerouslySetInnerHTML={{ __html: LANDING_STYLES }} />

      {/* Skip to content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to main content
      </a>

      {/* ── Navigation ── */}
      <header className={`landing-nav ${isHeaderSticky ? 'scrolled' : ''}`}>
        <div className="landing-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 'clamp(3.5rem, 5vw, 4rem)' }}>
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate?.('landing')}>
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Mana<span className="text-primary font-normal">Sarathi</span>
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleToggleDarkMode} aria-label={accessibilitySettings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className="h-9 w-9 rounded-full border-border/60">
              {accessibilitySettings.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" className="hidden lg:inline-flex text-sm" onClick={() => openModal('login')}>Log in</Button>
            <Button className="text-sm rounded-full px-5" onClick={() => openModal('start')}>
              {device.isMobile ? 'Start' : 'Start for free'}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-background px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-1">
              <a href="#features" className="flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a href="#faq" className="flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <Separator className="my-2" />
              <Button variant="ghost" className="justify-start text-sm" onClick={() => openModal('login')}>Log in</Button>
            </nav>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* ── Hero ── */}
        <section className="landing-hero">
          <div className="landing-container relative z-10" style={{ paddingTop: 'clamp(3rem, 8vw, 6rem)', paddingBottom: 'clamp(3rem, 8vw, 6rem)' }}>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — Copy */}
              <div className="space-y-6">
                <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Clinically grounded AI wellbeing
                </Badge>

                <h1 className="landing-headline">
                  Your mind deserves<br />
                  <span className="text-primary">a companion.</span>
                </h1>

                <p className="landing-subhead">
                  Clinical assessments, personalized practices, reflective journaling, and an empathetic AI guide — all in one place. Start understanding your wellbeing today.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button size="lg" className="rounded-full px-8 text-base font-semibold shadow-md" onClick={() => openModal('start')}>
                    Begin your journey <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full px-6 text-base" onClick={() => openModal('login')}>
                    Log in
                  </Button>
                </div>

                <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> Private & encrypted</span>
                  <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> Free to start</span>
                </div>
              </div>

              {/* Right — Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="landing-card text-center">
                    <div className="landing-stat-number">{s.number}</div>
                    <div className="landing-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="landing-section" style={{ background: 'var(--muted)' }}>
          <div className="landing-container">
            <div className="text-center space-y-3 mb-12">
              <h2 className="landing-section-title">Everything you need to thrive</h2>
              <p className="landing-subhead mx-auto" style={{ maxWidth: '42rem' }}>
                Six pillars of support, from clinical insight to daily practice, all working together.
              </p>
            </div>

            <div className="landing-feature-grid">
              {features.map((f) => (
                <div key={f.title} className="landing-card">
                  <div className="landing-icon-wrap mb-4">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="landing-section">
          <div className="landing-container">
            <div className="text-center space-y-3 mb-12">
              <h2 className="landing-section-title">Three steps to feeling better</h2>
              <p className="landing-subhead mx-auto">A clear path from understanding to action to growth.</p>
            </div>

            <div className="max-w-2xl mx-auto">
              {steps.map((step, i) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="landing-step-number">{i + 1}</div>
                    {i < steps.length - 1 && <div className="landing-step-line" />}
                  </div>
                  <div className="pb-10">
                    <h3 className="text-xl font-bold text-foreground mb-1">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-cta-section">
              <div className="relative z-10 space-y-4">
                <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 700, lineHeight: 1.2, textWrap: 'balance' }}>
                  Ready to start your wellbeing journey?
                </h2>
                <p style={{ maxWidth: '32rem', margin: '0 auto', opacity: 0.85, fontSize: 'clamp(0.95rem, 1.8vw, 1.1rem)' }}>
                  Join thousands who are building a stronger relationship with their mental health — one day at a time.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button size="lg" variant="secondary" className="rounded-full px-8 text-base font-semibold" onClick={() => openModal('start')}>
                    Get started free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="landing-section" style={{ background: 'var(--muted)' }}>
          <div className="landing-container">
            <div className="text-center space-y-3 mb-12">
              <h2 className="landing-section-title">Frequently asked questions</h2>
            </div>

            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="space-y-2">
                {faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="landing-card !p-0 border overflow-hidden">
                    <AccordionTrigger className="px-5 py-4 text-left text-base font-semibold text-foreground hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-4 text-muted-foreground leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="font-semibold text-foreground">ManaSarathi</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button className="hover:text-foreground transition-colors" onClick={() => setIsCookieDialogOpen(true)}>Cookie preferences</button>
              <button className="hover:text-foreground transition-colors" onClick={() => onNavigate?.('privacy')}>Privacy</button>
              <button className="hover:text-foreground transition-colors" onClick={() => onNavigate?.('therapist-login')}>Therapist</button>
              <button className="hover:text-foreground transition-colors" onClick={() => openModal('admin')}>Admin</button>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ManaSarathi. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── Modals (Start Journey / Signup / Login / Admin / Cookie) ── */}

      {/* Start Journey */}
      <Dialog open={isStartJourneyOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Get started</DialogTitle>
            <DialogDescription>Choose how you'd like to begin your wellbeing journey.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button className="w-full justify-between rounded-lg" onClick={() => setActiveModal('signup')}>
              Create free account <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between rounded-lg" onClick={handleGoogleAuth}>
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Separator />
            <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setActiveModal('login')}>
              Already have an account? Log in
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signup */}
      <Dialog open={isSignupOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create your account</DialogTitle>
            <DialogDescription>Start your wellbeing journey today — it's free.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignUp} className="space-y-4 pt-1">
            {authError && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{authError}</div>}
            {signupValidationError && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{signupValidationError}</div>}
            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setSignupValidationError(null); }} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input id="signup-password" type={showSignupPassword ? 'text' : 'password'} placeholder="Create a strong password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowSignupPassword(!showSignupPassword)}>
                  {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {password.length > 0 && (
                <div className="grid grid-cols-2 gap-1 text-xs pt-1">
                  {Object.entries(passwordChecks).map(([key, passed]) => (
                    <span key={key} className={`flex items-center gap-1 ${passed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      <Check className="h-3 w-3" />
                      {{ minLength: '8+ chars', lower: 'Lowercase', upper: 'Uppercase', number: 'Number', special: 'Special char' }[key]}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!email || !password}>Create account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Login */}
      <Dialog open={isLoginOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Welcome back</DialogTitle>
            <DialogDescription>Log in to continue your wellbeing journey.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-1">
            {loginError && loginError.suggestion !== 'choose_admin_or_user' && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{loginError.message || loginError.error}
              </div>
            )}
            {loginError?.suggestion === 'choose_admin_or_user' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">This account has admin access. Where would you like to go?</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => onChooseLoginAsUser?.(rememberAdminDestinationChoice)}>User Dashboard</Button>
                  <Button type="button" className="flex-1" onClick={() => onChooseLoginAsAdmin?.(rememberAdminDestinationChoice)}>Admin Panel</Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={rememberAdminDestinationChoice} onChange={(e) => setRememberAdminDestinationChoice(e.target.checked)} className="rounded" />
                  Remember my choice
                </label>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-primary hover:underline" onClick={() => { closeModal(); setIsForgotPasswordOpen(true); }}>Forgot password?</button>
              <button type="button" className="text-primary hover:underline" onClick={handleGoogleAuth}>Use Google instead</button>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
              <Button type="submit" className="flex-1">Log in</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Login */}
      <Dialog open={isAdminOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Admin access</DialogTitle>
            <DialogDescription>Log in with your admin credentials.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { closeModal(); setAdminEmail(''); setAdminPassword(''); }}>Cancel</Button>
              <Button type="submit" className="flex-1">Log in as admin</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cookie Preferences */}
      <Dialog open={isCookieDialogOpen} onOpenChange={setIsCookieDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>Essential cookies stay on for security. Choose the optional cookies ManaSarathi can use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between gap-4">
              <div><p className="font-medium">Essential</p><p className="text-sm text-muted-foreground">Required for sign-in, security, and app stability.</p></div>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Always on</span>
            </div>
            {([
              ['analytics', 'Analytics', 'Helps us understand app performance.'],
              ['personalization', 'Personalization', 'Keeps language and accessibility settings.'],
              ['marketing', 'Marketing', 'Optional campaign measurement.'],
            ] as const).map(([key, title, desc]) => (
              <div key={key} className="rounded-lg border p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`cookie-${key}`} className="font-medium">{title}</Label>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <Switch id={`cookie-${key}`} checked={cookiePreferences[key]} onCheckedChange={(c) => updateCookiePreference(key, c)} />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={saveCookiePreferences}>Save choices</Button>
            <Button onClick={acceptAllCookies}>Accept all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen} />
    </div>
  );
}
