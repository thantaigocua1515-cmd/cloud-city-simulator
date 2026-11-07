import { expect, test, type Page } from "@playwright/test";
import { newCity } from "../src/simulation/city";
async function frozenClock(page: Page) {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T00:00:01Z"));
}
async function apply(page: Page, name: string, col: number, row: number) {
  await page.getByRole("button", { name: new RegExp(`^${name},`) }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByText("Keyboard & accessible tile controls").click();
  await page.getByLabel("Tile column").fill(String(col));
  await page.getByLabel("Tile row").fill(String(row));
  await page.getByRole("button", { name: "Apply tool to tile" }).click();
  await page.getByRole("button", { name: "Close help" }).click();
}
async function readSave(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const req = indexedDB.open("cloud-city-simulator", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const r = db.transaction("saves").objectStore("saves").get("primary");
          r.onsuccess = () => {
            db.close();
            resolve(r.result);
          };
          r.onerror = () => reject(r.error);
        };
      }),
  );
}
test("new industry, fuel, growth, happiness and v2 save/reload", async ({
  page,
}) => {
  await frozenClock(page);
  await page.goto("/");
  await expect(page.getByTestId("credits")).toHaveText("1,200");
  await apply(page, "Sky Lumber Mill", 1, 1);
  await apply(page, "Crystal Harvester", 1, 3);
  await expect(page.getByTestId("power-status")).toContainText("SHORTAGE");
  await expect(page.getByTestId("happiness")).toHaveText("33%");
  await apply(page, "Crystal Power Plant", 1, 6);
  await apply(page, "Cloud Plaza", 9, 8);
  await expect(page.getByTestId("power-status")).toHaveText("Grid stable");
  await expect(page.getByTestId("credits")).toHaveText("510");
  await expect(page.getByTestId("wood")).toHaveText("72 / 500");
  await expect(page.getByTestId("crystal")).toHaveText("26 / 250");
  await page.clock.fastForward(10000);
  await expect(page.getByTestId("credits")).toHaveText("568");
  await expect(page.getByTestId("wood")).toHaveText("79 / 500");
  await expect(page.getByTestId("crystal")).toHaveText("28 / 250");
  await expect(page.getByTestId("population")).toHaveText("14 / 26");
  await page
    .getByRole("button", { name: "Explain city economy and happiness" })
    .click();
  await expect(
    page.getByRole("region", { name: "City economy explanation" }),
  ).toContainText("Powered plazas");
  await page.getByRole("button", { name: "Close economy explanation" }).click();
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.clock.fastForward(500);
  await expect(page.getByText("All changes saved")).toBeVisible();
  const saved = await readSave(page);
  expect(saved).toMatchObject({ version: 2, population: 14, tick: 1 });
  await page.reload();
  await expect(page.getByTestId("credits")).toHaveText("568");
  await expect(page.getByTestId("wood")).toHaveText("79 / 500");
  expect(await readSave(page)).toEqual(saved);
});
test("migrates a v1 save and changes day/night without replacing building GPU buffers", async ({
  page,
}) => {
  await frozenClock(page);
  const legacy = {
    version: 1,
    name: "Legacy Isle",
    credits: 777,
    tick: 11,
    nextId: 50,
    buildings: [
      { id: 7, kind: "cottage", x: 0, z: 0, rotation: 0 },
      { id: 12, kind: "turbine", x: 2, z: 2, rotation: 0 },
    ],
  };
  // Start on the app origin and write a fixture before the application mounts.
  await page.route("**/src/main.tsx", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("cloud-city-simulator", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("saves");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").put(value, "primary");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, legacy);
  await page.unroute("**/src/main.tsx");
  await page.addInitScript(() => {
    const tracker = window as unknown as { gpuBuffers: number };
    tracker.gpuBuffers = 0;
    for (const ctor of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const original = ctor.prototype.createBuffer;
      ctor.prototype.createBuffer = function () {
        tracker.gpuBuffers++;
        return original.call(this);
      };
    }
  });
  await page.reload();
  await expect(page.getByTestId("credits")).toHaveText("777");
  await expect(page.getByTestId("population")).toHaveText("4 / 4");
  await expect(page.getByTestId("wood")).toHaveText("120 / 500");
  await page.clock.fastForward(1000);
  expect(await readSave(page)).toMatchObject({
    ...legacy,
    version: 2,
    population: 4,
    materials: { wood: 120, crystal: 40 },
  });
  expect(
    await page
      .locator("canvas")
      .evaluate(
        (c) => c instanceof HTMLCanvasElement && !!c.getContext("webgl2"),
      ),
  ).toBe(true);
  const before = await page.evaluate(
    () => (window as unknown as { gpuBuffers: number }).gpuBuffers,
  );
  expect(before).toBeGreaterThan(0);
  await page.clock.fastForward(10000);
  await expect(page.getByTestId("city")).toHaveClass(/night/);
  await expect(page.getByTestId("credits")).toHaveText("785");
  expect(
    await page.evaluate(
      () => (window as unknown as { gpuBuffers: number }).gpuBuffers,
    ),
  ).toBe(before);
});
test("blocks material-poor construction and preserves unsupported saves until explicit replacement", async ({
  page,
}) => {
  await frozenClock(page);
  const poor = { ...newCity(), materials: { wood: 0, crystal: 0 } };
  await page.route("**/src/main.tsx", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("cloud-city-simulator", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("saves");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").put(value, "primary");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, poor);
  await page.unroute("**/src/main.tsx");
  await page.reload();
  await expect(page.getByTestId("credits")).toHaveText("1,200");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await apply(page, "Sky Lumber Mill", 1, 1);
  await expect(page.getByText("Need 10 Wood; you have 0.")).toBeVisible();
  await expect(page.getByTestId("credits")).toHaveText("1,200");
  await page.clock.fastForward(500);
  // A new document with no mounted app ensures no lifecycle callback can overwrite our fixture.
  await page.route("**/src/main.tsx", (route) => route.abort());
  await page.reload();
  await page.evaluate(async () => {
    const r = indexedDB.open("cloud-city-simulator", 1);
    await new Promise<void>((resolve) => {
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").put(
          { version: 999, marker: "keep-me" },
          "primary",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  });
  await page.unroute("**/src/main.tsx");
  await page.reload();
  await expect(page.getByText("Save unavailable")).toBeVisible();
  await page.clock.fastForward(20000);
  expect(await readSave(page)).toEqual({ version: 999, marker: "keep-me" });
  await page.getByRole("button", { name: "Enable / retry saving" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();
  expect(await readSave(page)).toMatchObject({ version: 2 });
});
