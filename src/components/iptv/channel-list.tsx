'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Play, Heart, Radio, Film, ListVideo,
  Tv, Loader2, Hash, RadioTower, Clapperboard
} from 'lucide-react';
import { useIPTVStore, type Channel, type ContentType, type CategoryWithCount } from '@/store/iptv-store';

// ─── Shared Category Sidebar ───────────────────────────────────

interface CategorySidebarProps {
  categories: CategoryWithCount[];
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  allLabel: string;
  allIcon: React.ReactNode;
  headerLabel: string;
  total: number;
}

function CategorySidebar({
  categories, selectedCategory, onSelectCategory,
  allLabel, allIcon, headerLabel, total,
}: CategorySidebarProps) {
  return (
    <div className="w-[220px] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <Hash className="w-3 h-3" />
          {headerLabel}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{categories.length}</span>
      </div>

      {/* All button */}
      <div className="px-1.5 py-1.5">
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectCategory(null)}
          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-all duration-200 ${
            !selectedCategory
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <span className="flex items-center gap-2">
            {allIcon}
            {allLabel}
          </span>
          <span className="text-[10px] font-mono opacity-60">{total}</span>
        </motion.button>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 custom-scrollbar">
        <AnimatePresence>
          {categories.map((cat, index) => (
            <motion.button
              key={cat.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ delay: Math.min(index * 0.015, 0.3) }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectCategory(selectedCategory === cat.name ? null : cat.name)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left transition-all duration-200 mb-0.5 ${
                selectedCategory === cat.name
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="truncate text-xs pr-2">{cat.name}</span>
              <span className={`text-[10px] font-mono flex-shrink-0 ${
                selectedCategory === cat.name ? 'text-black/50' : 'text-zinc-600'
              }`}>
                {cat.count}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Main Channel List ─────────────────────────────────────────

export function ChannelList() {
  const {
    selectedPlaylistId, contentType,
    channels, setChannels, filteredChannels, setFilteredChannels,
    searchQuery, setSearchQuery, setCurrentChannel,
    setViewMode, isFavorite, toggleFavorite,
    categories, setCategories, selectedCategory, setSelectedCategory,
  } = useIPTVStore();

  const [isFetching, setIsFetching] = useState(false);
  const [catSidebarOpen, setCatSidebarOpen] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const LIMIT = 500;

  // Fetch channels when playlist/type changes
  useEffect(() => {
    if (!selectedPlaylistId) return;

    const fetchChannels = async () => {
      setIsFetching(true);
      try {
        const params = new URLSearchParams({
          playlistId: selectedPlaylistId,
          type: contentType,
          limit: String(LIMIT),
        });
        if (selectedCategory && selectedCategory !== 'all') {
          params.set('category', selectedCategory);
        }
        if (searchQuery) {
          params.set('search', searchQuery);
        }

        const res = await fetch(`/api/channels?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');

        setChannels(data.channels);
        setFilteredChannels(data.channels);
        setCategories(data.categories || []);
        setImageErrors(new Set());
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchChannels();
  }, [selectedPlaylistId, contentType, selectedCategory, searchQuery, setChannels, setFilteredChannels, setCategories]);

  // Filter channels locally based on search
  const displayChannels = useMemo(() => {
    if (!searchQuery) return filteredChannels;
    const q = searchQuery.toLowerCase();
    return filteredChannels.filter(c =>
      c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
  }, [filteredChannels, searchQuery]);

  const handlePlay = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
    setViewMode('player');
  }, [setCurrentChannel, setViewMode]);

  const totalChannels = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.count, 0);
  }, [categories]);

  const handleImageError = useCallback((src: string) => {
    setImageErrors(prev => new Set(prev).add(src));
  }, []);

  if (!selectedPlaylistId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-center p-8"
      >
        <Tv className="w-16 h-16 text-zinc-800 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Playlist Selected</h3>
        <p className="text-sm text-zinc-600">Select a playlist from the sidebar or add a new one</p>
      </motion.div>
    );
  }

  // ChannelList should not render for 'series' — that's handled by SeriesBrowser
  if (contentType === 'series') return null;

  const isCardView = contentType === 'vod';

  // Config per content type
  const sidebarConfig: Record<string, { allLabel: string; allIcon: React.ReactNode; headerLabel: string }> = {
    live: {
      allLabel: 'All Channels',
      allIcon: <RadioTower className="w-3 h-3" />,
      headerLabel: 'Categories',
    },
    vod: {
      allLabel: 'All Movies',
      allIcon: <Film className="w-3 h-3" />,
      headerLabel: 'Genres',
    },
  };

  const config = sidebarConfig[contentType];

  return (
    <div className="flex h-full">
      {/* Category sidebar */}
      <AnimatePresence>
        {catSidebarOpen && categories.length > 0 && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex-shrink-0 border-r border-zinc-800 overflow-hidden"
          >
            <CategorySidebar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              allLabel={config.allLabel}
              allIcon={config.allIcon}
              headerLabel={config.headerLabel}
              total={totalChannels}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + toggle bar */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {categories.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCatSidebarOpen(!catSidebarOpen)}
                className={`flex-shrink-0 p-2 transition-colors ${
                  catSidebarOpen ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Hash className="w-4 h-4" />
              </motion.button>
            )}

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedCategory ? `Search in "${selectedCategory}"...` : 'Search...'}
                className="w-full bg-zinc-800 border border-zinc-700 text-white pl-9 pr-8 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="text-xs text-zinc-500 font-mono flex-shrink-0">
              {displayChannels.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isFetching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          ) : displayChannels.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center px-8"
            >
              {searchQuery ? (
                <>
                  <Search className="w-12 h-12 text-zinc-800 mb-3" />
                  <p className="text-sm text-zinc-500">No results for &ldquo;{searchQuery}&rdquo;</p>
                </>
              ) : (
                <>
                  {isCardView ? <Clapperboard className="w-12 h-12 text-zinc-800 mb-3" /> : <Tv className="w-12 h-12 text-zinc-800 mb-3" />}
                  <p className="text-sm text-zinc-500">No content in this category</p>
                </>
              )}
            </motion.div>
          ) : isCardView ? (
            /* ── VOD Card Grid ── */
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <AnimatePresence>
                  {displayChannels.map((channel, index) => (
                    <MovieCard
                      key={`${channel.id}-${channel.url}`}
                      channel={channel}
                      index={index}
                      hasImageError={imageErrors.has(channel.logo)}
                      isFav={isFavorite(channel.id)}
                      onPlay={handlePlay}
                      onToggleFav={() => toggleFavorite(channel, selectedPlaylistId!)}
                      onImageError={() => handleImageError(channel.logo)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* ── LIVE Channel List ── */
            <div className="divide-y divide-zinc-800/50">
              <AnimatePresence>
                {displayChannels.map((channel, index) => (
                  <ChannelItem
                    key={`${channel.id}-${channel.url}`}
                    channel={channel}
                    index={index}
                    isFav={isFavorite(channel.id)}
                    onPlay={handlePlay}
                    onToggleFav={() => toggleFavorite(channel, selectedPlaylistId!)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Movie Card (VOD grid) ─────────────────────────────────────

interface MovieCardProps {
  channel: Channel;
  index: number;
  hasImageError: boolean;
  isFav: boolean;
  onPlay: (channel: Channel) => void;
  onToggleFav: () => void;
  onImageError: () => void;
}

function MovieCard({ channel, index, hasImageError, isFav, onPlay, onToggleFav, onImageError }: MovieCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: Math.min(index * 0.03, 0.6), duration: 0.3 }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onPlay(channel)}
      className="group cursor-pointer relative"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-800 overflow-hidden mb-2">
        {!hasImageError && channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-cover"
            onError={onImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        {/* Hover overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2"
        >
          {isFav && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
              className="w-9 h-9 bg-zinc-900/80 flex items-center justify-center"
            >
              <Heart className="w-4 h-4 text-red-400 fill-current" />
            </motion.div>
          )}
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 bg-white flex items-center justify-center"
          >
            <Play className="w-5 h-5 text-black fill-current ml-0.5" />
          </motion.div>
        </motion.div>

        {/* Favorite badge */}
        {isFav && (
          <div className="absolute top-1.5 left-1.5">
            <Heart className="w-3.5 h-3.5 text-red-400 fill-current drop-shadow-lg" />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors truncate">
        {channel.name}
      </h3>
      {channel.group && (
        <p className="text-[10px] text-zinc-600 truncate mt-0.5">{channel.group}</p>
      )}
    </motion.div>
  );
}

// ─── Channel Item (LIVE list) ──────────────────────────────────

interface ChannelItemProps {
  channel: Channel;
  index: number;
  isFav: boolean;
  onPlay: (channel: Channel) => void;
  onToggleFav: () => void;
}

function ChannelItem({ channel, index, isFav, onPlay, onToggleFav }: ChannelItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: Math.min(index * 0.02, 0.5) }}
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors cursor-pointer"
      onClick={() => onPlay(channel)}
    >
      <span className="text-[10px] text-zinc-600 font-mono w-6 text-right flex-shrink-0">
        {channel.number}
      </span>

      <div className="w-8 h-8 bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs text-zinc-600">${channel.name.charAt(0).toUpperCase()}</span>`;
            }}
          />
        ) : (
          <span className="text-xs text-zinc-600">{channel.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 font-medium truncate group-hover:text-white transition-colors">
          {channel.name}
        </p>
        <p className="text-[11px] text-zinc-600 truncate">{channel.group}</p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          className={`p-1.5 transition-colors ${isFav ? 'text-red-400' : 'text-zinc-500 hover:text-red-400'}`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); onPlay(channel); }}
          className="p-1.5 bg-white text-black"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </motion.button>
      </div>
    </motion.div>
  );
}
