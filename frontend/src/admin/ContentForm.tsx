import { Loader2 } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { getApiBaseUrl } from '../config/apiConfig';
import { useNotificationStore } from '../stores/notificationStore';

import { adminFetch } from './adminApi';

export interface ContentRecord {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'article' | 'playlist' | 'story';
  approach: 'western' | 'eastern' | 'hybrid' | 'all';
  category?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  description?: string;
  content?: string;
  url?: string;
  youtubeUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  tags?: string[];
  isPublished: boolean;
  scheduledPublishAt?: string | null;
  // New metadata fields
  contentType?: string;
  intensityLevel?: 'low' | 'medium' | 'high';
  focusAreas?: string[];
  immediateRelief?: boolean;
  culturalContext?: string;
  hasSubtitles?: boolean;
  transcript?: string;
  createdAt?: string;
  updatedAt?: string;
}

type YouTubeSearchResult = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  durationMinutes: number | null;
  channelTitle: string | null;
  url: string;
};

interface ContentFormProps {
  existing?: ContentRecord;
  selectedType?: string | null;
  onSaved: (content: ContentRecord) => void;
  onClose: () => void;
}

export const ContentForm: React.FC<ContentFormProps> = ({ existing, selectedType, onSaved, onClose }) => {
  const { push } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState({ media: false, thumbnail: false });
  const [fileNames, setFileNames] = useState<{ media?: string; thumbnail?: string }>({});
  const [metaLoading, setMetaLoading] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeSearching, setYoutubeSearching] = useState(false);
  const [youtubeResults, setYoutubeResults] = useState<YouTubeSearchResult[]>([]);
  const [formData, setFormData] = useState<Partial<ContentRecord>>({
    title: '',
    type: 'article',
    approach: 'all',
    category: '',
    difficulty: 'Beginner',
    description: '',
    content: '',
    url: '',
    youtubeUrl: '',
    thumbnailUrl: '',
    duration: 0,
    tags: [],
    isPublished: false,
    scheduledPublishAt: null,
    // New metadata fields
    contentType: '',
    intensityLevel: 'medium',
    focusAreas: [],
    immediateRelief: false,
    culturalContext: '',
    hasSubtitles: false,
    transcript: '',
  });

  useEffect(() => {
    if (existing) {
      // Normalize tags: backend returns comma-separated string
      let normalizedTags: string[] | undefined = existing.tags as unknown as string[] | undefined;
      if (normalizedTags && !Array.isArray(normalizedTags)) {
        if (typeof (normalizedTags as unknown) === 'string') {
          const raw = normalizedTags as unknown as string;
          normalizedTags = raw.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        } else {
          normalizedTags = [];
        }
      }

      const parseJsonArray = (val: any): string[] => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string' && val.trim().length > 0) {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      setFormData({
        ...existing,
        tags: normalizedTags || [],
        focusAreas: parseJsonArray(existing.focusAreas)
      });
      setYoutubeInput(existing.youtubeUrl || '');
    } else if (selectedType) {
      setFormData(prev => ({
        ...prev,
        type: selectedType as ContentRecord['type']
      }));
      setYoutubeInput('');
    }
  }, [existing, selectedType]);

  type FieldValue = string | number | boolean | string[] | null | undefined;
  const handleInputChange = (field: keyof ContentRecord, value: FieldValue) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    handleInputChange('tags', tags);
  };

  const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  function extractYouTubeId(raw?: string) {
    if (!raw) return '';
    const val = raw.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(val)) return val;
    try {
      const u = new URL(val);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split(/[?&#]/)[0];
      const v = u.searchParams.get('v');
      if (v) return v;
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
    } catch (_) { /* ignore */ }
    return val;
  }

  const fetchYouTubeFull = async (id: string, force = false) => {
    setMetaLoading(true);
    try {
      const resp = await adminFetch(`${getApiBaseUrl()}/admin/media/metadata?type=youtube&value=${encodeURIComponent(id)}`, { credentials: 'include' });
      if (!resp.ok) {
        let msg = `Metadata request failed (${resp.status})`;
        try {
          const errJson = await resp.json();
          if (errJson?.error) msg = errJson.error;
        } catch { /* ignore parse */ }
        console.warn('YouTube metadata fetch failed:', msg);
        push({ type: 'error', title: 'YouTube Metadata', description: msg });
        return;
      }
      const json = await resp.json();
      if (!json.success) {
        push({ type: 'error', title: 'YouTube Metadata', description: json.error || 'Failed to fetch video data' });
        return;
      }
      setFormData(prev => ({
        ...prev,
        title: prev.title?.trim() ? prev.title : (json.title || prev.title),
        description: prev.description?.trim() ? prev.description : (json.description || prev.description),
        thumbnailUrl: prev.thumbnailUrl?.trim() ? prev.thumbnailUrl : (json.thumbnail || prev.thumbnailUrl),
        duration: (force || !prev.duration || prev.duration <= 1 || prev.duration === 5) && json.durationMinutes
          ? json.durationMinutes
          : prev.duration
      }));
    } catch (e) {
      console.error('YouTube metadata exception', e);
      push({ type: 'error', title: 'YouTube Metadata', description: 'Unexpected error fetching metadata' });
    } finally {
      setMetaLoading(false);
    }
  };

  // Debounced auto-fetch when youtubeUrl changes
  const ytDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedId = useRef<string>('');
  useEffect(() => {
    const raw = youtubeInput.trim();
    if (!raw) {
      lastFetchedId.current = '';
      return;
    }
    if (ytDebounceRef.current) clearTimeout(ytDebounceRef.current);
    ytDebounceRef.current = setTimeout(() => {
      const id = extractYouTubeId(raw);
      if (!id) return;
      if (lastFetchedId.current === id) return;
      lastFetchedId.current = id;
      fetchYouTubeFull(id);
    }, 500);
    return () => { if (ytDebounceRef.current) clearTimeout(ytDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeInput]);

  const uploadFile = async (file: File, type: 'media' | 'thumbnail') => {
    const form = new FormData();
    form.append('file', file);
    const resp = await adminFetch(`${getApiBaseUrl()}/admin/upload/${type}`, { method: 'POST', body: form, credentials: 'include' });
    if (!resp.ok) throw new Error('Upload failed');
    const data = await resp.json();
    return data.url as string;
  };

  const fetchFileMetadata = async (fileUrl: string) => {
    try {
      const resp = await adminFetch(`${getApiBaseUrl()}/admin/media/metadata?type=file&value=${encodeURIComponent(fileUrl)}`, { credentials: 'include' });
      if (!resp.ok) return null;
      const json = await resp.json();
      return json.success ? json : null;
    } catch (e) {
      console.error('File metadata fetch error:', e);
      return null;
    }
  };

  const fetchYouTubeDuration = async (id: string) => {
    try {
      const resp = await adminFetch(`${getApiBaseUrl()}/admin/youtube/metadata/${id}`, { credentials: 'include' });
      if (!resp.ok) return;
      const json = await resp.json();
      if (json.success && json.durationMinutes && (!formData.duration || !existing)) {
        setFormData(prev => ({ ...prev, duration: json.durationMinutes }));
      }
    } catch (_) { /* ignore */ }
  };

  const runYouTubeSearch = async () => {
    const query = youtubeSearchQuery.trim();
    if (!query) {
      push({ type: 'error', title: 'YouTube Search', description: 'Enter a search query first' });
      return;
    }

    setYoutubeSearching(true);
    try {
      const resp = await adminFetch(
        `${getApiBaseUrl()}/admin/youtube/search?query=${encodeURIComponent(query)}&limit=8`,
        { credentials: 'include' }
      );
      if (!resp.ok) {
        throw new Error(`Search failed (${resp.status})`);
      }
      const json = await resp.json();
      const data = Array.isArray(json?.data) ? (json.data as YouTubeSearchResult[]) : [];
      setYoutubeResults(data);
      if (!data.length) {
        push({ type: 'error', title: 'YouTube Search', description: 'No matching videos found' });
      }
    } catch (error) {
      console.error('YouTube search error:', error);
      push({
        type: 'error',
        title: 'YouTube Search',
        description: error instanceof Error ? error.message : 'Failed to search YouTube',
      });
    } finally {
      setYoutubeSearching(false);
    }
  };

  const applyYouTubeResult = (result: YouTubeSearchResult) => {
    setYoutubeInput(result.url);
    handleInputChange('youtubeUrl', result.url);

    setFormData(prev => ({
      ...prev,
      title: prev.title?.trim() ? prev.title : result.title,
      description: prev.description?.trim() ? prev.description : (result.description || prev.description),
      thumbnailUrl: prev.thumbnailUrl?.trim() ? prev.thumbnailUrl : (result.thumbnail || prev.thumbnailUrl),
      duration: (!prev.duration || prev.duration <= 1 || prev.duration === 5) && result.durationMinutes
        ? result.durationMinutes
        : prev.duration,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title?.trim()) {
      push({ type: 'error', title: 'Validation Error', description: 'Title is required' });
      return;
    }
    if (!formData.description || !formData.description.trim()) {
      push({ type: 'error', title: 'Validation Error', description: 'Description is required' });
      return;
    }
    if (!formData.thumbnailUrl || !formData.thumbnailUrl.trim()) {
      push({ type: 'error', title: 'Validation Error', description: 'Thumbnail is required (URL or uploaded image)' });
      return;
    }
    // Media validation for video/audio content
    if (formData.type === 'video') {
      const hasVideo = (formData.url && formData.url.trim()) || (formData.youtubeUrl && formData.youtubeUrl.trim()) || uploaded.media;
      if (!hasVideo) {
        push({ type: 'error', title: 'Validation Error', description: 'Provide a Video URL, YouTube URL, or upload a video file' });
        return;
      }
    }
    if (formData.type === 'audio') {
      const hasAudio = (formData.url && formData.url.trim()) || uploaded.media;
      if (!hasAudio) {
        push({ type: 'error', title: 'Validation Error', description: 'Audio URL or uploaded audio file is required' });
        return;
      }
    }

    setLoading(true);
    try {
      let youtubeVideoId: string | null = null;
      if (formData.youtubeUrl) {
        const id = extractYouTubeId(formData.youtubeUrl);
        if (id) {
          youtubeVideoId = id;
          await fetchYouTubeDuration(id);
        }
      }

      // Uploads
      const updated: Record<string, unknown> = { ...formData };
      if (youtubeVideoId) {
        updated.youtubeUrl = youtubeVideoId;
      }
      const mediaInput = document.getElementById('fileUpload') as HTMLInputElement | null;
      const thumbInput = document.getElementById('thumbnailUpload') as HTMLInputElement | null;
      const tasks: Promise<void>[] = [];
      if (mediaInput?.files?.[0] && (formData.type === 'video' || formData.type === 'audio')) {
        tasks.push(uploadFile(mediaInput.files[0], 'media').then(url => { updated.url = url; }));
      }
      if (thumbInput?.files?.[0]) {
        tasks.push(uploadFile(thumbInput.files[0], 'thumbnail').then(url => { updated.thumbnailUrl = url; }));
      }
      if (tasks.length) await Promise.all(tasks);

      // Fetch metadata for uploaded media files
      if (updated.url && (formData.type === 'video' || formData.type === 'audio')) {
        const meta = await fetchFileMetadata(updated.url as string);
        if (meta?.durationMinutes && (!updated.duration || updated.duration === 5)) {
          updated.duration = meta.durationMinutes;
        }
        if (meta?.title && !updated.title) {
          updated.title = meta.title;
        }
      }

      const url = existing ? `${getApiBaseUrl()}/admin/content/${existing.id}` : `${getApiBaseUrl()}/admin/content`;
      const method = existing ? 'PUT' : 'POST';
      
      // Build payload matching backend requirements
      const mediaContent = (() => {
        if (formData.type === 'video') {
          return formData.url || formData.youtubeUrl || '';
        }
        if (formData.type === 'audio') {
          return formData.url || '';
        }
        return formData.content || formData.url || formData.description || '';
      })();

      const payload = {
        title: formData.title,
        type: formData.type,
        category: formData.category || 'General',
        approach: formData.approach || 'hybrid',
        content: mediaContent,
        description: formData.description,
        youtubeUrl: updated.youtubeUrl || (youtubeVideoId ?? formData.youtubeUrl),
        thumbnailUrl: updated.thumbnailUrl || formData.thumbnailUrl,
        duration: formData.duration && formData.duration > 0 ? formData.duration : (updated.duration as number | undefined),
        difficulty: formData.difficulty,
        tags: Array.isArray(formData.tags) ? formData.tags : [],
        isPublished: formData.isPublished || false,
        scheduledPublishAt:
          formData.scheduledPublishAt && !Number.isNaN(new Date(formData.scheduledPublishAt).getTime())
            ? new Date(formData.scheduledPublishAt).toISOString()
            : null,
      };

      const finalPayload = { ...updated, ...payload };

      const response = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${existing ? 'update' : 'create'} content`);
      }

  const savedContent = await response.json();
  const record = savedContent.success ? savedContent.data : savedContent; // handle old/new
  onSaved(record);
      push({ 
        type: 'success', 
        title: 'Success', 
        description: `Content ${existing ? 'updated' : 'created'} successfully` 
      });
    } catch (error) {
      console.error('Content save error:', error);
      push({ 
        type: 'error', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to save content' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title || ''}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Content title"
            required
          />
        </div>

        {/* Only show type selection if not pre-selected */}
        {!selectedType && (
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type || 'article'}
              onValueChange={(value) => handleInputChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="playlist">Playlist</SelectItem>
                <SelectItem value="story">Story</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Show selected type as read-only if pre-selected */}
        {selectedType && (
          <div className="space-y-2">
            <Label>Content Type</Label>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <span className="text-sm font-medium capitalize">{selectedType}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="approach">Approach</Label>
          <Select
            value={formData.approach || 'hybrid'}
            onValueChange={(value) => handleInputChange('approach', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select approach" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="western">Western</SelectItem>
              <SelectItem value="eastern">Eastern</SelectItem>
              <SelectItem value="hybrid">Hybrid (All)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category || ''}
            onValueChange={(value) => handleInputChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mindfulness">Mindfulness</SelectItem>
              <SelectItem value="Anxiety">Anxiety</SelectItem>
              <SelectItem value="Stress Management">Stress Management</SelectItem>
              <SelectItem value="Relaxation">Relaxation</SelectItem>
              <SelectItem value="Emotional Intelligence">Emotional Intelligence</SelectItem>
              <SelectItem value="Series">Series</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select
            value={formData.difficulty || 'Beginner'}
            onValueChange={(value) => handleInputChange('difficulty', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(formData.type === 'video' || formData.type === 'audio' || formData.type === 'playlist') && (
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration || 0}
              onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
              placeholder="Duration in minutes"
              min="0"
            />
          </div>
        )}

        {/* NEW: Content Type Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="contentType">Content Type</Label>
          <Select
            value={formData.contentType || ''}
            onValueChange={(value) => handleInputChange('contentType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select content type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIDEO">Video</SelectItem>
              <SelectItem value="AUDIO_MEDITATION">Audio Meditation</SelectItem>
              <SelectItem value="BREATHING_EXERCISE">Breathing Exercise</SelectItem>
              <SelectItem value="ARTICLE">Article</SelectItem>
              <SelectItem value="STORY">Story</SelectItem>
              <SelectItem value="JOURNAL_PROMPT">Journal Prompt</SelectItem>
              <SelectItem value="CBT_WORKSHEET">CBT Worksheet</SelectItem>
              <SelectItem value="YOGA_SEQUENCE">Yoga Sequence</SelectItem>
              <SelectItem value="MINDFULNESS_EXERCISE">Mindfulness Exercise</SelectItem>
              <SelectItem value="PSYCHOEDUCATION">Psychoeducation</SelectItem>
              <SelectItem value="CRISIS_RESOURCE">Crisis Resource</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* NEW: Intensity Level */}
        <div className="space-y-2">
          <Label htmlFor="intensityLevel">Intensity Level</Label>
          <Select
            value={formData.intensityLevel || 'medium'}
            onValueChange={(value) => handleInputChange('intensityLevel', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select intensity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* NEW: Immediate Relief Checkbox */}
        <div className="flex items-center space-x-2">
          <Switch
            id="immediateRelief"
            checked={formData.immediateRelief || false}
            onCheckedChange={(checked) => handleInputChange('immediateRelief', checked)}
          />
          <Label htmlFor="immediateRelief" className="cursor-pointer">
            Crisis/Immediate Relief Content
          </Label>
        </div>

        {/* NEW: Has Subtitles Checkbox */}
        {(formData.type === 'video' || formData.type === 'audio') && (
          <div className="flex items-center space-x-2">
            <Switch
              id="hasSubtitles"
              checked={formData.hasSubtitles || false}
              onCheckedChange={(checked) => handleInputChange('hasSubtitles', checked)}
            />
            <Label htmlFor="hasSubtitles" className="cursor-pointer">
              Has Subtitles (Accessibility)
            </Label>
          </div>
        )}
      </div>

      {/* NEW: Focus Areas Tags Input */}
      <div className="space-y-2">
        <Label htmlFor="focusAreas">Focus Areas (max 10, comma-separated)</Label>
        <Input
          id="focusAreas"
          value={(formData.focusAreas || []).join(', ')}
          onChange={(e) => {
            const areas = e.target.value.split(',').map(a => a.trim()).filter(a => a.length > 0).slice(0, 10);
            handleInputChange('focusAreas', areas);
          }}
          placeholder="e.g., anxiety, stress, sleep, focus"
        />
        <p className="text-xs text-muted-foreground">
          {(formData.focusAreas || []).length}/10 focus areas
        </p>
      </div>

      {/* NEW: Cultural Context Textarea */}
      <div className="space-y-2">
        <Label htmlFor="culturalContext">Cultural Context (optional, max 500 chars)</Label>
        <Textarea
          id="culturalContext"
          value={formData.culturalContext || ''}
          onChange={(e) => {
            const text = e.target.value.slice(0, 500);
            handleInputChange('culturalContext', text);
          }}
          placeholder="Cultural or contextual information about this content"
          rows={2}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          {(formData.culturalContext || '').length}/500 characters
        </p>
      </div>

      {/* NEW: Transcript Textarea (for videos/audio) */}
      {(formData.type === 'video' || formData.type === 'audio') && (
        <div className="space-y-2">
          <Label htmlFor="transcript">Full Transcript (optional, max 50,000 chars)</Label>
          <Textarea
            id="transcript"
            value={formData.transcript || ''}
            onChange={(e) => {
              const text = e.target.value.slice(0, 50000);
              handleInputChange('transcript', text);
            }}
            placeholder="Full text transcript of the audio/video content for accessibility and searchability"
            rows={6}
            maxLength={50000}
          />
          <p className="text-xs text-muted-foreground">
            {(formData.transcript || '').length}/50,000 characters
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Brief description of the content"
          rows={3}
        />
      </div>

      {(formData.type === 'video' || formData.type === 'audio') && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">{formData.type === 'video' ? 'Video URL *' : 'Audio URL *'}</Label>
            <Input
              id="url"
              value={formData.url || ''}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder={formData.type === 'video' ? 'Direct link to video file (mp4, webm, etc.)' : 'Direct link to audio file (mp3, wav, etc.)'}
              type="url"
              disabled={uploaded.media}
            />
            {uploaded.media && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-green-600">Selected file: {fileNames.media}</span>
                <button
                  type="button"
                  className="text-red-500 hover:underline"
                  onClick={() => {
                    setUploaded(prev => ({ ...prev, media: false }));
                    setFileNames(prev => ({ ...prev, media: undefined }));
                    handleInputChange('url', '');
                  }}
                >Remove</button>
              </div>
            )}
          </div>

          {formData.type === 'video' && (
            <div className="space-y-2">
              <Label htmlFor="youtubeUrl" className="flex items-center gap-2">
                YouTube URL (Optional)
                {metaLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </Label>
              <div className="relative">
                <Input
                  id="youtubeUrl"
                  className={metaLoading ? 'pr-8' : ''}
                  value={youtubeInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setYoutubeInput(value);
                    handleInputChange('youtubeUrl', value);
                  }}
                  placeholder="Paste a YouTube link or video ID"
                  type="text"
                />
                {metaLoading && (
                  <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {metaLoading ? 'Fetching metadata…' : 'Title, description, thumbnail & duration will auto-fill.'}
              </p>

              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor="youtubeSearch">Search YouTube</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="youtubeSearch"
                    value={youtubeSearchQuery}
                    onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                    placeholder="Search videos by topic"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void runYouTubeSearch();
                      }
                    }}
                  />
                  <Button type="button" onClick={() => void runYouTubeSearch()} disabled={youtubeSearching}>
                    {youtubeSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Search
                  </Button>
                </div>

                {youtubeResults.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {youtubeResults.map((result) => (
                      <div key={result.id} className="flex items-start justify-between gap-3 rounded-md border p-2">
                        <div className="flex min-w-0 gap-3">
                          {result.thumbnail && (
                            <img
                              src={result.thumbnail}
                              alt={result.title}
                              className="h-16 w-24 shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{result.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {[result.channelTitle, result.durationMinutes ? `${result.durationMinutes} min` : null]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyYouTubeResult(result)}>
                          Use
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="fileUpload">Or Upload File *</Label>
            <Input
              id="fileUpload"
              type="file"
              accept={formData.type === 'video' ? 'video/*' : 'audio/*'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleInputChange('url', `uploaded-${file.name}`);
                  setUploaded(prev => ({ ...prev, media: true }));
                  setFileNames(prev => ({ ...prev, media: file.name }));
                  if (!formData.title) {
                    setFormData(prev => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' ') }));
                  }
                }
              }}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
            />
            <p className="text-xs text-muted-foreground">
              Upload a {formData.type} file from your local machine.
            </p>
          </div>
        </div>
      )}

      {formData.type === 'article' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Article URL (Optional)</Label>
            <Input
              id="url"
              value={formData.url || ''}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="Direct link to article page"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Link to an external article page or leave empty to use content field below
            </p>
          </div>
          
          {!formData.url && (
            <div className="space-y-2">
              <Label htmlFor="content">Article Content</Label>
              <Textarea
                id="content"
                value={formData.content || ''}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Article content (supports markdown)"
                rows={10}
              />
            </div>
          )}
        </div>
      )}

      {formData.type === 'story' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Story Page URL (Optional)</Label>
            <Input
              id="url"
              value={formData.url || ''}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="Direct link to story page"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Link to an external story page or leave empty to add the full story below
            </p>
          </div>
          
          {!formData.url && (
            <div className="space-y-2">
              <Label htmlFor="content">Full Story Content</Label>
              <Textarea
                id="content"
                value={formData.content || ''}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Write the complete story here..."
                rows={15}
              />
              <p className="text-xs text-muted-foreground">
                Add the entire story content. This will be displayed as a full story experience.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="thumbnailUrl">Thumbnail URL *</Label>
          <Input
            id="thumbnailUrl"
            value={formData.thumbnailUrl || ''}
            onChange={(e) => handleInputChange('thumbnailUrl', e.target.value)}
            placeholder="URL to thumbnail image"
            type="url"
            disabled={uploaded.thumbnail}
          />
          {uploaded.thumbnail && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-green-600">Selected file: {fileNames.thumbnail}</span>
              <button
                type="button"
                className="text-red-500 hover:underline"
                onClick={() => {
                  setUploaded(prev => ({ ...prev, thumbnail: false }));
                  setFileNames(prev => ({ ...prev, thumbnail: undefined }));
                  handleInputChange('thumbnailUrl', '');
                }}
              >Remove</button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="thumbnailUpload">Or Upload Thumbnail *</Label>
          <Input
            id="thumbnailUpload"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleInputChange('thumbnailUrl', `uploaded-image-${file.name}`);
                setUploaded(prev => ({ ...prev, thumbnail: true }));
                setFileNames(prev => ({ ...prev, thumbnail: file.name }));
              }
            }}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
          />
          <p className="text-xs text-muted-foreground">Provide an image URL or upload a local image file.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={Array.isArray(formData.tags) ? formData.tags.join(', ') : ''}
          onChange={(e) => handleTagsChange(e.target.value)}
          placeholder="anxiety, stress, relaxation"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isPublished"
          checked={formData.isPublished || false}
          onCheckedChange={(checked) => handleInputChange('isPublished', checked)}
        />
        <Label htmlFor="isPublished">Published</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduledPublishAt">Schedule Publish (optional)</Label>
        <Input
          id="scheduledPublishAt"
          type="datetime-local"
          value={toDateTimeLocalValue(formData.scheduledPublishAt)}
          onChange={(e) => handleInputChange('scheduledPublishAt', e.target.value || null)}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to publish manually using the switch.
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : existing ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
