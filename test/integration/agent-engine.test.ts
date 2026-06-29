import { describe, it, expect, vi } from "vitest";
import { toAgentResponse } from "../../server/lib/agent-engine";

describe("Agent Engine", () => {
  describe("toAgentResponse", () => {
    it("should return null for null agent", () => {
      expect(toAgentResponse(null)).toBeNull();
    });

    it("should transform agent with llmConfig", () => {
      const agent = {
        id: "agent-1",
        name: "Test Agent",
        modelProvider: "gemini",
        modelName: "gemini-3-flash-preview",
        basePrompt: "You are a test agent",
        temperature: 0.7,
        segment: "vendas",
        status: "active",
        channels: '["web","whatsapp"]',
        tags: '["vendas"]',
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const result = toAgentResponse(agent);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Test Agent");
      expect(result!.llmConfig.provider).toBe("gemini");
      expect(result!.llmConfig.model).toBe("gemini-3-flash-preview");
      expect(result!.llmConfig.systemPrompt).toBe("You are a test agent");
      expect(result!.llmConfig.temperature).toBe(0.7);
      expect(result!.channels).toEqual(["web", "whatsapp"]);
      expect(result!.tags).toEqual(["vendas"]);
    });

    it("should handle string dates", () => {
      const agent = {
        id: "agent-1",
        name: "Test Agent",
        modelProvider: "gemini",
        modelName: "gemini-3-flash-preview",
        basePrompt: "",
        temperature: 0.5,
        segment: "suporte",
        status: "active",
        channels: [],
        tags: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const result = toAgentResponse(agent);
      expect(result).not.toBeNull();
      expect(typeof result!.createdAt).toBe("string");
    });
  });
});
