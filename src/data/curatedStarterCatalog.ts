import type { StarterDeckMetadata, StudySession } from '../types';
import { DEMO_STUDY_SESSIONS } from './demoDecks';

const HEART_ANATOMY_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
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
    <path d="M 280 80 L 280 230 Q 280 260 300 270 L 320 270 L 320 80 Z" fill="url(#cavaGrad)" stroke="#7dd3fc" stroke-width="2"/>
    <path d="M 360 220 Q 360 80 430 80 Q 510 80 500 220" fill="none" stroke="url(#aortaGrad)" stroke-width="48" stroke-linecap="round"/>
    <path d="M 400 80 L 400 35 M 435 80 L 440 35 M 470 85 L 485 40" stroke="#f43f5e" stroke-width="12" stroke-linecap="round"/>
    <path d="M 440 210 Q 400 170 330 170 Q 290 170 240 180" fill="none" stroke="#0ea5e9" stroke-width="32" stroke-linecap="round"/>
    <path d="M 400 220 C 330 170, 240 220, 250 340 C 260 450, 400 520, 400 550 C 400 520, 540 450, 550 340 C 560 220, 470 170, 400 220 Z" fill="url(#heartGrad)" stroke="#fda4af" stroke-width="3" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.5))"/>
    <path d="M 400 300 L 400 510" stroke="#f43f5e" stroke-width="6" stroke-dasharray="8 6"/>
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
`)}`;

const SYNAPSE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#090d1a;">
    <path d="M 200 50 L 600 50 L 600 240 Q 600 320 400 320 Q 200 320 200 240 Z" fill="#312e81" stroke="#818cf8" stroke-width="3"/>
    <path d="M 150 420 Q 400 400 650 420 L 650 550 L 150 550 Z" fill="#1e1b4b" stroke="#a5b4fc" stroke-width="3"/>
    <circle cx="300" cy="180" r="22" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
    <circle cx="370" cy="200" r="24" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
    <circle cx="450" cy="170" r="20" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
    <circle cx="410" cy="260" r="18" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/>
    <rect x="200" y="200" width="22" height="40" rx="6" fill="#fbbf24" stroke="#fef3c7" stroke-width="2"/>
    <rect x="280" y="405" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
    <rect x="390" y="402" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
    <rect x="500" y="408" width="24" height="28" rx="4" fill="#34d399" stroke="#d1fae5" stroke-width="2"/>
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
`)}`;

