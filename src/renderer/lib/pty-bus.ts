type DataHandler = (data: string) => void;
const handlers = new Map<string, Set<DataHandler>>();
const buffers = new Map<string, string>();
const BUFFER_LIMIT = 65536; // 64 KB rolling window per terminal
let initialized = false;

function ensureListening() {
  if (initialized) return;
  initialized = true;
  window.api.onData(({ id, data }) => {
    const prev = buffers.get(id) ?? '';
    const next = prev + data;
    buffers.set(id, next.length > BUFFER_LIMIT ? next.slice(-BUFFER_LIMIT) : next);
    handlers.get(id)?.forEach(h => h(data));
  });
}

export const ptyBus = {
  subscribe(id: string, handler: DataHandler): () => void {
    ensureListening();
    if (!handlers.has(id)) handlers.set(id, new Set());
    handlers.get(id)!.add(handler);
    return () => handlers.get(id)?.delete(handler);
  },
  getBuffer(id: string): string {
    return buffers.get(id) ?? '';
  },
};
