import type { StarterDeckMetadata, StudySession } from '../types';
import { DEMO_STUDY_SESSIONS } from './demoDecks';
import { ELECTRON_TRANSPORT_DIAGRAM, HEART_DIAGRAM, diagramCards } from './diagrams';
import { quickCards } from './quickCards';

// The decks' source notes were written for Studify; they are not excerpts of any published book or exam.
const CARDIO_NOTES = 'Studify notes: Cardiovascular physiology';
const MCAT_NOTES = 'Studify notes: Enzyme kinetics and thermodynamics';
const SYSTEMS_NOTES = 'Studify notes: Distributed systems';
const BIO_NOTES = 'Studify notes: Cellular respiration and genetics';
const SPANISH_NOTES = 'Studify notes: Spanish grammar';

export const USMLE_CARDIO_SESSION: StudySession = {
  id: 'usmle-cardio-pathophysiology',
  title: 'Cardiovascular Physiology & Antiarrhythmics (USMLE Step 1 review)',
  category: 'Medical & Clinical',
  description: 'Board-style review of the cardiac action potential, pressure-volume loops, preload, afterload and contractility, and antiarrhythmic drug classes.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: CARDIO_NOTES,
    totalPages: 4,
    pages: [
      {
        pageNumber: 1,
        text: 'CARDIOVASCULAR PHYSIOLOGY & ELECTROPHYSIOLOGY\n\nThe ventricular myocyte action potential consists of five distinct phases (0 through 4). Phase 0 (Rapid Depolarization) is mediated by the massive opening of voltage-gated Na+ channels. Phase 1 (Initial Repolarization) occurs via inactivation of Na+ channels and transient activation of outward Ito K+ currents. Phase 2 (Plateau Phase) reflects an exact electrical balance between inward Ca2+ influx via L-type channels and outward K+ efflux via delayed rectifier channels (IKr and IKs). This sustained plateau prolongs the absolute refractory period, preventing tetanic contraction. Phase 3 (Rapid Repolarization) ensues when L-type Ca2+ channels close while delayed rectifier K+ channels dominate. Phase 4 establishes the resting membrane potential (-85 to -90 mV) predominantly via inward rectifier K+ channels (IK1).\n\nPacemaker cells of the SA node behave differently. Their Phase 4 drifts upward because of the funny current (If), a mixed inward Na+/K+ current through HCN channels that opens on hyperpolarization. Their Phase 0 upstroke is carried by Ca2+ through L-type channels rather than fast Na+ channels. In ventricular myocytes, Ca2+ entering during the plateau triggers calcium-induced calcium release from the sarcoplasmic reticulum through ryanodine receptors (RyR2). On the ECG, the QT interval spans ventricular depolarization and repolarization.'
      },
      {
        pageNumber: 2,
        text: 'HEMODYNAMICS & WIGGERS PRESSURE-VOLUME LOOPS\n\nIn the left ventricular pressure-volume loop, Point A represents mitral valve closure, marking the onset of isovolumetric contraction. During this phase, ventricular pressure escalates rapidly while ventricular volume remains strictly unchanged. Point B marks aortic valve opening, transitioning into the rapid ejection phase. Point C indicates aortic valve closure (producing the second heart sound, S2), followed by isovolumetric relaxation down to Point D where mitral valve opening allows ventricular diastolic filling. Stroke volume (SV) is mathematically defined as End-Diastolic Volume (EDV) minus End-Systolic Volume (ESV). Laplace\'s law dictates that ventricular wall stress = (Pressure × Radius) / (2 × Wall Thickness). Concentric hypertrophy increases wall thickness to normalize elevated systolic pressure.\n\nEjection fraction (EF) equals SV / EDV, normally about 55-70%. The area inside the pressure-volume loop is the stroke work. Pressure overload (hypertension, aortic stenosis) adds sarcomeres in parallel, producing concentric hypertrophy; volume overload (valve regurgitation) adds sarcomeres in series, producing eccentric hypertrophy and a dilated chamber. With increased afterload the loop becomes taller (higher systolic pressure) and narrower (smaller stroke volume).'
      },
      {
        pageNumber: 3,
        text: 'VAUGHAN WILLIAMS ANTIARRHYTHMIC PHARMACOLOGY\n\nClass I antiarrhythmics are Na+ channel blockers. Class Ia (Quinidine, Procainamide, Disopyramide) moderately block Na+ and prolong action potential duration (APD) and QT interval by also blocking K+ channels. Class Ib (Lidocaine, Mexiletine) weakly block Na+ with rapid dissociation; they preferential target ischemic depolarized Purkinje tissue and shorten APD. Class Ic (Flecainide, Propafenone) strongly block Na+ with slow dissociation, markedly prolonging QRS without altering APD; they are contraindicated in structural or ischemic heart disease due to proarrhythmic risk. Class II drugs are Beta-blockers, decreasing SA and AV nodal conduction. Class III agents (Amiodarone, Sotalol, Dofetilide) are K+ channel blockers prolonging Phase 3 repolarization and QT interval. Class IV agents (Verapamil, Diltiazem) are non-dihydropyridine Ca2+ blockers targeting the AV node.\n\nAmiodarone is a Class III agent with broad channel effects; its toxicities include pulmonary fibrosis, thyroid dysfunction (hypo- or hyperthyroidism), hepatotoxicity, corneal deposits and blue-gray skin discoloration with photosensitivity. QT-prolonging drugs (Class Ia and III) carry a risk of torsades de pointes. Na+ channel blockers show use-dependence: they bind more at faster heart rates. Adenosine, given as a rapid IV bolus, briefly blocks AV nodal conduction and is used to end paroxysmal supraventricular tachycardia; its effect lasts seconds.'
      },
      {
        pageNumber: 4,
        text: 'PRELOAD, AFTERLOAD, CONTRACTILITY & CARDIAC OUTPUT\n\nCardiac output (CO) equals stroke volume (SV) multiplied by heart rate (HR). Mean arterial pressure (MAP) is approximately CO multiplied by total peripheral resistance (TPR). Stroke volume is set by three factors: preload, afterload and contractility.\n\nPreload is the stretch of ventricular fibers before contraction and is approximated by end-diastolic volume (EDV). The Frank-Starling mechanism states that, within the physiological range, a larger EDV stretches sarcomeres toward optimal overlap and increases the force of contraction, so stroke volume rises. Venodilators such as nitroglycerin reduce preload.\n\nAfterload is the load the ventricle ejects against and is approximated by aortic (systolic arterial) pressure. Raising afterload, as in aortic stenosis or hypertension, reduces stroke volume; arteriolar dilators such as hydralazine reduce afterload. In heart failure with reduced ejection fraction, lowering afterload lets the weakened ventricle eject more blood.\n\nContractility (inotropy) is the force of contraction at a given preload. Sympathetic stimulation acts on beta-1 receptors, raising cAMP and activating protein kinase A, which phosphorylates L-type Ca2+ channels and phospholamban: more Ca2+ enters, and the sarcoplasmic reticulum takes Ca2+ back up faster. Positive inotropes shift the Frank-Starling curve upward, so stroke volume is higher at every preload.'
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
        sourceName: CARDIO_NOTES
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
        ...diagramCards(HEART_DIAGRAM, {
          conceptId: 'c-usmle-1',
          idPrefix: 'card-usmle-io',
          question: 'Name the covered structure of the heart.',
          sourceAnchor: { pageNumber: 1, sourceName: CARDIO_NOTES },
        }),
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
          sourceAnchor: { pageNumber: 1, snippet: 'Phase 2 (Plateau Phase) reflects an exact electrical balance...', sourceName: CARDIO_NOTES }
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
          sourceAnchor: { pageNumber: 3, snippet: 'Class III agents (Amiodarone, Sotalol) are K+ channel blockers prolonging Phase 3 repolarization...', sourceName: CARDIO_NOTES }
        },
        ...quickCards({ conceptId: 'c-usmle-1', idPrefix: 'card-usmle-1x', sourceName: CARDIO_NOTES }, [
          { page: 1, q: 'Phase 0 of the ventricular myocyte action potential is caused by rapid influx of {{Na+}} through voltage-gated fast channels.' },
          { page: 1, q: 'The ventricular resting membrane potential (about -90 mV) is maintained mainly by {{inward rectifier K+ (IK1)}} channels.' },
          { page: 1, q: 'Which ion carries the Phase 0 upstroke in SA nodal pacemaker cells?', a: 'Ca2+, through L-type Ca2+ channels', options: ['Ca2+, through L-type Ca2+ channels', 'Na+, through fast voltage-gated Na+ channels', 'K+, through delayed rectifier channels', 'Cl-, through ligand-gated channels'], why: 'Nodal cells lack a usable fast Na+ current, so their upstroke is slower and Ca2+-driven.' },
          { page: 1, q: 'What is the funny current (If), and what does it do?', a: 'A mixed inward Na+/K+ current through HCN channels, opened by hyperpolarization, that drives the Phase 4 drift toward threshold in pacemaker cells.', hint: 'It is why the SA node fires on its own.' },
          { page: 1, q: 'Ca2+ entering a ventricular myocyte during the plateau triggers calcium-induced calcium release through {{ryanodine receptors (RyR2)}} on the sarcoplasmic reticulum.' },
          { page: 1, q: 'Why can cardiac muscle not be tetanized?', a: 'The long Phase 2 plateau keeps the cell refractory for almost the whole contraction, so a second action potential cannot fuse contractions.' },
          { page: 1, q: 'What does Phase 1 of the ventricular action potential reflect?', a: 'Brief early repolarization: fast Na+ channels inactivate and a transient outward K+ current (Ito) flows.' },
          { page: 1, q: 'On the ECG, the {{QT interval}} spans ventricular depolarization and repolarization.' },
        ]),
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
        sourceName: CARDIO_NOTES
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
          sourceAnchor: { pageNumber: 2, snippet: 'Point A represents mitral valve closure, marking the onset of isovolumetric contraction...', sourceName: CARDIO_NOTES }
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
          sourceAnchor: { pageNumber: 2, snippet: 'Laplace\'s law dictates that ventricular wall stress = (Pressure × Radius) / (2 × Wall Thickness)...', sourceName: CARDIO_NOTES }
        },
        ...quickCards({ conceptId: 'c-usmle-2', idPrefix: 'card-usmle-2x', sourceName: CARDIO_NOTES }, [
          { page: 2, q: 'Stroke volume = {{EDV - ESV}}.' },
          { page: 2, q: 'How is ejection fraction calculated, and what is a normal value?', a: 'EF = SV / EDV; normally about 55-70%.' },
          { page: 2, q: 'The second heart sound (S2) is closure of the {{aortic and pulmonic}} valves.' },
          { page: 2, q: 'Which valve events bound isovolumetric relaxation?', a: 'It starts at aortic valve closure and ends at mitral valve opening.' },
          { page: 2, q: 'The area inside the left ventricular pressure-volume loop represents {{stroke work}}.' },
          { page: 2, q: 'How does increased afterload (e.g. aortic stenosis) change the pressure-volume loop?', a: 'Taller and narrower: higher systolic pressure and a smaller stroke volume', options: ['Taller and narrower: higher systolic pressure and a smaller stroke volume', 'Wider: larger stroke volume at the same pressure', 'Shifted left with no change in height', 'Shorter: lower systolic pressure and a larger stroke volume'] },
          { page: 2, q: 'Pressure overload causes {{concentric}} hypertrophy (sarcomeres added in parallel); volume overload causes {{eccentric}} hypertrophy (sarcomeres added in series).' },
          { page: 2, q: 'By Laplace’s law, why does a dilated ventricle face more wall stress than a normal one at the same pressure?', a: 'Wall stress rises with chamber radius, so a larger radius means more stress (and oxygen demand) at the same pressure.' },
        ]),
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
        sourceName: CARDIO_NOTES
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
          sourceAnchor: { pageNumber: 3, snippet: 'Class Ic (Flecainide, Propafenone) strongly block Na+... contraindicated in structural or ischemic heart disease...', sourceName: CARDIO_NOTES }
        },
        ...quickCards({ conceptId: 'c-usmle-3', idPrefix: 'card-usmle-3x', sourceName: CARDIO_NOTES }, [
          { page: 3, q: 'Class II antiarrhythmics are {{beta-blockers}}, which slow SA and AV nodal conduction.' },
          { page: 3, q: 'Class IV antiarrhythmics such as verapamil and diltiazem are {{non-dihydropyridine Ca2+ channel blockers}} acting mainly on the AV node.' },
          { page: 3, q: 'Which Vaughan Williams class does lidocaine belong to?', a: 'Class Ib', options: ['Class Ib', 'Class Ia', 'Class Ic', 'Class III'], why: 'Ib drugs bind and release Na+ channels quickly and act mainly on depolarized, ischemic tissue.' },
          { page: 3, q: 'Name the three classic Class Ia antiarrhythmics.', a: 'Quinidine, procainamide and disopyramide.' },
          { page: 3, q: 'What dangerous rhythm can drugs that prolong the QT interval (Class Ia and III) cause?', a: 'Torsades de pointes (polymorphic ventricular tachycardia).' },
          { page: 3, q: 'List the major toxicities of amiodarone.', a: 'Pulmonary fibrosis, thyroid dysfunction (hypo- or hyper-), hepatotoxicity, corneal deposits and blue-gray skin discoloration with photosensitivity.', hint: 'Lungs, thyroid, liver, eyes, skin.' },
          { page: 3, q: 'Na+ channel blockers bind more at faster heart rates. What is this called?', a: 'Use-dependence.' },
          { page: 3, q: 'Which drug, given as a rapid IV bolus, briefly blocks the AV node to end paroxysmal supraventricular tachycardia?', a: 'Adenosine', options: ['Adenosine', 'Digoxin', 'Amiodarone', 'Lidocaine'] },
        ]),
      ]
    },
    {
      id: 'c-usmle-4',
      order: 4,
      title: 'Preload, Afterload, Contractility & the Frank-Starling Curve',
      estimatedMinutes: 10,
      mentalModel: 'Stroke volume is a slingshot: preload is how far you pull back, contractility is how strong the band is, and afterload is the wind you are shooting into.',
      sourceAnchor: { pageNumber: 4, snippet: 'The Frank-Starling mechanism states that, within the physiological range, a larger EDV ... increases the force of contraction', sourceName: CARDIO_NOTES },
      coreTakeaways: [
        'CO = SV x HR, and MAP is approximately CO x TPR.',
        'More preload (EDV) raises stroke volume through the Frank-Starling mechanism; more afterload lowers it.',
        'Positive inotropes shift the Frank-Starling curve up: more stroke volume at every preload.'
      ],
      keyTerms: [
        { term: 'Preload', definition: 'Ventricular stretch before contraction, approximated by end-diastolic volume.' },
        { term: 'Afterload', definition: 'The load the ventricle ejects against, approximated by aortic pressure.' },
        { term: 'Contractility', definition: 'Force of contraction at a given preload; raised by sympathetic beta-1 stimulation.' }
      ],
      feynmanPrompt: 'Explain why an arteriolar dilator can raise stroke volume in a patient whose failing heart cannot pump hard.',
      sampleMasteryExplanation: 'A weak ventricle has little force to spare. Afterload is the pressure it must overcome to open the aortic valve and push blood out. Dilating arterioles lowers that pressure, so the same weak contraction ejects more blood before it runs out of force, and stroke volume rises.',
      retrievalCards: quickCards({ conceptId: 'c-usmle-4', idPrefix: 'card-usmle-4x', sourceName: CARDIO_NOTES }, [
        { page: 4, q: 'Cardiac output = {{stroke volume x heart rate}}.' },
        { page: 4, q: 'Mean arterial pressure is approximately {{cardiac output x total peripheral resistance}}.' },
        { page: 4, q: 'State the Frank-Starling mechanism.', a: 'Within the physiological range, a larger end-diastolic volume stretches the fibers and increases the force of contraction, so stroke volume rises.' },
        { page: 4, q: 'Preload is approximated by {{end-diastolic volume}}; afterload is approximated by {{aortic pressure}}.' },
        { page: 4, q: 'Which drug mainly reduces preload?', a: 'Nitroglycerin', options: ['Nitroglycerin', 'Hydralazine', 'Dobutamine', 'Phenylephrine'], why: 'Nitroglycerin is mainly a venodilator; hydralazine dilates arterioles and lowers afterload.' },
        { page: 4, q: 'How does sympathetic beta-1 stimulation raise contractility?', a: 'cAMP activates protein kinase A, which phosphorylates L-type Ca2+ channels (more Ca2+ entry) and phospholamban (faster Ca2+ reuptake into the sarcoplasmic reticulum).' },
        { page: 4, q: 'A positive inotrope shifts the Frank-Starling curve {{upward}}: stroke volume is higher at every preload.' },
        { page: 4, q: 'Why does afterload reduction help in heart failure with reduced ejection fraction?', a: 'With less pressure to eject against, the weakened ventricle ejects more blood per beat.' },
      ])
    }
  ]
};

