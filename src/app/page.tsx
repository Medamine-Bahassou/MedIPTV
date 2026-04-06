'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Loader2, Zap } from 'lucide-react';
import { useIPTVStore } from '@/store/iptv-store';
import { Sidebar } from '@/components/iptv/sidebar';
import { PlaylistManager } from '@/components/iptv/playlist-manager';
import { ChannelList } from '@/components/iptv/channel-list';
import { SeriesBrowser } from '@/components/iptv/series-browser';
import { FavoritesView } from '@/components/iptv/favorites-view';
import { PlayerView } from '@/components/iptv/player-view';
import type { Playlist, ViewMode } from '@/store/iptv-store';

// Loading component
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className="w-10 h-10 text-white" />
        </motion.div>
        <p className="text-sm text-zinc-500 tracking-widest uppercase">Loading</p>
      </motion.div>
    </div>
  );
}

function IPTVApp() {
  const store = useIPTVStore();
  const {
    viewMode, setViewMode,
    playlists, setPlaylists,
    currentChannel, playerType, setPlayerType,
    contentType,
    sidebarOpen, setSidebarOpen,
    isLoading, loadingMessage,
  } = store;

  // Fetch playlists on mount
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const res = await fetch('/api/playlists');
        const data = await res.json();
        if (Array.isArray(data)) {
          setPlaylists(data.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            m3uUrl: p.m3uUrl,
            xtreamUrl: p.xtreamUrl,
            xtreamUser: p.xtreamUser,
            xtreamPass: p.xtreamPass,
            channelCount: p.channelCount || 0,
            lastSynced: p.lastSynced,
            createdAt: p.createdAt,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch playlists:', err);
      }
    };
    fetchPlaylists();
  }, [setPlaylists]);

  const handleBackFromPlayer = useCallback(() => {
    setViewMode('channels');
  }, [setViewMode]);

  // Proxy external stream URLs through our backend to avoid Mixed Content errors
  const getProxiedUrl = useCallback((url: string) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      // Only proxy external http/https URLs (not relative paths)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `/api/player-proxy?url=${encodeURIComponent(url)}`;
      }
    } catch {}
    return url;
  }, []);

  const handlePlaylistAdded = useCallback(() => {
    // Re-fetch playlists after adding
    const fetchPlaylists = async () => {
      try {
        const res = await fetch('/api/playlists');
        const data = await res.json();
        if (Array.isArray(data)) {
          setPlaylists(data.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            m3uUrl: p.m3uUrl,
            xtreamUrl: p.xtreamUrl,
            xtreamUser: p.xtreamUser,
            xtreamPass: p.xtreamPass,
            channelCount: p.channelCount || 0,
            lastSynced: p.lastSynced,
            createdAt: p.createdAt,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch playlists:', err);
      }
    };
    fetchPlaylists();
  }, [setPlaylists]);

  const renderView = () => {
    switch (viewMode) {
      case 'playlists':
        return (
          <motion.div
            key="playlists"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PlaylistManager onPlaylistAdded={handlePlaylistAdded} />
          </motion.div>
        );

      case 'channels':
        return (
          <motion.div
            key={contentType === 'series' ? 'series' : 'channels'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {contentType === 'series' ? <SeriesBrowser /> : <ChannelList />}
          </motion.div>
        );

      case 'favorites':
        return (
          <motion.div
            key="favorites"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <FavoritesView />
          </motion.div>
        );

      case 'player':
        if (!currentChannel) {
          setViewMode('channels');
          return null;
        }
        return (
          <motion.div
            key="player"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <PlayerView
              src={getProxiedUrl(currentChannel.url)}
              originalUrl={currentChannel.url}
              title={currentChannel.name}
              playerType={playerType}
              onPlayerChange={setPlayerType}
              onBack={handleBackFromPlayer}
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarOpen(true)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <Menu className="w-5 h-5" />
              </motion.button>
            )}
            <div className="flex items-center gap-2">
              <motion.h2 
                className="text-sm font-bold text-white tracking-wide"
                layout
              >
                {viewMode === 'playlists' && 'Playlist Manager'}
                {viewMode === 'channels' && contentType === 'series' && 'Series Browser'}
                {viewMode === 'channels' && contentType !== 'series' && 'Channel Browser'}
                {viewMode === 'favorites' && 'Favorites'}
                {viewMode === 'player' && 'Now Playing'}
              </motion.h2>
            </div>
          </div>

          {/* Player type indicator (in player mode) */}
          {viewMode === 'player' && currentChannel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Playing:</span>
              <span className="text-xs text-zinc-300 font-medium truncate max-w-[200px]">
                {currentChannel.name}
              </span>
            </motion.div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            {renderView()}
          </AnimatePresence>
        </div>
      </main>

      {/* Global loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4"
          >
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="text-sm text-white font-medium">{loadingMessage || 'Loading...'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <AnimatePresence>
        {store.toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-6 left-1/2 px-5 py-3 text-sm font-medium z-[200] shadow-lg ${
              store.toastType === 'success' ? 'bg-green-600 text-white' :
              store.toastType === 'error' ? 'bg-red-600 text-white' :
              'bg-zinc-700 text-white'
            }`}
          >
            {store.toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <IPTVApp />
    </Suspense>
  );
}
