import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Fetch on mount, refetch when the screen regains focus; `refresh` powers pull-to-refresh. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const first = useRef(true);

  const run = useCallback(async () => {
    try { setData(await loadRef.current()); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);

  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    run();
  }, [run]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  return { data, setData, error, refreshing, refresh, reload: run };
}
