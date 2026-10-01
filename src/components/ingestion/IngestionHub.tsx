import React, { useState } from 'react';
import { Sparkles, FileText, Compass, ArrowRight, Play, RefreshCw, Layers } from 'lucide-react';
import type { StudySession } from '../../types';
import { DEMO_STUDY_SESSIONS } from '../../data/demoDecks';
import { AIService } from '../../services/aiService';

interface IngestionHubProps {
  onStartSession: (session: StudySession) => void;
  onOpenDashboard: () => void;
}

export const IngestionHub: React.FC<IngestionHubProps> = ({ onStartSession, onOpenDashboard }) => {
  const [activeTab, setActiveTab] = useState<'topic' | 'notes' | 'curated'>('topic');
  const [topicInput, setTopicInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const popularTopics = [
    'Neuroplasticity & Synaptic Pruning',
    'Quantum Superposition & Qubits',
    'Cellular DNA Replication Forks',
    'Microeconomics: Price Elasticity of Demand',
    'Machine Learning: Gradient Descent & Loss Landscapes'
  ];

  const handleGenerateTopic = async (topicToUse?: string) => {
    const text = topicToUse || topicInput;
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const session = await AIService.generateStudySession(text, false);
      onStartSession(session);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecomposeNotes = async () => {
    if (!notesInput.trim()) return;

    setIsLoading(true);
    try {
      const session = await AIService.generateStudySession(notesInput, true);
      onStartSession(session);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 sm:py-10 animate-fadeIn px-4">
      
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Proven Cognitive Psychology & Neuroscience</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Just sit down and study. <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
            Studify conducts the rest.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          Zero planning. No decision fatigue. We automatically structure your material into 
          <strong> Priming</strong>, <strong>Feynman Explanation</strong>, <strong>Active Retrieval</strong>, and <strong>Neuro-Rest</strong>.
        </p>
      </div>

      {/* Mode Selection Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('topic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'topic'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Enter Topic</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'notes'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste Notes / Slides</span>
          </button>

          <button
            onClick={() => setActiveTab('curated')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'curated'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Curated Science Decks</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Instant Topic Ingestion */}
      {activeTab === 'topic' && (
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">What do you need to master today?</h3>
            <p className="text-xs text-slate-400">
              Type any topic or exam syllabus concept. The cognitive engine will decompose it into a guided session.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateTopic()}
              placeholder="e.g. Mitochondria & ATP Synthesis, Von Neumann Architecture, Game Theory..."
              className="flex-1 px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white text-sm outline-none transition-all placeholder:text-slate-500"
            />
            <button
              onClick={() => handleGenerateTopic()}
              disabled={isLoading || !topicInput.trim()}
              className={`px-6 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                isLoading || !topicInput.trim()
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Decomposing Concepts...</span>
                </>
              ) : (
                <>
                  <span>Start Study Pilot</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Quick Ideas Chips */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Popular Quick-Start Topics
            </div>
            <div className="flex flex-wrap gap-2">
              {popularTopics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setTopicInput(topic);
                    handleGenerateTopic(topic);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-indigo-300 transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Notes / Slides Ingestion */}
      {activeTab === 'notes' && (
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Paste Lecture Notes, Transcripts, or Syllabus</h3>
            <p className="text-xs text-slate-400">
              Paste your raw textbook chapter, slide text, or lecture notes. Studify extracts the mental models, challenges, and recall cards.
            </p>
          </div>

          <textarea
            rows={7}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Paste your raw lecture notes or study material text here..."
            className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white text-sm outline-none resize-none placeholder:text-slate-500 transition-all leading-relaxed"
          />

          <div className="flex justify-end">
            <button
              onClick={handleDecomposeNotes}
              disabled={isLoading || !notesInput.trim()}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                isLoading || !notesInput.trim()
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Study Cycle...</span>
                </>
              ) : (
                <>
                  <span>Decompose & Launch Pilot</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Curated Science Decks */}
      {activeTab === 'curated' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEMO_STUDY_SESSIONS.map((demo) => (
            <div
              key={demo.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-xl flex flex-col justify-between group transition-all"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {demo.category}
                </span>
                <h4 className="text-base font-bold text-white group-hover:text-indigo-200 transition-colors">
                  {demo.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {demo.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {demo.concepts.length} Concepts • {demo.concepts.reduce((a, b) => a + b.retrievalCards.length, 0)} Recall Cards
                </span>
                <button
                  onClick={() => onStartSession(demo)}
                  className="p-2 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20"
                  title="Launch Study Pilot"
                >
                  <Play className="w-4 h-4 fill-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spaced Repetition Queue Quick Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Already studied before? Review your spaced repetition memory queue.</span>
        </div>
        <button
          onClick={onOpenDashboard}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          <span>Open Retention Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
