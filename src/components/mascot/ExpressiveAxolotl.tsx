import React from 'react';
import { UserAvatarBadge } from '../character/UserAvatarBadge';

export type AxolotlMood = 'happy' | 'cheering' | 'thinking' | 'sleeping' | 'celebrating' | 'curious' | 'zen';

export interface ExpressiveAxolotlProps {
  mood?: AxolotlMood;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
  accessory?: 'none' | 'crown' | 'cap' | 'headphones' | 'glasses';
  onClick?: () => void;
}

/**
 * Replaced Axolotl mascot with the User's Custom 3D Character Avatar.
 */
export const ExpressiveAxolotl: React.FC<ExpressiveAxolotlProps> = ({
  size = 'md',
  className = '',
  onClick,
}) => {
  return (
    <UserAvatarBadge
      size={size}
      className={className}
      onClick={onClick}
    />
  );
};
