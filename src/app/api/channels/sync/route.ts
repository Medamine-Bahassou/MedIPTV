import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseM3U } from '@/lib/m3u-parser';

// POST /api/channels/sync - Parse and save channels from M3U content or Xtream data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, channels: rawChannels, m3uContent } = body;

    if (!playlistId) {
      return NextResponse.json({ error: 'Playlist ID required' }, { status: 400 });
    }

    let channels = rawChannels;

    // If M3U content provided, parse it
    if (m3uContent && !channels) {
      const result = parseM3U(m3uContent);
      channels = result.channels;
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ error: 'No channels to sync' }, { status: 400 });
    }

    // Delete existing channels for this playlist
    await db.channel.deleteMany({ where: { playlistId } });

    // Create channels in batches
    const BATCH_SIZE = 100;
    const totalCount = channels.length;
    let processed = 0;

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE);
      
      await db.channel.createMany({
        data: batch.map((ch: { name: string; url: string; logo?: string; group?: string; type?: string; number?: number; epgId?: string }) => ({
          name: ch.name || 'Unknown',
          url: ch.url,
          logo: ch.logo || '',
          group: ch.group || 'Uncategorized',
          type: ch.type || 'live',
          number: ch.number || (i + batch.indexOf(ch) + 1),
          epgId: ch.epgId || '',
          playlistId,
        })),
      });

      processed += batch.length;
    }

    // Update playlist channel count and lastSynced
    await db.playlist.update({
      where: { id: playlistId },
      data: {
        channelCount: totalCount,
        lastSynced: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      synced: totalCount,
      message: `Successfully synced ${totalCount} channels`
    });
  } catch (error) {
    console.error('Channel sync error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync channels';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
