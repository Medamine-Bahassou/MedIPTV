'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tv, Radio, Film, ListVideo, Heart, Settings, Play, 
  Plus, Trash2, ChevronRight, Menu, X, Clock, Zap
} from 'lucide-react';
import { useIPTVStore, type ViewMode, type ContentType } from '@/store/iptv-store';

const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'playlists', label: 'Playlists', icon: <Radio className="w-4 h-4" /> },
  { id: 'channels', label: 'Live TV', icon: <Tv className="w-4 h-4" /> },
  { id: 'favorites', label: 'Favorites', icon: <Heart className="w-4 h-4" /> },
];

export function Sidebar() {
  const {
    viewMode, setViewMode,
    playlists, removePlaylist, setSelectedPlaylistId,
    selectedPlaylistId, sidebarOpen, setSidebarOpen,
    currentChannel,
  } = useIPTVStore();

  const handleSelectPlaylist = (id: string) => {
    setSelectedPlaylistId(id);
    setViewMode('channels');
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          x: sidebarOpen ? 0 : -280,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed lg:relative top-0 left-0 h-full w-[260px] bg-zinc-950 border-r border-zinc-800 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <motion.div 
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-8 h-8 bg-white flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">MedIPTV</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Player</p>
            </div>
          </motion.div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-2 py-3 border-b border-zinc-800">
          {navItems.map(item => (
            <motion.button
              key={item.id}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewMode(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 mb-0.5 ${
                viewMode === item.id
                  ? 'bg-white text-black font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {item.icon}
              {item.label}
            </motion.button>
          ))}
        </nav>

        {/* Content type filter */}
        <div className="px-2 py-3 border-b border-zinc-800">
          <ContentTypeFilter />
        </div>

        {/* Playlist list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Playlists</span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setViewMode('playlists')}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <AnimatePresence>
            {playlists.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3 py-4 text-center"
              >
                <Radio className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">No playlists yet</p>
                <p className="text-[10px] text-zinc-700 mt-1">Add one to get started</p>
              </motion.div>
            ) : (
              playlists.map((playlist, index) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="group mb-0.5"
                >
                  <button
                    onClick={() => handleSelectPlaylist(playlist.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all duration-200 ${
                      selectedPlaylistId === playlist.id && viewMode === 'channels'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 ${
                      playlist.type === 'xtream' ? 'bg-zinc-800' : 'bg-zinc-800'
                    }`}>
                      {playlist.type === 'xtream' ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : (
                        <ListVideo className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{playlist.name}</p>
                      <p className="text-[10px] text-zinc-600">{playlist.channelCount} channels</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this playlist?')) removePlaylist(playlist.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    style={{ position: 'relative', float: 'right', marginTop: '-28px', marginRight: '8px' }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Now playing */}
        <AnimatePresence>
          {currentChannel && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="px-3 py-3 border-t border-zinc-800 bg-zinc-900/50"
            >
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Play className="w-2.5 h-2.5" />
                Now Playing
              </p>
              <p className="text-xs text-white font-medium truncate">{currentChannel.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{currentChannel.group}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}

function ContentTypeFilter() {
  const { viewMode, contentType, setContentType, setViewMode } = useIPTVStore();

  const types: { id: ContentType; label: string; icon: React.ReactNode }[] = [
    { id: 'live', label: 'Live', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'vod', label: 'VOD', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'series', label: 'Series', icon: <ListVideo className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-1 px-1">
      {types.map(t => (
        <motion.button
          key={t.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setContentType(t.id);
            if (viewMode !== 'channels') setViewMode('channels');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium transition-all duration-200 ${
            contentType === t.id
              ? 'bg-white text-black'
              : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/30'
          }`}
        >
          {t.icon}
          {t.label}
        </motion.button>
      ))}
    </div>
  );
}
