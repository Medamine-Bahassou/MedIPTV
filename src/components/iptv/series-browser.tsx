'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Play, ArrowLeft, ChevronDown, ChevronRight,
  Star, Calendar, Film, Clock, Users, Loader2, Tv,
  ListVideo, Clapperboard, Tag, Tv2, Hash, RadioTower,
} from 'lucide-react';
import { useIPTVStore, type Channel, type CategoryWithCount } from '@/store/iptv-store';
import type { XtreamSeriesInfo, XtreamSeasonInfo, XtreamEpisodeItem } from '@/lib/xtream-client';

interface SeriesChannel {
  id: string;
  name: string;
  logo: string;
  url: string;
  group: string;
  seriesId: string;
}

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

// ─── Main Series Browser ───────────────────────────────────────

export function SeriesBrowser() {
  const {
    selectedPlaylistId,
    playlists,
    selectedSeries, setSelectedSeries,
    setCurrentChannel, setViewMode,
    searchQuery, setSearchQuery,
    categories, setCategories,
    selectedCategory, setSelectedCategory,
  } = useIPTVStore();

  const [series, setSeries] = useState<SeriesChannel[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesInfo | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [localSearch, setLocalSearch] = useState('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [catSidebarOpen, setCatSidebarOpen] = useState(true);

  const playlist = useMemo(
    () => playlists.find(p => p.id === selectedPlaylistId),
    [playlists, selectedPlaylistId]
  );

  // Fetch series channels from DB
  useEffect(() => {
    if (!selectedPlaylistId) return;

    const fetchSeries = async () => {
      setIsFetching(true);
      try {
        const params = new URLSearchParams({
          playlistId: selectedPlaylistId,
          type: 'series',
          limit: '500',
        });
        if (selectedCategory && selectedCategory !== 'all') {
          params.set('category', selectedCategory);
        }
        if (localSearch) {
          params.set('search', localSearch);
        }

        const res = await fetch(`/api/channels?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');

        const mapped: SeriesChannel[] = (data.channels || []).map((ch: Channel) => ({
          id: ch.id,
          name: ch.name,
          logo: ch.logo || '',
          url: ch.url,
          group: ch.group || '',
          seriesId: extractSeriesId(ch.url),
        }));

        setSeries(mapped);
        setCategories(data.categories || []);
        setImageErrors(new Set());
      } catch (err) {
        console.error('Fetch series error:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchSeries();
  }, [selectedPlaylistId, selectedCategory, localSearch, setCategories]);

  // Auto-open series detail if selectedSeries is set
  useEffect(() => {
    if (selectedSeries && !seriesInfo) {
      const sid = extractSeriesId(selectedSeries.url);
      if (sid) {
        fetchSeriesDetail(sid);
      }
    }
  }, [selectedSeries]);

  const extractSeriesId = (url: string): string => {
    try {
      const parts = url.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch {
      return '';
    }
  };

  const fetchSeriesDetail = useCallback(async (seriesId: string) => {
    if (!playlist) return;
    setIsDetailLoading(true);
    try {
      const res = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_series_info',
          xtreamUrl: playlist.xtreamUrl,
          username: playlist.xtreamUser,
          password: playlist.xtreamPass,
          seriesId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch series info');

      setSeriesInfo(data);
      if (data.seasons && data.seasons.length > 0) {
        setExpandedSeasons(new Set([data.seasons[0].season_number]));
      }
    } catch (err) {
      console.error('Series info error:', err);
    } finally {
      setIsDetailLoading(false);
    }
  }, [playlist]);

  const handleSeriesClick = useCallback((item: SeriesChannel) => {
    setSelectedSeries({
      id: item.id,
      name: item.name,
      logo: item.logo,
      url: item.url,
      group: item.group,
      type: 'series',
      number: 0,
      epgId: '',
      playlistId: selectedPlaylistId || '',
    });
    setSeriesInfo(null);
    setExpandedSeasons(new Set());
    fetchSeriesDetail(item.seriesId);
  }, [selectedPlaylistId, setSelectedSeries, fetchSeriesDetail]);

  const handleBack = useCallback(() => {
    setSeriesInfo(null);
    setExpandedSeasons(new Set());
    setSelectedSeries(null);
  }, [setSelectedSeries]);

  const toggleSeason = useCallback((seasonNum: number) => {
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      if (next.has(seasonNum)) {
        next.delete(seasonNum);
      } else {
        next.add(seasonNum);
      }
      return next;
    });
  }, []);

  const handlePlayEpisode = useCallback((episode: XtreamEpisodeItem) => {
    if (!playlist) return;

    const ext = episode.container_extension || 'mp4';
    const episodeUrl = `${playlist.xtreamUrl}/series/${playlist.xtreamUser}/${playlist.xtreamPass}/${episode.id}.${ext}`;

    setCurrentChannel({
      id: `ep-${episode.id}`,
      name: episode.title || `Episode ${episode.episode_num}`,
      logo: seriesInfo?.info?.cover || '',
      url: episodeUrl,
      group: seriesInfo?.info?.name || 'Series',
      type: 'vod',
      number: episode.episode_num || 0,
      epgId: '',
      playlistId: selectedPlaylistId || '',
    });
    setViewMode('player');
  }, [playlist, seriesInfo, selectedPlaylistId, setCurrentChannel, setViewMode]);

  const handleImageError = useCallback((src: string) => {
    setImageErrors(prev => new Set(prev).add(src));
  }, []);

  // Filter locally
  const displaySeries = useMemo(() => {
    if (!localSearch) return series;
    const q = localSearch.toLowerCase();
    return series.filter(s =>
      s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)
    );
  }, [series, localSearch]);

  const totalSeries = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.count, 0);
  }, [categories]);

  if (!selectedPlaylistId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-center p-8"
      >
        <Tv2 className="w-16 h-16 text-zinc-800 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Playlist Selected</h3>
        <p className="text-sm text-zinc-600">Select a playlist from the sidebar to browse series</p>
      </motion.div>
    );
  }

  // ─── Series Detail View ─────────────────────────────────────
  if (seriesInfo) {
    return (
      <SeriesDetailView
        seriesInfo={seriesInfo}
        seriesChannel={selectedSeries}
        expandedSeasons={expandedSeasons}
        isLoading={isDetailLoading}
        imageErrors={imageErrors}
        onBack={handleBack}
        onToggleSeason={toggleSeason}
        onPlayEpisode={handlePlayEpisode}
        onImageError={handleImageError}
      />
    );
  }

  // ─── Series Grid View with Category Sidebar ─────────────────
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
              allLabel="All Series"
              allIcon={<ListVideo className="w-3 h-3" />}
              headerLabel="Genres"
              total={totalSeries}
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
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={selectedCategory ? `Search in "${selectedCategory}"...` : 'Search series...'}
                className="w-full bg-zinc-800 border border-zinc-700 text-white pl-9 pr-8 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="text-xs text-zinc-500 font-mono flex-shrink-0">
              {displaySeries.length}
            </span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {isFetching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          ) : displaySeries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center px-8"
            >
              {localSearch ? (
                <>
                  <Search className="w-12 h-12 text-zinc-800 mb-3" />
                  <p className="text-sm text-zinc-500">No series found for &ldquo;{localSearch}&rdquo;</p>
                </>
              ) : (
                <>
                  <Clapperboard className="w-12 h-12 text-zinc-800 mb-3" />
                  <p className="text-sm text-zinc-500">No series available</p>
                </>
              )}
            </motion.div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <AnimatePresence>
                  {displaySeries.map((item, index) => (
                    <SeriesCard
                      key={item.id}
                      item={item}
                      index={index}
                      hasImageError={imageErrors.has(item.logo)}
                      onClick={() => handleSeriesClick(item)}
                      onImageError={() => handleImageError(item.logo)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Series Card ──────────────────────────────────────────────

interface SeriesCardProps {
  item: SeriesChannel;
  index: number;
  hasImageError: boolean;
  onClick: () => void;
  onImageError: () => void;
}

function SeriesCard({ item, index, hasImageError, onClick, onImageError }: SeriesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: Math.min(index * 0.03, 0.6), duration: 0.3 }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-800 overflow-hidden mb-2">
        {!hasImageError && item.logo ? (
          <img
            src={item.logo}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={onImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clapperboard className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        {/* Hover overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 flex items-center justify-center"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 bg-white flex items-center justify-center"
          >
            <Play className="w-5 h-5 text-black fill-current ml-0.5" />
          </motion.div>
        </motion.div>
      </div>

      {/* Title */}
      <h3 className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors truncate">
        {item.name}
      </h3>
      {item.group && (
        <p className="text-[10px] text-zinc-600 truncate mt-0.5">{item.group}</p>
      )}
    </motion.div>
  );
}

// ─── Series Detail View ───────────────────────────────────────

interface SeriesDetailViewProps {
  seriesInfo: XtreamSeriesInfo;
  seriesChannel: Channel | null;
  expandedSeasons: Set<number>;
  isLoading: boolean;
  imageErrors: Set<string>;
  onBack: () => void;
  onToggleSeason: (seasonNum: number) => void;
  onPlayEpisode: (episode: XtreamEpisodeItem) => void;
  onImageError: (src: string) => void;
}

function SeriesDetailView({
  seriesInfo, seriesChannel, expandedSeasons, isLoading,
  imageErrors, onBack, onToggleSeason, onPlayEpisode, onImageError,
}: SeriesDetailViewProps) {
  const { info, seasons, episodes } = seriesInfo;
  const coverUrl = info?.cover || seriesChannel?.logo || '';
  const hasCoverError = coverUrl ? imageErrors.has(coverUrl) : true;

  const totalEpisodes = useMemo(() => {
    return Object.values(episodes).reduce((sum, eps) => sum + eps.length, 0);
  }, [episodes]);

  const castList = info?.cast ? info.cast.split(',').map(s => s.trim()).filter(Boolean) : [];
  const directorList = info?.director ? info.director.split(',').map(s => s.trim()).filter(Boolean) : [];
  const genreList = info?.genre ? info.genre.split(',').map(s => s.trim()).filter(Boolean) : [];

  const rating = info?.rating ? parseFloat(info.rating) : 0;
  const rating5 = info?.rating_5based || (rating / 2);

  const sortedSeasons = useMemo(() => {
    if (!seasons) return [];
    return [...seasons].sort((a, b) => a.season_number - b.season_number);
  }, [seasons]);

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Back button */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800 px-4 py-2"
          >
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Series
            </button>
          </motion.div>

          {/* Hero section */}
          <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6">
            {/* Cover */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex-shrink-0 w-full md:w-56 lg:w-64"
            >
              <div className="aspect-[2/3] bg-zinc-800 overflow-hidden">
                {!hasCoverError && coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={info?.name || 'Series cover'}
                    className="w-full h-full object-cover"
                    onError={() => onImageError(coverUrl)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Clapperboard className="w-16 h-16 text-zinc-700" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex-1 min-w-0"
            >
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
                {info?.name || seriesChannel?.name || 'Unknown Series'}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                {rating5 > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm text-zinc-300 font-medium">{rating5.toFixed(1)}</span>
                  </div>
                )}
                {info?.releaseDate && (
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs">{info.releaseDate.split('-')[0]}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Film className="w-3.5 h-3.5" />
                  <span className="text-xs">{sortedSeasons.length} season{sortedSeasons.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <ListVideo className="w-3.5 h-3.5" />
                  <span className="text-xs">{totalEpisodes} episode{totalEpisodes !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {genreList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {genreList.map(g => (
                    <span
                      key={g}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 text-zinc-300 text-[11px] font-medium"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {info?.plot && (
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                  {info.plot}
                </p>
              )}

              {castList.length > 0 && (
                <div className="flex items-start gap-2 mb-2">
                  <Users className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Cast</span>
                    <p className="text-xs text-zinc-400">{castList.join(', ')}</p>
                  </div>
                </div>
              )}

              {directorList.length > 0 && (
                <div className="flex items-start gap-2">
                  <Clapperboard className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Director</span>
                    <p className="text-xs text-zinc-400">{directorList.join(', ')}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Seasons */}
          <div className="px-4 md:px-6 pb-6">
            <div className="border-t border-zinc-800 pt-4">
              <h2 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">
                Seasons &amp; Episodes
              </h2>

              <div className="space-y-2">
                <AnimatePresence>
                  {sortedSeasons.map((season) => (
                    <SeasonBlock
                      key={season.season_number}
                      season={season}
                      episodes={episodes[String(season.season_number)] || []}
                      isExpanded={expandedSeasons.has(season.season_number)}
                      onToggle={() => onToggleSeason(season.season_number)}
                      onPlayEpisode={onPlayEpisode}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Season Block ─────────────────────────────────────────────

interface SeasonBlockProps {
  season: XtreamSeasonInfo;
  episodes: XtreamEpisodeItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onPlayEpisode: (episode: XtreamEpisodeItem) => void;
}

function SeasonBlock({ season, episodes, isExpanded, onToggle, onPlayEpisode }: SeasonBlockProps) {
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => a.episode_num - b.episode_num);
  }, [episodes]);

  return (
    <div className="border border-zinc-800 overflow-hidden">
      <motion.button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
        whileTap={{ scale: 0.995 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </motion.div>
          <span className="text-sm font-bold text-white">
            Season {season.season_number}
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
          </span>
        </div>
        {season.air_date && (
          <span className="text-[11px] text-zinc-600 hidden sm:block">{season.air_date.split('T')[0]}</span>
        )}
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800/50 custom-scrollbar">
              {sortedEpisodes.map((episode) => (
                <EpisodeItem
                  key={episode.id}
                  episode={episode}
                  onPlay={() => onPlayEpisode(episode)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Episode Item ─────────────────────────────────────────────

interface EpisodeItemProps {
  episode: XtreamEpisodeItem;
  onPlay: () => void;
}

function EpisodeItem({ episode, onPlay }: EpisodeItemProps) {
  const duration = episode.info?.duration || '';
  const title = episode.title || `Episode ${episode.episode_num}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
    >
      <span className="text-xs text-zinc-600 font-mono w-8 text-right flex-shrink-0">
        E{String(episode.episode_num).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 font-medium truncate group-hover:text-white transition-colors">
          {title}
        </p>
        {duration && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-zinc-600" />
            <span className="text-[11px] text-zinc-500">{duration}</span>
          </div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        className="p-2 bg-zinc-800 text-zinc-400 hover:bg-white hover:text-black transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100"
      >
        <Play className="w-4 h-4 fill-current ml-0.5" />
      </motion.button>
    </motion.div>
  );
}
