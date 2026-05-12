import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPendingDetector } from '../pending-detector';

describe('createPendingDetector', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits running on first data', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('some output\n');
    expect(cb).toHaveBeenCalledWith('running');
  });

  it('emits pending on claude prompt', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('claude >');
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('emits pending on [y/N]', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('Continue? [y/N]');
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('emits pending on ? prefix', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('? Select an option');
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('emits pending after idle timeout', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('watching...\n');
    vi.advanceTimersByTime(10000);
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('does not emit pending before idle timeout elapses', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('watching...\n');
    vi.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalledWith('pending');
  });

  it('resets to running when new data arrives after pending', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('claude >');
    det.feed('yes\n');
    expect(cb).toHaveBeenLastCalledWith('running');
  });

  it('does not emit duplicate status', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('claude >');
    det.feed('claude >'); // same status — should not re-emit
    expect(cb).toHaveBeenCalledTimes(1); // pending only once; no duplicate emission
  });

  it('destroy clears timer', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('some output\n');
    cb.mockClear();
    det.destroy();
    // should not throw or emit after destroy
    vi.advanceTimersByTime(15000);
    expect(cb).not.toHaveBeenCalled();
  });
});
