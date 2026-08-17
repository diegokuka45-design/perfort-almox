import { useState, useEffect } from 'react';

/**
 * Hook genérico de debounce — retorna o valor atualizado
 * apenas após `delay` ms sem alterações.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