export const USMLE_CARDIO_SESSION: StudySession = {
  id: 'usmle-cardio-pathophysiology',
  title: 'USMLE Step 1: Cardiovascular Pathophysiology & Arrhythmia Dynamics',
  category: 'Medical & Clinical',
  description: 'High-yield board review of cardiac action potential phases, Wiggers pressure-volume loops, Vaughan Williams antiarrhythmic pharmacology, and Frank-Starling mechanics.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: 'USMLE_Step1_Cardiovascular_Core.pdf',
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'CARDIOVASCULAR PHYSIOLOGY & ELECTROPHYSIOLOGY\n\nThe ventricular myocyte action potential consists of five distinct phases (0 through 4). Phase 0 (Rapid Depolarization) is mediated by the massive opening of voltage-gated Na+ channels. Phase 1 (Initial Repolarization) occurs via inactivation of Na+ channels and transient activation of outward Ito K+ currents. Phase 2 (Plateau Phase) reflects an exact electrical balance between inward Ca2+ influx via L-type channels and outward K+ efflux via delayed rectifier channels (IKr and IKs). This sustained plateau prolongs the absolute refractory period, preventing tetanic contraction. Phase 3 (Rapid Repolarization) ensues when L-type Ca2+ channels close while delayed rectifier K+ channels dominate. Phase 4 establishes the resting membrane potential (-85 to -90 mV) predominantly via inward rectifier K+ channels (IK1).'
      },
      {
        pageNumber: 2,
        text: 'HEMODYNAMICS & WIGGERS PRESSURE-VOLUME LOOPS\n\nIn the left ventricular pressure-volume loop, Point A represents mitral valve closure, marking the onset of isovolumetric contraction. During this phase, ventricular pressure escalates rapidly while ventricular volume remains strictly unchanged. Point B marks aortic valve opening, transitioning into the rapid ejection phase. Point C indicates aortic valve closure (producing the second heart sound, S2), followed by isovolumetric relaxation down to Point D where mitral valve opening allows ventricular diastolic filling. Stroke volume (SV) is mathematically defined as End-Diastolic Volume (EDV) minus End-Systolic Volume (ESV). Laplace\'s law dictates that ventricular wall stress = (Pressure × Radius) / (2 × Wall Thickness). Concentric hypertrophy increases wall thickness to normalize elevated systolic pressure.'
      },
      {
        pageNumber: 3,
        text: 'VAUGHAN WILLIAMS ANTIARRHYTHMIC PHARMACOLOGY\n\nClass I antiarrhythmics are Na+ channel blockers. Class Ia (Quinidine, Procainamide, Disopyramide) moderately block Na+ and prolong action potential duration (APD) and QT interval by also blocking K+ channels. Class Ib (Lidocaine, Mexiletine) weakly block Na+ with rapid dissociation; they preferential target ischemic depolarized Purkinje tissue and shorten APD. Class Ic (Flecainide, Propafenone) strongly block Na+ with slow dissociation, markedly prolonging QRS without altering APD; they are contraindicated in structural or ischemic heart disease due to proarrhythmic risk. Class II drugs are Beta-blockers, decreasing SA and AV nodal conduction. Class III agents (Amiodarone, Sotalol, Dofetilide) are K+ channel blockers prolonging Phase 3 repolarization and QT interval. Class IV agents (Verapamil, Diltiazem) are non-dihydropyridine Ca2+ blockers targeting the AV node.'
      }
    ]
  },
  concepts: [
    {
      id: 'c-usmle-1',
      order: 1,
      title: 'Ventricular Action Potential & Ion Fluxes',
      estimatedMinutes: 10,
      mentalModel: 'Phase 0 is the spark (Na+ rush in), Phase 2 is the tug-of-war stalemate (Ca2+ in matches K+ out), and Phase 3 is the cool-down reset (K+ exits).',
      sourceAnchor: {
        pageNumber: 1,
        snippet: 'Phase 2 (Plateau Phase) reflects an exact electrical balance between inward Ca2+ influx via L-type channels and outward K+ efflux...',
        sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf'
      },
      coreTakeaways: [
        'Phase 0: Rapid Na+ influx produces steep depolarization.',
        'Phase 2: L-type Ca2+ influx balances delayed rectifier K+ efflux, sustaining the refractory plateau.',
        'Phase 3: Ca2+ channels close and outward K+ efflux repolarizes the myocyte back to -90 mV.'
      ],
      keyTerms: [
        { term: 'L-Type Ca2+ Channel', definition: 'Voltage-sensitive channel active during Phase 2 that triggers calcium-induced calcium release (CICR) from the sarcoplasmic reticulum.' },
        { term: 'Delayed Rectifier K+ (IKr/IKs)', definition: 'Potassium currents responsible for Phase 3 repolarization and sensitive to Class III antiarrhythmic blockade.' }
      ],
      feynmanPrompt: 'Explain why your heart cannot undergo tetany (a prolonged locked cramp) like your bicep muscle can, focusing on the Phase 2 plateau and refractory period.',
      sampleMasteryExplanation: 'Skeletal muscles can fire in rapid succession to lock into tetanus, but cardiac myocytes have an extended Phase 2 plateau where inward calcium balances outward potassium. This stretches the action potential duration to 250 milliseconds. The absolute refractory period lasts until the muscle is nearly relaxed, preventing an electrical wave from re-exciting the heart before it finishes pumping.',
      retrievalCards: [
        {
          id: 'card-usmle-io-1',
          conceptId: 'c-usmle-1',
          cardType: 'image-occlusion',
          question: 'Identify the key anatomical structures of the cardiac conduction and vascular outflow system.',
          answer: 'Left Ventricle, Aortic Arch, Superior Vena Cava, Pulmonary Trunk, and Right Ventricle.',
          imageUrl: HEART_ANATOMY_SVG,
          occlusionMode: 'hide-all-reveal-one',
          activeMaskId: 'm-2',
          masks: [
            { id: 'm-1', x: 13, y: 11, width: 23, height: 6, label: 'Superior Vena Cava', hint: 'Brings deoxygenated systemic venous return to right atrium' },
            { id: 'm-2', x: 65, y: 8, width: 17, height: 6, label: 'Aortic Arch', hint: 'High-pressure systemic outflow tract delivering oxygenated blood' },
            { id: 'm-3', x: 11, y: 30, width: 21, height: 6, label: 'Pulmonary Trunk', hint: 'Outflow vessel carrying blood from right ventricle to pulmonary circulation' },
            { id: 'm-4', x: 12, y: 57, width: 18, height: 6, label: 'Right Ventricle', hint: 'Pumps blood into the low-resistance pulmonary circuit' },
            { id: 'm-5', x: 68, y: 58, width: 18, height: 6, label: 'Left Ventricle', hint: 'Thick muscular wall generating systemic pressures of 120 mmHg' }
          ],
          stability: 1,
          difficulty: 5,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'VENTRICULAR MYOCYTE ACTION POTENTIAL...', sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf' }
        },
        {
          id: 'card-usmle-1',
          conceptId: 'c-usmle-1',
          cardType: 'cloze',
          question: 'During Phase 2 of the ventricular myocyte action potential, inward current carried by {{L-type Ca2+}} channels is balanced by outward {{delayed rectifier K+}} currents.',
          clozeTemplate: 'During Phase 2 of the ventricular myocyte action potential, inward current carried by {{L-type Ca2+}} channels is balanced by outward {{delayed rectifier K+}} currents.',
          answer: 'L-type Ca2+ ... delayed rectifier K+',
          hint: 'The two ions in equal and opposite flux during the plateau phase.',
          explanation: 'This balance creates the 200-300 ms plateau phase that maintains the prolonged refractory period.',
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'Phase 2 (Plateau Phase) reflects an exact electrical balance...', sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf' }
        },
        {
          id: 'card-usmle-2',
          conceptId: 'c-usmle-1',
          cardType: 'multiple-choice',
          question: 'Which phase of the cardiac myocyte action potential is primarily prolonged by Class III antiarrhythmics like Amiodarone?',
          options: [
            'Phase 3 (Rapid Repolarization)',
            'Phase 0 (Rapid Upstroke Depolarization)',
            'Phase 1 (Transient Early Repolarization)',
            'Phase 4 (Resting Membrane Potential)'
          ],
          answer: 'Phase 3 (Rapid Repolarization)',
          explanation: 'Class III antiarrhythmics block delayed rectifier K+ channels, prolonging Phase 3 repolarization and widening the QT interval on surface ECG.',
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 3, snippet: 'Class III agents (Amiodarone, Sotalol) are K+ channel blockers prolonging Phase 3 repolarization...', sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf' }
        }
      ]
    },
    {
      id: 'c-usmle-2',
      order: 2,
      title: 'Wiggers Pressure-Volume Loops & Wall Stress',
      estimatedMinutes: 12,
      mentalModel: 'The PV loop is a box. Left-to-right is filling and emptying; bottom-to-top is pressurizing and relaxing. The area inside the box is total Stroke Work.',
      sourceAnchor: {
        pageNumber: 2,
        snippet: 'Point A represents mitral valve closure, marking the onset of isovolumetric contraction... Stroke volume = EDV - ESV.',
        sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf'
      },
      coreTakeaways: [
        'Isovolumetric contraction begins at mitral valve closure (S1) and ends at aortic valve opening.',
        'Stroke Volume = EDV - ESV. Ejection fraction = SV / EDV (normal: 55-70%).',
        'Laplace\'s Law: Wall Stress = (Pressure × Radius) / (2 × Thickness). Concentric hypertrophy reduces stress in hypertension.'
      ],
      keyTerms: [
        { term: 'Isovolumetric Contraction', definition: 'The cardiac cycle period where all four valves are shut and pressure spikes before blood is ejected into the aorta.' },
        { term: 'Laplace\'s Law', definition: 'Physiological formula demonstrating that increased wall thickness offsets high chamber pressure to keep myocyte stress manageable.' }
      ],
      feynmanPrompt: 'Explain how chronic untreated hypertension causes the heart muscle to get thick (concentric hypertrophy), and why that initial adaptation eventually leads to diastolic heart failure.',
      sampleMasteryExplanation: 'When the heart must pump against 180 mmHg instead of 120 mmHg, wall stress shoots up. By Laplace\'s law, adding muscle mass in parallel makes the wall thicker, distributing the force. However, this thick wall is stiff and non-compliant. During diastole, the ventricle cannot relax properly to fill, reducing end-diastolic volume.',
      retrievalCards: [
        {
          id: 'card-usmle-3',
          conceptId: 'c-usmle-2',
          cardType: 'standard',
          question: 'What acoustic physical event corresponds to the closure of the mitral and tricuspid valves at the beginning of isovolumetric contraction?',
          answer: 'The first heart sound (S1).',
          hint: 'The "lub" of the lub-dub sound heard loudest at the apex/mitral area.',
          explanation: 'S1 marks the onset of ventricular systole when intracardiac pressure rises above atrial pressure, snapping the atrioventricular valves closed.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 2, snippet: 'Point A represents mitral valve closure, marking the onset of isovolumetric contraction...', sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf' }
        },
        {
          id: 'card-usmle-4',
          conceptId: 'c-usmle-2',
          cardType: 'cloze',
          question: 'According to Laplace\'s law, ventricular wall stress is directly proportional to {{chamber radius}} and inversely proportional to {{wall thickness}}.',
          clozeTemplate: 'According to Laplace\'s law, ventricular wall stress is directly proportional to {{chamber radius}} and inversely proportional to {{wall thickness}}.',
          answer: 'chamber radius ... wall thickness',
          hint: 'Think about dilation making stress worse versus hypertrophy reducing stress.',
          explanation: 'Wall Stress = (P × r) / (2h). A dilated ventricle has greater wall stress even at identical pressure.',
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 2, snippet: 'Laplace\'s law dictates that ventricular wall stress = (Pressure × Radius) / (2 × Wall Thickness)...', sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf' }
        }
      ]
    },
    {
      id: 'c-usmle-3',
      order: 3,
      title: 'Vaughan Williams Antiarrhythmic Pharmacodynamics',
      estimatedMinutes: 12,
      mentalModel: 'Class 1A = Double Quarter Pounder (Disopyramide, Quinidine, Procainamide). Class 1B = Lettuce, Mayo (Lidocaine, Mexiletine). Class 1C = Fries Please (Flecainide, Propafenone).',
      sourceAnchor: {
        pageNumber: 3,
        snippet: 'Class Ic (Flecainide, Propafenone) strongly block Na+ with slow dissociation... contraindicated in structural heart disease...',
        sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf'
      },
      coreTakeaways: [
        'Class Ia moderately blocks Na+ and prolongs APD and QT interval.',
        'Class Ib weakly blocks Na+ with fast on/off kinetics, preferentially targeting ischemic Purkinje tissue and shortening APD.',
        'Class Ic produces the strongest Na+ blockade and is contraindicated in post-MI and structural heart disease due to lethal proarrhythmia.'
      ],
      keyTerms: [
        { term: 'Use-Dependence', definition: 'The phenomenon where Na+ channel blockers bind more tightly during higher heart rates due to frequent channel openings.' },
        { term: 'Torsades de Pointes', definition: 'Polymorphic ventricular tachycardia triggered by early afterdepolarizations in the setting of excessive QT prolongation.' }
      ],
      feynmanPrompt: 'A physician trainee asks why Flecainide (Class 1c) is strictly avoided in a patient who had a myocardial infarction 6 months ago. Explain the mechanism simply.',
      sampleMasteryExplanation: 'Class 1C drugs bind Na+ channels very tightly and let go very slowly. In healthy tissue this slows conduction, but around an old ischemic scar from a heart attack, the conduction becomes dangerously sluggish. This creates an electrical detour where an impulse loops around the scar and re-enters the circuit, triggering lethal ventricular fibrillation.',
      retrievalCards: [
        {
          id: 'card-usmle-5',
          conceptId: 'c-usmle-3',
          cardType: 'multiple-choice',
          question: 'Why are Class Ic antiarrhythmics like Flecainide strictly contraindicated in patients with a history of myocardial infarction or ischemic heart disease?',
          options: [
            'Slow dissociation from Na+ channels promotes fatal re-entrant ventricular tachyarrhythmias around scar tissue',
            'They induce severe bradycardia by non-competitively blocking SA nodal pacemaker cells',
            'They cause pulmonary fibrosis and corneal microdeposits',
            'They precipitate hyperkalemia by inhibiting renal aldosterone secretion'
          ],
          answer: 'Slow dissociation from Na+ channels promotes fatal re-entrant ventricular tachyarrhythmias around scar tissue',
          explanation: 'Demonstrated in the landmark CAST trial: slow-unbinding Class 1C agents caused increased mortality when used to suppress ventricular ectopy post-MI.',
          stability: 1,
          difficulty: 5,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 3, snippet: 'Class Ic (Flecainide, Propafenone) strongly block Na+... contraindicated in structural or ischemic heart disease...', sourceName: 'USMLE_Step1_Cardiovascular_Core.pdf' }
        }
      ]
    }
  ]
};

