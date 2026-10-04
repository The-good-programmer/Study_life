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
    sourceDocument: {
      name: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf',
      totalPages: 3,
      pages: [
        {
          pageNumber: 1,
          text: 'SECTION 1: THE NEUROBIOLOGY OF CONSOLIDATION AND SYNAPTIC TAGGING\n\nMemories are initially encoded as fragile neurochemical patterns within the hippocampus, specifically traversing the dentate gyrus and CA3/CA1 subfields. Under conventional study conditions, students frequently experience the "Fluency Illusion" (Bjork et al., 2013). Because printed texts provide immediate perceptual cues, reading feels effortless, leading subjects to misattribute cognitive ease to durable memory storage.\n\nEmpirical research across cognitive psychology has demonstrated that Long-Term Potentiation (LTP) and synaptic tagging and capture require deliberate retrieval strain. Frey and Morris (1997) established that synaptic stimulation creates a temporary molecular "tag" at stimulated dendritic spines. When retrieval failure is followed by corrective feedback, significant concentrations of Brain-Derived Neurotrophic Factor (BDNF) are released, allowing tagged synapses to capture plasticity-related proteins and achieve permanent consolidation.\n\nDuring subsequent slow-wave sleep (NREM stage 3/4), sharp-wave ripples from the hippocampus trigger synchronized cortical slow oscillations, systematically migrating synaptic weights from the temporary hippocampal buffer into distributed neocortical networks. Without active retrieval, synaptic tags decay within hours.'
        },
        {
          pageNumber: 2,
          text: 'SECTION 2: DESIRABLE DIFFICULTY AND OPTIMAL SPACING INTERVALS\n\nRobert Bjork\'s Principle of Desirable Difficulty posits that conditions that make learning feel harder and slower in the short term actually optimize long-term retention and semantic transfer. Human memory is governed by two functionally independent metrics: Storage Strength (how deeply encoded and structurally represented a trace is) and Retrieval Strength (the current ease of accessing that trace at a given moment in time).\n\nWhen a student reviews material immediately after correct recall, Retrieval Strength is 100%, meaning the retrieval attempt requires minimal metabolic effort. Consequently, the brain registers no evolutionary or neurochemical necessity to elevate Storage Strength. Maximum memory stabilization occurs when retrieval is practiced at the critical juncture where Retrieval Strength has decayed significantly but remains reconstructible.'
        },
        {
          pageNumber: 3,
          text: 'SECTION 3: FREE SPACED REPETITION SCHEDULER (FSRS) AND MATHEMATICAL RETRIEVAL\n\nThe Free Spaced Repetition Scheduler (FSRS) models the probability of recall R(t) as a power-law decay curve parameterized by Stability S and Item Difficulty D. By calculating the exact day when R(t) hits 90%, FSRS optimizes study efficiency, preventing over-testing and reducing cumulative repetition workload by 30-40% relative to legacy Leitner and SM-2 algorithms.'
        }
      ]
    },
    concepts: [
      {
        id: 'c1-consolidation',
        order: 1,
        title: 'Hippocampal Consolidation & Synaptic Tagging',
        estimatedMinutes: 12,
        mentalModel: 'Think of the hippocampus as a high-speed temporary RAM buffer, and the neocortex as the permanent SSD. Long-term memory formation is the slow background file transfer between them, triggered when synapses are chemically tagged during intense retrieval practice.',
        sourceAnchor: {
          pageNumber: 1,
          snippet: 'Memories are initially encoded as fragile neurochemical patterns within the hippocampus... synaptic stimulation creates a temporary molecular "tag"...',
          sourceName: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf'
        },
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
            cardType: 'standard',
            question: 'What is the "Fluency Illusion" (or illusion of competence) caused by passive re-reading?',
            answer: 'Passive recognition feels easy because the material is in front of you, giving the false sensation that you have mastered and encoded the concept into long-term memory.',
            hint: 'Think about the difference between recognizing a face vs recalling a phone number from scratch.',
            explanation: 'Cognitive psychologists found that fluency during study negatively correlates with delayed test performance because it bypasses elaborative retrieval.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'Under conventional study conditions, students frequently experience the "Fluency Illusion"...',
              sourceName: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf'
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
            question: 'Systemic memory consolidation transfers synaptic weights from the temporary hippocampal buffer to the {{neocortex}} during slow-wave sleep.',
            clozeTemplate: 'Systemic memory consolidation transfers synaptic weights from the temporary hippocampal buffer to the {{neocortex}} during slow-wave sleep.',
            answer: 'neocortex',
            hint: 'The outer cerebral mantle responsible for long-term distributed semantic storage.',
            explanation: 'Slow oscillations in the neocortex coordinate with hippocampal sharp-wave ripples to reorganize and stabilize memory storage.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'systematically migrating synaptic weights from the temporary hippocampal buffer into distributed neocortical networks...',
              sourceName: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf'
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
            question: 'Which neurotrophic factor is synthesized and released in high concentrations after an active retrieval struggle followed by corrective feedback?',
            options: [
              'BDNF (Brain-Derived Neurotrophic Factor)',
              'Cortisol (Stress Hormone)',
              'Acetylcholinesterase',
              'Melatonin'
            ],
            answer: 'BDNF (Brain-Derived Neurotrophic Factor)',
            hint: 'A key neurotrophin that stimulates synaptic plasticity, dendritic branching, and neurogenesis.',
            explanation: 'BDNF promotes long-term potentiation (LTP) and synaptic tagging, converting temporary cellular signals into structural dendritic changes.',
            sourceAnchor: {
              pageNumber: 1,
              snippet: 'significant concentrations of Brain-Derived Neurotrophic Factor (BDNF) are released...',
              sourceName: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf'
            },
            stability: 1,
            difficulty: 3,
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
        sourceAnchor: {
          pageNumber: 2,
          snippet: 'Robert Bjork\'s Principle of Desirable Difficulty posits that conditions that make learning feel harder... optimize long-term retention...',
          sourceName: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf'
        },
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
            cardType: 'standard',
            question: 'Why is studying immediately after you already got an answer right largely wasted cognitive effort?',
            answer: 'Because Retrieval Strength is at 100%, requiring near-zero cognitive effort. Without "desirable difficulty", the brain receives no neurochemical signal to increase Storage Strength.',
            hint: 'Relate this to lifting a 1-pound weight right after a heavy set.',
            explanation: 'Robert Bjork demonstrated that maximum storage gain occurs when retrieval strength is low but still recoverable.',
            sourceAnchor: {
              pageNumber: 2,
              snippet: 'When a student reviews material immediately after correct recall, Retrieval Strength is 100%...',
              sourceName: 'Principles_of_Cognitive_Neuroscience_Ch7.pdf'
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
    id: 'demo-cellular-atp',
    title: 'Cellular Respiration: ATP Synthase & Chemiosmosis',
    category: 'Biochemistry',
    description: 'Understand the turbine engine of life: how electron transport pumps protons to create an electrochemical gradient that drives ATP synthesis.',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    sourceDocument: {
      name: 'Lehninger_Principles_of_Biochemistry_Ch19.pdf',
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
          sourceName: 'Lehninger_Principles_of_Biochemistry_Ch19.pdf'
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
              sourceName: 'Lehninger_Principles_of_Biochemistry_Ch19.pdf'
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
              sourceName: 'Lehninger_Principles_of_Biochemistry_Ch19.pdf'
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
              sourceName: 'Lehninger_Principles_of_Biochemistry_Ch19.pdf'
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
      name: 'Computer_Systems_A_Programmers_Perspective_Ch6.pdf',
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
          sourceName: 'Computer_Systems_A_Programmers_Perspective_Ch6.pdf'
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
              sourceName: 'Computer_Systems_A_Programmers_Perspective_Ch6.pdf'
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
              sourceName: 'Computer_Systems_A_Programmers_Perspective_Ch6.pdf'
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
              sourceName: 'Computer_Systems_A_Programmers_Perspective_Ch6.pdf'
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
