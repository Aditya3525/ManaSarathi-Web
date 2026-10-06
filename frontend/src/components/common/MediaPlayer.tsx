/* eslint-disable jsx-a11y/media-has-caption */
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Settings,
  Download,
  Repeat
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '../ui/dropdown-menu';
import { Slider } from '../ui/slider';
import { cn } from '../ui/utils';

interface MediaPlayerProps {
  audioUrl?: string | null;
  videoUrl?: string | null;
  youtubeUrl?: string | null;
  poster?: string | null;
  title?: string;
  artist?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  showDownload?: boolean;
  variant?: 'minimal' | 'full' | 'ambient';
  /** Controlled playing state - if provided, component becomes controlled */
  playing?: boolean;
  /** Controlled volume (0-1) */
  volume?: number;
  onTimeUpdate?: (current: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  fillScreen?: boolean;
}

// Simple YouTube embed ID extractor
export function extractYouTubeId(url?: string | null) {
  if (!url) return null;
  const input = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1).split(/[?&#]/)[0];
      if (id) return id;
    }
    const watchId = u.searchParams.get('v');
    if (watchId) return watchId;
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
  } catch (_) {
    // ignore parse errors
  }
  return null;
}

const formatTime = (seconds: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  audioUrl,
  videoUrl,
  youtubeUrl,
  poster,
  title,
  artist,
  className = '',
  autoPlay,
  loop = false,
  showDownload = false,
  variant = 'full',
  playing: controlledPlaying,
  volume: controlledVolume,
  onTimeUpdate,
  onEnded,
  onPlay,
  onPause,
  onVolumeChange,
  fillScreen
}) => {
  const ytId = extractYouTubeId(youtubeUrl) || extractYouTubeId(audioUrl);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isControlled = controlledPlaying !== undefined;
  
  const [showYouTube, setShowYouTube] = useState(!!autoPlay);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(controlledVolume ?? 0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLooping, setIsLooping] = useState(loop);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVideo = !!videoUrl;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  // Use controlled playing state if provided
  const effectivePlaying = isControlled ? controlledPlaying : isPlaying;

  // Sync with controlled playing prop
  useEffect(() => {
    if (!isControlled) return;
    const el = mediaRef.current;
    if (!el) return;
    
    if (controlledPlaying && el.paused) {
      el.play().catch(() => undefined);
    } else if (!controlledPlaying && !el.paused) {
      el.pause();
    }
  }, [isControlled, controlledPlaying]);

  // Sync with controlled volume prop
  useEffect(() => {
    if (controlledVolume === undefined) return;
    const el = mediaRef.current;
    if (el) {
      el.volume = controlledVolume;
      setVolume(controlledVolume);
    }
  }, [controlledVolume]);

  // Auto-hide controls for video
  useEffect(() => {
    if (isVideo && effectivePlaying && !isHovering) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [isVideo, effectivePlaying, isHovering]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isVideo && effectivePlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isVideo, effectivePlaying]);

  // Media element event handlers
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const handleLoaded = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      onTimeUpdate?.(el.currentTime, el.duration || 0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };
    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);

    // Set initial values
    el.volume = volume;
    el.playbackRate = playbackRate;
    el.loop = isLooping;

    return () => {
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate, onEnded, onPlay, onPause, volume, playbackRate, isLooping]);

  // Fullscreen handling
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlayback = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const handleSeek = (values: number[]) => {
    const el = mediaRef.current;
    if (!el || duration === 0) return;
    const newTime = (values[0] / 100) * duration;
    el.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (values: number[]) => {
    const val = values[0];
    setVolume(val);
    setIsMuted(val === 0);
    if (mediaRef.current) mediaRef.current.volume = val;
    onVolumeChange?.(val);
  };

  const toggleMute = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (isMuted) {
      el.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      el.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(duration, el.currentTime + seconds));
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (mediaRef.current) mediaRef.current.playbackRate = rate;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
    if (mediaRef.current) mediaRef.current.loop = !isLooping;
  };

  // YouTube Player
  if (ytId) {
    const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <div 
        className={cn(
          "relative rounded-xl overflow-hidden bg-slate-950 group",
          fillScreen ? 'w-full h-full' : 'w-full aspect-video',
          className
        )}
      >
        {showYouTube ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1${autoPlay ? '&autoplay=1' : ''}`}
            title={title || "YouTube video player"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowYouTube(true)}
            className="group/btn w-full h-full relative text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`Play ${title || 'video'}`}
          >
            <img
              src={thumbnail}
              alt={title || "Video thumbnail"}
              className="w-full h-full object-cover transition-transform duration-700 group-hover/btn:scale-105"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.style.display = 'none';
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:bg-primary">
                <Play className="h-8 w-8 text-white ml-1 fill-current" />
              </div>
            </div>
            {/* Title overlay */}
            {title && (
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-semibold text-lg line-clamp-2">{title}</h3>
                {artist && <p className="text-white/70 text-sm">{artist}</p>}
              </div>
            )}
          </button>
        )}
      </div>
    );
  }

  // Video Player
  if (videoUrl) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-xl overflow-hidden bg-slate-950 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          fillScreen ? 'w-full h-full' : 'w-full aspect-video',
          className
        )}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        aria-label={`Video player: ${title || 'Video'}`}
      >
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          className="w-full h-full object-contain cursor-pointer"
          src={videoUrl}
          poster={poster || undefined}
          playsInline
          onClick={togglePlayback}
          aria-hidden="true"
        />

        {/* Large center play button (shows when paused) */}
        {!effectivePlaying && (
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
            aria-label="Play video"
            tabIndex={-1}
          >
            <div className="w-20 h-20 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-white ml-1 fill-current" />
            </div>
          </button>
        )}

        {/* Controls overlay */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-all duration-300",
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {/* Progress bar */}
          <div className="mb-3">
            <Slider
              value={[progress]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="cursor-pointer [&>.relative>.absolute]:bg-primary [&>.relative]:bg-white/20 [&>.relative]:h-1 hover:[&>.relative]:h-2 transition-all"
              aria-label="Seek"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Left controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayback}
                className="h-10 w-10 rounded-full text-white hover:bg-white/20"
                aria-label={effectivePlaying ? 'Pause' : 'Play'}
              >
                {effectivePlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 ml-0.5 fill-current" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(-10)}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                aria-label="Skip back 10 seconds"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(10)}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                aria-label="Skip forward 10 seconds"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  step={0.01}
                  className="w-20 opacity-0 group-hover/vol:opacity-100 transition-opacity [&>.relative>.absolute]:bg-white"
                  aria-label="Volume"
                />
              </div>

              <span className="text-xs font-mono text-white/70 ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10 text-xs">
                    {playbackRate}x
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-white/10 text-white min-w-[100px]">
                  <DropdownMenuLabel className="text-white/60 text-xs">Speed</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {playbackRates.map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={cn(
                        "focus:bg-white/10 focus:text-white cursor-pointer",
                        playbackRate === rate && "bg-primary/20 text-primary"
                      )}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLoop}
                className={cn(
                  "h-8 w-8 hover:bg-white/10",
                  isLooping ? "text-primary" : "text-white/60 hover:text-white"
                )}
                aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
              >
                <Repeat className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Audio Player
  if (audioUrl) {
    const isAmbient = variant === 'ambient';
    const isMinimal = variant === 'minimal';

    return (
      <div
        className={cn(
          "rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isAmbient && "bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-6",
          !isAmbient && !isMinimal && "bg-slate-100 dark:bg-slate-900 p-6",
          isMinimal && "bg-transparent",
          className
        )}
        aria-label={`Audio player: ${title || 'Audio'}`}
      >
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={audioUrl}
          preload="metadata"
          aria-hidden="true"
        />

        {/* Album art / Poster (only for full variant) */}
        {!isMinimal && poster && (
          <div className="relative mx-auto w-48 h-48 mb-6 rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
            <img
              src={poster}
              alt={title || "Audio cover"}
              className="w-full h-full object-cover"
            />
            {/* Animated ring when playing */}
            {effectivePlaying && (
              <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/50 animate-pulse" />
            )}
          </div>
        )}

        {/* Title & Artist */}
        {!isMinimal && (title || artist) && (
          <div className="text-center mb-6">
            {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
            {artist && <p className="text-sm text-muted-foreground">{artist}</p>}
          </div>
        )}

        {/* Progress bar */}
        <div className={cn("space-y-2", isMinimal ? "mb-2" : "mb-4")}>
          <Slider
            value={[progress]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className={cn(
              "cursor-pointer [&>.relative>.absolute]:bg-primary",
              isAmbient && "[&>.relative]:bg-primary/20",
              !isAmbient && "[&>.relative]:bg-slate-200 dark:[&>.relative]:bg-slate-700"
            )}
            aria-label="Seek"
          />
          <div className="flex justify-between text-xs font-mono text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className={cn(
          "flex items-center justify-center gap-4",
          isMinimal && "gap-2"
        )}>
          {!isMinimal && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(-15)}
              className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              aria-label="Skip back 15 seconds"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(-10)}
            className={cn(
              "rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10",
              isMinimal ? "h-8 w-8" : "h-10 w-10"
            )}
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw className={isMinimal ? "h-4 w-4" : "h-5 w-5"} />
          </Button>

          {/* Main play/pause button */}
          <Button
            size="icon"
            onClick={togglePlayback}
            className={cn(
              "rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all",
              isMinimal ? "h-12 w-12" : "h-16 w-16",
              effectivePlaying && "hover:scale-95",
              !effectivePlaying && "hover:scale-105"
            )}
            aria-label={effectivePlaying ? 'Pause' : 'Play'}
          >
            {effectivePlaying ? (
              <Pause className={cn(isMinimal ? "h-5 w-5" : "h-7 w-7", "fill-current")} />
            ) : (
              <Play className={cn(isMinimal ? "h-5 w-5" : "h-7 w-7", "ml-1 fill-current")} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(10)}
            className={cn(
              "rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10",
              isMinimal ? "h-8 w-8" : "h-10 w-10"
            )}
            aria-label="Forward 10 seconds"
          >
            <RotateCw className={isMinimal ? "h-4 w-4" : "h-5 w-5"} />
          </Button>

          {!isMinimal && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(15)}
              className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              aria-label="Skip forward 15 seconds"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Secondary controls */}
        {!isMinimal && (
          <div className="flex items-center justify-center gap-4 mt-4">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-full"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.01}
                className="w-20 [&>.relative>.absolute]:bg-primary"
                aria-label="Volume"
              />
            </div>

            {/* Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-muted-foreground hover:text-primary">
                  <Settings className="h-4 w-4 mr-1" />
                  {playbackRate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="text-xs">Playback Speed</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {playbackRates.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={cn(
                      "cursor-pointer",
                      playbackRate === rate && "bg-primary/10 text-primary"
                    )}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Loop */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLoop}
              className={cn(
                "h-8 w-8 rounded-full",
                isLooping ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
              )}
              aria-label={isLooping ? 'Disable repeat' : 'Enable repeat'}
            >
              <Repeat className="h-4 w-4" />
            </Button>

            {/* Download */}
            {showDownload && audioUrl && (
              <a
                href={audioUrl}
                download
                className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Download audio"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // No media fallback
  return (
    <div className={cn("text-sm text-muted-foreground p-4 text-center rounded-lg bg-muted/50", className)}>
      No media available
    </div>
  );
};