export const MCAT_BIOCHEM_SESSION: StudySession = {
  id: 'mcat-biochem-kinetics',
  title: 'Enzyme Kinetics, Thermodynamics & Buffers (MCAT review)',
  category: 'STEM & Engineering',
  description: 'Michaelis-Menten kinetics, enzyme inhibition and Lineweaver-Burk plots, free energy, and acid-base buffers.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: MCAT_NOTES,
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'MICHAELIS-MENTEN EQUATION & CATALYTIC EFFICIENCY\n\nThe Michaelis-Menten velocity equation is expressed as: v0 = (Vmax × [S]) / (Km + [S]). The parameter Km (Michaelis constant) represents the substrate concentration at which the reaction velocity is exactly half of Vmax (0.5 Vmax). Km is an inverse measure of enzyme-substrate affinity; a low Km denotes high affinity because less substrate is required to achieve half-saturation. Turnover number kcat = Vmax / [E]total, representing the catalytic events per second per active site. Catalytic efficiency is the ratio kcat / Km; the upper limit of catalytic efficiency is bounded by the diffusion rate of substrate in water (approximately 10^8 to 10^9 M^-1 s^-1).\n\nWhen [S] is much greater than Km, v0 approaches Vmax and the rate is zero order in substrate. When [S] is much smaller than Km, v0 is approximately (Vmax/Km)[S], first order in substrate.'
      },
      {
        pageNumber: 2,
        text: 'LINEWEAVER-BURK PLOTS & REVERSIBLE INHIBITION MODES\n\nThe Lineweaver-Burk double reciprocal equation linearizes enzyme kinetics: 1/v0 = (Km/Vmax) × (1/[S]) + (1/Vmax). On this plot, the y-intercept is 1/Vmax, the x-intercept is -1/Km, and the slope is Km/Vmax.\n\n1. Competitive Inhibition: The inhibitor binds reversibly to the free enzyme active site, directly competing with substrate. Overcoming inhibition requires higher substrate concentration. Result: Km increases (apparent affinity decreases), while Vmax remains unchanged. The Lineweaver-Burk plot shows a steeper slope intersecting at the exact same y-intercept (1/Vmax).\n\n2. Noncompetitive (Allosteric) Inhibition: The inhibitor binds with equal affinity to both free enzyme (E) and enzyme-substrate complex (ES) at an allosteric site. Result: Km remains unchanged, while Vmax decreases. On the plot, the x-intercept (-1/Km) is unaltered, but the y-intercept shifts upward.\n\n3. Uncompetitive Inhibition: The inhibitor binds exclusively to the enzyme-substrate (ES) complex. Result: Both Km and Vmax decrease by the exact same factor, maintaining a constant slope (Km/Vmax). The plot displays parallel lines shifted upward and to the left.\n\n4. Mixed Inhibition: The inhibitor binds both E and ES, with different affinities. Vmax decreases; apparent Km increases if the inhibitor prefers free enzyme and decreases if it prefers the ES complex.'
      },
      {
        pageNumber: 3,
        text: 'THERMODYNAMICS, EQUILIBRIUM & BUFFER SYSTEMS\n\nGibbs Free Energy is governed by ΔG = ΔH - TΔS. At standard physiological states (pH 7.0, 298 K), ΔG°\' = -RT ln Keq. If Keq > 1, ln Keq is positive and ΔG°\' is negative (exergonic, spontaneous). Enzymes accelerate reaction rates by lowering the activation energy (Ea) of the transition state; they never alter the equilibrium constant Keq, ΔH, or ΔG of a reaction.\n\nThe Henderson-Hasselbalch equation governs acid-base buffers: pH = pKa + log([A-]/[HA]). When [A-] = [HA], the ratio is 1, log(1) = 0, and pH = pKa. A buffer system possesses maximum buffering capacity within ±1 pH unit of its pKa. In blood plasma, the primary physiological buffer is the bicarbonate system: CO2 + H2O <-> H2CO3 <-> HCO3- + H+.\n\nUnfavorable (endergonic) reactions proceed in cells when coupled to ATP hydrolysis, because the free energy changes of coupled reactions add. When ΔH and ΔS are both positive, ΔG becomes negative only at high temperature, where the TΔS term dominates.'
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
        sourceName: MCAT_NOTES
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
          sourceAnchor: { pageNumber: 1, snippet: 'Km represents the substrate concentration at which the reaction velocity is exactly half of Vmax...', sourceName: MCAT_NOTES }
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
          sourceAnchor: { pageNumber: 1, snippet: 'Catalytic efficiency is the ratio kcat / Km...', sourceName: MCAT_NOTES }
        },
        ...quickCards({ conceptId: 'c-mcat-1', idPrefix: 'card-mcat-1x', sourceName: MCAT_NOTES }, [
          { page: 1, q: 'Write the Michaelis-Menten equation.', a: 'v0 = Vmax[S] / (Km + [S])' },
          { page: 1, q: 'A low Km means {{high}} affinity of the enzyme for its substrate.' },
          { page: 1, q: 'What is kcat, and how is it calculated?', a: 'The turnover number: catalytic events per second per active site, kcat = Vmax / [E]total.' },
          { page: 1, q: 'When [S] is much greater than Km, v0 approaches Vmax and the rate is {{zero}} order in substrate.' },
          { page: 1, q: 'When [S] is much smaller than Km, v0 is approximately (Vmax/Km)[S], so the rate is {{first}} order in substrate.' },
          { page: 1, q: 'At [S] = 3 Km, what fraction of Vmax is v0?', a: '0.75 Vmax', options: ['0.75 Vmax', '0.5 Vmax', '0.33 Vmax', '0.9 Vmax'], why: 'v0 = Vmax x 3Km / (Km + 3Km) = 3/4 Vmax.' },
          { page: 1, q: 'What sets the upper limit of catalytic efficiency (kcat/Km)?', a: 'The rate at which substrate diffuses to the enzyme, about 10^8 to 10^9 M^-1 s^-1.' },
        ]),
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
        sourceName: MCAT_NOTES
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
          sourceAnchor: { pageNumber: 2, snippet: '3. Uncompetitive Inhibition: Result: Both Km and Vmax decrease by the exact same factor...', sourceName: MCAT_NOTES }
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
          sourceAnchor: { pageNumber: 2, snippet: 'the y-intercept is 1/Vmax, the x-intercept is -1/Km...', sourceName: MCAT_NOTES }
        },
        ...quickCards({ conceptId: 'c-mcat-2', idPrefix: 'card-mcat-2x', sourceName: MCAT_NOTES }, [
          { page: 2, q: 'In competitive inhibition, apparent Km {{increases}} and Vmax {{stays the same}}.' },
          { page: 2, q: 'In noncompetitive inhibition, Km {{stays the same}} and Vmax {{decreases}}.' },
          { page: 2, q: 'The slope of a Lineweaver-Burk plot equals {{Km/Vmax}}.' },
          { page: 2, q: 'How can competitive inhibition be overcome?', a: 'By raising the substrate concentration, which outcompetes the inhibitor for the active site.' },
          { page: 2, q: 'Lineweaver-Burk lines with and without inhibitor cross on the y-axis. Which inhibition is this?', a: 'Competitive', options: ['Competitive', 'Noncompetitive', 'Uncompetitive', 'Mixed'], why: 'Same y-intercept means the same 1/Vmax.' },
          { page: 2, q: 'Lineweaver-Burk lines with and without inhibitor are parallel. Which inhibition is this?', a: 'Uncompetitive', options: ['Uncompetitive', 'Competitive', 'Noncompetitive', 'Mixed'], why: 'Km and Vmax fall by the same factor, so the slope Km/Vmax is unchanged.' },
          { page: 2, q: 'In mixed inhibition, what happens to Vmax and apparent Km?', a: 'Vmax falls; Km rises if the inhibitor prefers free enzyme and falls if it prefers the ES complex.' },
        ]),
      ]
    },
    {
      id: 'c-mcat-3',
      order: 3,
      title: 'Free Energy, Equilibrium & Buffers',
      estimatedMinutes: 10,
      mentalModel: 'ΔG says whether a reaction can run downhill; Ea says how tall the hill in the way is. Enzymes dig a tunnel through the hill, but the valley floors stay where they are.',
      sourceAnchor: { pageNumber: 3, snippet: 'Enzymes accelerate reaction rates by lowering the activation energy (Ea) ... they never alter the equilibrium constant Keq', sourceName: MCAT_NOTES },
      coreTakeaways: [
        'ΔG = ΔH - TΔS; a negative ΔG means the reaction is spontaneous.',
        'ΔG°’ = -RT ln Keq, so Keq > 1 means ΔG°’ < 0.',
        'pH = pKa + log([A-]/[HA]); buffers work best within 1 pH unit of their pKa.'
      ],
      keyTerms: [
        { term: 'Exergonic', definition: 'A reaction with negative ΔG that releases free energy and can proceed spontaneously.' },
        { term: 'Buffer', definition: 'A weak acid and its conjugate base that resist pH changes.' }
      ],
      feynmanPrompt: 'Explain why an enzyme can make a reaction a million times faster but cannot make an unfavorable reaction favorable.',
      sampleMasteryExplanation: 'Whether a reaction is favorable depends only on the free energy of the starting and ending states. An enzyme lowers the energy of the transition state in between, so molecules cross over faster in both directions, but the start and end points are unchanged, so ΔG and the equilibrium constant stay the same.',
      retrievalCards: quickCards({ conceptId: 'c-mcat-3', idPrefix: 'card-mcat-3x', sourceName: MCAT_NOTES }, [
        { page: 3, q: 'ΔG = {{ΔH - TΔS}}.' },
        { page: 3, q: 'If Keq > 1, the standard free energy change ΔG°’ is {{negative}}.' },
        { page: 3, q: 'What does an enzyme change about a reaction?', a: 'Only the activation energy, and so the rate', options: ['Only the activation energy, and so the rate', 'ΔG and the rate', 'The equilibrium constant', 'ΔH'] },
        { page: 3, q: 'Write the Henderson-Hasselbalch equation.', a: 'pH = pKa + log([A-]/[HA])' },
        { page: 3, q: 'When [A-] = [HA], pH = {{pKa}}.' },
        { page: 3, q: 'A buffer works best within about {{1 pH unit}} of its pKa.' },
        { page: 3, q: 'An acid has pKa 4.76 and [A-]/[HA] = 10. What is the pH?', a: '5.76', options: ['5.76', '3.76', '4.76', '14.76'], why: 'log(10) = 1, so pH = 4.76 + 1.' },
        { page: 3, q: 'What is the main buffer in blood plasma?', a: 'The bicarbonate system: CO2 + H2O <-> H2CO3 <-> HCO3- + H+.' },
        { page: 3, q: 'How do cells drive endergonic reactions?', a: 'By coupling them to ATP hydrolysis; the free energy changes add up to a negative total.' },
        { page: 3, q: 'A reaction with positive ΔH and positive ΔS is spontaneous only at {{high}} temperatures.' },
      ])
    }
  ]
};

