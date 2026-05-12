import { useState, useEffect } from 'react';
import { computePageSize } from '../lib/compute-page-size';

// Accepts a callback ref value (HTMLDivElement | null) so that the effect
// re-runs automatically when the grid container element mounts.
export function usePageSize(cols: number, gridEl: HTMLDivElement | null): number {
  const [pageSize, setPageSize] = useState(cols * 2);

  useEffect(() => {
    if (!gridEl) return;

    function compute() {
      setPageSize(computePageSize(gridEl!.clientWidth, gridEl!.clientHeight, cols));
    }

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [cols, gridEl]);

  return pageSize;
}
