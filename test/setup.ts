import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  // cleanup if needed
});
