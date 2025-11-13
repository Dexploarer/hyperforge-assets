/**
 * Advanced File Serving Utilities
 * Handles range requests, ETags, and efficient file streaming
 */

import type { Context } from "elysia";
import {
  parseRangeHeader,
  generateContentRangeHeader,
  generateETag,
  checkETagMatch,
  type RangeResult,
} from "./range-handler";

export interface ServeFileOptions {
  /**
   * Cache-Control max-age in seconds (default: 31536000 = 1 year)
   */
  maxAge?: number;
  /**
   * Whether to mark as immutable (default: true)
   */
  immutable?: boolean;
  /**
   * Custom Content-Type override
   */
  contentType?: string;
}

/**
 * Serve a file with range request support, ETags, and caching
 * Automatically handles:
 * - Range requests for video/audio streaming
 * - ETag generation and If-None-Match conditional requests
 * - Immutable cache headers for CDN optimization
 * - Proper 206 Partial Content responses
 * - 304 Not Modified responses
 */
export async function serveFile(
  filePath: string,
  context: Context,
  options: ServeFileOptions = {},
): Promise<Response> {
  const { set, request } = context;
  const file = Bun.file(filePath);

  // Check if file exists
  if (!(await file.exists())) {
    set.status = 404;
    return new Response("File not found", { status: 404 });
  }

  const fileSize = file.size;
  const lastModified = file.lastModified;

  // Generate ETag
  const etag = generateETag(fileSize, lastModified);

  // Check If-None-Match for conditional requests
  const ifNoneMatch = request.headers.get("if-none-match");
  if (checkETagMatch(etag, ifNoneMatch || undefined)) {
    // Resource hasn't changed - return 304 Not Modified
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": buildCacheControl(options),
      },
    });
  }

  // Parse range header
  const rangeHeader = request.headers.get("range");
  const range = parseRangeHeader(rangeHeader || undefined, fileSize);

  if (!range) {
    // Invalid range - return 416 Range Not Satisfiable
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  // Determine content type
  const contentType =
    options.contentType || file.type || "application/octet-stream";

  // Build response headers
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": range.contentLength.toString(),
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Last-Modified": new Date(lastModified).toUTCString(),
    "Cache-Control": buildCacheControl(options),
  };

  // If partial content (range request), add Content-Range header
  if (range.isPartial) {
    headers["Content-Range"] = generateContentRangeHeader(range);
  }

  // For range requests, use Bun.file().slice()
  if (range.isPartial) {
    const slice = file.slice(range.start, range.end + 1);
    return new Response(slice, {
      status: 206, // Partial Content
      headers,
    });
  }

  // Return full file
  return new Response(file, {
    status: 200,
    headers,
  });
}

/**
 * Build Cache-Control header value
 */
function buildCacheControl(options: ServeFileOptions): string {
  const maxAge = options.maxAge ?? 31536000; // Default 1 year
  const immutable = options.immutable ?? true;

  const parts = ["public", `max-age=${maxAge}`];

  if (immutable) {
    parts.push("immutable");
  }

  return parts.join(", ");
}

/**
 * Serve file for HEAD requests (no body)
 */
export async function serveFileHead(
  filePath: string,
  context: Context,
  options: ServeFileOptions = {},
): Promise<Response> {
  const { set, request } = context;
  const file = Bun.file(filePath);

  // Check if file exists
  if (!(await file.exists())) {
    set.status = 404;
    return new Response(null, { status: 404 });
  }

  const fileSize = file.size;
  const lastModified = file.lastModified;

  // Generate ETag
  const etag = generateETag(fileSize, lastModified);

  // Check If-None-Match
  const ifNoneMatch = request.headers.get("if-none-match");
  if (checkETagMatch(etag, ifNoneMatch || undefined)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": buildCacheControl(options),
      },
    });
  }

  // Determine content type
  const contentType =
    options.contentType || file.type || "application/octet-stream";

  // Return headers only
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
      ETag: etag,
      "Last-Modified": new Date(lastModified).toUTCString(),
      "Cache-Control": buildCacheControl(options),
    },
  });
}
