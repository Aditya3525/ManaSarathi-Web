import { 
  ArrowLeft,
  Search,
  Play,
  ExternalLink,
  BookOpen,
  Headphones,
  Video,
  FileText,
  Clock,
  Star,
  Bookmark,
  Filter,
  Heart,
  Brain,
  Users,
  Activity,
  AlertCircle,
  Cloud,
  Layers,
  Share2,
  X,
  ChevronDown,
  SlidersHorizontal,
  Grid3x3,
  List,
  Sparkles,
  RefreshCw,
  Timer
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { getApiBaseUrl } from '../../../config/apiConfig';
import { useDevice } from '../../../hooks/use-device';
import { ImageWithFallback } from '../../common/ImageWithFallback';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import {
  ResponsiveContainer
} from '../../ui/responsive-layout';
import { StaggerContainer, StaggerItem } from '../../ui/motion-wrapper';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter
} from '../../ui/sheet';

import { ContentCard } from './ContentCard';
import { ContentRow } from './ContentRow';
import { FeaturedBanner } from './FeaturedBanner';
import { MediaPlayerDialog } from './MediaPlayerDialog';
import type { LibraryDisplayType, LibraryItem } from './types';

interface UserLike { approach?: 'western' | 'eastern' | 'hybrid' | 'all'; }

interface ContentLibraryProps {
  onNavigate: (page: string) => void;
  user?: UserLike;
}

type ContentSortKey = 'relevance' | 'popular' | 'duration' | 'title';

const youtubeThumbFromId = (id?: string | null) => (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null);

const isProbablyUrl = (value?: string | null) => {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
};

const extractFirstUrlFromText = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : null;
};

const extractYouTubeId = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').split(/[?&#]/)[0] || null;
    }
    const vParam = url.searchParams.get('v');
    if (vParam) return vParam;
    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/')[2] || null;
    }
    if (url.pathname.startsWith('/shorts/')) {
      return url.pathname.split('/')[2] || null;
    }
  } catch (e) {
    return trimmed.length <= 20 ? trimmed : null;
  }
  return trimmed.length <= 20 ? trimmed : null;
};

const parseTags = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const parseDuration = (raw: unknown): { label: string | null; seconds: number | null } => {
  if (!raw) return { label: null, seconds: null };
  const numeric = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { label: null, seconds: null };
  }
  if (numeric >= 3600) {
    const hours = Math.floor(numeric / 3600);
    const mins = Math.round((numeric % 3600) / 60);
    return { label: `${hours}h ${mins}m`, seconds: Math.round(numeric) };
  }
  if (numeric > 60) {
    const mins = Math.round(numeric / 60);
    return { label: `${mins} min`, seconds: Math.round(numeric) };
  }
  return { label: `${Math.round(numeric)} min`, seconds: Math.round(numeric * 60) };
};

const parseStringArray = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }
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
        // Fall back to comma-separated parsing.
      }
    }
    return trimmed.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
};

const normalizeDisplayType = (rawType?: string | null, rawContentType?: string | null): LibraryDisplayType => {
  const normalizedType = String(rawType || '').trim().toLowerCase();
  if (normalizedType === 'video' || normalizedType === 'audio' || normalizedType === 'article' || normalizedType === 'playlist' || normalizedType === 'story') {
    return normalizedType;
  }

  const normalizedContentType = String(rawContentType || '').trim().toUpperCase();
  if (normalizedContentType === 'VIDEO') return 'video';
  if (normalizedContentType === 'AUDIO_MEDITATION') return 'audio';
  if (normalizedContentType === 'STORY') return 'story';
  if (normalizedContentType === 'JOURNAL_PROMPT' || normalizedContentType === 'CBT_WORKSHEET' || normalizedContentType === 'PSYCHOEDUCATION' || normalizedContentType === 'CRISIS_RESOURCE') {
    return 'resource';
  }

  return 'article';
};

const isTextualDisplayType = (displayType: LibraryDisplayType): boolean =>
  displayType === 'article' || displayType === 'story' || displayType === 'resource';

interface RecommendationApiItem {
  id?: string;
  title?: string;
  description?: string | null;
  type?: string;
  contentType?: string | null;
  category?: string | null;
  approach?: string | null;
  duration?: number | string | null;
  difficulty?: string | null;
  tags?: string[] | string | null;
  focusAreas?: string[] | string | null;
  immediateRelief?: boolean;
  url?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  reason?: string;
  source?: string;
}

interface RecommendationApiResponse {
  success?: boolean;
  data?: {
    items?: RecommendationApiItem[];
    focusAreas?: string[];
    rationale?: string;
    crisisLevel?: string;
  };
  recommendations?: RecommendationApiItem[];
  crisisLevel?: string;
  rationale?: string;
}

const normalizeApproach = (rawApproach?: string | null): LibraryItem['approach'] => {
  const approach = rawApproach ? rawApproach.toLowerCase() : 'all';
  return ['western', 'eastern', 'hybrid', 'all'].includes(approach)
    ? (approach as LibraryItem['approach'])
    : 'all';
};

