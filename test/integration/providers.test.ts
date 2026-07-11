import { describe, it, expect } from "vitest";

describe("LLM Providers", () => {
  it("should have AVAILABLE_MODELS with all providers", async () => {
    const { AVAILABLE_MODELS } = await import("../../server/lib/providers");
    expect(AVAILABLE_MODELS).toBeDefined();
    expect(AVAILABLE_MODELS.gemini).toBeDefined();
    expect(AVAILABLE_MODELS.openai).toBeDefined();
    expect(AVAILABLE_MODELS.anthropic).toBeDefined();
    expect(AVAILABLE_MODELS.groq).toBeDefined();
    expect(AVAILABLE_MODELS.glm).toBeDefined();
    expect(AVAILABLE_MODELS.custom).toBeDefined();
  });

  it("should have gemini models", async () => {
    const { AVAILABLE_MODELS } = await import("../../server/lib/providers");
    const geminiModels = AVAILABLE_MODELS.gemini;
    expect(geminiModels.length).toBeGreaterThanOrEqual(2);
    expect(geminiModels[0].id).toBe("gemini-3-flash-preview");
  });

  it("should have SEGMENT_PROMPTS", async () => {
    const { SEGMENT_PROMPTS } = await import("../../server/lib/providers");
    expect(SEGMENT_PROMPTS.saude).toBeDefined();
    expect(SEGMENT_PROMPTS.juridico).toBeDefined();
    expect(SEGMENT_PROMPTS.educacao).toBeDefined();
    expect(SEGMENT_PROMPTS.imobiliario).toBeDefined();
    expect(SEGMENT_PROMPTS.financeiro).toBeDefined();
    expect(SEGMENT_PROMPTS.ecommerce).toBeDefined();
  });

  it("should throw on unsupported provider", async () => {
    const { executeLLM } = await import("../../server/lib/providers");
    await expect(executeLLM({ provider: "unknown" as any, model: "test" }, "hello")).rejects.toThrow("Unsupported provider");
  });

  it("should reject glm without API key", async () => {
    const { executeLLM } = await import("../../server/lib/providers");
    await expect(executeLLM({ provider: "glm", model: "glm-4.5-air", apiKey: "" }, "hello")).rejects.toThrow("GLM API key not configured");
  });
});