export const MCAT_BIOCHEM_SESSION: StudySession = {
  id: 'mcat-biochem-kinetics',
  title: 'MCAT: Chemical & Physical Foundations — Enzyme Kinetics & Thermodynamics',
  category: 'STEM & Engineering',
  description: 'Mathematical and conceptual mastery of Michaelis-Menten kinetics, Lineweaver-Burk plots, competitive vs noncompetitive inhibition, and Gibbs free energy coupling.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: 'MCAT_Biochemistry_Physical_Foundations.pdf',
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'MICHAELIS-MENTEN EQUATION & CATALYTIC EFFICIENCY\n\nThe Michaelis-Menten velocity equation is expressed as: v0 = (Vmax × [S]) / (Km + [S]). The parameter Km (Michaelis constant) represents the substrate concentration at which the reaction velocity is exactly half of Vmax (0.5 Vmax). Km is an inverse measure of enzyme-substrate affinity; a low Km denotes high affinity because less substrate is required to achieve half-saturation. Turnover number kcat = Vmax / [E]total, representing the catalytic events per second per active site. Catalytic efficiency is the ratio kcat / Km; the upper limit of catalytic efficiency is bounded by the diffusion rate of substrate in water (approximately 10^8 to 10^9 M^-1 s^-1).'
      },
      {
        pageNumber: 2,
        text: 'LINEWEAVER-BURK PLOTS & REVERSIBLE INHIBITION MODES\n\nThe Lineweaver-Burk double reciprocal equation linearizes enzyme kinetics: 1/v0 = (Km/Vmax) × (1/[S]) + (1/Vmax). On this plot, the y-intercept is 1/Vmax, the x-intercept is -1/Km, and the slope is Km/Vmax.\n\n1. Competitive Inhibition: The inhibitor binds reversibly to the free enzyme active site, directly competing with substrate. Overcoming inhibition requires higher substrate concentration. Result: Km increases (apparent affinity decreases), while Vmax remains unchanged. The Lineweaver-Burk plot shows a steeper slope intersecting at the exact same y-intercept (1/Vmax).\n\n2. Noncompetitive (Allosteric) Inhibition: The inhibitor binds with equal affinity to both free enzyme (E) and enzyme-substrate complex (ES) at an allosteric site. Result: Km remains unchanged, while Vmax decreases. On the plot, the x-intercept (-1/Km) is unaltered, but the y-intercept shifts upward.\n\n3. Uncompetitive Inhibition: The inhibitor binds exclusively to the enzyme-substrate (ES) complex. Result: Both Km and Vmax decrease by the exact same factor, maintaining a constant slope (Km/Vmax). The plot displays parallel lines shifted upward and to the left.'
      },
      {
        pageNumber: 3,
        text: 'THERMODYNAMICS, EQUILIBRIUM & BUFFER SYSTEMS\n\nGibbs Free Energy is governed by ΔG = ΔH - TΔS. At standard physiological states (pH 7.0, 298 K), ΔG°\' = -RT ln Keq. If Keq > 1, ln Keq is positive and ΔG°\' is negative (exergonic, spontaneous). Enzymes accelerate reaction rates by lowering the activation energy (Ea) of the transition state; they never alter the equilibrium constant Keq, ΔH, or ΔG of a reaction.\n\nThe Henderson-Hasselbalch equation governs acid-base buffers: pH = pKa + log([A-]/[HA]). When [A-] = [HA], the ratio is 1, log(1) = 0, and pH = pKa. A buffer system possesses maximum buffering capacity within ±1 pH unit of its pKa. In blood plasma, the primary physiological buffer is the bicarbonate system: CO2 + H2O <-> H2CO3 <-> HCO3- + H+.'
      }
    ]
  },
  concepts: [
    {
      id: 'c-mcat-1',
      order: 1,
      title: 'Michaelis-Menten Kinetics & Catalytic Efficiency',
      estimatedMinutes: 10,
      mentalModel: 'Km is the gas pedal position where your car reaches half top speed. A lower Km means the car responds with minimal pedal pressure (high affinity).',
      sourceAnchor: {
        pageNumber: 1,
        snippet: 'The parameter Km represents the substrate concentration at which reaction velocity is exactly half of Vmax... Catalytic efficiency is kcat / Km.',
        sourceName: 'MCAT_Biochemistry_Physical_Foundations.pdf'
      },
      coreTakeaways: [
        'Km is the substrate concentration at 0.5 Vmax; lower Km = higher binding affinity.',
        'kcat (turnover number) = Vmax / [E]total; units are s^-1.',
        'Catalytic efficiency = kcat / Km; bounded by the aqueous diffusion limit (~10^8 - 10^9 M^-1 s^-1).'
      ],
      keyTerms: [
        { term: 'Km (Michaelis Constant)', definition: 'Substrate concentration at which initial reaction velocity equals half Vmax.' },
        { term: 'Catalytic Efficiency', definition: 'The ratio kcat / Km describing how effectively an enzyme converts substrate into product at low substrate concentrations.' }
      ],
      feynmanPrompt: 'Explain why a doctor or biochemist cares about both Vmax and Km when comparing a patient\'s normal metabolic enzyme to a mutated variant.',
      sampleMasteryExplanation: 'Vmax tells you how fast the enzyme can work when totally flooded with substrate, like a factory running at maximum throughput. Km tells you how sensitive the enzyme is in everyday conditions. If a mutation spikes Km tenfold, the factory can still pump out products at Vmax, but only when the body is overwhelmed with dangerous precursor toxins.',
      retrievalCards: [
        {
          id: 'card-mcat-1',
          conceptId: 'c-mcat-1',
          cardType: 'cloze',
          question: 'The Michaelis constant Km is defined as the substrate concentration at which the reaction velocity is equal to {{0.5 Vmax}} (or half maximal velocity).',
          clozeTemplate: 'The Michaelis constant Km is defined as the substrate concentration at which the reaction velocity is equal to {{0.5 Vmax}} (or half maximal velocity).',
          answer: '0.5 Vmax',
          hint: 'The fraction of maximal velocity used as the benchmark for Km.',
          explanation: 'At [S] = Km, the equation yields v0 = Vmax × Km / (Km + Km) = Vmax / 2.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'Km represents the substrate concentration at which the reaction velocity is exactly half of Vmax...', sourceName: 'MCAT_Biochemistry_Physical_Foundations.pdf' }
        },
        {
          id: 'card-mcat-2',
          conceptId: 'c-mcat-1',
          cardType: 'multiple-choice',
          question: 'Enzyme A has Km = 2 µM and kcat = 100 s^-1. Enzyme B has Km = 10 µM and kcat = 400 s^-1. Which enzyme possesses higher catalytic efficiency?',
          options: [
            'Enzyme A (Efficiency = 50 µM^-1 s^-1 vs Enzyme B = 40 µM^-1 s^-1)',
            'Enzyme B (Efficiency = 400 s^-1 vs Enzyme A = 100 s^-1)',
            'Both have equal catalytic efficiency',
            'Cannot be determined without knowing total enzyme concentration [E]t'
          ],
          answer: 'Enzyme A (Efficiency = 50 µM^-1 s^-1 vs Enzyme B = 40 µM^-1 s^-1)',
          explanation: 'Catalytic efficiency = kcat / Km. For Enzyme A: 100 / 2 = 50 µM^-1 s^-1. For Enzyme B: 400 / 10 = 40 µM^-1 s^-1. Enzyme A is superior.',
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'Catalytic efficiency is the ratio kcat / Km...', sourceName: 'MCAT_Biochemistry_Physical_Foundations.pdf' }
        }
      ]
    },
    {
      id: 'c-mcat-2',
      order: 2,
      title: 'Lineweaver-Burk Plots & Reversible Inhibition Modes',
      estimatedMinutes: 12,
      mentalModel: 'On 1/v vs 1/[S]: Competitive crosses the Y-axis at the same point (same Vmax). Noncompetitive crosses the X-axis at the same point (same Km). Uncompetitive makes parallel train tracks.',
      sourceAnchor: {
        pageNumber: 2,
        snippet: '1. Competitive Inhibition: Km increases while Vmax remains unchanged... 3. Uncompetitive Inhibition: Both Km and Vmax decrease by the exact same factor...',
        sourceName: 'MCAT_Biochemistry_Physical_Foundations.pdf'
      },
      coreTakeaways: [
        'Competitive: Km increases (apparent), Vmax unaffected, same y-intercept (1/Vmax).',
        'Noncompetitive: Vmax decreases, Km unchanged, same x-intercept (-1/Km).',
        'Uncompetitive: Both Vmax and Km decrease by same proportion, producing parallel shifted lines.'
      ],
      keyTerms: [
        { term: 'Uncompetitive Inhibition', definition: 'Inhibition mode where inhibitor binds solely to the enzyme-substrate (ES) complex, locking it in place and lowering both Km and Vmax.' },
        { term: 'Lineweaver-Burk Equation', definition: '1/v0 = (Km/Vmax)(1/[S]) + 1/Vmax, where y-intercept = 1/Vmax and x-intercept = -1/Km.' }
      ],
      feynmanPrompt: 'Explain how adding an excess bucket of substrate can completely overcome competitive inhibition, but cannot overcome noncompetitive inhibition.',
      sampleMasteryExplanation: 'In competitive inhibition, the inhibitor and substrate are fighting for the exact same front door (active site). If you flood the room with a million substrate molecules, the substrate outnumbers the inhibitor and wins the door, reaching full Vmax. In noncompetitive inhibition, the inhibitor enters a side door (allosteric site) and warps the lock, shutting down enzyme activity regardless of how much substrate surrounds it.',
      retrievalCards: [
        {
          id: 'card-mcat-3',
          conceptId: 'c-mcat-2',
          cardType: 'standard',
          question: 'What happens to the apparent Km and Vmax when an uncompetitive inhibitor binds to an enzyme-substrate complex?',
          answer: 'Both apparent Km and Vmax decrease by the exact same factor (slope Km/Vmax remains constant).',
          hint: 'Think about parallel lines on a Lineweaver-Burk double reciprocal plot.',
          explanation: 'Because the inhibitor binds only to ES, it depletes ES via Le Chatelier\'s principle, artificially boosting apparent affinity (lower Km) while sabotaging turnover (lower Vmax).',
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 2, snippet: '3. Uncompetitive Inhibition: Result: Both Km and Vmax decrease by the exact same factor...', sourceName: 'MCAT_Biochemistry_Physical_Foundations.pdf' }
        },
        {
          id: 'card-mcat-4',
          conceptId: 'c-mcat-2',
          cardType: 'cloze',
          question: 'On a Lineweaver-Burk plot, the y-intercept corresponds to {{1/Vmax}} and the x-intercept corresponds to {{-1/Km}}.',
          clozeTemplate: 'On a Lineweaver-Burk plot, the y-intercept corresponds to {{1/Vmax}} and the x-intercept corresponds to {{-1/Km}}.',
          answer: '1/Vmax ... -1/Km',
          hint: 'The double reciprocal mathematical constants.',
          explanation: 'Setting 1/[S] = 0 yields y = 1/Vmax; setting 1/v = 0 yields x = -1/Km.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 2, snippet: 'the y-intercept is 1/Vmax, the x-intercept is -1/Km...', sourceName: 'MCAT_Biochemistry_Physical_Foundations.pdf' }
        }
      ]
    }
  ]
};

