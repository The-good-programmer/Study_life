/**
 * Studify Deterministic Structured Output Schemas (Client & Server)
 * Enforces grammar-level decoding constraints so Gemini produces 100% valid JSON.
 */

import { Type } from '@google/genai';

export const FEYNMAN_EVALUATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: 'Objective score from 0 to 100 based strictly on the calibrated rubric.',
    },
    grade: {
      type: Type.STRING,
      enum: ['Novice', 'Developing', 'Solid Understanding', 'Complete Mastery'],
      description: 'Qualitative rating of student conceptual mastery.',
    },
    reasoningTrace: {
      type: Type.STRING,
      description: 'Private chain-of-thought analysis comparing student response to core takeaways and identifying gaps.',
    },
    masteredPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific concepts, cause-and-effect mechanisms, or principles the student articulated correctly.',
    },
    missingNuances: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Crucial causal links, mechanisms, or boundary conditions the student missed or stated incorrectly.',
    },
    jargonDetected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Textbook buzzwords or technical terms used without demonstrating understanding of their physical mechanism.',
    },
    actionableFeedback: {
      type: Type.STRING,
      description: 'Direct, constructive, Socratic coaching advice explaining how to bridge the gap to full mastery.',
    },
    diagramAnalysis: {
      type: Type.OBJECT,
      description: 'Multimodal evaluation of the student visual whiteboard sketch, if provided.',
      properties: {
        visualStrengths: { type: Type.STRING },
        visualFlawsOrGaps: { type: Type.STRING },
        alignmentScore: { type: Type.INTEGER },
      },
    },
  },
  required: ['score', 'grade', 'reasoningTrace', 'masteredPoints', 'missingNuances', 'jargonDetected', 'actionableFeedback'],
};

export const VIVA_VOCE_TURN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isComplete: {
      type: Type.BOOLEAN,
      description: 'True if examination round 3 is concluded and verdict is delivered.',
    },
    examinerText: {
      type: Type.STRING,
      description: 'The verbal Socratic challenge or verdict statement from the examiner.',
    },
    turnType: {
      type: Type.STRING,
      enum: ['mechanism-probe', 'counter-example', 'analogy-probe', 'verdict'],
    },
    reaction: {
      type: Type.STRING,
      enum: ['satisfied', 'skeptical', 'probing', 'impressed'],
    },
    reactionNote: {
      type: Type.STRING,
      description: 'A 1-sentence analytical assessment of the candidate’s latest defense turn.',
    },
    jargonDetected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    verdict: {
      type: Type.OBJECT,
      properties: {
        overallGrade: {
          type: Type.STRING,
          enum: ['Summa Cum Laude', 'Pass with Distinction', 'Sound Defense', 'Conditional Pass', 'Incomplete Defense'],
        },
        depthScore: { type: Type.INTEGER },
        analogyIntegrity: { type: Type.INTEGER },
        jargonFreeScore: { type: Type.INTEGER },
        roundsCompleted: { type: Type.INTEGER },
        verdictSummary: { type: Type.STRING },
        keyStrengths: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        vulnerableBlindspots: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  },
  required: ['isComplete', 'examinerText', 'turnType', 'reaction', 'reactionNote', 'jargonDetected'],
};

export const LEECH_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cardId: { type: Type.STRING },
    rootCause: {
      type: Type.STRING,
      enum: ['interference', 'abstract-disconnect', 'overloaded-card', 'arbitrary-ordering'],
    },
    diagnosisTitle: { type: Type.STRING },
    diagnosticExplanation: { type: Type.STRING },
    confusionSuspects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    rewiringOptions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          strategy: {
            type: Type.STRING,
            enum: ['sensory-story', 'acronym-rhyme', 'atomic-split', 'etymology-anchor'],
          },
          strategyTitle: { type: Type.STRING },
          badge: { type: Type.STRING },
          mnemonicText: { type: Type.STRING },
          visualImagery: { type: Type.STRING },
          recommendedAction: { type: Type.STRING },
          atomicCards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                clozeTemplate: { type: Type.STRING },
              },
              required: ['question', 'answer', 'clozeTemplate'],
            },
          },
        },
        required: ['id', 'strategy', 'strategyTitle', 'badge', 'mnemonicText', 'visualImagery', 'recommendedAction'],
      },
    },
  },
  required: ['cardId', 'rootCause', 'diagnosisTitle', 'diagnosticExplanation', 'confusionSuspects', 'rewiringOptions'],
};

export const STUDY_SESSION_GENERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    category: { type: Type.STRING },
    description: { type: Type.STRING },
    concepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          estimatedMinutes: { type: Type.INTEGER },
          mentalModel: { type: Type.STRING },
          coreTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          keyTerms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
              },
              required: ['term', 'definition'],
            },
          },
          feynmanPrompt: { type: Type.STRING },
          sampleMasteryExplanation: { type: Type.STRING },
          sourceAnchor: {
            type: Type.OBJECT,
            properties: {
              pageNumber: { type: Type.INTEGER },
              snippet: { type: Type.STRING },
              sourceName: { type: Type.STRING },
              relevanceReason: { type: Type.STRING },
            },
          },
          retrievalCards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cardType: {
                  type: Type.STRING,
                  enum: ['standard', 'cloze', 'multiple-choice'],
                },
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                hint: { type: Type.STRING },
                explanation: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                clozeTemplate: { type: Type.STRING },
                sourceAnchor: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    snippet: { type: Type.STRING },
                    sourceName: { type: Type.STRING },
                    relevanceReason: { type: Type.STRING },
                  },
                },
                socraticHintLadder: {
                  type: Type.OBJECT,
                  properties: {
                    level1Prompt: { type: Type.STRING },
                    level2Analogy: { type: Type.STRING },
                    level3Deconstruction: { type: Type.STRING },
                  },
                  required: ['level1Prompt', 'level2Analogy', 'level3Deconstruction'],
                },
                diagnosticDistractors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      optionText: { type: Type.STRING },
                      trapType: {
                        type: Type.STRING,
                        enum: ['inversion', 'semantic-twin', 'naive-intuition', 'partial-truth'],
                      },
                      trapTitle: { type: Type.STRING },
                      trapExplanation: { type: Type.STRING },
                    },
                    required: ['optionText', 'trapType', 'trapTitle', 'trapExplanation'],
                  },
                },
              },
              required: ['cardType', 'question', 'answer', 'hint', 'explanation'],
            },
          },
        },
        required: ['title', 'estimatedMinutes', 'mentalModel', 'coreTakeaways', 'keyTerms', 'feynmanPrompt', 'sampleMasteryExplanation', 'retrievalCards'],
      },
    },
  },
  required: ['title', 'category', 'description', 'concepts'],
};
