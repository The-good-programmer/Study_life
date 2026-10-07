import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StudentEducationProfile, StudySession, UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import { StorageService } from '../../services/storageService';
import { buildSession, describeGenerationError, hasContent } from './deckGenerator';
import type { GenerationRequest } from './deckGenerator';

interface UseDeckGenerationOptions {
  /** Called with the saved session once generation succeeds. */
  onSessionReady: (session: StudySession) => void;
  /** Called after a new session has been saved, so the library list can refresh. */
  onSessionSaved?: () => void;
}

const profileFromUser = (user: UserAccount): StudentEducationProfile => ({
  age: user.age,
  country: user.country,
  grade: user.grade,
});

/**
 * Turns notes, topics and PDFs into study decks. It owns the "which grade are you?"
 * gate (a request waits until a profile exists), the loading state, and a visible
 * error when generation fails.
 */
export const useDeckGeneration = ({ onSessionReady, onSessionSaved }: UseDeckGenerationOptions) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [guestProfile, setGuestProfile] = useState<StudentEducationProfile | null>(() =>
    StorageService.getGuestEducationProfile(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<GenerationRequest | null>(null);

  useEffect(() => AuthService.subscribe(setCurrentUser), []);

  const effectiveProfile = useMemo(
    () => (currentUser ? profileFromUser(currentUser) : guestProfile),
    [currentUser, guestProfile],
  );

  const run = useCallback(
    async (request: GenerationRequest, profile: StudentEducationProfile) => {
      setError(null);
      setIsLoading(true);
      try {
        const session = await buildSession(request, profile);
        StorageService.saveSession(session);
        onSessionSaved?.();
        onSessionReady(session);
      } catch (err) {
        console.error(err);
        setError(describeGenerationError(err));
      } finally {
        setIsLoading(false);
      }
    },
    [onSessionReady, onSessionSaved],
  );

  /** Generates a deck now, or asks for the student's grade first if none is set. */
  const generate = useCallback(
    (request: GenerationRequest) => {
      if (!hasContent(request)) return;
      const user = AuthService.getCurrentUser();
      const profile = user ? profileFromUser(user) : guestProfile || StorageService.getGuestEducationProfile();
      if (!profile) {
        setPendingRequest(request);
        setIsProfileModalOpen(true);
        return;
      }
      void run(request, profile);
    },
    [guestProfile, run],
  );

  const saveProfile = useCallback(
    (profile: StudentEducationProfile) => {
      const user = AuthService.getCurrentUser();
      if (user) {
        AuthService.updateProfile(user.id, { country: profile.country, grade: profile.grade, age: profile.age });
      } else {
        StorageService.saveGuestEducationProfile(profile);
        setGuestProfile(profile);
      }
      setIsProfileModalOpen(false);

      if (pendingRequest) {
        const request = pendingRequest;
        setPendingRequest(null);
        void run(request, profile);
      }
    },
    [pendingRequest, run],
  );

  const closeProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
    setPendingRequest(null);
  }, []);

  return {
    isLoading,
    error,
    dismissError: () => setError(null),
    effectiveProfile,
    generate,
    profileModal: {
      isOpen: isProfileModalOpen,
      /** True when saving the profile will go on to generate the waiting deck. */
      willGenerate: pendingRequest !== null,
      open: () => setIsProfileModalOpen(true),
      close: closeProfileModal,
      save: saveProfile,
    },
  };
};
