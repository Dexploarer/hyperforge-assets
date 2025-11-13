/**
 * Range Request Handler Utilities
 * Handles HTTP range requests for efficient video/audio streaming
 * Supports partial content delivery for seeking in media files
 */

export interface RangeResult {
  start: number;
  end: number;
  total: number;
  contentLength: number;
  isPartial: boolean;
}

/**
 * Parse Range header from request
 * Format: "bytes=0-1023" or "bytes=1024-" or "bytes=-500"
 */
export function parseRangeHeader(
  rangeHeader: string | undefined,
  fileSize: number,
): RangeResult | null {
  if (!rangeHeader) {
    return {
      start: 0,
      end: fileSize - 1,
      total: fileSize,
      contentLength: fileSize,
      isPartial: false,
    };
  }

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    return null; // Invalid range header
  }

  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Handle suffix-byte-range-spec: "bytes=-500" (last 500 bytes)
  if (!match[1] && match[2]) {
    start = Math.max(0, fileSize - parseInt(match[2], 10));
    end = fileSize - 1;
  }

  // Validate range
  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return {
    start,
    end,
    total: fileSize,
    contentLength: end - start + 1,
    isPartial: true,
  };
}

/**
 * Generate Content-Range header value
 */
export function generateContentRangeHeader(range: RangeResult): string {
  return `bytes ${range.start}-${range.end}/${range.total}`;
}

/**
 * Check if request includes Range header
 */
export function hasRangeRequest(headers: Headers): boolean {
  return headers.get("range") !== null;
}

/**
 * Generate ETag from file metadata
 * Format: "W/{size}-{mtime}" (weak ETag for performance)
 */
export function generateETag(size: number, mtime: number): string {
  return `W/"${size}-${mtime}"`;
}

/**
 * Check if ETag matches If-None-Match header
 * Returns true if resource hasn't changed (304 should be sent)
 */
export function checkETagMatch(
  etag: string,
  ifNoneMatch: string | undefined,
): boolean {
  if (!ifNoneMatch) return false;

  // Handle multiple ETags in If-None-Match
  const tags = ifNoneMatch.split(",").map((t) => t.trim());

  // Check for exact match or wildcard
  return tags.includes(etag) || tags.includes("*");
}
