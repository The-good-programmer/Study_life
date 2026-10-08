/** "+15%" for a bonus of 0.15. */
export const formatBonus = (bonus: number): string => `+${Math.round(bonus * 100)}%`;

/** "×1.15" for a pay multiplier, without trailing zeros. */
export const formatMultiplier = (multiplier: number): string => `×${Number(multiplier.toFixed(2))}`;

/** "12 min left" or "1 h 5 min left" until an ISO time; "ending" in its last minute. */
export const formatTimeLeft = (endsAt: string, now: number): string => {
  const minutes = Math.floor((new Date(endsAt).getTime() - now) / 60000);
  if (minutes < 1) return 'ending';
  if (minutes < 60) return `${minutes} min left`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''} left`;
};
