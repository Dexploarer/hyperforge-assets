/**
 * TypeBox Models for API Validation
 * Elysia uses TypeBox for runtime validation and type inference
 */

import { t } from "elysia";

// Health Check Response
export const HealthResponse = t.Object({
  status: t.String(),
  timestamp: t.String(),
  cdn: t.Optional(t.String()),
});

// File Metadata
export const FileMetadata = t.Object({
  path: t.String(),
  name: t.String(),
  size: t.Number(),
  modified: t.String(),
  type: t.String(),
});

// Assets List Response
export const AssetsListResponse = t.Object({
  files: t.Array(FileMetadata),
});

// Upload Request Body
export const UploadRequestBody = t.Object({
  files: t.Files({
    maxSize: "100m",
    // Allow GLB models, images, JSON metadata, and audio files
    type: [
      "model/gltf-binary", // 3D models
      "image/*", // PNG, JPG, WebP, etc.
      "application/json", // Metadata files
      "text/plain", // Text files
      "audio/mpeg", // MP3 audio (music, SFX, voice)
      "audio/wav", // WAV audio
      "audio/ogg", // OGG Vorbis audio
      "audio/webm", // WebM audio
    ],
  }),
  directory: t.Optional(t.String()),
});

// Upload Response
export const UploadResponse = t.Object({
  success: t.Boolean(),
  files: t.Optional(
    t.Array(
      t.Object({
        name: t.String(),
        size: t.Number(),
        path: t.String(),
      })
    )
  ),
  error: t.Optional(t.String()),
});

// Error Response
export const ErrorResponse = t.Object({
  error: t.String(),
  message: t.String(),
  details: t.Optional(t.String()),
});
