import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PlaylistType = 'xtream' | 'm3u';
export type ChannelType = 'live' | 'vod' | 'series';
export type PlayerType = 'hlsjs' | 'videojs' | 'html5';
export type ViewMode = 'playlists' | 'channels' | 'favorites' | 'epg' | 'player';
export type ContentType = 'live' | 'vod' | 'series';

export interface Playlist {
  id: string;
  name: string;
  type: PlaylistType;
  m3uUrl?: string;
  xtreamUrl?: string;
  xtreamUser?: string;
  xtreamPass?: string;
  channelCount: number;
  lastSynced?: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  group: string;
  type: ChannelType;
  number: number;
  epgId: string;
  playlistId: string;
}

export interface FavoriteChannel {
  id: string;
  channelId: string;
  channel: Channel;
  playlistId: string;
  createdAt: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface CategoryWithCount {
  name: string;
  count: number;
}

export interface EpgEntry {
  id: string;
  start: string;
  end: string;
  title: string;
  description: string;
  channelId: string;
}

interface IPTVState {
  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Playlists
  playlists: Playlist[];
  setPlaylists: (playlists: Playlist[]) => void;
  addPlaylist: (playlist: Playlist) => void;
  removePlaylist: (id: string) => void;
  
  // Channels
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  filteredChannels: Channel[];
  setFilteredChannels: (channels: Channel[]) => void;
  
  // Categories
  categories: CategoryWithCount[];
  setCategories: (categories: CategoryWithCount[]) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  
  // Content type filter
  contentType: ContentType;
  setContentType: (type: ContentType) => void;
  
  // Current playlist
  selectedPlaylistId: string | null;
  setSelectedPlaylistId: (id: string | null) => void;
  
  // Current channel
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;
  
  // Favorites
  favorites: FavoriteChannel[];
  setFavorites: (favorites: FavoriteChannel[]) => void;
  toggleFavorite: (channel: Channel, playlistId: string) => void;
  isFavorite: (channelId: string) => boolean;
  
  // Player
  playerType: PlayerType;
  setPlayerType: (type: PlayerType) => void;
  isPlayerFullscreen: boolean;
  setPlayerFullscreen: (fs: boolean) => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (msg: string) => void;
  
  // EPG
  epgEntries: EpgEntry[];
  setEpgEntries: (entries: EpgEntry[]) => void;
  
  // Series
  selectedSeries: Channel | null;
  setSelectedSeries: (channel: Channel | null) => void;

  // Toast
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

export const useIPTVStore = create<IPTVState>()(
  persist(
    (set, get) => ({
      // View
      viewMode: 'playlists',
      setViewMode: (mode) => set({ viewMode: mode }),
      
      // Playlists
      playlists: [],
      setPlaylists: (playlists) => set({ playlists }),
      addPlaylist: (playlist) => set((s) => ({ playlists: [...s.playlists, playlist] })),
      removePlaylist: (id) => set((s) => ({ 
        playlists: s.playlists.filter(p => p.id !== id),
        channels: s.channels.filter(c => c.playlistId !== id),
      })),
      
      // Channels
      channels: [],
      setChannels: (channels) => set({ channels, filteredChannels: channels }),
      filteredChannels: [],
      setFilteredChannels: (channels) => set({ filteredChannels: channels }),
      
      // Categories
      categories: [],
      setCategories: (categories) => set({ categories: categories as CategoryWithCount[] }),
      selectedCategory: null,
      setSelectedCategory: (cat) => set({ selectedCategory: cat }),
      
      // Content type
      contentType: 'live',
      setContentType: (type) => set({ contentType: type }),
      
      // Selected playlist
      selectedPlaylistId: null,
      setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id }),
      
      // Current channel
      currentChannel: null,
      setCurrentChannel: (channel) => set({ currentChannel: channel }),
      
      // Favorites
      favorites: [],
      setFavorites: (favorites) => set({ favorites }),
      toggleFavorite: (channel, playlistId) => {
        const state = get();
        const existing = state.favorites.find(f => f.channelId === channel.id);
        if (existing) {
          set({ favorites: state.favorites.filter(f => f.channelId !== channel.id) });
        } else {
          const fav: FavoriteChannel = {
            id: `fav-${Date.now()}`,
            channelId: channel.id,
            channel,
            playlistId,
            createdAt: new Date().toISOString(),
          };
          set({ favorites: [...state.favorites, fav] });
        }
      },
      isFavorite: (channelId) => get().favorites.some(f => f.channelId === channelId),
      
      // Player
      playerType: 'hlsjs',
      setPlayerType: (type) => set({ playerType: type }),
      isPlayerFullscreen: false,
      setPlayerFullscreen: (fs) => set({ isPlayerFullscreen: fs }),
      
      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      // Loading
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
      loadingMessage: '',
      setLoadingMessage: (msg) => set({ loadingMessage: msg }),
      
      // EPG
      epgEntries: [],
      setEpgEntries: (entries) => set({ epgEntries: entries }),

      // Series
      selectedSeries: null,
      setSelectedSeries: (channel) => set({ selectedSeries: channel }),
      
      // Toast
      toastMessage: null,
      toastType: 'info',
      showToast: (message, type = 'info') => {
        set({ toastMessage: message, toastType: type });
        setTimeout(() => set({ toastMessage: null }), 3000);
      },
      hideToast: () => set({ toastMessage: null }),
    }),
    {
      name: 'iptv-store',
      partialize: (state) => ({
        playlists: state.playlists,
        favorites: state.favorites,
        playerType: state.playerType,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
