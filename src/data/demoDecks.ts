import type { StudySession } from '../types';

export const DEMO_STUDY_SESSIONS: StudySession[] = [
  {
    id: 'demo-memory-neuroscience',
    title: 'The Neuroscience of Memory & Spaced Retrieval',
    category: 'Cognitive Psychology',
    description: 'Master how the hippocampus consolidates short-term traces into neocortical long-term memories via active retrieval and synaptic plasticity.',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    concepts: [
      {
        id: 'c1-consolidation',
        order: 1,
        title: 'Hippocampal Consolidation & Synaptic Tagging',
        estimatedMinutes: 12,
        mentalModel: 'Think of the hippocampus as a high-speed temporary RAM buffer, and the neocortex as the permanent SSD. Long-term memory formation is the slow background file transfer between them, triggered when synapses are chemically tagged during intense retrieval practice.',
        coreTakeaways: [
          'Memories are initially fragile neural networks dependent on hippocampal CA1/CA3 circuits.',
          'Systemic consolidation transfers synaptic weights to distributed neocortical areas during deep NREM slow-wave sleep.',
          'Passive re-reading fails to tag synapses; retrieval failure followed by feedback produces the highest neurochemical release of BDNF (Brain-Derived Neurotrophic Factor).'
        ],
        keyTerms: [
          { term: 'Long-Term Potentiation (LTP)', definition: 'A persistent strengthening of synapses based on recent patterns of activity, increasing dendritic spine density.' },
          { term: 'Testing Effect', definition: 'The empirical finding that actively retrieving information from memory produces superior long-term retention compared to repeated study.' },
          { term: 'Synaptic Tagging & Capture', definition: 'The hypothesis that active neural firing tags a synapse, allowing it to capture plasticity-related proteins to stabilize connections.' }
        ],
        feynmanPrompt: 'Explain how your brain turns a temporary fact into permanent knowledge to a high schooler. Specifically explain why re-reading your notes feels easy but doesn\'t work, while testing yourself feels hard but locks it in.',
        sampleMasteryExplanation: 'When you first learn something, your hippocampus holds it like a temporary sticky note. Re-reading feels fluent because your eyes recognize the shapes, tricking you into feeling mastery without firing deep neural circuits. When you force yourself to retrieve the answer without looking, your brain struggles. That struggle triggers chemical tags at your synapses. During sleep, your brain uses those tags to permanently wire the memory into the cortex.',
        retrievalCards: [
          {
            id: 'rc-101',
            conceptId: 'c1-consolidation',
            question: 'What is the "Fluency Illusion" (or illusion of competence) caused by passive re-reading?',
            answer: 'Passive recognition feels easy because the material is in front of you, giving the false sensation that you have mastered and encoded the concept into long-term memory.',
            hint: 'Think about the difference between recognizing a face vs recalling a phone number from scratch.',
            explanation: 'Cognitive psychologists found that fluency during study negatively correlates with delayed test performance because it bypasses elaborative retrieval.',
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          },
          {
            id: 'rc-102',
            conceptId: 'c1-consolidation',
            question: 'During which phase of sleep does systemic hippocampal-to-neocortical memory consolidation primarily occur?',
            answer: 'Slow-Wave Sleep (NREM Stages 3 & 4), driven by hippocampal sharp-wave ripples and cortical slow oscillations.',
            hint: 'It is not REM sleep; it is the deep, restorative phase of non-REM sleep.',
            explanation: 'Sharp-wave ripples in the hippocampus replay the day\'s encoded sequences at 10x-20x speed, entraining neocortical networks.',
            stability: 1,
            difficulty: 5,
            reps: 0,
            lapses: 0,
          }
        ]
      },
      {
        id: 'c2-fsrs-spacing',
        order: 2,
        title: 'Desirable Difficulty & Optimal Spacing Intervals',
        estimatedMinutes: 10,
        mentalModel: 'Memory is like a muscle recovering from resistance training. Reviewing too soon gives zero stimulus because the weight is too light. Reviewing right as the memory begins to fade requires maximum cognitive effort, which forces the largest leap in retention stability.',
        coreTakeaways: [
          'Bjork\'s Principle of Desirable Difficulty: Conditions that make learning feel harder and slower in the short term actually optimize long-term retention and transfer.',
          'Memory has two components: Storage Strength (how deeply ingrained it is) and Retrieval Strength (how easily accessible it is right now).',
          'Spaced intervals must expand geometrically (1 day -> 3 days -> 7 days -> 21 days) to match the exponential decay of the forgetting curve.'
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
            question: 'Why is studying immediately after you already got an answer right largely wasted cognitive effort?',
            answer: 'Because Retrieval Strength is at 100%, requiring near-zero cognitive effort. Without "desirable difficulty", the brain receives no neurochemical signal to increase Storage Strength.',
            hint: 'Relate this to lifting a 1-pound weight right after a heavy set.',
            explanation: 'Robert Bjork demonstrated that maximum storage gain occurs when retrieval strength is low but still recoverable.',
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
    id: 'demo-cellular-atp',
    title: 'Cellular Respiration: ATP Synthase & Chemiosmosis',
    category: 'Biochemistry',
    description: 'Understand the turbine engine of life: how electron transport pumps protons to create an electrochemical gradient that drives ATP synthesis.',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    concepts: [
      {
        id: 'c-bio-1',
        order: 1,
        title: 'The Electrochemical Proton Gradient & Mitochondrial Matrix',
        estimatedMinutes: 12,
        mentalModel: 'Think of the inner mitochondrial membrane as a hydroelectric dam. Complexes I, III, and IV pump water (protons) uphill into the reservoir (intermembrane space). The only way back down is through the water turbine (ATP Synthase).',
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
            question: 'What two physical components create the Proton-Motive Force (PMF)?',
            answer: '1) The chemical concentration gradient (difference in H+ pH) and 2) The electrical potential gradient (voltage difference across the membrane).',
            hint: 'Think chemistry (concentration) and physics (charge).',
            explanation: 'Both the charge difference (positive intermembrane space vs negative matrix) and chemical gradient drive H+ back into the matrix.',
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
    concepts: [
      {
        id: 'c-cs-1',
        order: 1,
        title: 'The Von Neumann Bottleneck & Locality of Reference',
        estimatedMinutes: 14,
        mentalModel: 'A CPU is like a master chef who can chop vegetables in 1 nanosecond. RAM is a grocery store across town (100 nanoseconds away). The CPU cache is the chef\'s cutting board right in front of them with the ingredients they need right now.',
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
            question: 'What is the typical size of a modern CPU cache line, and why does the hardware fetch more bytes than requested?',
            answer: 'Typically 64 bytes. It fetches adjacent bytes to exploit Spatial Locality, anticipating that programs will process contiguous blocks of memory.',
            hint: 'Think about standard byte chunks and why nearby data matters.',
            explanation: 'Because memory bus transactions have high latency, fetching 64 contiguous bytes costs almost the same time as fetching a single byte.',
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
