import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  X, 
  Bookmark, 
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  Upload,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import type { SourceDocument } from '../../types';
import { PDFService } from '../../services/pdfService';

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

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<'canvas' | 'text'>(() => sourceDocument?.pdfDataUrl ? 'canvas' : 'text');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleCopySnippet = () => {
    if (!activeAnchorSnippet) return;
    navigator.clipboard.writeText(activeAnchorSnippet);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleLocateSnippet = () => {
    setViewMode('text');
    setTimeout(() => {
      const el = textContainerRef.current?.querySelector('.ground-truth-anchor');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Auto-scroll to anchor snippet when in text mode
  useEffect(() => {
    if (activeAnchorSnippet && viewMode === 'text') {
      const timer = setTimeout(() => {
        const el = textContainerRef.current?.querySelector('.ground-truth-anchor');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeAnchorSnippet, viewMode, currentPage]);

  // When currentPage changes, notify parent
  const handleGoToPage = (newPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(clamped);
    if (onPageChange) onPageChange(clamped);
  };

  // Render PDF to Canvas via PDFService when in 'canvas' mode
  useEffect(() => {
    if (viewMode !== 'canvas' || !sourceDocument?.pdfDataUrl || !canvasRef.current) {
      return;
    }

    let isMounted = true;
    setIsRendering(true);
    setRenderError(null);

    const targetWidth = Math.round((isExpanded ? 900 : 640) * zoomLevel);

    PDFService.renderPageToCanvas(
      sourceDocument.pdfDataUrl,
      currentPage,
      canvasRef.current,
      targetWidth
    )
      .then(() => {
        if (isMounted) setIsRendering(false);
      })
      .catch((err) => {
        console.warn('Canvas rendering error:', err);
        if (isMounted) {
          setIsRendering(false);
          setRenderError('Could not render PDF canvas directly; switched to high-accuracy text reader.');
          setViewMode('text');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentPage, viewMode, sourceDocument?.pdfDataUrl, zoomLevel, isExpanded]);

  // Handle PDF file upload if deck has no source
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !onAttachSource) return;
    setIsUploading(true);
    try {
      await onAttachSource(e.target.files[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Current page text from structured pages
  const activePageObj = sourceDocument?.pages?.find(p => p.pageNumber === currentPage);
  const rawPageText = activePageObj?.text || (sourceDocument?.pages && sourceDocument.pages[currentPage - 1]?.text) || '';

  // Highlight keywords and search term in text view
  const renderHighlightedContent = (text: string) => {
    if (!text.trim()) {
      return <p className="italic text-slate-500">No readable text found on page {currentPage}.</p>;
    }

    const cleanSnippet = (activeAnchorSnippet || '')
      .replace(/^\.\.\.|\.\.\.$/g, '')
      .replace(/[^\w\s-]/g, ' ')
      .trim();
    const snippetKeyPhrases = cleanSnippet.length > 10
      ? cleanSnippet.split(/\s+/).filter(w => w.length > 3).slice(0, 10)
      : [];

    const termsToHighlight = [
      ...highlightTerms.map(t => t.trim()).filter(t => t.length > 2),
      ...snippetKeyPhrases,
      ...(searchQuery.trim().length > 1 ? [searchQuery.trim()] : []),
    ];

    if (termsToHighlight.length === 0) {
      return (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-serif selection:bg-indigo-500/30">
          {text.split('\n\n').map((paragraph, i) => (
            <p key={i} className="indent-4">{paragraph}</p>
          ))}
        </div>
      );
    }

    // Escape regex characters
    const escaped = termsToHighlight.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

    const paragraphs = text.split('\n\n');

    return (
      <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-serif selection:bg-indigo-500/30">
        {paragraphs.map((para, pIdx) => {
          const parts = para.split(regex);
          return (
            <p key={pIdx} className="indent-4 leading-relaxed">
              {parts.map((part, partIdx) => {
                const isMatch = termsToHighlight.some(t => t.toLowerCase() === part.toLowerCase());
                if (isMatch) {
                  const isSearchHit = searchQuery && part.toLowerCase() === searchQuery.toLowerCase();
                  const isGroundTruth = snippetKeyPhrases.some(sk => sk.toLowerCase() === part.toLowerCase());
                  return (
                    <mark
                      key={partIdx}
                      className={`px-1 py-0.5 rounded font-bold font-sans transition-colors ${
                        isSearchHit
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-sm'
                          : isGroundTruth
                          ? 'ground-truth-anchor bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 ring-1 ring-emerald-400/30 shadow-sm'
                          : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                      }`}
                    >
                      {part}
                    </mark>
                  );
                }
                return <span key={partIdx}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className={`flex flex-col h-full rounded-3xl glass-panel border border-white/[0.12] bg-[#0b0f19]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-slate-200 transition-all ${
        isExpanded ? 'fixed inset-4 z-50' : 'relative'
      } ${className}`}
    >
      {/* Top Header Bar */}
      <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-slate-950/70 select-none">
        
        {/* Document Identifier */}
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate font-display">
                {sourceDocument?.name || 'Primary Source Document'}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Ground Truth
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {totalPages} pages total • Synced with active study concept
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* View Mode Switcher (if pdf canvas available) */}
          {sourceDocument?.pdfDataUrl && (
            <div className="flex bg-slate-900/90 p-0.5 rounded-xl border border-white/[0.08] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('canvas')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === 'canvas' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Canvas
              </button>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Text
              </button>
            </div>
          )}

          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setIsSearching(!isSearching)}
            className={`p-1.5 rounded-xl border transition-colors ${
              isSearching 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-slate-900 border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title="Search in document"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Zoom In/Out (Canvas view) */}
          {viewMode === 'canvas' && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-900/90 border border-white/[0.08] p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.15))}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 font-bold text-slate-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.15))}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Expand / Minimize Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title={isExpanded ? 'Restore Split View' : 'Expand Document View'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title="Close Source Reader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Expandable Search Input Bar */}
      {isSearching && (
        <div className="p-2.5 bg-slate-950 border-b border-white/[0.08] flex items-center gap-2 animate-fadeIn">
          <Search className="w-4 h-4 text-amber-400 shrink-0 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type keyword to highlight across current page..."
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/[0.08]"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Active Concept Grounding Anchor Banner */}
      {activeAnchorSnippet && (
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/70 via-indigo-950/70 to-slate-950 border-b border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-200">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Bookmark className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-300 uppercase text-[11px] tracking-wider font-display">
                  Ground Truth Evidence (Page {currentPage}):
                </span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Grounding Verified
                </span>
              </div>
              <p className="italic text-slate-200 text-xs font-serif leading-relaxed line-clamp-2">
                "{activeAnchorSnippet}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {viewMode === 'canvas' && (
              <button
                type="button"
                onClick={handleLocateSnippet}
                className="px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.1] text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Switch to Text Reader to highlight and locate snippet"
              >
                <ExternalLink className="w-3 h-3 text-indigo-400" />
                <span>Locate in Text</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopySnippet}
              className="px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.1] text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Copy ground truth citation snippet to clipboard"
            >
              {hasCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{hasCopied ? 'Copied Quote!' : 'Copy Citation'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Document Reading Surface */}
      <div 
        ref={textContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 relative bg-slate-950/40 select-text"
      >
        {/* State A: No Source Document Attached */}
        {!sourceDocument ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-7 h-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <h4 className="text-sm font-bold text-white font-display">No Source Document Attached</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                This study session was created manually or from quick notes. Attach the original PDF lecture notes to enable side-by-side verification.
              </p>
            </div>

            {onAttachSource && (
              <div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => uploadInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                >
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{isUploading ? 'Parsing PDF...' : 'Attach Lecture PDF'}</span>
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'canvas' && sourceDocument.pdfDataUrl ? (
          /* State B: PDF.js Canvas Rendering */
          <div className="flex flex-col items-center justify-center min-h-full">
            {isRendering && (
              <div className="py-8 flex items-center gap-2 text-xs text-indigo-300 font-mono">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Rendering vector PDF page {currentPage}...</span>
              </div>
            )}
            
            <div className="p-2 sm:p-4 rounded-2xl bg-white shadow-2xl border border-slate-700/50 max-w-full overflow-x-auto flex justify-center">
              <canvas 
                ref={canvasRef} 
                className="max-w-full h-auto rounded-lg shadow-inner"
              />
            </div>
          </div>
        ) : (
          /* State C: Structured Academic Text Reader with Keyword Highlighting */
          <div className="max-w-2xl mx-auto py-2">
            
            {renderError && (
              <div className="p-3 mb-4 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs">
                {renderError}
              </div>
            )}

            {/* Academic Paper Card View */}
            <article className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-white/[0.08] shadow-xl space-y-6">
              
              {/* Paper Header */}
              <div className="border-b border-white/[0.08] pb-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="font-bold text-indigo-300 font-display">
                  {sourceDocument.name}
                </span>
                <span>Page {currentPage} of {totalPages}</span>
              </div>

              {/* Rendered Text with Highlighting */}
              <div className="min-h-[280px]">
                {renderHighlightedContent(rawPageText)}
              </div>

              {/* Page Footer */}
              <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Lotti Coordinate Deep-Linking</span>
                <span>Ground Truth Verified</span>
              </div>

            </article>
          </div>
        )}
      </div>

      {/* Bottom Page Navigation Bar */}
      {sourceDocument && totalPages > 1 && (
        <div className="p-3 bg-slate-950/90 border-t border-white/[0.08] flex items-center justify-between select-none">
          
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handleGoToPage(currentPage - 1)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all border border-white/[0.06]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev Page</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-slate-400 font-medium">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handleGoToPage(val);
              }}
              className="w-12 text-center py-1 px-1.5 rounded-lg bg-slate-900 border border-white/[0.1] text-white font-mono text-xs outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400 font-medium">of {totalPages}</span>
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => handleGoToPage(currentPage + 1)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all border border-white/[0.06]"
          >
            <span>Next Page</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

        </div>
      )}

    </div>
  );
};
