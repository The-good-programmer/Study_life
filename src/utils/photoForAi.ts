/** Photos are scaled to this many pixels on the long side: enough to read, and under the AI's 4 MB limit. */
const MAX_PHOTO_SIDE = 2000;

export interface AiImage {
  mimeType: string;
  /** Base64, without the data: prefix. */
  data: string;
}

/** A photo as a JPEG for the AI, whatever it was taken as (HEIC on iPhones, say). */
export async function photoForAi(file: File): Promise<AiImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
}
