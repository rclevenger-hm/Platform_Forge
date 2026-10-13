import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
const missions = JSON.parse(
  readFileSync(new URL("../../src/data/missions.json", import.meta.url)),
);
test("standalone mission, progress persistence, design experiment and unavailable backend", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Build confidence/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue your journey" }).click();
  for (const command of ["cat handoff.txt", "cat /var/log/relay.log"]) {
    await page.getByPlaceholder("Type a command…").fill(command);
    await page.getByPlaceholder("Type a command…").press("Enter");
  }
  await page
    .getByRole("radio", { name: "It starts with /", exact: true })
    .check();
  await page.getByRole("button", { name: "Run checks & submit" }).click();
  await expect(page.getByText("Mission complete. Nice work.")).toBeVisible();
  await page
    .getByLabel("Mission notes")
    .fill("Read evidence before changing the service.");
  await page.reload();
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(
    page.getByText("Read evidence before changing the service."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Design Lab", exact: true }).click();
  await page.getByLabel("Inject one API replica failure").check();
  await expect(page.getByText("OVER CAPACITY", { exact: true })).toBeVisible();
  await page
    .getByLabel("Design rationale")
    .fill("Reserve capacity for a replica failure.");
  await page.getByRole("button", { name: "Save experiment" }).click();
  await expect(page.getByText("Saved to portfolio")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The Relay campaign" }),
  ).toBeVisible();
});
test("bundled Python really executes successful and failing code without a CDN", async ({
  page,
}) => {
  const remote = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173")) remote.push(r.url());
  });
  await page.goto("./#Campaign");
  await page.getByRole("button", { name: /M07 Find the noisy client/ }).click();
  const m = missions.find((x) => x.id === "M07");
  await page
    .getByRole("radio", { name: m.quiz[m.answer + 1], exact: true })
    .check();
  await page.getByRole("button", { name: "Run checks & submit" }).click();
  await expect(page.getByText("Keep investigating.")).toBeVisible({
    timeout: 70000,
  });
  await expect(page.getByLabel("Execution output")).toContainText(
    "AssertionError",
  );
  await page.getByLabel("Code editor").fill(m.solution);
  await page.getByRole("button", { name: "Run checks & submit" }).click();
  await expect(
    page.getByRole("button", { name: "Run checks & submit" }),
  ).toBeEnabled({ timeout: 70000 });
  await expect(page.getByLabel("Execution output")).toContainText(
    "All practice checks passed.",
  );
  await expect(page.getByText("Mission complete. Nice work.")).toBeVisible();
  expect(remote).toEqual([]);
});
test("mobile navigation and layout fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The Relay campaign" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("reachable mentor enables contextual hints and an outage leaves authored hints available", async ({
  page,
}) => {
  await page.route("**/api/capabilities", (route) =>
    route.fulfill({ json: { connected: true, tutor: true, runner: false } }),
  );
  await page.route("**/api/tutor", (route) =>
    route.fulfill({ json: { answer: "Which directory does pwd show?" } }),
  );
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "AI mentor connected" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue your journey" }).click();
  await page.getByLabel("Ask the mentor").fill("Give me a small hint.");
  await page.getByRole("button", { name: "Ask for a hint" }).click();
  await expect(page.getByText("Which directory does pwd show?")).toBeVisible();
  await page.route("**/api/tutor", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Optional service unavailable." },
    }),
  );
  await page.getByRole("button", { name: "Ask for a hint" }).click();
  await expect(page.getByText("Optional service unavailable.")).toBeVisible();
  await page.getByRole("button", { name: /Reveal a hint/ }).click();
  await expect(page.getByText("Start with pwd and ls.")).toBeVisible();
});
test("capture the implemented workspace for visual review", async ({ page }) => {
  const { captureReview } = await import('../../scripts/capture-review.mjs');
  await captureReview(page, missions);
});

test('legacy progress migrates into concept reviews and authoring rejects broken contracts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('platform-forge:v1', JSON.stringify({
    version: 1, attempts: [{id:'legacy', missionId:'M07', mode:'browser Python', passed:true, hints:0, at:'2026-01-01T00:00:00Z'}], notes:{M07:'Legacy handoff'}, drafts:{}, designs:[]
  })));
  await page.goto('./#Review');
  await expect(page.getByText('Independent practice; transfer unverified')).toBeVisible();
  await page.getByRole('button', {name:'Try the transfer'}).click();
  await expect(page.getByRole('heading', {name:'Count the broken deployments'})).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('platform-forge:v1')).version)).toBe(3);
  await page.getByRole('button', {name:'Author', exact:true}).click();
  await expect(page.getByText('VALID MISSION CONTRACT', {exact:true})).toBeVisible();
  await page.getByLabel('Mission JSON').fill('{"id":"NEW"}');
  await expect(page.getByText('DRAFT NEEDS CHANGES')).toBeVisible();
  await expect(page.getByRole('button', {name:'Export validated lesson'})).toBeDisabled();
  await page.getByLabel('Mission JSON').fill(JSON.stringify({...missions[0], id:'NEW_21'}));
  await expect(page.getByText('VALID MISSION CONTRACT', {exact:true})).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name:'Export validated lesson'}).click();
  expect((await download).suggestedFilename()).toBe('NEW_21.json');
});

