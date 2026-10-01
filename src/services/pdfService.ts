import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ExtractedPDF {
  text: string;
  numPages: number;
  wordCount: number;
  fileName: string;
}

export class PDFService {
  /**
   * Extracts clean, structured text from an uploaded PDF file
   */
  public static async extractTextFromPDF(
    file: File,
    onProgress?: (progressPercent: number, page: number, totalPages: number) => void
  ): Promise<ExtractedPDF> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const pageTexts: string[] = [];
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
        }

        if (onProgress) {
          onProgress(Math.round((pageNum / maxPagesToProcess) * 100), pageNum, totalPages);
        }
      }

      const fullText = pageTexts.join('\n\n');
      const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;

      return {
        text: fullText,
        numPages: totalPages,
        wordCount,
        fileName: file.name.replace(/\.[^/.]+$/, ''),
      };
    } catch (err: unknown) {
      console.error('PDF extraction failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to parse PDF: ${message}`);
    }
  }
}
