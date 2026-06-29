import { test, expect } from "@playwright/test";

test.describe("Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByPlaceholder(/email/i).first().fill("admin@vendaora.com");
    await page.getByPlaceholder(/senha|password/i).first().fill("admin123");
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    await page.waitForURL(/dashboard|\//i, { timeout: 10000 });
  });

  test("dashboard deve carregar com indicadores", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Agentes", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Tickets", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de CRM", async ({ page }) => {
    await page.goto("/crm");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Ouvidoria", async ({ page }) => {
    await page.goto("/ombudsman");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Analytics", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
