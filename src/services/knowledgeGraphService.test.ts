import { describe, it, expect } from 'vitest';
import { KnowledgeGraphService } from './knowledgeGraphService';
import type { ConceptCheckpoint, StudySession } from '../types';

const createMockSession = (id: string, title: string, concepts: ConceptCheckpoint[]): StudySession => ({
  id,
  title,
  category: 'Biology',
  description: 'Test session',
  currentConceptIndex: 0,
  currentPhase: 'feynman',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  concepts,
});

describe('KnowledgeGraphService', () => {
  const session1: StudySession = createMockSession('deck-bio-1', 'Cell Biology', [
    {
      id: 'c-mitochondria',
      title: 'Mitochondrial ATP Synthesis',
      mentalModel: 'Biological hydroelectric dam producing cellular energy',
      coreTakeaways: ['Proton gradient drives ATP synthase rotor', 'Matrix stores chemical potential'],
      keyTerms: [
        { term: 'ATP Synthase', definition: 'Molecular motor that phosphorylates ADP' },
        { term: 'Proton Gradient', definition: 'Electrochemical potential difference across inner membrane' }
      ],
      feynmanPrompt: 'Explain how proton flow rotates ATP synthase.',
      order: 1,
      estimatedMinutes: 10,
      sampleMasteryExplanation: 'Protons flow down their concentration gradient...',
      retrievalCards: [
        {
          id: 'card-1',
          conceptId: 'c-mitochondria',
          question: 'What drives ATP synthase?',
          answer: 'Proton gradient across inner mitochondrial membrane.',
          retrievability: 45, // low retrievability
          stability: 1,
          difficulty: 7,
          reps: 1,
          lapses: 3,
          lastReviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ]
    }
  ]);

  const session2: StudySession = createMockSession('deck-biochem-2', 'Biochemistry 101', [
    {
      id: 'c-oxidative-phos',
      title: 'Oxidative Phosphorylation',
      mentalModel: 'Electron transport chain powering energetic synthesis',
      coreTakeaways: ['Electrons flow through complexes to generate proton gradient', 'ATP Synthase converts mechanical torque into chemical bonds'],
      keyTerms: [
        { term: 'Proton Gradient', definition: 'Transmembrane electrochemical potential' },
        { term: 'Complex IV', definition: 'Terminal electron acceptor complex' }
      ],
      feynmanPrompt: 'Trace electron passage to ATP creation.',
      order: 1,
      estimatedMinutes: 10,
      sampleMasteryExplanation: 'Electron flow through Complexes I to IV drives protons...',
      retrievalCards: [
        {
          id: 'card-2',
          conceptId: 'c-oxidative-phos',
          question: 'What connects electron transport to ATP?',
          answer: 'Proton gradient.',
          retrievability: 95,
          stability: 20,
          difficulty: 3,
          reps: 4,
          lapses: 0,
        }
      ]
    }
  ]);

  it('builds indexed knowledge graph across sessions', () => {
    const graph = KnowledgeGraphService.buildGraph([session1, session2]);
    expect(graph.length).toBe(2);
    expect(graph[0].title).toBe('Mitochondrial ATP Synthesis');
    expect(graph[1].title).toBe('Oxidative Phosphorylation');
    expect(graph[0].masteryLevel).toBe('novice'); // due to lapses=3, R=45
    expect(graph[1].masteryLevel).toBe('mastered');
  });

  it('finds semantic cross-deck bridges connecting related concepts across distinct decks', () => {
    const currentConcept = session2.concepts[0]; // Oxidative Phosphorylation in deck-biochem-2
    const bridges = KnowledgeGraphService.findCrossDeckBridges(
      currentConcept,
      'deck-biochem-2',
      3,
      [session1, session2]
    );

    expect(bridges.length).toBeGreaterThan(0);
    const bridge = bridges[0];
    expect(bridge.targetDeckId).toBe('deck-bio-1');
    expect(bridge.targetConceptTitle).toBe('Mitochondrial ATP Synthesis');
    expect(bridge.sharedTerms.some(t => t.toLowerCase().includes('proton'))).toBe(true);
  });

  it('detects prerequisite vulnerabilities when linked concept has degraded retention', () => {
    const currentConcept = session2.concepts[0];
    const vulnerabilities = KnowledgeGraphService.detectPrerequisiteVulnerabilities(
      currentConcept,
      'deck-biochem-2',
      [session1, session2]
    );

    expect(vulnerabilities.length).toBe(1);
    expect(vulnerabilities[0].retrievabilityScore).toBeLessThan(70);
    expect(vulnerabilities[0].relationshipType).toBe('prerequisite');
  });
});