export const CS_SYSTEMS_SESSION: StudySession = {
  id: 'cs-distributed-systems',
  title: 'Computer Science: Distributed Systems & Scalable Architecture',
  category: 'STEM & Engineering',
  description: 'Master fault-tolerant distributed systems: CAP/PACELC trade-offs, Raft consensus algorithm, consistent hashing, and LSM-Trees vs B-Trees in database engines.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: 'Distributed_Systems_Architecture_Guide.pdf',
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'SECTION 1: CAP THEOREM AND THE PACELC EXTENSION\n\nEric Brewer\'s CAP theorem asserts that a distributed data store can guarantee at most two out of three guarantees simultaneously: Consistency (every read receives the most recent write or an error), Availability (every non-failing node returns a non-error response without guarantee of recent write), and Partition Tolerance (the system continues to operate despite network packet loss or split-brain partitions). Because network partitions are physical inevitabilities in distributed hardware networks, a real-world system must choose between CP (Consistency over Availability) or AP (Availability over Consistency).\n\nDaniel Abadi\'s PACELC theorem expands CAP: If there is a Partition (P), how does your system trade off Availability (A) and Consistency (C); Else (E), when the network is running normally, how does your system trade off Latency (L) and Consistency (C)? For example, MongoDB and HBase are PC/EC systems (choose Consistency under partition, Consistency at the expense of Latency under normal operations), whereas Amazon Dynamo and Apache Cassandra are PA/EL systems.'
      },
      {
        pageNumber: 2,
        text: 'SECTION 2: RAFT CONSENSUS AND LEADER ELECTION\n\nRaft decomposes distributed consensus into three independent subproblems: Leader Election, Log Replication, and Safety. A cluster node operates in one of three states: Follower, Candidate, or Leader. Follower nodes expect periodic heartbeats (AppendEntries RPC) from the leader within an election timeout. To prevent split votes, Raft mandates randomized election timeouts (e.g., 150-300 ms).\n\nWhen a candidate initiates an election, it increments its term and requests votes. A candidate wins if it receives votes from a strict quorum (majority: (N/2)+1 nodes). Safety is guaranteed by the Log Completeness Property: a voter denies its vote if the candidate\'s log is less up-to-date than its own. Once an entry is committed (replicated on a majority), it will never be overwritten or rolled back by subsequent leaders.'
      },
      {
        pageNumber: 3,
        text: 'SECTION 3: STORAGE ENGINES — B-TREES VS LSM-TREES\n\nTraditional relational databases (PostgreSQL, InnoDB MySQL) utilize B-Trees (specifically B+ Trees). B-Trees organize disk blocks into balanced pages. They excel at read performance (O(log N)) and range scans because leaf nodes are linked in order. However, random writes require in-place disk page modification, generating random I/O and write amplification.\n\nModern distributed databases (Cassandra, RocksDB, Bigtable) utilize Log-Structured Merge (LSM) Trees. In an LSM-Tree, incoming writes are appended sequentially to a Write-Ahead Log (WAL) on disk for durability, and inserted into an in-memory balanced tree called a MemTable. When the MemTable exceeds a threshold (e.g. 64 MB), it is flushed sequentially to disk as an immutable Sorted String Table (SSTable). Because writes are 100% sequential, LSM-Trees provide exceptional write throughput. Background compaction merges redundant SSTables and purges tombstones.'
      }
    ]
  },
  concepts: [
    {
      id: 'c-cs-1',
      order: 1,
      title: 'CAP Theorem & PACELC Trade-Offs',
      estimatedMinutes: 10,
      mentalModel: 'CAP is the fire alarm: when the wire cuts (P), do you stop giving out stale books (CP) or hand out whatever you have even if outdated (AP)? PACELC adds: on sunny days without fire (E), do you check with everyone first (C) or answer instantly (L)?',
      sourceAnchor: {
        pageNumber: 1,
        snippet: 'PACELC theorem expands CAP: If there is a Partition (P), trade off A vs C; Else (E), trade off Latency (L) vs Consistency (C)...',
        sourceName: 'Distributed_Systems_Architecture_Guide.pdf'
      },
      coreTakeaways: [
        'Partition tolerance (P) is mandatory across physical networks; distributed systems must choose CP or AP.',
        'PACELC covers normal operations (Else): trade-off between Latency (L) and Consistency (C).',
        'Dynamo/Cassandra = PA/EL (Availability & low Latency); Spanner/HBase = PC/EC (Strict linearizability).'
      ],
      keyTerms: [
        { term: 'PACELC Theorem', definition: 'Extension of CAP demonstrating that systems trade off Latency vs Consistency even when no partition exists.' },
        { term: 'Linearizability (Strong Consistency)', definition: 'Guarantee that once a write completes, all subsequent reads across all nodes immediately observe that write.' }
      ],
      feynmanPrompt: 'Explain why Amazon Shopping Cart chose high availability (AP) over strong consistency (CP) during network partitions, and how they resolve conflicting cart writes later.',
      sampleMasteryExplanation: 'Amazon never wants to block a customer from clicking "Add to Cart" during a network hiccup, because a failed button click loses revenue. In an AP design, both partitioned servers let the customer add items. When the network reconnects, Amazon merges the carts rather than throwing away either write, accepting temporary duplicate items rather than a lost sale.',
      retrievalCards: [
        {
          id: 'card-cs-1',
          conceptId: 'c-cs-1',
          cardType: 'multiple-choice',
          question: 'According to the PACELC theorem, what does the "EL" designation signify in a system like Apache Cassandra (PA/EL)?',
          options: [
            'Else (when no network partition exists), the system prioritizes Low Latency over Strong Consistency',
            'Election Latency: The leader election duration is minimized',
            'Eventual Locking: Mutexes expire after a predictable timeout',
            'Elastic Load: The system autoscales worker threads based on memory bounds'
          ],
          answer: 'Else (when no network partition exists), the system prioritizes Low Latency over Strong Consistency',
          explanation: 'PACELC: If Partition -> Availability over Consistency; Else (normal operation) -> Latency over Consistency.',
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'Else (E), when the network is running normally, how does your system trade off Latency (L) and Consistency (C)?', sourceName: 'Distributed_Systems_Architecture_Guide.pdf' }
        }
      ]
    },
    {
      id: 'c-cs-2',
      order: 2,
      title: 'LSM-Trees vs B-Trees in Storage Engines',
      estimatedMinutes: 12,
      mentalModel: 'A B-Tree is a meticulously filed library cabinet that requires walking to the exact drawer for every single new book (high random I/O). An LSM-Tree is a notebook where you scribble every new entry on the next clean line, and file them into binders later in batches.',
      sourceAnchor: {
        pageNumber: 3,
        snippet: 'In an LSM-Tree, incoming writes are appended sequentially to a Write-Ahead Log (WAL)... flushed sequentially to disk as an immutable SSTable...',
        sourceName: 'Distributed_Systems_Architecture_Guide.pdf'
      },
      coreTakeaways: [
        'B-Trees write pages in-place, offering fast O(log N) reads but suffering random disk I/O on heavy writes.',
        'LSM-Trees convert random writes into sequential writes via in-memory MemTable and disk SSTables.',
        'LSM-Trees use Bloom filters to avoid checking every SSTable file for non-existent keys during reads.'
      ],
      keyTerms: [
        { term: 'Sorted String Table (SSTable)', definition: 'An immutable disk file containing keys and values sorted in lexical order.' },
        { term: 'MemTable', definition: 'In-memory write buffer (usually a Red-Black or SkipList tree) that stages writes before sequential flushing.' }
      ],
      feynmanPrompt: 'Explain how an LSM-Tree handles deleting a key without violating its append-only sequential write rule.',
      sampleMasteryExplanation: 'In an append-only system, you never go back and erase old bytes on disk. Instead, when a delete command arrives, the LSM-Tree writes a special marker called a "Tombstone" into the MemTable. When a read comes in, finding the tombstone tells the engine the key is gone. Later, during background compaction, the engine merges SSTables and discards both the tombstone and the deleted record.',
      retrievalCards: [
        {
          id: 'card-cs-2',
          conceptId: 'c-cs-2',
          cardType: 'cloze',
          question: 'In an LSM-Tree storage engine, a deletion is handled by writing a special marker called a {{tombstone}} sequentially to the log.',
          clozeTemplate: 'In an LSM-Tree storage engine, a deletion is handled by writing a special marker called a {{tombstone}} sequentially to the log.',
          answer: 'tombstone',
          hint: 'The graveyard marker used in append-only storage systems.',
          explanation: 'Tombstones hide the deleted key during queries and allow physical garbage collection during SSTable compaction.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 3, snippet: 'Background compaction merges redundant SSTables and purges tombstones.', sourceName: 'Distributed_Systems_Architecture_Guide.pdf' }
        }
      ]
    }
  ]
};

