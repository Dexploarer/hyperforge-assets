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

// Auth Status Response
export const AuthStatusResponse = t.Object({
  authEnabled: t.Boolean(),
  authenticated: t.Boolean(),
});

// Directory Statistics
export const DirectoryStats = t.Object({
  name: t.String(),
  fileCount: t.Number(),
  totalSize: t.Number(),
});

export const DirectoryStatsResponse = t.Object({
  directories: t.Array(DirectoryStats),
});

// Delete Response
export const DeleteResponse = t.Object({
  success: t.Boolean(),
  error: t.Optional(t.String()),
});

// Rename Request & Response
export const RenameRequestBody = t.Object({
  oldPath: t.String(),
  newName: t.String(),
});

export const RenameResponse = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

// Bulk Delete Request & Response
export const BulkDeleteRequestBody = t.Object({
  filePaths: t.Array(t.String()),
});

export const BulkDeleteResponse = t.Object({
  success: t.Boolean(),
  deleted: t.Number(),
  failed: t.Number(),
  error: t.Optional(t.String()),
});
