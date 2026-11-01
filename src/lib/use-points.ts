'use client';
import { useCallback, useEffect, useState } from 'react';
import { list } from './api';
import type { PickupPoint } from './types';
export function usePoints(enabled = true) {
  const [points, setPoints] = useState<PickupPoint[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let alive = true; setLoading(true); setError('');
    (async () => {
      try { const all: PickupPoint[] = []; let page = 1; for (;;) { const result = await list<PickupPoint>('pickup-points', { page, pageSize: 100 }); all.push(...result.items); if (all.length >= result.total || !result.items.length || page >= 100) break; page++; } if (alive) setPoints(all); }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Unable to load pickup points.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [version, enabled]);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  return { points, error, loading, refresh };
}
