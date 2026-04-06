import { NextRequest, NextResponse } from 'next/server';

// Detect correct MIME type from URL extension
function detectContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (lower.endsWith('.ts')) return 'video/mp2t';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  if (lower.endsWith('.webm')) return 'video/webm';
  // Xtream paths
  if (lower.includes('/live/')) return 'video/mp2t';
  if (lower.includes('/movie/')) return 'video/mp4';
  return 'application/octet-stream';
}

// GET /api/player-proxy?url=xxx - Proxy stream URLs to avoid Mixed Content / CORS issues
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs allowed' }, { status: 400 });
    }

    // Always detect correct MIME from URL — don't trust upstream Content-Type
    const detectedContentType = detectContentType(targetUrl);

    // Forward Range header for VOD seeking
    const rangeHeader = request.headers.get('range');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
    };
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: upstreamHeaders,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      // Handle Range requests (206 Partial Content)
      if (rangeHeader && (response.status === 206 || response.status === 200)) {
        const contentRange = response.headers.get('content-range');
        const upstreamContentLength = response.headers.get('content-length');

        if (response.body) {
          let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

          const stream = new ReadableStream({
            async start(streamController) {
              reader = response.body!.getReader();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  streamController.enqueue(value);
                }
                streamController.close();
              } catch {
                try { streamController.close(); } catch {}
              }
            },
            cancel() {
              if (reader) {
                reader.cancel().catch(() => {});
                reader = null;
              }
            },
          });

          const headers: Record<string, string> = {
            'Content-Type': detectedContentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache, no-store',
            'Access-Control-Allow-Origin': '*',
          };
          if (contentRange) headers['Content-Range'] = contentRange;
          if (upstreamContentLength) headers['Content-Length'] = upstreamContentLength;

          return new NextResponse(stream, {
            status: response.status,
            headers,
          });
        }
      }

      if (!response.ok) {
        return NextResponse.json(
          { error: `Upstream error: ${response.status}` },
          { status: response.status }
        );
      }

      const contentLength = response.headers.get('content-length');

      if (response.body) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

        const stream = new ReadableStream({
          async start(streamController) {
            reader = response.body!.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                streamController.enqueue(value);
              }
              streamController.close();
            } catch {
              try { streamController.close(); } catch {}
            }
          },
          cancel() {
            if (reader) {
              reader.cancel().catch(() => {});
              reader = null;
            }
          },
        });

        const headers: Record<string, string> = {
          'Content-Type': detectedContentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        };
        if (contentLength) {
          headers['Content-Length'] = contentLength;
        }

        return new NextResponse(stream, {
          status: 200,
          headers,
        });
      }

      return new NextResponse(null, { status: 204 });
    } catch (fetchErr) {
      clearTimeout(timeout);
      throw fetchErr;
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return NextResponse.json({ error: 'Stream timed out' }, { status: 504 });
    }
    console.error('Proxy error:', error);
    const message = error instanceof Error ? error.message : 'Proxy failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
    },
  });
}
