import { useEffect, useState } from 'react';
import { AIService } from '../services/aiService';
import { AuthService } from '../services/authService';

/** Whether AI needs the student to sign in first, kept current as they sign in or out. */
export function useNeedsSignInForAi(): boolean {
  const [needsSignIn, setNeedsSignIn] = useState(() => AIService.needsSignIn());
  useEffect(() => {
    const recheck = () => setNeedsSignIn(AIService.needsSignIn());
    const unsubscribe = AuthService.subscribe(recheck);
    // A key added in Settings counts when the student comes back to the page.
    window.addEventListener('focus', recheck);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', recheck);
    };
  }, []);
  return needsSignIn;
}
