const GAP = 6; // matches the existing grid gap in px

export function computePageSize(availableW: number, availableH: number, cols: number): number {
  const cellH = (availableW / cols) / 2; // target 2:1 aspect ratio per cell
  const maxRows = Math.max(1, Math.floor((availableH + GAP) / (cellH + GAP)));
  return cols * maxRows;
}
