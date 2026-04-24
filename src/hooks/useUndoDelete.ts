import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 3000;

/**
 * Stages a destructive action behind a timed undo window. If a new delete is
 * scheduled while one is pending, the previous action is committed first.
 */
export function useUndoDelete(durationMs = DEFAULT_DURATION_MS) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const commitRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runPendingCommit = useCallback(() => {
    const fn = commitRef.current;
    commitRef.current = null;
    clearTimer();
    fn?.();
  }, [clearTimer]);

  const scheduleDelete = useCallback(
    (msg: string, commit: () => void) => {
      if (commitRef.current) {
        runPendingCommit();
      }
      commitRef.current = commit;
      setMessage(msg);
      setVisible(true);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const fn = commitRef.current;
        commitRef.current = null;
        setVisible(false);
        setMessage('');
        fn?.();
      }, durationMs);
    },
    [clearTimer, durationMs, runPendingCommit],
  );

  const undo = useCallback(() => {
    clearTimer();
    commitRef.current = null;
    setVisible(false);
    setMessage('');
  }, [clearTimer]);

  /** Swipe snackbar away: same as letting the timer finish (delete is finalized). */
  const dismissAndCommit = useCallback(() => {
    runPendingCommit();
    setVisible(false);
    setMessage('');
  }, [runPendingCommit]);

  useEffect(
    () => () => {
      clearTimer();
      commitRef.current = null;
    },
    [clearTimer],
  );

  return { visible, message, scheduleDelete, undo, dismissAndCommit };
}
