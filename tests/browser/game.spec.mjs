import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createSpatialLife } from "../../sim/spatial-life.mjs";
const previews = "test-results/previews";
test.beforeAll(() => mkdirSync(previews, { recursive: true }));
async function game(page, path = "/") {
  await page.goto(path);
  await page.waitForFunction(() => window.WorldGuardGame?.ready());
}
async function consoleAt(page, id) {
  if (!(await page.locator("#console").isVisible()))
    await page.locator("#openConsole").click();
  if (id) await page.locator("#" + id).scrollIntoViewIfNeeded();
}
async function pause(page) {
  if (
    await page.evaluate(
      () => document.getElementById("mode").textContent === "LIVE LEARNING",
    )
  )
    await page.locator("#quickPause").click();
}
async function closeConsole(page) {
  if (await page.locator("#console").isVisible())
    await page.locator("#closeConsole").click();
}
test("root opens a full-screen living 3D game; controls are overlays and training follows physical decisions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await game(page);
  await expect(page).toHaveURL(/play.html$/);
  await expect(page.locator("#console")).toBeHidden();
  const dimensions = await page.locator("#planet").boundingBox(),
    viewport = page.viewportSize();
  expect(dimensions.height).toBe(viewport.height);
  expect(dimensions.width).toBe(viewport.width);
  await page.waitForFunction(
    () => WorldGuardGame.getState().policy.updates > 0,
  );
  await pause(page);
  await page.evaluate(() => WorldGuardGame.setZoom(0));
  expect(await page.evaluate(() => WorldGuardGame.getCamera().level)).toBe(
    "planet",
  );
  await page.screenshot({ path: previews + "/earth-v04-desktop.png" });
  await page.evaluate(() => WorldGuardGame.setZoom(1));
  expect(
    await page.evaluate(() => WorldGuardGame.getCamera().distance),
  ).toBeCloseTo(1.2, 1);
  await consoleAt(page, "simSpeed");
  await page.locator("#simSpeed").selectOption("30");
  await page.locator("#follow").uncheck();
  await page.locator("#cityView").click();
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    WorldGuardGame.getState().actors.some((a) => a.moving),
  );
  await page.locator("#pause").click();
  const walker = await page.evaluate(
    () => WorldGuardGame.getState().actors.find((a) => a.moving).id,
  );
  await page.locator("#resident").selectOption(walker);
  await page.locator("#follow").uncheck();
  const before = await page.evaluate(() => ({
    target: WorldGuardGame.getCamera().target,
    actor: {
      ...WorldGuardGame.getState().actors.find(
        (a) => a.id === document.getElementById("resident").value,
      ),
    },
  }));
  await page.locator("#start").click();
  await page.waitForFunction((a) => {
    const n = WorldGuardGame.getState().actors.find((b) => b.id === a.id);
    return Math.hypot(n.x - a.x, n.z - a.z) > 0.1;
  }, before.actor);
  await page.locator("#pause").click();
  expect(await page.evaluate(() => WorldGuardGame.getCamera().target)).toEqual(
    before.target,
  );
  await page.locator("#follow").check();
  expect(await page.evaluate(() => WorldGuardGame.getCamera().tracking)).toBe(
    true,
  );
  const state = await page.evaluate(() => {
    const s = WorldGuardGame.getState();
    return {
      updates: s.policy.updates,
      records: s.records.length,
      turn: s.world.turn,
      frames: s.frames.length,
    };
  });
  await page.locator("#firstFrame").click();
  await expect(page.locator("#observations")).toHaveText("0");
  await page.locator("#replay").click();
  await page.waitForFunction(
    () => Number(document.getElementById("timeline").value) > 0,
  );
  await page.locator("#replay").click();
  expect(
    await page.evaluate(() => {
      const s = WorldGuardGame.getState();
      return {
        updates: s.policy.updates,
        records: s.records.length,
        turn: s.world.turn,
        frames: s.frames.length,
      };
    }),
  ).toEqual(state);
  await page.locator("#liveFrame").click();
  await page.locator("#evaluate").click();
  await expect(page.locator("#benchmark")).toContainText("0 training updates");
  await closeConsole(page);
  await page.locator("#hudOrbit").click();
  await page.screenshot({ path: previews + "/world-v04-desktop.png" });
  expect(errors).toEqual([]);
});
test("arbitrary coordinates, ground walking, jumping, free flight and streamed terrain work beyond the six districts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await game(page);
  await pause(page);
  await page.locator("#openTravel").click();
  await page.locator("#travelLat").fill("52");
  await page.locator("#travelLon").fill("10");
  await page.locator("#travelSubmit").click();
  await page.waitForFunction(
    () =>
      Math.abs(WorldGuardGame.getCamera().lat - 52) < 0.01 &&
      WorldGuardGame.getCamera().chunks === 49,
  );
  expect(await page.evaluate(() => WorldGuardGame.getCamera().city)).toBe(null);
  await page.locator("#hudWalk").click();
  await page.locator("#planet").focus();
  const start = await page.evaluate(() => WorldGuardGame.getCamera());
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyW");
  const walked = await page.evaluate(() => WorldGuardGame.getCamera());
  expect(
    Math.hypot(walked.lat - start.lat, walked.lon - start.lon),
  ).toBeGreaterThan(0.001);
  await page.waitForFunction(
    () => Math.abs(WorldGuardGame.getCamera().verticalVelocity) < 0.001,
  );
  await page.evaluate(() => {
    window.jumpPeak = WorldGuardGame.getCamera().altitude;
    document.getElementById("jump").addEventListener(
      "click",
      () => {
        const until = performance.now() + 1000;
        const sample = () => {
          window.jumpPeak = Math.max(
            window.jumpPeak,
            WorldGuardGame.getCamera().altitude,
          );
          if (performance.now() < until) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { once: true },
    );
  });
  await page.locator("#jump").click();
  await page.waitForFunction((h) => window.jumpPeak > h + 0.2, walked.altitude);
  await page.screenshot({ path: previews + "/terrain-v04-desktop.png" });
  await page.locator("#hudFly").click();
  const before = await page.evaluate(() => WorldGuardGame.getCamera());
  await page.locator("#planet").focus();
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyE");
  expect(
    (await page.evaluate(() => WorldGuardGame.getCamera())).altitude,
  ).toBeGreaterThan(before.altitude + 1);
  await page.evaluate(() => WorldGuardGame.travel(-10, 20, 0.43));
  await page.waitForTimeout(600);
  await page.locator("#hudFly").click();
  const revision = await page.evaluate(
    () => WorldGuardGame.getCamera().revision,
  );
  await page.locator("#planet").focus();
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    (r) => WorldGuardGame.getCamera().revision > r,
    revision,
  );
  await page.keyboard.up("KeyW");
  expect(
    (await page.evaluate(() => WorldGuardGame.getCamera())).chunks,
  ).toBeLessThanOrEqual(49);
  expect(errors).toEqual([]);
});
test("mobile touch pinch, actual joystick movement, landscape, keyboard and coordinate validation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await game(page);
  await pause(page);
  const cdp = await page.context().newCDPSession(page),
    rect = await page.locator("#planet").boundingBox();
  const touches = (d) => [
    { x: rect.width / 2 - d, y: rect.height * 0.45 },
    { x: rect.width / 2 + d, y: rect.height * 0.45 },
  ];
  const zoom = await page.evaluate(() => WorldGuardGame.getCamera().targetZoom);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: touches(30),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: touches(65),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    await page.evaluate(() => WorldGuardGame.getCamera().targetZoom),
  ).toBeGreaterThan(zoom);
  await page.locator("#hudWalk").click();
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => WorldGuardGame.getCamera()),
    stick = await page.locator("#joystick").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: stick.x + stick.width / 2, y: stick.y + 5 }],
  });
  await page.waitForTimeout(600);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const after = await page.evaluate(() => WorldGuardGame.getCamera());
  expect(
    Math.hypot(after.lat - before.lat, after.lon - before.lon),
  ).toBeGreaterThan(0.001);
  await page.waitForTimeout(250);
  const stopped = await page.evaluate(() => WorldGuardGame.getCamera());
  expect(stopped.lat).toBeCloseTo(after.lat, 4);
  expect(stopped.lon).toBeCloseTo(after.lon, 4);
  await page.screenshot({ path: previews + "/world-v04-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#openTravel").click();
  await page.locator("#travelLat").fill("99");
  await page.locator("#travelSubmit").click();
  await expect(page.locator("#travelLat")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#travelError")).toContainText("latitude");
  await page.keyboard.press("Escape");
  await expect(page.locator("#openTravel")).toBeFocused();
  await page.locator("#planet").focus();
  await page.keyboard.press("Home");
  expect(await page.evaluate(() => WorldGuardGame.getCamera().targetZoom)).toBe(
    0,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: previews + "/world-v04-landscape.png" });
  expect(await page.locator("#hudWalk").isVisible()).toBe(true);
});
test("placed blocks change the world, replay includes their creation, and checkpoints restore geometry and model", async ({
  page,
}) => {
  await game(page);
  await pause(page);
  await page.evaluate(() => WorldGuardGame.travel(52, 10, 0.66));
  await page.waitForTimeout(700);
  await page.locator("#hudBuild").click();
  await page.locator("#useTool").click();
  await page.waitForFunction(() => WorldGuardGame.getCamera().blocks === 1);
  const cp = await page.evaluate(() => WorldGuardGame.checkpoint());
  expect(cp.exploration.edits.length).toBe(1);
  await page.screenshot({ path: previews + "/building-v04-desktop.png" });
  await consoleAt(page, "firstFrame");
  await page.locator("#firstFrame").click();
  expect(await page.evaluate(() => WorldGuardGame.getCamera().blocks)).toBe(0);
  await page.locator("#liveFrame").click();
  expect(await page.evaluate(() => WorldGuardGame.getCamera().blocks)).toBe(1);
  await closeConsole(page);
  await page.locator("#undoBlock").click();
  expect(await page.evaluate(() => WorldGuardGame.getCamera().blocks)).toBe(0);
  await page.locator("#useTool").click();
  await page.waitForFunction(() => WorldGuardGame.getCamera().blocks === 1);
  await consoleAt(page, "save");
  await page.locator("#save").click();
  await expect(page.locator("#saveStatus")).toContainText(
    "Saved on this device",
  );
  const updates = await page.evaluate(
    () => WorldGuardGame.getState().policy.updates,
  );
  await page.reload();
  await page.waitForFunction(() => WorldGuardGame?.ready());
  await expect(page.locator("#mode")).toHaveText("PAUSED");
  expect(await page.evaluate(() => WorldGuardGame.getCamera().blocks)).toBe(1);
  expect(
    await page.evaluate(() => WorldGuardGame.getState().policy.updates),
  ).toBe(updates);
  await consoleAt(page, "import");
  await page.locator("#import").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"bad"}'),
  });
  await expect(page.locator("#saveStatus")).toContainText("Import failed");
  expect(await page.evaluate(() => WorldGuardGame.getCamera().blocks)).toBe(1);
  await page.locator("#newWorld").click();
  await expect(page.locator("#replaceDialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#newWorld")).toBeFocused();
});
test("checklist evidence opens the working game controls and preserved legacy labs remain usable", async ({
  page,
}) => {
  await game(page);
  await pause(page);
  for (const id of [
    "WG-036",
    "WG-038",
    "WG-042",
    "WG-051",
    "WG-056",
    "WG-057",
    "WG-058",
    "WG-059",
  ]) {
    await consoleAt(page, "settingsChecklist");
    await page.locator("#settingsChecklist").click();
    await page.locator("#requirementSearch").fill(id);
    await page.locator(".requirement-actions button").click();
    await expect(page.locator("#requirementsDialog")).toBeHidden();
  }
  await page.goto("/life.html");
  await expect(page.locator("#viewerLoading")).toBeHidden();
  await page.locator("#train").click();
  await expect(page.locator("#statPolicy")).toHaveText("ON");
  await page.locator("#step").click();
  await expect(page.locator("#statTurns")).toHaveText("1");
  await page.goto("/infrastructure.html");
  await page.locator("#step").click();
  await expect(page.locator("#turn")).toContainText("1");
});
test("WebGL failure presents recovery controls and never starts hidden training", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" || type === "webgl"
        ? null
        : original.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#startup")).toContainText("3D could not start");
  expect(
    await page.evaluate(() => WorldGuardGame.getState().policy.updates),
  ).toBe(0);
  await consoleAt(page);
  await expect(page.locator("#start")).toBeDisabled();
});
test("unavailable storage reports the failure and JSON recovery remains reachable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw Error("Storage blocked for test");
    };
  });
  await game(page);
  await consoleAt(page, "saveStatus");
  await expect(page.locator("#saveStatus")).toContainText(
    "Local storage unavailable",
  );
  await expect(page.locator("#export")).toBeEnabled();
  await expect(page.locator("#import")).toBeEnabled();
});
test("an actual resident request pauses the living world until explicit human review", async ({
  page,
}) => {
  const r = createSpatialLife({ population: 1 });
  r.act("wake");
  r.act("complete");
  r.prepare();
  for (let i = 0; i < 200 && !r.state().ready; i++)
    r.advance(0.25, { auto: false });
  r.act("test_fix");
  r.act("verify");
  r.prepare();
  for (let i = 0; i < 200 && !r.state().ready; i++)
    r.advance(0.25, { auto: false });
  r.act("approval");
  await game(page);
  await consoleAt(page, "import");
  await page.locator("#import").setInputFiles({
    name: "review.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(r.exportCheckpoint())),
  });
  await expect(page.locator("#runStatus")).toContainText("Imported checkpoint");
  await closeConsole(page);
  await expect(page.locator("#quickPause")).toHaveText("Review");
  const before = await page.evaluate(() => ({
    time: WorldGuardGame.getState().time,
    updates: WorldGuardGame.getState().policy.updates,
  }));
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => ({
      time: WorldGuardGame.getState().time,
      updates: WorldGuardGame.getState().policy.updates,
    })),
  ).toEqual(before);
  await page.locator("#quickPause").click();
  await expect(page.locator("#reviewPanel")).toBeVisible();
  await page.locator("#deny").click();
  expect(
    await page.evaluate(() => WorldGuardGame.getState().world.pending),
  ).toBe(null);
  expect(
    await page.evaluate(
      () => WorldGuardGame.getState().world.metrics.approvals,
    ),
  ).toBe(0);
});
