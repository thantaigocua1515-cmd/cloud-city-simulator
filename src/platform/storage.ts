import { parseCity, type City } from "../simulation/city";
/** Replace this adapter for native storage without changing the simulation. */
export interface SaveStore {
  load(): Promise<City | null>;
  save(city: City): Promise<void>;
}
export class IndexedDBSaveStore implements SaveStore {
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly name = "cloud-city-simulator") {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Save database is blocked by another tab."));
    });
  }
  async load() {
    const db = await this.open();
    try {
      const raw = await new Promise<unknown>((resolve, reject) => {
        const request = db
          .transaction("saves")
          .objectStore("saves")
          .get("primary");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return raw === undefined ? null : parseCity(raw);
    } finally {
      db.close();
    }
  }
  save(city: City): Promise<void> {
    const snapshot = structuredClone(city);
    const result = this.writes.catch(() => {}).then(() => this.write(snapshot));
    this.writes = result;
    return result;
  }
  private async write(city: City) {
    const valid = parseCity(city);
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").put(valid, "primary");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("Save aborted."));
      });
    } finally {
      db.close();
    }
  }
}
