/* eslint-disable jsx-a11y/media-has-caption */
import {
  Clock,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  ListVideo,
  Repeat,
  Heart,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { MediaPlayer, extractYouTubeId } from '../../common/MediaPlayer';
import {
  Dialog,
  DialogContent
} from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Slider } from '../../ui/slider';
import { cn } from '../../ui/utils';

import type { LibraryItem } from './types';

// Breathing animation component for mindfulness content
const BreathingGuide = ({ isActive }: { isActive: boolean }) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  
  useEffect(() => {
    if (!isActive) return;
    
    const cycle = () => {
      setPhase('inhale');
      setTimeout(() => setPhase('hold'), 4000);
      setTimeout(() => setPhase('exhale'), 7000);
    };
    
    cycle();
    const interval = setInterval(cycle, 11000);
    return () => clearInterval(interval);
  }, [isActive]);
  
  if (!isActive) return null;
  
  return (
    <div className="absolute top-6 left-6 flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 text-white text-sm font-medium">
      <div className={cn(
        "w-3 h-3 rounded-full transition-all duration-[4000ms]",
        phase === 'inhale' && "bg-teal-400 scale-150",
        phase === 'hold' && "bg-amber-400 scale-150",
        phase === 'exhale' && "bg-blue-400 scale-75"
      )} />
      <span className="capitalize">{phase === 'hold' ? 'Hold' : phase}</span>
    </div>
  );
};

// Session completion celebration
const CompletionCelebration = ({ show, onClose }: { show: boolean; onClose: () => void }) => {
  if (!show) return null;
  
  return (
    <div 
      className="absolute inset-0 bg-gradient-to-br from-primary/90 to-teal-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white z-50 animate-in fade-in duration-500"
      role="alert"
      aria-label="Session completed"
    >
      <div className="relative">
        <CheckCircle2 className="h-20 w-20 text-white animate-in zoom-in duration-500" />
        <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-amber-300 animate-pulse" />
      </div>
      <h3 className="text-2xl font-bold mt-6 mb-2">Well Done!</h3>
      <p className="text-white/80 text-center max-w-xs mb-6">
        You&apos;ve completed this session. Take a moment to appreciate your progress.
      </p>
      <Button 
        onClick={onClose}
        className="bg-white text-primary hover:bg-white/90"
      >
        Continue
      </Button>
    </div>
  );
};

interface MediaPlayerDialogProps {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showBreathingGuide?: boolean;
  onSessionComplete?: () => void;
}

