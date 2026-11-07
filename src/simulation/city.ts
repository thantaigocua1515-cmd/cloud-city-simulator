/** Pure, deterministic domain. No browser, renderer, timers, or storage imports. */
import { CATALOG, ECONOMY, LEGACY_KINDS, type BuildingKind, type Materials } from './catalog';
export { CATALOG, ECONOMY, type BuildingKind } from './catalog';
export const GRID_SIZE = 12;
export type Rotation = 0 | 1 | 2 | 3;
export type Building = {
  id: number;
  kind: BuildingKind;
  x: number;
  z: number;
  rotation: Rotation;
};
export type City = {
  version: 2;
  materials: Materials;
  population: number;
  name: string;
  credits: number;
  tick: number;
  nextId: number;
  buildings: Building[];
};
export type Cell = { x: number; z: number };
export function footprint(
  kind: BuildingKind,
  rotation: Rotation,
): readonly number[] {
  const [w, d] = CATALOG[kind].size;
  return rotation % 2 ? [d, w] : [w, d];
}
export function cells(
  b: Pick<Building, "kind" | "rotation" | "x" | "z">,
): Cell[] {
  const [w, d] = footprint(b.kind, b.rotation);
  return Array.from({ length: w * d }, (_, i) => ({
    x: b.x + (i % w),
    z: b.z + Math.floor(i / w),
  }));
}
function geometryError(city: Pick<City, 'buildings'>, kind: BuildingKind, x: number, z: number, rotation: Rotation): string | null {
  if (!Object.hasOwn(CATALOG, kind) || ![0, 1, 2, 3].includes(rotation)) return 'Invalid building blueprint.';
  if (!Number.isInteger(x) || !Number.isInteger(z)) return 'Choose a grid tile.';
  const area = cells({ kind, x, z, rotation });
  if (area.some(c => c.x < 0 || c.z < 0 || c.x >= GRID_SIZE || c.z >= GRID_SIZE)) return 'Keep the whole building on the island.';
  const occupied = new Set(city.buildings.flatMap(b => cells(b).map(c => `${c.x},${c.z}`)));
  if (area.some(c => occupied.has(`${c.x},${c.z}`))) return 'This space is already occupied.';
  return null;
}
export function placementError(city: City, kind: BuildingKind, x: number, z: number, rotation: Rotation): string | null {
  const invalid = geometryError(city, kind, x, z, rotation);
  if (invalid) return invalid;
  if (city.nextId >= Number.MAX_SAFE_INTEGER) return 'Building ID limit reached.';
  const spec = CATALOG[kind];
  if (city.credits < spec.cost) return 'You need more cloud coins.';
  if (city.materials.wood < spec.materials.wood) return `Need ${spec.materials.wood} Wood; you have ${city.materials.wood}.`;
  if (city.materials.crystal < spec.materials.crystal) return `Need ${spec.materials.crystal} Sky Crystal; you have ${city.materials.crystal}.`;
  return null;
}
export function place(
  city: City,
  kind: BuildingKind,
  x: number,
  z: number,
  rotation: Rotation,
): City {
  if (placementError(city, kind, x, z, rotation)) return city;
  return {
    ...city,
    credits: city.credits - CATALOG[kind].cost,
    materials: { wood: city.materials.wood - CATALOG[kind].materials.wood, crystal: city.materials.crystal - CATALOG[kind].materials.crystal },
    nextId: city.nextId + 1,
    buildings: [...city.buildings, { id: city.nextId, kind, x, z, rotation }],
  };
}
export function buildingAt(city: City, x: number, z: number) {
  return city.buildings.find((b) =>
    cells(b).some((c) => c.x === x && c.z === z),
  );
}
export function remove(city: City, x: number, z: number): City {
  const b = buildingAt(city, x, z);
  if (!b) return city;
  const buildings = city.buildings.filter(v => v.id !== b.id);
  return { ...city, buildings, population: Math.min(city.population, capacity(buildings)),
    credits: Math.min(Number.MAX_SAFE_INTEGER, city.credits + Math.floor(CATALOG[b.kind].cost / 2)),
    materials: {
      wood: Math.min(ECONOMY.caps.wood, city.materials.wood + Math.floor(CATALOG[b.kind].materials.wood / 2)),
      crystal: Math.min(ECONOMY.caps.crystal, city.materials.crystal + Math.floor(CATALOG[b.kind].materials.crystal / 2)),
    },
  };
}
function capacity(buildings: readonly Building[]) { return buildings.reduce((sum, b) => sum + CATALOG[b.kind].people, 0); }
/** Forecast from start-of-tick resources. Generators reserve fuel first (ID order).
 * Brownouts stop all power consumers; passive buildings and fueled generators keep running.
 * Consumers spend inputs next (ID order); all production arrives at tick end. */
