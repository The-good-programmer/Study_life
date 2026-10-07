import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Eye, Check } from 'lucide-react';
import type { OcclusionMask, RetrievalCard, StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Button, IconButton } from '../ui/primitives';

interface ImageOcclusionStudioProps {
  /** Called with the deck it just saved, so the caller can open that deck. */
  onCardsGenerated: (cards: RetrievalCard[], deckTitle: string | undefined, deck: StudySession) => void;
  onClose?: () => void;
}

// Built-in offline SVG samples for instant zero-friction testing
const SAMPLE_DIAGRAMS: {
  id: string;
  title: string;
  category: string;
  description: string;
  svgDataUrl: string;
  defaultMasks: OcclusionMask[];
}[] = [
  {
    id: 'heart-anatomy',
    title: 'Cardiovascular: Human Heart Anatomy',
    category: 'Anatomy & Physiology',
    description: 'Internal chamber structures, coronary outflow tracts, and cardiac valves.',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#090d1a;">
        <defs>
          <radialGradient id="heartGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#e11d48" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#881337" stop-opacity="0.95"/>
          </radialGradient>
          <linearGradient id="aortaGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fb7185"/>
            <stop offset="100%" stop-color="#e11d48"/>
          </linearGradient>
          <linearGradient id="cavaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
        </defs>
        
        <!-- Superior Vena Cava -->
        <path d="M 280 80 L 280 230 Q 280 260 300 270 L 320 270 L 320 80 Z" fill="url(#cavaGrad)" stroke="#7dd3fc" stroke-width="2"/>
        
        <!-- Aorta Arch -->
        <path d="M 360 220 Q 360 80 430 80 Q 510 80 500 220" fill="none" stroke="url(#aortaGrad)" stroke-width="48" stroke-linecap="round"/>
        <path d="M 400 80 L 400 35 M 435 80 L 440 35 M 470 85 L 485 40" stroke="#f43f5e" stroke-width="12" stroke-linecap="round"/>
        
        <!-- Pulmonary Artery Trunk -->
        <path d="M 440 210 Q 400 170 330 170 Q 290 170 240 180" fill="none" stroke="#0ea5e9" stroke-width="32" stroke-linecap="round"/>

        <!-- Main Heart Body -->
        <path d="M 400 220 C 330 170, 240 220, 250 340 C 260 450, 400 520, 400 550 C 400 520, 540 450, 550 340 C 560 220, 470 170, 400 220 Z" fill="url(#heartGrad)" stroke="#fda4af" stroke-width="3" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.5))"/>
        
        <!-- Internal Septum and Valves representation -->
        <path d="M 400 300 L 400 510" stroke="#f43f5e" stroke-width="6" stroke-dasharray="8 6"/>
        
        <!-- Anatomical Labels -->
        <text x="140" y="90" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">Superior Vena Cava</text>
        <line x1="240" y1="90" x2="280" y2="120" stroke="#38bdf8" stroke-width="2"/>
        
        <text x="540" y="70" fill="#fb7185" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">Aortic Arch</text>
        <line x1="535" y1="75" x2="480" y2="95" stroke="#fb7185" stroke-width="2"/>
        
        <text x="120" y="200" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">Pulmonary Trunk</text>
        <line x1="225" y1="198" x2="290" y2="185" stroke="#38bdf8" stroke-width="2"/>

        <text x="130" y="360" fill="#fecdd3" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">Right Ventricle</text>
        <line x1="230" y1="360" x2="330" y2="400" stroke="#fecdd3" stroke-width="2"/>

        <text x="560" y="370" fill="#fecdd3" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">Left Ventricle</text>
        <line x1="555" y1="370" x2="470" y2="410" stroke="#fecdd3" stroke-width="2"/>
      </svg>
    `)}`,
    defaultMasks: [
      { id: 'm-1', x: 13, y: 11, width: 23, height: 6, label: 'Superior Vena Cava', hint: 'Brings deoxygenated blood to right atrium' },
      { id: 'm-2', x: 65, y: 8, width: 17, height: 6, label: 'Aortic Arch', hint: 'High-pressure systemic outflow tract' },
      { id: 'm-3', x: 11, y: 30, width: 21, height: 6, label: 'Pulmonary Trunk', hint: 'Carries deoxygenated blood to the lungs' },
      { id: 'm-4', x: 12, y: 57, width: 18, height: 6, label: 'Right Ventricle', hint: 'Pumps blood into the low-pressure pulmonary circuit' },
      { id: 'm-5', x: 68, y: 58, width: 18, height: 6, label: 'Left Ventricle', hint: 'Thick muscular wall driving systemic circulation' }
    ]
  },
  {
    id: 'synapse-anatomy',
    title: 'Neurobiology: Chemical Synapse Dynamics',
    category: 'Neuroscience',
    description: 'Presynaptic terminal, vesicular fusion, neurotransmitter receptor gates.',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#090d1a;">
        <!-- Presynaptic Bulb -->
        <path d="M 200 50 L 600 50 L 600 240 Q 600 320 400 320 Q 200 320 200 240 Z" fill="#312e81" stroke="#818cf8" stroke-width="3"/>
        
        <!-- Postsynaptic Density -->
        <path d="M 150 420 Q 400 400 650 420 L 650 550 L 150 550 Z" fill="#1e1b4b" stroke="#a5b4fc" stroke-width="3"/>
        
        <!-- Vesicles -->
        <circle cx="300" cy="180" r="22" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
        <circle cx="370" cy="200" r="24" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
        <circle cx="450" cy="170" r="20" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
        <circle cx="410" cy="260" r="18" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
        
        <!-- Voltage Gated Ca Channel -->
        <rect x="200" y="200" width="22" height="40" rx="6" fill="#fbbf24" stroke="#fef3c7" stroke-width="2"/>
        
        <!-- Receptors on Postsynaptic -->
        <rect x="280" y="405" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
        <rect x="390" y="402" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
        <rect x="500" y="408" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>

        <!-- Labels -->
        <text x="320" y="90" fill="#c7d2fe" font-family="system-ui, sans-serif" font-size="17" font-weight="bold">Presynaptic Terminal</text>
        
        <text x="50" y="215" fill="#fde68a" font-family="system-ui, sans-serif" font-size="15" font-weight="bold">Voltage-Gated Ca2+ Channel</text>
        <line x1="220" y1="215" x2="200" y2="215" stroke="#fde68a" stroke-width="2"/>

        <text x="510" y="180" fill="#f3e8ff" font-family="system-ui, sans-serif" font-size="15" font-weight="bold">Synaptic Vesicles</text>
        <line x1="505" y1="180" x2="470" y2="180" stroke="#f3e8ff" stroke-width="2"/>

        <text x="50" y="370" fill="#a5b4fc" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">Synaptic Cleft (20nm)</text>
        <line x1="215" y1="365" x2="350" y2="365" stroke="#a5b4fc" stroke-width="2"/>

        <text x="550" y="470" fill="#a7f3d0" font-family="system-ui, sans-serif" font-size="15" font-weight="bold">Neurotransmitter Receptors</text>
        <line x1="545" y1="465" x2="515" y2="425" stroke="#a7f3d0" stroke-width="2"/>
      </svg>
    `)}`,
    defaultMasks: [
      { id: 'm-s1', x: 3, y: 32, width: 28, height: 6, label: 'Voltage-Gated Ca2+ Channel', hint: 'Triggers SNARE-mediated exocytosis upon action potential arrival' },
      { id: 'm-s2', x: 62, y: 26, width: 20, height: 6, label: 'Synaptic Vesicles', hint: 'Store acetylcholine, glutamate, or GABA' },
      { id: 'm-s3', x: 4, y: 58, width: 25, height: 6, label: 'Synaptic Cleft', hint: 'The 20nm extracellular diffusion barrier' },
      { id: 'm-s4', x: 67, y: 74, width: 30, height: 6, label: 'Neurotransmitter Receptors', hint: 'Ligand-gated ion channels mediating postsynaptic potentials' }
    ]
  }
];

