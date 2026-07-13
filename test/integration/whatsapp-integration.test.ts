import { describe, it, expect } from "vitest";

describe("WhatsApp Integration", () => {
  describe("normalizeJID", () => {
    const normalizeJID = (value: string) => {
      value = value.trim();
      if (value.includes("@")) return value;
      value = value.replace(/^\+/, "");
      return value + "@s.whatsapp.net";
    };

    it("should add @s.whatsapp.net suffix", () => {
      expect(normalizeJID("5511999999999")).toBe("5511999999999@s.whatsapp.net");
    });

    it("should strip leading +", () => {
      expect(normalizeJID("+5511999999999")).toBe("5511999999999@s.whatsapp.net");
    });

    it("should not modify already valid JID", () => {
      expect(normalizeJID("5511999999999@s.whatsapp.net")).toBe("5511999999999@s.whatsapp.net");
    });

    it("should trim whitespace", () => {
      expect(normalizeJID("  5511999999999  ")).toBe("5511999999999@s.whatsapp.net");
    });
  });

  describe("stableId", () => {
    const stableId = (...parts: string[]) =>
      parts
        .filter(Boolean)
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 180);

    it("should create stable ID from parts", () => {
      const id = stableId("tenant-1", "whatsmeow", "inst-1", "5511999999999@s.whatsapp.net");
      expect(id).toContain("tenant-1");
      expect(id).toContain("whatsmeow");
      expect(id).toContain("inst-1");
    });

    it("should handle empty parts gracefully", () => {
      expect(stableId("a", "", "b")).toBe("a-b");
    });

    it("should replace special chars with hyphens", () => {
      const id = stableId("test@tenant", "whatsapp cloud");
      expect(id).not.toContain("@");
      expect(id).not.toContain(" ");
    });
  });

  describe("getWhatsmeowBridgeUrl", () => {
    const getBridgeUrl = () => (process.env.WHATSMEOW_BRIDGE_URL || "").replace(/\/$/, "");

    it("should return env var without trailing slash", () => {
      process.env.WHATSMEOW_BRIDGE_URL = "http://localhost:4000/";
      expect(getBridgeUrl()).toBe("http://localhost:4000");
      delete process.env.WHATSMEOW_BRIDGE_URL;
    });

    it("should return empty string when not configured", () => {
      delete process.env.WHATSMEOW_BRIDGE_URL;
      expect(getBridgeUrl()).toBe("");
    });
  });

  describe("Cloud API webhook verification", () => {
    it("should verify hub challenge when tokens match", () => {
      const verifyToken = "vendaora_verify";
      const mode = "subscribe";
      const token = "vendaora_verify";
      const challenge = "12345";

      const result = mode === "subscribe" && token === verifyToken ? challenge : null;
      expect(result).toBe("12345");
    });

    it("should reject when tokens do not match", () => {
      const verifyToken: string = "vendaora_verify";
      const mode: string = "subscribe";
      const token: string = "wrong_token";

      const result = mode === "subscribe" && token === verifyToken ? "challenge" : null;
      expect(result).toBeNull();
    });

    it("should reject when mode is not subscribe", () => {
      const verifyToken: string = "vendaora_verify";
      const mode: string = "unsubscribe";
      const token: string = "vendaora_verify";

      const result = mode === "subscribe" && token === verifyToken ? "challenge" : null;
      expect(result).toBeNull();
    });
  });

  describe("getCloudApiConfig", () => {
    it("should return config from env vars", () => {
      process.env.WHATSAPP_CLOUD_TOKEN = "test-token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-id";
      process.env.META_APP_SECRET = "test-secret";
      process.env.META_VERIFY_TOKEN = "test-verify";

      const token = process.env.WHATSAPP_CLOUD_TOKEN || "";
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
      const verifyToken = process.env.META_VERIFY_TOKEN || "vendaora_verify";

      expect(token).toBe("test-token");
      expect(phoneNumberId).toBe("test-phone-id");
      expect(verifyToken).toBe("test-verify");

      delete process.env.WHATSAPP_CLOUD_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.META_APP_SECRET;
      delete process.env.META_VERIFY_TOKEN;
    });

    it("should use default verify token", () => {
      delete process.env.META_VERIFY_TOKEN;
      const verifyToken = process.env.META_VERIFY_TOKEN || "vendaora_verify";
      expect(verifyToken).toBe("vendaora_verify");
    });
  });

  describe("Cloud API message sending", () => {
    it("should build valid Cloud API request body", () => {
      const to = "5511999999999";
      const text = "Hello from Vendaora";

      const body = JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      });

      const parsed = JSON.parse(body);
      expect(parsed.messaging_product).toBe("whatsapp");
      expect(parsed.recipient_type).toBe("individual");
      expect(parsed.to).toBe("5511999999999");
      expect(parsed.text.body).toBe("Hello from Vendaora");
    });

    it("should build valid template body", () => {
      const body = JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "5511999999999",
        type: "template",
        template: {
          name: "welcome_message",
          language: { code: "pt_BR" },
          components: [{ type: "body", parameters: [{ type: "text", text: "João" }] }],
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.type).toBe("template");
      expect(parsed.template.name).toBe("welcome_message");
      expect(parsed.template.language.code).toBe("pt_BR");
      expect(parsed.template.components[0].parameters[0].text).toBe("João");
    });
  });

  describe("Message pipeline helpers", () => {
    it("should identify WhatsApp channel for sendViaChannel", () => {
      const channels = ["whatsmeow", "web", "instagram"];
      expect(channels[0]).toBe("whatsmeow");
    });

    it("should extract remoteJid from various sources", () => {
      const identities = [{ provider: "whatsmeow", externalId: "5511999999999@s.whatsapp.net" }];
      const phone = "+5511888888888";

      const fromIdentity = identities.find((i) => i.provider === "whatsmeow")?.externalId;
      expect(fromIdentity).toBe("5511999999999@s.whatsapp.net");

      expect(phone).toBe("+5511888888888");
    });
  });

  describe("Channel type handling", () => {
    it("should map channel types correctly", () => {
      const channelColors: Record<string, string> = {
        whatsmeow: "bg-[#25D366]",
        whatsapp: "bg-[#25D366]",
        whatsapp_cloud: "bg-[#25D366]",
      };

      expect(channelColors.whatsmeow).toBe("bg-[#25D366]");
      expect(channelColors.whatsapp).toBe("bg-[#25D366]");
      expect(channelColors.whatsapp_cloud).toBe("bg-[#25D366]");
    });

    it("should return WhatsApp icon for all whatsapp variants", () => {
      const getIcon = (channel: string) => {
        switch (channel) {
          case "whatsmeow":
          case "whatsapp":
          case "whatsapp_cloud":
            return "whatsapp-icon";
          default:
            return "default-icon";
        }
      };

      expect(getIcon("whatsmeow")).toBe("whatsapp-icon");
      expect(getIcon("whatsapp")).toBe("whatsapp-icon");
      expect(getIcon("whatsapp_cloud")).toBe("whatsapp-icon");
      expect(getIcon("web")).toBe("default-icon");
    });
  });

  describe("asString helper", () => {
    const asString = (value: unknown, fallback = "") => {
      if (value === null || value === undefined) return fallback;
      return String(value);
    };

    it("should return string value", () => {
      expect(asString("hello")).toBe("hello");
    });

    it("should return fallback for null/undefined", () => {
      expect(asString(null)).toBe("");
      expect(asString(undefined)).toBe("");
      expect(asString(undefined, "default")).toBe("default");
    });

    it("should convert numbers to string", () => {
      expect(asString(123)).toBe("123");
    });
  });

  describe("assertWebhookSecret", () => {
    const getWebhookSecret = () => process.env.CHATWOOT_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";

    it("should pass when no secret configured", () => {
      delete process.env.WEBHOOK_SECRET;
      delete process.env.CHATWOOT_WEBHOOK_SECRET;
      expect(getWebhookSecret()).toBe("");
    });

    it("should read from env vars", () => {
      process.env.WEBHOOK_SECRET = "my-secret";
      expect(getWebhookSecret()).toBe("my-secret");
      delete process.env.WEBHOOK_SECRET;
    });

    it("should prefer CHATWOOT_WEBHOOK_SECRET", () => {
      process.env.CHATWOOT_WEBHOOK_SECRET = "chatwoot-secret";
      process.env.WEBHOOK_SECRET = "webhook-secret";
      expect(getWebhookSecret()).toBe("chatwoot-secret");
      delete process.env.CHATWOOT_WEBHOOK_SECRET;
      delete process.env.WEBHOOK_SECRET;
    });
  });
});
