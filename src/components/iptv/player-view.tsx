'use client';

import { useCallback, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Radio, MonitorPlay, Play } from 'lucide-react';
import { HLSPlayer } from './hls-player';
import { VideoJSPlayer } from './videojs-player';
import { HTML5Player } from './html5-player';
import type { PlayerType } from '@/store/iptv-store';

interface PlayerViewProps {
  src: string;
  originalUrl?: string; // Original URL before proxy for type detection
  title?: string;
  playerType: PlayerType;
  onPlayerChange: (type: PlayerType) => void;
  onBack?: () => void;
}

const playerOptions: { value: PlayerType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'hlsjs', label: 'HLS.js', icon: <Radio className="w-4 h-4" />, desc: 'Best for .m3u8 / HLS streams' },
  { value: 'videojs', label: 'Video.js', icon: <MonitorPlay className="w-4 h-4" />, desc: 'Versatile player with HLS support' },
  { value: 'html5', label: 'HTML5', icon: <Play className="w-4 h-4" />, desc: 'Best for .ts / direct streams' },
];

export function PlayerView({ src, originalUrl, title, playerType, onPlayerChange, onBack }: PlayerViewProps) {
  const [playerKey, setPlayerKey] = useState(0);

  // Detect the source type from the ORIGINAL URL (before proxy) to pass correct MIME
  const sourceType = useMemo(() => {
    const detectUrl = originalUrl || src;
    const lower = detectUrl.toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.m3u8')) return 'application/x-mpegURL';
    if (lower.endsWith('.ts')) return 'video/mp2t';
    // Default: if URL contains /live/ treat as HLS (m3u8)
    if (lower.includes('/live/')) return 'application/x-mpegURL';
    // Default: if URL contains /movie/ treat as MP4
    if (lower.includes('/movie/')) return 'video/mp4';
    return 'application/octet-stream';
  }, [originalUrl, src]);

  const handlePlayerChange = useCallback((type: PlayerType) => {
    onPlayerChange(type);
    setPlayerKey(prev => prev + 1);
  }, [onPlayerChange]);

  const handleRetry = useCallback(() => {
    setPlayerKey(prev => prev + 1);
  }, []);

  const renderPlayer = () => {
    switch (playerType) {
      case 'hlsjs':
        return <HLSPlayer key={playerKey} src={src} originalUrl={originalUrl} title={title} />;
      case 'videojs':
        return <VideoJSPlayer key={playerKey} src={src} originalUrl={originalUrl} title={title} type={sourceType} />;
      case 'html5':
        return <HTML5Player key={playerKey} src={src} originalUrl={originalUrl} title={title} type={sourceType} />;
    }
  };

  // Determine recommended player based on stream type
  const recommendedPlayer = sourceType === 'application/x-mpegURL' ? 'hlsjs' : 'html5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-3"
    >
      {/* Player container */}
      <div className="relative bg-black">
        {renderPlayer()}
      </div>

      {/* Player controls bar */}
      <div className="flex flex-wrap items-center justify-between bg-zinc-900 px-4 py-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-400 text-xs uppercase tracking-wider">Player:</span>
          {playerOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => handlePlayerChange(opt.value)}
              title={opt.desc}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                playerType === opt.value
                  ? 'bg-white text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {opt.icon}
              {opt.label}
              {opt.value === recommendedPlayer && playerType !== opt.value && (
                <span className="text-[9px] opacity-60">(recommended)</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-600 text-[10px] font-mono hidden sm:inline">{sourceType}</span>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all duration-200"
          >
            Retry
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all duration-200"
            >
              Back to List
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