async function optimizeImageForOcclusion(dataUrl: string, maxDimension = 1400): Promise<string> {
  if (dataUrl.startsWith('data:image/svg')) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width <= maxDimension && height <= maxDimension && dataUrl.length < 400_000) {
        resolve(dataUrl);
        return;
      }

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const ImageOcclusionStudio: React.FC<ImageOcclusionStudioProps> = ({ 
  onCardsGenerated, 
  onClose 
}) => {
  const [imageSrc, setImageSrc] = useState<string>(SAMPLE_DIAGRAMS[0].svgDataUrl);
  const [deckTitle, setDeckTitle] = useState<string>(SAMPLE_DIAGRAMS[0].title);
  const [deckCategory, setDeckCategory] = useState<string>(SAMPLE_DIAGRAMS[0].category);
  const [masks, setMasks] = useState<OcclusionMask[]>(SAMPLE_DIAGRAMS[0].defaultMasks);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(SAMPLE_DIAGRAMS[0].defaultMasks[0]?.id || null);
  const [occlusionMode, setOcclusionMode] = useState<'hide-all-reveal-one' | 'hide-one-reveal-one'>('hide-all-reveal-one');
  const [isPreviewActive, setIsPreviewActive] = useState<boolean>(false);
  const [previewRevealed, setPreviewRevealed] = useState<boolean>(false);

  // Drag-to-draw state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMask = masks.find(m => m.id === selectedMaskId) || null;

  // Handle image upload from file system
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const optimized = await optimizeImageForOcclusion(result);
      setImageSrc(optimized);
      setDeckTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      setMasks([]);
      setSelectedMaskId(null);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Paste image from clipboard support (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const res = event.target?.result as string;
              const optimized = await optimizeImageForOcclusion(res);
              setImageSrc(optimized);
              setDeckTitle('Pasted Diagram Occlusion');
              setMasks([]);
              setSelectedMaskId(null);
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Compute percentage coordinates relative to container
  const getRelativeCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  // Mouse drag handlers for mask drawing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewActive) return;
    // If clicked directly on an existing mask, select it instead of drawing
    const target = e.target as HTMLElement;
    if (target.dataset.maskId) {
      setSelectedMaskId(target.dataset.maskId);
      return;
    }

    const coords = getRelativeCoords(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const coords = getRelativeCoords(e);
    setDrawCurrent(coords);
  };

  const handlePointerUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }

    const minX = Math.min(drawStart.x, drawCurrent.x);
    const minY = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size threshold to prevent accidental clicks creating tiny masks
    if (width > 2 && height > 2) {
      const newMask: OcclusionMask = {
        id: `mask-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        x: Math.round(minX * 10) / 10,
        y: Math.round(minY * 10) / 10,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        label: '',
      };

      setMasks(prev => [...prev, newMask]);
      setSelectedMaskId(newMask.id);
      soundEngine.playCorrectChime();
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  // Delete selected mask
  const handleDeleteMask = (id: string) => {
    setMasks(prev => prev.filter(m => m.id !== id));
    if (selectedMaskId === id) setSelectedMaskId(null);
  };

  // Update selected mask label or hint
  const handleUpdateMask = (updates: Partial<OcclusionMask>) => {
    if (!selectedMaskId) return;
    setMasks(prev => prev.map(m => m.id === selectedMaskId ? { ...m, ...updates } : m));
  };

  // Load a curated sample diagram
  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_DIAGRAMS.find(s => s.id === sampleId);
    if (!sample) return;
    setImageSrc(sample.svgDataUrl);
    setDeckTitle(sample.title);
    setDeckCategory(sample.category);
    setMasks(sample.defaultMasks);
    setSelectedMaskId(sample.defaultMasks[0]?.id || null);
    setIsPreviewActive(false);
    soundEngine.playSocraticChallengeChime();
  };

  // Generate individual retrieval cards from masks
  const handleGenerateCards = () => {
    if (masks.length === 0) return;

    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const conceptId = `concept-io-${stamp}`;
    const cards: RetrievalCard[] = masks.map((mask, idx) => ({
      id: `ioc-${stamp}-${idx + 1}`,
      conceptId,
      cardType: 'image-occlusion',
      question: `Name the covered part of ${deckTitle || 'the diagram'}.`,
      answer: mask.label?.trim() || `Part ${idx + 1}`,
      hint: mask.hint?.trim() || undefined,
      imageUrl: imageSrc,
      occlusionMode,
      masks,
      activeMaskId: mask.id,
      stability: 1.5,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
    }));

    // Save as a permanent session
    const newSession: StudySession = {
      id: `session-io-${stamp}`,
      title: deckTitle.trim() || 'Diagram cards',
      category: deckCategory.trim() || 'Diagrams',
      description: `${masks.length} ${masks.length === 1 ? 'label' : 'labels'} to name on a diagram.`,
      concepts: [
        {
          id: conceptId,
          order: 1,
          title: deckTitle.trim() || 'Diagram',
          estimatedMinutes: Math.max(5, masks.length * 2),
          mentalModel: '',
          coreTakeaways: [],
          keyTerms: masks.filter(m => m.label?.trim()).map(m => ({ term: m.label!.trim(), definition: m.hint?.trim() || '' })),
          feynmanPrompt: `Explain what each labelled part of ${deckTitle || 'this diagram'} does, and how the parts connect.`,
          sampleMasteryExplanation: '',
          retrievalCards: cards,
        }
      ],
      currentConceptIndex: 0,
      currentPhase: 'retrieval',
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
    };

    StorageService.saveSession(newSession);
    soundEngine.playCompletionChime();
    onCardsGenerated(cards, deckTitle, newSession);
  };

  const unnamedCount = masks.filter(m => !m.label?.trim()).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Source image and details */}
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-medium text-ink">Deck name</span>
            <input
              type="text"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder="e.g. Parts of the heart"
              className="mt-1.5 h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-ink">Category</span>
            <input
              type="text"
              value={deckCategory}
              onChange={(e) => setDeckCategory(e.target.value)}
              placeholder="e.g. Anatomy"
              className="mt-1.5 h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" />
          <Button icon={Upload} onClick={() => fileInputRef.current?.click()}>
            Upload an image
          </Button>
          <span className="hidden text-xs text-ink-subtle sm:inline">
            or paste one with <kbd className="rounded border border-line bg-surface-hover px-1 font-mono text-[10.5px]">Ctrl+V</kbd>
          </span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-subtle">
          Try a sample:
          {SAMPLE_DIAGRAMS.map(sample => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleLoadSample(sample.id)}
              className="inline-flex h-7 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
            >
              {sample.id === 'heart-anatomy' ? 'The heart' : 'A synapse'}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-line bg-canvas p-1" role="radiogroup" aria-label="What to hide while studying">
          {([
            { value: 'hide-all-reveal-one', label: 'Hide all labels', title: 'Every label is covered; you name one at a time.' },
            { value: 'hide-one-reveal-one', label: 'Hide one label', title: 'Only the label you are asked about is covered.' },
          ] as const).map(option => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={occlusionMode === option.value}
              title={option.title}
              onClick={() => setOcclusionMode(option.value)}
              className={cn(
                'h-8 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
                occlusionMode === option.value ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        {/* Canvas */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink-subtle">
              {isPreviewActive ? 'Preview: click the highlighted box to check your answer.' : 'Drag across the image to cover a label.'}
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={isPreviewActive ? 'secondary' : 'ghost'}
                icon={Eye}
                aria-pressed={isPreviewActive}
                onClick={() => {
                  setIsPreviewActive(!isPreviewActive);
                  setPreviewRevealed(false);
                }}
                disabled={masks.length === 0}
              >
                {isPreviewActive ? 'Stop preview' : 'Preview'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMasks([])} disabled={masks.length === 0}>
                Clear all
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-canvas p-2">
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                'relative flex min-h-[320px] w-full touch-none select-none items-center justify-center overflow-hidden rounded-xl bg-[#0b0c11]',
                isPreviewActive ? 'cursor-default' : 'cursor-crosshair',
              )}
            >
              <img src={imageSrc} alt={deckTitle || 'Diagram'} className="pointer-events-none h-auto max-h-[560px] w-full object-contain" />

              {masks.map((mask, idx) => {
                const isSelected = mask.id === selectedMaskId;
                const box = { left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.width}%`, height: `${mask.height}%` };

                if (isPreviewActive) {
                  if (occlusionMode === 'hide-one-reveal-one' && !isSelected) return null;
                  if (isSelected) {
                    return (
                      <button
                        key={mask.id}
                        type="button"
                        onClick={() => setPreviewRevealed(!previewRevealed)}
                        className={cn(
                          'absolute flex items-center justify-center rounded-md border-2 p-1 text-[11px] font-semibold transition-colors cursor-pointer',
                          previewRevealed ? 'border-success bg-success-soft text-ink backdrop-blur' : 'border-gold bg-gold-soft text-ink backdrop-blur',
                        )}
                        style={box}
                      >
                        <span className="truncate px-1">{previewRevealed ? mask.label : '?'}</span>
                      </button>
                    );
                  }
                  return <div key={mask.id} className="absolute rounded-md border border-line-strong bg-surface-solid" style={box} />;
                }

                return (
                  <div
                    key={mask.id}
                    data-mask-id={mask.id}
                    className={cn(
                      'absolute flex items-center rounded-md p-1 transition-colors cursor-pointer',
                      isSelected ? 'z-20 border-2 border-white bg-brand text-brand-ink shadow-lg' : 'z-10 border border-brand/70 bg-brand/80 text-brand-ink hover:bg-brand',
                    )}
                    style={box}
                  >
                    <span className="pointer-events-none select-none truncate px-1 text-[11px] font-semibold">
                      {idx + 1}. {mask.label || 'Unnamed'}
                    </span>
                  </div>
                );
              })}

              {isDrawing && drawStart && drawCurrent && (
                <div
                  className="pointer-events-none absolute z-30 rounded-md border-2 border-dashed border-white bg-brand/30"
                  style={{
                    left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                    top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                    width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                    height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                  }}
                />
              )}
            </div>
          </div>
        </section>

        {/* Labels */}
        <aside className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Hidden labels</h3>
            <span className="text-xs tabular-nums text-ink-subtle">{masks.length}</span>
          </div>

          {activeMask ? (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink">Label {masks.findIndex(m => m.id === activeMask.id) + 1}</span>
                <IconButton icon={Trash2} label="Delete this label" onClick={() => handleDeleteMask(activeMask.id)} className="-mr-1.5 hover:text-danger" />
              </div>
              <label className="block">
                <span className="text-xs text-ink-subtle">The covered word (the answer)</span>
                <input
                  type="text"
                  value={activeMask.label || ''}
                  onChange={(e) => handleUpdateMask({ label: e.target.value })}
                  placeholder="e.g. Left ventricle"
                  className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-subtle">Hint (optional)</span>
                <input
                  type="text"
                  value={activeMask.hint || ''}
                  onChange={(e) => handleUpdateMask({ hint: e.target.value })}
                  placeholder="e.g. Pumps blood to the body"
                  className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
                />
              </label>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-subtle">
              Drag across the image to cover a label, or select one below.
            </p>
          )}

          {masks.length > 0 && (
            <ul className="max-h-[260px] space-y-1 overflow-y-auto">
              {masks.map((m, idx) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedMaskId(m.id)}
                    aria-pressed={m.id === selectedMaskId}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-colors cursor-pointer',
                      m.id === selectedMaskId ? 'bg-brand-soft text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                    )}
                  >
                    <span className="w-5 shrink-0 text-xs tabular-nums text-ink-subtle">{idx + 1}</span>
                    <span className={cn('truncate', !m.label && 'italic text-ink-subtle')}>{m.label || 'Unnamed'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {unnamedCount > 0 && (
          <p className="mr-auto text-[13px] text-danger" role="status">
            Name {unnamedCount === 1 ? 'the unnamed label' : `the ${unnamedCount} unnamed labels`} first.
          </p>
        )}
        {onClose && <Button onClick={onClose}>Cancel</Button>}
        <Button variant="primary" icon={Check} onClick={handleGenerateCards} disabled={masks.length === 0 || unnamedCount > 0}>
          {masks.length > 0 ? `Make ${masks.length} ${masks.length === 1 ? 'card' : 'cards'}` : 'Make cards'}
        </Button>
      </div>
    </div>
  );
};
