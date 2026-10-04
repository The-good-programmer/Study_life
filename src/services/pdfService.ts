import type { PDFSourcePage, SourceAnchor } from '../types';

export interface ExtractedPDF {
  text: string;
  numPages: number;
  wordCount: number;
  fileName: string;
  pages: PDFSourcePage[];
  pdfDataUrl?: string;
}

export class PDFService {
  /**
   * Lazily loads PDF.js and extracts clean, structured text from an uploaded PDF file.
   * Also captures per-page text chunks and converts file to a data URL for live canvas rendering.
   */
  public static async extractTextFromPDF(
    file: File,
    onProgress?: (progressPercent: number, page: number, totalPages: number) => void
  ): Promise<ExtractedPDF> {
    try {
      // Dynamically import pdfjs-dist on demand to keep initial app bundle ultra-lightweight
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configure PDF.js worker using locally bundled asset for 100% offline PWA support
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const pageTexts: string[] = [];
      const pages: PDFSourcePage[] = [];
      const maxPagesToProcess = Math.min(totalPages, 40); // Process up to 40 pages of lecture material

      for (let pageNum = 1; pageNum <= maxPagesToProcess; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageString = textContent.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageString.length > 0) {
          pageTexts.push(`--- Page ${pageNum} ---\n${pageString}`);
          pages.push({ pageNumber: pageNum, text: pageString });
        } else {
          pages.push({ pageNumber: pageNum, text: '' });
        }

        if (onProgress) {
          onProgress(Math.round((pageNum / maxPagesToProcess) * 100), pageNum, totalPages);
        }
      }

      // Convert file to Base64 data URL for instant live split-screen rendering
      let pdfDataUrl: string | undefined;
      try {
        const reader = new FileReader();
        pdfDataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      } catch (err) {
        console.warn('Could not generate base64 data URL for PDF preview:', err);
      }

      const fullText = pageTexts.join('\n\n');
      const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;

      return {
        text: fullText,
        numPages: totalPages,
        wordCount,
        fileName: file.name.replace(/\.[^/.]+$/, ''),
        pages,
        pdfDataUrl,
      };
    } catch (err: unknown) {
      console.error('PDF extraction failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to parse PDF: ${message}`);
    }
  }

  /**
   * Matches concept and retrieval terms against extracted document pages
   * to determine the exact 1-based page number and context snippet.
   */
  public static findBestSourceAnchor(
    keywords: string[],
    pages: PDFSourcePage[],
    fileName?: string
  ): SourceAnchor {
    if (!pages || pages.length === 0) {
      return { pageNumber: 1, sourceName: fileName };
    }

    const cleanKeywords = keywords
      .map(k => k.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
      .filter(k => k.length > 2);

    let bestPage = pages[0].pageNumber;
    let maxScore = -1;
    let bestSnippet = '';

    for (const page of pages) {
      if (!page.text) continue;
      const lowerText = page.text.toLowerCase();
      let score = 0;
      let matchedKeyword = '';

      for (const kw of cleanKeywords) {
        if (lowerText.includes(kw)) {
          score += kw.length > 5 ? 3 : 1;
          if (!matchedKeyword) matchedKeyword = kw;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestPage = page.pageNumber;

        if (matchedKeyword) {
          const idx = lowerText.indexOf(matchedKeyword);
          const start = Math.max(0, idx - 60);
          const end = Math.min(page.text.length, idx + matchedKeyword.length + 80);
          let snippet = page.text.substring(start, end).trim();
          if (start > 0) snippet = `...${snippet}`;
          if (end < page.text.length) snippet = `${snippet}...`;
          bestSnippet = snippet;
        } else {
          bestSnippet = `${page.text.substring(0, 120).trim()}...`;
        }
      }
    }

    return {
      pageNumber: bestPage,
      snippet: bestSnippet || (pages[0]?.text ? `${pages[0].text.substring(0, 120)}...` : undefined),
      sourceName: fileName,
      relevanceReason: maxScore > 0 ? `Matched key concept terms on page ${bestPage}` : undefined,
    };
  }

  /**
   * Renders a specific PDF page onto an HTML5 Canvas using PDF.js
   */
  public static async renderPageToCanvas(
    pdfDataUrlOrBuffer: string,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    targetWidth: number = 700
  ): Promise<{ width: number; height: number }> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

    const loadingTask = pdfjsLib.getDocument({ url: pdfDataUrlOrBuffer });
    const pdf = await loadingTask.promise;
    const clampedPage = Math.max(1, Math.min(pdf.numPages, pageNumber));
    const page = await pdf.getPage(clampedPage);

    const initialViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.max(0.6, targetWidth / initialViewport.width);
    const viewport = page.getViewport({ scale });

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    return { width: viewport.width, height: viewport.height };
  }
}
