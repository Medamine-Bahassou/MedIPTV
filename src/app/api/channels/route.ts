import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/channels?playlistId=xxx&type=live&category=xxx&search=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');
    const type = searchParams.get('type') || 'live';
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    if (!playlistId) {
      return NextResponse.json({ error: 'Playlist ID required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      playlistId,
      type,
    };

    if (category && category !== 'all') {
      where.group = category;
    }

    if (search) {
      where.name = { contains: search };
    }

    const channels = await db.channel.findMany({
      where,
      orderBy: { number: 'asc' },
      take: limit,
    });

    // Get distinct groups with counts for this playlist and type
    const categoryCounts = await db.channel.groupBy({
      by: ['group'],
      where: { playlistId, type },
      _count: { id: true },
      orderBy: { group: 'asc' },
    });

    const categories = categoryCounts.map(c => ({
      name: c.group,
      count: c._count.id,
    }));

    return NextResponse.json({
      channels,
      categories,
      total: channels.length,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}
