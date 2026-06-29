import { describe, it, expect } from "vitest";

describe("Knowledge Base", () => {
  it("should export required functions", async () => {
    const mod = await import("../../server/lib/knowledge-base");
    expect(mod.createKnowledgeBase).toBeDefined();
    expect(mod.getKnowledgeBase).toBeDefined();
    expect(mod.getAllKnowledgeBases).toBeDefined();
    expect(mod.addDocument).toBeDefined();
    expect(mod.removeDocument).toBeDefined();
    expect(mod.searchKnowledgeBase).toBeDefined();
  });

  it("should export searchKnowledgeBase with correct signature", async () => {
    const mod = await import("../../server/lib/knowledge-base");
    expect(mod.searchKnowledgeBase.length).toBe(2);
  });
});
