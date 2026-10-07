import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Zap, 
  BookOpen, 
  Compass, 
  Lock, 
  BrainCircuit, 
  Layers, 
  TrendingUp, 
  Play, 
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Target
} from 'lucide-react';
import type { ConceptCheckpoint, RetrievalCard, StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { MathRenderer } from '../common/MathRenderer';
import { fillCloze } from '../../utils/cloze';

export type NodeMasteryStatus = 'mastered' | 'consolidating' | 'fragile' | 'unexplored';

export interface ConceptMasteryNode {
  concept: ConceptCheckpoint;
  session: StudySession;
  index: number;
  status: NodeMasteryStatus;
  statusLabel: string;
  isFrontier: boolean; // Zone of Proximal Development (ZPD)
  stabilityAvg: number;
  totalCards: number;
  dueCardsCount: number;
  lapsedCardsCount: number;
  diagnosticState?: 'passed' | 'missed' | 'untested';
  diagnosticQuestion?: string;
  diagnosticMissedReason?: string;
}

interface CurriculumKnowledgeMapProps {
  onBack: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation?: (session: StudySession) => void;
}

export const CurriculumKnowledgeMap: React.FC<CurriculumKnowledgeMapProps> = ({
  onBack,
  onStartSession,
  onOpenDeckStation
}) => {
  const [sessions] = useState<StudySession[]>(() => {
    const saved = StorageService.getSessions();
    return saved;
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    return sessions[0]?.id || 'all';
  });

  const [selectedNode, setSelectedNode] = useState<ConceptMasteryNode | null>(null);

  // Compute all concept mastery nodes across sessions
  const courseNodesMap = useMemo(() => {
    const result: Record<string, ConceptMasteryNode[]> = {};

    sessions.forEach(session => {
      const nodes: ConceptMasteryNode[] = [];
      let foundFirstIncomplete = false;

      const diagnosticMissedSet = new Set<string>();
      if (session.diagnosticReport?.probes) {
        session.diagnosticReport.probes.forEach(probe => {
          if (!probe.isCorrect) {
            diagnosticMissedSet.add(probe.conceptId);
          }
        });
      }

      session.concepts.forEach((concept, idx) => {
        const cards: RetrievalCard[] = concept.retrievalCards || [];
        const totalCards = cards.length;
        
        let stabilitySum = 0;
        let dueCount = 0;
        let lapseCount = 0;
        let reviewedCount = 0;
        const now = new Date().toISOString();

        cards.forEach(card => {
          if (card.stability && card.stability > 0) {
            stabilitySum += card.stability;
            reviewedCount++;
          }
          if (card.lapses && card.lapses >= 2) {
            lapseCount++;
          }
          if (card.nextReviewDate && card.nextReviewDate <= now) {
            dueCount++;
          }
        });

        const stabilityAvg = reviewedCount > 0 ? stabilitySum / reviewedCount : 0;
        const isDiagnosticMissed = diagnosticMissedSet.has(concept.id);

        let status: NodeMasteryStatus = 'unexplored';
        let statusLabel = 'Unexplored';

        if (totalCards > 0 && reviewedCount === totalCards && stabilityAvg >= 7 && lapseCount === 0 && !isDiagnosticMissed) {
          status = 'mastered';
          statusLabel = 'Synaptically Mastered';
        } else if (lapseCount > 0 || isDiagnosticMissed || (dueCount > 0 && reviewedCount > 0)) {
          status = 'fragile';
          statusLabel = isDiagnosticMissed ? 'Attention Gap (Pre-Test)' : 'Fragile / Review Due';
        } else if (reviewedCount > 0 || stabilityAvg > 0) {
          status = 'consolidating';
          statusLabel = 'Consolidating';
        } else {
          status = 'unexplored';
          statusLabel = 'Unexplored Baseline';
        }

        // Zone of Proximal Development: First node that is not fully mastered
        let isFrontier = false;
        if (!foundFirstIncomplete && status !== 'mastered') {
          isFrontier = true;
          foundFirstIncomplete = true;
        }

        let diagnosticState: 'passed' | 'missed' | 'untested' = 'untested';
        let diagQ: string | undefined;
        let diagReason: string | undefined;

        if (session.diagnosticReport?.probes) {
          const matchedProbe = session.diagnosticReport.probes.find(
            p => p.conceptId === concept.id || p.conceptTitle.toLowerCase() === concept.title.toLowerCase()
          );
          if (matchedProbe) {
            diagnosticState = matchedProbe.isCorrect ? 'passed' : 'missed';
            diagQ = matchedProbe.question;
            if (!matchedProbe.isCorrect) {
              diagReason = `Selected "${matchedProbe.userAnswer || 'None'}" instead of "${matchedProbe.correctAnswer}"`;
            }
          }
        }

        nodes.push({
          concept,
          session,
          index: idx,
          status,
          statusLabel,
          isFrontier,
          stabilityAvg,
          totalCards,
          dueCardsCount: dueCount,
          lapsedCardsCount: lapseCount,
          diagnosticState,
          diagnosticQuestion: diagQ,
          diagnosticMissedReason: diagReason
        });
      });

      result[session.id] = nodes;
    });

    return result;
  }, [sessions]);

  // Aggregate stats across knowledge space
  const aggregateStats = useMemo(() => {
    let totalNodes = 0;
    let masteredCount = 0;
    let consolidatingCount = 0;
    let fragileCount = 0;
    let unexploredCount = 0;

    Object.values(courseNodesMap).forEach(nodes => {
      nodes.forEach(n => {
        totalNodes++;
        if (n.status === 'mastered') masteredCount++;
        else if (n.status === 'consolidating') consolidatingCount++;
        else if (n.status === 'fragile') fragileCount++;
        else unexploredCount++;
      });
    });

    const masteryPercent = totalNodes > 0 ? Math.round((masteredCount / totalNodes) * 100) : 0;

    return {
      totalNodes,
      masteredCount,
      consolidatingCount,
      fragileCount,
      unexploredCount,
      masteryPercent
    };
  }, [courseNodesMap]);

  // Active nodes to render
  const displayedCourses = useMemo(() => {
    if (selectedSessionId === 'all') {
      return sessions.map(s => ({
        session: s,
        nodes: courseNodesMap[s.id] || []
      }));
    }
    const current = sessions.find(s => s.id === selectedSessionId);
    if (!current) return [];
    return [{
      session: current,
      nodes: courseNodesMap[current.id] || []
    }];
  }, [sessions, selectedSessionId, courseNodesMap]);

  const handleLaunchTargetDrill = (node: ConceptMasteryNode) => {
    // Clone session with currentConceptIndex focused on this concept
    const focusedSession: StudySession = {
      ...node.session,
      currentConceptIndex: node.index,
      currentPhase: 'priming'
    };
    onStartSession(focusedSession);
  };

  const getStatusColor = (status: NodeMasteryStatus, isFrontier: boolean) => {
    if (isFrontier) {
      return {
        border: 'border-indigo-400 shadow-indigo-500/30 ring-2 ring-indigo-500/40',
        badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        dot: 'bg-indigo-400 animate-pulse',
        icon: Compass,
        accent: 'text-indigo-400'
      };
    }
    switch (status) {
      case 'mastered':
        return {
          border: 'border-emerald-500/50 hover:border-emerald-400 shadow-emerald-500/10',
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
          icon: CheckCircle2,
          accent: 'text-emerald-400'
        };
      case 'fragile':
        return {
          border: 'border-rose-500/50 hover:border-rose-400 shadow-rose-500/15 ring-1 ring-rose-500/30',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400 animate-ping',
          icon: AlertTriangle,
          accent: 'text-rose-400'
        };
      case 'consolidating':
        return {
          border: 'border-cyan-500/40 hover:border-cyan-400',
          badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          dot: 'bg-cyan-400',
          icon: Zap,
          accent: 'text-cyan-400'
        };
      case 'unexplored':
      default:
        return {
          border: 'border-white/[0.08] hover:border-white/[0.2] opacity-75 hover:opacity-100',
          badge: 'bg-slate-800 text-slate-400 border-white/[0.08]',
          dot: 'bg-slate-500',
          icon: Lock,
          accent: 'text-slate-400'
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-2 sm:px-4 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-white/[0.08]"
            title="Return to Retention Overview"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                Macro-Curriculum Knowledge Tree
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold uppercase tracking-wider">
                Knowledge Space Theory
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Longitudinal prerequisite hierarchy mapping synaptic consolidation across your entire syllabus.
            </p>
          </div>
        </div>

        {/* Course Filter Dropdown / Tabs */}
        {sessions.length > 1 && (
          <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-2xl border border-white/[0.08]">
            <button
              onClick={() => setSelectedSessionId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedSessionId === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Syllabi ({sessions.length})
            </button>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all truncate max-w-[140px] sm:max-w-[200px] ${
                  selectedSessionId === s.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={s.title}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Synaptic Health Portfolio Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold">Total Nodes</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{aggregateStats.totalNodes}</div>
          <div className="text-[11px] text-slate-500">Atomic Checkpoints</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold">Consolidated</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{aggregateStats.masteredCount}</div>
          <div className="text-[11px] text-slate-500">Stability ≥ 7 Days</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-xs text-cyan-400">
            <span className="font-semibold">Consolidating</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 font-mono">{aggregateStats.consolidatingCount}</div>
          <div className="text-[11px] text-slate-500">Stability 1–7 Days</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span className="font-semibold">Fragile Gaps</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{aggregateStats.fragileCount}</div>
          <div className="text-[11px] text-slate-500">Lapsed / Pre-Test Misses</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-purple-400">
            <span className="font-semibold">Mastery Density</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">{aggregateStats.masteryPercent}%</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
              style={{ width: `${aggregateStats.masteryPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cognitive Grounding Alert Banner */}
      <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200/90 flex items-start gap-3">
        <BrainCircuit className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">
            Knowledge Space Theory (Doignon &amp; Falmagne) &amp; The Zone of Proximal Development
          </p>
          <p className="text-indigo-300/80 leading-relaxed text-[11px]">
            Mastery is non-linear. The pulsing indigo <strong className="text-white">Learning Frontier</strong> represents your immediate proximal learning zone. Prerequisite checkpoints must achieve synaptic stabilization before downstream conceptual models can form permanent schema.
          </p>
        </div>
      </div>

      {/* Courses / Decks Knowledge Topology */}
      {displayedCourses.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Curriculum Modules Available</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create a syllabus in the Deck Studio or launch a starter deck from the catalog to build your Knowledge Space graph.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {displayedCourses.map(({ session, nodes }) => {
            const courseMasteredCount = nodes.filter(n => n.status === 'mastered').length;
            const courseProgress = nodes.length > 0 ? Math.round((courseMasteredCount / nodes.length) * 100) : 0;

            return (
              <div key={session.id} className="space-y-6">
                {/* Course Header Banner */}
                <div className="p-5 rounded-3xl glass-panel flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-mono font-bold uppercase">
                        {session.category || 'General Subject'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {nodes.length} Checkpoints • {session.concepts.reduce((acc, c) => acc + (c.estimatedMinutes || 10), 0)} min total
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white font-display">
                      {session.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-indigo-300">
                        {courseMasteredCount} / {nodes.length} Mastered
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {courseProgress}% Schema Consolidation
                      </div>
                    </div>
                    <button
                      onClick={() => onStartSession(session)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Start Syllabus</span>
                    </button>
                  </div>
                </div>

                {/* Directed Knowledge Topology Chain */}
                <div className="relative pl-6 sm:pl-8 space-y-6">
                  {/* Vertical Connection Line */}
                  <div className="absolute left-9 sm:left-11 top-6 bottom-6 w-0.5 bg-gradient-to-b from-indigo-500/60 via-purple-500/40 to-slate-800" />

                  {nodes.map((node, nodeIdx) => {
                    const style = getStatusColor(node.status, node.isFrontier);
                    const StatusIcon = style.icon;

                    return (
                      <div key={node.concept.id} className="relative flex items-start gap-4 sm:gap-6 group">
                        {/* Stepper Node Marker */}
                        <div 
                          className={`relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-transform duration-300 ${
                            node.isFrontier
                              ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30 shadow-lg shadow-indigo-600/40 scale-110'
                              : node.status === 'mastered'
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : node.status === 'fragile'
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                              : node.status === 'consolidating'
                              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                              : 'bg-slate-900 border border-slate-700 text-slate-400'
                          }`}
                        >
                          {node.status === 'mastered' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span>{nodeIdx + 1}</span>
                          )}
                        </div>

                        {/* Node Card Content */}
                        <div
                          onClick={() => setSelectedNode(node)}
                          className={`flex-1 p-5 rounded-2xl glass-panel-interactive border transition-all cursor-pointer ${style.border} ${
                            node.isFrontier ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase">
                                  Checkpoint {String(nodeIdx + 1).padStart(2, '0')}
                                </span>
                                
                                {node.isFrontier && (
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-mono font-bold flex items-center gap-1">
                                    <Target className="w-3 h-3 text-indigo-400" />
                                    Active Frontier (ZPD)
                                  </span>
                                )}

                                <span className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold flex items-center gap-1 ${style.badge}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  <span>{node.statusLabel}</span>
                                </span>

                                {node.diagnosticState === 'missed' && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-mono font-bold">
                                    Pre-Flight Attention Gap
                                  </span>
                                )}
                              </div>

                              <h4 className="text-base font-bold text-white group-hover:text-indigo-200 transition-colors font-display">
                                {node.concept.title}
                              </h4>
                            </div>

                            {/* Node Metadata Pills */}
                            <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
                              <div className="text-right text-[11px] font-mono text-slate-400">
                                <div className="text-slate-200 font-bold">
                                  {node.totalCards} cards
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {node.stabilityAvg > 0 ? `S: ${node.stabilityAvg.toFixed(1)}d` : 'Unrated'}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                            </div>
                          </div>

                          {/* Quick Mental Model Teaser */}
                          {node.concept.mentalModel && (
                            <p className="text-xs text-slate-400 mt-2.5 line-clamp-1 italic border-l-2 border-slate-700 pl-2.5">
                              "{node.concept.mentalModel}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Concept Deep Dive Drawer Modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div 
            className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0f111a] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold uppercase">
                    Checkpoint {String(selectedNode.index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedNode.concept.estimatedMinutes || 10} min estimated
                  </span>
                  {selectedNode.isFrontier && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold">
                      Recommended Next Target
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-white font-display">
                  {selectedNode.concept.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Part of <strong className="text-slate-200">{selectedNode.session.title}</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-white/[0.08]"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200 text-xs sm:text-sm">
              {/* Cognitive Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                selectedNode.status === 'mastered'
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : selectedNode.status === 'fragile'
                  ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                  : selectedNode.status === 'consolidating'
                  ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-300'
                  : 'bg-slate-900 border-white/[0.08] text-slate-400'
              }`}>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5" />
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">
                      Mastery Status: {selectedNode.statusLabel}
                    </div>
                    <div className="text-[11px] opacity-80">
                      Average Stability: {selectedNode.stabilityAvg > 0 ? `${selectedNode.stabilityAvg.toFixed(1)} days` : 'Not yet reviewed'} • {selectedNode.totalCards} cards total
                    </div>
                  </div>
                </div>
              </div>

              {/* Pre-Flight Diagnostic Evaluation (if tested) */}
              {selectedNode.diagnosticState !== 'untested' && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono">
                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                    <span>Pre-Flight Diagnostic Probe</span>
                  </div>
                  {selectedNode.diagnosticQuestion && (
                    <p className="text-xs text-slate-300 font-medium">
                      Q: {selectedNode.diagnosticQuestion}
                    </p>
                  )}
                  {selectedNode.diagnosticState === 'passed' ? (
                    <div className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Schema Intact • Answered correctly prior to study</span>
                    </div>
                  ) : (
                    <div className="text-rose-400 text-xs font-medium space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Attention Gap Detected in Pre-Test</span>
                      </div>
                      {selectedNode.diagnosticMissedReason && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          {selectedNode.diagnosticMissedReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mental Model */}
              {selectedNode.concept.mentalModel && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cognitive Mental Model (Analogy Anchor)</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-slate-200 leading-relaxed italic">
                    "{selectedNode.concept.mentalModel}"
                  </div>
                </div>
              )}

              {/* Core Takeaways */}
              {selectedNode.concept.coreTakeaways && selectedNode.concept.coreTakeaways.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Core Conceptual Takeaways</span>
                  </div>
                  <ul className="space-y-1.5">
                    {selectedNode.concept.coreTakeaways.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-xs">
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feynman Challenge Prompt */}
              {selectedNode.concept.feynmanPrompt && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Socratic Feynman Target Prompt</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-xs text-slate-300 leading-relaxed">
                    {selectedNode.concept.feynmanPrompt}
                  </div>
                </div>
              )}

              {/* Retrieval Cards Summary */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Retrieval Cards ({selectedNode.concept.retrievalCards.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {selectedNode.concept.retrievalCards.slice(0, 4).map((card, idx) => (
                    <div key={card.id} className="p-3 rounded-xl bg-slate-950/50 border border-white/[0.05] flex items-center justify-between gap-3 text-xs">
                      <div className="truncate flex-1 font-medium text-slate-300">
                        {idx + 1}. <MathRenderer text={fillCloze(card.question)} />
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {card.stability ? `S: ${card.stability.toFixed(1)}d` : 'New'}
                      </span>
                    </div>
                  ))}
                  {selectedNode.concept.retrievalCards.length > 4 && (
                    <div className="text-center text-[11px] text-slate-500 font-mono">
                      + {selectedNode.concept.retrievalCards.length - 4} more retrieval cards
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => {
                  setSelectedNode(null);
                  if (onOpenDeckStation) {
                    onOpenDeckStation(selectedNode.session);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/[0.08] flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Deck Station</span>
              </button>

              <button
                onClick={() => {
                  handleLaunchTargetDrill(selectedNode);
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Launch Micro-Drill for this Concept</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
