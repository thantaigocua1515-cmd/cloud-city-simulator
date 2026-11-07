import { describe, expect, it } from "vitest";
import {
  advance,
  CATALOG,
  ECONOMY,
  newCity,
  parseCity,
  place,
  placementError,
  remove,
  stats,
  type City,
} from "./city";
const empty = (): City => ({
  version: 2,
  name: "Rules",
  credits: 10000,
  materials: { wood: 500, crystal: 250 },
  population: 0,
  tick: 0,
  nextId: 1,
  buildings: [],
});
const industry = () =>
  place(
    place(place(empty(), "turbine", 0, 0, 0), "lumberMill", 1, 0, 0),
    "harvester",
    3,
    0,
    0,
  );
describe("resource economy", () => {
  it("charges all configured construction resources atomically and refunds half", () => {
    const original = empty();
    const city = place(original, "harvester", 1, 1, 0);
    expect(city).toMatchObject({
      credits: 9840,
      materials: { wood: 488, crystal: 246 },
    });
    expect(original.materials).toEqual({ wood: 500, crystal: 250 });
    expect(remove(city, 1, 2)).toMatchObject({
      credits: 9920,
      materials: { wood: 494, crystal: 248 },
      buildings: [],
    });
    for (const materials of [
      { wood: 0, crystal: 250 },
      { wood: 500, crystal: 0 },
    ]) {
      const poor = { ...original, materials };
      expect(placementError(poor, "harvester", 1, 1, 0)).toMatch(
        /Need .* (Wood|Sky Crystal)/,
      );
      expect(place(poor, "harvester", 1, 1, 0)).toBe(poor);
    }
  });
  it("produces and consumes from start-of-tick stock with capped outputs", () => {
    const city = { ...industry(), materials: { wood: 100, crystal: 20 } };
    expect(stats(city)).toMatchObject({
      production: { wood: 8, crystal: 3 },
      consumption: { wood: 1, crystal: 0 },
      net: { wood: 7, crystal: 3 },
    });
    expect(advance(city).materials).toEqual({ wood: 107, crystal: 23 });
    expect(
      advance({ ...city, materials: { wood: 499, crystal: 249 } }).materials,
    ).toEqual({ wood: 500, crystal: 250 });
    const noInput = { ...city, materials: { wood: 0, crystal: 0 } };
    expect(advance(noInput).materials).toEqual({ wood: 8, crystal: 0 }); // mill output cannot feed harvester until next tick
    expect(stats(noInput).fuelStarved).toEqual([3]);
  });
  it("caps coins without destroying migrated balances above the cap", () => {
    const city = { ...newCity(), credits: ECONOMY.caps.credits - 1 };
    expect(advance(city).credits).toBe(ECONOMY.caps.credits);
    expect(remove(city, 4, 5).credits).toBe(ECONOMY.caps.credits);
    expect(
      advance({ ...city, credits: ECONOMY.caps.credits + 99 }).credits,
    ).toBe(ECONOMY.caps.credits + 99);
  });
});
describe("power and residents", () => {
  it("pauses consumers and growth on shortage; funded generators restore service", () => {
    let city = newCity();
    city = place(city, "harvester", 0, 0, 0); // demand 13, supply 12
    expect(stats(city)).toMatchObject({
      shortage: true,
      generated: 12,
      demand: 13,
      growth: 0,
      happiness: 33,
      income: 5,
      production: { wood: 0, crystal: 0 },
    });
    const powered = place(city, "powerPlant", 0, 3, 0);
    expect(stats(powered)).toMatchObject({
      shortage: false,
      generated: 36,
      demand: 13,
      growth: 2,
      consumption: { wood: 1, crystal: 1 },
    });
    const dry = { ...powered, materials: { wood: 20, crystal: 0 } };
    expect(stats(dry)).toMatchObject({
      shortage: true,
      generated: 12,
      consumption: { wood: 0, crystal: 0 },
    });
    expect(advance(dry).materials).toEqual(dry.materials);
  });
  it("allocates scarce fuel by stable ID, independent of array ordering", () => {
    let city = place(
      place(empty(), "powerPlant", 0, 0, 0),
      "powerPlant",
      3,
      0,
      0,
    );
    city = { ...city, materials: { wood: 0, crystal: 1 } };
    expect(stats(city)).toMatchObject({ generated: 24, fuelStarved: [2] });
    expect(
      advance({ ...city, buildings: [...city.buildings].reverse() }),
    ).toMatchObject({
      ...advance(city),
      buildings: [...city.buildings].reverse(),
    });
  });
  it("explains happiness and applies growth, crowding and plaza effects", () => {
    const city = newCity();
    expect(stats(city)).toMatchObject({
      happiness: 63,
      growth: 2,
      population: 12,
      capacity: 26,
      income: 58,
    });
    expect(advance(city).population).toBe(14);
    const crowded = { ...city, population: 24 };
    expect(stats(crowded)).toMatchObject({
      happiness: 53,
      growth: 0,
      income: 28,
    });
    const plaza = place(crowded, "plaza", 0, 0, 0);
    expect(stats(plaza)).toMatchObject({ happiness: 65, growth: 2 });
    expect(stats(plaza).reasons.reduce((sum, r) => sum + r.value, 0)).toBe(65);
    expect(advance(plaza).population).toBe(26);
    expect(advance(advance(plaza)).population).toBe(26);
    expect(remove({ ...city, population: 26 }, 5, 3).population).toBe(10);
  });
  it("keeps long deterministic runs valid and non-negative", () => {
    let a = place(industry(), "powerPlant", 5, 0, 0);
    let b = structuredClone(a);
    for (let i = 0; i < 500; i++) {
      a = advance(a);
      b = advance(b);
      expect(parseCity(a)).toEqual(a);
    }
    expect(a).toEqual(b);
    expect(Object.keys(CATALOG)).toHaveLength(10);
  });
});
describe("save v2 migration", () => {
  const legacy = () => {
    const { materials: _m, population: _p, ...city } = newCity();
    return { ...city, version: 1, credits: 1234567, tick: 47, nextId: 100 };
  };
  it("migrates v1 without losing buildings, coins, time or IDs and is idempotent", () => {
    const v1 = legacy();
    const city = parseCity(v1);
    expect(city).toMatchObject({
      ...v1,
      version: 2,
      materials: ECONOMY.startingMaterials,
      population: 26,
    });
    expect(parseCity(city)).toEqual(city);
    expect(v1.version).toBe(1);
    expect(place(city, "path", 0, 0, 0).buildings.at(-1)?.id).toBe(100);
  });
  it("rejects damaged v1, unsupported versions and invalid v2 fields", () => {
    const v1 = legacy();
    const v2 = parseCity(v1);
    for (const corrupt of [
      { ...v1, credits: -1 },
      { ...v1, buildings: [...v1.buildings, v1.buildings[0]] },
      { ...v1, buildings: [{ ...v1.buildings[0], kind: "plaza" }] },
      { ...v2, version: 3 },
      { ...v2, materials: null },
      { ...v2, materials: { wood: 501, crystal: 0 } },
      { ...v2, materials: { wood: 0, crystal: NaN } },
      { ...v2, population: 27 },
      { ...v2, population: -1 },
      { ...v2, population: 0.5 },
      { ...v2, nextId: 1 },
    ])
      expect(() => parseCity(corrupt)).toThrow();
  });
});
