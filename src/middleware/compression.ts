/**
 * Compression Middleware
 * Handles Brotli and Gzip compression for text-based responses
 * Automatically compresses JSON, HTML, CSS, JS, and text files
 */

import { Elysia } from "elysia";
import { gzipSync, brotliCompressSync } from "zlib";

// Compressible MIME types
const COMPRESSIBLE_TYPES = new Set([
  "text/html",
  "text/css",
  "text/plain",
  "text/xml",
  "text/javascript",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/xhtml+xml",
  "application/rss+xml",
  "application/atom+xml",
  "image/svg+xml",
  "application/vnd.ms-fontobject",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
]);

// Minimum size to compress (bytes)
const MIN_COMPRESS_SIZE = 1024; // 1KB

/**
 * Check if content type is compressible
 */
function isCompressible(contentType: string | null): boolean {
  if (!contentType) return false;

  // Extract base type (ignore charset, etc.)
  const baseType = contentType.split(";")[0].trim().toLowerCase();

  return COMPRESSIBLE_TYPES.has(baseType);
}

/**
 * Get best compression method from Accept-Encoding header
 */
function selectEncoding(acceptEncoding: string | null): "br" | "gzip" | null {
  if (!acceptEncoding) return null;

  const encodings = acceptEncoding.toLowerCase();

  // Prefer Brotli (br) over Gzip for better compression
  if (encodings.includes("br")) return "br";
  if (encodings.includes("gzip")) return "gzip";

  return null;
}

/**
 * Compress data with specified encoding
 */
function compress(data: ArrayBuffer, encoding: "br" | "gzip"): Buffer {
  const buffer = Buffer.from(data);

  if (encoding === "br") {
    return brotliCompressSync(buffer, {
      params: {
        // Brotli compression level (0-11, 4 is default, 11 is max)
        // Use 6 for good balance between speed and compression
        [0]: 6,
      },
    });
  }

  // Gzip compression
  return gzipSync(buffer, {
    level: 6, // Compression level (0-9, 6 is default)
  });
}

/**
 * Compression middleware for Elysia
 * Automatically compresses responses based on Accept-Encoding header
 */
export const compression = new Elysia({ name: "compression" }).onAfterHandle(
  async ({ response, request, set }) => {
    // Skip if not a Response object
    if (!(response instanceof Response)) {
      return response;
    }

    // Check if content is already compressed
    const existingEncoding = response.headers.get("content-encoding");
    if (existingEncoding) {
      return response; // Already compressed
    }

    // Check if content type is compressible
    const contentType = response.headers.get("content-type");
    if (!isCompressible(contentType)) {
      return response; // Not compressible (e.g., images, videos, GLB files)
    }

    // Check Accept-Encoding header
    const acceptEncoding = request.headers.get("accept-encoding");
    const encoding = selectEncoding(acceptEncoding);
    if (!encoding) {
      return response; // Client doesn't support compression
    }

    // Get response body
    const arrayBuffer = await response.arrayBuffer();
    const bodySize = arrayBuffer.byteLength;

    // Skip compression for small responses
    if (bodySize < MIN_COMPRESS_SIZE) {
      return response;
    }

    // Compress the body
    const compressed = compress(arrayBuffer, encoding);

    // Create new response with compressed body
    const compressedResponse = new Response(compressed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Set Content-Encoding header
    compressedResponse.headers.set("Content-Encoding", encoding);
    compressedResponse.headers.set(
      "Content-Length",
      compressed.length.toString(),
    );

    // Add Vary header to indicate response varies by encoding
    compressedResponse.headers.set("Vary", "Accept-Encoding");

    console.log(
      `[Compression] ${encoding.toUpperCase()}: ${bodySize} → ${compressed.length} bytes (${Math.round((1 - compressed.length / bodySize) * 100)}% savings)`,
    );

    return compressedResponse;
  },
);