export const CS_SYSTEMS_SESSION: StudySession = {
  id: 'cs-distributed-systems',
  title: 'Distributed Systems: CAP, Raft, Storage Engines & Sharding',
  category: 'STEM & Engineering',
  description: 'CAP and PACELC, Raft consensus, B-Trees vs LSM-Trees, and consistent hashing with quorum replication.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: SYSTEMS_NOTES,
    totalPages: 4,
    pages: [
      {
        pageNumber: 1,
        text: 'SECTION 1: CAP THEOREM AND THE PACELC EXTENSION\n\nEric Brewer\'s CAP theorem asserts that a distributed data store can guarantee at most two out of three guarantees simultaneously: Consistency (every read receives the most recent write or an error), Availability (every non-failing node returns a non-error response without guarantee of recent write), and Partition Tolerance (the system continues to operate despite network packet loss or split-brain partitions). Because network partitions are physical inevitabilities in distributed hardware networks, a real-world system must choose between CP (Consistency over Availability) or AP (Availability over Consistency).\n\nDaniel Abadi\'s PACELC theorem expands CAP: If there is a Partition (P), how does your system trade off Availability (A) and Consistency (C); Else (E), when the network is running normally, how does your system trade off Latency (L) and Consistency (C)? For example, MongoDB and HBase are PC/EC systems (choose Consistency under partition, Consistency at the expense of Latency under normal operations), whereas Amazon Dynamo and Apache Cassandra are PA/EL systems.\n\nMany AP systems offer eventual consistency: if no new writes arrive, all replicas eventually converge to the same value.'
      },
      {
        pageNumber: 2,
        text: 'SECTION 2: RAFT CONSENSUS AND LEADER ELECTION\n\nRaft decomposes distributed consensus into three independent subproblems: Leader Election, Log Replication, and Safety. A cluster node operates in one of three states: Follower, Candidate, or Leader. Follower nodes expect periodic heartbeats (AppendEntries RPC) from the leader within an election timeout. To prevent split votes, Raft mandates randomized election timeouts (e.g., 150-300 ms).\n\nWhen a candidate initiates an election, it increments its term and requests votes. A candidate wins if it receives votes from a strict quorum (majority: (N/2)+1 nodes). Safety is guaranteed by the Log Completeness Property: a voter denies its vote if the candidate\'s log is less up-to-date than its own. Once an entry is committed (replicated on a majority), it will never be overwritten or rolled back by subsequent leaders.\n\nTime is divided into terms, numbered with consecutive integers; each term begins with an election. A server that sees a higher term adopts it and, if it was a leader or candidate, returns to follower. Leaders send heartbeats as AppendEntries RPCs that carry no log entries. A cluster of N servers keeps working as long as a majority is up, so five servers tolerate two failures.'
      },
      {
        pageNumber: 3,
        text: 'SECTION 3: STORAGE ENGINES — B-TREES VS LSM-TREES\n\nTraditional relational databases (PostgreSQL, InnoDB MySQL) utilize B-Trees (specifically B+ Trees). B-Trees organize disk blocks into balanced pages. They excel at read performance (O(log N)) and range scans because leaf nodes are linked in order. However, random writes require in-place disk page modification, generating random I/O and write amplification.\n\nModern distributed databases (Cassandra, RocksDB, Bigtable) utilize Log-Structured Merge (LSM) Trees. In an LSM-Tree, incoming writes are appended sequentially to a Write-Ahead Log (WAL) on disk for durability, and inserted into an in-memory balanced tree called a MemTable. When the MemTable exceeds a threshold (e.g. 64 MB), it is flushed sequentially to disk as an immutable Sorted String Table (SSTable). Because writes are 100% sequential, LSM-Trees provide exceptional write throughput. Background compaction merges redundant SSTables and purges tombstones.\n\nReads on an LSM-Tree may have to check the MemTable and several SSTables (read amplification); a Bloom filter per SSTable lets a read skip files that cannot contain the key.'
      },
      {
        pageNumber: 4,
        text: 'SECTION 4: PARTITIONING WITH CONSISTENT HASHING AND QUORUMS\n\nSpreading keys with hash(key) mod N works until N changes: adding or removing a server remaps almost every key. Consistent hashing places both servers and keys on a hash ring; each key belongs to the first server clockwise from its position. When a server joins or leaves, only the keys in its arc move, about K/N of K keys. Giving each physical server many virtual nodes on the ring evens out the load.\n\nDynamo-style stores replicate each key to N servers and tune reads and writes with quorums: a write waits for W acknowledgements and a read queries R replicas. If R + W > N, every read set overlaps every write set, so at least one replica in each read holds the latest acknowledged write. For example, N = 3, W = 2, R = 2 satisfies this; N = 3, W = 1, R = 1 favors latency but may return stale data.'
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
        sourceName: SYSTEMS_NOTES
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
          sourceAnchor: { pageNumber: 1, snippet: 'Else (E), when the network is running normally, how does your system trade off Latency (L) and Consistency (C)?', sourceName: SYSTEMS_NOTES }
        },
        ...quickCards({ conceptId: 'c-cs-1', idPrefix: 'card-cs-1x', sourceName: SYSTEMS_NOTES }, [
          { page: 1, q: 'In the CAP theorem, consistency means every read receives {{the most recent write}} or an error.' },
          { page: 1, q: 'Why must a real distributed system choose between CP and AP?', a: 'Network partitions cannot be ruled out, so during one the system must give up either consistency or availability.' },
          { page: 1, q: 'In PACELC terms, MongoDB and HBase are {{PC/EC}} systems.' },
          { page: 1, q: 'During a network partition, what does a CP system do?', a: 'Refuses or errors on some requests rather than return possibly stale data', options: ['Refuses or errors on some requests rather than return possibly stale data', 'Keeps answering every request with whatever data each node has', 'Merges conflicting writes automatically', 'Shuts down every node until the partition heals'] },
          { page: 1, q: 'What does eventual consistency guarantee?', a: 'If no new writes arrive, all replicas eventually converge to the same value.' },
        ]),
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
        sourceName: SYSTEMS_NOTES
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
          sourceAnchor: { pageNumber: 3, snippet: 'Background compaction merges redundant SSTables and purges tombstones.', sourceName: SYSTEMS_NOTES }
        },
        ...quickCards({ conceptId: 'c-cs-2', idPrefix: 'card-cs-lsm', sourceName: SYSTEMS_NOTES }, [
          { page: 3, q: 'Why are B+ trees good at range scans?', a: 'Their leaf nodes are linked in key order, so a scan walks from leaf to leaf.' },
          { page: 3, q: 'In an LSM-Tree, a write is appended to the {{write-ahead log}} for durability and inserted into the in-memory {{MemTable}}.' },
          { page: 3, q: 'When a MemTable fills up, it is flushed to disk as an immutable {{SSTable}} (Sorted String Table).' },
          { page: 3, q: 'What does compaction do in an LSM-Tree?', a: 'Merges SSTables in the background, dropping overwritten values and purging tombstones.' },
          { page: 3, q: 'Why do LSM-Trees have high write throughput?', a: 'All disk writes are sequential appends; nothing is modified in place.' },
          { page: 3, q: 'What helps an LSM-Tree read skip SSTables that cannot contain a key?', a: 'A Bloom filter per SSTable', options: ['A Bloom filter per SSTable', 'A B-Tree index over the MemTable', 'The write-ahead log', 'Compaction'], why: 'Reads may otherwise check many SSTables (read amplification).' },
          { page: 3, q: 'Which storage structure do PostgreSQL and MySQL InnoDB use for indexes?', a: 'B-Trees (B+ trees)', options: ['B-Trees (B+ trees)', 'LSM-Trees', 'Hash rings', 'Skip lists only'] },
        ]),
      ]
    },
    {
      id: 'c-cs-3',
      order: 3,
      title: 'Raft Consensus & Leader Election',
      estimatedMinutes: 10,
      mentalModel: 'Raft is a classroom electing a class rep: anyone who stops hearing from the rep can run, a majority vote wins, and nobody votes for a candidate who missed more of the notes than they did.',
      sourceAnchor: { pageNumber: 2, snippet: 'A candidate wins if it receives votes from a strict quorum (majority: (N/2)+1 nodes).', sourceName: SYSTEMS_NOTES },
      coreTakeaways: [
        'Each server is a follower, candidate or leader.',
        'Randomized election timeouts make split votes rare.',
        'An entry is committed once a majority stores it, and committed entries are never lost.'
      ],
      keyTerms: [
        { term: 'Term', definition: 'A numbered period that starts with an election and acts as a logical clock.' },
        { term: 'Quorum', definition: 'A majority of servers, floor(N/2) + 1.' }
      ],
      feynmanPrompt: 'Explain why a Raft cluster of five servers keeps working with two servers down but stops with three down.',
      sampleMasteryExplanation: 'Every decision in Raft, electing a leader or committing an entry, needs a majority: three of five. With two servers down, three are left, which is still a majority. With three down only two are left, which can never form a majority, so no leader can be elected and nothing new can be committed.',
      retrievalCards: quickCards({ conceptId: 'c-cs-3', idPrefix: 'card-cs-raft', sourceName: SYSTEMS_NOTES }, [
        { page: 2, q: 'What three states can a Raft server be in?', a: 'Follower, candidate and leader.' },
        { page: 2, q: 'Why does Raft use randomized election timeouts?', a: 'So servers rarely time out together, which avoids split votes.' },
        { page: 2, q: 'A Raft candidate needs votes from a {{majority}} of the cluster to become leader.' },
        { page: 2, q: 'How many failed servers can a five-server Raft cluster tolerate?', a: '2', options: ['2', '1', '3', '4'], why: 'Three of five is still a majority.' },
        { page: 2, q: 'Raft leaders send heartbeats as {{AppendEntries}} RPCs that carry no log entries.' },
        { page: 2, q: 'When does a Raft server refuse to vote for a candidate?', a: 'When the candidate’s log is less up to date than its own.' },
        { page: 2, q: 'When is a Raft log entry committed?', a: 'Once it is stored on a majority of servers.' },
        { page: 2, q: 'What does a Raft leader do when it sees a message with a higher term?', a: 'Adopts the higher term and steps down to follower.' },
      ])
    },
    {
      id: 'c-cs-4',
      order: 4,
      title: 'Consistent Hashing & Quorum Replication',
      estimatedMinutes: 10,
      mentalModel: 'Picture servers as stops on a circular bus route. Each key gets off at the next stop. Add a stop and only the riders of one stretch change where they get off.',
      sourceAnchor: { pageNumber: 4, snippet: 'Consistent hashing places both servers and keys on a hash ring; each key belongs to the first server clockwise', sourceName: SYSTEMS_NOTES },
      coreTakeaways: [
        'hash(key) mod N remaps almost every key when N changes; consistent hashing moves only about K/N keys.',
        'Virtual nodes even out the load across servers.',
        'With N replicas, R + W > N makes every read overlap the latest acknowledged write.'
      ],
      keyTerms: [
        { term: 'Hash ring', definition: 'A circular hash space on which both servers and keys are placed.' },
        { term: 'Virtual node', definition: 'One of many ring positions owned by a single physical server.' }
      ],
      feynmanPrompt: 'Explain why a cache cluster that shards keys with hash(key) mod N suffers a flood of misses when one server is added, and how consistent hashing avoids it.',
      sampleMasteryExplanation: 'With mod N, a key’s server depends on N itself, so changing N from 4 to 5 sends most keys to a different server, and their cached values are effectively lost at once. On a hash ring a key belongs to the next server clockwise, so a new server only takes over the keys in the arc just before it; everything else stays put.',
      retrievalCards: quickCards({ conceptId: 'c-cs-4', idPrefix: 'card-cs-hash', sourceName: SYSTEMS_NOTES }, [
        { page: 4, q: 'What goes wrong with hash(key) mod N when a server is added?', a: 'Almost every key maps to a different server.' },
        { page: 4, q: 'On a consistent-hashing ring, a key belongs to the first server {{clockwise}} from its position.' },
        { page: 4, q: 'With K keys and N servers, about how many keys move when one server joins a consistent-hashing ring?', a: 'About K/N', options: ['About K/N', 'Almost all K', 'None', 'About K/2'] },
        { page: 4, q: 'Why give each server many virtual nodes on the ring?', a: 'To spread each server’s share of keys evenly and smooth the load when servers join or leave.' },
        { page: 4, q: 'In quorum replication with N replicas, {{R + W > N}} ensures every read overlaps the latest acknowledged write.' },
        { page: 4, q: 'With N = 3, which setting can return stale data?', a: 'W = 1, R = 1', options: ['W = 1, R = 1', 'W = 2, R = 2', 'W = 3, R = 1', 'W = 1, R = 3'], why: '1 + 1 = 2 is not greater than 3, so a read may miss the replica that took the write.' },
      ])
    }
  ]
};

