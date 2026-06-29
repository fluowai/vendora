import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx tsx server.ts",
    port: 3333,
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-e2e-secret-key",
      JWT_REFRESH_SECRET: "test-e2e-refresh-secret",
      DATABASE_URL: "file:./dev.db",
      PORT: "3333",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
