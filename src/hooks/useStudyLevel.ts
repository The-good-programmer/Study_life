import { useEffect, useState } from 'react';
import { StorageService } from '../services/storageService';

/** The learner's level and title from their XP, kept current as they study. */
export function useStudyLevel() {
  const [studyLevel, setStudyLevel] = useState(() => StorageService.getStudyLevel());

  useEffect(() => StorageService.addMutationListener(() => {
    const next = StorageService.getStudyLevel();
    setStudyLevel(prev => (prev.level === next.level && prev.title === next.title ? prev : next));
  }), []);

  return studyLevel;
}