export const AP_BIO_SESSION: StudySession = {
  id: 'ap-bio-cellular-mechanisms',
  title: 'AP Biology: Cellular Respiration, CRISPR & DNA Replication',
  category: 'Biochemistry & Life Sciences',
  description: 'The electron transport chain and chemiosmosis, CRISPR-Cas9 genome editing, and DNA replication.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: BIO_NOTES,
    totalPages: 3,
    pages: [
      {
        pageNumber: 1,
        text: 'OXIDATIVE PHOSPHORYLATION & CHEMIOSMOSIS\n\nCellular respiration culminates in the inner mitochondrial membrane with the Electron Transport Chain (ETC). High-energy electrons donated by NADH (Complex I) and FADH2 (Complex II) flow down an electrochemical cascade through ubiquinone, Complex III, cytochrome c, and Complex IV to the terminal electron acceptor, molecular oxygen (O2), which is reduced to water (H2O).\n\nAs electrons traverse Complexes I, III, and IV, protons (H+) are actively pumped from the mitochondrial matrix into the intermembrane space, generating a steep Proton-Motive Force composed of both a chemical gradient (ΔpH) and an electrical membrane potential (ΔΨ). Protons re-enter the matrix exclusively via ATP Synthase (F0F1 complex). The physical passage of protons through the F0 rotor induces mechanical rotation of the F1 catalytic headpiece, phosphorylating ADP and inorganic phosphate (Pi) into ATP.\n\nComplex II passes electrons from FADH2 to ubiquinone without pumping protons, which is why FADH2 yields less ATP than NADH. Cyanide blocks Complex IV, stopping electron flow and ATP synthesis. Uncouplers such as 2,4-dinitrophenol carry protons across the inner membrane, so electron transport continues but ATP synthesis falls and the energy is released as heat. Glycolysis takes place in the cytosol; the citric acid cycle takes place in the mitochondrial matrix.'
      },
      {
        pageNumber: 2,
        text: 'CRISPR-CAS9 TARGETED GENOME EDITING\n\nCRISPR (Clustered Regularly Interspaced Short Palindromic Repeats) and Cas9 endonuclease constitute an adaptive immune mechanism adapted from Streptococcus pyogenes for targeted molecular biology. Cas9 endonuclease is directed to a specific genomic locus by a single guide RNA (sgRNA), formed by fusing CRISPR RNA (crRNA) and trans-activating crRNA (tracrRNA).\n\nCrucially, Cas9 will only bind and cleave double-stranded DNA if the target sequence is immediately adjacent to a Protospacer Adjacent Motif (PAM). For SpCas9, the PAM sequence is 5\'-NGG-3\'. Once positioned, Cas9 creates a blunt double-strand break (DSB) exactly 3 base pairs upstream of the PAM. Host cellular repair via Non-Homologous End Joining (NHEJ) causes indels for gene knockout, or Homology-Directed Repair (HDR) enables precise gene insertion.\n\nIn bacteria, CRISPR is an adaptive immune system: fragments of phage DNA are stored as spacers in the CRISPR array, and their transcripts guide Cas9 to matching invading DNA. The bacterium’s own array is not cut, because its spacers are not next to a PAM.'
      },
      {
        pageNumber: 3,
        text: 'DNA REPLICATION LAGGING STRAND SYNTHESIS\n\nDNA polymerases can only synthesize polynucleotide chains in the 5\' to 3\' direction, adding nucleotides to a free 3\'-OH group. Because antiparallel parental strands unwind simultaneously at the replication fork, the lagging strand must be synthesized discontinuously away from the advancing fork.\n\nRNA Primase synthesizes short RNA primers. DNA Polymerase III extends these primers into Okazaki fragments (1,000-2,000 nucleotides in prokaryotes; 100-200 in eukaryotes). DNA Polymerase I removes the RNA primers using 5\' to 3\' exonuclease activity and fills the resulting gaps with deoxyribonucleotides. Finally, DNA Ligase catalyzes phosphodiester bonds to seal the remaining nicks between fragments.\n\nHelicase unwinds the double helix at the fork, single-strand binding proteins keep the separated strands apart, and topoisomerases relieve the supercoiling that builds up ahead of the fork. The leading strand is synthesized continuously toward the fork.'
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
        sourceName: BIO_NOTES
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
        ...diagramCards(ELECTRON_TRANSPORT_DIAGRAM, {
          conceptId: 'c-apbio-1',
          idPrefix: 'card-apbio-io',
          question: 'Name the covered part of the electron transport chain.',
          sourceAnchor: { pageNumber: 1, sourceName: BIO_NOTES },
        }),
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
          sourceAnchor: { pageNumber: 1, snippet: 'terminal electron acceptor, molecular oxygen (O2), which is reduced to water (H2O)...', sourceName: BIO_NOTES }
        },
        ...quickCards({ conceptId: 'c-apbio-1', idPrefix: 'card-apbio-1x', sourceName: BIO_NOTES }, [
          { page: 1, q: 'The electron transport chain sits in the {{inner mitochondrial membrane}}.' },
          { page: 1, q: 'Complexes I, III and IV pump protons from the matrix into the {{intermembrane space}}.' },
          { page: 1, q: 'NADH donates electrons at Complex {{I}}; FADH2 donates them at Complex {{II}}.' },
          { page: 1, q: 'Why does FADH2 yield less ATP than NADH?', a: 'Its electrons enter at Complex II, which pumps no protons, so fewer protons are pumped per electron pair.' },
          { page: 1, q: 'What two components make up the proton-motive force?', a: 'A chemical gradient (difference in pH) and an electrical membrane potential.' },
          { page: 1, q: 'Which two mobile carriers shuttle electrons between the complexes?', a: 'Ubiquinone (coenzyme Q) and cytochrome c.' },
          { page: 1, q: 'What does an uncoupler such as 2,4-dinitrophenol do?', a: 'Lets protons leak back across the inner membrane, so electron transport continues but ATP synthesis falls', options: ['Lets protons leak back across the inner membrane, so electron transport continues but ATP synthesis falls', 'Blocks Complex IV so electrons cannot reach oxygen', 'Inhibits ATP synthase directly', 'Stops glycolysis in the cytosol'], why: 'The energy of the gradient is released as heat instead of making ATP.' },
          { page: 1, q: 'Cyanide is lethal because it blocks Complex {{IV}}, stopping electron flow to oxygen.' },
          { page: 1, q: 'Where do glycolysis and the citric acid cycle take place?', a: 'Glycolysis in the cytosol; the citric acid cycle in the mitochondrial matrix.' },
        ]),
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
        sourceName: BIO_NOTES
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
          sourceAnchor: { pageNumber: 2, snippet: 'For SpCas9, the PAM sequence is 5\'-NGG-3\'.', sourceName: BIO_NOTES }
        },
        ...quickCards({ conceptId: 'c-apbio-2', idPrefix: 'card-apbio-2x', sourceName: BIO_NOTES }, [
          { page: 2, q: 'The single guide RNA (sgRNA) is a fusion of {{crRNA}} and {{tracrRNA}}.' },
          { page: 2, q: 'Where does SpCas9 cut relative to the PAM?', a: 'A blunt double-strand break 3 base pairs upstream of the PAM.' },
          { page: 2, q: 'Repair of a Cas9 cut by {{non-homologous end joining (NHEJ)}} often leaves small insertions or deletions that knock a gene out.' },
          { page: 2, q: 'Which repair pathway lets researchers insert a precise sequence at a Cas9 cut?', a: 'Homology-directed repair (HDR), using a supplied template', options: ['Homology-directed repair (HDR), using a supplied template', 'Non-homologous end joining (NHEJ)', 'Mismatch repair', 'Base excision repair'] },
          { page: 2, q: 'What is CRISPR’s natural role in bacteria?', a: 'An adaptive immune system: stored phage DNA fragments guide Cas9 to cut matching invading DNA.' },
          { page: 2, q: 'Why does Cas9 not cut the bacterium’s own CRISPR array?', a: 'The spacers in the array are not next to a PAM, and Cas9 only cuts next to one.' },
        ]),
      ]
    },
    {
      id: 'c-apbio-3',
      order: 3,
      title: 'DNA Replication & the Lagging Strand',
      estimatedMinutes: 10,
      mentalModel: 'DNA polymerase can only write forward (5′ to 3′). On one strand it follows the opening fork smoothly; on the other it has to keep jumping back and writing short pieces, which are stitched together afterwards.',
      sourceAnchor: { pageNumber: 3, snippet: 'DNA polymerases can only synthesize polynucleotide chains in the 5′ to 3′ direction', sourceName: BIO_NOTES },
      coreTakeaways: [
        'Polymerases add nucleotides only to a free 3′-OH, building 5′ to 3′.',
        'The leading strand is made continuously; the lagging strand is made as Okazaki fragments.',
        'Primase lays RNA primers, DNA Pol III extends them, DNA Pol I swaps primers for DNA, and ligase seals the nicks.'
      ],
      keyTerms: [
        { term: 'Okazaki fragment', definition: 'A short DNA piece made on the lagging strand, later joined by ligase.' },
        { term: 'Primase', definition: 'The enzyme that makes the short RNA primers polymerase extends.' }
      ],
      feynmanPrompt: 'Explain why one strand of DNA is copied in pieces even though both strands are unwound at the same fork.',
      sampleMasteryExplanation: 'The two strands run in opposite directions, but polymerase can only build in one direction. On one strand, building forward means moving with the fork, so it goes smoothly. On the other, building forward means moving away from the fork, so as the fork opens more template, polymerase has to start again near the fork and make another short piece.',
      retrievalCards: quickCards({ conceptId: 'c-apbio-3', idPrefix: 'card-apbio-3x', sourceName: BIO_NOTES }, [
        { page: 3, q: 'DNA polymerase builds new DNA only in the {{5′ to 3′}} direction, adding to a free 3′-OH.' },
        { page: 3, q: 'The lagging strand is made discontinuously as {{Okazaki fragments}}.' },
        { page: 3, q: 'Which enzyme makes the RNA primers for DNA synthesis?', a: 'Primase', options: ['Primase', 'Helicase', 'DNA ligase', 'Topoisomerase'] },
        { page: 3, q: 'In prokaryotes, which polymerase extends primers into most of the new DNA?', a: 'DNA polymerase III.' },
        { page: 3, q: 'What does DNA polymerase I do in prokaryotic replication?', a: 'Removes RNA primers with its 5′ to 3′ exonuclease activity and fills the gaps with DNA.' },
        { page: 3, q: '{{DNA ligase}} seals the nicks between Okazaki fragments.' },
        { page: 3, q: 'What do helicase, single-strand binding proteins and topoisomerase each do at the fork?', a: 'Helicase unwinds the helix, single-strand binding proteins keep the strands apart, and topoisomerase relieves supercoiling ahead of the fork.' },
        { page: 3, q: 'Okazaki fragments are longer in {{prokaryotes}} (1,000-2,000 nucleotides) than in eukaryotes (100-200).' },
      ])
    }
  ]
};

