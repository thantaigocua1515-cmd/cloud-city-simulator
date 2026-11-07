/** Data-only balance knobs. All rates are per 10-second simulation tick. */
export const ECONOMY = {
  caps: { credits: 1_000_000, wood: 500, crystal: 250 },
  startingMaterials: { wood: 120, crystal: 40 },
  growthPerTick: 2,
  happinessForGrowth: 60,
  ticksPerDay: 24,
} as const;
export type Materials = { wood: number; crystal: number };
export type Definition = {
  name: string; cost: number; materials: Materials; size: readonly [number, number];
  people: number; income: number; energy: number; generation: number;
  production: Materials; consumption: Materials; happiness: number;
  color: string; category: string;
};
const define = (value: Partial<Definition> & Pick<Definition, 'name' | 'cost' | 'size' | 'color' | 'category'>): Definition => ({
  materials: { wood: 0, crystal: 0 }, people: 0, income: 0, energy: 0, generation: 0,
  production: { wood: 0, crystal: 0 }, consumption: { wood: 0, crystal: 0 }, happiness: 0, ...value,
});
export const CATALOG = {
  cottage: define({ name: 'Cloud cottage', cost: 80, materials: { wood: 8, crystal: 0 }, size: [1, 1], people: 4, income: 6, energy: 1, color: '#e9b08e', category: 'Homes' }),
  tower: define({ name: 'Sky apartments', cost: 240, materials: { wood: 20, crystal: 2 }, size: [1, 2], people: 16, income: 18, energy: 4, color: '#e8d5b5', category: 'Homes' }),
  garden: define({ name: 'Pocket garden', cost: 40, materials: { wood: 2, crystal: 0 }, size: [1, 1], income: 1, happiness: 4, color: '#88aa80', category: 'Nature' }),
  turbine: define({ name: 'Wind keeper', cost: 140, materials: { wood: 8, crystal: 2 }, size: [1, 1], income: 10, generation: 12, color: '#b8ccd0', category: 'Utilities' }),
  market: define({ name: 'Corner market', cost: 180, materials: { wood: 10, crystal: 0 }, size: [2, 1], people: 2, income: 16, energy: 3, color: '#d39b74', category: 'Services' }),
  path: define({ name: 'Garden path', cost: 5, size: [1, 1], color: '#c9c6af', category: 'Nature' }),
  lumberMill: define({ name: 'Sky Lumber Mill', cost: 120, materials: { wood: 10, crystal: 0 }, size: [2, 1], energy: 2, production: { wood: 8, crystal: 0 }, color: '#b68d62', category: 'Industry' }),
  harvester: define({ name: 'Crystal Harvester', cost: 160, materials: { wood: 12, crystal: 4 }, size: [1, 2], energy: 4, production: { wood: 0, crystal: 3 }, consumption: { wood: 1, crystal: 0 }, color: '#9c9ac5', category: 'Industry' }),
  powerPlant: define({ name: 'Crystal Power Plant', cost: 260, materials: { wood: 16, crystal: 8 }, size: [2, 2], generation: 24, consumption: { wood: 0, crystal: 1 }, color: '#7e9eac', category: 'Utilities' }),
  plaza: define({ name: 'Cloud Plaza', cost: 150, materials: { wood: 10, crystal: 2 }, size: [2, 2], energy: 2, happiness: 12, color: '#c7b995', category: 'Services' }),
} as const;
export type BuildingKind = keyof typeof CATALOG;
export const LEGACY_KINDS: readonly string[] = ['cottage', 'tower', 'garden', 'turbine', 'market', 'path'];
