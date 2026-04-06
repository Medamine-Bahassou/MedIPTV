'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Play, Trash2, Tv, Radio, Film, ListVideo } from 'lucide-react';
import { useIPTVStore, type Channel } from '@/store/iptv-store';

export function FavoritesView() {
  const {
    favorites, setFavorites, setCurrentChannel, setViewMode,
    toggleFavorite, selectedPlaylistId, setSelectedPlaylistId,
  } = useIPTVStore();

  const handlePlay = useCallback((channel: Channel, playlistId: string) => {
    setCurrentChannel(channel);
    setSelectedPlaylistId(playlistId);
    setViewMode('player');
  }, [setCurrentChannel, setViewMode, setSelectedPlaylistId]);

  const handleRemove = useCallback((channelId: string, playlistId: string) => {
    const fav = favorites.find(f => f.channelId === channelId);
    if (fav?.channel) {
      toggleFavorite(fav.channel, playlistId);
    }
  }, [toggleFavorite, favorites]);

  if (favorites.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-full text-center p-8"
      >
        <Heart className="w-16 h-16 text-zinc-800 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Favorites Yet</h3>
        <p className="text-sm text-zinc-600">Click the heart icon on any channel to add it here</p>
      </motion.div>
    );
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'live': return <Radio className="w-3 h-3 text-green-400" />;
      case 'vod': return <Film className="w-3 h-3 text-purple-400" />;
      case 'series': return <ListVideo className="w-3 h-3 text-blue-400" />;
      default: return <Tv className="w-3 h-3 text-zinc-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-4 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400 fill-current" />
          Favorites
        </h2>
        <p className="text-xs text-zinc-500 mt-1">{favorites.length} saved channels</p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
        <AnimatePresence>
          {favorites.map((fav, index) => (
            <motion.div
              key={fav.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ delay: index * 0.03 }}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
              onClick={() => handlePlay(fav.channel, fav.playlistId)}
            >
              {/* Logo */}
              <div className="w-10 h-10 bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {fav.channel.logo ? (
                  <img src={fav.channel.logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-zinc-600">{fav.channel.name.charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 font-medium truncate group-hover:text-white transition-colors">
                  {fav.channel.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {typeIcon(fav.channel.type)}
                  <span className="text-[10px] text-zinc-600 truncate">{fav.channel.group}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleRemove(fav.channelId, fav.playlistId); }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handlePlay(fav.channel, fav.playlistId); }}
                  className="p-1.5 bg-white text-black"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}


