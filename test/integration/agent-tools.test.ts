import { describe, expect, it } from "vitest";

describe("Agent Tools", () => {
  it("should expose the supported tool catalog", async () => {
    const mod = await import("../../server/lib/agent-tools");
    expect(mod.AVAILABLE_AGENT_TOOLS.map((tool: any) => tool.name)).toEqual(
      expect.arrayContaining([
        "update_contact",
        "create_ticket",
        "create_deal",
        "create_appointment",
        "list_available_slots",
        "search_knowledge",
        "webhook",
      ]),
    );
  });

  it("should reject unsupported tools without touching integrations", async () => {
    const { executeAgentTool } = await import("../../server/lib/agent-tools");
    const result = await executeAgentTool({
      tenantId: "tenant-1",
      name: "missing_tool" as any,
      args: {},
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("nao suportada");
  });
});
