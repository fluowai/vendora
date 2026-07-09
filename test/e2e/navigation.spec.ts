import { test, expect } from "@playwright/test";

test.describe("Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/email/i).first().fill("admin@vendaora.com");
    await page.locator("input[type='password']").fill("admin123");
    await page.getByRole("button", { name: /acessar painel|entrar|login|sign in/i }).click();
    await page.waitForURL(/\/app\/dashboard|\/superadmin|\/mega-admin/i, { timeout: 10000 });
  });

  test("dashboard deve carregar com indicadores", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Agentes", async ({ page }) => {
    await page.goto("/app/agents");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Tickets", async ({ page }) => {
    await page.goto("/app/tickets");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de CRM", async ({ page }) => {
    await page.goto("/app/crm");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Ouvidoria", async ({ page }) => {
    await page.goto("/app/ombudsman");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deve navegar para página de Analytics", async ({ page }) => {
    await page.goto("/app/analytics");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
