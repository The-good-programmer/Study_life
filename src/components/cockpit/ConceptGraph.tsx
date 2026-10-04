import React, { useState } from 'react';
import { GitFork, Sparkles, Layers, Info } from 'lucide-react';
import type { ConceptCheckpoint, ConceptNode } from '../../types';

interface ConceptGraphProps {
  concept: ConceptCheckpoint;
}

export const ConceptGraph: React.FC<ConceptGraphProps> = ({ concept }) => {
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);

  // Generate nodes from concept data if conceptNodes is not populated
  const nodes: ConceptNode[] = concept.conceptNodes && concept.conceptNodes.length > 0 
    ? concept.conceptNodes 
    : [
        {
          id: 'root',
          label: concept.title,
          category: 'core',
          connectedTo: concept.keyTerms.slice(0, 4).map((_, i) => `term-${i}`),
          description: concept.mentalModel
        },
        ...concept.keyTerms.slice(0, 5).map((kt, i) => ({
          id: `term-${i}`,
          label: kt.term,
          category: (i % 2 === 0 ? 'mechanism' : 'application') as 'mechanism' | 'application',
          connectedTo: ['root'],
          description: kt.definition
        }))
      ];

  const rootNode = nodes.find(n => n.category === 'core') || nodes[0];
  const peripheralNodes = nodes.filter(n => n.id !== rootNode?.id);

  // Layout math: Root is at (250, 140), surrounding nodes in an ellipse
  const centerX = 250;
  const centerY = 140;
  const radiusX = 170;
  const radiusY = 95;

  const nodeRadius = peripheralNodes.length > 6 
    ? Math.max(16, 22 - (peripheralNodes.length - 6) * 1.2) 
    : 22;
  const selectedRadius = nodeRadius + 4;
  const textFontSize = peripheralNodes.length > 7 ? '9px' : '10px';

  const nodePositions = new Map<string, { x: number; y: number }>();
  if (rootNode) {
    nodePositions.set(rootNode.id, { x: centerX, y: centerY });
  }

  peripheralNodes.forEach((node, idx) => {
    const angle = (idx / (peripheralNodes.length || 1)) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    nodePositions.set(node.id, { x, y });
  });

  const categoryColors = {
    core: {
      bg: 'fill-indigo-600',
      stroke: 'stroke-indigo-400',
      text: 'text-indigo-200',
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
    },
    mechanism: {
      bg: 'fill-purple-700',
      stroke: 'stroke-purple-400',
      text: 'text-purple-200',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    },
    application: {
      bg: 'fill-emerald-700',
      stroke: 'stroke-emerald-400',
      text: 'text-emerald-200',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    }
  };

  const handleNodeToggle = (node: ConceptNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  return (
    <div className="p-5 rounded-3xl glass-panel space-y-4 animate-fadeIn relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-display">
            Interactive Dual-Coding Concept Map
          </span>
        </div>
        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Tap nodes to inspect relations
        </span>
      </div>

      {/* SVG Canvas Arena */}
      <div className="relative w-full h-[280px] bg-slate-950/60 rounded-2xl border border-white/[0.06] overflow-hidden flex items-center justify-center select-none">
        <svg viewBox="0 0 500 280" className="w-full h-full">
          <defs>
            <linearGradient id="link-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Connection Lines */}
          {peripheralNodes.map(node => {
            const rootPos = nodePositions.get(rootNode.id);
            const nodePos = nodePositions.get(node.id);
            if (!rootPos || !nodePos) return null;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g key={`line-${node.id}`}>
                <line
                  x1={rootPos.x}
                  y1={rootPos.y}
                  x2={nodePos.x}
                  y2={nodePos.y}
                  stroke={isSelected ? '#818cf8' : 'url(#link-grad)'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeDasharray={isSelected ? 'none' : '4 3'}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {/* Peripheral Nodes */}
          {peripheralNodes.map(node => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            const isSelected = selectedNode?.id === node.id;
            const colors = categoryColors[node.category];

            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Node: ${node.label} (${node.category})`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => handleNodeToggle(node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNodeToggle(node);
                  }
                }}
                className="cursor-pointer group focus:outline-none"
              >
                <circle
                  r={isSelected ? selectedRadius : nodeRadius}
                  className={`${colors.bg} ${colors.stroke} transition-all duration-300 group-hover:scale-110 group-focus:stroke-white`}
                  strokeWidth={isSelected ? 3 : 1.5}
                  filter={isSelected ? 'url(#glow)' : undefined}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className="font-bold fill-white pointer-events-none select-none"
                  style={{ fontSize: textFontSize }}
                >
                  {node.label.length > 10 ? `${node.label.slice(0, 9)}…` : node.label}
                </text>
              </g>
            );
          })}

          {/* Central Root Node */}
          {rootNode && (() => {
            const rootPos = nodePositions.get(rootNode.id);
            if (!rootPos) return null;
            const isSelected = selectedNode?.id === rootNode.id;

            return (
              <g
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Root concept: ${rootNode.label}`}
                transform={`translate(${rootPos.x}, ${rootPos.y})`}
                onClick={() => handleNodeToggle(rootNode)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNodeToggle(rootNode);
                  }
                }}
                className="cursor-pointer group focus:outline-none"
              >
                <circle
                  r={34}
                  className="fill-indigo-600/90 stroke-indigo-400 group-hover:stroke-indigo-300 group-focus:stroke-white transition-all duration-300"
                  strokeWidth={isSelected ? 4 : 2.5}
                  filter="url(#glow)"
                />
                <circle r={28} className="fill-indigo-950/80 stroke-white/20" />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className="text-[11px] font-extrabold fill-white pointer-events-none select-none font-display"
                >
                  {rootNode.label.length > 14 ? `${rootNode.label.slice(0, 13)}…` : rootNode.label}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs animate-fadeIn space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm font-display flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              {selectedNode.label}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${categoryColors[selectedNode.category].badge}`}>
                {selectedNode.category}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="Close drawer"
              >
                ✕
              </button>
            </div>
          </div>
          {selectedNode.description && (
            <p className="text-slate-300 leading-relaxed font-sans text-xs">
              {selectedNode.description}
            </p>
          )}
        </div>
      )}

      {!selectedNode && (
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Click any concept sphere above to inspect how it connects to the core model.</span>
        </div>
      )}
    </div>
  );
};
