import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { useIPTVStore } from '@/store/iptv-store';

// GET /api/favorites?playlistId=xxx - Get favorites for a playlist
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');
    
    const where = playlistId ? { playlistId } : {};
    const favorites = await db.favorite.findMany({
      where,
      include: { channel: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

// POST /api/favorites - Add/remove favorite
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, playlistId, action } = body;

    if (!channelId || !playlistId) {
      return NextResponse.json({ error: 'Channel ID and playlist ID required' }, { status: 400 });
    }

    if (action === 'remove') {
      await db.favorite.deleteMany({
        where: { channelId, playlistId },
      });
      return NextResponse.json({ success: true, removed: true });
    }

    // Check if already exists
    const existing = await db.favorite.findFirst({
      where: { channelId, playlistId },
    });

    if (existing) {
      return NextResponse.json({ success: true, alreadyExists: true });
    }

    const favorite = await db.favorite.create({
      data: { channelId, playlistId },
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
  }
}
