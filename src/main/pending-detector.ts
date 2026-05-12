export interface PendingDetector {
  feed(data: string): void;
  onStatusChange(cb: (status: 'running' | 'pending') => void): void;
  destroy(): void;
}

const DEFAULT_PATTERNS: RegExp[] = [
  /claude\s*>\s*$/m,
  /^\?\s+.+/m,
  /\[y\/[Nn]\]\s*$/im,
  /\[Y\/n\]\s*$/m,
  /Password:\s*$/im,
  /Enter passphrase:\s*$/im,
];

const IDLE_TIMEOUT_MS = 10_000;

export function createPendingDetector(patterns = DEFAULT_PATTERNS): PendingDetector {
  let cb: ((s: 'running' | 'pending') => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let current: 'running' | 'pending' | null = null;

  function emit(s: 'running' | 'pending') {
    if (current === s) return;
    current = s;
    cb?.(s);
  }

  function resetTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => emit('pending'), IDLE_TIMEOUT_MS);
  }

  return {
    feed(data) {
      const matchesPending = patterns.some(p => p.test(data));
      if (matchesPending) {
        if (current !== 'pending') {
          emit('running');
        }
        if (timer) clearTimeout(timer);
        timer = null;
        emit('pending');
      } else {
        emit('running');
        resetTimer();
      }
    },
    onStatusChange(handler) {
      cb = handler;
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      cb = null;
    },
  };
}