test('Bash execution is offered only by a capable runner and standalone checks survive an outage', async ({ page }) => {
  await page.route('**/api/capabilities', route => route.fulfill({json:{connected:true, tutor:false, runner:true, runnerLanguages:['bash']}}));
  await page.route('**/api/run', route => route.fulfill({json:{passed:true, output:'All practice checks passed.'}}));
  await page.goto('./#Campaign');
  await page.getByRole('button', {name:/M20 Keep every argument intact/}).click();
  const m = missions.find(m => m.id === 'M20');
  await page.getByLabel('Execution engine').selectOption('docker');
  await page.getByLabel('Code editor').fill(m.solution);
  await page.getByRole('radio', {name:m.quiz[m.answer+1], exact:true}).check();
  await page.getByRole('button', {name:'Run checks & submit'}).click();
  await expect(page.getByText('Mission complete. Nice work.')).toBeVisible();
  await page.route('**/api/run', route => route.fulfill({status:503,json:{error:'Lab unavailable.'}}));
  await page.getByRole('button', {name:'Run checks & submit'}).click();
  await expect(page.getByLabel('Execution output')).toContainText('Lab unavailable.');
  await page.getByLabel('Execution engine').selectOption('browser');
  await page.getByRole('button', {name:'Run checks & submit'}).click();
  await expect(page.getByText('Mission complete. Nice work.')).toBeVisible();
});

test('daily plan tracks work and mission links preserve the staged notebook', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Daily time budget').selectOption('15');
  await expect(page.getByLabel("Today's practice plan")).toContainText('0 / 2 steps complete');
  await page.getByRole('button', {name:'Continue your journey'}).click();
  await page.getByLabel('Incident observation').fill('The handoff points to the relay log.');
  await page.getByLabel('Incident hypothesis').fill('The log should explain why the worker stopped.');
  await page.getByRole('tab', {name:'Files',exact:true}).click();
  await page.getByRole('button', {name:'/home/learner/handoff.txt',exact:true}).click();
  await page.getByRole('button', {name:'/var/log/relay.log',exact:true}).click();
  await page.getByRole('radio', {name:'It starts with /',exact:true}).check();
  await page.getByRole('button', {name:'Run checks & submit'}).click();
  await expect(page.getByText('Mission complete. Nice work.')).toBeVisible();
  await page.getByLabel('Mission notes').fill('Read the handoff and confirmed the failure evidence.');
  await page.getByRole('button', {name:'Home',exact:true}).click();
  await expect(page.getByLabel("Today's practice plan")).toContainText('2 / 2 steps complete');
  await page.goto('./#Practice%2FM12');
  await page.getByLabel('Incident observation').fill('Cron cannot resolve the relative executable.');
  await page.reload();
  await expect(page.getByRole('heading', {name:'The midnight backup'})).toBeVisible();
  await expect(page.getByLabel('Incident observation')).toHaveValue('Cron cannot resolve the relative executable.');
  await page.getByRole('tab', {name:'Workspace',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', {name:'Files',exact:true})).toBeFocused();
  await page.getByRole('button', {name:'Portfolio',exact:true}).click();
  const download=page.waitForEvent('download');
  await page.getByRole('button', {name:'Export incident journal'}).click();
  expect((await download).suggestedFilename()).toBe('platform-forge-journal.md');
});

test('editable architecture affects results and survives saving, reload and reopening', async ({ page }) => {
  await page.goto('./#Design%20Lab');
  await page.getByRole('button', {name:'Cache node',exact:true}).click();
  await page.getByRole('button', {name:'Remove Cache',exact:true}).click();
  await expect(page.getByText('OVER CAPACITY',{exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Cache',exact:true}).click();
  await page.getByLabel('Architecture connection').selectOption('api:cache');
  await page.getByRole('button', {name:'Connect components'}).click();
  await page.getByLabel('Architecture connection').selectOption('cache:database');
  await page.getByRole('button', {name:'Connect components'}).click();
  await expect(page.getByText('WITHIN CAPACITY',{exact:true})).toBeVisible();
  await page.getByRole('button', {name:'API service node',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  const moved=await page.getByRole('button', {name:'API service node',exact:true}).getAttribute('style');
  await page.getByRole('button', {name:'Add queue & worker path'}).click();
  await page.getByRole('button', {name:'Pin baseline',exact:true}).click();
  await page.getByLabel('Stop all workers',exact:true).check();
  await expect(page.getByText('The remaining jobs cannot drain under these conditions.',{exact:false})).toBeVisible();
  await page.getByRole('button', {name:'Run scenario suite'}).click();
  await expect(page.getByRole('rowheader', {name:'Workers stopped',exact:true})).toBeVisible();
  await page.getByLabel('Design rationale').fill('The finite buffer limits memory, but a stopped worker causes rejected jobs.');
  await page.getByRole('button', {name:'Save experiment',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('Stop all workers',exact:true)).toBeChecked();
  expect(await page.getByRole('button', {name:'API service node',exact:true}).getAttribute('style')).toBe(moved);
  await page.getByRole('button', {name:'Portfolio',exact:true}).click();
  await page.getByRole('button', {name:'Reopen design',exact:true}).click();
  await expect(page.getByLabel('Design rationale')).toHaveValue('The finite buffer limits memory, but a stopped worker causes rejected jobs.');
  await expect(page.getByRole('heading', {name:'Baseline → current design'})).toBeVisible();
});

test('daily plan and architecture remain usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await page.getByLabel('Daily time budget').selectOption('15');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.goto('./#Design%20Lab');
  await page.getByRole('button', {name:'Add queue & worker path'}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button', {name:'Worker node',exact:true}).focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', {name:'Run scenario suite'}).click();
  await expect(page.getByRole('rowheader', {name:'Cold cache',exact:true})).toBeVisible();
});
