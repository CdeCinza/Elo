'use client';

import { useEffect, useRef } from 'react';

/**
 * Executa `onEscape` quando a tecla Esc é pressionada enquanto `isActive` for verdadeiro.
 */
export function useEscapeKey(isActive: boolean, onEscape: () => void): void {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscapeRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);
}
