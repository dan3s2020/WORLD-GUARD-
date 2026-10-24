import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const previews = "test-results/previews";
test.beforeAll(() => mkdirSync(previews, { recursive: true }));
test("planet extrema, physical decisions, neural updates, immutable replay and persistent restore", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/play.html");
  await page.waitForFunction(() => window.WorldGuardGame?.ready());
  await expect(page.locator("#startup")).toBeHidden();
  await page.waitForFunction(() =>
    document.getElementById("saveStatus").textContent.includes("ready"),
  );
  expect(
    await page.evaluate(() => {
      WorldGuardGame.setZoom(0);
      return WorldGuardGame.getCamera().level;
    }),
  ).toBe("planet");
  expect(
    await page.evaluate(() => {
      WorldGuardGame.setZoom(1);
      return WorldGuardGame.getCamera().distance;
    }),
  ).toBeCloseTo(1.2, 1);
  await page.locator("#cityView").click();
  await page.waitForTimeout(400);
  await page.locator("#simSpeed").selectOption("30");
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    WorldGuardGame.getState().actors.some((a) => a.moving),
  );
  await page.locator("#pause").click();
  const walker=await page.evaluate(()=>WorldGuardGame.getState().actors.find(a=>a.moving)?.id);
  expect(walker).toBeTruthy();await page.locator('#resident').selectOption(walker);await page.evaluate(()=>WorldGuardGame.setZoom(.86));await page.locator('#follow').uncheck();
  const frozen=await page.evaluate(()=>({target:WorldGuardGame.getCamera().target,actor:WorldGuardGame.getState().actors.find(a=>a.id===document.getElementById('resident').value)}));
  await page.locator('#start').click();await page.waitForFunction(({id,x,z})=>{const a=WorldGuardGame.getState().actors.find(a=>a.id===id);return Math.hypot(a.x-x,a.z-z)>.1;},frozen.actor);await page.locator('#pause').click();
  expect(await page.evaluate(()=>WorldGuardGame.getCamera().target)).toEqual(frozen.target);await page.locator('#follow').check();expect(await page.evaluate(()=>WorldGuardGame.getCamera().tracking)).toBe(true);
  const before = await page.evaluate(() => {
    const s = WorldGuardGame.getState();
    return {
      updates: s.policy.updates,
      records: s.records.length,
      turn: s.world.turn,
      frames: s.frames.length,
    };
  });
  expect(before.updates).toBeGreaterThan(0);
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
  ).toEqual(before);
  await page.locator("#liveFrame").click();
  await page.locator("#evaluate").click();
  await expect(page.locator("#benchmark")).toContainText("0 training updates");
  await page.locator("#save").click();
  await expect(page.locator("#saveStatus")).toContainText(
    "Saved on this device",
  );
  await page.reload();
  await page.waitForFunction(() =>
    document.getElementById("saveStatus").textContent.includes("Restored"),
  );
  expect(
    await page.evaluate(() => WorldGuardGame.getState().policy.updates),
  ).toBe(before.updates);
  await expect(page.locator("#mode")).toHaveText("PAUSED");
  await page.locator("#zoom").fill("0");
  await page.evaluate(() => WorldGuardGame.setZoom(0));
  await page.screenshot({
    path: join(previews, "worldguard-3d-planet-desktop.png"),
    fullPage: true,
  });
  await page.evaluate(() => WorldGuardGame.setZoom(0.44));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(previews, "worldguard-3d-city-desktop.png"),
    fullPage: true,
  });
  await page.evaluate(() => WorldGuardGame.setZoom(0.86));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(previews, "worldguard-3d-apartment-desktop.png"),
    fullPage: true,
  });
  await page.locator("#settingsChecklist").click();
  await expect(page.locator("#requirementsDialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#settingsChecklist")).toBeFocused();
  for (const id of ["WG-036", "WG-038", "WG-042", "WG-051"]) {
    await page.locator("#settingsChecklist").click();
    await page.locator("#requirementSearch").fill(id);
    await page.locator(".requirement-actions button").click();
    await expect(page.locator("#requirementsDialog")).toBeHidden();
  }
  expect(errors).toEqual([]);
});
test("mobile zoom, keyboard alternatives and failed import preserve the live session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play.html");
  await page.waitForFunction(() => window.WorldGuardGame?.ready());
  await page.locator("#cityView").click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(previews, "worldguard-3d-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const rect=await page.locator('#planet').boundingBox(),cdp=await page.context().newCDPSession(page),beforePinch=await page.evaluate(()=>WorldGuardGame.getCamera().targetZoom);
  const touches=distance=>[{x:rect.x+rect.width/2-distance,y:rect.y+rect.height/2},{x:rect.x+rect.width/2+distance,y:rect.y+rect.height/2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(30)});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(60)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(before=>WorldGuardGame.getCamera().targetZoom>before,beforePinch);
  await page.locator("#planet").focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => WorldGuardGame.getCamera().targetZoom)).toBe(
    1,
  );
  await page.keyboard.press("Home");
  expect(await page.evaluate(() => WorldGuardGame.getCamera().targetZoom)).toBe(
    0,
  );
  await page
    .locator("#import")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"bad"}'),
    });
  await expect(page.locator("#saveStatus")).toContainText("Import failed");
  expect(
    await page.evaluate(() => WorldGuardGame.getState().world.population),
  ).toBe(36);
  await page.locator("#newWorld").click();
  await expect(page.locator("#replaceDialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#newWorld")).toBeFocused();
});

test("legacy Life Lab still trains and routes the new checklist evidence to the 3D game", async ({
  page,
}) => {
  await page.goto("/life.html");
  await expect(page.locator("#viewerLoading")).toBeHidden();
  await page.locator("#train").click();
  await expect(page.locator("#statPolicy")).toHaveText("ON");
  await page.locator("#step").click();
  await expect(page.locator("#statTurns")).toHaveText("1");
  await page.locator("#settingsChecklist").click();
  await page.locator("#requirementSearch").fill("WG-036");
  await page.locator(".requirement-actions button").click();
  await page.waitForURL("**/play.html?feature=persistence");
  await expect(page.locator("#savePanel")).toBeVisible();
});
test("WebGL failure leaves an actionable recovery screen and never starts hidden training", async ({
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
  await page.goto("/play.html");
  await expect(page.locator("#startup")).toContainText("3D could not start");
  await expect(page.locator("#start")).toBeDisabled();
  expect(
    await page.evaluate(() => WorldGuardGame.getState().policy.updates),
  ).toBe(0);
});
test("unavailable local storage reports the error and retains the JSON recovery path", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw Error("Storage blocked for test");
    };
  });
  await page.goto("/play.html");
  await expect(page.locator("#saveStatus")).toContainText(
    "Local storage unavailable",
  );
  await expect(page.locator("#export")).toBeEnabled();
  await expect(page.locator("#import")).toBeEnabled();
});
