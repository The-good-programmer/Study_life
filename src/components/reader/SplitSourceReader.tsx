import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Maximize2,
  Minimize2,
  Quote,
  RefreshCw,
  Search,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { SourceDocument } from '../../types';
import { PDFService } from '../../services/pdfService';
import { cn } from '../../utils/cn';
import { Button, IconButton } from '../ui/primitives';
import { escapeRegex, quotePatterns } from './quotePatterns';

interface SplitSourceReaderProps {
  sourceDocument?: SourceDocument;
  targetPage?: number;
  highlightTerms?: string[];
  activeAnchorSnippet?: string;
  onClose: () => void;
  onPageChange?: (page: number) => void;
  onAttachSource?: (file: File) => Promise<void>;
  className?: string;
}


/** The deck's source PDF beside the study session, opened at the page a concept came from. */
export const SplitSourceReader: React.FC<SplitSourceReaderProps> = ({
  sourceDocument,
  targetPage = 1,
  highlightTerms = [],
  activeAnchorSnippet,
  onClose,
  onPageChange,
  onAttachSource,
  className = '',
}) => {
  const totalPages = sourceDocument?.totalPages || sourceDocument?.pages?.length || 1;

  const [currentPage, setCurrentPage] = useState<number>(() => Math.max(1, targetPage));
  const [prevTargetPage, setPrevTargetPage] = useState(targetPage);
  if (targetPage !== prevTargetPage) {
    setPrevTargetPage(targetPage);
    setCurrentPage(Math.max(1, Math.min(totalPages, targetPage)));
  }

  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'canvas' | 'text'>(() => (sourceDocument?.pdfDataUrl ? 'canvas' : 'text'));
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(clamped);
    onPageChange?.(clamped);
  };

  const copyQuote = async () => {
    if (!activeAnchorSnippet) return;
    try {
      await navigator.clipboard.writeText(activeAnchorSnippet);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  };

  /** Scrolls the reader (and only the reader: scrollIntoView would move the whole page) to the quote. */
  const scrollToQuote = () => {
    const container = textContainerRef.current;
    const el = container?.querySelector<HTMLElement>('[data-quote]');
    if (!container || !el) return;
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - container.clientHeight / 3), behavior: 'smooth' });
  };

  // In the text view, bring the concept's quote into view.
  useEffect(() => {
    if (!activeAnchorSnippet || viewMode !== 'text') return;
    const timer = setTimeout(scrollToQuote, 150);
    return () => clearTimeout(timer);
  }, [activeAnchorSnippet, viewMode, currentPage]);

  // Escape leaves the enlarged view.
  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isExpanded]);

  // Draw the PDF page in the page view.
  useEffect(() => {
    if (viewMode !== 'canvas' || !sourceDocument?.pdfDataUrl || !canvasRef.current) return;
    let isMounted = true;
    // Loading state for the render that starts below; it cannot be derived during render.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsRendering(true);
    setRenderError(null);
    const targetWidth = Math.round((isExpanded ? 900 : 640) * zoomLevel);
    PDFService.renderPageToCanvas(sourceDocument.pdfDataUrl, currentPage, canvasRef.current, targetWidth)
      .then(() => {
        if (isMounted) setIsRendering(false);
      })
      .catch(err => {
        console.warn('Canvas rendering error:', err);
        if (isMounted) {
          setIsRendering(false);
          setRenderError("This page couldn't be drawn, so it's shown as text.");
          setViewMode('text');
        }
      });
    return () => {
      isMounted = false;
    };
  }, [currentPage, viewMode, sourceDocument?.pdfDataUrl, zoomLevel, isExpanded]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onAttachSource) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await onAttachSource(file);
    } catch (err) {
      console.error(err);
      setUploadError("Couldn't read that PDF. Try another file.");
    } finally {
      setIsUploading(false);
    }
  };

  const pageText =
    sourceDocument?.pages?.find(p => p.pageNumber === currentPage)?.text || sourceDocument?.pages?.[currentPage - 1]?.text || '';

  const quoteParts = (activeAnchorSnippet ? quotePatterns(activeAnchorSnippet) : []).filter(p => new RegExp(p, 'iu').test(pageText));
  const quoteOnPage = quoteParts.length > 0;

  const renderPageText = () => {
    if (!pageText.trim()) {
      return <p className="text-[13px] text-ink-subtle">No readable text on page {currentPage}.</p>;
    }
    const patterns = [
      ...quoteParts,
      ...highlightTerms.map(t => t.trim()).filter(t => t.length > 2).map(escapeRegex),
      ...(searchQuery.trim().length > 1 ? [escapeRegex(searchQuery.trim())] : []),
    ];
    const regex = patterns.length ? new RegExp(`(${patterns.join('|')})`, 'giu') : null;
    const isQuote = (part: string) => quoteParts.some(p => new RegExp(`^(?:${p})$`, 'iu').test(part));
    const isSearchHit = (part: string) => searchQuery.trim().length > 1 && part.toLowerCase() === searchQuery.trim().toLowerCase();

    return (
      <div className="space-y-4 font-serif text-[15px] leading-relaxed text-ink">
        {pageText.split('\n\n').map((paragraph, i) => (
          <p key={i}>
            {regex
              ? paragraph.split(regex).map((part, j) => {
                  if (j % 2 === 0) return <React.Fragment key={j}>{part}</React.Fragment>;
                  if (isQuote(part)) {
                    return (
                      <mark key={j} data-quote className="rounded bg-success-soft px-0.5 text-ink ring-1 ring-success/40">
                        {part}
                      </mark>
                    );
                  }
                  return (
                    <mark key={j} className={cn('rounded px-0.5 text-ink', isSearchHit(part) ? 'bg-gold/40' : 'bg-brand-soft')}>
                      {part}
                    </mark>
                  );
                })
              : paragraph}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-3xl border border-line-strong bg-surface-solid text-ink shadow-[0_24px_60px_-28px_rgb(0_0_0/0.7)]',
        isExpanded ? 'fixed inset-3 z-50 sm:inset-6' : 'relative',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 select-none">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-ink">{sourceDocument?.name || 'Source'}</h3>
            <p className="truncate text-xs text-ink-subtle">
              {sourceDocument ? `${totalPages} ${totalPages === 1 ? 'page' : 'pages'} · what this deck was made from` : 'No source attached'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {sourceDocument?.pdfDataUrl && (
            <div role="radiogroup" aria-label="View" className="mr-1 hidden rounded-lg border border-line bg-canvas p-0.5 sm:flex">
              {(['canvas', 'text'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer',
                    viewMode === mode ? 'bg-surface-hover text-ink' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  {mode === 'canvas' ? 'Page' : 'Text'}
                </button>
              ))}
            </div>
          )}
          {sourceDocument && (
            <IconButton icon={Search} label="Find on this page" active={isSearching} aria-pressed={isSearching} onClick={() => setIsSearching(v => !v)} />
          )}
          {viewMode === 'canvas' && sourceDocument?.pdfDataUrl && (
            <span className="hidden items-center sm:flex">
              <IconButton icon={ZoomOut} label="Zoom out" onClick={() => setZoomLevel(z => Math.max(0.7, z - 0.15))} disabled={zoomLevel <= 0.7} />
              <span className="w-10 text-center text-xs tabular-nums text-ink-subtle">{Math.round(zoomLevel * 100)}%</span>
              <IconButton icon={ZoomIn} label="Zoom in" onClick={() => setZoomLevel(z => Math.min(2, z + 0.15))} disabled={zoomLevel >= 2} />
            </span>
          )}
          <IconButton
            icon={isExpanded ? Minimize2 : Maximize2}
            label={isExpanded ? 'Back to side by side' : 'Enlarge'}
            aria-pressed={isExpanded}
            onClick={() => setIsExpanded(v => !v)}
          />
          <IconButton icon={X} label="Close the source" onClick={onClose} />
        </div>
      </div>

      {isSearching && sourceDocument && (
        <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2 animate-fadeIn">
          <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Highlight a word on this page"
            aria-label="Highlight a word on this page"
            className="h-8 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none"
            autoFocus
          />
          {viewMode === 'canvas' && <span className="hidden text-xs text-ink-subtle sm:inline">Highlights show in the text view</span>}
        </div>
      )}

      {activeAnchorSnippet && sourceDocument && (
        <div className="border-b border-line bg-canvas px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink-subtle">Where this concept comes from, page {targetPage}</p>
              <p className="mt-0.5 line-clamp-2 font-serif text-[13px] leading-relaxed text-ink">“{activeAnchorSnippet}”</p>
              {viewMode === 'text' && !quoteOnPage && currentPage === targetPage && (
                <p className="mt-1 text-xs text-ink-subtle">This exact wording isn't in the page's text; the PDF may lay it out differently.</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {currentPage !== targetPage && (
              <Button size="sm" variant="ghost" onClick={() => goToPage(targetPage)}>
                Back to page {targetPage}
              </Button>
            )}
            {viewMode === 'canvas' && (
              <Button size="sm" variant="ghost" icon={Search} onClick={() => setViewMode('text')}>
                Find in text
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={copyState === 'copied' ? Check : Copy} onClick={() => void copyQuote()}>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? "Couldn't copy" : 'Copy quote'}
            </Button>
          </div>
        </div>
      )}

      <div ref={textContainerRef} className="relative min-h-0 flex-1 overflow-y-auto bg-canvas p-4 select-text sm:p-6">
        {!sourceDocument ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
            <h4 className="mt-4 text-[15px] font-semibold text-ink">No source attached</h4>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-subtle">
              This deck wasn't made from a PDF. Attach the original notes to read them beside your cards.
            </p>
            {onAttachSource && (
              <>
                <input ref={uploadInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
                <Button
                  variant="primary"
                  className="mt-5"
                  icon={isUploading ? RefreshCw : Upload}
                  disabled={isUploading}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  {isUploading ? 'Reading the PDF…' : 'Attach a PDF'}
                </Button>
                {uploadError && (
                  <p className="mt-3 text-xs text-danger" role="alert">
                    {uploadError}
                  </p>
                )}
              </>
            )}
          </div>
        ) : viewMode === 'canvas' && sourceDocument.pdfDataUrl ? (
          <div className="flex min-h-full flex-col items-center">
            {isRendering && (
              <p className="flex items-center gap-2 py-3 text-xs text-ink-subtle" role="status">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Drawing page {currentPage}…
              </p>
            )}
            <div className="flex max-w-full justify-center overflow-x-auto rounded-xl bg-white p-2 shadow-[0_12px_40px_-20px_rgb(0_0_0/0.6)] sm:p-3">
              <canvas ref={canvasRef} className="h-auto max-w-full" aria-label={`Page ${currentPage} of ${sourceDocument.name}`} />
            </div>
          </div>
        ) : (
          <article className="mx-auto max-w-2xl">
            {renderError && <p className="mb-4 rounded-xl bg-gold-soft px-3.5 py-2.5 text-[13px] text-ink">{renderError}</p>}
            <p className="mb-4 text-xs text-ink-subtle">
              Page {currentPage} of {totalPages}
            </p>
            {renderPageText()}
          </article>
        )}
      </div>

      {sourceDocument && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 select-none">
          <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
            Previous
          </Button>
          <PageInput page={currentPage} total={totalPages} onGo={goToPage} />
          <Button size="sm" variant="ghost" trailingIcon={ChevronRight} disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

/** Type a page number; it jumps on Enter or when you leave the box, not on every keystroke. */
const PageInput: React.FC<{ page: number; total: number; onGo: (page: number) => void }> = ({ page, total, onGo }) => {
  const [text, setText] = useState(String(page));
  const [shown, setShown] = useState(page);
  if (shown !== page) {
    setShown(page);
    setText(String(page));
  }
  const commit = () => {
    const value = parseInt(text, 10);
    if (Number.isNaN(value)) setText(String(page));
    else onGo(value);
  };
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-subtle">
      Page
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={total}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        className="h-8 w-12 rounded-lg border border-line-strong bg-canvas text-center text-xs tabular-nums text-ink focus:border-brand focus:outline-none"
      />
      of {total}
    </label>
  );
};
