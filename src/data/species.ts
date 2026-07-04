export type Biome = 'meadow' | 'pond' | 'forest';

export interface SpeciesDef {
  id: string;
  name: string;
  biome: Biome;
}

/** MVP scope: 12 species across 3 biome groups, 4 species each. */
export const SPECIES: SpeciesDef[] = [
  { id: 'meadow-hoplet', name: 'Hoplet', biome: 'meadow' },
  { id: 'meadow-fluffen', name: 'Fluffen', biome: 'meadow' },
  { id: 'meadow-dandeling', name: 'Dandeling', biome: 'meadow' },
  { id: 'meadow-buzzit', name: 'Buzzit', biome: 'meadow' },
  { id: 'pond-glimmerfin', name: 'Glimmerfin', biome: 'pond' },
  { id: 'pond-puddlepup', name: 'Puddlepup', biome: 'pond' },
  { id: 'pond-lilypad', name: 'Lilypad', biome: 'pond' },
  { id: 'pond-ripplet', name: 'Ripplet', biome: 'pond' },
  { id: 'forest-mossling', name: 'Mossling', biome: 'forest' },
  { id: 'forest-thistuft', name: 'Thistuft', biome: 'forest' },
  { id: 'forest-barkbit', name: 'Barkbit', biome: 'forest' },
  { id: 'forest-glowl', name: 'Glowl', biome: 'forest' },
];

export function getSpecies(id: string): SpeciesDef {
  const species = SPECIES.find((s) => s.id === id);
  if (!species) throw new Error(`Unknown species id: ${id}`);
  return species;
}
