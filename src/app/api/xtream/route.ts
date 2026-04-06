import { NextRequest, NextResponse } from 'next/server';
import { XtreamClient } from '@/lib/xtream-client';

// POST /api/xtream - Proxy Xtream API requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, xtreamUrl, username, password, categoryId, streamId, seriesId } = body;

    if (!xtreamUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing Xtream credentials' }, { status: 400 });
    }

    const client = new XtreamClient(xtreamUrl, username, password);

    switch (action) {
      case 'authenticate': {
        const data = await client.authenticate();
        // Xtream API returns { user_info: {...}, server_info: {...} }
        const userInfo = data.user_info || data;
        if (userInfo.auth !== 1) {
          return NextResponse.json({ error: 'Authentication failed', details: userInfo }, { status: 401 });
        }
        return NextResponse.json({ success: true, user_info: userInfo, server_info: data.server_info });
      }

      case 'get_server_info': {
        const info = await client.getServerInfo();
        return NextResponse.json(info);
      }

      case 'get_live_categories': {
        const categories = await client.getLiveCategories();
        return NextResponse.json(categories);
      }

      case 'get_live_streams': {
        const streams = await client.getLiveStreams(categoryId);
        return NextResponse.json(streams);
      }

      case 'get_vod_categories': {
        const categories = await client.getVodCategories();
        return NextResponse.json(categories);
      }

      case 'get_vod_streams': {
        const streams = await client.getVodStreams(categoryId);
        return NextResponse.json(streams);
      }

      case 'get_series_categories': {
        const categories = await client.getSeriesCategories();
        return NextResponse.json(categories);
      }

      case 'get_series_list': {
        const series = await client.getSeriesList(categoryId);
        return NextResponse.json(series);
      }

      case 'get_series_info': {
        if (!seriesId) {
          return NextResponse.json({ error: 'Series ID required' }, { status: 400 });
        }
        const info = await client.getSeriesInfo(seriesId);
        return NextResponse.json(info);
      }

      case 'get_live_url': {
        if (!streamId) {
          return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });
        }
        const url = client.getLiveStreamUrl(streamId);
        return NextResponse.json({ url });
      }

      case 'get_vod_url': {
        if (!streamId) {
          return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });
        }
        const url = client.getVodStreamUrl(streamId);
        return NextResponse.json({ url });
      }

      case 'get_series_url': {
        if (!streamId) {
          return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });
        }
        const url = client.getSeriesStreamUrl(streamId);
        return NextResponse.json({ url });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Xtream API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