const formatTime = (seconds?: number | null) => {
  if (!seconds || Number.isNaN(seconds)) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const isProbablyUrl = (value?: string | null) => {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
};

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function MediaPlayerDialog({ item, open, onOpenChange, showBreathingGuide = false, onSessionComplete }: MediaPlayerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const media = item?.media ?? null;
  const audioYtId = media?.kind === 'audio' ? extractYouTubeId(media?.src) : null;
  const resolvedYoutubeId = media?.youtubeId || audioYtId || undefined;

  const isVideo = media?.kind === 'video' && !media.youtubeId;
  const isYouTube = (media?.kind === 'video' && !!media.youtubeId) || !!audioYtId;
  const isAudio = media?.kind === 'audio' && !audioYtId;
  const useSharedVideoPlayer = isVideo || isYouTube;
  const isTextualItem = item?.displayType === 'article' || item?.displayType === 'story' || item?.displayType === 'resource';
  const isLightMode = isAudio || isTextualItem;
  const textualBody = typeof item?.body === 'string' ? item.body.trim() : '';
  const isTextBodyUrl = isProbablyUrl(textualBody);
  const externalUrl = item?.externalUrl || (isTextBodyUrl ? textualBody : null);
  const isMindfulness = item?.category === 'meditation' || item?.category === 'breathing' || item?.tags?.some(t => 
    ['meditation', 'mindfulness', 'breathing', 'relaxation'].includes(t.toLowerCase())
  );

  const mediaElement = useMemo(() => (isVideo ? videoRef.current : (isAudio ? audioRef.current : null)), [isVideo, isAudio]);

  // Auto-hide controls for video
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isVideo && isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isVideo, isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const el = mediaElement;
      if (!el) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (el.paused) {
            el.play().catch(() => undefined);
            setIsPlaying(true);
          } else {
            el.pause();
            setIsPlaying(false);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          el.currentTime = Math.max(0, el.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          el.currentTime = Math.min(duration, el.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(100, v + 10));
          if (el) el.volume = Math.min(1, el.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 10));
          el.volume = Math.max(0, el.volume - 0.1);
          break;
        case 'KeyM':
          if (isMuted || el.volume === 0) {
            el.volume = volume / 100;
            setIsMuted(false);
          } else {
            el.volume = 0;
            setIsMuted(true);
          }
          break;
        case 'KeyF':
          if (!document.fullscreenElement) {
            const fullscreenTarget = containerRef.current || videoRef.current;
            fullscreenTarget?.requestFullscreen?.();
          } else {
            document.exitFullscreen?.();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, mediaElement, duration, isMuted, volume]);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      const el = mediaElement;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      return;
    }

    if (mediaElement) {
      mediaElement.volume = volume / 100;
      mediaElement.playbackRate = playbackRate;
    }
  }, [open, mediaElement, volume, playbackRate]);

  useEffect(() => {
    const el = mediaElement;
    if (!el) return;

    const handleLoaded = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const handleTimeUpdate = () => setCurrentTime(el.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      if (!isLooping) {
        setShowCompletion(true);
        onSessionComplete?.();
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);

    return () => {
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
    };
  }, [mediaElement, item?.id, isLooping, onSessionComplete]);

  useEffect(() => {
    if (!document) return;
    const handler = () => {
      const fullscreenElement = document.fullscreenElement;
      setIsFullscreen(Boolean(fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlayback = () => {
    const el = mediaElement;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (values: number[]) => {
    const el = mediaElement;
    if (!el || duration === 0) return;
    const value = values[0];
    const newTime = (value / 100) * duration;
    el.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (values: number[]) => {
    const value = values[0];
    setVolume(value);
    const el = mediaElement;
    if (el) {
      el.volume = value / 100;
      setIsMuted(value === 0);
    }
  };

  const toggleMute = () => {
    const el = mediaElement;
    if (!el) return;
    if (isMuted || el.volume === 0) {
      el.volume = volume / 100;
      setIsMuted(false);
    } else {
      el.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current || videoRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
    if (mediaElement) mediaElement.loop = !isLooping;
  };

  const currentProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVolume(80);
    setIsMuted(false);
    setPlaybackRate(1);
    setShowCompletion(false);
    setIsLooping(false);
  }, [item?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-6xl p-0 overflow-hidden border-none shadow-2xl transition-colors duration-500",
          isLightMode ? 'bg-gradient-to-br from-slate-50 to-[#F2F5F3] text-slate-900' : 'bg-slate-950 text-white',
          "!bg-opacity-100"
        )}
        style={{ backgroundColor: isLightMode ? undefined : '#020617' }}
        aria-label={`Media player: ${item?.title || 'No content'}`}
      >
        {item ? (
          <div className="grid lg:grid-cols-[1.8fr_1fr] min-h-[600px]">
            {/* Left Panel: Media Player Area */}
            <div 
              ref={containerRef}
              className={cn(
                "relative flex flex-col",
                isLightMode ? 'bg-gradient-to-tr from-cyan-50/70 via-teal-50/40 to-emerald-50/60 p-12 items-center justify-center' : 'bg-black items-center justify-center group'
              )}
              style={{ backgroundColor: isLightMode ? undefined : '#000000' }}
              onMouseMove={handleMouseMove}
            >
              {/* Completion Celebration Overlay */}
              <CompletionCelebration 
                show={showCompletion} 
                onClose={() => setShowCompletion(false)} 
              />

              {/* Breathing Guide for mindfulness content - only for native video/audio, not YouTube */}
              {!isYouTube && (showBreathingGuide || isMindfulness) && isPlaying && (
                <BreathingGuide isActive={isPlaying} />
              )}

              {/* --- VIDEO PLAYER --- */}
              {useSharedVideoPlayer && (media?.src || resolvedYoutubeId) ? (
                <div className="h-full w-full">
                  <MediaPlayer
                    videoUrl={!isYouTube ? media?.src : undefined}
                    youtubeUrl={resolvedYoutubeId}
                    poster={media?.poster ?? item.thumbnail}
                    title={item.title}
                    artist={item.author || undefined}
                    autoPlay
                    variant="full"
                    fillScreen
                  />
                </div>
              ) : null}

              {!useSharedVideoPlayer && isVideo && media?.src ? (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain cursor-pointer"
                    src={media.src ?? undefined}
                    poster={media.poster ?? undefined}
                    preload="metadata"
                    playsInline
                    onClick={togglePlayback}
                    aria-label={`${item.title} video player`}
                  />

                  {/* Large center play button when paused */}
                  {!isPlaying && (
                    <button
                      onClick={togglePlayback}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
                      aria-label="Play video"
                    >
                      <div className="w-20 h-20 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                        <Play className="h-8 w-8 text-white ml-1 fill-current" />
                      </div>
                    </button>
                  )}

                  {/* Video Controls Overlay */}
                  <div className={cn(
                    "absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300",
                    showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                  )}>
                    <div className="flex flex-col gap-3">
                      {/* Progress Bar */}
                      <Slider
                        value={[currentProgress]}
                        onValueChange={handleSeek}
                        max={100}
                        step={0.1}
                        className="cursor-pointer [&>.relative>.absolute]:bg-primary [&>.relative]:bg-white/20 [&>.relative]:h-1.5 hover:[&>.relative]:h-2 transition-all"
                        aria-label="Seek"
                      />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={togglePlayback}
                            className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 ml-0.5 fill-current" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { const el = mediaElement; if (el) el.currentTime = Math.max(0, el.currentTime - 10); }}
                            className="h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                            aria-label="Skip back 10 seconds"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { const el = mediaElement; if (el) el.currentTime = Math.min(duration, el.currentTime + 10); }}
                            className="h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                            aria-label="Skip forward 10 seconds"
                          >
                            <RotateCw className="h-5 w-5" />
                          </Button>

                          <div className="flex items-center gap-2 group/volume">
                            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 text-white/80 hover:text-white" aria-label={isMuted ? 'Unmute' : 'Mute'}>
                              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            </Button>
                            <Slider
                              value={[isMuted ? 0 : volume]}
                              onValueChange={handleVolume}
                              max={100}
                              step={1}
                              className="w-24 opacity-0 group-hover/volume:opacity-100 transition-all duration-300 [&>.relative>.absolute]:bg-white"
                              aria-label="Volume"
                            />
                          </div>

                          <span className="text-sm font-medium font-mono text-white/70">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleLoop}
                            className={cn(
                              "h-8 w-8 rounded-full",
                              isLooping ? "text-primary bg-white/20" : "text-white/60 hover:text-white hover:bg-white/10"
                            )}
                            aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
                          >
                            <Repeat className="h-4 w-4" />
                          </Button>
                          <Select value={String(playbackRate)} onValueChange={(value) => {
                            const rate = Number(value);
                            setPlaybackRate(rate);
                            const el = mediaElement;
                            if (el) el.playbackRate = rate;
                          }}>
                            <SelectTrigger className="h-8 w-[80px] bg-transparent border-none text-white/70 hover:text-white focus:ring-0 text-xs">
                              <SelectValue placeholder="1x" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                              {playbackRates.map((rate) => (
                                <SelectItem key={rate} value={String(rate)} className="focus:bg-white/10 focus:text-white">
                                  {rate}x
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-white/80 hover:text-white">
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {/* --- AUDIO PLAYER --- */}
              {isAudio && media?.src ? (
                <div className="w-full max-w-md flex flex-col items-center gap-8">
                  {/* Album Art with playing animation */}
                  <div className="relative">
                    <div className={cn(
                      "relative w-72 h-72 rounded-[2rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/5 transition-transform duration-700 ease-out",
                      isPlaying && "scale-105"
                    )}>
                      <img
                        src={media.poster ?? item.thumbnail ?? '/audio-cover-fallback.jpg'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Subtle overlay for depth */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-teal-900/10 to-transparent mix-blend-overlay" />
                      {/* Playing pulse ring */}
                      {isPlaying && (
                        <div className="absolute inset-0 rounded-[2rem] ring-2 ring-primary/50 animate-pulse" />
                      )}
                    </div>
                    {/* Favorite button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFavorited(!isFavorited)}
                      className={cn(
                        "absolute -bottom-3 -right-3 h-12 w-12 rounded-full shadow-lg transition-all",
                        isFavorited 
                          ? "bg-rose-100 text-rose-500 hover:bg-rose-200" 
                          : "bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                      )}
                      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={cn("h-5 w-5", isFavorited && "fill-current")} />
                    </Button>
                  </div>

                  {/* Title */}
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                    {item.category && (
                      <p className="text-sm text-slate-500 capitalize mt-1">{item.category}</p>
                    )}
                  </div>

                  {/* Audio Controls Container */}
                  <div className="w-full bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-white/50">
                    {/* Progress */}
                    <div className="mb-6 space-y-2">
                      <Slider
                        value={[currentProgress]}
                        onValueChange={handleSeek}
                        max={100}
                        step={0.1}
                        className="cursor-pointer [&>.relative>.absolute]:bg-primary [&>.relative]:bg-primary/20 [&>.relative]:h-2"
                        aria-label="Seek"
                      />
                      <div className="flex justify-between text-xs font-medium text-slate-400 font-mono">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-center gap-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const el = mediaElement;
                          if (el) el.currentTime = Math.max(0, el.currentTime - 10);
                        }}
                        className="h-12 w-12 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        aria-label="Skip back 10 seconds"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </Button>

                      <Button
                        size="icon"
                        onClick={togglePlayback}
                        className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 ml-1 fill-current" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const el = mediaElement;
                          if (el) el.currentTime = Math.min(duration, el.currentTime + 10);
                        }}
                        className="h-12 w-12 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        aria-label="Skip forward 10 seconds"
                      >
                        <RotateCw className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Secondary controls */}
                    <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
                      {/* Volume */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleMute}
                          className="h-8 w-8 text-slate-400 hover:text-primary rounded-full"
                          aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          onValueChange={handleVolume}
                          max={100}
                          step={1}
                          className="w-20 [&>.relative>.absolute]:bg-primary"
                          aria-label="Volume"
                        />
                      </div>

                      {/* Speed */}
                      <Select value={String(playbackRate)} onValueChange={(value) => {
                        const rate = Number(value);
                        setPlaybackRate(rate);
                        const el = mediaElement;
                        if (el) el.playbackRate = rate;
                      }}>
                        <SelectTrigger className="h-8 w-[70px] bg-slate-50 border-none text-slate-600 focus:ring-1 focus:ring-primary text-xs rounded-full">
                          <SelectValue placeholder="1x" />
                        </SelectTrigger>
                        <SelectContent>
                          {playbackRates.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              {rate}x
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Loop */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleLoop}
                        className={cn(
                          "h-8 w-8 rounded-full",
                          isLooping ? "text-primary bg-primary/10" : "text-slate-400 hover:text-primary hover:bg-primary/10"
                        )}
                        aria-label={isLooping ? 'Disable repeat' : 'Enable repeat'}
                      >
                        <Repeat className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <audio
                    ref={audioRef}
                    src={media.src ?? undefined}
                    preload="metadata"
                    aria-label={`${item.title} audio player`}
                  />
                </div>
              ) : null}

              {/* --- YOUTUBE PLAYER --- */}
              {!useSharedVideoPlayer && isYouTube && (
                <div className="relative w-full h-full bg-black">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${resolvedYoutubeId}?autoplay=1&rel=0&modestbranding=1`}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* --- TEXTUAL/RESOURCE VIEW --- */}
              {!isVideo && !isAudio && !isYouTube && isTextualItem && (
                <ScrollArea className="w-full h-full max-h-[600px]">
                  <div className="w-full max-w-3xl px-6 py-10 mx-auto">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                      <p className="text-sm text-slate-600 mb-5">
                        {item.description || 'This item is presented as reading/resource content.'}
                      </p>

                      {externalUrl && (
                        <Button
                          type="button"
                          onClick={() => window.open(externalUrl, '_blank', 'noopener,noreferrer')}
                          className="mb-4"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Source
                        </Button>
                      )}

                      {!!textualBody && !isTextBodyUrl && (
                        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                          {textualBody}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Right Panel: Details */}
            <div 
              className={cn(
                "flex flex-col h-full overflow-hidden",
                isLightMode ? 'bg-white/80 backdrop-blur-md border-l border-slate-200/50' : 'bg-slate-900 border-l border-white/5'
              )}
              style={{ backgroundColor: isLightMode ? undefined : '#0f172a' }}
            >
              <ScrollArea className="flex-1">
                <div className="p-8 space-y-8">
                  {/* Header */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      {item.category && (
                        <Badge variant="outline" className={`capitalize ${isLightMode ? 'border-teal-100 text-teal-700 bg-teal-50' : 'border-white/10 text-white/60'
                          }`}>
                          {item.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`flex items-center gap-1 ${isLightMode ? 'border-slate-100 text-slate-500' : 'border-white/10 text-white/60'
                        }`}>
                        <Clock className="h-3 w-3" />
                        {item.durationLabel || formatTime(duration)}
                      </Badge>
                      {item.immediateRelief && (
                        <Badge className="bg-rose-100 text-rose-700 border-none">Quick Relief</Badge>
                      )}
                      {item.crisisEligible && (
                        <Badge className="bg-orange-100 text-orange-700 border-none">Crisis-Safe</Badge>
                      )}
                    </div>

                    <h2 className={`text-2xl font-bold leading-tight ${isLightMode ? 'text-slate-900' : 'text-white'
                      }`}>
                      {item.title}
                    </h2>

                    {item.description && (
                      <p className={`text-sm leading-relaxed ${isLightMode ? 'text-slate-500' : 'text-white/60'
                        }`}>
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="space-y-3">
                      <h4 className={`text-xs font-semibold uppercase tracking-wider ${isLightMode ? 'text-slate-400' : 'text-white/40'
                        }`}>
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className={`border-none ${isLightMode
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-white/10 text-white/80 hover:bg-white/20'
                              }`}
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video Specific: Up Next (Mock) */}
                  {isVideo && (
                    <div className="space-y-4 pt-6 border-t border-white/5">
                      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                        <ListVideo className="h-4 w-4" />
                        Up Next
                      </h4>
                      <div className="space-y-3">
                        {['Cool Down Stretch', 'Breathing Exercise', 'Evening Meditation'].map((title, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group/item transition-colors">
                            <div className="relative w-20 h-12 rounded bg-slate-800 overflow-hidden flex-shrink-0">
                              <div className="absolute inset-0 flex items-center justify-center text-white/20 group-hover/item:text-white/40">
                                <Play className="h-4 w-4 fill-current" />
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white/90 group-hover/item:text-white">{title}</p>
                              <p className="text-xs text-white/50">{10 - i * 2} min • Recommended</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Article Content */}
                  {(item.displayType === 'article' || item.displayType === 'story' || item.displayType === 'resource') && textualBody && !isTextBodyUrl && (
                    <div className={`mt-4 prose prose-sm max-w-none ${isLightMode ? 'prose-slate' : 'prose-invert'
                      }`}>
                      {textualBody}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">Select an item to preview.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
