import { NextRequest, NextResponse } from 'next/server';
import { parseM3U, parseM3UFromUrl } from '@/lib/m3u-parser';

// POST /api/m3u-parse - Parse M3U content or fetch and parse from URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, url } = body;

    let m3uContent: string;

    if (content) {
      m3uContent = content;
    } else if (url) {
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch M3U: ${response.status}` }, { status: 400 });
      }
      m3uContent = await response.text();
    } else {
      return NextResponse.json({ error: 'Either content or url is required' }, { status: 400 });
    }

    const result = parseM3U(m3uContent);

    if (result.channels.length === 0) {
      return NextResponse.json({ error: 'No channels found in M3U content' }, { status: 400 });
    }

    return NextResponse.json({
      channels: result.channels,
      categories: result.categories,
      total: result.channels.length,
    });
  } catch (error) {
    console.error('M3U parse error:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse M3U';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
