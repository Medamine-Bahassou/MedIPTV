'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  src: string;
  originalUrl?: string; // Original URL before proxy for type detection
  autoPlay?: boolean;
  title?: string;
  onEnded?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function HLSPlayer({ src, originalUrl, autoPlay = true, title, onEnded, onError, className = '' }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs for callbacks to prevent useEffect re-triggers
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const hideControlsDelayed = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const showControlsNow = useCallback(() => {
    setShowControls(true);
    hideControlsDelayed();
  }, [hideControlsDelayed]);

  useEffect(() => {
    if (!src || !videoRef.current) return;

    const video = videoRef.current;

    // Schedule state updates outside of effect
    setTimeout(() => {
      setIsLoading(true);
      setError(null);
    }, 0);

    // Destroy previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Determine stream type from original URL (proxy URLs hide the extension)
    const detectUrl = originalUrl || src;
    const lower = detectUrl.toLowerCase();
    const isHLS = lower.includes('.m3u8');
    const isDirectVideo = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mkv');
    const isLiveTS = lower.endsWith('.ts') && lower.includes('/live/');

    if (isDirectVideo) {
      // Direct video (MP4/WebM) - use proxied URL for native HTML5
      video.src = src;
      video.load();
      if (autoPlay) {
        video.play().catch(() => {});
      }
    } else if (isLiveTS || isHLS) {
      // HLS live stream - convert .ts to .m3u8 for HLS playback
      const hlsManifestUrl = isLiveTS
        ? detectUrl.replace(/\.ts$/, '.m3u8')
        : detectUrl;

      // The /api/hls-proxy rewrites ALL resource URLs (segments, sub-playlists)
      // inside the manifest to point through /api/player-proxy or /api/hls-proxy.
      // HLS.js loads everything natively — no xhrSetup needed.
      const proxyManifest = `/api/hls-proxy?url=${encodeURIComponent(hlsManifestUrl)}`;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1,
          // No xhrSetup needed — all URLs are already proxied in the manifest
        });
        hlsRef.current = hls;

        hls.loadSource(proxyManifest);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setError(null);
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Network error - retrying...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media error - recovering...');
                hls.recoverMediaError();
                break;
              default:
                setError('Fatal playback error');
                hls.destroy();
                onErrorRef.current?.('Fatal HLS error');
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari) - same proxy approach
        video.src = proxyManifest;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });
      } else {
        setTimeout(() => {
          setError('HLS not supported in this browser');
        }, 0);
        onErrorRef.current?.('HLS not supported');
      }
    } else {
      // Fallback: try direct native playback with proxied URL
      video.src = src;
      video.load();
      if (autoPlay) {
        video.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, originalUrl, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration || 0);
    const handleEnded = () => { setIsPlaying(false); onEndedRef.current?.(); };
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadstart', onLoadStart);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play().catch(() => {});
    showControlsNow();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (t: number) => {
    if (!isFinite(t)) return 'LIVE';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-black aspect-video w-full ${className}`}
      onMouseMove={showControlsNow}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Loading spinner */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none"
          >
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 left-4 right-4 bg-red-900/90 text-white px-4 py-2 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-3 px-4"
          >
            {/* Progress bar */}
            {duration > 0 && isFinite(duration) && (
              <div className="mb-2 group cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={currentTime}
                  onChange={seek}
                  step={0.1}
                  className="w-full h-1 bg-white/30 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-gray-300 transition-colors">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-white hover:text-gray-300 transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-white/30 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none"
                  />
                </div>
                <span className="text-white/70 text-xs font-mono">
                  {!isFinite(duration) ? 'LIVE' : `${formatTime(currentTime)} / ${formatTime(duration)}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {title && (
                  <span className="text-white/70 text-xs hidden md:block max-w-[200px] truncate">{title}</span>
                )}
                <button onClick={toggleFullscreen} className="text-white hover:text-gray-300 transition-colors">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
