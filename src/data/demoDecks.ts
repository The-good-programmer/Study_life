import type { StudySession } from '../types';
import { SYNAPSE_DIAGRAM, diagramCards } from './diagrams';
import { quickCards } from './quickCards';

// Source notes written for Studify; they are not excerpts of any published book.
const MEMORY_NOTES = 'Studify notes: The science of memory';

export const DEMO_STUDY_SESSIONS: StudySession[] = [
  {
    id: 'demo-memory-neuroscience',
    title: 'How Memory Works: Retrieval, Spacing & Scheduling',
    category: 'Cognitive Psychology',
    description: 'How memories are formed and consolidated, why testing yourself beats re-reading, why spacing works, and how the FSRS scheduler decides when you see a card.',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    sourceDocument: {
      name: MEMORY_NOTES,
      totalPages: 3,
      pages: [
        {
          pageNumber: 1,
          text: 'SECTION 1: ENCODING, CONSOLIDATION AND THE TESTING EFFECT\n\nNew declarative memories depend on the hippocampus; patient H.M., whose hippocampi were removed in 1953, could no longer form lasting new memories of facts and events. At the cellular level, learning is thought to rely on synaptic plasticity such as long-term potentiation (LTP), a lasting strengthening of synapses after patterned activity. Frey and Morris (1997) proposed synaptic tagging and capture: activity leaves a temporary tag at a synapse, which can later capture the proteins needed to make the change last.\n\nMemories are stabilized over time (consolidation). During slow-wave sleep, hippocampal sharp-wave ripples coincide with cortical slow oscillations and sleep spindles, and this coordination is thought to help shift memories into neocortical networks.\n\nRe-reading creates a fluency illusion: the material feels familiar, which is easily mistaken for being able to recall it (Bjork, Dunlosky & Kornell, 2013). Retrieval practice avoids this. In Roediger and Karpicke (2006), students who studied a passage once and then took recall tests remembered more a week later than students who re-read it, even though re-reading did slightly better on a test five minutes later.'
        },
        {
          pageNumber: 2,
          text: 'SECTION 2: DESIRABLE DIFFICULTY AND OPTIMAL SPACING INTERVALS\n\nRobert Bjork\'s Principle of Desirable Difficulty posits that conditions that make learning feel harder and slower in the short term actually optimize long-term retention and semantic transfer. Human memory is governed by two functionally independent metrics: Storage Strength (how deeply encoded and structurally represented a trace is) and Retrieval Strength (the current ease of accessing that trace at a given moment in time).\n\nReviewing right after a correct recall, when Retrieval Strength is still high, adds little Storage Strength. Retrieval that takes effort, after some forgetting but while the memory can still be recovered, strengthens it more. This is why spaced practice beats massed practice (Cepeda et al., 2006), and why the best gap between sessions grows with how long the material needs to be remembered (Cepeda et al., 2008). Interleaving, mixing different problem types in one session, is another desirable difficulty: in Rohrer and Taylor (2007), students who practised mixed problems did far better on a delayed test than students who practised one type at a time.'
        },
        {
          pageNumber: 3,
          text: 'SECTION 3: FREE SPACED REPETITION SCHEDULER (FSRS) AND MATHEMATICAL RETRIEVAL\n\nThe Free Spaced Repetition Scheduler (FSRS) describes each memory with three numbers: Difficulty (D), Stability (S) and Retrievability (R). Retrievability is the probability of recalling the card right now; it falls over time along a power-law forgetting curve. Stability is the number of days it takes R to fall from 100% to 90%. FSRS schedules the next review for the day R is predicted to drop to your desired retention (90% by default). A higher desired retention means shorter intervals and more reviews. A successful recall raises stability, so the next interval is longer; pressing Again counts as a lapse and lowers it. FSRS fits its parameters to real review histories, and in public benchmarks on Anki data it predicts recall more accurately than the older SM-2 algorithm.'
        }
      ]
    },
    concepts: [
      {
        id: 'c1-consolidation',
        order: 1,
        title: 'Encoding, Consolidation & the Testing Effect',
        estimatedMinutes: 12,
        mentalModel: 'Think of the hippocampus as a fast temporary buffer and the neocortex as long-term storage. Consolidation, much of it during sleep, is the slow transfer between them; testing yourself is how you check, and strengthen, what made it across.',
        sourceAnchor: {
          pageNumber: 1,
          snippet: 'New declarative memories depend on the hippocampus...',
          sourceName: MEMORY_NOTES
        },
        coreTakeaways: [
          'Forming new memories of facts and events depends on the hippocampus.',
          'Consolidation stabilizes memories over time; slow-wave sleep is thought to help move them into the neocortex.',
          'Testing yourself beats re-reading for long-term retention (the testing effect), even though re-reading feels more effective.'
        ],
        keyTerms: [
          { term: 'Long-Term Potentiation (LTP)', definition: 'A persistent strengthening of synapses based on recent patterns of activity, increasing dendritic spine density.' },
          { term: 'Testing Effect', definition: 'The empirical finding that actively retrieving information from memory produces superior long-term retention compared to repeated study.' },
          { term: 'Synaptic Tagging & Capture', definition: 'The hypothesis that active neural firing tags a synapse, allowing it to capture plasticity-related proteins to stabilize connections.' }
        ],
        feynmanPrompt: 'Explain how your brain turns a temporary fact into permanent knowledge to a high schooler. Specifically explain why re-reading your notes feels easy but doesn\'t work, while testing yourself feels hard but locks it in.',
        sampleMasteryExplanation: 'When you first learn something, your hippocampus holds it like a temporary sticky note. Re-reading feels fluent because your eyes recognize the shapes, tricking you into feeling mastery without firing deep neural circuits. When you force yourself to retrieve the answer without looking, your brain struggles. That effortful retrieval makes the memory easier to retrieve next time, and while you sleep your brain keeps stabilizing what you learned.',
        retrievalCards: [
          {
            id: 'rc-101',
            conceptId: 'c1-consolidation',
            cardType: 'standard',
            question: 'What is the "Fluency Illusion" (or illusion of competence) caused by passive re-reading?',
            answer: 'Passive recognition feels easy because the material is in front of you, giving the false sensation that you have mastered and encoded the concept into long-term memory.',
            hint: 'Think about the difference between recognizing a face vs recalling a phone number from scratch.',
            explanation: 'How easy material feels while you study is a poor guide to how well you will recall it later (Bjork, Dunlosky & Kornell, 2013).',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'Re-reading creates a fluency illusion...',
              sourceName: MEMORY_NOTES
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-102',
            conceptId: 'c1-consolidation',
            cardType: 'cloze',
            question: 'During slow-wave sleep, consolidation is thought to help shift memories from the hippocampus into the {{neocortex}}.',
            clozeTemplate: 'During slow-wave sleep, consolidation is thought to help shift memories from the hippocampus into the {{neocortex}}.',
            answer: 'neocortex',
            hint: 'The outer cerebral mantle responsible for long-term distributed semantic storage.',
            explanation: 'Hippocampal sharp-wave ripples coincide with cortical slow oscillations and spindles during slow-wave sleep.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'this coordination is thought to help shift memories into neocortical networks.',
              sourceName: MEMORY_NOTES
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-103',
            conceptId: 'c1-consolidation',
            cardType: 'multiple-choice',
            question: 'In Roediger and Karpicke (2006), which group remembered more a week later?',
            options: [
              'Students who took recall tests after one reading',
              'Students who re-read the passage several times',
              'Students who highlighted the passage',
              'Both groups remembered the same amount'
            ],
            answer: 'Students who took recall tests after one reading',
            hint: 'Re-reading only won on the test given five minutes later.',
            explanation: 'Retrieval practice produced better retention after a week, even though re-reading felt more effective and did slightly better on an immediate test.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'In Roediger and Karpicke (2006), students who studied a passage once and then took recall tests remembered more a week later...',
              sourceName: MEMORY_NOTES
            },
            stability: 1,
            difficulty: 3,
            reps: 0,
            lapses: 0,
          },
          ...quickCards({ conceptId: 'c1-consolidation', idPrefix: 'rc-1x', sourceName: MEMORY_NOTES }, [
            { page: 1, q: 'Which brain structure is essential for forming new memories of facts and events?', a: 'The hippocampus', options: ['The hippocampus', 'The cerebellum', 'The amygdala', 'The visual cortex'], why: 'Patient H.M. could not form lasting new declarative memories after both hippocampi were removed.' },
            { page: 1, q: 'What is long-term potentiation (LTP)?', a: 'A lasting strengthening of synapses after patterned activity, thought to underlie learning.' },
            { page: 1, q: 'Synaptic tagging and capture was proposed by {{Frey and Morris}} in 1997.' },
            { page: 1, q: 'Why does re-reading feel more effective than it is?', a: 'Familiar material feels fluent, and that ease is mistaken for being able to recall it.' },
          ]),
          ...diagramCards(SYNAPSE_DIAGRAM, {
            conceptId: 'c1-consolidation',
            idPrefix: 'rc-syn',
            question: 'Name the covered part of the synapse.',
            sourceAnchor: { pageNumber: 1, sourceName: MEMORY_NOTES },
          }),
        ]
      },
      {
        id: 'c2-fsrs-spacing',
        order: 2,
        title: 'Desirable Difficulty & Optimal Spacing Intervals',
        estimatedMinutes: 10,
        mentalModel: 'Memory is a bit like training a muscle. Reviewing too soon is a weight that is too light; reviewing once the memory has started to fade, but can still be recalled, takes effort and builds more.',
        sourceAnchor: {
          pageNumber: 2,
          snippet: 'Robert Bjork\'s Principle of Desirable Difficulty posits that conditions that make learning feel harder... optimize long-term retention...',
          sourceName: MEMORY_NOTES
        },
        coreTakeaways: [
          'Bjork\'s Principle of Desirable Difficulty: Conditions that make learning feel harder and slower in the short term actually optimize long-term retention and transfer.',
          'Memory has two components: Storage Strength (how deeply ingrained it is) and Retrieval Strength (how easily accessible it is right now).',
          'Gaps between reviews should grow as a memory gets more stable; a scheduler sets each gap from your own answers rather than a fixed sequence.'
        ],
        keyTerms: [
          { term: 'Storage Strength', definition: 'A theoretical measure of how permanent a memory trace is; once formed, it never truly decreases, only becomes harder to retrieve.' },
          { term: 'Retrieval Strength', definition: 'The current ease of accessing a memory trace; decays rapidly without activation.' },
          { term: 'Interleaving', definition: 'Mixing practice of related but distinct concepts or problem types, preventing rote pattern matching.' }
        ],
        feynmanPrompt: 'Explain the difference between "Storage Strength" and "Retrieval Strength" using the metaphor of a warehouse and a map.',
        sampleMasteryExplanation: 'Storage strength is whether the crate is inside the giant warehouse and how sturdy it is built. Retrieval strength is how fresh the path on your map is to find that crate today. You might know your childhood phone number with infinite storage strength, but low retrieval strength until someone asks you to recall it.',
        retrievalCards: [
          {
            id: 'rc-201',
            conceptId: 'c2-fsrs-spacing',
            cardType: 'standard',
            question: 'Why is studying immediately after you already got an answer right largely wasted cognitive effort?',
            answer: 'Retrieval Strength is still high, so recalling takes almost no effort and adds little Storage Strength. Reviews help most once the memory has faded a little but can still be recovered.',
            hint: 'Relate this to lifting a 1-pound weight right after a heavy set.',
            explanation: 'In Bjork’s new theory of disuse, the gain in storage strength from a retrieval is larger when retrieval strength is lower.',
            sourceAnchor: {
              pageNumber: 2,
              snippet: 'Reviewing right after a correct recall, when Retrieval Strength is still high, adds little Storage Strength.',
              sourceName: MEMORY_NOTES
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          },
          ...quickCards({ conceptId: 'c2-fsrs-spacing', idPrefix: 'rc-2x', sourceName: MEMORY_NOTES }, [
            { page: 2, q: 'In Bjork’s theory, {{storage strength}} is how well a memory is learned, and {{retrieval strength}} is how easily it can be recalled right now.' },
            { page: 2, q: 'What is the spacing effect?', a: 'Spreading study over several sessions gives better long-term retention than the same study time in one block.' },
            { page: 2, q: 'How does the best gap between study sessions relate to how long you need to remember something?', a: 'The longer you need to remember it, the longer the best gap (Cepeda et al., 2008).' },
            { page: 2, q: 'What is interleaving?', a: 'Mixing different problem types or topics within one practice session instead of practising one type at a time.' },
            { page: 2, q: 'What did Rohrer and Taylor (2007) find about interleaved practice?', a: 'Students who practised mixed problem types did far better on a delayed test than students who practised one type at a time.' },
            { page: 2, q: 'Which is a desirable difficulty?', a: 'Spacing reviews out over days', options: ['Spacing reviews out over days', 'Re-reading notes until they feel familiar', 'Highlighting key sentences', 'Studying everything the night before'] },
          ])
        ]
      },
      {
        id: 'c3-fsrs-scheduler',
        order: 3,
        title: 'How the Scheduler Decides (FSRS)',
        estimatedMinutes: 8,
        mentalModel: 'Every card carries a forecast: how likely you are to recall it today. FSRS brings the card back on the day that forecast drops to your target, usually 90%.',
        sourceAnchor: {
          pageNumber: 3,
          snippet: 'FSRS schedules the next review for the day R is predicted to drop to your desired retention (90% by default).',
          sourceName: MEMORY_NOTES
        },
        coreTakeaways: [
          'FSRS tracks Difficulty, Stability and Retrievability for every card.',
          'Stability is the number of days for recall probability to fall from 100% to 90%.',
          'Higher desired retention means shorter intervals and more reviews.'
        ],
        keyTerms: [
          { term: 'Retrievability', definition: 'The predicted probability of recalling a card right now.' },
          { term: 'Stability', definition: 'Days for retrievability to fall from 100% to 90%.' },
          { term: 'Desired retention', definition: 'The recall probability at which a card is scheduled for review.' }
        ],
        feynmanPrompt: 'Explain to a friend why raising desired retention from 90% to 97% makes their daily review pile much bigger.',
        sampleMasteryExplanation: 'The scheduler brings a card back when your chance of recalling it falls to the target. At 90% it can wait until you have forgotten a little; at 97% it has to bring the card back much sooner, before almost any forgetting. Shorter gaps mean every card comes back more often, so the daily pile grows.',
        retrievalCards: quickCards({ conceptId: 'c3-fsrs-scheduler', idPrefix: 'rc-3x', sourceName: MEMORY_NOTES }, [
          { page: 3, q: 'What three numbers does FSRS keep for each card?', a: 'Difficulty, Stability and Retrievability.' },
          { page: 3, q: 'In FSRS, {{retrievability}} is the probability of recalling a card right now.' },
          { page: 3, q: 'How does FSRS define stability?', a: 'The number of days it takes recall probability to fall from 100% to 90%.' },
          { page: 3, q: 'When does FSRS schedule a card’s next review?', a: 'On the day its recall probability is predicted to fall to your desired retention (90% by default).' },
          { page: 3, q: 'What happens to your workload if you raise desired retention?', a: 'It goes up: intervals get shorter and reviews more frequent', options: ['It goes up: intervals get shorter and reviews more frequent', 'It goes down: intervals get longer', 'Nothing changes', 'Only new cards are affected'] },
          { page: 3, q: 'What does pressing Again do to a card in FSRS?', a: 'Counts a lapse and lowers its stability, so it comes back sooner.' },
          { page: 3, q: 'What shape is the FSRS forgetting curve?', a: 'A power-law decay of recall probability over time.' },
          { page: 3, q: 'FSRS’s default desired retention is {{90%}}.' },
        ])
      }
    ]
  },
  {
    id: 'demo-cellular-atp',
    title: 'Cellular Respiration: ATP Synthase & Chemiosmosis',
    category: 'Biochemistry',
    description: 'Understand the turbine engine of life: how electron transport pumps protons to create an electrochemical gradient that drives ATP synthesis.',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    sourceDocument: {
      name: 'Studify notes: Cellular respiration',
      totalPages: 2,
      pages: [
        {
          pageNumber: 1,
          text: 'CHAPTER 19: OXIDATIVE PHOSPHORYLATION AND CHEMIOSMOSIS\n\nElectrons harvested from catabolic oxidation of glucose and fatty acids are funneled through NADH and FADH2 into the respiratory chain located in the inner mitochondrial membrane. The flow of electrons through Complex I (NADH:ubiquinone oxidoreductase), Complex III (cytochrome bc1 complex), and Complex IV (cytochrome c oxidase) is thermodynamically coupled to the vector pumping of protons (H+) from the mitochondrial matrix into the intermembrane space.\n\nThis asymmetrical translocation of protons establishes an electrochemical gradient consisting of two distinct forces: 1) a chemical pH difference (delta-pH, with the matrix being more alkaline), and 2) a transmembrane electrical potential (delta-psi, with the matrix carrying a negative charge of approximately -160 to -180 mV). Together, these sum to create the Proton-Motive Force (PMF).'
        },
        {
          pageNumber: 2,
          text: 'THE F0F1 ATP SYNTHASE AS A MOLECULAR ROTARY TURBINE\n\nPeter Mitchell\'s chemiosmotic hypothesis established that the proton-motive force drives ATP synthesis as protons re-enter the mitochondrial matrix through ATP Synthase (Complex V). The enzyme consists of two primary functional domains: the membrane-embedded F0 proton-conducting channel and the matrix-projecting catalytic F1 headpiece.\n\nProton translocation across the c-ring of F0 generates rotational mechanical torque, driving the asymmetric gamma central stalk like a driveshaft. Rotation of the gamma stalk sequentially alters the conformation of the three catalytic beta subunits of F1 through Open (O), Loose (L), and Tight (T) states, synthesizing ATP from ADP and inorganic phosphate (Pi).'
        }
      ]
    },
    concepts: [
      {
        id: 'c-bio-1',
        order: 1,
        title: 'The Electrochemical Proton Gradient & Mitochondrial Matrix',
        estimatedMinutes: 12,
        mentalModel: 'Think of the inner mitochondrial membrane as a hydroelectric dam. Complexes I, III, and IV pump water (protons) uphill into the reservoir (intermembrane space). The only way back down is through the water turbine (ATP Synthase).',
        sourceAnchor: {
          pageNumber: 1,
          snippet: 'This asymmetrical translocation of protons establishes an electrochemical gradient... creating the Proton-Motive Force (PMF).',
          sourceName: 'Studify notes: Cellular respiration'
        },
        coreTakeaways: [
          'High-energy electrons from NADH and FADH2 pass through protein complexes in the inner mitochondrial membrane.',
          'Electron transfer releases free energy, used to pump H+ ions into the intermembrane space, creating a proton-motive force.',
          'The matrix becomes negatively charged and higher in pH relative to the intermembrane space.'
        ],
        keyTerms: [
          { term: 'Proton-Motive Force (PMF)', definition: 'The combined electrical potential (voltage) and chemical gradient (pH difference) across the inner mitochondrial membrane.' },
          { term: 'Chemiosmosis', definition: 'The movement of ions across a semipermeable membrane down their electrochemical gradient, used to synthesize ATP.' }
        ],
        feynmanPrompt: 'Explain how the cell uses food electrons to charge the mitochondrial battery, without using complex chemical nomenclature.',
        sampleMasteryExplanation: 'When you eat, food molecules hand off energetic electrons like a hot potato down a bucket brigade. Each handoff releases a burst of energy that pumps protons across a barrier. This traps a high pressure of protons on one side, exactly like winding up a spring or building up water behind a dam.',
        retrievalCards: [
          {
            id: 'rc-bio-1',
            conceptId: 'c-bio-1',
            cardType: 'standard',
            question: 'What two physical components create the Proton-Motive Force (PMF)?',
            answer: '1) The chemical concentration gradient (difference in H+ pH) and 2) The electrical potential gradient (voltage difference across the membrane).',
            hint: 'Think chemistry (concentration) and physics (charge).',
            explanation: 'Both the charge difference (positive intermembrane space vs negative matrix) and chemical gradient drive H+ back into the matrix.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'an electrochemical gradient consisting of two distinct forces: 1) chemical pH difference and 2) transmembrane electrical potential...',
              sourceName: 'Studify notes: Cellular respiration'
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-bio-2',
            conceptId: 'c-bio-1',
            cardType: 'cloze',
            question: 'The enzyme {{ATP Synthase}} acts as a molecular rotary motor, using proton flow down its electrochemical gradient to synthesize ATP.',
            clozeTemplate: 'The enzyme {{ATP Synthase}} acts as a molecular rotary motor, using proton flow down its electrochemical gradient to synthesize ATP.',
            answer: 'ATP Synthase',
            hint: 'The F0F1 turbine complex embedded in the inner mitochondrial membrane.',
            explanation: 'Protons moving through the F0 stalk rotate the gamma subunit, inducing conformational catalytic changes in the F1 head to bind ADP + Pi.',
            sourceAnchor: {
              pageNumber: 2,
              snippet: 're-enter the mitochondrial matrix through ATP Synthase (Complex V)... generates rotational mechanical torque...',
              sourceName: 'Studify notes: Cellular respiration'
            },
            stability: 1,
            difficulty: 3,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-bio-3',
            conceptId: 'c-bio-1',
            cardType: 'multiple-choice',
            question: 'Into which mitochondrial compartment are protons (H+) actively pumped by Complexes I, III, and IV during electron transport?',
            options: [
              'Intermembrane Space',
              'Mitochondrial Matrix',
              'Cytoplasm',
              'Outer Membrane Lumen'
            ],
            answer: 'Intermembrane Space',
            hint: 'The narrow zone between the inner and outer membranes where H+ concentration accumulates.',
            explanation: 'Accumulation of H+ in the intermembrane space creates an acidic, positively charged reservoir relative to the alkaline matrix.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'vector pumping of protons (H+) from the mitochondrial matrix into the intermembrane space...',
              sourceName: 'Studify notes: Cellular respiration'
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          }
        ]
      }
    ]
  },
  {
    id: 'demo-cpu-cache',
    title: 'Computer Architecture: The Memory Hierarchy & Cache Locality',
    category: 'Computer Science',
    description: 'Demystify why CPU registers and L1/L2 caches are 100x faster than main RAM, and how spatial and temporal locality make modern software fly.',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    sourceDocument: {
      name: 'Studify notes: The memory hierarchy',
      totalPages: 2,
      pages: [
        {
          pageNumber: 1,
          text: 'CHAPTER 6: THE MEMORY HIERARCHY AND CACHE PERFORMANCE\n\nModern microprocessors can execute billions of instructions per second, with cycle times measured in sub-nanoseconds. In stark contrast, Dynamic RAM (DRAM) access latencies remain stubborn at 50 to 100 nanoseconds—a disparity known in computer architecture as the "Memory Wall" or Von Neumann Bottleneck.\n\nTo bridge this performance chasm, hardware architects place a multi-tiered hierarchy of Static RAM (SRAM) caches (L1, L2, L3) between the CPU execution units and main memory. The effectiveness of caching rests entirely on the empirical phenomenon of Locality of Reference: programs tend to reuse data and instructions they have used recently (Temporal Locality), or data residing at neighboring memory addresses (Spatial Locality).'
        },
        {
          pageNumber: 2,
          text: 'CACHE LINES AND STRIDE EFFECTS IN MATRIX TRAVERSAL\n\nCaches do not transfer single words of memory in isolation. Whenever a cache miss occurs, the memory controller fetches a fixed-size block known as a Cache Line (universally 64 bytes in modern x86-64 and ARM64 architectures). Loading 64 bytes takes roughly the same bus cycle time as loading a single 4-byte integer.\n\nConsider traversing a two-dimensional array. In row-major languages (C, C++, Rust, Python NumPy), rows are stored consecutively in physical address space. A row-wise loop exhibits Stride-1 access: reading element (i, j) loads its entire 64-byte line, allowing subsequent elements (i, j+1), (i, j+2) ... to hit in L1 cache with 1-cycle latency. Conversely, traversing column-wise (i+1, j) jumps memory addresses by the entire row length, causing a cache miss on virtually every element and stalling the CPU.'
        }
      ]
    },
    concepts: [
      {
        id: 'c-cs-1',
        order: 1,
        title: 'The Von Neumann Bottleneck & Locality of Reference',
        estimatedMinutes: 14,
        mentalModel: 'A CPU is like a master chef who can chop vegetables in 1 nanosecond. RAM is a grocery store across town (100 nanoseconds away). The CPU cache is the chef\'s cutting board right in front of them with the ingredients they need right now.',
        sourceAnchor: {
          pageNumber: 1,
          snippet: 'Modern microprocessors can execute billions of instructions per second... Von Neumann Bottleneck... Locality of Reference...',
          sourceName: 'Studify notes: The memory hierarchy'
        },
        coreTakeaways: [
          'The CPU clock executes billions of cycles per second, but fetching an instruction from DRAM takes hundreds of cycles (the Von Neumann Bottleneck).',
          'Temporal Locality: If a memory location is accessed once, it is very likely to be accessed again soon (e.g., loop counters).',
          'Spatial Locality: If a memory location is accessed, nearby memory locations are likely to be accessed soon (e.g., traversing an array).'
        ],
        keyTerms: [
          { term: 'Cache Line', definition: 'The minimum unit of data transferred between main memory and cache, typically 64 bytes.' },
          { term: 'Cache Hit / Miss', definition: 'A hit occurs when requested data is found in high-speed cache; a miss forces a costly stall cycle to fetch from slower DRAM.' }
        ],
        feynmanPrompt: 'Explain to a beginner programmer why iterating through a matrix row-by-row can be 20x faster than iterating column-by-column, even though the total number of operations is identical.',
        sampleMasteryExplanation: 'In computer memory, a 2D matrix is stored as one long flat row of numbers. When the CPU asks for the first number, it automatically grabs a chunk of 64 bytes (the next 8-16 numbers along with it) into its ultra-fast cache. When you walk row-by-row, every next number is already sitting in the cache! When you walk column-by-column, you jump thousands of memory addresses away every single step, causing a slow stall on every single item.',
        retrievalCards: [
          {
            id: 'rc-cs-1',
            conceptId: 'c-cs-1',
            cardType: 'standard',
            question: 'What is the typical size of a modern CPU cache line, and why does the hardware fetch more bytes than requested?',
            answer: 'Typically 64 bytes. It fetches adjacent bytes to exploit Spatial Locality, anticipating that programs will process contiguous blocks of memory.',
            hint: 'Think about standard byte chunks and why nearby data matters.',
            explanation: 'Because memory bus transactions have high latency, fetching 64 contiguous bytes costs almost the same time as fetching a single byte.',
            sourceAnchor: {
              pageNumber: 2,
              snippet: 'Whenever a cache miss occurs, the memory controller fetches a fixed-size block known as a Cache Line (universally 64 bytes)...',
              sourceName: 'Studify notes: The memory hierarchy'
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-cs-2',
            conceptId: 'c-cs-1',
            cardType: 'cloze',
            question: 'Repeatedly reading or updating a loop counter variable inside a tight loop is an example of {{temporal locality}}.',
            clozeTemplate: 'Repeatedly reading or updating a loop counter variable inside a tight loop is an example of {{temporal locality}}.',
            answer: 'temporal locality',
            hint: 'The type of locality concerning repeated reuse of the same exact memory address over short time horizons.',
            explanation: 'Because the data is already warm in L1 cache registers, temporal locality eliminates DRAM latency entirely.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'programs tend to reuse data and instructions they have used recently (Temporal Locality)...',
              sourceName: 'Studify notes: The memory hierarchy'
            },
            stability: 1,
            difficulty: 3,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-cs-3',
            conceptId: 'c-cs-1',
            cardType: 'multiple-choice',
            question: 'Why does traversing a 2D array column-by-column in row-major languages (like C, C++, Python) run drastically slower than row-by-row traversal?',
            options: [
              'Every step strided across rows jumps past the 64-byte cache line, causing constant cache misses',
              'Column indices require 64-bit address calculation instead of 32-bit',
              'The memory controller throttles power when non-sequential rows are read',
              'The CPU instruction pipeline completely stalls on integer indexing'
            ],
            answer: 'Every step strided across rows jumps past the 64-byte cache line, causing constant cache misses',
            hint: 'Think about how memory layout in flat RAM compares to grid coordinates.',
            explanation: 'Stride-1 accesses load 8-16 elements per cache miss. Strided accesses miss on every single element, stalling hundreds of CPU cycles each time.',
            sourceAnchor: {
              pageNumber: 2,
              snippet: 'A row-wise loop exhibits Stride-1 access... Conversely, traversing column-wise jumps memory addresses... causing a cache miss...',
              sourceName: 'Studify notes: The memory hierarchy'
            },
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          }
        ]
      }
    ]
  }
];
