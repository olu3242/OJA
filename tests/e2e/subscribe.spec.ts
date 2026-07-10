import { expect, test } from "@playwright/test";

// UI smoke of the core funnel: sign in → choose a Garri plan → pantry page
// shows the subscription with a confirmable cycle. (Service-level gate tests
// cover the full warehouse loop; this exercises the real browser surface.)
test("household can subscribe to a Garri plan and manage the pantry", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@test.gaarii`;

  await page.goto("/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/account");

  await page.goto("/subscribe");
  await expect(
    page.getByRole("heading", { name: "Choose your Garri plan" }),
  ).toBeVisible();
  // Family is preselected as the hero plan; pick Yellow, fine grind
  await page.locator('select[name="variety"]').selectOption("YELLOW");
  await page.locator('select[name="grind"]').selectOption("FINE");
  await page.getByPlaceholder("Street address").fill("14 Agege Rd");
  await page.getByPlaceholder("City").fill("Houston");
  await page.getByPlaceholder("State (TX)").fill("TX");
  await page.getByPlaceholder("ZIP").fill("77003");
  await page.getByRole("button", { name: "Start my subscription" }).click();

  await page.waitForURL("**/account");
  await expect(page.getByText("Family · Yellow · fine")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm delivery" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Skip this one" }),
  ).toBeVisible();

  // Confirm the first cycle → order appears with first-delivery discount
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByText("PAID")).toBeVisible();
});
