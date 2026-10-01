import { useState, useEffect } from 'react';
import type { StudySession, UserStats } from './types';
import { StorageService } from './services/storageService';
import { Navbar } from './components/layout/Navbar';
import { IngestionHub } from './components/ingestion/IngestionHub';
import { StudyPilot } from './components/cockpit/StudyPilot';
import { RetentionDashboard } from './components/dashboard/RetentionDashboard';
import { SettingsModal } from './components/settings/SettingsModal';

export function App() {
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [view, setView] = useState<'home' | 'dashboard'>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stats, setStats] = useState<UserStats>(StorageService.getStats());

  useEffect(() => {
    // Refresh stats when sessions finish or view changes
    setStats(StorageService.getStats());
  }, [activeSession, view]);

  const handleStartSession = (session: StudySession) => {
    setActiveSession(session);
  };

  const handleExitSession = () => {
    setActiveSession(null);
    setStats(StorageService.getStats());
  };

  const handleResetStats = () => {
    setStats(StorageService.getStats());
  };

  // If in an active study session, display the distraction-free Study Pilot Cockpit
  if (activeSession) {
    return (
      <StudyPilot
        initialSession={activeSession}
        onExit={handleExitSession}
        onOpenDashboard={() => {
          setActiveSession(null);
          setView('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d14] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        stats={stats}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDashboard={() => setView('dashboard')}
        onLogoClick={() => setView('home')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {view === 'home' ? (
          <IngestionHub
            onStartSession={handleStartSession}
            onOpenDashboard={() => setView('dashboard')}
          />
        ) : (
          <RetentionDashboard
            stats={stats}
            onBack={() => setView('home')}
            onStartSession={handleStartSession}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/60 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="font-medium text-slate-400">
            Studify — Grounded in Empirical Cognitive Science & Retrieval Dynamics
          </p>
          <p className="text-[11px] text-slate-600">
            Active Recall (Roediger & Karpicke, 2006) • Elaborative Interrogation (Dunlosky et al., 2013) • 40Hz Cortical Gamma Rhythms • FSRS Algorithm
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onStatsReset={handleResetStats}
      />
    </div>
  );
}

export default App;
