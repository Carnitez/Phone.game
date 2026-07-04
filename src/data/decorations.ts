export interface DecorationDef {
  id: string;
  name: string;
  cost: number;
  /** Reduction applied to the average wild-spawn interval while owned. */
  spawnIntervalReductionMs: number;
}

export const DECORATIONS: DecorationDef[] = [
  { id: 'flower-bed', name: 'Flower Bed', cost: 100, spawnIntervalReductionMs: 5 * 1000 },
  { id: 'pond-fountain', name: 'Pond Fountain', cost: 300, spawnIntervalReductionMs: 10 * 1000 },
  { id: 'shade-tree', name: 'Shade Tree', cost: 600, spawnIntervalReductionMs: 15 * 1000 },
];

export function getDecoration(id: string): DecorationDef {
  const decoration = DECORATIONS.find((d) => d.id === id);
  if (!decoration) throw new Error(`Unknown decoration id: ${id}`);
  return decoration;
}
