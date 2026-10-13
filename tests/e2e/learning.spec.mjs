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
test("capture the implemented workspace for visual review", async ({
  page,
}) => {
  await mkdir("test-results/previews", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("./");
  await page.screenshot({
    path: "test-results/previews/home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue your journey" }).click();
  await page.screenshot({
    path: "test-results/previews/mission.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Design Lab", exact: true }).click();
  await page.screenshot({
    path: "test-results/previews/design.png",
    fullPage: true,
  });
});
