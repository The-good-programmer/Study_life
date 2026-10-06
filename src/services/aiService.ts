import { GoogleGenAI } from '@google/genai';
import type { 
  ConceptCheckpoint, 
  FeynmanEvaluation, 
  RetrievalCard, 
  StudySession, 
  SocraticTurn, 
  VivaDefenseVerdict, 
  LeechAnalysis, 
  LeechRootCause, 
  DepthTier, 
  AcademicGradeLevel, 
  StudentEducationProfile,
  DiagnosticDistractor,
  SocraticHintLadder,
  ConceptPedagogicalState
} from '../types';
import { StorageService } from './storageService';
import { FSRSService } from './fsrsService';
import { KnowledgeGraphService } from './knowledgeGraphService';
import { DepthEstimationService, SUPPORTED_LANGUAGES } from './depthEstimationService';
import { ApiConfig } from './apiConfig';
import { FEYNMAN_EVALUATION_SCHEMA, VIVA_VOCE_TURN_SCHEMA, LEECH_ANALYSIS_SCHEMA, STUDY_SESSION_GENERATION_SCHEMA } from './aiSchemas';

export interface VivaVoceTurnResponse {
  nextTurn: SocraticTurn;
  verdict?: VivaDefenseVerdict;
  isComplete: boolean;
}

export class AIService {
  /**
   * Checks whether AI generation is available (via backend proxy or user-configured Gemini API key)
   */
  public static isAvailable(): boolean {
    return Boolean(StorageService.getApiKey()) || ApiConfig.isServerReachableSync();
  }

  private static getClient(customKey?: string): GoogleGenAI | null {
    // Strictly rely on user-configured key in browser storage, never bake keys into client bundle
    const key = customKey || StorageService.getApiKey();
    if (!key) return null;
    try {
      return new GoogleGenAI({ apiKey: key });
    } catch (err) {
      console.error('Failed to initialize GoogleGenAI client:', err);
      return null;
    }
  }

  /**
   * Unified generation entry point:
   * 1. Attempts backend server proxy (/api/ai/generate) if server is reachable.
   * 2. Otherwise falls back to client-side GoogleGenAI client (if user entered API key).
   * 3. Throws if neither is available so calling functions can execute their cognitive heuristics.
   */
  public static async generateText(
    contents: string | any,
    responseMimeType?: string,
    enableThinking: boolean = false,
    responseSchema?: Record<string, unknown>
  ): Promise<string> {
    // 1. Try server proxy if server is reachable
    try {
      const isServerUp = await ApiConfig.isServerReachable();
      if (isServerUp) {
        const res = await ApiConfig.request<{ text: string }>('/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ contents, responseMimeType, enableThinking, responseSchema }),
        });
        if (res.ok && res.data?.text) {
          return res.data.text;
        }
      }
    } catch (err) {
      console.warn('[AIService] Backend AI proxy request failed, checking client key...', err);
    }

    // 2. Try client-side API key with candidate models
    const client = this.getClient();
    if (client) {
      const response = await this.generateContentWithFallback(client, contents, responseMimeType, enableThinking, responseSchema);
      return response.text || '';
    }

