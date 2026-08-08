import { useCallback, useState } from 'react';

export interface AsyncAction<TResult> {
  readonly running: boolean;
  readonly error: string | null;
  readonly result: TResult | null;
  run(): Promise<TResult>;
  reset(): void;
}

export const useAsyncAction = <TResult>(fn: () => Promise<TResult>): AsyncAction<TResult> => {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const run = useCallback(async (): Promise<TResult> => {
    setRunning(true);
    setError(null);
    try {
      const value = await fn();
      setResult(value);
      return value;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      throw cause;
    } finally {
      setRunning(false);
    }
  }, [fn]);

  const reset = useCallback(() => {
    setRunning(false);
    setError(null);
    setResult(null);
  }, []);

  return { running, error, result, run, reset };
};
