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
import type { ConceptCheckpoint } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';

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

  const handleClearAll = () => {
    if (confirm('Clear the entire whiteboard?')) {
      setElements([]);
      pushToHistory([]);
    }
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
    setSavedNotice('Schematic Blueprint dropped onto canvas!');
    setTimeout(() => setSavedNotice(null), 2500);
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
    setSavedNotice('Visual diagram saved to this concept!');
    setTimeout(() => setSavedNotice(null), 3000);
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
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setSavedNotice('Diagram image copied to clipboard!');
        setTimeout(() => setSavedNotice(null), 2500);
      });
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  return (
    <div
      className={`rounded-3xl glass-panel border transition-all duration-300 flex flex-col overflow-hidden relative ${
        isExpanded
          ? 'fixed inset-4 sm:inset-10 z-50 bg-[#090a10]/95 backdrop-blur-2xl shadow-2xl border-purple-500/40'
          : 'border-white/[0.08] shadow-xl'
      }`}
    >
      {/* Notice Pill */}
      {savedNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-xl animate-fadeIn flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Whiteboard Header & Controls Bar */}
      <div className="p-3 sm:p-4 border-b border-white/[0.08] bg-slate-950/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Title & Dual-Coding Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Pen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-white font-display">
                Feynman Dual-Coding Canvas
              </span>
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                Paivio Theory
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Pair spatial schemas with verbal memory for up to 200% deeper consolidation.
            </p>
          </div>
        </div>

        {/* Center: Tools Selection Pills */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'pen' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
            }`}
            title="Freehand Vector Brush"
          >
            <Pen className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('arrow')}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
            }`}
            title="Causal Vector Arrow (A -> B)"
          >
            <MoveRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'rect' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
            }`}
            title="Process / Compartment Box"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'circle' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
            }`}
            title="Concept Hub / Node"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('text')}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'text' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
            }`}
            title="Text & Formula Annotation"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'eraser' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'text-slate-400 hover:text-white'
            }`}
            title="Stroke Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color Palette & Stroke Width */}
        <div className="flex items-center gap-2">
          {/* Colors */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-white/[0.08]">
            {COLOR_PALETTE.map(col => (
              <button
                key={col.hex}
                onClick={() => setCurrentColor(col.hex)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  currentColor === col.hex ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: col.hex }}
                title={col.label}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-white/[0.08] text-[11px] text-slate-400">
            {STROKE_WIDTHS.map(sw => (
              <button
                key={sw.value}
                onClick={() => setCurrentWidth(sw.value)}
                className={`px-2 py-0.5 rounded-xl font-mono ${
                  currentWidth === sw.value ? 'bg-indigo-600 text-white font-bold' : 'hover:text-white'
                }`}
              >
                {sw.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Blueprint, Undo/Redo, Save, Expand */}
        <div className="flex items-center gap-1.5">
          {/* Schematic Blueprint Dropper */}
          <button
            onClick={handleInsertBlueprint}
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Drop pre-configured visual concept skeleton onto canvas"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Schematic Blueprint</span>
          </button>

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex < 0}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-white/[0.08] transition-all"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-white/[0.08] transition-all"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Clear */}
          <button
            onClick={handleClearAll}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-white/[0.08] transition-all"
            title="Clear Canvas"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Save to Concept */}
          <button
            onClick={handleSaveDiagram}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30"
            title="Attach this visual drawing to the current concept checkpoint"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save Sketch</span>
          </button>

          {/* Copy to Clipboard */}
          <button
            onClick={handleCopyClipboard}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] transition-all"
            title="Copy Diagram to Clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Download PNG */}
          <button
            onClick={handleDownloadPNG}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] transition-all"
            title="Export PNG Diagram"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setGridPattern(prev => prev === 'dots' ? 'grid' : prev === 'grid' ? 'none' : 'dots')}
            className={`p-1.5 rounded-xl border transition-all ${
              gridPattern !== 'none' ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-900 text-slate-400 border-white/[0.08]'
            }`}
            title={`Toggle Background: ${gridPattern}`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Expand / Contract */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.08] transition-all"
            title={isExpanded ? 'Contract Whiteboard' : 'Expand Fullscreen'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

      {/* Main Drawing Surface */}
      <div 
        ref={containerRef} 
        className={`relative w-full overflow-hidden select-none cursor-crosshair ${
          isExpanded ? 'flex-1 min-h-[500px]' : 'h-[360px] sm:h-[420px]'
        }`}
        style={{
          backgroundColor: '#07090e',
          backgroundImage: 
            gridPattern === 'dots'
              ? 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px)'
              : gridPattern === 'grid'
              ? 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
              : 'none',
          backgroundSize: gridPattern === 'dots' ? '24px 24px' : gridPattern === 'grid' ? '30px 30px' : 'auto'
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
          className="w-full h-full block touch-none"
        />

        {/* Ambient watermark prompt */}
        {elements.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center p-6 text-slate-600 space-y-2">
            <Sparkles className="w-8 h-8 text-slate-700 animate-pulse" />
            <div className="text-xs font-semibold text-slate-400 font-display">
              Sketch your mental model or tap "Schematic Blueprint" to start
            </div>
            <p className="text-[11px] text-slate-600 max-w-xs leading-relaxed">
              Use arrows to show flow, boxes for functional compartments, and labels to annotate mechanisms.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info Ribbon */}
      <div className="px-4 py-2 border-t border-white/[0.06] bg-slate-950/80 text-[11px] text-slate-500 font-mono flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>Active: {activeTool.toUpperCase()}</span>
          <span>•</span>
          <span>{elements.length} elements</span>
          <span>•</span>
          <span>DPR: {typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1}x</span>
        </div>
        <span className="hidden sm:inline">Saved diagrams appear during card retrieval & review</span>
      </div>
    </div>
  );
};
