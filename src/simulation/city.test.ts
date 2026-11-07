import { describe, expect, it } from "vitest";
import {
  advance,
  buildingAt,
  cells,
  footprint,
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
  materials: { wood: 500, crystal: 250 },
  population: 0,
  name: "Test",
  credits: 1000,
  tick: 0,
  nextId: 1,
  buildings: [],
});
describe("city rules", () => {
  it("places rotated rectangular footprints and charges once", () => {
    const city = place(empty(), "tower", 2, 3, 1);
    expect(city.credits).toBe(760);
    expect(footprint("tower", 1)).toEqual([2, 1]);
    expect(cells(city.buildings[0])).toEqual([
      { x: 2, z: 3 },
      { x: 3, z: 3 },
    ]);
    expect(buildingAt(city, 3, 3)?.id).toBe(1);
    expect(place(city, "cottage", 3, 3, 0)).toBe(city);
    expect(empty().buildings).toHaveLength(0);
  });
  it("rejects boundary crossings, fractional coordinates, occupied cells and unaffordable builds", () => {
    for (const [x, z] of [
      [-1, 0],
      [12, 0],
      [0.5, 0],
      [NaN, 1],
      [11, 11],
    ])
      expect(placementError(empty(), "market", x, z, 0)).toBeTruthy();
    expect(place(empty(), "tower", 11, 10, 0).buildings).toHaveLength(1);
    expect(place(empty(), "tower", 11, 10, 1).buildings).toHaveLength(0);
    expect(
      place({ ...empty(), credits: 79 }, "cottage", 0, 0, 0).buildings,
    ).toHaveLength(0);
  });
  it("removes by any occupied cell, refunds half, and never recycles ids", () => {
    const city = place(empty(), "market", 0, 0, 0);
    const removed = remove(city, 1, 0);
    expect(removed.credits).toBe(910);
    expect(removed.buildings).toHaveLength(0);
    expect(remove(removed, 1, 0)).toBe(removed);
    expect(place(removed, "garden", 0, 0, 0).buildings[0].id).toBe(2);
  });
  it("advances deterministically with derived population and income", () => {
    const city = place(place(empty(), "cottage", 0, 0, 0), "turbine", 1, 0, 0);
    expect(stats(city)).toMatchObject({
      population: 0,
      capacity: 4,
      income: 8,
      happiness: 55,
      generated: 12,
      demand: 1,
    });
    expect(advance(city)).toEqual({
      ...city,
      credits: city.credits + 8,
      tick: 1,
    });
    expect(city.tick).toBe(0);
  });
  it("round-trips the starter city and rejects invalid save records", () => {
    const city = newCity();
    expect(parseCity(JSON.parse(JSON.stringify(city)))).toEqual(city);
    for (const bad of [
      null,
      { ...city, version: 3 },
      { ...city, credits: -1 },
      { ...city, nextId: 1 },
      { ...city, tick: 1.5 },
      { ...city, buildings: [...city.buildings, city.buildings[0]] },
      { ...city, buildings: [{ ...city.buildings[0], kind: "toString" }] },
      { ...city, buildings: [{ ...city.buildings[0], rotation: 8 }] },
      { ...city, buildings: [{ ...city.buildings[0], x: 12 }] },
    ])
      expect(() => parseCity(bad)).toThrow();
  });
});
