import React, { Suspense, lazy } from 'react';
import { Box } from 'lucide-react';
import type { StudySession } from '../../types';

const HomeDesign3D = lazy(() => import('../lifesim/HomeDesign3D'));

/** Shown while the 3D engine loads (it is a large download). */
const CampusLoading = () => (
  <div className="flex h-full min-h-[500px] w-full flex-1 flex-col items-center justify-center gap-4 bg-canvas p-8 text-center" role="status">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
      <Box className="h-6 w-6 animate-pulse" aria-hidden="true" />
    </span>
    <div>
      <p className="text-[15px] font-semibold text-ink">Building your campus</p>
      <p className="mt-1 text-[13px] text-ink-subtle">Loading the 3D view…</p>
    </div>
  </div>
);

export interface AxolotlStudyHabitatProps {
  onStartSession: (session: StudySession) => void;
  onOpenStarterCatalog: () => void;
  onToggleMobileSidebar?: () => void;
}

/** Campus: your home, furnished and upgraded with what you earn by studying. */
export const AxolotlStudyHabitat: React.FC<AxolotlStudyHabitatProps> = ({ onStartSession, onOpenStarterCatalog, onToggleMobileSidebar }) => (
  <div className="relative flex h-full w-full flex-1 overflow-hidden select-none animate-fadeIn">
    <Suspense fallback={<CampusLoading />}>
      <HomeDesign3D onStartSession={onStartSession} onOpenStarterCatalog={onOpenStarterCatalog} onToggleMobileSidebar={onToggleMobileSidebar} />
    </Suspense>
  </div>
);

export const StudyEstateCampus = AxolotlStudyHabitat;
export default AxolotlStudyHabitat;
