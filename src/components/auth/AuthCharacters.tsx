'use client';

import React from 'react';
import { MascotScene, MascotState } from '@/components/mascots';

export type AuthInteractionState = MascotState;

interface AuthCharactersProps {
  state: AuthInteractionState;
  className?: string;
}

export const AuthCharacters: React.FC<AuthCharactersProps> = ({
  state,
  className = '',
}) => {
  return <MascotScene state={state} className={className} />;
};

export default AuthCharacters;
