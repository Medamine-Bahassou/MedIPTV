import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/playlists - List all playlists
export async function GET() {
  try {
    const playlists = await db.playlist.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { channels: true },
        },
      },
    });
    
    return NextResponse.json(playlists.map(p => ({
      ...p,
      channelCount: p._count.channels,
      _count: undefined,
    })));
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}

// POST /api/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, m3uUrl, xtreamUrl, xtreamUser, xtreamPass } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    if (type === 'm3u' && !m3uUrl) {
      return NextResponse.json({ error: 'M3U URL is required for M3U playlists' }, { status: 400 });
    }

    if (type === 'xtream' && (!xtreamUrl || !xtreamUser || !xtreamPass)) {
      return NextResponse.json({ error: 'Xtream URL, username, and password are required' }, { status: 400 });
    }

    const playlist = await db.playlist.create({
      data: {
        name,
        type,
        m3uUrl: m3uUrl || null,
        xtreamUrl: xtreamUrl || null,
        xtreamUser: xtreamUser || null,
        xtreamPass: xtreamPass || null,
      },
    });

    return NextResponse.json(playlist, { status: 201 });
  } catch (error) {
    console.error('Error creating playlist:', error);
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
  }
}

// DELETE /api/playlists?id=xxx - Delete a playlist
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Playlist ID is required' }, { status: 400 });
    }

    await db.playlist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 });
  }
}