export const SPANISH_POLYGLOT_SESSION: StudySession = {
  id: 'spanish-polyglot-core',
  title: 'Spanish B1: Subjunctive, Por vs Para & False Friends',
  category: 'Languages & Polyglot',
  description: 'Subjunctive triggers (WEIRDOS), por vs para, discourse connectors, and common false friends. Intermediate (B1) grammar, not a vocabulary course.',
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  sourceDocument: {
    name: SPANISH_NOTES,
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
        sourceName: SPANISH_NOTES
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
          sourceAnchor: { pageNumber: 1, snippet: 'Impersonal Expressions: es necesario que, es importante que...', sourceName: SPANISH_NOTES }
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
          sourceAnchor: { pageNumber: 1, snippet: 'D (Doubt/Denial): dudar, no creer, negar (e.g., "Dudo que sea verdad").', sourceName: SPANISH_NOTES }
        },
        ...quickCards({ conceptId: 'c-es-1', idPrefix: 'card-es-1x', sourceName: SPANISH_NOTES }, [
          { page: 1, q: 'Quiero que tú {{vengas}} a la fiesta. (venir)' },
          { page: 1, q: 'Me alegro de que {{estés}} bien. (estar)' },
          { page: 1, q: 'Dudo que {{sea}} verdad. (ser)' },
          { page: 1, q: 'Te recomiendo que {{leas}} este libro. (leer)' },
          { page: 1, q: '¡Ojalá {{llueva}} mañana! (llover)' },
          { page: 1, q: 'Es importante que nosotros {{hablemos}} con ella. (hablar)' },
          { page: 1, q: 'En cuanto {{llegue}} a casa, te llamo. (llegar)', hint: 'A future event after "en cuanto" takes the subjunctive.' },
          { page: 1, q: 'When does a WEIRDOS verb not trigger the subjunctive?', a: 'When there is only one subject: use the infinitive instead ("Quiero ir", not "Quiero que yo vaya").' },
          { page: 1, q: 'Which sentence is correct?', a: 'No creo que sea verdad.', options: ['No creo que sea verdad.', 'No creo que es verdad.', 'Creo que sea verdad.', 'No creo que ser verdad.'], why: 'Denial or doubt ("no creer") takes the subjunctive; "creer" on its own takes the indicative.' },
        ]),
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
        sourceName: SPANISH_NOTES
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
          sourceAnchor: { pageNumber: 2, snippet: 'Specific Deadline: "La tarea es para el lunes"', sourceName: SPANISH_NOTES }
        },
        ...quickCards({ conceptId: 'c-es-2', idPrefix: 'card-es-2x', sourceName: SPANISH_NOTES }, [
          { page: 2, q: 'Este regalo es {{para}} ti.', hint: 'Recipient.' },
          { page: 2, q: 'Viví allí {{por}} dos años.', hint: 'Duration.' },
          { page: 2, q: 'Te doy 20 euros {{por}} el libro.', hint: 'Exchange.' },
          { page: 2, q: 'Hablamos {{por}} teléfono.', hint: 'Means of communication.' },
          { page: 2, q: 'Estudio {{para}} aprender.', hint: 'Purpose.' },
          { page: 2, q: 'Mañana salgo {{para}} Madrid.', hint: 'Destination.' },
          { page: 2, q: 'Lo hice {{por}} ti.', hint: 'Cause or motive.' },
          { page: 2, q: 'Paseamos {{por}} el parque.', hint: 'Movement through a place.' },
        ]),
      ]
    },
    {
      id: 'c-es-3',
      order: 3,
      title: 'Connectors & False Friends',
      estimatedMinutes: 8,
      mentalModel: 'False friends look like English words wearing a disguise. Before trusting a familiar-looking word, check its passport.',
      sourceAnchor: { pageNumber: 3, snippet: 'Watch out for treacherous False Friends (Falsos Amigos)', sourceName: SPANISH_NOTES },
      coreTakeaways: [
        'Sin embargo = however; por lo tanto = therefore; a pesar de que = even though.',
        'Actualmente means currently, embarazada means pregnant, constipado means having a cold, éxito means success.'
      ],
      keyTerms: [
        { term: 'Falso amigo', definition: 'A Spanish word that looks like an English word but means something different.' }
      ],
      feynmanPrompt: 'Explain to a friend why saying "Estoy embarazada" after a mistake would surprise a Spanish speaker, and what to say instead.',
      sampleMasteryExplanation: '"Embarazada" looks like "embarrassed" but means "pregnant", so the sentence announces a pregnancy. To say you are embarrassed, use "Tengo vergüenza" or "Estoy avergonzada" (avergonzado for a man).',
      retrievalCards: quickCards({ conceptId: 'c-es-3', idPrefix: 'card-es-3x', sourceName: SPANISH_NOTES }, [
        { page: 3, q: 'What does "sin embargo" mean?', a: 'However / nonetheless.' },
        { page: 3, q: 'What does "por lo tanto" mean?', a: 'Therefore / consequently.' },
        { page: 3, q: 'What does "a pesar de que" mean?', a: 'Even though / in spite of the fact that.' },
        { page: 3, q: 'What does "actualmente" mean?', a: 'Currently / nowadays', options: ['Currently / nowadays', 'Actually', 'Accurately', 'Eventually'], why: '"Actually" is "en realidad".' },
        { page: 3, q: 'What does "embarazada" mean?', a: 'Pregnant', options: ['Pregnant', 'Embarrassed', 'Busy', 'Confused'], why: '"Embarrassed" is "avergonzada" / "avergonzado".' },
        { page: 3, q: 'What does "estoy constipado" mean?', a: 'I have a cold.', why: '"Constipated" is "estreñido".' },
        { page: 3, q: 'What does "éxito" mean?', a: 'Success.', why: '"Exit" is "salida".' },
        { page: 3, q: 'Translate: "However, I don’t agree."', a: 'Sin embargo, no estoy de acuerdo.' },
      ])
    }
  ]
};

