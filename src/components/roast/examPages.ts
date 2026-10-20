import type { ExamPage } from '../../services/examRoastService';
import { MAX_EXAM_PAGES } from '../../services/examRoastService';

/** Longest side of a page sent to the AI: enough to read handwriting, small enough to upload quickly. */
const MAX_EDGE = 1600;

/**
 * Base64 characters allowed per page, so a full paper stays under the shared AI service's 5 MB request limit
 * with room for the prompt.
 */
export const PAGE_BUDGET_CHARS = Math.floor(4_200_000 / MAX_EXAM_PAGES);

const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.46];

/** Scale that fits a width × height page inside MAX_EDGE without enlarging it. */
export const fitScale = (width: number, height: number, maxEdge = MAX_EDGE): number =>
  Math.min(1, maxEdge / Math.max(width, height, 1));

let pageCounter = 0;

/** Encodes a drawn canvas as JPEG, lowering quality and then size until it fits the page budget. */
const encodeCanvas = (canvas: HTMLCanvasElement, name: string): ExamPage => {
  let source = canvas;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const quality of QUALITY_STEPS) {
      const dataUrl = source.toDataURL('image/jpeg', quality);
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (data.length <= PAGE_BUDGET_CHARS) {
        pageCounter += 1;
        return { id: `page-${Date.now()}-${pageCounter}`, name, mimeType: 'image/jpeg', data, previewUrl: dataUrl };
      }
    }
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(source.width * 0.75);
    smaller.height = Math.round(source.height * 0.75);
    smaller.getContext('2d')?.drawImage(source, 0, 0, smaller.width, smaller.height);
    source = smaller;
  }
  throw new Error(`"${name}" is too large to send. Try a smaller photo.`);
};

const drawToCanvas = (image: CanvasImageSource, width: number, height: number): HTMLCanvasElement => {
  const scale = fitScale(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot prepare images.');
  // White under transparent PNGs, which JPEG would otherwise turn black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const imageFileToPage = async (file: File): Promise<ExamPage> => {
  let bitmap: ImageBitmap;
  try {
    // Applies the photo's EXIF rotation, so phone pictures are the right way up.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Couldn't open "${file.name}". Save it as a JPG or PNG and try again.`);
  }
  try {
    return encodeCanvas(drawToCanvas(bitmap, bitmap.width, bitmap.height), file.name);
  } finally {
    bitmap.close();
  }
};

const pdfFileToPages = async (file: File, maxPages: number): Promise<ExamPage[]> => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: ExamPage[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_EDGE / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot prepare images.');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push(encodeCanvas(canvas, `${file.name} p${n}`));
  }
  return pages;
};

export const isAcceptedExamFile = (file: Pick<File, 'type' | 'name'>): boolean =>
  file.type.startsWith('image/') || file.type === 'application/pdf' || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(file.name);

/** Turns chosen photos and PDFs into pages, stopping at `room` pages. */
export const filesToExamPages = async (files: File[], room: number): Promise<ExamPage[]> => {
  const pages: ExamPage[] = [];
  for (const file of files) {
    if (pages.length >= room) break;
    if (!isAcceptedExamFile(file)) throw new Error(`"${file.name}" isn't a photo or PDF.`);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) pages.push(...(await pdfFileToPages(file, room - pages.length)));
    else pages.push(await imageFileToPage(file));
  }
  return pages;
};
