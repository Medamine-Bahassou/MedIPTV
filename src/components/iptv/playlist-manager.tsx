'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Link, FileText, Upload, Zap, Radio, 
  Loader2, Check, AlertCircle, ChevronDown, X, ArrowLeft
} from 'lucide-react';
import { useIPTVStore, type PlaylistType } from '@/store/iptv-store';

interface PlaylistManagerProps {
  onPlaylistAdded?: () => void;
}

type InputMethod = 'xtream' | 'url' | 'file' | 'text';

export function PlaylistManager({ onPlaylistAdded }: PlaylistManagerProps) {
  const { addPlaylist, showToast, setLoading, setLoadingMessage, isLoading, loadingMessage, playlists, setSelectedPlaylistId, setChannels, setCategories } = useIPTVStore();
  const [inputMethod, setInputMethod] = useState<InputMethod>('xtream');
  const [name, setName] = useState('');
  const [xtreamUrl, setXtreamUrl] = useState('http://servx.pro:80');
  const [xtreamUser, setXtreamUser] = useState('iptvx86');
  const [xtreamPass, setXtreamPass] = useState('bayoumi@214');
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uText, setM3uText] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [expandedMethod, setExpandedMethod] = useState<InputMethod | null>('xtream');
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  const methods: { id: InputMethod; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'xtream', label: 'Xtream Codes', icon: <Zap className="w-4 h-4" />, desc: 'Connect via Xtream API' },
    { id: 'url', label: 'M3U URL', icon: <Link className="w-4 h-4" />, desc: 'Paste M3U playlist URL' },
    { id: 'file', label: 'M3U File', icon: <Upload className="w-4 h-4" />, desc: 'Upload .m3u file' },
    { id: 'text', label: 'M3U Text', icon: <FileText className="w-4 h-4" />, desc: 'Paste M3U content' },
  ];

  const handleSubmitXtream = async () => {
    if (!xtreamUrl || !xtreamUser || !xtreamPass) {
      showToast('Please fill in all Xtream fields', 'error');
      return;
    }

    const playlistName = name || `Xtream - ${xtreamUser}`;
    setLoading(true);
    setLoadingMessage('Authenticating with Xtream server...');

    try {
      // Step 1: Authenticate
      const authRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const authData = await authRes.json();

      if (!authRes.ok || authData.error) {
        throw new Error(authData.error || 'Authentication failed');
      }

      const userInfo = authData.user_info;
      showToast(`Connected! Status: ${userInfo.status || 'Active'}`, 'success');

      // Step 2: Create playlist in DB
      const plRes = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          type: 'xtream',
          xtreamUrl,
          xtreamUser,
          xtreamPass,
        }),
      });
      const playlist = await plRes.json();
      if (!plRes.ok) throw new Error('Failed to create playlist');

      addPlaylist({
        id: playlist.id,
        name: playlist.name,
        type: 'xtream',
        xtreamUrl,
        xtreamUser,
        xtreamPass,
        channelCount: 0,
        createdAt: playlist.createdAt,
      });

      // Step 3: Fetch categories and streams
      setLoadingMessage('Fetching live categories...');
      const liveCatsRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_live_categories', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const liveCategories = await liveCatsRes.json();

      setLoadingMessage('Fetching live streams...');
      const liveStreamsRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_live_streams', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const liveStreams = await liveStreamsRes.json();

      // Fetch VOD categories and streams
      setLoadingMessage('Fetching VOD categories...');
      const vodCatsRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_vod_categories', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const vodCategories = await vodCatsRes.json();

      setLoadingMessage('Fetching VOD streams...');
      const vodStreamsRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_vod_streams', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const vodStreams = await vodStreamsRes.json();

      // Fetch Series categories and series
      setLoadingMessage('Fetching series...');
      const seriesCatsRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_series_categories', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const seriesCategories = await seriesCatsRes.json();

      const seriesListRes = await fetch('/api/xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_series_list', xtreamUrl, username: xtreamUser, password: xtreamPass }),
      });
      const seriesList = await seriesListRes.json();

      // Build categories map
      const catMap = new Map<string, string>();
      [...(liveCategories || []), ...(vodCategories || []), ...(seriesCategories || [])].forEach((c: { category_id: string; category_name: string }) => {
        catMap.set(c.category_id, c.category_name);
      });

      // Convert to channel format
      const allChannels: Record<string, unknown>[] = [];

      // Live streams
      (liveStreams || []).forEach((s: Record<string, unknown>, i: number) => {
        allChannels.push({
          name: String(s.name || ''),
          url: `${xtreamUrl}/live/${xtreamUser}/${xtreamPass}/${s.stream_id}.m3u8`,
          logo: String(s.stream_icon || ''),
          group: catMap.get(String(s.category_id)) || 'Uncategorized',
          type: 'live',
          number: Number(s.num) || i + 1,
          epgId: String(s.epg_channel_id || ''),
        });
      });

      // VOD streams
      (vodStreams || []).forEach((s: Record<string, unknown>, i: number) => {
        allChannels.push({
          name: String(s.name || ''),
          url: `${xtreamUrl}/movie/${xtreamUser}/${xtreamPass}/${s.stream_id}.${String(s.container_extension || 'mp4')}`,
          logo: String(s.stream_icon || ''),
          group: catMap.get(String(s.category_id)) || 'Uncategorized',
          type: 'vod',
          number: Number(s.num) || allChannels.length + 1,
          epgId: '',
        });
      });

      // Series
      (seriesList || []).forEach((s: Record<string, unknown>, i: number) => {
        allChannels.push({
          name: String(s.name || ''),
          url: `${xtreamUrl}/series/${xtreamUser}/${xtreamPass}/${s.series_id}`,
          logo: String(s.cover || ''),
          group: catMap.get(String(s.category_id)) || 'Uncategorized',
          type: 'series',
          number: Number(s.num) || allChannels.length + 1,
          epgId: '',
        });
      });

      setLoadingMessage(`Syncing ${allChannels.length} channels...`);

      // Sync channels to DB
      const syncRes = await fetch('/api/channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: playlist.id, channels: allChannels }),
      });
      const syncData = await syncRes.json();
      if (!syncRes.ok) throw new Error(syncData.error || 'Sync failed');

      setLastResult({ success: true, message: 'Playlist synced successfully!', count: allChannels.length });
      showToast(`Added ${allChannels.length} channels from Xtream`, 'success');
      onPlaylistAdded?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLastResult({ success: false, message });
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSubmitM3U = async (content: string, url?: string) => {
    if (!content && !url) {
      showToast('Please provide M3U content or URL', 'error');
      return;
    }

    const playlistName = name || (url ? `M3U - ${new URL(url).hostname}` : 'M3U Playlist');
    setLoading(true);
    setLoadingMessage('Parsing M3U playlist...');

    try {
      // Create playlist
      const plRes = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistName, type: 'm3u', m3uUrl: url || '' }),
      });
      const playlist = await plRes.json();
      if (!plRes.ok) throw new Error('Failed to create playlist');

      addPlaylist({
        id: playlist.id,
        name: playlist.name,
        type: 'm3u',
        m3uUrl: url,
        channelCount: 0,
        createdAt: playlist.createdAt,
      });

      // Parse M3U
      const parseRes = await fetch('/api/m3u-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content || undefined, url: url || undefined }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Parse failed');

      const { channels, total } = parseData;
      setLoadingMessage(`Syncing ${total} channels...`);

      // Sync channels
      const syncRes = await fetch('/api/channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: playlist.id, channels }),
      });
      const syncData = await syncRes.json();
      if (!syncRes.ok) throw new Error(syncData.error || 'Sync failed');

      setLastResult({ success: true, message: 'Playlist synced successfully!', count: total });
      showToast(`Added ${total} channels from M3U`, 'success');
      onPlaylistAdded?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLastResult({ success: false, message });
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileContent(text);
      setM3uText(text);
    };
    reader.readAsText(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1">Add Playlist</h2>
        <p className="text-sm text-zinc-500">Choose a source to add your IPTV channels</p>
      </div>

      {/* Input methods */}
      <div className="space-y-2 mb-6">
        {methods.map((method) => (
          <motion.div
            key={method.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: methods.indexOf(method) * 0.05 }}
          >
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setExpandedMethod(expandedMethod === method.id ? null : method.id)}
              className={`w-full flex items-center gap-4 p-4 text-left transition-all duration-200 ${
                expandedMethod === method.id
                  ? 'bg-zinc-800 border border-zinc-600'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className={`w-10 h-10 flex items-center justify-center ${
                expandedMethod === method.id ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {method.icon}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${expandedMethod === method.id ? 'text-white' : 'text-zinc-300'}`}>
                  {method.label}
                </p>
                <p className="text-[11px] text-zinc-600">{method.desc}</p>
              </div>
              <motion.div
                animate={{ rotate: expandedMethod === method.id ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {expandedMethod === method.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-zinc-900/50 border border-t-0 border-zinc-800">
                    {/* Common name field */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                        Playlist Name (optional)
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Playlist"
                        className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    {method.id === 'xtream' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                            Server URL
                          </label>
                          <input
                            type="text"
                            value={xtreamUrl}
                            onChange={(e) => setXtreamUrl(e.target.value)}
                            placeholder="http://example.com:8080"
                            className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                              Username
                            </label>
                            <input
                              type="text"
                              value={xtreamUser}
                              onChange={(e) => setXtreamUser(e.target.value)}
                              placeholder="username"
                              className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                              Password
                            </label>
                            <input
                              type="password"
                              value={xtreamPass}
                              onChange={(e) => setXtreamPass(e.target.value)}
                              placeholder="password"
                              className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-mono"
                            />
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSubmitXtream}
                          disabled={isLoading}
                          className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {loadingMessage || 'Connecting...'}
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              Connect & Sync
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}

                    {method.id === 'url' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                            M3U Playlist URL
                          </label>
                          <input
                            type="url"
                            value={m3uUrl}
                            onChange={(e) => setM3uUrl(e.target.value)}
                            placeholder="http://example.com/playlist.m3u"
                            className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-mono"
                          />
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSubmitM3U('', m3uUrl)}
                          disabled={isLoading || !m3uUrl}
                          className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {loadingMessage || 'Loading...'}
                            </>
                          ) : (
                            <>
                              <Link className="w-4 h-4" />
                              Fetch & Parse
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}

                    {method.id === 'file' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                            Upload M3U File
                          </label>
                          <label className="flex items-center justify-center gap-2 w-full bg-zinc-800 border-2 border-dashed border-zinc-700 text-zinc-400 px-4 py-6 cursor-pointer hover:border-white hover:text-white transition-colors">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">{fileContent ? 'File loaded! Click to replace' : 'Click to select .m3u file'}</span>
                            <input
                              type="file"
                              accept=".m3u,.m3u8,.txt"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSubmitM3U(fileContent)}
                          disabled={isLoading || !fileContent}
                          className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {loadingMessage || 'Processing...'}
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Parse & Sync
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}

                    {method.id === 'text' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                            Paste M3U Content
                          </label>
                          <textarea
                            value={m3uText}
                            onChange={(e) => setM3uText(e.target.value)}
                            placeholder="#EXTM3U&#10;#EXTINF:-1,Channel Name&#10;http://stream-url.com/live/channel.m3u8&#10;..."
                            rows={6}
                            className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-xs font-mono placeholder-zinc-600 focus:outline-none focus:border-white transition-colors resize-none"
                          />
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSubmitM3U(m3uText)}
                          disabled={isLoading || !m3uText}
                          className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {loadingMessage || 'Processing...'}
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4" />
                              Parse & Sync
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Result feedback */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 p-4 border ${
              lastResult.success 
                ? 'bg-zinc-900 border-green-800 text-green-400' 
                : 'bg-zinc-900 border-red-800 text-red-400'
            }`}
          >
            {lastResult.success ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium">{lastResult.message}</p>
              {lastResult.count && <p className="text-xs text-zinc-500 mt-0.5">{lastResult.count} channels synced</p>}
            </div>
            <button onClick={() => setLastResult(null)} className="ml-auto text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
