import { describe, it, expect, vi } from 'vitest';
import { createPtyManager } from '../pty-manager';

// node-pty is not available in the test runner (native module).
// Mock it at the module level.
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(cb => { (cb as Function)('hello'); }),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
}));

describe('createPtyManager', () => {
  it('create returns a string id', () => {
    const mgr = createPtyManager({ onData: vi.fn(), onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('create calls onData when PTY emits', () => {
    const onData = vi.fn();
    const mgr = createPtyManager({ onData, onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    expect(onData).toHaveBeenCalledWith(id, 'hello');
  });

  it('write calls pty.write', async () => {
    const { spawn } = await import('node-pty');
    const mgr = createPtyManager({ onData: vi.fn(), onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    mgr.write(id, 'ls\n');
    const mockPty = (spawn as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(mockPty.write).toHaveBeenCalledWith('ls\n');
  });

  it('destroy calls pty.kill', async () => {
    const { spawn } = await import('node-pty');
    const mgr = createPtyManager({ onData: vi.fn(), onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    mgr.destroy(id);
    const mockPty = (spawn as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(mockPty.kill).toHaveBeenCalled();
  });
});