const mapRecommendationToLibraryItem = (item: RecommendationApiItem, index: number): LibraryItem | null => {
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) return null;

  const displayType = (() => {
    const normalizedType = String(item.type || '').toLowerCase();
    const normalizedContentType = String(item.contentType || '').toUpperCase();

    if (normalizedType === 'practice') return 'audio' as const;
    if (normalizedContentType === 'VIDEO') return 'video' as const;
    if (normalizedContentType.startsWith('AUDIO')) return 'audio' as const;

    const videoCandidate = item.videoUrl || item.url;
    if (extractYouTubeId(videoCandidate) || /^https?:\/\//i.test(String(videoCandidate || '')) && String(videoCandidate).includes('youtube')) {
      return 'video' as const;
    }

    if (isProbablyUrl(item.audioUrl)) return 'audio' as const;
    return 'resource' as const;
  })();

  const youtubeId = extractYouTubeId(item.videoUrl || item.url);
  const duration = parseDuration(item.duration);
  const normalizedTags = Array.from(
    new Set([
      ...parseTags(item.tags),
      ...parseStringArray(item.focusAreas)
    ])
  );

  const externalUrl = isProbablyUrl(item.url) ? String(item.url).trim() : null;
  const media: LibraryItem['media'] = (displayType === 'video' || youtubeId)
    ? {
        kind: 'video',
        src: isProbablyUrl(item.videoUrl) ? String(item.videoUrl).trim() : (externalUrl || undefined),
        youtubeId,
        poster: youtubeThumbFromId(youtubeId) || undefined
      }
    : (displayType === 'audio' && isProbablyUrl(item.audioUrl))
      ? {
          kind: 'audio',
          src: String(item.audioUrl).trim()
        }
      : null;

  return {
    id: item.id || `recommended-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    description: item.description || item.reason || '',
    category: item.category || 'Recommended',
    approach: normalizeApproach(item.approach),
    difficulty: item.difficulty || 'Beginner',
    durationLabel: duration.label,
    durationSeconds: duration.seconds,
    tags: normalizedTags,
    thumbnail: youtubeThumbFromId(youtubeId),
    rating: 5,
    author: item.source ? `AI ${item.source}` : 'AI Guide',
    displayType,
    media,
    body: displayType === 'resource' ? (item.description || item.reason || null) : null,
    externalUrl,
    contentType: item.contentType || null,
    focusAreas: parseStringArray(item.focusAreas),
    immediateRelief: Boolean(item.immediateRelief),
    crisisEligible: String(item.type || '').toLowerCase() === 'crisis-resource',
    intensityLevel: null,
    source: String(item.type || '').toLowerCase() === 'practice' ? 'practice' : 'content',
    raw: item as unknown as Record<string, unknown>
  } satisfies LibraryItem;
};

export function ContentLibrary({ onNavigate, user }: ContentLibraryProps) {
  const device = useDevice();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    const saved = window.sessionStorage.getItem('content_library_search');
    if (saved) {
      window.sessionStorage.removeItem('content_library_search');
      return saved;
    }
    return '';
  });
  const [sortBy, setSortBy] = useState<ContentSortKey>('relevance');
  // Multi-select filters
  const [selectedApproach, setSelectedApproach] = useState<'all' | 'western' | 'eastern' | 'hybrid'>(user?.approach || 'all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // empty => all
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]); // empty => all
  const [selectedDuration, setSelectedDuration] = useState<string>('all');
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(device.isMobile ? 'list' : 'grid');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isActiveFiltersExpanded, setIsActiveFiltersExpanded] = useState(true);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [animateKey, setAnimateKey] = useState(0);

  const [contentItems, setContentItems] = useState<LibraryItem[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<LibraryItem[]>([]);
  const [recommendationRationale, setRecommendationRationale] = useState<string | null>(null);
  const [recommendationCrisisLevel, setRecommendationCrisisLevel] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null);
  const [activeStory, setActiveStory] = useState<LibraryItem | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  const loadRecommendations = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRecommendedItems([]);
      setRecommendationRationale(null);
      setRecommendationCrisisLevel(null);
      return;
    }

    setRecommendationLoading(true);
    setRecommendationError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/recommendations/personalized`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load recommendations');
      }

      const payload: RecommendationApiResponse = await response.json();
      const rawItems = payload.data?.items || payload.recommendations || [];
      const mapped = rawItems
        .map((item, index) => mapRecommendationToLibraryItem(item, index))
        .filter((item): item is LibraryItem => Boolean(item));

      setRecommendedItems(mapped.slice(0, 4));
      setRecommendationRationale(payload.data?.rationale || payload.rationale || null);
      setRecommendationCrisisLevel(payload.data?.crisisLevel || payload.crisisLevel || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load recommendations';
      setRecommendationError(message);
      setRecommendedItems([]);
      setRecommendationRationale(null);
      setRecommendationCrisisLevel(null);
    } finally {
      setRecommendationLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('content-library-bookmarks');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setBookmarkedIds(parsed.map((value) => String(value)).filter(Boolean));
      }
    } catch {
      setBookmarkedIds([]);
    }
  }, []);

  const persistBookmarks = (nextBookmarks: string[]) => {
    setBookmarkedIds(nextBookmarks);
    try {
      localStorage.setItem('content-library-bookmarks', JSON.stringify(nextBookmarks));
    } catch {
      // Ignore persistence failure and keep in-memory state.
    }
  };

  const toggleBookmark = (itemId: string) => {
    const nextBookmarks = bookmarkedIds.includes(itemId)
      ? bookmarkedIds.filter((id) => id !== itemId)
      : [...bookmarkedIds, itemId];
    persistBookmarks(nextBookmarks);
  };

  const handleShareItem = async (item: LibraryItem) => {
    const primaryUrl = item.externalUrl || item.media?.src || (item.media?.youtubeId ? `https://www.youtube.com/watch?v=${item.media.youtubeId}` : null);
    const shareData = {
      title: item.title,
      text: item.description || item.title,
      url: primaryUrl || window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard && shareData.url) {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      // Ignore cancellation or capability errors.
    }
  };

  const openLibraryItem = (item: LibraryItem) => {
    if (item.displayType === 'story' || item.displayType === 'article' || item.displayType === 'resource') {
      setActiveStory(item);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveItem(item);
  };

  const applyFeaturedCollection = (query: string) => {
    setSearchQuery(query);
    setSelectedCategories([]);
    setSelectedTypes([]);
    setSelectedApproach('all');
    setSortBy('relevance');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [practicesResp, contentResp] = await Promise.all([
          fetch(`${getApiBaseUrl()}/practices`),
          (async () => {
            const primary = await fetch(`${getApiBaseUrl()}/public-content`);
            if (primary.ok || primary.status !== 404) {
              return primary;
            }
            // Backward-compatible fallback for older deployments.
            return fetch(`${getApiBaseUrl()}/public/content`);
          })()
        ]);

        type RawPractice = {
          id: string;
          title: string;
          description?: string | null;
          duration?: number | string | null;
          difficulty?: string | null;
          approach?: string | null;
          tags?: string | string[] | null;
          thumbnailUrl?: string | null;
          format?: string | null;
          audioUrl?: string | null;
          videoUrl?: string | null;
          youtubeUrl?: string | null;
        };

        type RawContent = {
          id: string;
          title: string;
          type?: string | null;
          contentType?: string | null;
          category?: string | null;
          approach?: string | null;
          description?: string | null;
          youtubeUrl?: string | null;
          thumbnailUrl?: string | null;
          difficulty?: string | null;
          intensityLevel?: string | null;
          focusAreas?: string | string[] | null;
          immediateRelief?: boolean | null;
          crisisEligible?: boolean | null;
          duration?: string | number | null;
          tags?: string | string[] | null;
          content?: string | null;
          sourceUrl?: string | null;
          sourceName?: string | null;
        };

        let practices: RawPractice[] = [];
        if (practicesResp.ok) {
          const json = await practicesResp.json();
          if (json.success && Array.isArray(json.data)) {
            practices = json.data;
          }
        }

        let publicContent: RawContent[] = [];
        if (contentResp.ok) {
          const json = await contentResp.json();
          if (json.success && Array.isArray(json.data)) {
            publicContent = json.data;
          }
        }

        const mappedPractices: LibraryItem[] = practices.map((p) => {
          const duration = parseDuration(p.duration);
          const approach = p.approach ? p.approach.toLowerCase() : 'all';
          const normalizedApproach = ['western', 'eastern', 'hybrid', 'all'].includes(approach) ? (approach as LibraryItem['approach']) : 'all';
          const youtubeId = extractYouTubeId(p.youtubeUrl) || extractYouTubeId(p.audioUrl);
          const format = (p.format || '').toLowerCase();
          const isVideoFormat = format === 'video';
          const audioSrc = isProbablyUrl(p.audioUrl) ? p.audioUrl!.trim() : undefined;
          const videoSrc = isProbablyUrl(p.videoUrl) ? p.videoUrl!.trim() : undefined;
          const thumbnail = p.thumbnailUrl || youtubeThumbFromId(youtubeId) || 'https://images.unsplash.com/photo-1526404085026-8a631c921f0c?auto=format&fit=crop&w=1200&q=60';

          return {
            id: p.id,
            title: p.title,
            description: p.description || '',
            category: 'Practice',
            approach: normalizedApproach,
            difficulty: (p.difficulty && ['Beginner', 'Intermediate', 'Advanced'].includes(p.difficulty)) ? (p.difficulty as LibraryItem['difficulty']) : 'Beginner',
            durationLabel: duration.label ?? (p.duration ? `${p.duration} min` : null),
            durationSeconds: duration.seconds,
            tags: parseTags(p.tags),
            thumbnail,
            rating: 5,
            author: 'Guided Practice Coach',
            displayType: isVideoFormat ? 'video' : 'audio',
            media: (isVideoFormat || youtubeId)
              ? {
                  kind: 'video',
                  src: videoSrc,
                  youtubeId,
                  poster: thumbnail
                }
              : audioSrc
                ? {
                    kind: 'audio',
                    src: audioSrc,
                    poster: thumbnail
                  }
                : null,
            body: null,
            source: 'practice',
            raw: p
          } satisfies LibraryItem;
        });

        const mappedContent: LibraryItem[] = publicContent.map((item) => {
          const displayType = normalizeDisplayType(item.type, item.contentType);
          const youtubeId = extractYouTubeId(item.youtubeUrl) || extractYouTubeId(item.content);
          const duration = parseDuration(item.duration);
          const thumbnail = item.thumbnailUrl || youtubeThumbFromId(youtubeId) || 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1200&q=60';
          const contentValue = typeof item.content === 'string' ? item.content.trim() : '';
          const mediaSource = isProbablyUrl(contentValue) ? contentValue : undefined;
          const approach = item.approach ? item.approach.toLowerCase() : 'all';
          const normalizedApproach = ['western', 'eastern', 'hybrid', 'all'].includes(approach) ? (approach as LibraryItem['approach']) : 'all';
          const focusAreas = parseStringArray(item.focusAreas);
          const immediateRelief = Boolean(item.immediateRelief);
          const crisisEligible = Boolean(item.crisisEligible);
          const normalizedTags = Array.from(new Set([...parseTags(item.tags), ...focusAreas]));

          const sourceUrl = typeof item.sourceUrl === 'string' && isProbablyUrl(item.sourceUrl)
            ? item.sourceUrl.trim()
            : null;
          const embeddedUrl = extractFirstUrlFromText(contentValue);
          const externalUrl = sourceUrl || (isProbablyUrl(contentValue) ? contentValue : embeddedUrl);
          const textualBody = isTextualDisplayType(displayType)
            ? (!isProbablyUrl(contentValue) && contentValue ? contentValue : (item.description || null))
            : null;

          let media: LibraryItem['media'] = null;
          if (displayType === 'video') {
            media = {
              kind: 'video',
              src: mediaSource,
              youtubeId,
              poster: thumbnail
            };
          } else if (displayType === 'audio' && (mediaSource || youtubeId)) {
            media = youtubeId
              ? {
                  kind: 'video',
                  src: mediaSource,
                  youtubeId,
                  poster: thumbnail
                }
              : {
                  kind: 'audio',
                  src: mediaSource!,
                  poster: thumbnail
                };
          } else if (displayType === 'playlist' && (mediaSource || youtubeId)) {
            media = {
              kind: 'video',
              src: mediaSource,
              youtubeId,
              poster: thumbnail,
            };
          }

          return {
            id: item.id,
            title: item.title,
            description: item.description || '',
            category: item.category || 'Content',
            approach: normalizedApproach,
            difficulty: item.difficulty as LibraryItem['difficulty'],
            durationLabel: duration.label,
            durationSeconds: duration.seconds,
            tags: normalizedTags,
            thumbnail,
            rating: 4.6,
            author: item.sourceName || 'Wellbeing Studio',
            displayType,
            media,
            body: textualBody,
            externalUrl,
            contentType: item.contentType || null,
            focusAreas,
            immediateRelief,
            crisisEligible,
            intensityLevel: item.intensityLevel || null,
            source: 'content',
            raw: item
          } satisfies LibraryItem;
        });

        const combined = [...mappedContent, ...mappedPractices];
        setContentItems(combined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load content';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const didAutoOpenRef = useRef(false);

  useEffect(() => {
    if (didAutoOpenRef.current || contentItems.length === 0 || typeof window === 'undefined') {
      return;
    }

    const rawPayload = window.sessionStorage.getItem('mw-content-autoopen');
    if (!rawPayload) return;

    window.sessionStorage.removeItem('mw-content-autoopen');
    didAutoOpenRef.current = true;

    try {
      const payload = JSON.parse(rawPayload);
      const matchedItem = contentItems.find(item => {
        if (payload?.id && item.id === payload.id) return true;
        if (payload?.title && item.title.trim().toLowerCase() === payload.title.trim().toLowerCase()) return true;
        return false;
      });

      if (matchedItem) {
        openLibraryItem(matchedItem);
      }
    } catch (e) {
      console.error('Error auto-opening content:', e);
    }
  }, [contentItems]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const categories = [
    { id: 'all', label: 'All', icon: Heart },
    { id: 'Mindfulness', label: 'Mindfulness', icon: Heart },
    { id: 'Anxiety', label: 'Anxiety', icon: AlertCircle },
    { id: 'Stress Management', label: 'Stress Management', icon: Activity },
    { id: 'Relaxation', label: 'Relaxation', icon: Cloud },
    { id: 'Emotional Intelligence', label: 'Emotional Intelligence', icon: Brain },
    { id: 'Series', label: 'Series', icon: Layers },
    { id: 'Practice', label: 'Guided Practice', icon: Headphones }
  ];

  const types = [
    { id: 'all', label: 'All', icon: Filter },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'audio', label: 'Audio', icon: Headphones },
    { id: 'article', label: 'Article', icon: BookOpen },
    { id: 'playlist', label: 'Playlist', icon: Play },
    { id: 'story', label: 'Story', icon: BookOpen },
    { id: 'resource', label: 'Guide/Tool', icon: FileText }
  ];

  const durations = [
    { id: 'all', label: 'Any Duration' },
    { id: 'short', label: '5-10 minutes' },
    { id: 'medium', label: '10-20 minutes' },
    { id: 'long', label: '20+ minutes' }
  ];

  const difficulties = [
    { id: 'all', label: 'All Levels', icon: Layers },
    { id: 'Beginner', label: 'Beginner', icon: Layers },
    { id: 'Intermediate', label: 'Intermediate', icon: Layers },
    { id: 'Advanced', label: 'Advanced', icon: Layers }
  ];

  const filteredContent = contentItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q));
    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.includes(item.category || 'Content');
    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(item.displayType);
    const matchesApproach =
      selectedApproach === 'hybrid' || selectedApproach === 'all' ||
      (item.approach && item.approach === selectedApproach) ||
      item.approach === 'all' || item.approach === 'hybrid';
      
    const durationMins = item.durationSeconds ? item.durationSeconds / 60 : 0;
    const matchesDuration = selectedDuration === 'all' || 
      (selectedDuration === 'short' && durationMins <= 10) ||
      (selectedDuration === 'medium' && durationMins > 10 && durationMins <= 20) ||
      (selectedDuration === 'long' && durationMins > 20);
      
    const matchesDifficulty = selectedDifficulties.length === 0 || selectedDifficulties.includes(item.difficulty || 'Beginner');

    return matchesSearch && matchesCategory && matchesType && matchesApproach && matchesDuration && matchesDifficulty;
  });

  const getRelevanceScore = (item: LibraryItem) => {
    const query = searchQuery.trim().toLowerCase();
    let score = 0;
    if (query) {
      if (item.title.toLowerCase().includes(query)) score += 50;
      if ((item.description || '').toLowerCase().includes(query)) score += 20;
      if (item.tags.some((tag) => tag.toLowerCase().includes(query))) score += 15;
    }
    if (selectedApproach !== 'hybrid' && selectedApproach !== 'all' && item.approach === selectedApproach) score += 12;
    if (item.immediateRelief) score += 6;
    score += item.rating || 0;
    return score;
  };

  // Sort filtered content
  const sortedContent = [...filteredContent].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return (b.rating || 0) - (a.rating || 0);
      case 'duration':
        return (a.durationSeconds || 0) - (b.durationSeconds || 0);
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return getRelevanceScore(b) - getRelevanceScore(a);
    }
  });

  // Count active filters
  const activeFilterCount = selectedCategories.length + selectedTypes.length + selectedDifficulties.length + (selectedApproach !== 'hybrid' && selectedApproach !== 'all' ? 1 : 0) + (selectedDuration !== 'all' ? 1 : 0);

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedTypes([]);
    setSelectedApproach('hybrid');
    setSelectedDuration('all');
    setSelectedDifficulties([]);
    setSearchQuery('');
  };

  // Toggle helpers
  const toggleMulti = (value: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (value === 'all') { setList([]); return; }
    setList(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  useEffect(() => { setAnimateKey(k => k + 1); }, [searchQuery, selectedCategories, selectedTypes, selectedApproach, selectedDuration, selectedDifficulties]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Headphones className="h-4 w-4" />;
      case 'article': return <BookOpen className="h-4 w-4" />;
      case 'playlist': return <Play className="h-4 w-4" />;
      case 'story': return <BookOpen className="h-4 w-4" />;
      case 'resource': return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-red-100 text-red-800';
      case 'audio': return 'bg-green-100 text-green-800';
      case 'article': return 'bg-blue-100 text-blue-800';
      case 'playlist': return 'bg-purple-100 text-purple-800';
      case 'story': return 'bg-amber-100 text-amber-800';
      case 'resource': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPrimaryActionLabel = (item: LibraryItem) => {
    if (item.displayType === 'playlist') return 'Explore';
    if (item.displayType === 'article' || item.displayType === 'story' || item.displayType === 'resource') return 'Read';
    return 'Play';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getDecisionSummary = (item: LibraryItem) => {
    const isTextual = item.displayType === 'article' || item.displayType === 'story' || item.displayType === 'resource';
    const sourceText = typeof item.body === 'string' ? item.body : '';
    const baseText = isTextual
      ? (isProbablyUrl(sourceText) ? item.description : (sourceText || item.description))
      : item.description;

    const compact = String(baseText || '').replace(/\s+/g, ' ').trim();
    if (!compact) {
      return isTextual
        ? 'Quick overview unavailable. Open to read the full details and decide if this fits your needs.'
        : 'Open this item to preview details.';
    }

    if (compact.length <= 170) return compact;
    return `${compact.slice(0, 167).trimEnd()}...`;
  };

  const getSourceHostLabel = (url?: string | null) => {
    if (!url || !isProbablyUrl(url)) return null;
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '');
      return host || 'External source';
    } catch {
      return 'External source';
    }
  };

  const featuredRecommendation = recommendedItems[0] ?? null;
  const recommendedRowItems = recommendedItems.slice(1);
  const quickReliefItems = sortedContent.filter((item) => item.immediateRelief).slice(0, 8);

  if (activeStory) {
    const storyBody = typeof activeStory.body === 'string' && activeStory.body.trim()
      ? activeStory.body.trim()
      : activeStory.description || 'This story is being prepared.';
    const storySourceHost = getSourceHostLabel(activeStory.externalUrl);

    return (
      <ResponsiveContainer>
        <div className="min-h-screen bg-background page-enter">
          <div className="border-b bg-gradient-to-r from-amber-50 via-background to-primary/5">
            <div className={`mx-auto max-w-3xl ${device.isMobile ? 'px-4 py-5' : 'px-6 py-8'}`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveStory(null)}
                className="mb-6 min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Library
              </Button>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getTypeColor(activeStory.displayType)}>
                    {activeStory.displayType === 'story' && <BookOpen className="h-3.5 w-3.5 mr-1" />}
                    {activeStory.displayType === 'article' && <FileText className="h-3.5 w-3.5 mr-1" />}
                    {activeStory.displayType === 'resource' && <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    <span className="capitalize">{activeStory.displayType}</span>
                  </Badge>
                  {activeStory.category && <Badge variant="outline">{activeStory.category}</Badge>}
                  {activeStory.durationLabel && (
                    <Badge variant="outline">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      {activeStory.durationLabel}
                    </Badge>
                  )}
                </div>

                <h1 className={device.isMobile ? 'text-3xl font-bold leading-tight' : 'text-5xl font-bold leading-tight'}>
                  {activeStory.title}
                </h1>
                {activeStory.description && (
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    {activeStory.description}
                  </p>
                )}

                {activeStory.externalUrl && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(activeStory.externalUrl!, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-2 hover:bg-primary hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Read Original {activeStory.displayType === 'article' ? 'Article' : 'Resource'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <main className={`mx-auto max-w-3xl ${device.isMobile ? 'px-4 py-8' : 'px-6 py-12'}`}>
            <article className="prose prose-slate max-w-none text-base leading-8 md:text-lg dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {storyBody}
              </ReactMarkdown>
            </article>

            {activeStory.externalUrl && (
              <div className="mt-10 border-t pt-6">
                <a
                  href={activeStory.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Source: {storySourceHost || 'External source'}
                </a>
              </div>
            )}
          </main>
        </div>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <div className="min-h-screen bg-background page-enter">
        {/* Header Section */}
        <div className="bg-gradient-to-b from-slate-50/80 via-slate-50/20 to-transparent border-b border-slate-100 dark:from-slate-900/50 dark:via-slate-900/10 dark:border-slate-800">
          <div className={`max-w-6xl mx-auto ${device.isMobile ? 'p-4 pb-6' : 'p-6 pb-8'} space-y-6`}>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onNavigate('dashboard')}
                className="h-10 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
                Content Library
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl">
                Curated videos, guided meditations, articles, and educational content for your wellbeing journey
              </p>
            </div>

            {/* Approach preference message */}
            {user?.approach && user.approach !== selectedApproach && selectedApproach !== 'all' && (
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-xl text-base">🎯</span>
                  <div className="text-sm text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">Approach Filter: </span>
                    Viewing <span className="capitalize font-bold text-amber-950 dark:text-amber-100">{selectedApproach}</span> content. Your preferred approach is <span className="capitalize font-bold text-amber-950 dark:text-amber-100">{user.approach}</span>.
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedApproach(user.approach!)}
                  className="text-amber-800 hover:text-amber-900 hover:bg-amber-100/50 dark:text-amber-300 dark:hover:bg-amber-900/30 font-semibold shrink-0"
                >
                  Switch to Preferred
                </Button>
              </div>
            )}

            {user?.approach && selectedApproach === user.approach && selectedApproach !== 'all' && (
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-base">✨</span>
                  <div className="text-sm text-emerald-900 dark:text-emerald-200">
                    <span className="font-semibold">Personalized Feed: </span>
                    Showing content tailored to your <span className="capitalize font-bold text-emerald-950 dark:text-emerald-100">{user.approach}</span> approach preference.
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedApproach('all')}
                  className="text-emerald-800 hover:text-emerald-900 hover:bg-emerald-100/50 dark:text-emerald-300 dark:hover:bg-emerald-900/30 font-semibold shrink-0"
                >
                  View All Content
                </Button>
              </div>
            )}

            {/* Search Bar */}
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder={t('content.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-10 h-12 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950 focus-visible:ring-primary focus-visible:border-primary text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content list & filters wrapper */}
        <div className={`max-w-6xl mx-auto ${device.isMobile ? 'px-4 py-4' : 'px-6 py-6'}`}>
          
          {/* Categories Pill Row & Toolbar */}
          <div className="space-y-4 mb-6">
            {/* Category selection scroll row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-6 md:px-6 no-scrollbar">
              {categories.map(cat => {
                const Icon = cat.icon;
                const active = selectedCategories.length === 0 ? cat.id === 'all' : selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleMulti(cat.id, selectedCategories, setSelectedCategories)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 border ${
                      active 
                        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 scale-102"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Filter toolbar line */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-4">
              <div className="flex items-center gap-3">
                <Button
                  variant={isActiveFiltersExpanded && !device.isMobile ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (device.isMobile) {
                      setIsFilterSheetOpen(true);
                    } else {
                      setIsActiveFiltersExpanded(!isActiveFiltersExpanded);
                    }
                  }}
                  className="flex items-center gap-2 rounded-full h-9 px-4"
                  aria-label={`Open filters, ${activeFilterCount} active`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>More Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1 rounded-full px-1.5 min-w-[18px] h-4.5 text-[10px] flex items-center justify-center bg-primary text-primary-foreground">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>

                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200 rounded-full h-8"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-xs font-semibold text-slate-400 font-mono hidden sm:inline-block">
                  {sortedContent.length} {sortedContent.length === 1 ? 'item' : 'items'} found
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-semibold hidden md:inline-block">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as ContentSortKey)}
                    aria-label="Sort content"
                    className="h-9 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="popular">Most Popular</option>
                    <option value="duration">Shortest First</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </div>

                {/* View switcher */}
                <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-900 rounded-full p-0.5 border border-slate-200 dark:border-slate-800">
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-7 w-7 p-0 rounded-full"
                    aria-label="List view"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-7 w-7 p-0 rounded-full"
                    aria-label="Grid view"
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Collapsible Filters Panel */}
          {!device.isMobile && isActiveFiltersExpanded && (
            <div className="mb-6 p-6 border border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-900/30 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-4 gap-8">
                {/* Content Type */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Content Type</h4>
                  <div className="flex flex-col gap-1.5">
                    {types.map(t => {
                      const Icon = t.icon;
                      const active = selectedTypes.length === 0 ? t.id === 'all' : selectedTypes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleMulti(t.id, selectedTypes, setSelectedTypes)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all ${
                            active 
                              ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                              : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Approach */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Approach</h4>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { id: 'western', label: 'Western Science', icon: Brain },
                      { id: 'eastern', label: 'Eastern Wisdom', icon: Heart },
                      { id: 'hybrid', label: 'Hybrid (All)', icon: Users }
                    ].map(app => {
                      const Icon = app.icon;
                      const active = (app.id === 'hybrid' && (selectedApproach === 'hybrid' || selectedApproach === 'all')) || 
                                     (app.id !== 'hybrid' && selectedApproach === app.id);
                      return (
                        <button
                          key={app.id}
                          onClick={() => setSelectedApproach(app.id as any)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all ${
                            active 
                              ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                              : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          {app.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Duration</h4>
                  <div className="flex flex-col gap-1.5">
                    {durations.map(d => {
                      const active = selectedDuration === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDuration(d.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all ${
                            active 
                              ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                              : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900"
                          }`}
                        >
                          <Timer className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Difficulty</h4>
                  <div className="flex flex-col gap-1.5">
                    {difficulties.map(d => {
                      const Icon = d.icon;
                      const active = selectedDifficulties.length === 0 ? d.id === 'all' : selectedDifficulties.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() => toggleMulti(d.id, selectedDifficulties, setSelectedDifficulties)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all ${
                            active 
                              ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                              : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Bottom Sheet for Filters */}
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 rounded-t-3xl border-t border-slate-200">
              <SheetHeader className="px-4 py-4 border-b">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg font-bold">Filters</SheetTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFilterSheetOpen(false)}
                    className="h-8 w-8 p-0 rounded-full"
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {/* Sort */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort By</h3>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as ContentSortKey)}
                    aria-label="Sort content"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-background px-3 text-sm"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="popular">Most Popular</option>
                    <option value="duration">Shortest First</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => {
                      const Icon = cat.icon;
                      const active = selectedCategories.length === 0 ? cat.id === 'all' : selectedCategories.includes(cat.id);
                      return (
                        <Button
                          key={cat.id}
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleMulti(cat.id, selectedCategories, setSelectedCategories)}
                          className="min-h-[44px] rounded-xl flex items-center gap-2"
                        >
                          <Icon className="h-4 w-4" />
                          {cat.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Content Type */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Content Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {types.map(t => {
                      const Icon = t.icon;
                      const active = selectedTypes.length === 0 ? t.id === 'all' : selectedTypes.includes(t.id);
                      return (
                        <Button
                          key={t.id}
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleMulti(t.id, selectedTypes, setSelectedTypes)}
                          className="min-h-[44px] rounded-xl flex items-center gap-2"
                        >
                          <Icon className="h-4 w-4" />
                          {t.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Approach */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approach</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedApproach === 'western' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedApproach('western')}
                      className="min-h-[44px] rounded-xl flex items-center gap-2"
                    >
                      <Brain className="h-4 w-4" />
                      Western
                    </Button>
                    <Button
                      variant={selectedApproach === 'eastern' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedApproach('eastern')}
                      className="min-h-[44px] rounded-xl flex items-center gap-2"
                    >
                      <Heart className="h-4 w-4" />
                      Eastern
                    </Button>
                    <Button
                      variant={selectedApproach === 'hybrid' || selectedApproach === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedApproach('hybrid')}
                      className="min-h-[44px] rounded-xl flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Hybrid (All)
                    </Button>
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="space-y-3">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="flex items-center justify-between w-full text-xs font-bold text-slate-450 uppercase tracking-wider"
                  >
                    <span>Time & Level Details</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showAdvancedFilters && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      {/* Duration */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</h4>
                        <div className="flex flex-wrap gap-2">
                          {durations.map(d => {
                            const active = selectedDuration === d.id;
                            return (
                              <Button
                                key={d.id}
                                variant={active ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedDuration(d.id)}
                                className="min-h-[44px] rounded-xl flex items-center gap-2"
                              >
                                <Timer className="h-4 w-4" />
                                {d.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Difficulty */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Difficulty</h4>
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
                                className="min-h-[44px] rounded-xl flex items-center gap-2"
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
              
              <SheetFooter className="px-4 py-4 border-t flex-row gap-3 bg-slate-50 dark:bg-slate-900/50">
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="flex-1 min-h-[44px] rounded-xl"
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground"
                >
                  Apply {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          
          {/* Active Filters Badges list */}
          {activeFilterCount > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Active:</span>
              {selectedCategories.map(catId => {
                const cat = categories.find(c => c.id === catId);
                return cat ? (
                  <Badge key={catId} variant="secondary" className="gap-1 rounded-full px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {cat.label}
                    <button onClick={() => toggleMulti(catId, selectedCategories, setSelectedCategories)} className="hover:text-red-500 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
              {selectedTypes.map(typeId => {
                const t = types.find(type => type.id === typeId);
                return t ? (
                  <Badge key={typeId} variant="secondary" className="gap-1 rounded-full px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {t.label}
                    <button onClick={() => toggleMulti(typeId, selectedTypes, setSelectedTypes)} className="hover:text-red-500 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
              {selectedApproach !== 'all' && selectedApproach !== 'hybrid' && (
                <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 capitalize">
                  {selectedApproach}
                  <button onClick={() => setSelectedApproach('all')} className="hover:text-red-500 rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedDuration !== 'all' && (
                <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {durations.find(d => d.id === selectedDuration)?.label}
                  <button onClick={() => setSelectedDuration('all')} className="hover:text-red-500 rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedDifficulties.map(diffId => {
                const d = difficulties.find(diff => diff.id === diffId);
                return d ? (
                  <Badge key={diffId} variant="secondary" className="gap-1 rounded-full px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {d.label}
                    <button onClick={() => toggleMulti(diffId, selectedDifficulties, setSelectedDifficulties)} className="hover:text-red-500 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  Search: &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery('')} className="hover:text-red-500 rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}



        {!loading && !error && sortedContent.length > 0 && (
          <div className="mb-4 mt-6 space-y-1">
            <h2 className="text-xl font-semibold">Browse All</h2>
            <p className="text-sm text-muted-foreground">Explore the full library with your current filters.</p>
          </div>
        )}

        {/* Content List/Grid */}
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
        
        {!loading && !error && sortedContent.length === 0 && (
          <Card className="p-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="text-lg font-semibold">No content found</h3>
            <p className="text-muted-foreground">
              {activeFilterCount > 0 ? "Try adjusting your filters" : "No content available"}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            )}
          </Card>
        )}
        
        {/* Mobile List View */}
        {!loading && !error && (device.isMobile || viewMode === 'list') && sortedContent.length > 0 && (
          <div className="space-y-3">
            {sortedContent.map(item => {
              const primaryActionLabel = getPrimaryActionLabel(item);
              const primaryActionIcon = primaryActionLabel === 'Read' ? <BookOpen className="h-4 w-4" /> : <Play className="h-4 w-4" />;
              const shouldShowSourceLink = Boolean(item.externalUrl) && (item.displayType === 'article' || item.displayType === 'story' || item.displayType === 'resource');
              const sourceHost = getSourceHostLabel(item.externalUrl);
              const decisionSummary = getDecisionSummary(item);
              
              return (
                <Card
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openLibraryItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openLibraryItem(item);
                    }
                  }}
                  className="flex gap-3 p-3 hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-32 h-20 rounded overflow-hidden">
                    <ImageWithFallback
                      src={item.thumbnail || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=400&q=60'}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Type badge */}
                    <Badge className={`absolute top-1 left-1 ${getTypeColor(item.displayType)} text-xs px-1.5 py-0.5`}>
                      <div className="flex items-center gap-1">
                        {getTypeIcon(item.displayType)}
                      </div>
                    </Badge>
                    
                    {/* Bookmark button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 bg-white/80 hover:bg-white h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(item.id);
                      }}
                    >
                      <Bookmark className={`h-3 w-3 ${bookmarkedIds.includes(item.id) ? 'fill-current text-primary' : ''}`} />
                    </Button>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    {/* Title */}
                    <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                      {item.title}
                    </h3>
                    
                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {decisionSummary}
                    </p>

                    {shouldShowSourceLink && (
                      <a
                        href={item.externalUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        aria-label={`Open source link ${sourceHost || ''}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source: {sourceHost || 'External source'}
                      </a>
                    )}
                    
                    {/* Meta row */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      <span>{item.durationLabel || '—'}</span>
                      {item.difficulty && (
                        <>
                          <span>•</span>
                          <span className={getDifficultyColor(item.difficulty)}>{item.difficulty}</span>
                        </>
                      )}
                      {item.rating && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-current text-yellow-500" />
                            <span>{item.rating}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {(item.immediateRelief || item.crisisEligible) && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {item.immediateRelief && (
                          <Badge className="bg-rose-100 text-rose-700 text-xs px-1.5 py-0">Quick Relief</Badge>
                        )}
                        {item.crisisEligible && (
                          <Badge className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0">Crisis-Safe</Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {item.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          +{item.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                    
                    {/* CTA */}
                    <div className="mt-auto flex gap-2">
                      <Button 
                        size="sm"
                        className="flex-1 min-h-[44px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLibraryItem(item);
                        }}
                      >
                        {primaryActionIcon}
                        <span className="ml-1">{primaryActionLabel}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px]"
                        aria-label="Share"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleShareItem(item);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Desktop Grid View */}
        {!loading && !error && !device.isMobile && viewMode === 'grid' && sortedContent.length > 0 && (
          <div key={animateKey} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all animate-in fade-in">
            {sortedContent.map(item => {
              const primaryActionLabel = getPrimaryActionLabel(item);
              const primaryActionIcon = primaryActionLabel === 'Read' ? <BookOpen className="h-4 w-4" /> : <Play className="h-4 w-4" />;
              const shouldShowSourceLink = Boolean(item.externalUrl) && (item.displayType === 'article' || item.displayType === 'story' || item.displayType === 'resource');
              const sourceHost = getSourceHostLabel(item.externalUrl);
              const decisionSummary = getDecisionSummary(item);

              return (
                <Card
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openLibraryItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openLibraryItem(item);
                    }
                  }}
                  className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                <div className="relative">
                  <ImageWithFallback
                    src={item.thumbnail || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=60'}
                    alt={item.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {/* Quick Actions */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full"
                      aria-label="Bookmark"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleBookmark(item.id);
                      }}
                    >
                      <Bookmark className={`h-4 w-4 ${bookmarkedIds.includes(item.id) ? 'fill-current text-primary' : ''}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full"
                      aria-label="Share"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleShareItem(item);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label={primaryActionLabel}
                      onClick={(event) => {
                        event.stopPropagation();
                        openLibraryItem(item);
                      }}
                    >
                      {primaryActionIcon}
                    </Button>
                  </div>
                  {/* Type badge */}
                  <Badge className={`absolute top-2 left-2 ${getTypeColor(item.displayType)} shadow`}>
                    <div className="flex items-center gap-1">
                      {getTypeIcon(item.displayType)}
                      <span className="capitalize">{item.displayType}</span>
                    </div>
                  </Badge>
                  {item.approach !== 'all' && (
                    <Badge className="absolute top-12 left-2 bg-white/90 text-gray-700 text-xs shadow">
                      {item.approach === 'western' && '🧠 Western'}
                      {item.approach === 'eastern' && '🕉️ Eastern'}
                      {item.approach === 'hybrid' && '🌸 Hybrid'}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{decisionSummary}</p>
                    {shouldShowSourceLink && (
                      <a
                        href={item.externalUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        aria-label={`Open source link ${sourceHost || ''}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Source: {sourceHost || 'External source'}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{item.durationLabel || '—'}</span>
                    </div>
                    <div className="flex items-center gap-0.5" aria-label={`Rating ${item.rating} of 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < (item.rating || 0) ? 'fill-current text-yellow-500' : 'text-muted-foreground'} transition-colors`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {item.difficulty && (
                      <Badge variant="outline" className={getDifficultyColor(item.difficulty)}>
                        {item.difficulty}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{item.author || 'Wellbeing Coach'}</span>
                  </div>
                  {(item.immediateRelief || item.crisisEligible) && (
                    <div className="flex flex-wrap gap-1">
                      {item.immediateRelief && (
                        <Badge className="bg-rose-100 text-rose-700 text-xs">Quick Relief</Badge>
                      )}
                      {item.crisisEligible && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">Crisis-Safe</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0,3).map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                  </div>
                </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Featured Collections */}
        <div className="mt-16 space-y-8">
          <h2 className="text-3xl font-semibold tracking-tight">Featured Collections</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 hover:shadow-md transition-all hover:scale-[1.015]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Anxiety Relief</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Immediate techniques and long-term strategies for managing anxiety
                </p>
                <Button
                  size="sm"
                  className="shadow-sm"
                  onClick={() => applyFeaturedCollection('anxiety')}
                >
                  Explore Collection
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 hover:shadow-md transition-all hover:scale-[1.015]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">Better Sleep</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guided practices and education for improving sleep quality
                </p>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => applyFeaturedCollection('sleep')}
                >
                  Explore Collection
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-md transition-all hover:scale-[1.015]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold">Relationships</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Building healthy connections and communication skills
                </p>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => applyFeaturedCollection('relationship')}
                >
                  Explore Collection
                </Button>
              </div>
            </Card>
          </div>
        </div>
        <MediaPlayerDialog
          item={activeItem}
          open={Boolean(activeItem)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveItem(null);
            }
          }}
        />
      </div>
    </div>
    </ResponsiveContainer>
  );
}
