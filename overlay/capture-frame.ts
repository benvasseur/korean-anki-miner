// Captures the current YouTube frame for the Anki Image field. Lives in the
// content script because only it can reach the page's <video> element; the
// resulting data URL is handed to the worker (which stores it via AnkiConnect).

const VIDEO_SELECTOR = '#movie_player video.html5-main-video';
const MAX_EDGE = 640; // Anki cards don't need full resolution; keep the data URL small

/**
 * Returns a JPEG data URL of the current frame with `caption` burned in along
 * the bottom, or `null` if there's no painted video (or the canvas is tainted
 * by DRM/EME-protected content, which makes `toDataURL` throw).
 */
export function captureVideoFrame(caption: string): string | null {
  const video =
    document.querySelector<HTMLVideoElement>(VIDEO_SELECTOR) ??
    document.querySelector<HTMLVideoElement>('video');
  if (!video || !video.videoWidth || !video.videoHeight) return null;

  const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawCaption(ctx, caption.trim(), canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null; // tainted canvas (protected content) or draw failure
  }
}

/** Renders the subtitle as a centered, wrapped band near the bottom of the frame. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
): void {
  if (!text) return;

  const fontSize = Math.max(15, Math.round(height * 0.055));
  const lineHeight = Math.round(fontSize * 1.25);
  const padX = Math.round(width * 0.02);
  const padY = Math.round(fontSize * 0.4);

  ctx.font = `600 ${fontSize}px 'YouTube Noto', Roboto, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const lines = wrapLines(ctx, text, width * 0.9);
  const blockHeight = lines.length * lineHeight + padY * 2;
  const bandTop = height - blockHeight - Math.round(height * 0.04);
  const centerX = width / 2;

  // Translucent strip behind the text (matches the overlay's caption styling).
  const bandWidth = Math.min(
    width * 0.96,
    Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2,
  );
  ctx.fillStyle = 'rgba(8, 8, 8, 0.75)';
  ctx.fillRect(centerX - bandWidth / 2, bandTop, bandWidth, blockHeight);

  // White text with a thin dark outline so it stays legible on any band edge.
  ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillStyle = '#fff';
  lines.forEach((line, i) => {
    const y = bandTop + padY + i * lineHeight;
    ctx.strokeText(line, centerX, y);
    ctx.fillText(line, centerX, y);
  });
}

/** Greedy word-wrap so the caption fits within `maxWidth`. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
