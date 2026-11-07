import { expect, test } from "@playwright/test";
test("build, rotate, reject overlap, remove, save and restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("credits")).toHaveText("1,200");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.getByRole("button", { name: "Sky apartments, 240 coins" }).click();
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByText("Keyboard & accessible tile controls").click();
  await page.getByLabel("Tile column").fill("1");
  await page.getByLabel("Tile row").fill("1");
  await page.getByRole("button", { name: "Apply tool to tile" }).click();
  await expect(page.getByTestId("credits")).toHaveText("960");
  await page.getByRole("button", { name: "Apply tool to tile" }).click();
  await expect(page.getByText("This space is already occupied.")).toBeVisible();
  await page.getByRole("button", { name: "Close help" }).click();
  await page.getByRole("button", { name: "Remove", exact: false }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByText("Keyboard & accessible tile controls").click();
  await page.getByLabel("Tile column").fill("2");
  await page.getByRole("button", { name: "Apply tool to tile" }).click();
  await expect(page.getByTestId("credits")).toHaveText("1,080");
  await expect(page.getByText("All changes saved")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("credits")).toHaveText("1,080");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("canvas placement and drag controls work without scroll overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("credits")).toHaveText("1,200");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.getByRole("button", { name: "Garden path, 5 coins" }).click();
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  // Sweep visible grid points until one empty tile is hit; this exercises real Babylon picking.
  for (const x of [0.4, 0.5, 0.6, 0.3]) {
    for (const y of [0.48, 0.55, 0.4, 0.62]) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
      if ((await page.getByTestId("credits").innerText()) !== "1,200") break;
    }
    if ((await page.getByTestId("credits").innerText()) !== "1,200") break;
  }
  await expect(page.getByTestId("credits")).toHaveText("1,195");
  await page.mouse.move(box.width * 0.5, box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.width * 0.6, box.height * 0.55, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId("credits")).toHaveText("1,195");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("touch tap builds and a two-finger pinch does not build", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "mobile",
    "Touch gesture regression uses the mobile viewport.",
  );
  await page.goto("/");
  await expect(page.getByTestId("credits")).toHaveText("1,200");
  await page.getByRole("button", { name: "Pause simulation" }).tap();
  await page.getByRole("button", { name: "Garden path, 5 coins" }).tap();
  const box = (await page.locator("canvas").boundingBox())!;
  for (const x of [0.4, 0.5, 0.6]) {
    for (const y of [0.48, 0.55, 0.4, 0.62]) {
      await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y);
      if ((await page.getByTestId("credits").innerText()) !== "1,200") break;
    }
    if ((await page.getByTestId("credits").innerText()) !== "1,200") break;
  }
  await expect(page.getByTestId("credits")).toHaveText("1,195");
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height * 0.5;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 160, y, id: 1 },
      { x: 240, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 130, y, id: 1 },
      { x: 270, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByTestId("credits")).toHaveText("1,195");
});
