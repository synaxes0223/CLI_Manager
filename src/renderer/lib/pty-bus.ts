type DataHandler = (data: string) => void;
const handlers = new Map<string, DataHandler>();
let initialized = false;

function ensureListening() {
  if (initialized) return;
  initialized = true;
  window.api.onData(({ id, data }) => handlers.get(id)?.(data));
}

export const ptyBus = {
  subscribe(id: string, handler: DataHandler): () => void {
    ensureListening();
    handlers.set(id, handler);
    return () => handlers.delete(id);
  },
};
