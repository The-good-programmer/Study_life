import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  Eye, 
  Check, 
  Layers, 
  Tag,
  Info
} from 'lucide-react';
import type { OcclusionMask, RetrievalCard, StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';

interface ImageOcclusionStudioProps {
  onCardsGenerated: (cards: RetrievalCard[], deckTitle?: string) => void;
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
  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  // Mouse drag handlers for mask drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPreviewActive) return;
    // If clicked directly on an existing mask, select it instead of drawing
    const target = e.target as HTMLElement;
    if (target.dataset.maskId) {
      setSelectedMaskId(target.dataset.maskId);
      return;
    }

    const coords = getRelativeCoords(e);
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const coords = getRelativeCoords(e);
    setDrawCurrent(coords);
  };

  const handleMouseUp = () => {
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
        label: `Label ${masks.length + 1}`,
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

    const cards: RetrievalCard[] = masks.map((mask, idx) => ({
      id: `ioc-${Date.now()}-${idx + 1}`,
      conceptId: `concept-io-${Date.now()}`,
      cardType: 'image-occlusion',
      question: `Identify the highlighted structure in ${deckTitle}:`,
      answer: mask.label || `Structure #${idx + 1}`,
      hint: mask.hint || 'Carefully examine the spatial connections on the diagram.',
      explanation: `Occluded visual target: ${mask.label || 'Structure'} (${occlusionMode === 'hide-all-reveal-one' ? 'Hide All' : 'Hide One'} mode).`,
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
      id: `session-io-${Date.now()}`,
      title: deckTitle || 'Image Occlusion Deck',
      category: deckCategory || 'Visual Sciences',
      description: `Interactive anatomical & technical occlusion cards with ${masks.length} masked checkpoints.`,
      concepts: [
        {
          id: `concept-io-${Date.now()}`,
          order: 1,
          title: deckTitle || 'Diagram Architecture',
          estimatedMinutes: Math.max(5, masks.length * 2),
          mentalModel: 'Spatial vector occlusion: recall functional structures in visual context.',
          coreTakeaways: masks.map(m => m.label || 'Target Structure'),
          keyTerms: masks.map(m => ({ term: m.label || 'Structure', definition: m.hint || 'Anatomical location' })),
          feynmanPrompt: 'Explain the anatomical outflow and clinical significance of this system.',
          sampleMasteryExplanation: 'The anatomical landmarks govern physiological flow through distinct pathways.',
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
    onCardsGenerated(cards, deckTitle);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 animate-fadeIn">
      
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
              Image Occlusion Card Architect
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono uppercase font-bold">
              Visual Recall
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Upload anatomical, histology, or engineering diagrams. Draw mask rectangles to test visual memory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/[0.08] text-xs font-semibold transition-all"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleGenerateCards}
            disabled={masks.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Generate {masks.length} Occlusion Cards</span>
          </button>
        </div>
      </div>

      {/* Top Controls & Sample Pickers */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Diagram</span>
            </button>

            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              or press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300">Ctrl+V</kbd> to paste
            </span>
          </div>

          {/* Sample Loaders */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider font-display">
              Load Sample:
            </span>
            {SAMPLE_DIAGRAMS.map(sample => (
              <button
                key={sample.id}
                onClick={() => handleLoadSample(sample.id)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition-all"
              >
                {sample.id === 'heart-anatomy' ? 'Heart Anatomy' : 'Synapse Dynamics'}
              </button>
            ))}
          </div>
        </div>

        {/* Deck Title and Strategy Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
          <div>
            <label className="text-[11px] font-bold text-slate-300 font-display block mb-1">
              Deck / Diagram Title
            </label>
            <input
              type="text"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder="e.g. Cranial Nerves Anatomy"
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 font-display block mb-1">
              Subject Discipline
            </label>
            <input
              type="text"
              value={deckCategory}
              onChange={(e) => setDeckCategory(e.target.value)}
              placeholder="e.g. Human Anatomy"
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 font-display block mb-1">
              Occlusion Masking Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setOcclusionMode('hide-all-reveal-one')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all border text-center ${
                  occlusionMode === 'hide-all-reveal-one'
                    ? 'bg-purple-600 text-white border-purple-400 shadow'
                    : 'bg-slate-900 text-slate-400 border-white/[0.08] hover:text-white'
                }`}
                title="All masks are hidden; only target mask is asked."
              >
                Hide All, Reveal 1
              </button>
              <button
                type="button"
                onClick={() => setOcclusionMode('hide-one-reveal-one')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all border text-center ${
                  occlusionMode === 'hide-one-reveal-one'
                    ? 'bg-purple-600 text-white border-purple-400 shadow'
                    : 'bg-slate-900 text-slate-400 border-white/[0.08] hover:text-white'
                }`}
                title="Only target mask is hidden; surrounding labels stay visible."
              >
                Hide 1, Reveal 1
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Work Area: Image Canvas & Mask Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Interactive Diagram Canvas */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 font-bold uppercase tracking-wider font-display flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Canvas ({masks.length} Occlusion Masks)</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsPreviewActive(!isPreviewActive);
                  setPreviewRevealed(false);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isPreviewActive 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-300 border-white/[0.08] hover:border-white/[0.2]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isPreviewActive ? 'Exit Preview' : 'Interactive Preview'}</span>
              </button>

              <button
                onClick={() => setMasks([])}
                disabled={masks.length === 0}
                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-white/[0.08] text-xs font-medium transition-all disabled:opacity-40"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Canvas Box */}
          <div className="p-3 rounded-3xl glass-panel relative overflow-hidden select-none border border-white/[0.12] shadow-2xl">
            <div 
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center ${
                isPreviewActive ? 'cursor-default' : 'cursor-crosshair'
              }`}
              style={{ minHeight: '380px' }}
            >
              {/* The Underlying Anatomical Diagram */}
              <img 
                src={imageSrc} 
                alt="Occlusion Base Diagram" 
                className="w-full h-auto object-contain pointer-events-none max-h-[580px]"
              />

              {/* Render Existing Masks */}
              {masks.map((mask, idx) => {
                const isSelected = mask.id === selectedMaskId;
                
                // Preview mode rendering
                if (isPreviewActive) {
                  const isTarget = isSelected;
                  if (occlusionMode === 'hide-one-reveal-one' && !isTarget) {
                    return null; // surrounding labels remain visible
                  }

                  if (isTarget) {
                    return (
                      <div
                        key={mask.id}
                        onClick={() => setPreviewRevealed(!previewRevealed)}
                        className={`absolute rounded-lg flex items-center justify-center p-1 transition-all cursor-pointer shadow-xl ${
                          previewRevealed
                            ? 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/30'
                            : 'bg-amber-950/90 border-2 border-amber-400 text-amber-200 animate-pulse ring-2 ring-amber-500/40'
                        }`}
                        style={{
                          left: `${mask.x}%`,
                          top: `${mask.y}%`,
                          width: `${mask.width}%`,
                          height: `${mask.height}%`,
                        }}
                      >
                        <span className="text-[11px] font-bold font-mono truncate px-1">
                          {previewRevealed ? mask.label : `? [Card ${idx + 1}]`}
                        </span>
                      </div>
                    );
                  }

                  // Non-target mask in Hide-All mode: opaque block
                  return (
                    <div
                      key={mask.id}
                      className="absolute rounded-lg bg-slate-900/95 border border-white/20 shadow-md"
                      style={{
                        left: `${mask.x}%`,
                        top: `${mask.y}%`,
                        width: `${mask.width}%`,
                        height: `${mask.height}%`,
                      }}
                    />
                  );
                }

                // Normal Architect Mode: Editable Bounding Boxes
                return (
                  <div
                    key={mask.id}
                    data-mask-id={mask.id}
                    className={`absolute rounded-lg flex items-center justify-between p-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/85 border-2 border-white text-white shadow-xl shadow-indigo-600/40 ring-4 ring-indigo-500/30 z-20'
                        : 'bg-indigo-950/80 border border-indigo-400/60 text-indigo-200 hover:bg-indigo-900/90 hover:border-indigo-300 z-10'
                    }`}
                    style={{
                      left: `${mask.x}%`,
                      top: `${mask.y}%`,
                      width: `${mask.width}%`,
                      height: `${mask.height}%`,
                    }}
                  >
                    <span className="text-[10px] font-bold font-mono px-1 truncate select-none pointer-events-none">
                      #{idx + 1} {mask.label || 'Covered'}
                    </span>
                  </div>
                );
              })}

              {/* Active Drawing Preview Rectangle */}
              {isDrawing && drawStart && drawCurrent && (
                <div
                  className="absolute rounded-lg bg-indigo-500/30 border-2 border-dashed border-indigo-300 pointer-events-none z-30"
                  style={{
                    left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                    top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                    width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                    height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                  }}
                />
              )}
            </div>

            <div className="p-2.5 text-center text-[11px] text-slate-400 font-mono flex items-center justify-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {isPreviewActive 
                  ? 'Interactive Preview: Click the amber mask to reveal answer!' 
                  : 'Click & drag anywhere across the image to mask anatomical or technical labels.'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Mask Property Inspector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider font-display px-1 flex items-center justify-between">
            <span>Mask Inspector</span>
            <span className="text-[10px] font-mono text-indigo-400 font-bold">
              {masks.length} Created
            </span>
          </div>

          {activeMask ? (
            <div className="p-5 rounded-3xl glass-panel space-y-4 border-indigo-500/30 shadow-xl shadow-indigo-500/5 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold font-mono text-xs">
                    {masks.findIndex(m => m.id === activeMask.id) + 1}
                  </div>
                  <span className="text-sm font-bold text-white font-display">Target Label</span>
                </div>
                <button
                  onClick={() => handleDeleteMask(activeMask.id)}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 transition-colors"
                  title="Delete this mask"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 font-display block mb-1">
                    Covered Text / Correct Answer
                  </label>
                  <input
                    type="text"
                    value={activeMask.label || ''}
                    onChange={(e) => handleUpdateMask({ label: e.target.value })}
                    placeholder="e.g. Superior Vena Cava"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 font-display block mb-1">
                    Retrieval Hint (Optional)
                  </label>
                  <input
                    type="text"
                    value={activeMask.hint || ''}
                    onChange={(e) => handleUpdateMask({ hint: e.target.value })}
                    placeholder="e.g. Drains blood from upper body"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/[0.05] text-[11px] font-mono text-slate-400 space-y-1">
                  <div>Coords: x: {activeMask.x}%, y: {activeMask.y}%</div>
                  <div>Dimensions: {activeMask.width}% &times; {activeMask.height}%</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-3xl glass-panel text-slate-500 text-xs space-y-2 border-dashed">
              <Tag className="w-8 h-8 mx-auto text-slate-600" />
              <p>No mask currently selected. Click an existing mask or drag a new box on the canvas.</p>
            </div>
          )}

          {/* Roster of All Masks */}
          {masks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display px-1">
                Mask Roster ({masks.length})
              </div>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                {masks.map((m, idx) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMaskId(m.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                      m.id === selectedMaskId
                        ? 'bg-indigo-950/70 border-indigo-500/60 text-white shadow-md'
                        : 'bg-slate-900/60 border-white/[0.06] text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-md bg-white/[0.08] flex items-center justify-center font-mono font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-medium truncate">{m.label || 'Unlabeled Mask'}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMask(m.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
