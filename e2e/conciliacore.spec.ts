import { expect, test } from "@playwright/test";

const password = "Demo@123";

async function openEnglishLogin(page: import("@playwright/test").Page) {
  const response = await page.goto("/login");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Access the environment" })).toBeVisible();
}

test("an analyst inspects the environment and runs reconciliation", async ({ page }) => {
  await openEnglishLogin(page);

  await page.getByRole("button", { name: "Access demo" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Payments under control." })).toBeVisible();
  await expect(page.getByText("Demo environment.")).toBeVisible();

  await page.getByRole("button", { name: "Run reconciliation" }).click();
  await expect(page.getByRole("status")).toContainText("Reconciliation completed");

  await page.locator(".sidebar__nav").getByRole("button", { name: /^Exceptions/ }).click();
  await expect(page.getByRole("heading", { name: "Mismatches to investigate." })).toBeVisible();
  await page.locator("tbody tr").first().click();
  await expect(page.getByText("Exception details")).toBeVisible();
});

test("the mobile menu manages focus and removes hidden navigation content", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await openEnglishLogin(page);
  await page.getByRole("button", { name: "Access demo" }).click();
  await expect(page).toHaveURL(/\/app$/);

  const navigation = page.locator("#primary-navigation");
  const openButton = page.getByRole("button", { name: "Open navigation" });
  await expect(navigation).toHaveAttribute("inert", "");

  await openButton.click();
  await expect(navigation).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(navigation).toHaveAttribute("inert", "");
  await expect(openButton).toBeFocused();
});

test("an auditor cannot mutate demo data", async ({ request }) => {
  const login = await request.post("/api/auth/login", {
    data: { email: "auditor@conciliacore.dev", password },
  });
  expect(login.ok()).toBeTruthy();

  const reset = await request.post("/api/demo/reset");
  expect(reset.status()).toBe(403);
  await expect(reset.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
});

test("the management API exposes stable validation contracts", async ({ request }) => {
  const malformedLogin = await request.post("/api/auth/login", {
    data: Buffer.from("{"),
    headers: { "content-type": "application/json" },
  });
  expect(malformedLogin.status()).toBe(400);
  await expect(malformedLogin.json()).resolves.toEqual({
    error: "Invalid JSON body",
    code: "INVALID_JSON",
  });

  const login = await request.post("/api/auth/login", {
    data: { email: "analyst@conciliacore.dev", password },
  });
  expect(login.ok()).toBeTruthy();

  const invalidFilter = await request.get("/api/cases?status=UNKNOWN");
  expect(invalidFilter.status()).toBe(400);
  await expect(invalidFilter.json()).resolves.toMatchObject({
    code: "VALIDATION_ERROR",
  });
});