export const AP_BIO_SESSION: StudySession = {
  id: 'ap-bio-cellular-mechanisms',
  title: 'AP Biology: Bioenergetics, Cellular Respiration & CRISPR-Cas9',
  category: 'Biochemistry & Life Sciences',
  description: 'Master mitochondrial chemiosmosis, electron transport chain complexes, ATP yields, and CRISPR-Cas9 targeted genome editing.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: 'AP_Biology_Cellular_Genetics_Handbook.pdf',
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'OXIDATIVE PHOSPHORYLATION & CHEMIOSMOSIS\n\nCellular respiration culminates in the inner mitochondrial membrane with the Electron Transport Chain (ETC). High-energy electrons donated by NADH (Complex I) and FADH2 (Complex II) flow down an electrochemical cascade through ubiquinone, Complex III, cytochrome c, and Complex IV to the terminal electron acceptor, molecular oxygen (O2), which is reduced to water (H2O).\n\nAs electrons traverse Complexes I, III, and IV, protons (H+) are actively pumped from the mitochondrial matrix into the intermembrane space, generating a steep Proton-Motive Force composed of both a chemical gradient (ΔpH) and an electrical membrane potential (ΔΨ). Protons re-enter the matrix exclusively via ATP Synthase (F0F1 complex). The physical passage of protons through the F0 rotor induces mechanical rotation of the F1 catalytic headpiece, phosphorylating ADP and inorganic phosphate (Pi) into ATP.'
      },
      {
        pageNumber: 2,
        text: 'CRISPR-CAS9 TARGETED GENOME EDITING\n\nCRISPR (Clustered Regularly Interspaced Short Palindromic Repeats) and Cas9 endonuclease constitute an adaptive immune mechanism adapted from Streptococcus pyogenes for targeted molecular biology. Cas9 endonuclease is directed to a specific genomic locus by a single guide RNA (sgRNA), formed by fusing CRISPR RNA (crRNA) and trans-activating crRNA (tracrRNA).\n\nCrucially, Cas9 will only bind and cleave double-stranded DNA if the target sequence is immediately adjacent to a Protospacer Adjacent Motif (PAM). For SpCas9, the PAM sequence is 5\'-NGG-3\'. Once positioned, Cas9 creates a blunt double-strand break (DSB) exactly 3 base pairs upstream of the PAM. Host cellular repair via Non-Homologous End Joining (NHEJ) causes indels for gene knockout, or Homology-Directed Repair (HDR) enables precise gene insertion.'
      },
      {
        pageNumber: 3,
        text: 'DNA REPLICATION LAGGING STRAND SYNTHESIS\n\nDNA polymerases can only synthesize polynucleotide chains in the 5\' to 3\' direction, adding nucleotides to a free 3\'-OH group. Because antiparallel parental strands unwind simultaneously at the replication fork, the lagging strand must be synthesized discontinuously away from the advancing fork.\n\nRNA Primase synthesizes short RNA primers. DNA Polymerase III extends these primers into Okazaki fragments (1,000-2,000 nucleotides in prokaryotes; 100-200 in eukaryotes). DNA Polymerase I removes the RNA primers using 5\' to 3\' exonuclease activity and fills the resulting gaps with deoxyribonucleotides. Finally, DNA Ligase catalyzes phosphodiester bonds to seal the remaining nicks between fragments.'
      }
    ]
  },
  concepts: [
    {
      id: 'c-apbio-1',
      order: 1,
      title: 'Chemiosmosis & The Proton-Motive Force',
      estimatedMinutes: 10,
      mentalModel: 'Complexes I, III, IV are water pumps forcing water uphill into a reservoir (the intermembrane space). ATP Synthase is the hydroelectric dam turbine that spins as water rushes back down.',
      sourceAnchor: {
        pageNumber: 1,
        snippet: 'As electrons traverse Complexes I, III, and IV, protons (H+) are actively pumped... generating a steep Proton-Motive Force...',
        sourceName: 'AP_Biology_Cellular_Genetics_Handbook.pdf'
      },
      coreTakeaways: [
        'Electrons from NADH enter Complex I; electrons from FADH2 enter Complex II (which does not pump protons).',
        'Complexes I, III, and IV pump protons into the intermembrane space, creating a proton gradient.',
        'ATP Synthase uses the kinetic energy of proton re-entry to mechanically rotate and phosphorylate ADP + Pi -> ATP.'
      ],
      keyTerms: [
        { term: 'Proton-Motive Force', definition: 'The electrochemical energy stored across the inner mitochondrial membrane resulting from proton pumping by the ETC.' },
        { term: 'ATP Synthase (F0F1)', definition: 'Rotary nanomachine that converts electrochemical proton flux into chemical ATP bonds.' }
      ],
      feynmanPrompt: 'Explain how cyanide gas kills an animal by targeting the electron transport chain, and why ATP production halts immediately.',
      sampleMasteryExplanation: 'Cyanide irreversibly binds the iron in Complex IV, freezing the bucket brigade of electrons. Because Complex IV cannot pass electrons to oxygen, the upstream complexes back up with electrons and can no longer pump protons. Without a proton gradient, the water in the dam dries up, ATP Synthase stops spinning, and cells run out of energy within minutes.',
      retrievalCards: [
        {
          id: 'card-apbio-io-1',
          conceptId: 'c-apbio-1',
          cardType: 'image-occlusion',
          question: 'Identify key cellular components of membrane potential and synaptic chemical transmission.',
          answer: 'Presynaptic terminal, voltage-gated calcium channels, synaptic vesicles, synaptic cleft, and neurotransmitter receptors.',
          imageUrl: SYNAPSE_SVG,
          occlusionMode: 'hide-all-reveal-one',
          activeMaskId: 'm-s1',
          masks: [
            { id: 'm-s1', x: 3, y: 32, width: 28, height: 6, label: 'Voltage-Gated Ca2+ Channel', hint: 'Opens upon membrane depolarization to trigger vesicle exocytosis' },
            { id: 'm-s2', x: 62, y: 26, width: 20, height: 6, label: 'Synaptic Vesicles', hint: 'Store neurotransmitter molecules before fusion' },
            { id: 'm-s3', x: 4, y: 58, width: 25, height: 6, label: 'Synaptic Cleft', hint: 'Extracellular gap traversed by diffusing chemical messengers' },
            { id: 'm-s4', x: 67, y: 74, width: 30, height: 6, label: 'Neurotransmitter Receptors', hint: 'Ligand-gated channels on the postsynaptic membrane' }
          ],
          stability: 1,
          difficulty: 4,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'CELLULAR RESPIRATION & ELECTROCHEMICAL POTENTIALS...', sourceName: 'AP_Biology_Cellular_Genetics_Handbook.pdf' }
        },
        {
          id: 'card-apbio-1',
          conceptId: 'c-apbio-1',
          cardType: 'cloze',
          question: 'The final electron acceptor in the mitochondrial electron transport chain is {{molecular oxygen (O2)}}, which is reduced to form {{water (H2O)}}.',
          clozeTemplate: 'The final electron acceptor in the mitochondrial electron transport chain is {{molecular oxygen (O2)}}, which is reduced to form {{water (H2O)}}.',
          answer: 'molecular oxygen (O2) ... water (H2O)',
          hint: 'What we breathe in and what by-product forms at Complex IV.',
          explanation: 'Four electrons and four protons reduce one molecule of O2 into two molecules of H2O.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'terminal electron acceptor, molecular oxygen (O2), which is reduced to water (H2O)...', sourceName: 'AP_Biology_Cellular_Genetics_Handbook.pdf' }
        }
      ]
    },
    {
      id: 'c-apbio-2',
      order: 2,
      title: 'CRISPR-Cas9 Mechanism & The PAM Requirement',
      estimatedMinutes: 10,
      mentalModel: 'The guide RNA is a wanted poster showing the criminal\'s exact face. The PAM sequence is the required stamp from the police department: if the target DNA doesn\'t have the NGG stamp next to it, Cas9 won\'t make the cut.',
      sourceAnchor: {
        pageNumber: 2,
        snippet: 'Cas9 will only bind and cleave double-stranded DNA if the target sequence is immediately adjacent to a Protospacer Adjacent Motif (PAM)... 5\'-NGG-3\'.',
        sourceName: 'AP_Biology_Cellular_Genetics_Handbook.pdf'
      },
      coreTakeaways: [
        'Single guide RNA (sgRNA) contains ~20 nucleotides matching the target genomic DNA sequence.',
        'Cas9 requires an adjacent PAM motif (5\'-NGG-3\' for SpCas9) to license double-strand cleavage.',
        'Cleavage occurs 3 base pairs upstream of the PAM, creating a blunt double-strand break.'
      ],
      keyTerms: [
        { term: 'PAM (Protospacer Adjacent Motif)', definition: 'Short 2-6 bp DNA sequence immediately following the DNA sequence targeted by the Cas9 nuclease.' },
        { term: 'Non-Homologous End Joining (NHEJ)', definition: 'Error-prone DNA repair pathway that stitches broken DNA ends together, frequently causing frameshift knockouts.' }
      ],
      feynmanPrompt: 'Explain why the bacteria that evolved CRISPR-Cas9 don\'t accidentally chop up their own CRISPR array in their own bacterial genome.',
      sampleMasteryExplanation: 'The bacterial immune system stores viral spacer mugshots in its CRISPR array, but those bacterial DNA repeats intentionally lack the 5\'-NGG PAM motif. When Cas9 scans the bacterial chromosome, it doesn\'t see the required PAM license, so it cannot cut its own DNA. Only invading viral DNA contains both the matching sequence and the viral PAM sequence.',
      retrievalCards: [
        {
          id: 'card-apbio-2',
          conceptId: 'c-apbio-2',
          cardType: 'multiple-choice',
          question: 'What is the required Protospacer Adjacent Motif (PAM) sequence for standard Streptococcus pyogenes Cas9 (SpCas9)?',
          options: [
            '5\'-NGG-3\'',
            '5\'-TATA-3\'',
            '5\'-AAG-3\'',
            '5\'-CCCA-3\''
          ],
          answer: '5\'-NGG-3\'',
          explanation: 'SpCas9 recognizes any nucleotide followed by two guanines (5\'-NGG-3\') on the non-target strand.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 2, snippet: 'For SpCas9, the PAM sequence is 5\'-NGG-3\'.', sourceName: 'AP_Biology_Cellular_Genetics_Handbook.pdf' }
        }
      ]
    }
  ]
};

