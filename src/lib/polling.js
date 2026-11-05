import { useEffect, useRef } from 'react';

// A refresh that was skipped while the tab was hidden is due as soon as the visitor comes back.
export const dueOnReturn = (lastRun, now, interval) => now - lastRun >= interval;

// Runs callback every interval while the tab is visible, and once on return if a refresh came due while it was hidden.
export function usePoll(callback, interval, enabled = true) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    if (!enabled || !interval) return;
    let lastRun = Date.now();
    const run = () => { lastRun = Date.now(); latest.current(); };
    const timer = setInterval(() => { if (!document.hidden) run(); }, interval);
    const onVisible = () => { if (!document.hidden && dueOnReturn(lastRun, Date.now(), interval)) run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [interval, enabled]);
}
