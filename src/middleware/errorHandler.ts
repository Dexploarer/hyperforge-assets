/**
 * Global Error Handler Middleware
 * Handles validation errors, not found, parse errors, and internal server errors
 */

import { Elysia } from "elysia";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set, request }) => {
    const url = new URL(request.url);

    // Handle Elysia validation errors
    if (code === "VALIDATION") {
      set.status = 400;
      console.error("[Validation Error]", url.pathname, error instanceof Error ? error.message : String(error));

      return {
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        details:
          error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : "Invalid request data",
      };
    }

    // Handle not found errors
    if (code === "NOT_FOUND") {
      set.status = 404;
      console.warn("[Not Found]", url.pathname);

      return {
        error: "NOT_FOUND",
        message: "Endpoint not found",
      };
    }

    // Handle parse errors (invalid JSON, etc.)
    if (code === "PARSE") {
      set.status = 400;
      console.error("[Parse Error]", url.pathname, error instanceof Error ? error.message : String(error));

      return {
        error: "PARSE_ERROR",
        message: "Invalid request body format",
      };
    }

    // Handle all other errors as internal server errors
    set.status = 500;
    console.error("[Internal Error]", url.pathname, error instanceof Error ? error.message : String(error));
    if (error instanceof Error && process.env.NODE_ENV !== "production") {
      console.error(error.stack);
    }

    // Return safe error message to client in production
    return {
      error: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : "Unknown error",
      // Include stack trace only in development
      ...(process.env.NODE_ENV !== "production" &&
        error instanceof Error && {
          stack: error.stack,
        }),
    };
  }
);
