/*
 * A phone with a 48 MP camera produces an 8064x6048 JPEG. The API builds sharp
 * with `limitInputPixels: 20_000_000`, so that file is rejected as
 * INVALID_IMAGE and the draft it belongs to is marked `blocked`: the technician
 * sees the photo stored on the device and the evidence never arrives.
 *
 * The server already resizes to 2048 px, so shrinking on the device loses
 * nothing that would have been kept. It also keeps IndexedDB small and makes
 * the sync upload a few hundred kilobytes instead of several megabytes.
 */

export const MAX_PHOTO_EDGE = 2048;
export const ACCEPTED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class PhotoError extends Error {}

export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  // WebP first: the server stores WebP, and a browser without a WebP encoder
  // silently answers PNG, which is lossless and far too big for a photograph.
  const webp = await toBlob(canvas, 'image/webp', 0.92);
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.92);
  if (jpeg) return jpeg;
  throw new PhotoError('No pudimos preparar la imagen. Intenta con otra foto.');
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type as never))
    throw new PhotoError('Solo se aceptan imágenes JPEG, PNG o WebP.');

  let bitmap: ImageBitmap;
  try {
    // `from-image` applies EXIF orientation before the pixels are copied: a
    // photo taken upright must not be stored lying on its side.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError(
      'No pudimos leer esta imagen en este dispositivo. Intenta con otra foto.',
    );
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height);
    if (target.width === bitmap.width && target.height === bitmap.height)
      return file;

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('No pudimos preparar la imagen.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    return await encode(canvas);
  } finally {
    bitmap.close();
  }
}