export const SPANISH_POLYGLOT_SESSION: StudySession = {
  id: 'spanish-polyglot-core',
  title: 'Polyglot Spanish: 1,000 High-Frequency Core Syntax & Vocab',
  category: 'Languages & Polyglot',
  description: 'Master conversational Spanish: the WEIRDOS subjunctive triggers, Por vs Para disambiguation, and essential high-yield discourse connectors.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: 'Spanish_High_Yield_Syntax_and_Vocab.pdf',
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'THE SUBJUNCTIVE MOOD & THE WEIRDOS ACRONYM\n\nIn Spanish, the subjunctive mood does not express objective real-world facts (which use the Indicative); rather, it expresses subjective reality, doubt, desire, hypothetical situations, and emotional reactions. A subjunctive construction typically requires two different subjects joined by the relative pronoun "que".\n\nThe trigger verbs follow the WEIRDOS mnemonic:\n- W (Wishes/Desires): querer, desear, esperar (e.g., "Quiero que vengas").\n- E (Emotions): alegrarse de, temer, sentir (e.g., "Me alegro de que estés bien").\n- I (Impersonal Expressions): es necesario que, es importante que (e.g., "Es necesario que estudies").\n- R (Recommendations): sugerir, recomendar (e.g., "Te recomiendo que leas este libro").\n- D (Doubt/Denial): dudar, no creer, negar (e.g., "Dudo que sea verdad").\n- O (Ojalá): expressing strong hope (e.g., "¡Ojalá llueva!").'
      },
      {
        pageNumber: 2,
        text: 'POR VS PARA CONTEXTUAL DISAMBIGUATION\n\nBoth "por" and "para" translate to "for" in English, but represent fundamentally distinct cognitive dimensions.\n\nUse "PARA" for Destination, Deadlines, and Goals (the recipient or end-point):\n1. Purpose / In order to: "Estudio para aprender" (Study in order to learn).\n2. Recipient: "Este regalo es para ti" (This gift is for you).\n3. Destination: "Salgo para Madrid" (I leave towards Madrid).\n4. Specific Deadline: "La tarea es para el lunes" (The homework is due for Monday).\n\nUse "POR" for Cause, Motive, Exchange, Duration, and Medium:\n1. Cause / Reason why: "Lo hice por ti" (I did it because of / out of love for you).\n2. Duration of time: "Viví allí por dos años" (I lived there for two years).\n3. Exchange / Price: "Te doy 20 euros por el libro" (I give you 20 euros in exchange for the book).\n4. Means of communication or transit: "Hablamos por teléfono" / "Paseamos por el parque".'
      },
      {
        pageNumber: 3,
        text: 'DISCOURSE CONNECTORS & HIGH-FREQUENCY FALSE COGNATES\n\nFluid Spanish communication depends on high-register connectors:\n- "Sin embargo" (However / Nonetheless)\n- "Por lo tanto" (Therefore / Consequently)\n- "A pesar de que" (In spite of / Even though)\n- "En cuanto" (As soon as — triggers subjunctive for future events: "En cuanto llegue...")\n\nWatch out for treacherous False Friends (Falsos Amigos):\n- "Actualmente" means "currently / nowadays" (NOT "actually", which is "en realidad").\n- "Embarazada" means "pregnant" (NOT "embarrassed", which is "avergonzada").\n- "Constipado" means "having a head cold" (NOT "constipated", which is "estreñido").\n- "Éxito" means "success" (NOT "exit", which is "salida").'
      }
    ]
  },
  concepts: [
    {
      id: 'c-es-1',
      order: 1,
      title: 'The WEIRDOS Subjunctive Mood Triggers',
      estimatedMinutes: 10,
      mentalModel: 'The indicative states what is happening on the ground; the subjunctive enters someone\'s head — their hopes, fears, doubts, and wishes about what should happen.',
      sourceAnchor: {
        pageNumber: 1,
        snippet: 'The trigger verbs follow the WEIRDOS mnemonic: Wishes, Emotions, Impersonal, Recommendations, Doubt, Ojalá...',
        sourceName: 'Spanish_High_Yield_Syntax_and_Vocab.pdf'
      },
      coreTakeaways: [
        'Subjunctive requires two clauses with different subjects connected by "que".',
        'WEIRDOS: Wishes, Emotions, Impersonal expressions, Recommendations, Doubt/Denial, Ojalá.',
        'Belief uses indicative ("Creo que es verdad"); doubt triggers subjunctive ("No creo que sea verdad").'
      ],
      keyTerms: [
        { term: 'Subjunctive Mood', definition: 'Verb mood used in subordinate clauses to express non-factual, subjective, or doubtful actions.' },
        { term: 'Doubt Trigger', definition: 'Verbs like "dudar" or negated belief "no creer" that prompt subjunctive conjugation.' }
      ],
      feynmanPrompt: 'Explain why "Creo que Juan viene hoy" uses indicative (viene), but "No creo que Juan venga hoy" flips into the subjunctive (venga).',
      sampleMasteryExplanation: 'When you say "Creo que viene", you are declaring an objective fact from your perspective: you believe it is true in the real world. But when you negate it to "No creo que venga", you inject uncertainty and doubt into the sentence, which Spanish requires you to mark with the subjunctive verb mood.',
      retrievalCards: [
        {
          id: 'card-es-1',
          conceptId: 'c-es-1',
          cardType: 'cloze',
          question: 'Complete the sentence with the subjunctive of "tener": "Es necesario que tú {{tengas}} paciencia."',
          clozeTemplate: 'Es necesario que tú {{tengas}} paciencia.',
          answer: 'tengas',
          hint: 'Second-person singular subjunctive of tener.',
          explanation: '"Es necesario que..." is an impersonal WEIRDOS expression that mandates subjunctive.',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'Impersonal Expressions: es necesario que, es importante que...', sourceName: 'Spanish_High_Yield_Syntax_and_Vocab.pdf' }
        },
        {
          id: 'card-es-2',
          conceptId: 'c-es-1',
          cardType: 'multiple-choice',
          question: 'Which of the following Spanish sentences correctly uses the subjunctive mood?',
          options: [
            'Dudo que ellos sepan la verdad.',
            'Sé que ellos sepan la verdad.',
            'Es obvio que ellos sepan la verdad.',
            'Pienso que ellos sepan la verdad.'
          ],
          answer: 'Dudo que ellos sepan la verdad.',
          explanation: '"Dudar que..." introduces doubt and mandates subjunctive ("sepan"), whereas "saber", "es obvio", and "pensar" are affirmative declarations requiring indicative ("saben").',
          stability: 1,
          difficulty: 3,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 1, snippet: 'D (Doubt/Denial): dudar, no creer, negar (e.g., "Dudo que sea verdad").', sourceName: 'Spanish_High_Yield_Syntax_and_Vocab.pdf' }
        }
      ]
    },
    {
      id: 'c-es-2',
      order: 2,
      title: 'Por vs Para Contextual Disambiguation',
      estimatedMinutes: 10,
      mentalModel: 'Para points forward like an arrow towards an arrow target (destination, goal, deadline). Por looks backward or around (cause, through, duration, exchange).',
      sourceAnchor: {
        pageNumber: 2,
        snippet: 'Use PARA for Destination, Deadlines, and Goals... Use POR for Cause, Motive, Exchange, Duration...',
        sourceName: 'Spanish_High_Yield_Syntax_and_Vocab.pdf'
      },
      coreTakeaways: [
        'Para = Purpose (in order to), Recipient, Destination, Strict Deadline.',
        'Por = Reason/Motive, Exchange/Cost, Duration of time, By means of.',
        '"Estudio para aprender" (goal) vs "Gracias por tu ayuda" (reason/gratitude).'
      ],
      keyTerms: [
        { term: 'Para', definition: 'Preposition indicating destination, recipient, purpose, or deadline.' },
        { term: 'Por', definition: 'Preposition indicating cause, motivation, duration, exchange, or transit.' }
      ],
      feynmanPrompt: 'Contrast the meaning of "Trabajo para Juan" versus "Trabajo por Juan".',
      sampleMasteryExplanation: '"Trabajo para Juan" means Juan is your boss or the recipient of your work. "Trabajo por Juan" means Juan is sick today, so you are covering his work shift in his place, or doing it out of love and concern for him.',
      retrievalCards: [
        {
          id: 'card-es-3',
          conceptId: 'c-es-2',
          cardType: 'cloze',
          question: 'Complete the sentence with por or para: "Tengo que terminar el informe {{para}} el viernes."',
          clozeTemplate: 'Tengo que terminar el informe {{para}} el viernes.',
          answer: 'para',
          hint: 'Friday is a strict deadline/endpoint in time.',
          explanation: '"Para" indicates deadlines and future target dates.',
          stability: 1,
          difficulty: 2,
          reps: 0,
          lapses: 0,
          sourceAnchor: { pageNumber: 2, snippet: 'Specific Deadline: "La tarea es para el lunes"', sourceName: 'Spanish_High_Yield_Syntax_and_Vocab.pdf' }
        }
      ]
    }
  ]
};

