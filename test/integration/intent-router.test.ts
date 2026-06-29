import { describe, it, expect } from "vitest";

describe("Intent Router", () => {
  it("should export routeMessage function", async () => {
    const mod = await import("../../server/lib/intent-router");
    expect(mod.routeMessage).toBeDefined();
    expect(typeof mod.routeMessage).toBe("function");
  });

  it("should export checkHandoff function", async () => {
    const mod = await import("../../server/lib/intent-router");
    expect(mod.checkHandoff).toBeDefined();
    expect(typeof mod.checkHandoff).toBe("function");
  });
});
