import { describe, it, expect } from "vitest";
import DevupAI, {
  verifyWebhookSignature,
  constructWebhookEvent,
  DevupWebhookVerificationError,
  type WebhookSuccessPayload,
  type WebhookErrorPayload,
} from "../src/index";

/**
 * Computes an HMAC-SHA256 signature using Web Crypto for test assertions.
 */
async function computeSignature(
  payload: string | Uint8Array,
  secret: string,
  timestamp: number
): Promise<string> {
  const bodyBytes = typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
  const prefixBytes = new TextEncoder().encode(`${timestamp}.`);
  const payloadBytes = new Uint8Array(prefixBytes.length + bodyBytes.length);
  payloadBytes.set(prefixBytes, 0);
  payloadBytes.set(bodyBytes, prefixBytes.length);

  const secretBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("Webhook Signature Verification & Event Construction", () => {
  const TEST_SECRET = "whsec_test_secret_1234567890abcdef";
  const OLD_SECRET = "whsec_old_secret_abcdef1234567890";
  const SAMPLE_SUCCESS_PAYLOAD = JSON.stringify({
    id: "whd_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    status: "succeeded",
    usage: {
      prompt_tokens: 10,
      completion_tokens: 50,
    },
    cost_dzd: 1.5,
    settlement: "settled",
    results: [
      { generated_text: "Inference response text." },
    ],
  });

  const SAMPLE_ERROR_PAYLOAD = JSON.stringify({
    id: "whd_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    status: "failed",
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
    },
    cost_dzd: null,
    settlement: "failed",
    error: {
      type: "inference_failed",
      message: "The inference request timed out.",
    },
  });

  describe("verifyWebhookSignature", () => {
    it("returns true for a valid single signature with string body", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(true);
    });

    it("returns true for a valid single signature with Uint8Array body", async () => {
      const now = Math.floor(Date.now() / 1000);
      const bodyBytes = new TextEncoder().encode(SAMPLE_SUCCESS_PAYLOAD);
      const signature = await computeSignature(bodyBytes, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: bodyBytes,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(true);
    });

    it("returns true when the SECOND of two v1 signatures matches (rotation window)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sigFromOldSecret = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, OLD_SECRET, now);
      const sigFromNewSecret = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);

      // Header carries both signatures: retired secret first, active secret second
      const header = `t=${now},v1=${sigFromOldSecret},v1=${sigFromNewSecret}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(true);
    });

    it("returns true when the FIRST of two v1 signatures matches (rotation window)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sigFromNewSecret = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const sigFromOldSecret = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, OLD_SECRET, now);

      const header = `t=${now},v1=${sigFromNewSecret},v1=${sigFromOldSecret}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(true);
    });

    it("returns false for a wrong secret", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, "wrong_secret", now);
      const header = `t=${now},v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false for a tampered body", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD + " ", // altered whitespace
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false for malformed header: missing timestamp t", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false for malformed header: non-numeric timestamp t", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `t=invalid_timestamp,v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false for malformed header: missing v1 signature", async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = `t=${now}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false for malformed header: completely garbage header string", async () => {
      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: "random-unstructured-header-value",
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false when timestamp is older than default tolerance (300s)", async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 301;
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, expiredTime);
      const header = `t=${expiredTime},v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("returns false when timestamp is in future beyond default tolerance (300s)", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 301;
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, futureTime);
      const header = `t=${futureTime},v1=${signature}`;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(false);
    });

    it("honours custom toleranceSeconds", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 400;
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, pastTime);
      const header = `t=${pastTime},v1=${signature}`;

      // Rejects with default tolerance (300s)
      const defaultCheck = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });
      expect(defaultCheck).toBe(false);

      // Accepts with custom tolerance (600s)
      const customCheck = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
        toleranceSeconds: 600,
      });
      expect(customCheck).toBe(true);
    });

    it("tolerates whitespace and unknown header parameters", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `  t = ${now} ,  v0 = legacy_val , v1 = ${signature}  `;

      const isValid = await verifyWebhookSignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(true);
    });
  });

  describe("constructWebhookEvent", () => {
    it("returns parsed WebhookSuccessPayload on successful verification", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const event = await constructWebhookEvent<WebhookSuccessPayload>({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(event.id).toBe("whd_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
      expect(event.status).toBe("succeeded");
      expect(event.cost_dzd).toBe(1.5);
      expect(event.settlement).toBe("settled");
      expect(event.results[0]?.generated_text).toBe("Inference response text.");
    });

    it("returns parsed WebhookErrorPayload on successful verification of failure payload", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_ERROR_PAYLOAD, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const event = await constructWebhookEvent<WebhookErrorPayload>({
        rawBody: SAMPLE_ERROR_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(event.id).toBe("whd_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
      expect(event.status).toBe("failed");
      expect(event.cost_dzd).toBeNull();
      expect(event.settlement).toBe("failed");
      expect(event.error.type).toBe("inference_failed");
    });

    it("throws DevupWebhookVerificationError with 'malformed_header' for missing timestamp", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `v1=${signature}`;

      await expect(
        constructWebhookEvent({
          rawBody: SAMPLE_SUCCESS_PAYLOAD,
          signatureHeader: header,
          secret: TEST_SECRET,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(DevupWebhookVerificationError);
        const webhookErr = err as DevupWebhookVerificationError;
        expect(webhookErr.reason).toBe("malformed_header");
        expect(webhookErr.message).toContain("timestamp");
        return true;
      });
    });

    it("throws DevupWebhookVerificationError with 'malformed_header' for missing v1", async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = `t=${now}`;

      await expect(
        constructWebhookEvent({
          rawBody: SAMPLE_SUCCESS_PAYLOAD,
          signatureHeader: header,
          secret: TEST_SECRET,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(DevupWebhookVerificationError);
        const webhookErr = err as DevupWebhookVerificationError;
        expect(webhookErr.reason).toBe("malformed_header");
        expect(webhookErr.message).toContain("v1");
        return true;
      });
    });

    it("throws DevupWebhookVerificationError with 'timestamp_outside_tolerance' for expired timestamp", async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 350;
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, expiredTime);
      const header = `t=${expiredTime},v1=${signature}`;

      await expect(
        constructWebhookEvent({
          rawBody: SAMPLE_SUCCESS_PAYLOAD,
          signatureHeader: header,
          secret: TEST_SECRET,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(DevupWebhookVerificationError);
        const webhookErr = err as DevupWebhookVerificationError;
        expect(webhookErr.reason).toBe("timestamp_outside_tolerance");
        expect(webhookErr.message).toContain("Timestamp outside tolerance");
        return true;
      });
    });

    it("throws DevupWebhookVerificationError with 'no_matching_signature' for wrong signature", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, "wrong_secret", now);
      const header = `t=${now},v1=${signature}`;

      await expect(
        constructWebhookEvent({
          rawBody: SAMPLE_SUCCESS_PAYLOAD,
          signatureHeader: header,
          secret: TEST_SECRET,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(DevupWebhookVerificationError);
        const webhookErr = err as DevupWebhookVerificationError;
        expect(webhookErr.reason).toBe("no_matching_signature");
        expect(webhookErr.message).toContain("No matching signature");
        return true;
      });
    });

    it("throws DevupWebhookVerificationError with 'invalid_json' for valid signature over malformed JSON", async () => {
      const now = Math.floor(Date.now() / 1000);
      const malformedJsonBody = "{ this is not valid JSON }";
      const signature = await computeSignature(malformedJsonBody, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      await expect(
        constructWebhookEvent({
          rawBody: malformedJsonBody,
          signatureHeader: header,
          secret: TEST_SECRET,
        })
      ).rejects.toSatisfy((err) => {
        expect(err).toBeInstanceOf(DevupWebhookVerificationError);
        const webhookErr = err as DevupWebhookVerificationError;
        expect(webhookErr.reason).toBe("invalid_json");
        expect(webhookErr.message).toContain("Failed to parse verified webhook payload as JSON");
        return true;
      });
    });
  });

  describe("DevupAI Client Namespace Delegation", () => {
    const client = new DevupAI({ apiKey: "unused" });

    it("client.webhooks.verifySignature delegates to standalone verifyWebhookSignature", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const isValid = await client.webhooks.verifySignature({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(isValid).toBe(true);
    });

    it("client.webhooks.constructEvent delegates to standalone constructWebhookEvent", async () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = await computeSignature(SAMPLE_SUCCESS_PAYLOAD, TEST_SECRET, now);
      const header = `t=${now},v1=${signature}`;

      const event = await client.webhooks.constructEvent<WebhookSuccessPayload>({
        rawBody: SAMPLE_SUCCESS_PAYLOAD,
        signatureHeader: header,
        secret: TEST_SECRET,
      });

      expect(event.id).toBe("whd_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
      expect(event.status).toBe("succeeded");
    });
  });
});
