import { 
  ArrowLeft,
  Play,
  RotateCcw,
  Heart,
  Waves,
  Users,
  Clock,
  Download,
  CheckCircle,
  SkipForward,
  Timer,
  Layers,
  Filter,
  ChevronDown,
  Music,
  Video as VideoIcon,
  X,
  Search,
  SlidersHorizontal,
  Grid3x3,
  List,
  ArrowUp
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { getApiBaseUrl } from '../../../config/apiConfig';
import { useDevice } from '../../../hooks/use-device';
import { ImageWithFallback } from '../../common/ImageWithFallback';
import { MediaPlayer } from '../../common/MediaPlayer';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import { ResponsiveContainer } from '../../ui/responsive-layout';
import { StaggerContainer, StaggerItem } from '../../ui/motion-wrapper';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter
} from '../../ui/sheet';

interface PracticesProps {
  onNavigate: (page: string) => void;
}
interface Practice {
  id: string;
  title: string;
  description: string;
  type: 'meditation' | 'breathing' | 'yoga' | 'sleep';
  duration: number; // in minutes
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  approach: 'Western' | 'Eastern' | 'Hybrid' | 'All';
  format: 'Audio' | 'Video' | 'Audio/Video' | 'Text';
  instructor: string;
  image: string;
  hasDownload: boolean;
  tags: string[];
  focusAreas?: string[];
  immediateRelief?: boolean;
  crisisEligible?: boolean;
  intensityLevel?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  youtubeUrl?: string | null;
  instructions?: string[];
}

interface PracticeSession {
  practice: Practice;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isCompleted: boolean;
}

interface PracticeAutoStartPayload {
  id?: string | null;
  title?: string | null;
  source?: string;
  createdAt?: number;
}

type PracticeSortKey = 'recommended' | 'duration' | 'title';

const DASHBOARD_PRACTICE_AUTOSTART_KEY = 'mw-practice-autostart';

const parseStringArray = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((value) => String(value).trim()).filter(Boolean);
        }
      } catch {
        // Fall through to comma parsing.
      }
    }
    return trimmed.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
};