export const CURATED_STARTER_DECKS: StarterDeckMetadata[] = [
  {
    id: 'usmle-cardio-pathophysiology',
    title: 'USMLE Step 1: Cardiovascular Pathophysiology & Arrhythmia Dynamics',
    category: 'Medical & Clinical',
    difficulty: 'High-Yield Board Review',
    estimatedMinutes: 34,
    cardCount: 6,
    conceptCount: 3,
    hasImageOcclusion: true,
    hasSourcePdf: true,
    tags: ['Cardiology', 'USMLE Step 1', 'Pharmacology', 'Hemodynamics', 'Image Occlusion'],
    verifiedBy: 'USMLE Step 1 Clinical Benchmark',
    targetAudience: 'Medical students, USMLE Step 1 / COMLEX candidates, Cardiology fellows',
    summary: 'Clinical board review of cardiac action potential phases, Wiggers PV loops, Laplace wall stress, Vaughan Williams antiarrhythmic pharmacology, and anatomical image occlusion of the heart.',
    session: USMLE_CARDIO_SESSION
  },
  {
    id: 'mcat-biochem-kinetics',
    title: 'MCAT: Chemical & Physical Foundations — Kinetics & Thermodynamics',
    category: 'STEM & Engineering',
    difficulty: 'Intermediate',
    estimatedMinutes: 28,
    cardCount: 4,
    conceptCount: 2,
    hasImageOcclusion: false,
    hasSourcePdf: true,
    tags: ['Biochemistry', 'MCAT', 'Enzyme Kinetics', 'Thermodynamics', 'Lineweaver-Burk'],
    verifiedBy: 'AAMC MCAT Physical Sciences Standard',
    targetAudience: 'Pre-med students, Biochemistry & Biophysics undergraduates',
    summary: 'Master Michaelis-Menten kinetics, catalytic efficiency (kcat/Km), competitive/uncompetitive Lineweaver-Burk plots, Gibbs free energy coupling, and Henderson-Hasselbalch buffers.',
    session: MCAT_BIOCHEM_SESSION
  },
  {
    id: 'cs-distributed-systems',
    title: 'Computer Science: Distributed Systems & Scalable Architecture',
    category: 'STEM & Engineering',
    difficulty: 'Intermediate',
    estimatedMinutes: 30,
    cardCount: 3,
    conceptCount: 2,
    hasImageOcclusion: false,
    hasSourcePdf: true,
    tags: ['System Design', 'Distributed Systems', 'CAP Theorem', 'LSM-Trees', 'Consensus'],
    verifiedBy: 'ACM Distributed Computing Benchmark',
    targetAudience: 'Software engineers, System architects, CS undergrads & interview candidates',
    summary: 'Core principles of fault-tolerant systems: CAP & PACELC theorems, Raft leader election, consistent hashing, and LSM-Trees vs B-Trees in storage engines.',
    session: CS_SYSTEMS_SESSION
  },
  {
    id: 'ap-bio-cellular-mechanisms',
    title: 'AP Biology: Bioenergetics, Cellular Respiration & CRISPR-Cas9',
    category: 'Biochemistry & Life Sciences',
    difficulty: 'Foundational',
    estimatedMinutes: 26,
    cardCount: 3,
    conceptCount: 2,
    hasImageOcclusion: true,
    hasSourcePdf: true,
    tags: ['AP Biology', 'Mitochondria', 'Chemiosmosis', 'CRISPR-Cas9', 'DNA Replication'],
    verifiedBy: 'College Board AP Biology Curriculum Benchmark',
    targetAudience: 'AP Biology students, Molecular Biology undergraduates, Science enthusiasts',
    summary: 'Cellular ATP generation via mitochondrial chemiosmosis and proton-motive force, CRISPR-Cas9 targeted double-strand breaks with PAM motifs, and synaptic transmission image occlusion.',
    session: AP_BIO_SESSION
  },
  {
    id: 'spanish-polyglot-core',
    title: 'Polyglot Spanish: 1,000 High-Frequency Core Syntax & Vocab',
    category: 'Languages & Polyglot',
    difficulty: 'Foundational',
    estimatedMinutes: 24,
    cardCount: 3,
    conceptCount: 2,
    hasImageOcclusion: false,
    hasSourcePdf: true,
    tags: ['Spanish', 'CEFR B1-B2', 'Subjunctive', 'Por vs Para', 'Language Acquisition'],
    verifiedBy: 'Instituto Cervantes CEFR B1-B2 Communicative Framework',
    targetAudience: 'Spanish language learners, Travelers, DELE/SIELE B1-B2 exam candidates',
    summary: 'Accelerate Spanish conversational fluency with high-yield WEIRDOS subjunctive triggers, Por vs Para disambiguation, discourse markers, and treacherous false cognates.',
    session: SPANISH_POLYGLOT_SESSION
  },
  {
    id: 'demo-memory-neuroscience',
    title: 'The Neuroscience of Memory & Spaced Retrieval',
    category: 'Cognitive & Behavioral Science',
    difficulty: 'High-Yield Board Review',
    estimatedMinutes: 30,
    cardCount: DEMO_STUDY_SESSIONS[0].concepts.reduce((a, b) => a + b.retrievalCards.length, 0),
    conceptCount: DEMO_STUDY_SESSIONS[0].concepts.length,
    hasImageOcclusion: false,
    hasSourcePdf: true,
    tags: ['Neuroscience', 'FSRS', 'Memory Consolidation', 'Active Recall', 'Cognitive Science'],
    verifiedBy: 'Cognitive Neuroscience Learning Benchmark',
    targetAudience: 'All students, cognitive scientists, educators, memory competitors',
    summary: DEMO_STUDY_SESSIONS[0].description,
    session: DEMO_STUDY_SESSIONS[0]
  }
];
