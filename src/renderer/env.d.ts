import type {
  PtyCreatePayload, PtyCreatedPayload,
  PtyInputPayload, PtyResizePayload, PtyDestroyPayload,
  PtyDataPayload, PtyStatusPayload, PtyExitPayload,
} from '../types';

declare global {
  interface Window {
    api: {
      createPty:  (p: PtyCreatePayload)  => Promise<PtyCreatedPayload>;
      sendInput:  (p: PtyInputPayload)   => void;
      resizePty:  (p: PtyResizePayload)  => void;
      destroyPty: (p: PtyDestroyPayload) => void;
      browseFolder: () => Promise<string | null>;
      onData:   (cb: (p: PtyDataPayload)   => void) => () => void;
      onStatus: (cb: (p: PtyStatusPayload) => void) => () => void;
      onExit:   (cb: (p: PtyExitPayload)   => void) => () => void;
    };
  }
}
