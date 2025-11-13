/**
 * Webhook Signature Utilities
 * HMAC-SHA256 signing and verification for secure webhooks
 */

import { createHmac } from "crypto";

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * @param payload - The webhook payload object to sign
 * @param secret - Shared secret key for signing
 * @returns Hex-encoded HMAC signature
 */
export function generateWebhookSignature(
  payload: Record<string, any>,
  secret: string,
): string {
  const payloadString = JSON.stringify(payload);
  const hmac = createHmac("sha256", secret);
  hmac.update(payloadString);
  return hmac.digest("hex");
}

/**
 * Verify webhook signature matches expected payload
 * Uses constant-time comparison to prevent timing attacks
 * @param payload - The webhook payload object
 * @param signature - The signature to verify
 * @param secret - Shared secret key for verification
 * @returns True if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: Record<string, any>,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);

  // Use crypto.timingSafeEqual for constant-time comparison
  // This prevents timing attacks where an attacker could learn
  // information about the secret by measuring comparison time
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  try {
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Send webhook with retry logic and exponential backoff
 * @param url - Webhook endpoint URL
 * @param payload - Data to send
 * @param options - Configuration options
 * @returns Response object if successful, null if all retries failed
 */
export async function sendWebhookWithRetry(
  url: string,
  payload: Record<string, any>,
  options: {
    secret?: string;
    retryAttempts?: number;
    retryDelay?: number;
    timeout?: number;
  } = {},
): Promise<Response | null> {
  const {
    secret,
    retryAttempts = 3,
    retryDelay = 1000,
    timeout = 5000,
  } = options;

  // Generate signature if secret provided
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Asset-Forge-CDN-Webhook/1.0",
  };

  if (secret) {
    const signature = generateWebhookSignature(payload, secret);
    headers["X-Webhook-Signature"] = signature;
  }

  // Try sending webhook with exponential backoff
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      console.log(
        `[Webhook] Attempt ${attempt + 1}/${retryAttempts}: POST ${url}`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[Webhook] Success: ${response.status} ${response.statusText}`);
        return response;
      }

      // Log non-200 responses
      const responseText = await response.text();
      console.warn(
        `[Webhook] Non-OK response: ${response.status} ${response.statusText}`,
      );
      console.warn(`[Webhook] Response body: ${responseText}`);

      // Don't retry on 4xx errors (client errors - bad payload)
      if (response.status >= 400 && response.status < 500) {
        console.error(
          `[Webhook] Client error ${response.status}, not retrying`,
        );
        return response;
      }

      // Retry on 5xx errors (server errors)
      if (attempt < retryAttempts - 1) {
        const delayMs = retryDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`[Webhook] Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(
        `[Webhook] Attempt ${attempt + 1} failed:`,
        error instanceof Error ? error.message : String(error),
      );

      // Retry on network errors
      if (attempt < retryAttempts - 1) {
        const delayMs = retryDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`[Webhook] Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(`[Webhook] All ${retryAttempts} attempts failed`);
  return null;
}

/**
 * Extract asset ID from file path
 * Examples:
 *   "models/sword-123/sword-123.glb" → "sword-123"
 *   "models/character-abc/texture.png" → "character-abc"
 * @param filePath - Relative file path
 * @returns Asset ID or null if not found
 */
export function extractAssetId(filePath: string): string | null {
  // Remove leading slashes
  const cleanPath = filePath.replace(/^\/+/, "");

  // Split by slashes
  const parts = cleanPath.split("/");

  // For paths like "models/asset-id/file.ext", asset ID is the second part
  if (parts.length >= 2) {
    return parts[1];
  }

  return null;
}
