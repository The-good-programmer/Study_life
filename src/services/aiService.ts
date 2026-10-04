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
  SocraticHintLadder 
} from '../types';
import { StorageService } from './storageService';
import { DepthEstimationService, SUPPORTED_LANGUAGES } from './depthEstimationService';

export interface VivaVoceTurnResponse {
  nextTurn: SocraticTurn;
  verdict?: VivaDefenseVerdict;
  isComplete: boolean;
}

export class AIService {
  /**
   * Checks whether a user-configured Gemini API key is present
   */
  public static isAvailable(): boolean {
    return Boolean(StorageService.getApiKey());
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

  private static readonly MODEL_CANDIDATES = [
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-2.5-pro',
  ];

  private static async generateContentWithFallback(
    ai: GoogleGenAI,
    contents: string,
    responseMimeType?: string,
    enableThinking: boolean = false
  ) {
    let lastError: unknown = null;
    for (const model of this.MODEL_CANDIDATES) {
      try {
        const config: Record<string, unknown> = {};
        if (responseMimeType) {
          config.responseMimeType = responseMimeType;
        }
        if (enableThinking) {
          if (model.includes('3.')) {
            config.thinkingConfig = { thinkingLevel: 'LOW' };
          } else if (model.includes('2.5')) {
            config.thinkingConfig = { thinkingBudget: 1024 };
          }
        }
        const response = await ai.models.generateContent({
          model,
          contents,
          config: Object.keys(config).length > 0 ? (config as any) : undefined,
        });
        return response;
      } catch (err) {
        lastError = err;
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
   * Evaluates student's Feynman explanation using Gemini or intelligent cognitive heuristic fallback
   */
  public static async evaluateFeynmanExplanation(
    concept: ConceptCheckpoint,
    userExplanation: string
  ): Promise<FeynmanEvaluation> {
    const ai = this.getClient();
    const cleanExplanation = userExplanation.trim();

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

    if (ai) {
      try {
        const prompt = `
You are a cognitive psychology tutor evaluating a student's explanation using the Feynman Technique.
Target Concept: "${concept.title}"
Mental Model: "${concept.mentalModel}"
Core Takeaways to cover: ${JSON.stringify(concept.coreTakeaways)}
Key Terms: ${JSON.stringify(concept.keyTerms.map(k => k.term))}
Challenge Prompt: "${concept.feynmanPrompt}"

Student's Explanation:
"""${cleanExplanation}"""

Evaluate the student's submission. Return ONLY valid JSON with this exact schema:
{
  "score": number between 0 and 100,
  "grade": "Novice" | "Developing" | "Solid Understanding" | "Complete Mastery",
  "masteredPoints": string[],
  "missingNuances": string[],
  "jargonDetected": string[],
  "actionableFeedback": string
}
`;

        const response = await this.generateContentWithFallback(
          ai,
          prompt,
          'application/json'
        );

        const text = response.text || '';
        const parsed = this.safeParseJSON<Partial<FeynmanEvaluation>>(text, {});
        return {
          score: Math.min(100, Math.max(0, parsed.score || 75)),
          grade: parsed.grade || 'Solid Understanding',
          masteredPoints: parsed.masteredPoints || ['Captured the core high-level idea.'],
          missingNuances: parsed.missingNuances || ['Consider expanding on the underlying mechanism.'],
          jargonDetected: parsed.jargonDetected || [],
          actionableFeedback: parsed.actionableFeedback || 'Great active recall attempt! Solidifying the nuances will lock this into long-term memory.'
        };
      } catch (err) {
        console.warn('Gemini API call failed, falling back to cognitive heuristic analysis:', err);
      }
    }

    // High quality cognitive fallback when API key is not present or offline
    return this.heuristicFeynmanEvaluation(concept, cleanExplanation);
  }

  /**
   * Socratic interactive coach follow-up after Feynman evaluation
   */
  public static async askSocraticFollowUp(
    concept: ConceptCheckpoint,
    userExplanation: string,
    studentQuestion: string
  ): Promise<string> {
    const ai = this.getClient();
    const cleanQ = studentQuestion.trim();
    if (!cleanQ) return 'Please ask a specific clarifying question regarding this concept.';

    if (ai) {
      try {
        const prompt = `
You are a warm, concise Socratic science tutor helping a student deeply understand "${concept.title}".
Context / Mental Model: "${concept.mentalModel}"
Core Takeaways: ${JSON.stringify(concept.coreTakeaways)}
Student's initial explanation: "${userExplanation}"
Student's question: "${cleanQ}"

Answer the student in 2 to 3 concise, illuminating sentences. Use an intuitive analogy where helpful. Directly illuminate the underlying mechanism.
`;
        const response = await this.generateContentWithFallback(ai, prompt);

        if (response.text?.trim()) {
          return response.text.trim();
        }
      } catch (err) {
        console.warn('Gemini follow-up failed, using heuristic guidance:', err);
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
    targetRound: number
  ): Promise<VivaVoceTurnResponse> {
    const ai = this.getClient();
    const cleanResponse = studentResponse.trim();

    if (ai) {
      try {
        const isFinalRound = targetRound >= 3;
        const prompt = `
You are an esteemed, intellectually demanding yet constructive Socratic Examiner presiding over an oral viva voce examination on "${concept.title}".
Context / Mental Model: "${concept.mentalModel}"
Core Takeaways to master: ${JSON.stringify(concept.coreTakeaways)}
Key Technical Terms: ${JSON.stringify(concept.keyTerms.map(k => k.term))}

Current Examination Round: ${targetRound} of 3.
Full Transcript so far:
${JSON.stringify(history.map(h => ({ role: h.role, text: h.text })))}

Candidate's Latest Statement:
"""${cleanResponse}"""

Instructions:
${!isFinalRound ? `
1. Evaluate the candidate's latest response. Check if they used textbook buzzwords without unpacking them, if their reasoning has circular logic, or if they articulated cause-and-effect well.
2. Formulate your next verbal Socratic challenge (2 to 3 sentences).
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

        const response = await this.generateContentWithFallback(ai, prompt, 'application/json');

        const parsed = this.safeParseJSON<Record<string, any>>(response.text || '', {});
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
    return this.heuristicVivaVoceTurn(concept, cleanResponse, targetRound);
  }

  private static heuristicVivaVoceTurn(
    concept: ConceptCheckpoint,
    cleanResponse: string,
    targetRound: number
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
      const examinerText = isShort
        ? `You have touched on the topic, but an oral viva requires causal rigor. Do not merely state that "${concept.title}" occurs. Trace the exact sequence: what physical trigger initiates the cascade, and how does component A affect component B?`
        : `Your opening defense captures the broad architecture of ${concept.title}. However, a scholar must explain the governing constraint: What prevents this mechanism from running in reverse, or what occurs if the primary gradient or energy supply is interrupted? Answer without using textbook buzzwords.`;

      return {
        nextTurn: {
          id: `turn-examiner-${Date.now()}`,
          role: 'examiner',
          text: examinerText,
          timestamp: Date.now(),
          turnType: 'mechanism-probe',
          reaction: isShort ? 'skeptical' : 'probing',
          reactionNote: isShort ? 'Explanation too terse; probing for causal mechanism.' : 'Premise accepted; probing for boundary conditions.',
          jargonDetected: detectedJargon,
        },
        isComplete: false,
      };
    }

    if (targetRound === 2) {
      const examinerText = hasAnalogy
        ? `I note your analogy. Now clarify the precision: At which specific boundary does your analogy fail to match the real physical behavior of ${concept.title}? What microscopic reality differs from your macroscopic picture?`
        : `Your mechanical reasoning is taking shape. Now for the true test of Feynman comprehension: Translate this entire mechanism into an everyday physical analogy (such as a watermill, airport baggage system, or musical orchestra) so a novice can grasp the intuitive dynamic.`;

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
    const ai = this.getClient();

    if (ai) {
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

        const response = await this.generateContentWithFallback(ai, prompt, 'application/json');

        const parsed = this.safeParseJSON<Record<string, any>>(response.text || '', {});
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
    const ai = this.getClient();
    const sessionId = `session-${Date.now()}`;

    const targetLang = languageCode
      ? (SUPPORTED_LANGUAGES.find(l => l.code === languageCode) || DepthEstimationService.detectLanguage(input))
      : DepthEstimationService.detectLanguage(input);

    const depthEstimate = DepthEstimationService.estimateConceptDepth(input, targetLang.code);
    const effectiveTier: DepthTier = depthTier || depthEstimate.tier;
    const effectiveGradeLevel: AcademicGradeLevel = gradeLevel || depthEstimate.gradeLevel;

    if (ai) {
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
      "retrievalCards": [
        {
          "cardType": "standard" | "cloze" | "multiple-choice",
          "question": string,
          "answer": string,
          "hint": string,
          "explanation": string,
          "options": string[],
          "clozeTemplate": string,
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

        const response = await this.generateContentWithFallback(ai, prompt, 'application/json', true);

        const text = response.text || '';
        const parsed = this.safeParseJSON<Record<string, any>>(text, {});

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
              stability: 1,
              difficulty: 5,
              reps: 0,
              lapses: 0,
            };
          });

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

    // Naive Intuition or Partial Truth
    return {
      optionText: selectedOption,
      trapType: 'naive-intuition',
      trapTitle: 'Common Intuition Fallacy',
      trapExplanation: `This choice is a common intuitive assumption. In ${concept?.title || 'this system'}, the underlying causal law differs from surface appearance: the required answer is "${card.answer}".`
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

  private static heuristicFeynmanEvaluation(concept: ConceptCheckpoint, text: string): FeynmanEvaluation {
    const lower = text.toLowerCase();
    const wordCount = text.trim().split(/\s+/).length;
    
    // Check coverage of key terms
    const matchedTerms = concept.keyTerms.filter(k => lower.includes(k.term.toLowerCase()));
    const missingTerms = concept.keyTerms.filter(k => !lower.includes(k.term.toLowerCase()));

    let score = 50;
    if (wordCount >= 30) score += 15;
    if (wordCount >= 60) score += 15;
    if (matchedTerms.length > 0) score += Math.min(20, matchedTerms.length * 10);

    const masteredPoints: string[] = [];
    if (wordCount > 35) {
      masteredPoints.push('Good explanation length and thought development.');
    }
    if (matchedTerms.length > 0) {
      masteredPoints.push(`Naturally integrated concepts: ${matchedTerms.map(t => t.term).join(', ')}.`);
    } else {
      masteredPoints.push('Communicated the core premise without getting trapped in jargon.');
    }

    const missingNuances: string[] = [];
    if (missingTerms.length > 0) {
      missingNuances.push(`Try to connect your explanation to: ${missingTerms.map(t => t.term).join(', ')}.`);
    }
    missingNuances.push(...concept.coreTakeaways.slice(0, 2));

    let grade: FeynmanEvaluation['grade'] = 'Developing';
    if (score >= 85) grade = 'Complete Mastery';
    else if (score >= 70) grade = 'Solid Understanding';

    return {
      score: Math.min(95, score),
      grade,
      masteredPoints,
      missingNuances: missingNuances.slice(0, 3),
      jargonDetected: matchedTerms.filter(t => {
        const termRegex = new RegExp(`\\b${t.term}\\b.{0,30}\\b(is|means|because|causes|transforms|by|via)\\b`, 'i');
        return !termRegex.test(lower);
      }).map(t => t.term),
      actionableFeedback: 'You have articulated the main idea well! Re-reading the nuances will cement this concept into your neocortex.'
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