// Counts come from the decks themselves so the catalog cannot drift from what is studied.
const countCards = (session: StudySession): number =>
  session.concepts.reduce((sum, concept) => sum + concept.retrievalCards.length, 0);
const sessionMinutes = (session: StudySession): number =>
  session.concepts.reduce((sum, concept) => sum + concept.estimatedMinutes, 0);

export const CURATED_STARTER_DECKS: StarterDeckMetadata[] = [
  {
    id: 'usmle-cardio-pathophysiology',
    title: 'Cardiovascular Physiology & Antiarrhythmics (USMLE Step 1 review)',
    category: 'Medical & Clinical',
    difficulty: 'High-Yield Board Review',
    estimatedMinutes: sessionMinutes(USMLE_CARDIO_SESSION),
    cardCount: countCards(USMLE_CARDIO_SESSION),
    conceptCount: USMLE_CARDIO_SESSION.concepts.length,
    hasImageOcclusion: true,
    hasSourceNotes: true,
    tags: ['Cardiology', 'USMLE Step 1', 'Pharmacology', 'Hemodynamics', 'Image Occlusion'],
    targetAudience: 'Medical students reviewing for USMLE Step 1 or COMLEX Level 1',
    summary: USMLE_CARDIO_SESSION.description,
    session: USMLE_CARDIO_SESSION
  },
  {
    id: 'mcat-biochem-kinetics',
    title: 'Enzyme Kinetics, Thermodynamics & Buffers (MCAT review)',
    category: 'STEM & Engineering',
    difficulty: 'Intermediate',
    estimatedMinutes: sessionMinutes(MCAT_BIOCHEM_SESSION),
    cardCount: countCards(MCAT_BIOCHEM_SESSION),
    conceptCount: MCAT_BIOCHEM_SESSION.concepts.length,
    hasImageOcclusion: false,
    hasSourceNotes: true,
    tags: ['Biochemistry', 'MCAT', 'Enzyme Kinetics', 'Thermodynamics', 'Lineweaver-Burk'],
    targetAudience: 'Pre-med students, Biochemistry & Biophysics undergraduates',
    summary: MCAT_BIOCHEM_SESSION.description,
    session: MCAT_BIOCHEM_SESSION
  },
  {
    id: 'cs-distributed-systems',
    title: 'Distributed Systems: CAP, Raft, Storage Engines & Sharding',
    category: 'STEM & Engineering',
    difficulty: 'Intermediate',
    estimatedMinutes: sessionMinutes(CS_SYSTEMS_SESSION),
    cardCount: countCards(CS_SYSTEMS_SESSION),
    conceptCount: CS_SYSTEMS_SESSION.concepts.length,
    hasImageOcclusion: false,
    hasSourceNotes: true,
    tags: ['System Design', 'Distributed Systems', 'CAP Theorem', 'LSM-Trees', 'Consensus'],
    targetAudience: 'Software engineers, System architects, CS undergrads & interview candidates',
    summary: CS_SYSTEMS_SESSION.description,
    session: CS_SYSTEMS_SESSION
  },
  {
    id: 'ap-bio-cellular-mechanisms',
    title: 'AP Biology: Cellular Respiration, CRISPR & DNA Replication',
    category: 'Biochemistry & Life Sciences',
    difficulty: 'Foundational',
    estimatedMinutes: sessionMinutes(AP_BIO_SESSION),
    cardCount: countCards(AP_BIO_SESSION),
    conceptCount: AP_BIO_SESSION.concepts.length,
    hasImageOcclusion: true,
    hasSourceNotes: true,
    tags: ['AP Biology', 'Mitochondria', 'Chemiosmosis', 'CRISPR-Cas9', 'DNA Replication', 'Image Occlusion'],
    targetAudience: 'AP Biology students, Molecular Biology undergraduates, Science enthusiasts',
    summary: AP_BIO_SESSION.description,
    session: AP_BIO_SESSION
  },
  {
    id: 'spanish-polyglot-core',
    title: 'Spanish B1: Subjunctive, Por vs Para & False Friends',
    category: 'Languages & Polyglot',
    difficulty: 'Intermediate',
    estimatedMinutes: sessionMinutes(SPANISH_POLYGLOT_SESSION),
    cardCount: countCards(SPANISH_POLYGLOT_SESSION),
    conceptCount: SPANISH_POLYGLOT_SESSION.concepts.length,
    hasImageOcclusion: false,
    hasSourceNotes: true,
    tags: ['Spanish', 'CEFR B1', 'Subjunctive', 'Por vs Para', 'False Friends'],
    targetAudience: 'Intermediate Spanish learners working on grammar',
    summary: SPANISH_POLYGLOT_SESSION.description,
    session: SPANISH_POLYGLOT_SESSION
  },
  {
    id: 'demo-memory-neuroscience',
    title: DEMO_STUDY_SESSIONS[0].title,
    category: 'Cognitive & Behavioral Science',
    difficulty: 'Foundational',
    estimatedMinutes: sessionMinutes(DEMO_STUDY_SESSIONS[0]),
    cardCount: countCards(DEMO_STUDY_SESSIONS[0]),
    conceptCount: DEMO_STUDY_SESSIONS[0].concepts.length,
    hasImageOcclusion: true,
    hasSourceNotes: true,
    tags: ['Neuroscience', 'FSRS', 'Memory Consolidation', 'Active Recall', 'Cognitive Science', 'Image Occlusion'],
    targetAudience: 'Anyone who wants to know why spaced retrieval works',
    summary: DEMO_STUDY_SESSIONS[0].description,
    session: DEMO_STUDY_SESSIONS[0]
  }
];

const BOARD_EXAM_PATTERN = /\b(USMLE|MCAT|COMLEX)\b/i;
const HIGHER_ED_PATTERN = /medic|med school|university|college|undergrad|graduate|pre-?med|residen|fellow/i;

/** Professional board-exam decks (USMLE, MCAT, ...), shown with a badge in the catalog. */
export function isBoardExamDeck(deck: Pick<StarterDeckMetadata, 'title' | 'tags'>): boolean {
  return BOARD_EXAM_PATTERN.test(deck.title) || deck.tags.some(t => BOARD_EXAM_PATTERN.test(t));
}

/**
 * Orders starter decks for the learner: unless their profile says they are in
 * university or medical school, board-exam decks go last. Stable otherwise.
 */
export function rankStarterDecksForGrade<T extends Pick<StarterDeckMetadata, 'title' | 'tags'>>(
  decks: T[],
  grade?: string | null
): T[] {
  if (grade && HIGHER_ED_PATTERN.test(grade)) return [...decks];
  return [...decks.filter(d => !isBoardExamDeck(d)), ...decks.filter(d => isBoardExamDeck(d))];
}
