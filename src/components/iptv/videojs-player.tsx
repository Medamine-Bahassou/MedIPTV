'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';

interface VideoJSPlayerProps {
  src: string;
  originalUrl?: string; // Original URL before proxy for type detection
  type?: string;
  autoPlay?: boolean;
  title?: string;
  onEnded?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function VideoJSPlayer({ src, originalUrl, type, autoPlay = true, title, onEnded, onError, className = '' }: VideoJSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<ReturnType<typeof import('video.js').default> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs for callbacks to prevent useEffect re-triggers from unstable references
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!src || !videoRef.current) return;

    let player: ReturnType<typeof import('video.js').default>;
    let disposed = false;

    const initPlayer = async () => {
      try {
        const videojs = (await import('video.js')).default;
        await import('video.js/dist/video-js.css');

        if (disposed) return;

        // Clean up previous player
        if (playerRef.current) {
          try { playerRef.current.dispose(); } catch {}
          playerRef.current = null;
        }

        // Build the source object.
        // For HLS: /api/hls-proxy rewrites ALL URLs in the manifest to proxy URLs.
        // No xhrSetup needed — VHS loads everything natively.
        const isHLS = type === 'application/x-mpegURL' || type === 'application/vnd.apple.mpegurl';
        const isTS = type === 'video/mp2t';

        // For live .ts streams, convert to .m3u8 for HLS playback
        let manifestUrl = '';
        if (isTS && originalUrl && originalUrl.includes('/live/')) {
          manifestUrl = originalUrl.replace(/\.ts$/, '.m3u8');
        } else if (isHLS && originalUrl) {
          manifestUrl = originalUrl;
        }

        const isLiveHLS = !!(manifestUrl);

        const source: { src: string; type?: string } = {
          src: isLiveHLS
            ? `/api/hls-proxy?url=${encodeURIComponent(manifestUrl)}`
            : src,
        };
        if (isLiveHLS) {
          source.type = 'application/x-mpegURL';
        } else if (type && !isTS) {
          source.type = type;
        }

        player = videojs(videoRef.current, {
          controls: true,
          autoplay: autoPlay,
          preload: 'auto',
          fluid: false,
          responsive: true,
          fill: true,
          sources: [source],
          html5: {
            vhs: {
              overrideNative: !!(source.type && source.type.includes('mpegURL')),
              enableLowInitialPlaylist: true,
              // No xhrSetup — all URLs are already proxied in the manifest
            },
            nativeAudioTracks: true,
            nativeVideoTracks: true,
          },
          controlBar: {
            children: [
              'playToggle',
              'volumePanel',
              'currentTimeDisplay',
              'timeDivider',
              'durationDisplay',
              'progressControl',
              'fullscreenToggle',
            ],
          },
        });

        if (disposed) {
          player.dispose();
          return;
        }

        playerRef.current = player;

        player.on('loadedmetadata', () => {
          setIsLoading(false);
          setError(null);
        });

        player.on('playing', () => setIsLoading(false));
        player.on('waiting', () => setIsLoading(true));
        player.on('ended', () => onEndedRef.current?.());
        player.on('error', () => {
          const err = player.error();
          const msg = err?.message || 'Playback error';
          setError(msg);
          onErrorRef.current?.(msg);
        });

        // Native video events as backup
        if (videoRef.current) {
          const handleNativeError = () => {
            const mediaErr = videoRef.current?.error;
            const nativeMsg = mediaErr?.message || 'Native playback error';
            setError(nativeMsg);
            onErrorRef.current?.(nativeMsg);
          };
          const handleCanPlay = () => {
            setIsLoading(false);
            setError(null);
          };
          videoRef.current.addEventListener('error', handleNativeError);
          videoRef.current.addEventListener('canplay', handleCanPlay);
        }
      } catch (err) {
        console.error('Failed to load Video.js:', err);
        setError('Failed to load video player');
        onErrorRef.current?.('Video.js load failed');
      }
    };

    initPlayer();

    return () => {
      disposed = true;
      if (playerRef.current) {
        try { playerRef.current.dispose(); } catch {}
        playerRef.current = null;
      }
    };
    // Only re-init when src or autoplay changes — NOT when callbacks change
  }, [src, autoPlay]);

  // Handle type changes separately (just update source, don't re-init player)
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current === type) return;
    prevTypeRef.current = type;

    if (playerRef.current && src) {
      const isHLS = type === 'application/x-mpegURL' || type === 'application/vnd.apple.mpegurl';
      const isTS = type === 'video/mp2t';

      let manifestUrl = '';
      if (isTS && originalUrl && originalUrl.includes('/live/')) {
        manifestUrl = originalUrl.replace(/\.ts$/, '.m3u8');
      } else if (isHLS && originalUrl) {
        manifestUrl = originalUrl;
      }

      const isLiveHLS = !!(manifestUrl);

      const source: { src: string; type?: string } = {
        src: isLiveHLS
          ? `/api/hls-proxy?url=${encodeURIComponent(manifestUrl)}`
          : src,
      };
      if (isLiveHLS) {
        source.type = 'application/x-mpegURL';
      } else if (type && !isTS) {
        source.type = type;
      }
      playerRef.current.src(source);
      if (autoPlay) playerRef.current.play().catch(() => {});
    }
  }, [type, src, autoPlay, originalUrl]);

  return (
    <div className={`relative bg-black aspect-video w-full ${className}`}>
      <div data-vjs-player className="w-full h-full">
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-theme-factory"
          playsInline
        />
      </div>

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

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 left-4 right-4 bg-red-900/90 text-white px-4 py-2 text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
