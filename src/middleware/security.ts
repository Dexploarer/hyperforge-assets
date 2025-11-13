/**
 * Security Headers Middleware
 * Adds comprehensive security headers to all responses
 * Protects against common web vulnerabilities
 */

import { Elysia } from "elysia";

export interface SecurityHeadersConfig {
  /**
   * Content Security Policy directives
   * Default: Permissive for CDN use case
   */
  contentSecurityPolicy?: string;
  /**
   * Enable HSTS (HTTP Strict Transport Security)
   * Default: true in production
   */
  hsts?: boolean;
  /**
   * HSTS max-age in seconds
   * Default: 31536000 (1 year)
   */
  hstsMaxAge?: number;
  /**
   * Enable HSTS preload
   * Default: false (requires manual submission to preload list)
   */
  hstsPreload?: boolean;
  /**
   * X-Frame-Options value
   * Default: "SAMEORIGIN"
   */
  frameOptions?: "DENY" | "SAMEORIGIN" | "ALLOW-FROM";
  /**
   * Referrer Policy
   * Default: "strict-origin-when-cross-origin"
   */
  referrerPolicy?: string;
}

/**
 * Security headers middleware
 * Applies comprehensive security headers to protect against common attacks
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const isProduction = process.env.NODE_ENV === "production";

  // Default CSP for CDN - permissive but secure
  const defaultCSP = [
    "default-src 'self'",
    "img-src * data: blob:",
    "media-src * data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for dashboard
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return new Elysia({ name: "security-headers" }).onAfterHandle(
    ({ response, set }) => {
      // Skip if not a Response object
      if (!(response instanceof Response)) {
        return response;
      }

      const headers = new Headers(response.headers);

      // Content Security Policy
      if (!headers.has("content-security-policy")) {
        headers.set(
          "content-security-policy",
          config.contentSecurityPolicy || defaultCSP,
        );
      }

      // X-Content-Type-Options: Prevent MIME sniffing
      if (!headers.has("x-content-type-options")) {
        headers.set("x-content-type-options", "nosniff");
      }

      // X-Frame-Options: Prevent clickjacking
      if (!headers.has("x-frame-options")) {
        const frameOptions = config.frameOptions || "SAMEORIGIN";
        headers.set("x-frame-options", frameOptions);
      }

      // X-XSS-Protection: Enable XSS filter (legacy browsers)
      if (!headers.has("x-xss-protection")) {
        headers.set("x-xss-protection", "1; mode=block");
      }

      // Referrer-Policy: Control referrer information
      if (!headers.has("referrer-policy")) {
        const referrerPolicy =
          config.referrerPolicy || "strict-origin-when-cross-origin";
        headers.set("referrer-policy", referrerPolicy);
      }

      // Permissions-Policy: Disable unnecessary browser features
      if (!headers.has("permissions-policy")) {
        headers.set(
          "permissions-policy",
          "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
        );
      }

      // Strict-Transport-Security: Force HTTPS (production only)
      const enableHsts = config.hsts ?? isProduction;
      if (enableHsts && !headers.has("strict-transport-security")) {
        const maxAge = config.hstsMaxAge || 31536000; // 1 year
        const preload = config.hstsPreload ? "; preload" : "";
        headers.set(
          "strict-transport-security",
          `max-age=${maxAge}; includeSubDomains${preload}`,
        );
      }

      // Cross-Origin-Opener-Policy: Isolate browsing context
      if (!headers.has("cross-origin-opener-policy")) {
        headers.set("cross-origin-opener-policy", "same-origin");
      }

      // Cross-Origin-Resource-Policy: Control resource loading
      // Set to "cross-origin" for CDN to allow loading from other origins
      if (!headers.has("cross-origin-resource-policy")) {
        headers.set("cross-origin-resource-policy", "cross-origin");
      }

      // Cross-Origin-Embedder-Policy: Control embedding
      if (!headers.has("cross-origin-embedder-policy")) {
        headers.set("cross-origin-embedder-policy", "unsafe-none");
      }

      // X-Powered-By: Remove (don't advertise tech stack)
      headers.delete("x-powered-by");

      // Server: Remove or minimize (don't advertise server info)
      if (headers.has("server")) {
        headers.set("server", "CDN");
      }

      // Create new response with security headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  );
}

/**
 * Preset: Strict security headers for production
 */
export const strictSecurity = securityHeaders({
  hsts: true,
  hstsMaxAge: 31536000,
  hstsPreload: false,
  frameOptions: "DENY",
  referrerPolicy: "strict-origin-when-cross-origin",
  contentSecurityPolicy: [
    "default-src 'self'",
    "img-src * data: blob:",
    "media-src * data: blob:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
});

/**
 * Preset: Moderate security headers for development
 */
export const moderateSecurity = securityHeaders({
  hsts: false,
  frameOptions: "SAMEORIGIN",
  referrerPolicy: "strict-origin-when-cross-origin",
});
