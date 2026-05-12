export type TerminalStatus = 'idle' | 'running' | 'pending';

export interface TerminalState {
  id: string;
  path: string;
  title?: string;
  status: TerminalStatus;
  exitCode?: number;
}

export const IPC = {
  PTY_CREATE:  'pty:create',
  PTY_CREATED: 'pty:created',
  PTY_INPUT:   'pty:input',
  PTY_RESIZE:  'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_DATA:    'pty:data',
  PTY_STATUS:  'pty:status',
  PTY_EXIT:    'pty:exit',
  DIALOG_BROWSE:   'dialog:browse-folder',
  CLIPBOARD_READ:  'clipboard:read',
  CLIPBOARD_WRITE: 'clipboard:write',
} as const;

export interface PtyCreatePayload  { path: string; title?: string }
export interface PtyCreatedPayload { id: string }
export interface PtyInputPayload   { id: string; data: string }
export interface PtyResizePayload  { id: string; cols: number; rows: number }
export interface PtyDestroyPayload { id: string }
export interface PtyDataPayload    { id: string; data: string }
export interface PtyStatusPayload  { id: string; status: TerminalStatus }
export interface PtyExitPayload    { id: string; code: number }
