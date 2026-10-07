import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Pen, 
  MoveRight, 
  Square, 
  Circle, 
  Type, 
  Eraser, 
  Undo2, 
  Redo2, 
  Trash2, 
  Download, 
  Sparkles, 
  Save, 
  Grid, 
  Maximize2, 
  Minimize2, 
  Check,
  Copy
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConceptCheckpoint } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Button, IconButton } from '../ui/primitives';

type Tool = 'pen' | 'arrow' | 'rect' | 'circle' | 'text' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface CanvasElement {
  id: string;
  type: Tool;
  color: string;
  lineWidth: number;
  points?: Point[]; // for pen
  startX?: number; // for shapes & arrow
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
}

interface DualCodingWhiteboardProps {
  concept: ConceptCheckpoint;
  onSaveDiagram?: (dataUrl: string) => void;
  isExpandedInitial?: boolean;
}

const COLOR_PALETTE = [
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Rose', hex: '#f43f5e' },
  { label: 'Sky', hex: '#38bdf8' },
  { label: 'White', hex: '#f8fafc' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
];

export const DualCodingWhiteboard: React.FC<DualCodingWhiteboardProps> = ({
  concept,
  onSaveDiagram,
  isExpandedInitial = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#6366f1');
  const [currentWidth, setCurrentWidth] = useState<number>(3);
  const [gridPattern, setGridPattern] = useState<'dots' | 'grid' | 'none'>('dots');
  const [isExpanded, setIsExpanded] = useState<boolean>(isExpandedInitial);

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const showNotice = useCallback((text: string) => {
    clearTimeout(noticeTimer.current);
    setSavedNotice(text);
    noticeTimer.current = setTimeout(() => setSavedNotice(null), 2800);
  }, []);

  // Load existing saved diagram if present
  // Load existing saved diagram if present (from IndexedDB or localStorage)
  useEffect(() => {
    let isMounted = true;
    StorageService.loadConceptDiagramAsync(concept.id).then((existing) => {
      if (!isMounted || !existing || !canvasRef.current) return;
      const img = new Image();
      img.onload = () => {
        if (!isMounted) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      };
      img.src = existing;
    });
    return () => {
      isMounted = false;
    };
  }, [concept.id]);

  // Push new state to undo/redo history
  const pushToHistory = useCallback((newElements: CanvasElement[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newElements];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Redraw all canvas elements
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    elements.forEach(elem => {
      ctx.save();
      ctx.strokeStyle = elem.color;
      ctx.fillStyle = elem.color;
      ctx.lineWidth = elem.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (elem.type === 'pen' && elem.points && elem.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x, elem.points[0].y);
        for (let i = 1; i < elem.points.length; i++) {
          ctx.lineTo(elem.points[i].x, elem.points[i].y);
        }
        ctx.stroke();
      } else if (elem.type === 'arrow' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        // Draw vector line
        ctx.beginPath();
        ctx.moveTo(elem.startX, elem.startY);
        ctx.lineTo(elem.endX, elem.endY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(elem.endY - elem.startY, elem.endX - elem.startX);
        const headLength = 12 + elem.lineWidth;
        ctx.beginPath();
        ctx.moveTo(elem.endX, elem.endY);
        ctx.lineTo(
          elem.endX - headLength * Math.cos(angle - Math.PI / 6),
          elem.endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          elem.endX - headLength * Math.cos(angle + Math.PI / 6),
          elem.endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (elem.type === 'rect' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        const x = Math.min(elem.startX, elem.endX);
        const y = Math.min(elem.startY, elem.endY);
        const w = Math.abs(elem.endX - elem.startX);
        const h = Math.abs(elem.endY - elem.startY);

        ctx.fillStyle = elem.color + '15'; // 10% opacity fill
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.stroke();
      } else if (elem.type === 'circle' && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        const rx = Math.abs(elem.endX - elem.startX) / 2;
        const ry = Math.abs(elem.endY - elem.startY) / 2;
        const cx = Math.min(elem.startX, elem.endX) + rx;
        const cy = Math.min(elem.startY, elem.endY) + ry;

        ctx.fillStyle = elem.color + '15';
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(4, rx), Math.max(4, ry), 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (elem.type === 'text' && elem.text && elem.startX !== undefined && elem.startY !== undefined) {
        ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(elem.text, elem.startX, elem.startY);
      }

      ctx.restore();
    });
  }, [elements]);

  // Adjust canvas size to parent container with devicePixelRatio
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas, isExpanded]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Helper to extract canvas coordinates from touch or mouse event
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  // Mouse / Touch Event Listeners
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCoordinates(e);

    if (activeTool === 'text') {
      const userText = prompt('Enter concept label or note:');
      if (userText && userText.trim()) {
        const newElem: CanvasElement = {
          id: `elem-${Date.now()}`,
          type: 'text',
          color: currentColor,
          lineWidth: currentWidth,
          startX: pos.x,
          startY: pos.y,
          text: userText.trim(),
        };
        const updated = [...elements, newElem];
        setElements(updated);
        pushToHistory(updated);
      }
      return;
    }

    if (activeTool === 'eraser') {
      // Find and remove elements near clicked point
      const threshold = 18;
      const filtered = elements.filter(elem => {
        if (elem.points) {
          return !elem.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < threshold);
        }
        if (elem.startX !== undefined && elem.startY !== undefined) {
          return Math.hypot(elem.startX - pos.x, elem.startY - pos.y) >= threshold;
        }
        return true;
      });
      if (filtered.length !== elements.length) {
        setElements(filtered);
        pushToHistory(filtered);
      }
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    if (activeTool === 'pen') {
      setCurrentPoints([pos]);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getCoordinates(e);

    if (activeTool === 'pen') {
      setCurrentPoints(prev => {
        const next = [...prev, pos];
        // Live preview draw
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx && next.length > 1) {
            ctx.save();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(next[next.length - 2].x, next[next.length - 2].y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            ctx.restore();
          }
        }
        return next;
      });
    } else {
      // For shapes and arrows, redraw existing elements + dynamic preview
      redrawCanvas();
      const canvas = canvasRef.current;
      if (!canvas || !startPos) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;
      ctx.lineWidth = currentWidth;
      ctx.lineCap = 'round';
      ctx.setLineDash([4, 4]); // dashed preview

      if (activeTool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (activeTool === 'rect') {
        const x = Math.min(startPos.x, pos.x);
        const y = Math.min(startPos.y, pos.y);
        const w = Math.abs(pos.x - startPos.x);
        const h = Math.abs(pos.y - startPos.y);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.stroke();
      } else if (activeTool === 'circle') {
        const rx = Math.abs(pos.x - startPos.x) / 2;
        const ry = Math.abs(pos.y - startPos.y) / 2;
        const cx = Math.min(startPos.x, pos.x) + rx;
        const cy = Math.min(startPos.y, pos.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(4, rx), Math.max(4, ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const endPos = getCoordinates(e);

    if (activeTool === 'pen' && currentPoints.length > 1) {
      const newElem: CanvasElement = {
        id: `elem-${Date.now()}`,
        type: 'pen',
        color: currentColor,
        lineWidth: currentWidth,
        points: currentPoints,
      };
      const updated = [...elements, newElem];
      setElements(updated);
      pushToHistory(updated);
    } else if (startPos && (activeTool === 'arrow' || activeTool === 'rect' || activeTool === 'circle')) {
      const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
      if (dist > 5) {
        const newElem: CanvasElement = {
          id: `elem-${Date.now()}`,
          type: activeTool,
          color: currentColor,
          lineWidth: currentWidth,
          startX: startPos.x,
          startY: startPos.y,
          endX: endPos.x,
          endY: endPos.y,
        };
        const updated = [...elements, newElem];
        setElements(updated);
        pushToHistory(updated);
      }
    }

    setCurrentPoints([]);
    setStartPos(null);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setElements(history[nextIdx] || []);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setElements([]);
    }
  };

  const handleRedo = () => {
    if (historyIndex + 1 < history.length) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setElements(history[nextIdx] || []);
    }
  };

  // Clearing is undoable, so it does not ask first.
  const handleClearAll = () => {
    if (elements.length === 0) return;
    setElements([]);
    pushToHistory([]);
    showNotice('Cleared. Undo brings it back.');
  };

  // Insert AI / Concept Schematic Blueprint
  const handleInsertBlueprint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const centerX = w / 2;
    const centerY = h / 2;

    const keyTerms = concept.keyTerms.slice(0, 3);
    const blueprintElements: CanvasElement[] = [];

    // Central Concept Container
    blueprintElements.push({
      id: `bp-root-box-${Date.now()}`,
      type: 'rect',
      color: '#6366f1',
      lineWidth: 3,
      startX: centerX - 110,
      startY: centerY - 45,
      endX: centerX + 110,
      endY: centerY + 45,
    });

    blueprintElements.push({
      id: `bp-root-text-${Date.now()}`,
      type: 'text',
      color: '#ffffff',
      lineWidth: 2,
      startX: centerX - 90,
      startY: centerY + 5,
      text: concept.title.length > 20 ? concept.title.slice(0, 20) + '...' : concept.title,
    });

    // Peripheral Satellite Terms with Arrows
    keyTerms.forEach((kt, idx) => {
      const angle = (idx / keyTerms.length) * 2 * Math.PI - Math.PI / 2;
      const targetX = centerX + Math.cos(angle) * 160;
      const targetY = centerY + Math.sin(angle) * 110;

      // Directed Arrow from center to term
      blueprintElements.push({
        id: `bp-arrow-${idx}-${Date.now()}`,
        type: 'arrow',
        color: idx % 2 === 0 ? '#10b981' : '#f59e0b',
        lineWidth: 2,
        startX: centerX + Math.cos(angle) * 80,
        startY: centerY + Math.sin(angle) * 45,
        endX: targetX - Math.cos(angle) * 30,
        endY: targetY - Math.sin(angle) * 20,
      });

      // Term node box
      blueprintElements.push({
        id: `bp-term-box-${idx}-${Date.now()}`,
        type: 'rect',
        color: idx % 2 === 0 ? '#10b981' : '#f59e0b',
        lineWidth: 2,
        startX: targetX - 65,
        startY: targetY - 25,
        endX: targetX + 65,
        endY: targetY + 25,
      });

      blueprintElements.push({
        id: `bp-term-text-${idx}-${Date.now()}`,
        type: 'text',
        color: '#f8fafc',
        lineWidth: 2,
        startX: targetX - 55,
        startY: targetY + 4,
        text: kt.term.length > 15 ? kt.term.slice(0, 15) + '...' : kt.term,
      });
    });

    const merged = [...elements, ...blueprintElements];
    setElements(merged);
    pushToHistory(merged);
    soundEngine.playSocraticChallengeChime();
    showNotice('Template added. Draw over it or move on.');
  };

  // Save Diagram to Concept
  const handleSaveDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    StorageService.saveConceptDiagram(concept.id, dataUrl);
    if (onSaveDiagram) {
      onSaveDiagram(dataUrl);
    }
    soundEngine.playCompletionChime();
    showNotice('Sketch saved. It will show up when you review this concept.');
  };

  // Export Diagram as PNG File
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `studify-diagram-${concept.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy Image to Clipboard
  const handleCopyClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showNotice('Sketch copied as an image.');
      } catch (err) {
        console.warn('Clipboard write failed:', err);
        showNotice('Could not copy. Use Download instead.');
      }
    });
  };

  const toolButton = (tool: Tool, Icon: LucideIcon, label: string) => (
    <button
      key={tool}
      type="button"
      onClick={() => setActiveTool(tool)}
      aria-pressed={activeTool === tool}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer',
        activeTool === tool ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-surface-solid',
        isExpanded ? 'fixed inset-3 z-50 border-line-strong shadow-2xl sm:inset-8' : 'border-line',
      )}
    >
      {savedNotice && (
        <div
          role="status"
          className="absolute left-1/2 top-16 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-strong bg-surface-solid px-3.5 py-1.5 text-xs font-medium text-ink shadow-lg animate-fadeIn"
        >
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          {savedNotice}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <div className="mr-auto flex min-w-0 items-center gap-2 pl-1">
          <Pen className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <span className="truncate text-[13px] font-medium text-ink">Sketch</span>
          <span className="hidden truncate text-xs text-ink-subtle md:inline">Boxes, arrows and labels help it stick.</span>
        </div>

        <div className="flex items-center gap-0.5 rounded-xl border border-line bg-canvas p-0.5" role="group" aria-label="Drawing tools">
          {toolButton('pen', Pen, 'Pen')}
          {toolButton('arrow', MoveRight, 'Arrow')}
          {toolButton('rect', Square, 'Box')}
          {toolButton('circle', Circle, 'Circle')}
          {toolButton('text', Type, 'Text')}
          {toolButton('eraser', Eraser, 'Eraser')}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-canvas px-2 py-1.5" role="group" aria-label="Colour">
          {COLOR_PALETTE.map(col => (
            <button
              key={col.hex}
              type="button"
              onClick={() => setCurrentColor(col.hex)}
              aria-pressed={currentColor === col.hex}
              aria-label={col.label}
              title={col.label}
              className={cn(
                'h-4 w-4 rounded-full transition-transform cursor-pointer',
                currentColor === col.hex ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'hover:scale-110',
              )}
              style={{ backgroundColor: col.hex }}
            />
          ))}
        </div>

        <div className="hidden items-center gap-0.5 rounded-xl border border-line bg-canvas p-0.5 lg:flex" role="group" aria-label="Line width">
          {STROKE_WIDTHS.map(sw => (
            <button
              key={sw.value}
              type="button"
              onClick={() => setCurrentWidth(sw.value)}
              aria-pressed={currentWidth === sw.value}
              className={cn(
                'h-8 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer',
                currentWidth === sw.value ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink',
              )}
            >
              {sw.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={historyIndex < 0} className="disabled:opacity-40" />
          <IconButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="disabled:opacity-40" />
          <IconButton icon={Trash2} label="Clear" onClick={handleClearAll} disabled={elements.length === 0} className="disabled:opacity-40" />
          <IconButton icon={Copy} label="Copy as image" onClick={handleCopyClipboard} />
          <IconButton icon={Download} label="Download PNG" onClick={handleDownloadPNG} />
          <IconButton
            icon={Grid}
            label={gridPattern === 'dots' ? 'Background: dots' : gridPattern === 'grid' ? 'Background: grid' : 'Background: plain'}
            onClick={() => setGridPattern(prev => (prev === 'dots' ? 'grid' : prev === 'grid' ? 'none' : 'dots'))}
          />
          <IconButton
            icon={isExpanded ? Minimize2 : Maximize2}
            label={isExpanded ? 'Exit full screen' : 'Full screen'}
            onClick={() => setIsExpanded(!isExpanded)}
          />
        </div>
      </div>

      {/* Drawing surface: a dark board in both themes, so the pen colours always read. */}
      <div
        ref={containerRef}
        className={cn('relative w-full select-none overflow-hidden cursor-crosshair', isExpanded ? 'min-h-[400px] flex-1' : 'h-[360px] sm:h-[420px]')}
        style={{
          backgroundColor: '#0b0c11',
          backgroundImage:
            gridPattern === 'dots'
              ? 'radial-gradient(circle, rgba(255, 255, 255, 0.11) 1px, transparent 1px)'
              : gridPattern === 'grid'
                ? 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
                : 'none',
          backgroundSize: gridPattern === 'dots' ? '24px 24px' : gridPattern === 'grid' ? '30px 30px' : 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="block h-full w-full touch-none"
          aria-label={`Sketch area for ${concept.title}`}
        />

        {elements.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-[13px] font-medium text-slate-300">Draw how the idea works</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Use arrows for cause and effect, boxes for parts, and text for labels. Or start from a template.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5">
        <span className="pl-1 text-xs tabular-nums text-ink-subtle">
          {elements.length} {elements.length === 1 ? 'shape' : 'shapes'}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={Sparkles} onClick={handleInsertBlueprint}>
            Start from a template
          </Button>
          <Button size="sm" variant="primary" icon={Save} onClick={handleSaveDiagram} disabled={elements.length === 0}>
            Save sketch
          </Button>
        </div>
      </div>
    </div>
  );
};
