import { NextRequest, NextResponse } from 'next/server';

// HLS proxy: fetches m3u8 manifest and rewrites ALL resource URLs
// to point through our player-proxy. This way HLS.js loads everything
// through our backend natively — no xhrSetup hacks needed.
//
// Segment URLs (e.g. /hls/hash/484902_20.ts) → /api/player-proxy?url=<absolute>
// Sub-playlist URLs (e.g. 720p.m3u8)           → /api/hls-proxy?url=<absolute>

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function toProxyUrl(absoluteUrl: string, kind: 'segment' | 'playlist'): string {
  const proxy = kind === 'playlist' ? '/api/hls-proxy' : '/api/player-proxy';
  return `${proxy}?url=${encodeURIComponent(absoluteUrl)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs allowed' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const body = await response.text();

    // Use the response URL (after redirects) as the base for resolving relative paths
    const baseUrl = response.url || targetUrl;

    // Detect if this is a master playlist (contains #EXT-X-STREAM-INF)
    const isMaster = body.includes('#EXT-X-STREAM-INF');

    // Rewrite ALL resource URLs to point through our proxy
    const rewritten = body.split('\n').map(line => {
      const trimmed = line.trim();

      // Leave comments and blank lines alone
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }

      // This is a resource URL — resolve against base, then proxy it
      const absolute = resolveUrl(baseUrl, trimmed);
      const isPlaylist = trimmed.endsWith('.m3u8');
      return toProxyUrl(absolute, isPlaylist ? 'playlist' : 'segment');
    }).join('\n');

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('HLS proxy error:', error);
    const message = error instanceof Error ? error.message : 'Proxy failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
