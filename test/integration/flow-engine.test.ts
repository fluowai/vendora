import { describe, expect, it } from "vitest";

describe("Flow Engine", () => {
  it("should accept a valid flow graph", async () => {
    const { validateFlowGraph } = await import("../../server/lib/flow-engine");
    const result = validateFlowGraph({
      startNodeId: "start",
      nodes: [
        { id: "start", type: "message", data: { text: "Ola" } },
        { id: "end", type: "end", data: {} },
      ],
      edges: [{ source: "start", target: "end" }],
    });

    expect(result).toEqual({ ok: true });
  });

  it("should reject duplicate node ids", async () => {
    const { validateFlowGraph } = await import("../../server/lib/flow-engine");
    const result = validateFlowGraph({
      nodes: [
        { id: "start", type: "message" },
        { id: "start", type: "question" },
      ],
      edges: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toContain("duplicado");
  });

  it("should reject edges pointing to missing nodes", async () => {
    const { validateFlowGraph } = await import("../../server/lib/flow-engine");
    const result = validateFlowGraph({
      nodes: [{ id: "start", type: "message" }],
      edges: [{ source: "start", target: "missing" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toContain("Aresta invalida");
  });
});
