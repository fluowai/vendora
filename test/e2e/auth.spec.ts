import { test, expect } from "@playwright/test";

test.describe("Autenticação", () => {
  test("deve carregar a página de login", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
  });

  test("deve fazer login com credenciais demo", async ({ page }) => {
    await page.goto("/auth");
    await page.getByPlaceholder(/email/i).first().fill("admin@vendaora.com");
    await page.getByPlaceholder(/senha|password/i).first().fill("admin123");
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    await page.waitForURL(/dashboard|\/admin|\//i, { timeout: 10000 });
    await expect(page.locator("body")).toBeVisible();
  });
});