export function Practices({ onNavigate }: PracticesProps) {
  const device = useDevice();
  const { t } = useTranslation();
  
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [mediaInstanceKey, setMediaInstanceKey] = useState<number>(0);
  // Filter state (multi-select except duration)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // empty = All
  const [selectedDuration, setSelectedDuration] = useState<string>('all');
  const [selectedApproaches, setSelectedApproaches] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]); // Audio / Video
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [postPracticeRating, setPostPracticeRating] = useState<number | null>(null);
  const [showPostPractice, setShowPostPractice] = useState(false);
  const [sortBy, setSortBy] = useState<PracticeSortKey>('recommended');

  // Mobile-responsive state
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const saved = window.sessionStorage.getItem('practices_search');
    if (saved) {
      window.sessionStorage.removeItem('practices_search');
      return saved;
    }
    return '';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(device.isMobile ? 'list' : 'grid');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isActiveFiltersExpanded, setIsActiveFiltersExpanded] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoStartRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const resp = await fetch(`${getApiBaseUrl()}/practices`);
        if(!resp.ok) throw new Error('Failed to load practices');
        const json = await resp.json();
        if(!json.success) throw new Error(json.error || 'Failed to load practices');
  interface RawPractice { id:string; title:string; description?:string|null; type:string; duration:number; difficulty:string; approach:string; format:string; audioUrl?:string|null; videoUrl?:string|null; youtubeUrl?:string|null; thumbnailUrl?:string|null; tags?:string|null; focusAreas?: string | string[] | null; immediateRelief?: boolean | null; crisisEligible?: boolean | null; intensityLevel?: string | null; instructions?: any; }
        const mapped: Practice[] = (json.data as RawPractice[] || []).map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          type: (['meditation','breathing','yoga','sleep'].includes(p.type) ? p.type : 'meditation') as Practice['type'],
          duration: p.duration,
          difficulty: (['Beginner','Intermediate','Moderate','Advanced'].includes(p.difficulty)
            ? (p.difficulty === 'Moderate' ? 'Intermediate' : p.difficulty)
            : 'Beginner') as Practice['difficulty'],
          approach: (['Western','Eastern','Hybrid','All'].includes(p.approach) ? p.approach : 'All') as Practice['approach'],
          format: (['Audio','Video','Audio/Video','Text'].includes(p.format) ? p.format : 'Audio') as Practice['format'],
          instructor: 'Guide',
          image: p.thumbnailUrl || '/placeholder-practice.jpg',
          hasDownload: !!p.audioUrl,
          tags: typeof p.tags === 'string' ? p.tags.split(',').map((t:string)=>t.trim()).filter((t:string)=>t.length>0) : [],
          focusAreas: parseStringArray(p.focusAreas),
          immediateRelief: Boolean(p.immediateRelief),
          crisisEligible: Boolean(p.crisisEligible),
          intensityLevel: p.intensityLevel || null,
          audioUrl: p.audioUrl || undefined,
          videoUrl: p.videoUrl || undefined,
          youtubeUrl: p.youtubeUrl || undefined,
          instructions: parseStringArray(p.instructions)
        }));
        setPractices(mapped);
      } catch(err){
        const message = err instanceof Error ? err.message : 'Error loading practices';
        console.error(err);
        setError(message);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const categories = [
    { id: 'all', label: 'All Practices', icon: Heart },
    { id: 'meditation', label: 'Meditation', icon: Heart },
    { id: 'breathing', label: 'Breathing', icon: Waves },
    { id: 'yoga', label: 'Yoga', icon: Users },
    { id: 'sleep', label: 'Sleep', icon: Clock }
  ];

  const durations = [
    { id: 'all', label: 'Any Duration' },
    { id: 'short', label: '5-10 minutes' },
    { id: 'medium', label: '10-20 minutes' },
    { id: 'long', label: '20+ minutes' }
  ];

  const formats = [
    { id: 'all', label: 'All', icon: Filter },
    { id: 'Audio', label: 'Audio', icon: Music },
    { id: 'Video', label: 'Video', icon: VideoIcon }
  ];

  const approaches = [
    { id: 'Western', label: 'Western', icon: Heart },
    { id: 'Eastern', label: 'Eastern', icon: Waves },
    { id: 'Hybrid', label: 'Hybrid (All)', icon: Users }
  ];

  const difficulties = [
    { id: 'all', label: 'All Levels', icon: Layers },
    { id: 'Beginner', label: 'Beginner', icon: Layers },
    { id: 'Intermediate', label: 'Intermediate', icon: Layers },
    { id: 'Advanced', label: 'Advanced', icon: Layers }
  ];

  const filteredPractices = practices.filter(practice => {
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(practice.type);
    const matchesDuration = selectedDuration === 'all' || 
      (selectedDuration === 'short' && practice.duration <= 10) ||
      (selectedDuration === 'medium' && practice.duration > 10 && practice.duration <= 20) ||
      (selectedDuration === 'long' && practice.duration > 20);
    const matchesFormat = selectedFormats.length === 0 || selectedFormats.includes(practice.format) || (practice.format === 'Audio/Video' && (selectedFormats.includes('Audio') || selectedFormats.includes('Video')));
    const matchesApproach = selectedApproaches.length === 0 || selectedApproaches.includes('Hybrid') || selectedApproaches.includes(practice.approach) || practice.approach === 'All' || practice.approach === 'Hybrid';
    const matchesDifficulty = selectedDifficulties.length === 0 || selectedDifficulties.includes(practice.difficulty);
    const matchesSearch = searchQuery.trim() === '' || 
      practice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (practice.focusAreas || []).some(area => area.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesDuration && matchesFormat && matchesApproach && matchesDifficulty && matchesSearch;
  });

  const getRecommendedScore = (practice: Practice) => {
    let score = 0;
    if (practice.immediateRelief) score += 8;
    if (practice.crisisEligible) score += 5;
    if (practice.difficulty === 'Beginner') score += 3;
    if (practice.duration <= 10) score += 2;
    return score;
  };

  // Sorting
  const sortedPractices = [...filteredPractices].sort((a, b) => {
    switch (sortBy) {
      case 'duration':
        return a.duration - b.duration;
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return getRecommendedScore(b) - getRecommendedScore(a);
    }
  });

  // Active filter count
  const activeFilterCount = 
    selectedCategories.length + 
    (selectedDuration !== 'all' ? 1 : 0) +
    selectedFormats.length +
    selectedApproaches.length +
    selectedDifficulties.length;

  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim() !== '';

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedDuration('all');
    setSelectedFormats([]);
    setSelectedApproaches([]);
    setSelectedDifficulties([]);
    setSearchQuery('');
  };

  // Scroll handler for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle helpers
  const toggleMulti = (value: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (value === 'all') { setList([]); return; }
    setList(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const startPractice = (practice: Practice) => {
    setMediaInstanceKey(prev => prev + 1);
    setCurrentSession({ practice, currentTime: 0, duration: practice.duration * 60, isPlaying: true, volume: 0.7, isCompleted: false });
  };

  useEffect(() => {
    if (didAutoStartRef.current || currentSession || practices.length === 0 || typeof window === 'undefined') {
      return;
    }

    const rawPayload = window.sessionStorage.getItem(DASHBOARD_PRACTICE_AUTOSTART_KEY);
    if (!rawPayload) {
      return;
    }

    let payload: PracticeAutoStartPayload | null = null;
    try {
      payload = JSON.parse(rawPayload) as PracticeAutoStartPayload;
    } catch {
      payload = null;
    }

    window.sessionStorage.removeItem(DASHBOARD_PRACTICE_AUTOSTART_KEY);
    didAutoStartRef.current = true;

    if (!payload) {
      return;
    }

    const title = payload.title?.trim().toLowerCase();
    const matchedPractice = practices.find((practice) => {
      if (payload?.id && practice.id === payload.id) {
        return true;
      }
      if (title && practice.title.trim().toLowerCase() === title) {
        return true;
      }
      return false;
    });

    if (matchedPractice) {
      startPractice(matchedPractice);
    }
  }, [currentSession, practices]);

  const completePractice = useCallback(() => {
    if (currentSession) {
      setCurrentSession(prev => prev ? {
        ...prev,
        isCompleted: true,
        isPlaying: false
      } : null);
      setShowPostPractice(true);
    }
  }, [currentSession]);

  const resetPractice = () => {
    if (currentSession) {
      setMediaInstanceKey(prev => prev + 1);
      setCurrentSession(prev => prev ? {
        ...prev,
        currentTime: 0,
        isPlaying: true,
        isCompleted: false
      } : null);
    }
  };

  const closePractice = () => {
    setCurrentSession(null);
    setMediaInstanceKey(0);
    setShowPostPractice(false);
    setPostPracticeRating(null);
  };

  // Real-time updates come from MediaPlayer callbacks now

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'meditation': return <Heart className="h-4 w-4" />;
      case 'breathing': return <Waves className="h-4 w-4" />;
      case 'yoga': return <Users className="h-4 w-4" />;
      case 'sleep': return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'meditation': return 'bg-green-100 text-green-800';
      case 'breathing': return 'bg-blue-100 text-blue-800';
      case 'yoga': return 'bg-purple-100 text-purple-800';
      case 'sleep': return 'bg-indigo-100 text-indigo-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (currentSession) {
    const totalSeconds = currentSession.duration || (currentSession.practice.duration * 60);
    const progress = totalSeconds ? (currentSession.currentTime / totalSeconds) * 100 : 0;
    const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
    const { audioUrl, videoUrl, youtubeUrl, format, instructions } = currentSession.practice as Practice;
    const isVideoSession = Boolean(
      youtubeUrl ||
      videoUrl ||
      format === 'Video' ||
      format === 'Audio/Video'
    );
    const focusAreas = currentSession.practice.focusAreas || [];
    const progressLabel = `${formatTime(Math.floor(currentSession.currentTime))} / ${formatTime(totalSeconds)}`;

    const restartSession = () => {
      setShowPostPractice(false);
      setPostPracticeRating(null);
      setMediaInstanceKey(prev => prev + 1);
      setCurrentSession(prev => prev ? {
        ...prev,
        currentTime: 0,
        duration: prev.practice.duration * 60,
        isPlaying: true,
        isCompleted: false
      } : null);
    };

    const postPracticeModal = showPostPractice && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Practice Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Great work completing &ldquo;{currentSession.practice.title}&rdquo;. How are you feeling now?
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    variant={postPracticeRating === rating ? 'default' : 'outline'}
                    className="aspect-square"
                    onClick={() => setPostPracticeRating(rating)}
                  >
                    {rating}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    // Future hook: persist the rating before exiting the session.
                    closePractice();
                  }}
                >
                  Finish
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={restartSession}
                >
                  Practice Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );

    if (isVideoSession) {
      return (
        <div className="fixed inset-0 z-40 bg-slate-950 text-slate-100">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.22),transparent_45%)]" />

          <div className="relative h-full flex flex-col">
            <header className="border-b border-white/10 bg-slate-900/85 backdrop-blur-sm px-4 md:px-6 py-3 md:py-4 space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closePractice}
                    className="text-slate-100 hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Exit
                  </Button>
                  <Badge className="bg-sky-500/20 text-sky-100 border border-sky-300/30">
                    Video Session
                  </Badge>
                  {currentSession.practice.immediateRelief && (
                    <Badge className="bg-emerald-500/20 text-emerald-100 border border-emerald-300/30">
                      Quick Relief
                    </Badge>
                  )}
                  {currentSession.practice.crisisEligible && (
                    <Badge className="bg-amber-500/20 text-amber-100 border border-amber-300/30">
                      Crisis Safe
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={restartSession}
                    className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Restart
                  </Button>
                  <Button
                    size="sm"
                    onClick={completePractice}
                    disabled={currentSession.isCompleted}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg md:text-xl font-semibold truncate">{currentSession.practice.title}</h2>
                  <span className="text-xs md:text-sm text-slate-300 whitespace-nowrap">{progressLabel}</span>
                </div>
                <Progress value={safeProgress} className="h-1.5 bg-white/10" />
                <p className="text-xs md:text-sm text-slate-300">
                  with {currentSession.practice.instructor} • {currentSession.practice.duration} min • {currentSession.practice.difficulty}
                </p>
              </div>
            </header>

            <main className="flex-1 min-h-0 p-3 md:p-5 overflow-hidden">
              <div className="h-full max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3 md:gap-5">
                <section className="min-h-0 flex flex-col gap-3">
                  <div className="relative w-full aspect-video rounded-2xl border border-white/10 bg-black/55 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.45)]">
                    <MediaPlayer
                      key={`session-video-${currentSession.practice.id}-${mediaInstanceKey}`}
                      audioUrl={format === 'Audio' || format === 'Audio/Video' ? audioUrl : undefined}
                      videoUrl={format === 'Video' || format === 'Audio/Video' ? videoUrl : undefined}
                      youtubeUrl={youtubeUrl}
                      poster={currentSession.practice.image}
                      title={currentSession.practice.title}
                      artist={currentSession.practice.instructor}
                      autoPlay
                      fillScreen
                      className="h-full w-full rounded-none"
                      playing={currentSession.isPlaying}
                      volume={currentSession.volume}
                      variant="full"
                      onTimeUpdate={(c, d) => {
                        setCurrentSession(prev => prev ? { ...prev, currentTime: c, duration: d || prev.duration } : prev);
                      }}
                      onEnded={() => completePractice()}
                      onPlay={() => setCurrentSession(prev => prev ? { ...prev, isPlaying: true } : prev)}
                      onPause={() => setCurrentSession(prev => prev ? { ...prev, isPlaying: false } : prev)}
                      onVolumeChange={(v) => setCurrentSession(prev => prev ? { ...prev, volume: v } : prev)}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">Format</p>
                      <p className="text-sm font-medium text-slate-100 capitalize">{(currentSession.practice.format || '').toLowerCase()}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">Intensity</p>
                      <p className="text-sm font-medium text-slate-100 capitalize">
                        {(currentSession.practice.intensityLevel || currentSession.practice.difficulty || 'Balanced').toLowerCase()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">Approach</p>
                      <p className="text-sm font-medium text-slate-100 capitalize">{(currentSession.practice.approach || '').toLowerCase()}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">Type</p>
                      <p className="text-sm font-medium text-slate-100 capitalize">{(currentSession.practice.type || '').toLowerCase()}</p>
                    </div>
                  </div>
                </section>

                <aside className="min-h-[240px] lg:min-h-0 rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-sm overflow-hidden">
                  <div className="h-full overflow-y-auto p-4 md:p-5 flex flex-col gap-5">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Practice Brief</p>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {currentSession.practice.description || 'Follow the guided sequence and stay present with your breath and body cues.'}
                      </p>
                    </div>

                    {focusAreas.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Focus Areas</p>
                        <div className="flex flex-wrap gap-2">
                          {focusAreas.slice(0, 8).map((area) => (
                            <Badge key={area} className="bg-slate-800 text-slate-200 border border-slate-700">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentSession.practice.tags.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(currentSession.practice.tags)).slice(0, 10).map((tag) => (
                            <Badge key={tag} className="bg-slate-800/80 text-slate-300 border border-slate-700/80">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto grid grid-cols-1 gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                        onClick={restartSession}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" /> Start Over
                      </Button>
                      <Button
                        onClick={completePractice}
                        disabled={currentSession.isCompleted}
                      >
                        <SkipForward className="h-4 w-4 mr-2" /> Complete Session
                      </Button>
                    </div>
                  </div>
                </aside>
              </div>
            </main>
          </div>

          {postPracticeModal}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-6 page-enter">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <ImageWithFallback
                src={currentSession.practice.image}
                alt={currentSession.practice.title}
                className="w-24 h-24 rounded-full mx-auto object-cover shadow-lg"
              />
              <h2 className="text-xl font-semibold">{currentSession.practice.title}</h2>
              <p className="text-sm text-muted-foreground">
                with {currentSession.practice.instructor}
              </p>
            </div>

            <div className="space-y-4">
              {format === 'Text' ? (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-left max-h-[300px] overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Instructions</p>
                  <div className="space-y-2.5">
                    {instructions && instructions.length > 0 ? (
                      instructions.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary font-mono mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No instructions available.</p>
                    )}
                  </div>
                </div>
              ) : (
                <MediaPlayer
                  key={`session-audio-${currentSession.practice.id}-${mediaInstanceKey}`}
                  audioUrl={format === 'Audio' || format === 'Audio/Video' ? audioUrl : undefined}
                  videoUrl={format === 'Video' || format === 'Audio/Video' ? videoUrl : undefined}
                  youtubeUrl={youtubeUrl}
                  poster={currentSession.practice.image}
                  title={currentSession.practice.title}
                  artist={currentSession.practice.instructor}
                  autoPlay
                  playing={currentSession.isPlaying}
                  volume={currentSession.volume}
                  variant="full"
                  onTimeUpdate={(c, d) => {
                    setCurrentSession(prev => prev ? { ...prev, currentTime: c, duration: d || prev.duration } : prev);
                  }}
                  onEnded={() => completePractice()}
                  onPlay={() => setCurrentSession(prev => prev ? { ...prev, isPlaying: true } : prev)}
                  onPause={() => setCurrentSession(prev => prev ? { ...prev, isPlaying: false } : prev)}
                  onVolumeChange={(v) => setCurrentSession(prev => prev ? { ...prev, volume: v } : prev)}
                />
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetPractice}
                disabled={currentSession.currentTime === 0}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={completePractice}
                disabled={currentSession.isCompleted}
                className="gap-2"
              >
                <SkipForward className="h-4 w-4" />
                Complete
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={closePractice}
            >
              Exit Practice
            </Button>
          </CardContent>
        </Card>

        {postPracticeModal}
      </div>
    );
  }

  return (
    <ResponsiveContainer>
      <div className="min-h-screen bg-background page-enter">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
            <div className={`flex items-center gap-4 ${device.isMobile ? 'mb-4' : 'mb-6'}`}>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onNavigate('dashboard')}
                className="min-h-[44px] touch-manipulation"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>

            <div className={`space-y-2 ${device.isMobile ? 'mb-4' : 'mb-6'}`}>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
                Mindful Practices
              </h1>
              <p className={`text-muted-foreground ${device.isMobile ? 'text-sm truncate' : 'text-lg'}`}>
                Guided meditations, breathing exercises, and gentle yoga practices for your wellbeing
              </p>
            </div>

            {/* Search */}
            {device.isMobile ? (
              <div className="relative">
                <Search 
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" 
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input');
                    input?.focus();
                    input?.select();
                  }}
                />
                <Input
                  placeholder={t('practices.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 h-11 text-base"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 touch-manipulation"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="relative max-w-xl">
                <Search 
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer" 
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input');
                    input?.focus();
                    input?.select();
                  }}
                />
                <Input
                  placeholder={t('practices.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-12 h-12"
                />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        
        {/* Sticky Filter Toolbar */}
        <div className={`${device.isMobile ? 'sticky top-0 z-10 bg-background -mx-4 px-4 py-3 border-b mb-4' : 'mb-6'}`}>
          <div className="flex items-center justify-between gap-3">
            {/* Mobile: Filter button + result count */}
            {device.isMobile ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterSheetOpen(true)}
                  className="flex items-center gap-2 min-h-[44px]"
                  aria-label={`Open filters, ${activeFilterCount} active`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 min-w-[20px] h-5 flex items-center justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                
                <div className="text-sm text-muted-foreground">
                  {sortedPractices.length} {sortedPractices.length === 1 ? 'practice' : 'practices'}
                </div>

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as PracticeSortKey)}
                  aria-label="Sort practices"
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="recommended">Recommended</option>
                  <option value="duration">Shortest First</option>
                  <option value="title">Title A-Z</option>
                </select>
                
                {/* View toggle */}
                <div className="flex gap-1 bg-muted rounded-md p-1">
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8 w-8 p-0"
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 w-8 p-0"
                    aria-label="Grid view"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              /* Desktop: Inline filter chips */
              <div className="flex flex-wrap items-center gap-3 w-full">
                {/* Practice Type */}
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 4).map(category => {
                    const Icon = category.icon;
                    const active = selectedCategories.length === 0 ? category.id === 'all' : selectedCategories.includes(category.id);
                    return (
                      <Button
                        key={category.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={active}
                        onClick={() => toggleMulti(category.id, selectedCategories, setSelectedCategories)}
                        className={`flex items-center gap-1 transition-all ${active ? 'shadow-sm' : ''}`}
                      >
                        <Icon className="h-4 w-4" />
                        {category.label}
                      </Button>
                    );
                  })}
                </div>
                
                {/* More filters button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  More
                  {activeFilterCount > 4 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 min-w-[20px] h-5">
                      {activeFilterCount - 4}
                    </Badge>
                  )}
                </Button>
                
                <div className="ml-auto flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    {sortedPractices.length} {sortedPractices.length === 1 ? 'practice' : 'practices'}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as PracticeSortKey)}
                    aria-label="Sort practices"
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="duration">Shortest First</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile Bottom Sheet for Filters */}
        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
          <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
            <SheetHeader className="px-4 py-4 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle>Filters</SheetTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="h-8 w-8 p-0"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {/* Sort */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Sort By</h3>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as PracticeSortKey)}
                  aria-label="Sort practices"
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="recommended">Recommended</option>
                  <option value="duration">Shortest First</option>
                  <option value="title">Title A-Z</option>
                </select>
              </div>

              {/* Practice Type */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Practice Type</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => {
                    const Icon = category.icon;
                    const active = selectedCategories.length === 0 ? category.id === 'all' : selectedCategories.includes(category.id);
                    return (
                      <Button
                        key={category.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMulti(category.id, selectedCategories, setSelectedCategories)}
                        className="min-h-[44px] flex items-center gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {category.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Format */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Format</h3>
                <div className="flex flex-wrap gap-2">
                  {formats.map(f => {
                    const Icon = f.icon;
                    const active = selectedFormats.length === 0 ? f.id === 'all' : selectedFormats.includes(f.id);
                    return (
                      <Button
                        key={f.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMulti(f.id, selectedFormats, setSelectedFormats)}
                        className="min-h-[44px] flex items-center gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {f.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Duration */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Duration</h3>
                <div className="flex flex-wrap gap-2">
                  {durations.map(d => {
                    const active = selectedDuration === d.id;
                    return (
                      <Button
                        key={d.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedDuration(d.id)}
                        className="min-h-[44px] flex items-center gap-2"
                      >
                        <Timer className="h-4 w-4" />
                        {d.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Advanced Filters */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center justify-between w-full text-sm font-semibold"
                >
                  <span>Advanced Filters</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                </button>
                
                {showAdvancedFilters && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    {/* Approach */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground">Approach</h4>
                      <div className="flex flex-wrap gap-2">
                        {approaches.map(a => {
                          const Icon = a.icon;
                          const active = selectedApproaches.length === 0 ? a.id === 'all' : selectedApproaches.includes(a.id);
                          return (
                            <Button
                              key={a.id}
                              variant={active ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleMulti(a.id, selectedApproaches, setSelectedApproaches)}
                              className="min-h-[44px] flex items-center gap-2"
                            >
                              <Icon className="h-4 w-4" />
                              {a.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Difficulty */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground">Difficulty</h4>
                      <div className="flex flex-wrap gap-2">
                        {difficulties.map(d => {
                          const Icon = d.icon;
                          const active = selectedDifficulties.length === 0 ? d.id === 'all' : selectedDifficulties.includes(d.id);
                          return (
                            <Button
                              key={d.id}
                              variant={active ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleMulti(d.id, selectedDifficulties, setSelectedDifficulties)}
                              className="min-h-[44px] flex items-center gap-2"
                            >
                              <Icon className="h-4 w-4" />
                              {d.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <SheetFooter className="px-4 py-4 border-t flex-row gap-3">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="flex-1 min-h-[44px]"
              >
                Clear All
              </Button>
              <Button
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 min-h-[44px]"
              >
                Apply Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        
        {/* Desktop Advanced Filters */}
        {!device.isMobile && showAdvancedFilters && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-wrap gap-6">
              {/* Format */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Format</span>
                <div className="flex flex-wrap gap-2">
                  {formats.map(f => {
                    const Icon = f.icon;
                    const active = selectedFormats.length === 0 ? f.id === 'all' : selectedFormats.includes(f.id);
                    return (
                      <Button
                        key={f.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMulti(f.id, selectedFormats, setSelectedFormats)}
                        className="flex items-center gap-1"
                      >
                        <Icon className="h-4 w-4" />
                        {f.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Duration */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Duration</span>
                <div className="flex flex-wrap gap-2">
                  {durations.map(d => {
                    const active = selectedDuration === d.id;
                    return (
                      <Button
                        key={d.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedDuration(d.id)}
                        className="flex items-center gap-1"
                      >
                        <Timer className="h-4 w-4" />
                        {d.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Approach */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Approach</span>
                <div className="flex flex-wrap gap-2">
                  {approaches.map(a => {
                    const Icon = a.icon;
                    const active = selectedApproaches.length === 0 ? a.id === 'all' : selectedApproaches.includes(a.id);
                    return (
                      <Button
                        key={a.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMulti(a.id, selectedApproaches, setSelectedApproaches)}
                        className="flex items-center gap-1"
                      >
                        <Icon className="h-4 w-4" />
                        {a.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              {/* Difficulty */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Difficulty</span>
                <div className="flex flex-wrap gap-2">
                  {difficulties.map(d => {
                    const Icon = d.icon;
                    const active = selectedDifficulties.length === 0 ? d.id === 'all' : selectedDifficulties.includes(d.id);
                    return (
                      <Button
                        key={d.id}
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMulti(d.id, selectedDifficulties, setSelectedDifficulties)}
                        className="flex items-center gap-1"
                      >
                        <Icon className="h-4 w-4" />
                        {d.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className={`mb-4 ${device.isMobile ? 'space-y-2' : ''}`}>
            {device.isMobile ? (
              <>
                <button
                  onClick={() => setIsActiveFiltersExpanded(!isActiveFiltersExpanded)}
                  className="flex items-center gap-2 text-sm font-medium min-h-[44px] w-full justify-between"
                >
                  <span>{activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isActiveFiltersExpanded ? 'rotate-180' : ''}`} />
                </button>
                
                {isActiveFiltersExpanded && (
                  <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                    {selectedCategories.map(catId => {
                      const cat = categories.find(c => c.id === catId);
                      return cat ? (
                        <Badge key={catId} variant="secondary" className="gap-1">
                          {cat.label}
                          <button onClick={() => toggleMulti(catId, selectedCategories, setSelectedCategories)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                    {searchQuery && (
                      <Badge variant="secondary" className="gap-1">
                        Search: {searchQuery}
                        <button onClick={() => setSearchQuery('')}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="h-6 px-2 text-xs"
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {selectedCategories.map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  return cat ? (
                    <Badge key={catId} variant="secondary" className="gap-1">
                      {cat.label}
                      <button onClick={() => toggleMulti(catId, selectedCategories, setSelectedCategories)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {searchQuery}
                    <button onClick={() => setSearchQuery('')}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 px-2 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Practices List/Grid */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className={device.isMobile || viewMode === 'list' ? 'flex gap-3 p-3' : 'overflow-hidden'}>
                {device.isMobile || viewMode === 'list' ? (
                  <>
                    <div className="w-32 h-20 bg-muted rounded animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-full animate-pulse" />
                      <div className="h-8 bg-muted rounded w-full animate-pulse" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full h-48 bg-muted animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-full animate-pulse" />
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
        
        {error && !loading && (
          <Card className="p-6 text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        )}
        
        {!loading && !error && sortedPractices.length === 0 && (
          <Card className="p-8 text-center space-y-4">
            <h3 className="text-lg font-semibold text-foreground">No practices found</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters ? "Try adjusting your filters" : "No practices available"}
            </p>
            {hasActiveFilters && (
              <div className="space-y-3">
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Try:</p>
                  <ul className="list-disc list-inside">
                    <li>Selecting &lsquo;All&rsquo; in categories</li>
                    <li>Expanding duration range</li>
                    <li>Including more formats</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>
        )}
        
        {/* Mobile List View */}
        {!loading && !error && (device.isMobile || viewMode === 'list') && sortedPractices.length > 0 && (
          <StaggerContainer staggerDelay={0.08}>
            <div className="space-y-3">
              {sortedPractices.map((practice) => (
                <StaggerItem key={practice.id}>
                  <Card className="flex gap-3 p-3 hover:shadow-md transition-shadow">
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0 w-32 h-20 rounded overflow-hidden">
                      <ImageWithFallback
                        src={practice.image}
                        alt={practice.title}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Duration badge */}
                      <Badge className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5">
                        {practice.duration}min
                      </Badge>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      {/* Title */}
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                        {practice.title}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {practice.description}
                      </p>
                      
                      {/* Meta row */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          {getTypeIcon(practice.type)}
                          <span className="capitalize">{practice.type}</span>
                        </div>
                        <span>•</span>
                        <span className={getDifficultyColor(practice.difficulty)}>{practice.difficulty}</span>
                      </div>
                      
                      {/* Tags */}
                      {(practice.immediateRelief || practice.crisisEligible) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {practice.immediateRelief && (
                            <Badge className="bg-rose-100 text-rose-700 text-xs px-1.5 py-0">Quick Relief</Badge>
                          )}
                          {practice.crisisEligible && (
                            <Badge className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0">Crisis-Safe</Badge>
                          )}
                        </div>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {practice.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                        {practice.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            +{practice.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                      
                      {/* CTA */}
                      <Button 
                        size="sm"
                        className="w-full mt-auto min-h-[44px]"
                        onClick={() => startPractice(practice)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {t('practices.startPractice')}
                      </Button>
                    </div>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        )}
        
        {/* Desktop Grid View */}
        {!loading && !error && !device.isMobile && viewMode === 'grid' && sortedPractices.length > 0 && (
          <StaggerContainer staggerDelay={0.08}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPractices.map((practice) => (
                <StaggerItem key={practice.id}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <ImageWithFallback
                      src={practice.image}
                      alt={practice.title}
                      className="w-full h-48 object-cover"
                    />
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center group">
                      <Button 
                        size="lg"
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full w-16 h-16"
                        onClick={() => startPractice(practice)}
                      >
                        <Play className="h-6 w-6" />
                      </Button>
                    </div>

                    {/* Duration badge */}
                    <Badge className="absolute top-2 left-2 bg-black/70 text-white">
                      {practice.duration} min
                    </Badge>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge 
                          className={getTypeColor(practice.type)}
                        >
                          <div className="flex items-center gap-1">
                            {getTypeIcon(practice.type)}
                            <span className="capitalize">{practice.type}</span>
                          </div>
                        </Badge>
                        
                        <Badge 
                          variant="outline"
                          className={getDifficultyColor(practice.difficulty)}
                        >
                          {practice.difficulty}
                        </Badge>
                      </div>

                  <h3 className="text-lg font-semibold text-foreground leading-tight">{practice.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {practice.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>with {practice.instructor}</span>
                  <div className="flex items-center gap-2">
                    {practice.hasDownload && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                    {practice.immediateRelief && (
                      <Badge className="bg-rose-100 text-rose-700 text-xs">Quick Relief</Badge>
                    )}
                    {practice.crisisEligible && (
                      <Badge className="bg-orange-100 text-orange-700 text-xs">Crisis-Safe</Badge>
                    )}
                  {practice.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <Button 
                  className="w-full"
                  onClick={() => startPractice(practice)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('practices.startPractice')}
                </Button>
              </CardContent>
                </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        )}
        
        {/* Back to Top Button */}
        {showBackToTop && (
          <Button
            size="icon"
            className="fixed bottom-20 right-4 z-20 rounded-full shadow-lg min-h-[48px] min-w-[48px] animate-in fade-in slide-in-from-bottom-4"
            onClick={scrollToTop}
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
    </ResponsiveContainer>
  );
}
