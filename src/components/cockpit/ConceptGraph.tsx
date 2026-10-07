import React, { useState } from 'react';
import type { ConceptCheckpoint, ConceptNode } from '../../types';
import { cn } from '../../utils/cn';
import { MathRenderer } from '../common/MathRenderer';

interface ConceptGraphProps {
  concept: ConceptCheckpoint;
}

const CATEGORY_LABELS: Record<ConceptNode['category'], string> = {
  core: 'Core idea',
  mechanism: 'How it works',
  application: 'Where it is used',
};

const CATEGORY_DOTS: Record<ConceptNode['category'], string> = {
  core: 'bg-brand',
  mechanism: 'bg-due',
  application: 'bg-success',
};

/** Builds a star of nodes from key terms when the deck has no explicit concept map. */
const nodesFor = (concept: ConceptCheckpoint): { nodes: ConceptNode[]; isGenerated: boolean } => {
  if (concept.conceptNodes && concept.conceptNodes.length > 0) {
    return { nodes: concept.conceptNodes, isGenerated: false };
  }
  const terms = concept.keyTerms.slice(0, 6);
  return {
    isGenerated: true,
    nodes: [
      {
        id: 'root',
        label: concept.title,
        category: 'core',
        connectedTo: terms.map((_, i) => `term-${i}`),
        description: concept.mentalModel,
      },
      ...terms.map((term, i) => ({
        id: `term-${i}`,
        label: term.term,
        category: 'mechanism' as const,
        connectedTo: ['root'],
        description: term.definition,
      })),
    ],
  };
};

/**
 * The concept at the centre with its key parts around it. Nodes are real buttons
 * (full labels, keyboard and screen reader friendly); links are drawn underneath.
 */
export const ConceptGraph: React.FC<ConceptGraphProps> = ({ concept }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { nodes, isGenerated } = nodesFor(concept);

  const root = nodes.find(n => n.category === 'core') || nodes[0];
  const others = nodes.filter(n => n.id !== root?.id);

  // Positions in percent of the box: the root in the middle, the rest on an ellipse.
  const positions = new Map<string, { x: number; y: number }>();
  if (root) positions.set(root.id, { x: 50, y: 50 });
  others.forEach((node, index) => {
    const angle = (index / Math.max(1, others.length)) * 2 * Math.PI - Math.PI / 2;
    positions.set(node.id, { x: 50 + 34 * Math.cos(angle), y: 50 + 37 * Math.sin(angle) });
  });

  // Each link once, whichever side declares it.
  const links: [string, string][] = [];
  const seen = new Set<string>();
  nodes.forEach(node => {
    node.connectedTo.forEach(otherId => {
      const key = [node.id, otherId].sort().join('|');
      if (seen.has(key) || !positions.has(node.id) || !positions.has(otherId)) return;
      seen.add(key);
      links.push([node.id, otherId]);
    });
  });
  // Generated maps tie every term to the root, even when it was not listed.
  if (isGenerated && root) {
    others.forEach(node => {
      const key = [root.id, node.id].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        links.push([root.id, node.id]);
      }
    });
  }

  const selected = nodes.find(n => n.id === selectedId) ?? null;

  if (!root) return null;

  return (
    <div className="space-y-3">
      <div className="relative h-[300px] w-full overflow-hidden rounded-2xl border border-line bg-canvas sm:h-[320px]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {links.map(([a, b]) => {
            const from = positions.get(a)!;
            const to = positions.get(b)!;
            const isActive = selectedId === a || selectedId === b;
            return (
              <line
                key={`${a}-${b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isActive ? 'var(--brand)' : 'var(--line-strong)'}
                strokeWidth={isActive ? 2 : 1.25}
                vectorEffect="non-scaling-stroke"
                className="transition-[stroke] duration-200"
              />
            );
          })}
        </svg>

        {nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isRoot = node.id === root.id;
          const isSelected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(isSelected ? null : node.id)}
              aria-pressed={isSelected}
              title={node.label}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 truncate rounded-xl border px-3 text-left transition-colors cursor-pointer',
                isRoot
                  ? 'h-11 max-w-[64%] border-brand bg-brand text-sm font-semibold text-brand-ink shadow-[0_8px_24px_-12px_var(--brand)] sm:max-w-[52%]'
                  : 'h-9 max-w-[42%] bg-surface-solid text-[13px] font-medium sm:max-w-[34%]',
                !isRoot && (isSelected ? 'border-brand text-ink ring-2 ring-brand-soft' : 'border-line-strong text-ink-muted hover:text-ink'),
                isRoot && isSelected && 'ring-4 ring-brand-soft',
              )}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <MathRenderer text={node.label} />
            </button>
          );
        })}
      </div>

      <div className="min-h-[52px] rounded-2xl border border-line bg-surface px-4 py-3" aria-live="polite">
        {selected ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              {!isGenerated && <span className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOTS[selected.category])} aria-hidden="true" />}
              <MathRenderer text={selected.label} />
              {!isGenerated && <span className="text-xs font-normal text-ink-subtle">{CATEGORY_LABELS[selected.category]}</span>}
            </p>
            {selected.description && (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                <MathRenderer text={selected.description} />
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-ink-subtle">Select a part of the map to see how it fits in.</p>
        )}
      </div>
    </div>
  );
};
