import type { OcclusionMask, RetrievalCard } from '../types';

/**
 * Starter-deck diagrams for image-occlusion cards.
 *
 * Each label is drawn in a box whose position is known, and its mask is computed from that same box,
 * so a mask always covers its label exactly instead of relying on hand-typed percentages.
 */

const WIDTH = 800;
const HEIGHT = 600;
const PILL_HEIGHT = 34;
const MASK_MARGIN = 5; // px around the label box, so no letter edge shows

interface DiagramLabel {
  id: string;
  /** Text drawn on the diagram. */
  text: string;
  /** The answer, when it is longer than what fits on the diagram. Defaults to text. */
  answer?: string;
  hint: string;
  x: number;
  y: number;
  /** Leader line from the label to the part it names. */
  to: [number, number];
}

export interface Diagram {
  imageUrl: string;
  masks: OcclusionMask[];
}

const round = (n: number) => Math.round(n * 10) / 10;
const pillWidth = (text: string) => text.length * 10 + 28;

function buildDiagram(art: string, labels: DiagramLabel[]): Diagram {
  const pills = labels
    .map((l) => {
      const w = pillWidth(l.text);
      const [tx, ty] = l.to;
      const fromX = tx < l.x ? l.x : tx > l.x + w ? l.x + w : tx;
      const fromY = ty < l.y ? l.y : ty > l.y + PILL_HEIGHT ? l.y + PILL_HEIGHT : l.y + PILL_HEIGHT / 2;
      return (
        `<line x1="${fromX}" y1="${fromY}" x2="${tx}" y2="${ty}" stroke="#cbd5e1" stroke-width="2"/>` +
        `<rect x="${l.x}" y="${l.y}" width="${w}" height="${PILL_HEIGHT}" rx="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>` +
        `<text x="${l.x + w / 2}" y="${l.y + 23}" text-anchor="middle" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="16" font-weight="600">${l.text}</text>`
      );
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" style="background:#090d1a;">${art}${pills}</svg>`;

  const masks = labels.map((l) => ({
    id: l.id,
    x: round(((l.x - MASK_MARGIN) / WIDTH) * 100),
    y: round(((l.y - MASK_MARGIN) / HEIGHT) * 100),
    width: round(((pillWidth(l.text) + MASK_MARGIN * 2) / WIDTH) * 100),
    height: round(((PILL_HEIGHT + MASK_MARGIN * 2) / HEIGHT) * 100),
    label: l.answer ?? l.text,
    hint: l.hint,
  }));

  return { imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, masks };
}

/** One card per label, all sharing the diagram, like the Diagram cards editor makes them. */
export function diagramCards(
  diagram: Diagram,
  { conceptId, idPrefix, question, sourceAnchor }: Pick<RetrievalCard, 'conceptId' | 'question' | 'sourceAnchor'> & { idPrefix: string },
): RetrievalCard[] {
  return diagram.masks.map((mask, idx) => ({
    id: `${idPrefix}-${idx + 1}`,
    conceptId,
    cardType: 'image-occlusion',
    question,
    answer: mask.label || '',
    hint: mask.hint,
    imageUrl: diagram.imageUrl,
    occlusionMode: 'hide-all-reveal-one',
    masks: diagram.masks,
    activeMaskId: mask.id,
    stability: 1,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    sourceAnchor,
  }));
}

export const HEART_DIAGRAM = buildDiagram(
  `<defs>
    <radialGradient id="heartGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e11d48" stop-opacity="0.8"/><stop offset="100%" stop-color="#881337" stop-opacity="0.95"/></radialGradient>
    <linearGradient id="aortaGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#e11d48"/></linearGradient>
    <linearGradient id="cavaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>
  </defs>
  <path d="M 280 80 L 280 230 Q 280 260 300 270 L 320 270 L 320 80 Z" fill="url(#cavaGrad)" stroke="#7dd3fc" stroke-width="2"/>
  <path d="M 360 220 Q 360 80 430 80 Q 510 80 500 220" fill="none" stroke="url(#aortaGrad)" stroke-width="48" stroke-linecap="round"/>
  <path d="M 400 80 L 400 35 M 435 80 L 440 35 M 470 85 L 485 40" stroke="#f43f5e" stroke-width="12" stroke-linecap="round"/>
  <path d="M 440 210 Q 400 170 330 170 Q 290 170 240 180" fill="none" stroke="#0ea5e9" stroke-width="32" stroke-linecap="round"/>
  <path d="M 400 220 C 330 170, 240 220, 250 340 C 260 450, 400 520, 400 550 C 400 520, 540 450, 550 340 C 560 220, 470 170, 400 220 Z" fill="url(#heartGrad)" stroke="#fda4af" stroke-width="3"/>
  <path d="M 400 300 L 400 510" stroke="#f43f5e" stroke-width="6" stroke-dasharray="8 6"/>`,
  [
    { id: 'm-heart-1', text: 'Superior vena cava', hint: 'Returns deoxygenated blood from the upper body to the right atrium', x: 40, y: 60, to: [282, 110] },
    { id: 'm-heart-2', text: 'Aortic arch', hint: 'Carries oxygenated blood from the left ventricle to the body', x: 590, y: 40, to: [500, 95] },
    { id: 'm-heart-3', text: 'Pulmonary trunk', hint: 'Carries blood from the right ventricle to the lungs', x: 20, y: 170, to: [245, 180] },
    { id: 'm-heart-4', text: 'Right ventricle', hint: 'Pumps blood into the low-pressure pulmonary circuit', x: 20, y: 380, to: [320, 400] },
    { id: 'm-heart-5', text: 'Left ventricle', hint: 'Thickest wall; generates systemic pressure', x: 590, y: 380, to: [480, 400] },
  ],
);

export const SYNAPSE_DIAGRAM = buildDiagram(
  `<path d="M 200 50 L 600 50 L 600 240 Q 600 320 400 320 Q 200 320 200 240 Z" fill="#312e81" stroke="#818cf8" stroke-width="3"/>
  <path d="M 150 420 Q 400 400 650 420 L 650 560 L 150 560 Z" fill="#1e1b4b" stroke="#a5b4fc" stroke-width="3"/>
  <circle cx="300" cy="180" r="22" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
  <circle cx="370" cy="200" r="24" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
  <circle cx="450" cy="170" r="20" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
  <circle cx="410" cy="260" r="18" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
  <rect x="200" y="200" width="22" height="40" rx="6" fill="#fbbf24" stroke="#fef3c7" stroke-width="2"/>
  <rect x="280" y="405" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
  <rect x="390" y="402" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
  <rect x="500" y="408" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
  <text x="400" y="90" text-anchor="middle" fill="#c7d2fe" font-family="system-ui, sans-serif" font-size="17" font-weight="bold">Presynaptic terminal</text>
  <text x="400" y="540" text-anchor="middle" fill="#a5b4fc" font-family="system-ui, sans-serif" font-size="17" font-weight="bold">Postsynaptic neuron</text>`,
  [
    { id: 'm-syn-1', text: 'Ca2+ channel', answer: 'Voltage-gated Ca2+ channel', hint: 'Opens when the terminal depolarizes; the Ca2+ influx triggers vesicle release', x: 20, y: 203, to: [200, 220] },
    { id: 'm-syn-2', text: 'Synaptic vesicles', hint: 'Store neurotransmitter until they fuse with the membrane', x: 520, y: 110, to: [470, 170] },
    { id: 'm-syn-3', text: 'Synaptic cleft', hint: 'The narrow gap neurotransmitter diffuses across', x: 20, y: 345, to: [330, 365] },
    { id: 'm-syn-4', text: 'Receptors', answer: 'Neurotransmitter receptors', hint: 'Bind neurotransmitter on the postsynaptic membrane', x: 590, y: 460, to: [524, 425] },
  ],
);

export const ELECTRON_TRANSPORT_DIAGRAM = buildDiagram(
  `<rect x="0" y="240" width="800" height="100" fill="#1e293b"/>
  <line x1="0" y1="240" x2="800" y2="240" stroke="#64748b" stroke-width="3"/>
  <line x1="0" y1="340" x2="800" y2="340" stroke="#64748b" stroke-width="3"/>
  <text x="250" y="150" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14">Intermembrane space</text>
  <text x="300" y="480" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14">Mitochondrial matrix</text>
  <text x="696" y="296" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">Inner membrane</text>
  <rect x="70" y="210" width="80" height="160" rx="14" fill="#4f46e5" stroke="#c7d2fe" stroke-width="2"/>
  <rect x="190" y="290" width="60" height="80" rx="12" fill="#0891b2" stroke="#a5f3fc" stroke-width="2"/>
  <circle cx="280" cy="300" r="13" fill="#facc15"/><text x="280" y="305" text-anchor="middle" fill="#1f2937" font-family="system-ui, sans-serif" font-size="13" font-weight="bold">Q</text>
  <rect x="310" y="210" width="80" height="160" rx="14" fill="#7c3aed" stroke="#ddd6fe" stroke-width="2"/>
  <circle cx="425" cy="222" r="14" fill="#f97316"/><text x="425" y="227" text-anchor="middle" fill="#1f2937" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">c</text>
  <rect x="460" y="210" width="80" height="160" rx="14" fill="#db2777" stroke="#fbcfe8" stroke-width="2"/>
  <rect x="610" y="230" width="70" height="120" rx="12" fill="#059669" stroke="#a7f3d0" stroke-width="2"/>
  <rect x="637" y="350" width="16" height="40" fill="#047857"/>
  <circle cx="645" cy="430" r="45" fill="#10b981" stroke="#a7f3d0" stroke-width="2"/>
  <g stroke="#fde68a" stroke-width="3" fill="#fde68a" font-family="system-ui, sans-serif" font-size="14">
    <line x1="95" y1="360" x2="95" y2="195"/><path d="M 88 200 L 95 186 L 102 200 Z"/>
    <line x1="335" y1="360" x2="335" y2="195"/><path d="M 328 200 L 335 186 L 342 200 Z"/>
    <line x1="485" y1="360" x2="485" y2="195"/><path d="M 478 200 L 485 186 L 492 200 Z"/>
    <line x1="625" y1="190" x2="625" y2="340"/><path d="M 618 335 L 625 349 L 632 335 Z"/>
  </g>
  <g fill="#fde68a" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">
    <text x="103" y="182">H+</text><text x="343" y="182">H+</text><text x="493" y="182">H+</text><text x="633" y="182">H+</text>
  </g>
  <g fill="#e2e8f0" font-family="system-ui, sans-serif" font-size="14">
    <text x="40" y="400">NADH → NAD+</text>
    <text x="146" y="400">FADH2 → FAD</text>
    <text x="430" y="400">½O2 + 2H+ → H2O</text>
    <text x="590" y="505">ADP + Pi → ATP</text>
  </g>`,
  [
    { id: 'm-etc-1', text: 'Complex I', hint: 'Accepts electrons from NADH and pumps protons', x: 40, y: 40, to: [125, 210] },
    { id: 'm-etc-2', text: 'Complex II', hint: 'Accepts electrons from FADH2; pumps no protons', x: 262, y: 540, to: [250, 345] },
    { id: 'm-etc-3', text: 'Complex III', hint: 'Passes electrons from ubiquinone to cytochrome c', x: 285, y: 40, to: [365, 210] },
    { id: 'm-etc-4', text: 'Complex IV', hint: 'Hands electrons to oxygen, forming water', x: 445, y: 40, to: [515, 210] },
    { id: 'm-etc-5', text: 'ATP synthase', hint: 'Protons flowing back through it turn a rotor that makes ATP', x: 600, y: 40, to: [660, 230] },
  ],
);
