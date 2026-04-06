// M3U/M3U8 Playlist Parser

export interface M3UChannel {
  name: string;
  url: string;
  logo: string;
  group: string;
  type: 'live' | 'vod' | 'series';
  epgId: string;
  number: number;
  rawAttrs: Record<string, string>;
}

export interface M3UParseResult {
  channels: M3UChannel[];
  categories: string[];
}

function parseAttrs(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match key="value" pairs
  const regex = /([A-Z0-9_-]+)="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(line)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function detectChannelType(url: string, attrs: Record<string, string>): 'live' | 'vod' | 'series' {
  if (attrs['channel-id'] || attrs['tvg-id']) {
    const groupId = attrs['group-title']?.toLowerCase() || '';
    if (groupId.includes('vod') || groupId.includes('movie') || groupId.includes('film')) return 'vod';
    if (groupId.includes('series') || groupId.includes('episode')) return 'series';
    return 'live';
  }
  
  const lower = url.toLowerCase();
  if (lower.includes('/movie/') || lower.includes('/vod/')) return 'vod';
  if (lower.includes('/series/')) return 'series';
  if (lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.avi')) return 'vod';
  if (lower.endsWith('.m3u8') || lower.includes('/live/') || lower.includes('m3u8')) return 'live';
  
  return 'live';
}

export function parseM3U(content: string): M3UParseResult {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const channels: M3UChannel[] = [];
  const categorySet = new Set<string>();

  let currentAttrs: Record<string, string> = {};
  let currentName = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      currentAttrs = parseAttrs(line);
      // Extract channel name (everything after the last comma)
      const commaIdx = line.lastIndexOf(',');
      currentName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Unknown Channel';
      
      // Look ahead for the URL line
      i++;
      while (i < lines.length && lines[i].startsWith('#')) {
        // Skip other directives
        if (lines[i].startsWith('#EXTVLCOPT:') || lines[i].startsWith('#KODIPROP:')) {
          // Parse VLC/Kodi options if needed
        }
        i++;
      }
      
      if (i < lines.length && !lines[i].startsWith('#')) {
        const url = lines[i];
        const group = currentAttrs['group-title'] || 'Uncategorized';
        categorySet.add(group);

        channels.push({
          name: currentName,
          url,
          logo: currentAttrs['tvg-logo'] || currentAttrs['logo'] || '',
          group,
          type: detectChannelType(url, currentAttrs),
          epgId: currentAttrs['tvg-id'] || '',
          number: parseInt(currentAttrs['tvg-chno'] || '0', 10) || channels.length + 1,
          rawAttrs: currentAttrs,
        });
      }
    } else {
      i++;
    }
  }

  return {
    channels,
    categories: Array.from(categorySet).sort(),
  };
}

export function countChannelsByType(channels: M3UChannel[]) {
  const counts = { live: 0, vod: 0, series: 0 };
  for (const ch of channels) {
    counts[ch.type]++;
  }
  return counts;
}