    throw new Error('No AI provider available (server offline and no client API key configured).');
  }

  private static readonly MODEL_CANDIDATES = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
  ];

  /**
   * Checks if a given model code supports reasoning/thinking configurations.
   * Gemini 2.5 and Gemini 3 models support thinkingConfig; earlier models
   * like Gemini 2.0 or Gemini 1.5 reject requests with thinkingConfig.
   */
  public static supportsThinking(model: string): boolean {
    return model.includes('2.5') || model.includes('3.');
  }

  private static async generateContentWithFallback(
    ai: GoogleGenAI,
    contents: string | any,
    responseMimeType?: string,
    enableThinking: boolean = false,
    responseSchema?: Record<string, unknown>
  ) {
    let lastError: unknown = null;
    for (const model of this.MODEL_CANDIDATES) {
      const buildConfig = (includeThinking: boolean) => {
        const config: Record<string, unknown> = {};
        if (responseSchema) {
          config.responseSchema = responseSchema;
          config.responseMimeType = 'application/json';
        } else if (responseMimeType) {
          config.responseMimeType = responseMimeType;
        }
        if (includeThinking && this.supportsThinking(model)) {
          if (model.includes('3.')) {
            config.thinkingConfig = { thinkingLevel: 'LOW' };
          } else if (model.includes('2.5')) {
            config.thinkingConfig = { thinkingBudget: 1024 };
          }
        }
        return config;
      };

      try {
        const config = buildConfig(enableThinking);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: Object.keys(config).length > 0 ? (config as any) : undefined,
        });
        return response;
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);

        // If failure was caused by thinkingConfig rejection on this model,
        // retry the same model immediately without thinkingConfig
        if (enableThinking && (errMsg.includes('thinking') || errMsg.includes('INVALID_ARGUMENT'))) {
          try {
            console.warn(`[Lotti AI] Model ${model} failed with thinkingConfig, retrying without thinking...`, err);
            const fallbackConfig = buildConfig(false);
            const response = await ai.models.generateContent({
              model,
              contents,
              config: Object.keys(fallbackConfig).length > 0 ? (fallbackConfig as any) : undefined,
            });
            return response;
          } catch (retryErr) {
            lastError = retryErr;
          }
        }

        console.warn(`[Lotti AI] Model ${model} failed, trying next candidate...`, err);
      }
    }
    throw lastError;
  }

  public static safeParseJSON<T = Record<string, unknown>>(rawText: string, fallback: T): T {
    if (!rawText || !rawText.trim()) return fallback;
    const trimmed = rawText.trim();
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      const cleaned = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        const start = cleaned.search(/[{[]/);
        const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(cleaned.slice(start, end + 1)) as T;
          } catch {
            return fallback;
          }
        }
        return fallback;
      }
    }
  }

  /**
   * Evaluates student's Feynman explanation using Gemini or intelligent cognitive heuristic fallback.
   * Supports multimodal inspection of whiteboard sketches and adapts to student cognitive memory.
   */
  public static async evaluateFeynmanExplanation(
    concept: ConceptCheckpoint,
    userExplanation: string,
    diagramDataUrl?: string,
    currentSessionId?: string
  ): Promise<FeynmanEvaluation> {
    const cleanExplanation = userExplanation.trim();
    const pedState = FSRSService.getConceptPedagogicalState(concept.retrievalCards || []);
    const crossBridges = currentSessionId
      ? KnowledgeGraphService.findCrossDeckBridges(concept, currentSessionId, 2)
      : [];

    if (cleanExplanation.length < 25) {
      return {
        score: 30,
        grade: 'Novice',
        masteredPoints: ['You made an initial attempt.'],
        missingNuances: ['Your explanation is too brief. Try to explain the mechanism step-by-step.', ...concept.coreTakeaways.slice(0, 2)],
        jargonDetected: [],
        actionableFeedback: 'Elaborative encoding requires writing out the cause-and-effect relationship. How does A lead to B?'
      };
    }

    if (this.isAvailable() || this.getClient()) {
      try {
        const memoryProfile = StorageService.getCognitiveMemoryProfile();
        const profileContext = memoryProfile.totalCards > 0
          ? `
LONGITUDINAL STUDENT COGNITIVE PROFILE:
- Known Vulnerability Traps: ${memoryProfile.vulnerableTrapTypes.length > 0 ? memoryProfile.vulnerableTrapTypes.join(', ') : 'None'}
- Frequent Cognitive Bottlenecks: ${memoryProfile.frequentLapseConcepts.length > 0 ? memoryProfile.frequentLapseConcepts.slice(0, 3).join(', ') : 'None'}
- Overall Mastery Ratio: ${memoryProfile.masteredCards} / ${memoryProfile.totalCards} cards stable
`
          : '';

        const hasDiagram = Boolean(diagramDataUrl && diagramDataUrl.trim().length > 50);

        const prompt = `
You are a cognitive psychology tutor evaluating a student's explanation using the Feynman Technique.
Target Concept: "${concept.title}"
Mental Model: "${concept.mentalModel}"
Core Takeaways to cover: ${JSON.stringify(concept.coreTakeaways)}
Key Terms: ${JSON.stringify(concept.keyTerms.map(k => k.term))}
Challenge Prompt: "${concept.feynmanPrompt}"
${profileContext}

ADAPTIVE SOCRATIC PEDAGOGY (FSRS-5):
- Target Concept Retrievability: ${pedState.retrievability}% (${pedState.mode.toUpperCase()})
- Examiner Directive: ${pedState.guidanceDirective}
${crossBridges.length > 0 ? `
CROSS-DECK KNOWLEDGE BRIDGES:
The student has related concepts in their other decks:
${crossBridges.map(b => `- "${b.targetConceptTitle}" in deck "${b.targetDeckTitle}" (${b.relationshipType}, Shared Terms: ${b.sharedTerms.join(', ')})`).join('\n')}
` : ''}

Student's Explanation:
"""${cleanExplanation}"""

${hasDiagram ? `
MULTIMODAL DUAL-CODING DIAGRAM INSPECTION:
The student also drew an accompanying visual schematic on their dual-coding whiteboard (image payload attached).
Inspect the student's visual sketch carefully:
- Check for accurate spatial layout, labeled entities, and arrow directionality.
- Populate "diagramAnalysis":
  * "visualStrengths": Key elements, relationships, or flows the student drew accurately.
  * "visualFlawsOrGaps": Missing arrows, reversed cause-and-effect vectors, or spatial misconceptions.
  * "alignmentScore": 0-100 objective score evaluating diagram alignment with the scientific concept.
` : ''}

CALIBRATED SCORING RUBRIC & ANCHOR BENCHMARKS:
- 0-45% (Novice / Pure Jargon): Student mentions buzzwords or textbook definitions without articulating cause-and-effect. Uses circular definitions or commits major factual errors.
- 46-75% (Developing / Partial Understanding): Identifies core entities and partial facts, but misses the underlying causal mechanism, driving force, or key boundary conditions.
- 76-90% (Solid Understanding): Clear cause-and-effect chain. Explains how A leads to B, uses minimal jargon crutches, and demonstrates genuine mechanical intuition.
- 91-100% (Complete Mastery): Lucid, intuitive explanation of the governing mechanism with an accessible mental model or analogy, perfectly explaining why the phenomenon occurs without ungrounded jargon.

CHAIN-OF-THOUGHT INSTRUCTION:
Before assigning the final score, you MUST articulate your step-by-step cognitive analysis in "reasoningTrace", explicitly evaluating the presence of causal mechanisms versus ungrounded jargon${hasDiagram ? ' and integrating your inspection of their visual diagram' : ''}.
`;

        let contentsPayload: any = prompt;
        if (hasDiagram && diagramDataUrl) {
          const base64Data = diagramDataUrl.includes(',') ? diagramDataUrl.split(',')[1] : diagramDataUrl;
          contentsPayload = [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Data,
                  },
                },
              ],
            },
          ];
        }

        const text = await this.generateText(contentsPayload, 'application/json', true, FEYNMAN_EVALUATION_SCHEMA);
        const parsed = this.safeParseJSON<Partial<FeynmanEvaluation>>(text, {});
        return {
          score: Math.min(100, Math.max(0, parsed.score || 75)),
          grade: parsed.grade || 'Solid Understanding',
          masteredPoints: parsed.masteredPoints || ['Captured the core high-level idea.'],
          missingNuances: parsed.missingNuances || ['Consider expanding on the underlying mechanism.'],
          jargonDetected: parsed.jargonDetected || [],
          actionableFeedback: parsed.actionableFeedback || 'Great active recall attempt! Solidifying the nuances will lock this into long-term memory.',
          diagramAnalysis: parsed.diagramAnalysis,
        };
      } catch (err) {
        console.warn('Gemini API call failed, falling back to cognitive heuristic analysis:', err);
      }
    }

    // High quality cognitive fallback when API key is not present or offline
    return this.heuristicFeynmanEvaluation(concept, cleanExplanation, pedState);
  }

  /**
   * Socratic interactive coach follow-up after Feynman evaluation
   */
  public static async askSocraticFollowUp(
    concept: ConceptCheckpoint,
    userExplanation: string,
    studentQuestion: string
  ): Promise<string> {
    const cleanQ = studentQuestion.trim();
    if (!cleanQ) return 'Please ask a specific clarifying question regarding this concept.';

    if (this.isAvailable() || this.getClient()) {
      try {
        const prompt = `
You are a warm, concise Socratic science tutor helping a student deeply understand "${concept.title}".
Context / Mental Model: "${concept.mentalModel}"
Core Takeaways: ${JSON.stringify(concept.coreTakeaways)}
Student's initial explanation: "${userExplanation}"
Student's question: "${cleanQ}"

Answer the student in 2 to 3 concise, illuminating sentences. Use an intuitive analogy where helpful. Directly illuminate the underlying mechanism.
`;
        const text = await this.generateText(prompt);

        if (text?.trim()) {
          return text.trim();
        }
      } catch (err) {
        console.warn('AI follow-up failed, using heuristic guidance:', err);
      }
    }

    // Heuristic response
    const matchedTerm = concept.keyTerms.find(k => cleanQ.toLowerCase().includes(k.term.toLowerCase()));
    if (matchedTerm) {
      return `Regarding ${matchedTerm.term}: recall that ${matchedTerm.definition}. In the context of ${concept.title}, it functions as the central link connecting the input mechanism to the final outcome.`;
    }
    return `In ${concept.title}, the key to your question lies in "${concept.coreTakeaways[0] || concept.mentalModel}". When you trace how the components interact step-by-step, you see why this mechanism is required.`;
  }

  /**
   * Conducts a multi-turn Socratic Oral Viva Voce defense
   */
  public static async conductVivaVoceTurn(
    concept: ConceptCheckpoint,
    history: SocraticTurn[],
    studentResponse: string,
    targetRound: number,
    currentSessionId?: string
  ): Promise<VivaVoceTurnResponse> {
    const cleanResponse = studentResponse.trim();
    const pedState = FSRSService.getConceptPedagogicalState(concept.retrievalCards || []);
    const crossBridges = currentSessionId
      ? KnowledgeGraphService.findCrossDeckBridges(concept, currentSessionId, 2)
      : [];

    if (this.isAvailable() || this.getClient()) {
      try {
        const isFinalRound = targetRound >= 3;
        const memoryProfile = StorageService.getCognitiveMemoryProfile();
        const profileContext = memoryProfile.totalCards > 0
          ? `
LONGITUDINAL STUDENT COGNITIVE PROFILE:
- Known Vulnerability Traps: ${memoryProfile.vulnerableTrapTypes.length > 0 ? memoryProfile.vulnerableTrapTypes.join(', ') : 'None'}
- Frequent Concept Bottlenecks: ${memoryProfile.frequentLapseConcepts.length > 0 ? memoryProfile.frequentLapseConcepts.slice(0, 3).join(', ') : 'None'}
`
          : '';

        const prompt = `
You are an esteemed, intellectually demanding yet constructive Socratic Examiner presiding over an oral viva voce examination on "${concept.title}".
Context / Mental Model: "${concept.mentalModel}"
Core Takeaways to master: ${JSON.stringify(concept.coreTakeaways)}
Key Technical Terms: ${JSON.stringify(concept.keyTerms.map(k => k.term))}
${profileContext}

ADAPTIVE SOCRATIC PEDAGOGY (FSRS-5):
- Candidate Retrievability: ${pedState.retrievability}% (${pedState.mode.toUpperCase()})
- Examiner Directive: ${pedState.guidanceDirective}
${crossBridges.length > 0 ? `
CROSS-DECK KNOWLEDGE BRIDGES:
The candidate previously studied related concepts in other decks:
${crossBridges.map(b => `- "${b.targetConceptTitle}" in deck "${b.targetDeckTitle}" (${b.relationshipType}, Shared Terms: ${b.sharedTerms.join(', ')})`).join('\n')}
If relevant, challenge or acknowledge connections to these prerequisite/analogous domains.
` : ''}

Current Examination Round: ${targetRound} of 3.
Full Transcript so far:
${JSON.stringify(history.map(h => ({ role: h.role, text: h.text })))}

Candidate's Latest Statement:
"""${cleanResponse}"""

Instructions:
${!isFinalRound ? `
1. Evaluate the candidate's latest response. Check if they used textbook buzzwords without unpacking them, if their reasoning has circular logic, or if they articulated cause-and-effect well.
2. Formulate your next verbal Socratic challenge (2 to 3 sentences) in line with your pedagogical directive (${pedState.mode.toUpperCase()}).
   - If going into Round 2: Challenge the candidate on the exact physical/biological mechanism or boundary condition ("What would happen if X were missing?").
   - If going into Round 3: Request a real-world, intuitive physical analogy or ask why a counter-scenario cannot occur.
3. Select an examiner reaction: "satisfied" | "skeptical" | "probing" | "impressed".
4. Provide a 1-sentence reaction note (e.g., "Identified the proton gradient, but did not explain how rotational torque is generated.").
5. List any technical jargon words the candidate used without explaining their mechanism.

Return ONLY valid JSON matching this schema:
{
  "isComplete": false,
  "examinerText": string,
  "turnType": "mechanism-probe" | "counter-example" | "analogy-probe",
  "reaction": "satisfied" | "skeptical" | "probing" | "impressed",
  "reactionNote": string,
  "jargonDetected": string[]
}
` : `
This is Round 3 of 3 (Final Defense Round). Issue your official Viva Voce Defense Verdict.
Evaluate total conceptual depth (0-100), analogy integrity (0-100), and jargon-free lucidity (0-100).
Assign an overallGrade: "Summa Cum Laude" | "Pass with Distinction" | "Sound Defense" | "Conditional Pass" | "Incomplete Defense".
Provide 2 key strengths and 1-2 vulnerable blindspots.

Return ONLY valid JSON matching this schema:
{
  "isComplete": true,
  "examinerText": string,
  "turnType": "verdict",
  "reaction": "satisfied" | "skeptical" | "probing" | "impressed",
  "reactionNote": string,
  "jargonDetected": string[],
  "verdict": {
    "overallGrade": "Summa Cum Laude" | "Pass with Distinction" | "Sound Defense" | "Conditional Pass" | "Incomplete Defense",
    "depthScore": number,
    "analogyIntegrity": number,
    "jargonFreeScore": number,
    "roundsCompleted": 3,
    "verdictSummary": string,
    "keyStrengths": string[],
    "vulnerableBlindspots": string[]
  }
}
`}
`;

        const text = await this.generateText(prompt, 'application/json', true, VIVA_VOCE_TURN_SCHEMA);

        const parsed = this.safeParseJSON<Record<string, any>>(text || '', {});
        const nextTurn: SocraticTurn = {
          id: `turn-examiner-${Date.now()}`,
          role: 'examiner',
          text: parsed.examinerText || 'Please proceed with your explanation.',
          timestamp: Date.now(),
          turnType: parsed.turnType || (isFinalRound ? 'verdict' : 'mechanism-probe'),
          reaction: parsed.reaction || 'probing',
          reactionNote: parsed.reactionNote || 'Examining candidate reasoning.',
          jargonDetected: parsed.jargonDetected || [],
        };

        return {
          nextTurn,
          verdict: parsed.verdict,
          isComplete: !!parsed.isComplete || isFinalRound,
        };
      } catch (err) {
        console.warn('Gemini Viva Voce call failed, using heuristic examiner:', err);
      }
    }

    // Cognitive Heuristic Examiner Fallback
    return this.heuristicVivaVoceTurn(concept, cleanResponse, targetRound, pedState);
  }

  /**
   * Conducts a Socratic Oral Viva Voce defense turn with real-time SSE streaming.
   * Invokes onChunk as tokens stream from the model.
   */
  public static async streamVivaVoceTurn(
    concept: ConceptCheckpoint,
    history: SocraticTurn[],
    studentResponse: string,
    targetRound: number,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    currentSessionId?: string
  ): Promise<VivaVoceTurnResponse> {
    const cleanResponse = studentResponse.trim();
    const isFinalRound = targetRound >= 3;
    const pedState = FSRSService.getConceptPedagogicalState(concept.retrievalCards || []);
    const crossBridges = currentSessionId
      ? KnowledgeGraphService.findCrossDeckBridges(concept, currentSessionId, 2)
      : [];

    const memoryProfile = StorageService.getCognitiveMemoryProfile();
    const profileContext = memoryProfile.totalCards > 0
      ? `
LONGITUDINAL STUDENT COGNITIVE PROFILE:
- Known Vulnerability Traps: ${memoryProfile.vulnerableTrapTypes.length > 0 ? memoryProfile.vulnerableTrapTypes.join(', ') : 'None'}
- Frequent Concept Bottlenecks: ${memoryProfile.frequentLapseConcepts.length > 0 ? memoryProfile.frequentLapseConcepts.slice(0, 3).join(', ') : 'None'}
`
      : '';

    const streamPrompt = `
You are an esteemed, intellectually demanding yet constructive Socratic Examiner presiding over an oral viva voce examination on "${concept.title}".
Context / Mental Model: "${concept.mentalModel}"
Core Takeaways to master: ${JSON.stringify(concept.coreTakeaways)}
Key Technical Terms: ${JSON.stringify(concept.keyTerms.map(k => k.term))}
${profileContext}

ADAPTIVE SOCRATIC PEDAGOGY (FSRS-5):
- Candidate Retrievability: ${pedState.retrievability}% (${pedState.mode.toUpperCase()})
- Examiner Directive: ${pedState.guidanceDirective}
${crossBridges.length > 0 ? `
CROSS-DECK KNOWLEDGE BRIDGES:
The candidate previously studied related concepts in other decks:
${crossBridges.map(b => `- "${b.targetConceptTitle}" in deck "${b.targetDeckTitle}" (${b.relationshipType}, Shared Terms: ${b.sharedTerms.join(', ')})`).join('\n')}
If relevant, challenge or acknowledge connections to these prerequisite/analogous domains.
` : ''}

Current Examination Round: ${targetRound} of 3.
Full Transcript so far:
${JSON.stringify(history.map(h => ({ role: h.role, text: h.text })))}

Candidate's Latest Statement:
"""${cleanResponse}"""

${!isFinalRound ? `
Formulate your verbal Socratic response (2-3 concise sentences) directly addressing the candidate as an Oxford/MIT professor adhering to your pedagogical directive (${pedState.mode.toUpperCase()}). Challenge their causal mechanism, analogy, or boundary condition. Speak naturally with academic poise.
` : `
Deliver your official oral Viva Voce verdict to the candidate in 3 concise sentences. Declare whether their defense is approved, summarizing their greatest strength and their principal vulnerability.
`}
`;

    // 1. Try server SSE stream if server is reachable
    try {
      const isServerUp = await ApiConfig.isServerReachable();
      if (isServerUp) {
        let accumulated = '';
        const streamResult = await ApiConfig.streamRequest(
          '/ai/stream',
          { contents: streamPrompt, enableThinking: true },
          (chunk) => {
            accumulated += chunk;
            onChunk(chunk);
          },
          signal
        );

        if (streamResult.ok && accumulated.trim()) {
          const nextTurn: SocraticTurn = {
            id: `turn-examiner-${Date.now()}`,
            role: 'examiner',
            text: accumulated.trim(),
            timestamp: Date.now(),
            turnType: isFinalRound ? 'verdict' : 'mechanism-probe',
            reaction: isFinalRound ? 'satisfied' : 'probing',
            reactionNote: isFinalRound ? 'Oral defense concluded.' : 'Probing candidate mechanism.',
            jargonDetected: concept.keyTerms.filter(k => cleanResponse.toLowerCase().includes(k.term.toLowerCase())).map(k => k.term),
          };

          return {
            nextTurn,
            isComplete: isFinalRound,
          };
        }
      }
    } catch (err) {
      console.warn('[AIService] SSE stream request failed, falling back:', err);
    }

    // 2. Try client-side direct streaming if client API key is configured
    const client = this.getClient();
    if (client) {
      try {
        let accumulated = '';
        for (const model of this.MODEL_CANDIDATES) {
          try {
            const stream = await client.models.generateContentStream({
              model,
              contents: streamPrompt,
            });
            for await (const chunk of stream) {
              if (chunk.text) {
                accumulated += chunk.text;
                onChunk(chunk.text);
              }
            }
            if (accumulated.trim()) {
              const nextTurn: SocraticTurn = {
                id: `turn-examiner-${Date.now()}`,
                role: 'examiner',
                text: accumulated.trim(),
                timestamp: Date.now(),
                turnType: isFinalRound ? 'verdict' : 'mechanism-probe',
                reaction: isFinalRound ? 'satisfied' : 'probing',
                reactionNote: isFinalRound ? 'Oral defense concluded.' : 'Probing candidate mechanism.',
                jargonDetected: concept.keyTerms.filter(k => cleanResponse.toLowerCase().includes(k.term.toLowerCase())).map(k => k.term),
              };

              return {
                nextTurn,
                isComplete: isFinalRound,
              };
            }
          } catch {}
        }
      } catch (clientStreamErr) {
        console.warn('[AIService] Client SDK stream failed:', clientStreamErr);
      }
    }

    // 3. Fallback to standard/heuristic call with responsive typewriter chunking
    const fallbackRes = await this.conductVivaVoceTurn(concept, history, studentResponse, targetRound, currentSessionId);
    const words = fallbackRes.nextTurn.text.split(' ');
    for (let i = 0; i < words.length; i++) {
      onChunk((i > 0 ? ' ' : '') + words[i]);
      await new Promise(r => setTimeout(r, 22));
    }
    return fallbackRes;
  }

  private static heuristicVivaVoceTurn(
    concept: ConceptCheckpoint,
    cleanResponse: string,
    targetRound: number,
    pedState?: ConceptPedagogicalState
  ): VivaVoceTurnResponse {
    const lower = cleanResponse.toLowerCase();
    const words = cleanResponse.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Detect technical jargon used
    const detectedJargon = concept.keyTerms
      .filter(k => lower.includes(k.term.toLowerCase()))
      .map(k => k.term);

    const hasAnalogy = /like|as if|similar to|imagine|analogy|resembles|think of it as|water|car|factory|dam|pipe|gears/i.test(lower);
    const hasCausal = /because|leads to|causes|therefore|gradient|forces|triggers|results in|drives|transforms/i.test(lower);

    if (targetRound === 1) {
      const isShort = wordCount < 18;
      let examinerText = '';
      if (pedState?.mode === 'scaffolding') {
        examinerText = `I see your starting thought on "${concept.title}". Let us deconstruct the mechanism step-by-step: what is the fundamental starting condition or initial force that triggers the first transition? Trace what happens immediately next.`;
      } else if (pedState?.mode === 'adversarial') {
        examinerText = `Your opening premise on "${concept.title}" is noted, but an advanced defense demands stress-testing. Under what precise physical conditions or boundary constraints does this mechanism fail or reverse? Defend why alternative pathways do not occur.`;
      } else {
        examinerText = isShort
          ? `You have touched on the topic, but an oral viva requires causal rigor. Do not merely state that "${concept.title}" occurs. Trace the exact sequence: what physical trigger initiates the cascade, and how does component A affect component B?`
          : `Your opening defense captures the broad architecture of ${concept.title}. However, a scholar must explain the governing constraint: What prevents this mechanism from running in reverse, or what occurs if the primary gradient or energy supply is interrupted? Answer without using textbook buzzwords.`;
      }

      return {
        nextTurn: {
          id: `turn-examiner-${Date.now()}`,
          role: 'examiner',
          text: examinerText,
          timestamp: Date.now(),
          turnType: 'mechanism-probe',
          reaction: isShort ? 'skeptical' : (pedState?.mode === 'scaffolding' ? 'probing' : 'probing'),
          reactionNote: isShort ? 'Explanation too terse; probing for causal mechanism.' : 'Premise accepted; probing for boundary conditions.',
          jargonDetected: detectedJargon,
        },
        isComplete: false,
      };
    }

    if (targetRound === 2) {
      let examinerText = '';
      if (pedState?.mode === 'scaffolding') {
        examinerText = hasAnalogy
          ? `Your analogy is helpful. Now, can you connect this analogy directly back to the actual mechanism of ${concept.title}? What part of the analogy represents the primary driving force?`
          : `You are making steady progress on the mechanism. Now try to explain this using an everyday physical analogy—like water in a pipe or a simple machine—so the underlying logic becomes undeniable.`;
      } else if (pedState?.mode === 'adversarial') {
        examinerText = `A sharp defense. Now consider a deceptive counter-hypothesis: Suppose a critic asserts that ${concept.title} is an inefficient byproduct rather than an essential driver. What decisive experimental evidence or thermodynamic principle proves the critic wrong?`;
      } else {
        examinerText = hasAnalogy
          ? `I note your analogy. Now clarify the precision: At which specific boundary does your analogy fail to match the real physical behavior of ${concept.title}? What microscopic reality differs from your macroscopic picture?`
          : `Your mechanical reasoning is taking shape. Now for the true test of Feynman comprehension: Translate this entire mechanism into an everyday physical analogy (such as a watermill, airport baggage system, or musical orchestra) so a novice can grasp the intuitive dynamic.`;
      }

      return {
        nextTurn: {
          id: `turn-examiner-${Date.now()}`,
          role: 'examiner',
          text: examinerText,
          timestamp: Date.now(),
          turnType: hasAnalogy ? 'counter-example' : 'analogy-probe',
          reaction: hasCausal ? (hasAnalogy ? 'impressed' : 'probing') : 'skeptical',
          reactionNote: hasAnalogy ? 'Analogy detected; testing its limits.' : 'Requesting intuitive analogy to eliminate jargon crutches.',
          jargonDetected: detectedJargon,
        },
        isComplete: false,
      };
    }

    // Final Round (Round 3) - Verdict
    const depthScore = Math.min(98, Math.max(55, 60 + (hasCausal ? 20 : 0) + (wordCount > 35 ? 15 : 5)));
    const analogyScore = Math.min(100, Math.max(50, hasAnalogy ? 90 : 65));
    const jargonFreeScore = Math.min(100, Math.max(60, 95 - detectedJargon.length * 8));

    const avgScore = Math.round((depthScore * 0.45) + (analogyScore * 0.3) + (jargonFreeScore * 0.25));
    
    let grade: VivaDefenseVerdict['overallGrade'] = 'Sound Defense';
    if (avgScore >= 90) grade = 'Summa Cum Laude';
    else if (avgScore >= 82) grade = 'Pass with Distinction';
    else if (avgScore >= 70) grade = 'Sound Defense';
    else if (avgScore >= 60) grade = 'Conditional Pass';
    else grade = 'Incomplete Defense';

    const verdict: VivaDefenseVerdict = {
      overallGrade: grade,
      depthScore,
      analogyIntegrity: analogyScore,
      jargonFreeScore,
      roundsCompleted: 3,
      verdictSummary: `The candidate successfully defended ${concept.title} through 3 rigorous Socratic rounds, demonstrating ${avgScore >= 80 ? 'exemplary' : 'competent'} intuitive grasp.`,
      keyStrengths: [
        hasCausal ? 'Demonstrated causal cause-and-effect reasoning across transitions.' : 'Articulated core structural identity.',
        hasAnalogy ? 'Constructed functional intuitive analogy for non-specialists.' : 'Maintained conceptual consistency under interrogation.',
      ],
      vulnerableBlindspots: [
        detectedJargon.length > 0 ? `Relied on formal terms (${detectedJargon.slice(0, 2).join(', ')}) without full mechanical breakdown.` : 'Could further elaborate on microscopic rate-limiting constraints.',
      ],
    };

    const examinerText = `The Socratic Board has concluded its interrogation. Verdict awarded: ${grade} (${avgScore}% Depth). You have defended ${concept.title} with commendable clarity. Your active recall foundations are primed for testing.`;

    return {
      nextTurn: {
        id: `turn-examiner-${Date.now()}`,
        role: 'examiner',
        text: examinerText,
        timestamp: Date.now(),
        turnType: 'verdict',
        reaction: avgScore >= 80 ? 'impressed' : 'satisfied',
        reactionNote: `Oral defense passed with ${grade}.`,
        jargonDetected: detectedJargon,
      },
      verdict,
      isComplete: true,
    };
  }

  /**
   * Diagnoses root causes of chronic card lapses (Leech Hunter) and generates mnemonic cures
   */
  public static async diagnoseAndRewireLeech(
    card: RetrievalCard,
    concept?: ConceptCheckpoint
  ): Promise<LeechAnalysis> {
    if (this.isAvailable() || this.getClient()) {
      try {
        const prompt = `
You are a cognitive psychologist and expert mnemonist specializing in fixing memory bottlenecks in medical and board exam flashcards.
Target Flashcard with Chronic Forgetting:
Question: "${card.question}"
Answer: "${card.answer}"
Hint: "${card.hint || 'None'}"
Explanation: "${card.explanation || 'None'}"
Current Lapses: ${card.lapses}
Stability: ${card.stability} days
Difficulty: ${card.difficulty}/10
${concept ? `Concept Topic: "${concept.title}" - ${concept.mentalModel}` : ''}

Task:
1. Diagnose the exact cognitive reason this card fails. Classify rootCause as:
   - "interference" (confusing two similar concepts, like afferent vs efferent)
   - "abstract-disconnect" (pure arbitrary fact with no intuitive anchor)
   - "overloaded-card" (too much information crammed into one card)
   - "arbitrary-ordering" (memorizing an arbitrary sequence without logical links)
2. Provide a diagnosisTitle (e.g. "Phonetic & Directional Interference") and a concise diagnosticExplanation.
3. If applicable, identify confusionSuspects (e.g. ["Afferent Arteriole", "Efferent Arteriole"]).
4. Formulate 3 distinct rewiringOptions:
   - Option 1 (strategy: "sensory-story"): A visceral, bizarre, colorful visual scene or physical feeling.
   - Option 2 (strategy: "acronym-rhyme" or "etymology-anchor"): A catchy acronym, rhyming rule, or Latin/Greek root word deconstruction.
   - Option 3 (strategy: "atomic-split"): Split into 2 simpler, bite-sized cloze deletion cards following the Minimum Information Principle.

Return ONLY valid JSON matching this schema:
{
  "cardId": "${card.id}",
  "rootCause": "interference" | "abstract-disconnect" | "overloaded-card" | "arbitrary-ordering",
  "diagnosisTitle": string,
  "diagnosticExplanation": string,
  "confusionSuspects": string[],
  "rewiringOptions": [
    {
      "id": string,
      "strategy": "sensory-story" | "acronym-rhyme" | "atomic-split" | "etymology-anchor",
      "strategyTitle": string,
      "badge": string,
      "mnemonicText": string,
      "visualImagery": string,
      "recommendedAction": string,
      "atomicCards": [
        { "question": string, "answer": string, "clozeTemplate": string }
      ]
    }
  ]
}
`;

        const text = await this.generateText(prompt, 'application/json', true, LEECH_ANALYSIS_SCHEMA);

        const parsed = this.safeParseJSON<Record<string, any>>(text || '', {});
        if (parsed.rootCause && parsed.rewiringOptions?.length > 0) {
          return {
            cardId: card.id,
            rootCause: parsed.rootCause,
            diagnosisTitle: parsed.diagnosisTitle || 'Synaptic Retrieval Bottleneck',
            diagnosticExplanation: parsed.diagnosticExplanation || 'Card shows repeated retrieval failure due to cognitive interference.',
            confusionSuspects: parsed.confusionSuspects || [],
            rewiringOptions: parsed.rewiringOptions,
          };
        }
      } catch (err) {
        console.warn('Gemini Leech diagnosis failed, using cognitive heuristic rewiring:', err);
      }
    }

    // Cognitive Heuristic Fallback
    return this.heuristicLeechDiagnosis(card, concept);
  }

  private static heuristicLeechDiagnosis(
    card: RetrievalCard,
    concept?: ConceptCheckpoint
  ): LeechAnalysis {
    const qLower = card.question.toLowerCase();
    const aLower = card.answer.toLowerCase();

    const isInterference = /vs|difference|between|distinguish|contrast|compare|afferent|efferent|hypo|hyper|meiosis|mitosis/i.test(qLower + ' ' + aLower);
    const isOverloaded = card.question.length > 80 || card.answer.length > 70 || card.question.includes(' and ');

    const rootCause: LeechRootCause = isInterference
      ? 'interference'
      : isOverloaded
      ? 'overloaded-card'
      : 'abstract-disconnect';

    const cleanAnswer = card.answer.trim();

    return {
      cardId: card.id,
      rootCause,
      diagnosisTitle: isInterference 
        ? 'Phonetic & Conceptual Interference' 
        : isOverloaded 
        ? 'Overloaded Multi-Fact Card (Minimum Info Violation)' 
        : 'Abstract Semantic Disconnect',
      diagnosticExplanation: isInterference
        ? `The brain repeatedly conflates "${cleanAnswer}" with an opposing concept because both terms share similar context without a distinguishing anchor.`
        : isOverloaded
        ? 'This card attempts to test multiple separate facts simultaneously, overwhelming working memory during active retrieval.'
        : `"${cleanAnswer}" is being stored as an isolated arbitrary fact rather than grounded in an intuitive physical cause-and-effect model.`,
      confusionSuspects: isInterference ? [cleanAnswer, `Counterpart / Opposite of ${cleanAnswer}`] : undefined,
      rewiringOptions: [
        {
          id: 'opt-sensory',
          strategy: 'sensory-story',
          strategyTitle: 'Visceral Sensory Imagery',
          badge: 'Sensory Anchor',
          mnemonicText: `Link "${cleanAnswer}" to an exaggerated physical action: Picture the first letter as a giant neon object directly interacting with "${concept?.title || 'the mechanism'}".`,
          visualImagery: `Visualize a massive glowing letter "${cleanAnswer.charAt(0).toUpperCase()}" locking directly into the core framework of ${concept?.title || 'this concept'}, forming an unbreakable visual anchor.`,
          recommendedAction: 'Attach this vivid sensory imagery to the card hint.',
        },
        {
          id: 'opt-acronym',
          strategy: 'acronym-rhyme',
          strategyTitle: 'Phonetic Peg & Rhyme Rule',
          badge: 'Peg System',
          mnemonicText: `"${cleanAnswer.charAt(0).toUpperCase()}" stands for ${cleanAnswer.split(' ')[0]} — remember: "${cleanAnswer.charAt(0).toUpperCase()} always leads the way in ${concept?.title || 'this system'}!"`,
          visualImagery: `A stamped military dog-tag reading "${cleanAnswer.toUpperCase()}".`,
          recommendedAction: 'Embed this mnemonic peg into your card prompt.',
        },
        {
          id: 'opt-atomic',
          strategy: 'atomic-split',
          strategyTitle: 'Decompose into 2 Atomic Cloze Cards',
          badge: 'Minimum Information Principle',
          mnemonicText: 'Eliminate cognitive overload by splitting this single heavy card into two independent, lightning-fast cloze deletions.',
          visualImagery: 'Two separate surgical incisions isolating one single synaptic connection each.',
          recommendedAction: 'Replace this single card with 2 atomic micro-cards.',
          atomicCards: [
            {
              question: `In ${concept?.title || 'this mechanism'}, the primary component is {{${cleanAnswer}}}.`,
              answer: cleanAnswer,
              clozeTemplate: `In ${concept?.title || 'this mechanism'}, the primary component is {{${cleanAnswer}}}.`,
            },
            {
              question: `What is the specific function of ${cleanAnswer}? It {{${card.explanation?.slice(0, 50) || 'drives the core mechanism'}}}.`,
              answer: card.explanation?.slice(0, 50) || 'drives the core mechanism',
              clozeTemplate: `What is the specific function of ${cleanAnswer}? It {{${card.explanation?.slice(0, 50) || 'drives the core mechanism'}}}.`,
            }
          ],
        }
      ]
    };
  }

  /**
   * Generates a full science-backed Study Session with decomposed concept checkpoints,
   * dynamically calibrated to depth tier and localized to the target language.
   */
  public static async generateStudySession(
    input: string,
    isRawNotes: boolean = false,
    depthTier?: DepthTier,
    languageCode?: string,
    gradeLevel?: AcademicGradeLevel,
    studentProfile?: StudentEducationProfile
  ): Promise<StudySession> {
    const sessionId = `session-${Date.now()}`;

    const targetLang = languageCode
      ? (SUPPORTED_LANGUAGES.find(l => l.code === languageCode) || DepthEstimationService.detectLanguage(input))
      : DepthEstimationService.detectLanguage(input);

    const depthEstimate = DepthEstimationService.estimateConceptDepth(input, targetLang.code);
    const effectiveTier: DepthTier = depthTier || depthEstimate.tier;
    const effectiveGradeLevel: AcademicGradeLevel = gradeLevel || depthEstimate.gradeLevel;

    if (this.isAvailable() || this.getClient()) {
      try {
        const checkpointCountInstruction = isRawNotes
          ? '3 to 5 sequential bite-sized concept checkpoints'
          : effectiveTier === 'foundational'
          ? 'exactly 2 sequential bite-sized concept checkpoints (focusing on intuitive mental models, simple analogies, core vocabulary, and beginner intuition, approx 15-20 minutes total. Avoid excessive technical jargon)'
          : effectiveTier === 'deep-dive'
          ? '4 to 5 rigorous sequential concept checkpoints (covering advanced mechanical nuances, mathematical/theoretical formulations, boundary conditions, edge-case failure modes, and counter-intuitive paradoxes, approx 60-75 minutes total)'
          : '3 to 4 sequential concept checkpoints (focusing on cause-and-effect mechanisms, governing rules, and direct practical applications, approx 35-45 minutes total)';

        const profileInstruction = studentProfile
          ? `
CRITICAL STUDENT EDUCATIONAL CALIBRATION (AGE, COUNTRY & GRADE):
The student has provided their exact academic profile:
- Student Age: ${studentProfile.age} years old
- Country & Educational Curriculum: ${studentProfile.country}
- Grade / School Level: ${studentProfile.grade}

You MUST strictly calibrate your study plan, cognitive depth, vocabulary, explanation tone, and mental models to a ${studentProfile.age}-year-old student studying in "${studentProfile.grade}" under the ${studentProfile.country} educational curriculum!
- If the student is a child (e.g. elementary / primary school, ages 7-11, grades 1-5): You MUST use fun, everyday analogies (toys, superheroes, food, playground, nature). Use simple words, short engaging sentences, observable phenomena, and ZERO dense college textbook jargon. A ${studentProfile.age}-year-old in ${studentProfile.grade} cannot study with college-level vocabulary!
- If the student is in middle school (ages 11-14): Introduce foundational scientific/academic terms step-by-step with clear definitions and relatable real-world mechanisms.
- If the student is in high school (ages 14-18): Match the official ${studentProfile.country} secondary school / exam syllabus (e.g. GCSE/A-Levels in UK, High School in US, Lise in Turkey, Abitur in Germany), cause-and-effect relationships, governing formulas, and exam prep.
- If the student is in university / college: Provide rigorous theoretical nuance, advanced analytical frameworks, and discipline-specific literature depth.
`
          : `
CRITICAL GRADE & DIFFICULTY LEVEL CALIBRATION:
The user explicitly specified that this session must be adapted to: ${effectiveGradeLevel.toUpperCase()} level.
- If ELEMENTARY (e.g., 4th Grader Mode): You MUST use fun, everyday analogies (toys, superheroes, food, playground, nature). Use simple words, short engaging sentences, observable phenomena, and ZERO dense college textbook jargon. A 4th grader cannot study with college-level vocabulary!
- If MIDDLE SCHOOL (6th-8th Grade): Introduce foundational scientific/academic terms step-by-step with clear definitions and relatable real-world mechanisms.
- If HIGH SCHOOL (9th-12th Grade / 9th Grader Mode): Provide standard secondary school curriculum depth, cause-and-effect relationships, governing formulas, and standard academic definitions for exam prep.
- If COLLEGE / UNIVERSITY: Provide rigorous theoretical depth, quantitative formulations, biochemical/physical details, and deep mechanisms.
- If SPECIALIST: Deep-dive into edge cases, boundary conditions, failure modes, and counter-intuitive paradoxes.
`;

        const prompt = `
You are an expert learning scientist who decomposes complex study materials into a science-backed "Study Pilot" session.
Material Type: ${isRawNotes ? 'Raw Lecture Notes / Text Paste' : 'Study Topic'}
${studentProfile ? `Student: Age ${studentProfile.age}, Country: ${studentProfile.country}, Grade: ${studentProfile.grade}` : `Target Academic Grade & Difficulty: ${effectiveGradeLevel.toUpperCase()}`}
Target Checkpoint Depth Tier: ${effectiveTier.toUpperCase()}
Content:
"""${input}"""

${profileInstruction}

CRITICAL MULTILINGUAL INSTRUCTION:
The target study language is: ${targetLang.name} (${targetLang.nativeName} - Language Code: ${targetLang.code}).
You MUST generate the ENTIRE study session natively, naturally, and fluently in ${targetLang.name}.
All titles, descriptions, concept checkpoint titles, mental models, core takeaways, key terms, definitions, feynman prompts, sample mastery explanations, retrieval card questions, answers, hints, explanations, and multiple-choice options MUST be written in ${targetLang.name}.
Do NOT output in English unless the study material is explicitly about learning the English language.

Decompose this material into ${checkpointCountInstruction}.
For each concept:
1. Provide an intuitive mental model or visual analogy.
2. 3 core takeaways (mechanisms/facts).
3. 2-3 key terms with concise definitions.
4. A thought-provoking Feynman explanation challenge prompt ("Explain X to a 10yo / beginner without using jargon Y" in ${targetLang.name}).
5. A reference sample mastery explanation.
6. 3 active recall items engineered with Bloom's 2-Sigma Socratic scaffolding:
   - For EVERY card, provide a 3-tier progressive "socraticHintLadder":
     * "level1Prompt": A gentle Socratic question directing attention to the causal link without giving the answer away.
     * "level2Analogy": An intuitive real-world analogy (traffic, plumbing, kitchen, battery) illustrating the mechanism.
     * "level3Deconstruction": An atomic clue simplifying the target term.
   - Card 1: Standard conceptual question & answer.
   - Card 2: Cloze deletion card ("cardType": "cloze", "question": sentence with "{{target_concept}}", "answer": target word, "clozeTemplate": same sentence). You MUST wrap the target word in {{...}} in the question!
   - Card 3: Multiple choice card ("cardType": "multiple-choice", "question": diagnostic question, "options": [4 distinct plausible options WITHOUT letter prefixes like 'A)'], "answer": the exact matching correct option from options).
      * For Card 3, the 3 incorrect options in "options" MUST be engineered around real cognitive misconceptions and mapped in "diagnosticDistractors":
        - trapType: "inversion" | "semantic-twin" | "naive-intuition" | "partial-truth"
        - trapTitle: Short label (e.g. "Inversion Trap")
        - trapExplanation: A friendly 1-sentence breakdown of why a student's brain fell for that specific distractor and the true scientific dynamic.

7. SOURCE CITATION & GROUNDING:
   If the source text includes page markers (e.g. "--- Page X ---" or "[Page X]"), you MUST ground each concept and retrieval card with an exact "sourceAnchor":
   - "pageNumber": Exact integer page number where the concept or card fact is stated in the material.
   - "snippet": Verbatim 1-2 sentence quote snippet from that page verifying the ground truth.
   - "relevanceReason": Brief 1-sentence note explaining why this page anchors the concept.

Return ONLY a valid JSON object with this exact structure:
{
  "title": string,
  "category": string,
  "description": string,
  "concepts": [
    {
      "title": string,
      "estimatedMinutes": number,
      "mentalModel": string,
      "coreTakeaways": [string, string, string],
      "keyTerms": [{ "term": string, "definition": string }],
      "feynmanPrompt": string,
      "sampleMasteryExplanation": string,
      "sourceAnchor": {
        "pageNumber": number,
        "snippet": string,
        "relevanceReason": string
      },
      "retrievalCards": [
        {
          "cardType": "standard" | "cloze" | "multiple-choice",
          "question": string,
          "answer": string,
          "hint": string,
          "explanation": string,
          "options": string[],
          "clozeTemplate": string,
          "sourceAnchor": {
            "pageNumber": number,
            "snippet": string,
            "relevanceReason": string
          },
          "socraticHintLadder": {
            "level1Prompt": string,
            "level2Analogy": string,
            "level3Deconstruction": string
          },
          "diagnosticDistractors": [
            {
              "optionText": string,
              "trapType": "inversion" | "semantic-twin" | "naive-intuition" | "partial-truth",
              "trapTitle": string,
              "trapExplanation": string
            }
          ]
        }
      ]
    }
  ]
}
`;

        const text = await this.generateText(prompt, 'application/json', true, STUDY_SESSION_GENERATION_SCHEMA);
        const parsed = this.safeParseJSON<Record<string, any>>(text || '', {});

        const concepts: ConceptCheckpoint[] = (parsed.concepts || []).map((c: Partial<ConceptCheckpoint>, idx: number) => {
          const conceptId = `c-${sessionId}-${idx + 1}`;
          const cards: RetrievalCard[] = ((c.retrievalCards as unknown as Partial<RetrievalCard>[]) || []).map((rc, cIdx) => {
            let question = rc.question || 'What is the key takeaway?';
            let answer = rc.answer || 'Core concept answer';
            let clozeTemplate = rc.clozeTemplate;

            // Auto-mask cloze if missing {{}} and answer is inside question
            const isCloze = rc.cardType === 'cloze' || (cIdx === 1 && !rc.options?.length);
            if (isCloze && !question.includes('{{') && answer.trim().length > 2) {
              const escapedAnswer = answer.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\b${escapedAnswer}\\b`, 'i');
              if (regex.test(question)) {
                question = question.replace(regex, `{{${answer.trim()}}}`);
                clozeTemplate = question;
              }
            }

            const cardSourceAnchor = rc.sourceAnchor?.pageNumber ? {
              pageNumber: Number(rc.sourceAnchor.pageNumber),
              snippet: rc.sourceAnchor.snippet || '',
              sourceName: rc.sourceAnchor.sourceName,
              relevanceReason: rc.sourceAnchor.relevanceReason,
            } : undefined;

            return {
              id: `rc-${conceptId}-${cIdx + 1}`,
              conceptId: conceptId,
              cardType: rc.cardType || (clozeTemplate || (question && question.includes('{{')) ? 'cloze' : (rc.options && rc.options.length > 0 ? 'multiple-choice' : (cIdx === 1 ? 'cloze' : (cIdx === 2 ? 'multiple-choice' : 'standard')))),
              question,
              answer,
              hint: rc.hint || '',
              explanation: rc.explanation || '',
              options: rc.options,
              diagnosticDistractors: rc.diagnosticDistractors,
              socraticHintLadder: rc.socraticHintLadder,
              clozeTemplate: clozeTemplate || (question && question.includes('{{') ? question : undefined),
              sourceAnchor: cardSourceAnchor,
              stability: 1,
              difficulty: 5,
              reps: 0,
              lapses: 0,
            };
          });

          const conceptSourceAnchor = c.sourceAnchor?.pageNumber ? {
            pageNumber: Number(c.sourceAnchor.pageNumber),
            snippet: c.sourceAnchor.snippet || '',
            sourceName: c.sourceAnchor.sourceName,
            relevanceReason: c.sourceAnchor.relevanceReason,
          } : undefined;

          return {
            id: conceptId,
            order: idx + 1,
            title: c.title || `Concept ${idx + 1}`,
            estimatedMinutes: c.estimatedMinutes || 12,
            mentalModel: c.mentalModel || `An interconnected mental framework of ${c.title || input}.`,
            coreTakeaways: c.coreTakeaways || ['Essential rule 1', 'Essential rule 2'],
            keyTerms: c.keyTerms || [],
            feynmanPrompt: c.feynmanPrompt || 'Explain this concept simply without reading notes.',
            sampleMasteryExplanation: c.sampleMasteryExplanation || '',
            sourceAnchor: conceptSourceAnchor,
            retrievalCards: cards,
          };
        });

        return {
          id: sessionId,
          title: parsed.title || input.slice(0, 50),
          category: parsed.category || 'General Studies',
          description: parsed.description || `Science-backed study session on ${input}`,
          concepts,
          currentConceptIndex: 0,
          currentPhase: 'priming',
          elapsedSeconds: 0,
          createdAt: new Date().toISOString(),
          depthTier: effectiveTier,
          gradeLevel: effectiveGradeLevel,
          studentProfile,
          languageCode: targetLang.code,
        };
      } catch (err) {
        console.warn('Gemini generation failed, using intelligent topic synthesizer:', err);
      }
    }

    // Intelligent localized synthesizer fallback for instant friction-free generation without API keys
    const fallbackSession = this.synthesizeLocalSession(input, isRawNotes, sessionId, effectiveTier, targetLang.code, effectiveGradeLevel);
    fallbackSession.studentProfile = studentProfile;
    return fallbackSession;
  }

  /**
   * Identifies the specific cognitive trap/misconception of a student's incorrect choice
   */
  public static diagnoseMisconception(
    card: RetrievalCard,
    selectedOption: string,
    concept?: ConceptCheckpoint
  ): DiagnosticDistractor {
    const cleanSelected = selectedOption.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();
    const cleanAnswer = card.answer.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();

    // 1. Check if card has explicit pre-computed diagnostic distractors
    if (card.diagnosticDistractors && card.diagnosticDistractors.length > 0) {
      const match = card.diagnosticDistractors.find(d => {
        const cleanOpt = d.optionText.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();
        return cleanOpt === cleanSelected || cleanSelected.includes(cleanOpt) || cleanOpt.includes(cleanSelected);
      });
      if (match) return match;
    }

    // 2. Intelligent Pedagogical Heuristic Diagnosis:
    const lowerSel = cleanSelected.toLowerCase();
    const lowerAns = cleanAnswer.toLowerCase();

    // Antonym / Inversion pairs
    const inversionPairs: [string, string][] = [
      ['increase', 'decrease'], ['higher', 'lower'], ['rises', 'falls'],
      ['up', 'down'], ['stimulates', 'inhibits'], ['activates', 'deactivates'],
      ['constricts', 'dilates'], ['afferent', 'efferent'], ['positive', 'negative'],
      ['sympathetic', 'parasympathetic'], ['anabolic', 'catabolic'],
      ['systolic', 'diastolic'], ['exothermic', 'endothermic'], ['agonist', 'antagonist'],
      ['hypo', 'hyper'], ['oxidation', 'reduction'], ['dominant', 'recessive']
    ];

    for (const [w1, w2] of inversionPairs) {
      if ((lowerSel.includes(w1) && lowerAns.includes(w2)) || (lowerSel.includes(w2) && lowerAns.includes(w1))) {
        return {
          optionText: selectedOption,
          trapType: 'inversion',
          trapTitle: 'Inversion Trap (Cause & Effect Reversal)',
          trapExplanation: `Your brain reversed the governing directional rule. While "${selectedOption}" feels intuitively linked, the actual mechanism operates in the opposite direction: "${card.answer}".`
        };
      }
    }

    // Semantic Twin Check (using sibling key terms or concept titles)
    if (concept?.keyTerms) {
      const twin = concept.keyTerms.find(k => lowerSel.includes(k.term.toLowerCase()) && !lowerAns.includes(k.term.toLowerCase()));
      if (twin) {
        return {
          optionText: selectedOption,
          trapType: 'semantic-twin',
          trapTitle: `Semantic Twin Trap (Conflated with ${twin.term})`,
          trapExplanation: `You picked a real and important concept ("${twin.term}"), but it refers to a different phase of the mechanism: ${twin.definition}.`
        };
      }
    }

    // Default mechanism review
    return {
      optionText: selectedOption,
      trapType: 'naive-intuition',
      trapTitle: 'Concept Review',
      trapExplanation: `In ${concept?.title || 'this topic'}, the required answer is "${card.answer}". Review this distinction before proceeding.`
    };
  }

  /**
   * Generates a 3-tier progressive Socratic Hint Ladder for any card
   */
  public static getSocraticHintLadder(
    card: RetrievalCard,
    concept?: ConceptCheckpoint
  ): SocraticHintLadder {
    if (card.socraticHintLadder && card.socraticHintLadder.level1Prompt) {
      return card.socraticHintLadder;
    }

    const title = concept?.title || 'this concept';
    const mentalModel = concept?.mentalModel || '';
    const rawHint = card.hint || '';

    // Socratic Nudge (focus attention on causality without giving answer)
    const level1Prompt = rawHint 
      ? `Observe the governing constraint: ${rawHint}`
      : `Look at the primary input in ${title}: what causal trigger initiates this step?`;

    // Physical Grounded Analogy
    const level2Analogy = mentalModel
      ? `Mental Model: ${mentalModel}`
      : `Think of this like an interconnected circuit: each component must match its counterpart before the reaction can proceed.`;

    // Atomic Simplification
    const firstWord = card.answer.split(' ')[0] || '';
    const level3Deconstruction = card.answer.length > 20
      ? `Simplify the target: It starts with "${firstWord}" and directly determines the rate-limiting step.`
      : `Core clue: Focus on "${card.answer.charAt(0).toUpperCase()}..." (${card.answer.length} letters).`;

    return {
      level1Prompt,
      level2Analogy,
      level3Deconstruction,
    };
  }

  private static heuristicFeynmanEvaluation(
    concept: ConceptCheckpoint,
    text: string,
    pedState?: ConceptPedagogicalState
  ): FeynmanEvaluation {
    const lower = text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Check coverage of key terms
    const matchedTerms = concept.keyTerms.filter(k => lower.includes(k.term.toLowerCase()));
    const missingTerms = concept.keyTerms.filter(k => !lower.includes(k.term.toLowerCase()));

    // Causal connectors detection
    const causalMatches = Array.from(new Set(lower.match(/\b(because|leads to|causes|therefore|gradient|forces|triggers|results in|drives|transforms|inhibits|regulates|generates|binds to|converts|allows)\b/g) || []));
    
    // Intuitive analogy detection
    const hasAnalogy = /\b(like|as if|similar to|imagine|analogy|resembles|think of it as|water|dam|gears|factory|switch|engine)\b/i.test(lower);

    const masteredPoints: string[] = [];
    if (matchedTerms.length > 0) {
      masteredPoints.push(`Core terminology utilized: ${matchedTerms.map(t => t.term).join(', ')}.`);
    } else {
      masteredPoints.push('Expressed explanation in your own words.');
    }
    if (causalMatches.length > 0) {
      masteredPoints.push(`Articulated cause-and-effect transitions (${causalMatches.slice(0, 3).join(', ')}).`);
    }
    if (hasAnalogy) {
      masteredPoints.push('Integrated an intuitive physical analogy to clarify the mechanism.');
    }

    const missingNuances: string[] = [];
    if (missingTerms.length > 0) {
      missingNuances.push(`Terms you might incorporate: ${missingTerms.map(t => t.term).join(', ')}.`);
    }
    if (causalMatches.length === 0) {
      missingNuances.push('Articulate the precise driving force or causal trigger connecting step A to step B.');
    }
    missingNuances.push(...concept.coreTakeaways.slice(0, 2));

    const modeHint = pedState?.mode === 'scaffolding' 
      ? ' Focus on step-by-step foundation.'
      : pedState?.mode === 'adversarial'
      ? ' Test boundary limits and edge cases.'
      : '';

    const actionableFeedback = `Offline Causal Analysis: Evaluated ${wordCount} words, ${matchedTerms.length} key terms, and ${causalMatches.length} causal mechanisms.${modeHint} ${
      causalMatches.length > 0
        ? 'Great job establishing direct cause-and-effect relationships without pure buzzwords.'
        : 'Deepen elaborative encoding by explicitly explaining why this phenomenon occurs.'
    }`;

    return {
      score: 0,
      grade: 'Self-Review',
      masteredPoints,
      missingNuances: missingNuances.slice(0, 3),
      jargonDetected: concept.keyTerms.filter(k => lower.includes(k.term.toLowerCase()) && causalMatches.length === 0).map(k => k.term),
      isOfflineSelfCheck: true,
      actionableFeedback,
    };
  }

  private static synthesizeLocalSession(
    input: string,
    isRawNotes: boolean,
    sessionId: string,
    depthTier: DepthTier = 'standard',
    languageCode: string = 'en',
    gradeLevel: AcademicGradeLevel = 'high-school'
  ): StudySession {
    const rawClean = input.trim();

    // If pure topic, delegate directly to the multilingual localized synthesizer
    if (!isRawNotes || rawClean.length <= 50) {
      return DepthEstimationService.synthesizeLocalizedStudySession(input, isRawNotes, sessionId, depthTier, languageCode, gradeLevel);
    }
    const title = isRawNotes 
      ? (rawClean.split('\n')[0]?.slice(0, 45).replace(/[#*_-]/g, '').trim() || 'Lecture Notes Breakdown') 
      : rawClean;
    const c1Id = `c-${sessionId}-1`;
    const c2Id = `c-${sessionId}-2`;

    // If raw notes are provided, extract key lines and definitions directly from the document
    if (isRawNotes && rawClean.length > 50) {
      const lines = rawClean
        .split(/\r?\n/)
        .map(l => l.replace(/^[#*•\-\d.)\s]+/, '').trim())
        .filter(l => l.length > 15);

      // Look for definition-like lines (e.g. "Term: Definition" or "Term is Definition")
      const definitionPairs: { term: string; def: string }[] = [];
      lines.forEach(line => {
        if (line.includes(':')) {
          const parts = line.split(':');
          if (parts[0].length < 40 && parts[1].length > 10) {
            definitionPairs.push({ term: parts[0].trim(), def: parts.slice(1).join(':').trim() });
          }
        } else {
          const match = line.match(/^([^.]{3,35})\s+(?:is|are|refers to|means)\s+([^.]+\.?)/i);
          if (match) {
            definitionPairs.push({ term: match[1].trim(), def: match[2].trim() });
          }
        }
      });

      const primaryTakeaways = lines.slice(0, 3);
      const secondaryTakeaways = lines.slice(3, 6);

      const d1 = definitionPairs[0] || { term: `${title} Mechanism`, def: primaryTakeaways[0] || 'Primary operational dynamic.' };
      const d2 = definitionPairs[1] || { term: 'Governing Principle', def: primaryTakeaways[1] || 'Core functional rule.' };
      const d3 = definitionPairs[2] || { term: 'Application Constraint', def: secondaryTakeaways[0] || 'Operational boundary condition.' };

      return {
        id: sessionId,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        category: 'Imported Document',
        description: `Direct cognitive extraction of "${title}" structured for active recall and retention.`,
        currentConceptIndex: 0,
        currentPhase: 'priming',
        elapsedSeconds: 0,
        createdAt: new Date().toISOString(),
        depthTier,
        gradeLevel,
        languageCode,
        concepts: [
          {
            id: c1Id,
            order: 1,
            title: `Foundations & Core Principles: ${title}`,
            estimatedMinutes: 12,
            mentalModel: `An interconnected framework derived from the source text where "${d1.term}" drives foundational outcomes.`,
            coreTakeaways: primaryTakeaways.length >= 2 ? primaryTakeaways : [
              `Core finding: ${d1.term} operates as "${d1.def}".`,
              `Underlying rule: ${d2.term} establishes the governing mechanism.`,
              'Accurate understanding requires tracing the causal relationship between key inputs and outputs.'
            ],
            keyTerms: [
              { term: d1.term, definition: d1.def },
              { term: d2.term, definition: d2.def }
            ],
            feynmanPrompt: `Explain the core concept of "${d1.term}" in simple everyday words without reading the text.`,
            sampleMasteryExplanation: `At its core, ${d1.term} functions by establishing ${d1.def}, which allows the system to produce predictable results.`,
            retrievalCards: [
              {
                id: `rc-${c1Id}-1`,
                conceptId: c1Id,
                cardType: 'standard',
                question: `Based on your material, what is the core role or definition of "${d1.term}"?`,
                answer: d1.def,
                hint: `Recall the definition from your notes.`,
                explanation: `Direct retrieval from source material cements primary definitions into semantic memory.`,
                stability: 1,
                difficulty: 4,
                reps: 0,
                lapses: 0,
              },
              {
                id: `rc-${c1Id}-2`,
                conceptId: c1Id,
                cardType: 'cloze',
                question: `According to the source text, {{${d1.term}}} is defined as: ${d1.def.slice(0, 70)}...`,
                clozeTemplate: `According to the source text, {{${d1.term}}} is defined as: ${d1.def.slice(0, 70)}...`,
                answer: d1.term,
                hint: `The key term identified in your notes.`,
                explanation: `Cloze deletion forces effortful reconstruction of the core term.`,
                stability: 1,
                difficulty: 4,
                reps: 0,
                lapses: 0,
              },
              {
                id: `rc-${c1Id}-3`,
                conceptId: c1Id,
                cardType: 'multiple-choice',
                question: `Which statement accurately reflects the definition of "${d1.term}"?`,
                options: [
                  d1.def,
                  `It functions entirely in opposition to ${d2.term}`,
                  'It operates without any measurable cause-and-effect relationship',
                  'It has been superseded and is no longer relevant in this context'
                ],
                answer: d1.def,
                hint: `Focus on the exact definition from your notes.`,
                explanation: `Discriminating between the accurate definition and distractors builds high-yield exam recognition.`,
                stability: 1,
                difficulty: 3,
                reps: 0,
                lapses: 0,
              }
            ]
          },
          {
            id: c2Id,
            order: 2,
            title: `Mechanisms & Key Details: ${title}`,
            estimatedMinutes: 10,
            mentalModel: `Examining how "${d2.term}" and "${d3.term}" dictate behavior and interact under real-world conditions.`,
            coreTakeaways: secondaryTakeaways.length >= 2 ? secondaryTakeaways : [
              `Mechanism detail: ${d2.term} governs how changes propagate through the system.`,
              `Boundary condition: ${d3.term} establishes the operational limits of this concept.`,
              'Deep mastery requires recognizing how these components interact in varied problem contexts.'
            ],
            keyTerms: [
              { term: d2.term, definition: d2.def },
              { term: d3.term, definition: d3.def }
            ],
            feynmanPrompt: `Describe how "${d2.term}" interacts with "${d3.term}", and what happens if one of them fails.`,
            sampleMasteryExplanation: `When ${d2.term} is active, it regulates the system, while ${d3.term} sets the necessary boundaries to prevent instability.`,
            retrievalCards: [
              {
                id: `rc-${c2Id}-1`,
                conceptId: c2Id,
                cardType: 'standard',
                question: `What is the significance of "${d2.term}" in this context?`,
                answer: d2.def,
                hint: `Think about the functional role described in the text.`,
                explanation: `Retrieval practice strengthens the neural pathways associated with structural mechanisms.`,
                stability: 1,
                difficulty: 4,
                reps: 0,
                lapses: 0,
              },
              {
                id: `rc-${c2Id}-2`,
                conceptId: c2Id,
                cardType: 'cloze',
                question: `In this material, the mechanism governing outcomes is {{${d2.term}}}.`,
                clozeTemplate: `In this material, the mechanism governing outcomes is {{${d2.term}}}.`,
                answer: d2.term,
                hint: `The second prominent mechanism from the notes.`,
                explanation: `Active recall cements the functional connection.`,
                stability: 1,
                difficulty: 4,
                reps: 0,
                lapses: 0,
              },
              {
                id: `rc-${c2Id}-3`,
                conceptId: c2Id,
                cardType: 'multiple-choice',
                question: `How does "${d3.term}" function within this domain?`,
                options: [
                  d3.def,
                  'It serves purely as cosmetic terminology with no functional impact',
                  'It guarantees 100% efficiency regardless of input parameters',
                  'It reverses the fundamental principles established in part one'
                ],
                answer: d3.def,
                hint: `Recall the functional definition from the text.`,
                explanation: `Verifying boundary conditions prevents catastrophic misunderstanding in exam contexts.`,
                stability: 1,
                difficulty: 3,
                reps: 0,
                lapses: 0,
              }
            ]
          }
        ]
      };
    }

    // Fallback if raw notes did not yield enough structure: delegate to multilingual localized synthesizer
    return DepthEstimationService.synthesizeLocalizedStudySession(input, isRawNotes, sessionId, depthTier, languageCode, gradeLevel);
  }
}