export function stats(city: City) {
  const ordered = [...city.buildings].sort((a, b) => a.id - b.id);
  const available = { ...city.materials };
  const active = new Set<number>();
  const fuelStarved: number[] = [];
  let generated = 0;
  const canSpend = (cost: Materials) => available.wood >= cost.wood && available.crystal >= cost.crystal;
  const spend = (cost: Materials) => { available.wood -= cost.wood; available.crystal -= cost.crystal; };
  for (const b of ordered) {
    const spec = CATALOG[b.kind];
    if (!spec.generation) continue;
    if (!canSpend(spec.consumption)) { fuelStarved.push(b.id); continue; }
    spend(spec.consumption); active.add(b.id); generated += spec.generation;
  }
  const demand = ordered.reduce((sum, b) => sum + CATALOG[b.kind].energy, 0);
  const shortage = generated < demand;
  for (const b of ordered) {
    const spec = CATALOG[b.kind];
    if (spec.generation || (spec.energy > 0 && shortage)) continue;
    if (!canSpend(spec.consumption)) { fuelStarved.push(b.id); continue; }
    spend(spec.consumption); active.add(b.id);
  }
  const gardens = Math.min(20, ordered.filter(b => b.kind === 'garden').length * CATALOG.garden.happiness);
  const plazas = Math.min(24, ordered.filter(b => b.kind === 'plaza' && active.has(b.id)).length * CATALOG.plaza.happiness);
  const housing = capacity(ordered);
  const crowding = housing > 0 && city.population * 10 > housing * 9 ? -10 : 0;
  const reasons = [{ label: 'Island spirit', value: 55 }, { label: 'Gardens (max +20)', value: gardens }, { label: 'Powered plazas (max +24)', value: plazas }, { label: 'Power shortage', value: shortage ? -30 : 0 }, { label: 'Housing above 90% occupied', value: crowding }];
  const happiness = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.value, 0)));
  const production = { wood: 0, crystal: 0 };
  let income = 0;
  for (const b of ordered) {
    if (!active.has(b.id)) continue;
    const spec = CATALOG[b.kind];
    income += happiness >= ECONOMY.happinessForGrowth ? spec.income : Math.floor(spec.income / 2);
    production.wood += spec.production.wood; production.crystal += spec.production.crystal;
  }
  const consumption = { wood: city.materials.wood - available.wood, crystal: city.materials.crystal - available.crystal };
  const nextMaterials = {
    wood: Math.min(ECONOMY.caps.wood, available.wood + production.wood),
    crystal: Math.min(ECONOMY.caps.crystal, available.crystal + production.crystal),
  };
  const growth = !shortage && happiness >= ECONOMY.happinessForGrowth ? Math.min(ECONOMY.growthPerTick, housing - city.population) : 0;
  return { population: city.population, capacity: housing, income, generated, demand, shortage,
    happiness, reasons, growth, production, consumption, nextMaterials, fuelStarved,
    pausedBuildings: ordered.length - active.size,
    net: { wood: nextMaterials.wood - city.materials.wood, crystal: nextMaterials.crystal - city.materials.crystal } };
}
export function advance(city: City): City {
  if (city.tick === Number.MAX_SAFE_INTEGER) return city;
  const next = stats(city);
  return { ...city, tick: city.tick + 1,
    credits: Math.min(Math.max(ECONOMY.caps.credits, city.credits), city.credits + next.income),
    materials: next.nextMaterials, population: city.population + next.growth };
}
export function newCity(): City {
  let city: City = {
    version: 2,
    materials: { wood: 500, crystal: 250 },
    population: 0,
    name: "Zephyr Isle",
    credits: 1500,
    tick: 0,
    nextId: 1,
    buildings: [],
  };
  for (const [kind, x, z, rotation] of [
    ["cottage", 4, 5, 0],
    ["cottage", 6, 5, 2],
    ["tower", 5, 3, 1],
    ["garden", 4, 4, 0],
    ["garden", 7, 5, 0],
    ["market", 5, 7, 0],
    ["turbine", 8, 3, 0],
    ["path", 5, 5, 0],
    ["path", 5, 6, 0],
    ["path", 6, 6, 0],
  ] as const)
    city = place(city, kind, x, z, rotation);
  return { ...city, credits: 1200, materials: { ...ECONOMY.startingMaterials }, population: 12 };
}
/** Validate before migration. v1 gains starter materials and its original resident count.
 * Keep the IndexedDB store/key unchanged; version describes the payload, not the database. */
export function parseCity(value: unknown): City {
  if (!value || typeof value !== 'object') throw new Error('Invalid save.');
  const c = value as City & { version: number };
  if (![1, 2].includes(c.version) || typeof c.name !== 'string' || c.name.length > 60 ||
    !Number.isSafeInteger(c.credits) || c.credits < 0 || !Number.isSafeInteger(c.tick) || c.tick < 0 ||
    !Number.isSafeInteger(c.nextId) || !Array.isArray(c.buildings) || c.buildings.length > 144) throw new Error('Unsupported or damaged save.');
  const buildings: Building[] = [];
  const ids = new Set<number>();
  for (const b of c.buildings) {
    if (!b || (Number(c.version) === 1 && !LEGACY_KINDS.includes(b.kind)) ||
      !Number.isSafeInteger(b.id) || b.id < 1 || ids.has(b.id) || geometryError({ buildings }, b.kind, b.x, b.z, b.rotation)) throw new Error('Invalid building in save.');
    ids.add(b.id); buildings.push({ id: b.id, kind: b.kind, x: b.x, z: b.z, rotation: b.rotation });
  }
  if (c.nextId <= Math.max(0, ...ids)) throw new Error('Invalid save sequence.');
  const migrated = Number(c.version) === 1;
  const materials = migrated ? { ...ECONOMY.startingMaterials } : c.materials;
  const population = migrated ? capacity(buildings) : c.population;
  if (!materials || !Number.isSafeInteger(materials.wood) || materials.wood < 0 || materials.wood > ECONOMY.caps.wood ||
    !Number.isSafeInteger(materials.crystal) || materials.crystal < 0 || materials.crystal > ECONOMY.caps.crystal ||
    !Number.isSafeInteger(population) || population < 0 || population > capacity(buildings)) throw new Error('Invalid resources or population in save.');
  return { version: 2, name: c.name, credits: c.credits, tick: c.tick, nextId: c.nextId, buildings, materials: { ...materials }, population };
}
