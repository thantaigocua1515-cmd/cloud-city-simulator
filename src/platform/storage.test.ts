import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { IndexedDBSaveStore } from "./storage";
import { advance, newCity } from "../simulation/city";
it("returns null for a new database and restores the newest committed snapshot", async () => {
  const name = `test-${Math.random()}`;
  const store = new IndexedDBSaveStore(name);
  expect(await store.load()).toBeNull();
  const city = newCity();
  await store.save(city);
  await store.save(advance(city));
  expect(await new IndexedDBSaveStore(name).load()).toEqual(advance(city));
});
it("rejects invalid writes and leaves the previous save intact", async () => {
  const store = new IndexedDBSaveStore(`test-${Math.random()}`);
  const city = newCity();
  await store.save(city);
  await expect(store.save({ ...city, credits: NaN })).rejects.toThrow();
  expect(await store.load()).toEqual(city);
});
it("surfaces corrupt data rather than silently replacing it", async () => {
  const name = `test-${Math.random()}`;
  const store = new IndexedDBSaveStore(name);
  await store.save(newCity());
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put({ version: 999 }, "primary");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  await expect(store.load()).rejects.toThrow();
});
it("serializes rapid edits and snapshots state at the time of the save call", async () => {
  const store = new IndexedDBSaveStore(`test-${Math.random()}`);
  const city = newCity();
  const first = store.save(city);
  const second = store.save(advance(city));
  city.credits = 0;
  await Promise.all([first, second]);
  expect((await store.load())?.credits).toBe(1258);
});
