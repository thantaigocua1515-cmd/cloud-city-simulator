/** Pure, deterministic domain. No browser, renderer, timers, or storage imports. */
export const GRID_SIZE = 12;
export const CATALOG = {
  cottage: {
    name: "Cloud cottage",
    cost: 80,
    size: [1, 1],
    people: 4,
    income: 6,
    color: "#e9b08e",
    category: "Homes",
  },
  tower: {
    name: "Sky apartments",
    cost: 240,
    size: [1, 2],
    people: 16,
    income: 18,
    color: "#e8d5b5",
    category: "Homes",
  },
  garden: {
    name: "Pocket garden",
    cost: 40,
    size: [1, 1],
    people: 0,
    income: 1,
    color: "#88aa80",
    category: "Nature",
  },
  turbine: {
    name: "Wind keeper",
    cost: 140,
    size: [1, 1],
    people: 0,
    income: 10,
    color: "#b8ccd0",
    category: "Utilities",
  },
  market: {
    name: "Corner market",
    cost: 180,
    size: [2, 1],
    people: 2,
    income: 16,
    color: "#d39b74",
    category: "Services",
  },
  path: {
    name: "Garden path",
    cost: 5,
    size: [1, 1],
    people: 0,
    income: 0,
    color: "#c9c6af",
    category: "Nature",
  },
} as const;
export type BuildingKind = keyof typeof CATALOG;
export type Rotation = 0 | 1 | 2 | 3;
export type Building = {
  id: number;
  kind: BuildingKind;
  x: number;
  z: number;
  rotation: Rotation;
};
export type City = {
  version: 1;
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
export function placementError(
  city: City,
  kind: BuildingKind,
  x: number,
  z: number,
  rotation: Rotation,
): string | null {
  if (!Number.isInteger(x) || !Number.isInteger(z))
    return "Choose a grid tile.";
  const area = cells({ kind, x, z, rotation });
  if (
    area.some((c) => c.x < 0 || c.z < 0 || c.x >= GRID_SIZE || c.z >= GRID_SIZE)
  )
    return "Keep the whole building on the island.";
  const occupied = new Set(
    city.buildings.flatMap((b) => cells(b).map((c) => `${c.x},${c.z}`)),
  );
  if (area.some((c) => occupied.has(`${c.x},${c.z}`)))
    return "This space is already occupied.";
  if (city.credits < CATALOG[kind].cost) return "You need more cloud coins.";
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
  return b
    ? {
        ...city,
        credits: city.credits + Math.floor(CATALOG[b.kind].cost / 2),
        buildings: city.buildings.filter((v) => v.id !== b.id),
      }
    : city;
}
export function stats(city: City) {
  return city.buildings.reduce(
    (s, b) => ({
      population: s.population + CATALOG[b.kind].people,
      income: s.income + CATALOG[b.kind].income,
    }),
    { population: 0, income: 0 },
  );
}
export function advance(city: City): City {
  return {
    ...city,
    tick: city.tick + 1,
    credits: city.credits + stats(city).income,
  };
}
export function newCity(): City {
  let city: City = {
    version: 1,
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
  return { ...city, credits: 1200 };
}
/** Validate untrusted/versioned save data by replaying occupancy with unlimited funds. */
export function parseCity(value: unknown): City {
  if (!value || typeof value !== "object") throw new Error("Invalid save.");
  const c = value as City;
  if (
    c.version !== 1 ||
    typeof c.name !== "string" ||
    c.name.length > 60 ||
    !Number.isSafeInteger(c.credits) ||
    c.credits < 0 ||
    !Number.isSafeInteger(c.tick) ||
    c.tick < 0 ||
    !Number.isSafeInteger(c.nextId) ||
    !Array.isArray(c.buildings) ||
    c.buildings.length > 144
  )
    throw new Error("Unsupported or damaged save.");
  let replay: City = { ...c, credits: Number.MAX_SAFE_INTEGER, buildings: [] };
  const ids = new Set<number>();
  for (const b of c.buildings) {
    if (
      !b ||
      !Object.hasOwn(CATALOG, b.kind) ||
      ![0, 1, 2, 3].includes(b.rotation) ||
      !Number.isSafeInteger(b.id) ||
      b.id < 1 ||
      ids.has(b.id) ||
      placementError(replay, b.kind, b.x, b.z, b.rotation)
    )
      throw new Error("Invalid building in save.");
    ids.add(b.id);
    replay = {
      ...replay,
      buildings: [
        ...replay.buildings,
        { id: b.id, kind: b.kind, x: b.x, z: b.z, rotation: b.rotation },
      ],
    };
  }
  if (c.nextId <= Math.max(0, ...ids))
    throw new Error("Invalid save sequence.");
  return {
    version: 1,
    name: c.name,
    credits: c.credits,
    tick: c.tick,
    nextId: c.nextId,
    buildings: replay.buildings,
  };
}
