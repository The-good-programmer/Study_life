import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, Send, CheckCircle, AlertTriangle, ArrowRight, Eye, RefreshCw, Award, Mic, MicOff } from 'lucide-react';
import type { ConceptCheckpoint, FeynmanEvaluation } from '../../types';
import { AIService } from '../../services/aiService';
import { soundEngine } from '../../services/soundEngine';

interface FeynmanPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
}

// Window speech recognition typings
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const FeynmanPhase: React.FC<FeynmanPhaseProps> = ({ concept, onComplete }) => {
  const [explanation, setExplanation] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<FeynmanEvaluation | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          if (fullTranscript.trim()) {
            setExplanation(fullTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to initialize speech recognition:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleVoiceDictation = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
      }
    }
  };

  const wordCount = explanation.trim() ? explanation.trim().split(/\s+/).length : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wordCount < 5) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setIsEvaluating(true);
    try {
      const result = await AIService.evaluateFeynmanExplanation(concept, explanation);
      setEvaluation(result);
      soundEngine.playCompletionChime();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRetry = () => {
    setEvaluation(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-950/40 border border-purple-900/50">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-purple-300">
          <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Phase 2: The Feynman Technique</strong> — If you can't explain it simply, you don't understand it yet.
          </span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50">
          Active Encoding
        </span>
      </div>

      {/* Challenge Prompt Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 border border-purple-500/30 shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2">
          Your Feynman Challenge
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">
          {concept.feynmanPrompt}
        </h3>
        <p className="mt-2 text-xs text-slate-400">
          Rule: Do not look at notes. Explain as if teaching a beginner. You can type or <strong>speak aloud via microphone</strong>.
        </p>
      </div>

      {/* Input or Result */}
      {!evaluation ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              rows={7}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Start explaining the concept step-by-step in your own words, or tap the microphone to speak aloud..."
              className={`w-full p-4 rounded-xl bg-slate-900 border text-slate-100 text-sm leading-relaxed placeholder:text-slate-500 outline-none resize-none transition-all ${
                isListening
                  ? 'border-rose-500 ring-2 ring-rose-500/30 shadow-lg shadow-rose-500/10'
                  : 'border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
              }`}
            />

            {/* Live voice indicator */}
            {isListening && (
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Listening aloud...</span>
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md backdrop-blur-sm border border-slate-800">
              <span>{wordCount} words</span>
              {wordCount < 15 && <span className="text-amber-400 text-[11px]">Aim for 20+ words</span>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Voice Dictation Button */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-600/30 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title={isListening ? 'Stop voice recording' : 'Dictate your explanation aloud'}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4 text-white" />
                      <span>Stop Listening</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-rose-400" />
                      <span>Speak Explanation Aloud</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setExplanation(concept.sampleMasteryExplanation)}
                className="text-xs text-slate-400 hover:text-purple-300 underline underline-offset-4 transition-colors"
              >
                [Demo] Fill Sample
              </button>
            </div>

            <button
              type="submit"
              disabled={isEvaluating || wordCount < 3}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                isEvaluating || wordCount < 3
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25'
              }`}
            >
              {isEvaluating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluating Conceptual Nuances...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit for Socratic Evaluation</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Evaluation Results Card */
        <div className="space-y-6 animate-fadeIn">
          
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
            
            {/* Score & Grade Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Award className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Conceptual Comprehension
                  </div>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{evaluation.grade}</span>
                    <span className="text-sm font-normal text-purple-300">({evaluation.score}%)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRetry}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refine Explanation
              </button>
            </div>

            {/* Mastered Nuances */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle className="w-4 h-4" />
                Points You Articulated Well
              </div>
              <ul className="space-y-1.5 pl-5 list-disc text-sm text-slate-300 marker:text-emerald-500">
                {evaluation.masteredPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>

            {/* Missing Nuances */}
            {evaluation.missingNuances.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4" />
                  Key Nuances to Strengthen
                </div>
                <ul className="space-y-1.5 pl-5 list-disc text-sm text-slate-300 marker:text-amber-500">
                  {evaluation.missingNuances.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actionable Feedback */}
            <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs sm:text-sm text-purple-200 leading-relaxed">
              💡 {evaluation.actionableFeedback}
            </div>

            {/* Reference Model Accordion */}
            <div className="pt-2">
              <button
                onClick={() => setShowSample(!showSample)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {showSample ? 'Hide' : 'Inspect'} Reference Mastery Explanation
              </button>
              {showSample && (
                <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 italic leading-relaxed animate-fadeIn">
                  "{concept.sampleMasteryExplanation}"
                </div>
              )}
            </div>

          </div>

          {/* Proceed to Phase 3 Button */}
          <div className="flex justify-end">
            <button
              onClick={onComplete}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 group transition-all"
            >
              <span>Feynman Complete — Proceed to Active Recall Quiz</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
