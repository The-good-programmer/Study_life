import type { ConceptCheckpoint, CrossDeckBridge, StudySession } from '../types';
import { StorageService } from './storageService';
import { FSRSService } from './fsrsService';

export interface IndexedConceptNode {
  conceptId: string;
  deckId: string;
  deckTitle: string;
  title: string;
  mentalModel: string;
  coreTakeaways: string[];
  keyTerms: string[];
  retrievability: number;
  lapseCount: number;
  masteryLevel: 'novice' | 'developing' | 'mastered';
}

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'for', 'to', 'with',
  'that', 'this', 'by', 'from', 'as', 'it', 'are', 'was', 'be', 'into', 'how', 'what', 'why'
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export class KnowledgeGraphService {
  /**
   * Builds an indexed snapshot of all concepts across all saved user decks
   */
  public static buildGraph(sessions?: StudySession[]): IndexedConceptNode[] {
    const deckList = sessions ?? StorageService.getSessions();
    const nodes: IndexedConceptNode[] = [];

    deckList.forEach(session => {
      const deckId = session.id;
      const deckTitle = session.title || 'Untitled Deck';

      session.concepts?.forEach(concept => {
        const pedState = FSRSService.getConceptPedagogicalState(concept.retrievalCards || []);
        let masteryLevel: 'novice' | 'developing' | 'mastered' = 'developing';
        if (pedState.retrievability >= 88 && pedState.lapseCount === 0) {
          masteryLevel = 'mastered';
        } else if (pedState.retrievability < 65 || pedState.lapseCount >= 2) {
          masteryLevel = 'novice';
        }

        nodes.push({
          conceptId: concept.id,
          deckId,
          deckTitle,
          title: concept.title,
          mentalModel: concept.mentalModel || '',
          coreTakeaways: concept.coreTakeaways || [],
          keyTerms: (concept.keyTerms || []).map(k => k.term),
          retrievability: pedState.retrievability,
          lapseCount: pedState.lapseCount,
          masteryLevel,
        });
      });
    });

    return nodes;
  }

  /**
   * Finds semantic and causal cross-deck bridges connecting the target concept to concepts in OTHER decks
   */
  public static findCrossDeckBridges(
    concept: ConceptCheckpoint,
    currentSessionId: string,
    limit: number = 3,
    sessions?: StudySession[]
  ): CrossDeckBridge[] {
    const graph = this.buildGraph(sessions);
    const candidateNodes = graph.filter(n => n.deckId !== currentSessionId && n.conceptId !== concept.id);
    if (candidateNodes.length === 0) return [];

    const currentKeyTerms = new Set((concept.keyTerms || []).map(k => k.term.toLowerCase().trim()));
    const currentConceptText = `${concept.title} ${concept.mentalModel} ${concept.coreTakeaways.join(' ')}`;
    const currentTokens = tokenize(currentConceptText);

    const scoredBridges: { bridge: CrossDeckBridge; score: number }[] = [];

    candidateNodes.forEach(target => {
      // 1. Term overlap
      const sharedTerms: string[] = [];
      target.keyTerms.forEach(t => {
        const lower = t.toLowerCase().trim();
        if (currentKeyTerms.has(lower) || currentTokens.has(lower)) {
          sharedTerms.push(t);
        }
      });

      // 2. Token Jaccard similarity across descriptions
      const targetText = `${target.title} ${target.mentalModel} ${target.coreTakeaways.join(' ')}`;
      const targetTokens = tokenize(targetText);
      const jaccard = calculateJaccardSimilarity(currentTokens, targetTokens);

      const totalScore = (sharedTerms.length * 3.0) + (jaccard * 10.0);

      if (totalScore >= 1.2 || sharedTerms.length >= 1) {
        let relationshipType: 'prerequisite' | 'analogous' | 'contrast' = 'analogous';
        if (target.retrievability < 70 || target.lapseCount >= 2) {
          relationshipType = 'prerequisite';
        } else if (jaccard > 0.25) {
          relationshipType = 'analogous';
        } else {
          relationshipType = 'contrast';
        }

        scoredBridges.push({
          score: totalScore,
          bridge: {
            sourceConceptId: concept.id,
            targetDeckId: target.deckId,
            targetDeckTitle: target.deckTitle,
            targetConceptId: target.conceptId,
            targetConceptTitle: target.title,
            relationshipType,
            sharedTerms: Array.from(new Set(sharedTerms)),
            retrievabilityScore: target.retrievability,
          },
        });
      }
    });

    return scoredBridges
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.bridge);
  }

  /**
   * Detects whether the current concept depends on cross-deck concepts with degraded memory retention
   */
  public static detectPrerequisiteVulnerabilities(
    concept: ConceptCheckpoint,
    currentSessionId: string,
    sessions?: StudySession[]
  ): CrossDeckBridge[] {
    const bridges = this.findCrossDeckBridges(concept, currentSessionId, 5, sessions);
    return bridges.filter(b => b.relationshipType === 'prerequisite' || b.retrievabilityScore < 70);
  }
}
