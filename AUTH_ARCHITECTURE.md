# CDN Authentication Architecture

## TL;DR

**Users DON'T get separate API keys.** They use their **existing Privy authentication**.

The CDN supports **two authentication methods**:

1. **Service API Key** (Backend-to-backend) - Asset-Forge backend → CDN
2. **Privy JWT** (User-to-CDN) - User browser → CDN (optional, future feature)

## Authentication Flow Diagrams

### Current Flow: Backend Publishes Assets

```
┌─────────────┐                  ┌──────────────────┐                 ┌─────────┐
│   User      │                  │  Asset-Forge     │                 │   CDN   │
│  (Browser)  │                  │    Backend       │                 │         │
└─────────────┘                  └──────────────────┘                 └─────────┘
      │                                   │                                  │
      │ 1. Login with Privy               │                                  │
      │──────────────────────────────────>│                                  │
      │    (Wallet signature)             │                                  │
      │                                   │                                  │
      │ 2. Generate Asset Request         │                                  │
      │──────────────────────────────────>│                                  │
      │    + Privy JWT Token              │                                  │
      │                                   │                                  │
      │                                   │ 3. Validate User's Privy Token   │
      │                                   │    (User is authenticated)       │
      │                                   │                                  │
      │                                   │ 4. Generate Asset                │
      │                                   │    (Create GLB, textures, etc)   │
      │                                   │                                  │
      │                                   │ 5. Publish to CDN                │
      │                                   │    + Service API Key             │
      │                                   │─────────────────────────────────>│
      │                                   │    X-API-Key: ioKpjOt...         │
      │                                   │                                  │
      │                                   │                                  │ 6. Validate Service Key
      │                                   │                                  │    (CDN trusts backend)
      │                                   │                                  │
      │                                   │ 7. Upload Success                │
      │                                   │<─────────────────────────────────│
      │                                   │    {cdnUrls: [...]}             │
      │                                   │                                  │
      │ 8. Asset Ready                    │                                  │
      │<──────────────────────────────────│                                  │
      │    + CDN URLs                     │                                  │
      │                                   │                                  │
      │ 9. Load Asset from CDN            │                                  │
      │───────────────────────────────────────────────────────────────────>│
      │    GET /models/asset-id/asset.glb │                                  │
      │    (No auth needed - public read) │                                  │
      │                                   │                                  │
```

**Key Points:**

- User authenticates ONCE with Privy in Asset-Forge
- User NEVER talks to CDN upload endpoint
- Backend uses service API key to publish
- CDN files are publicly readable (no auth on GET)

### Future Flow: Direct User Uploads (Optional)

```
┌─────────────┐                                                      ┌─────────┐
│   User      │                                                      │   CDN   │
│  (Browser)  │                                                      │         │
└─────────────┘                                                      └─────────┘
      │                                                                    │
      │ 1. Login with Privy (in Asset-Forge)                              │
      │    Gets JWT token                                                  │
      │                                                                    │
      │ 2. Upload directly to CDN                                          │
      │    Authorization: Bearer <privy-jwt-token>                         │
      │───────────────────────────────────────────────────────────────────>│
      │                                                                    │
      │                                                                    │ 3. Validate Privy JWT
      │                                                                    │    (CDN calls Privy API)
      │                                                                    │
      │ 4. Upload Success                                                  │
      │<───────────────────────────────────────────────────────────────────│
      │    User's files now on CDN                                         │
```

## Authentication Methods Explained

### Method 1: Service API Key (Current)

**Purpose:** Secure backend-to-backend communication

**How it works:**

1. Asset-Forge backend has `CDN_API_KEY` in environment
2. When publishing assets, backend includes key in request:
   ```typescript
   headers: {
     'X-API-Key': process.env.CDN_API_KEY
   }
   ```
3. CDN validates the key matches its configured `CDN_API_KEY`

**Configuration:**

```bash
# Asset-Forge .env
CDN_API_KEY=ioKpjOt02sIDBtRE77Z7zDDwzmjHw6_jIHLuYZ8lzX8

# CDN .env
CDN_API_KEY=ioKpjOt02sIDBtRE77Z7zDDwzmjHw6_jIHLuYZ8lzX8
```

**Usage:**

```typescript
// Asset-Forge backend
const cdnService = CDNPublishService.fromEnv("gdd-assets");
await cdnService.publishAsset("pickaxe-steel");
// Automatically adds X-API-Key header
```

### Method 2: Privy JWT (Optional - Future)

**Purpose:** Allow users to upload directly from browser

**How it works:**

1. User authenticates with Privy in Asset-Forge frontend
2. Frontend gets JWT token from Privy
3. Frontend uploads directly to CDN with JWT:
   ```typescript
   headers: {
     'Authorization': `Bearer ${privyJwtToken}`
   }
   ```
4. CDN validates JWT by calling Privy's API
5. If valid, user can upload

**Configuration:**

```bash
# CDN .env
PRIVY_APP_ID=cmhr5kvfp00hxl40c5aebrci5
PRIVY_APP_SECRET=4YQTtAxEojLLfdpDwbvozo4gUPA368ZHMvR4ejVFB4VJQDLbjh9zJX72ZJqVZMG4nc51fgJHdBYNuudDc7ZbEjhA
```

**Usage:**

```typescript
// Asset-Forge frontend (future feature)
import { usePrivy } from "@privy-io/react-auth";

const { getAccessToken } = usePrivy();
const token = await getAccessToken();

// Upload directly to CDN
await fetch("https://cdn.asset-forge.com/api/upload", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

## Security Model

### Service API Key

- ✅ Shared secret between Asset-Forge backend and CDN
- ✅ Never exposed to browsers/users
- ✅ Rotatable independently
- ✅ Fast validation (simple string comparison)
- ❌ Single point of failure if leaked
- ❌ No per-user tracking/quotas

### Privy JWT

- ✅ Per-user authentication (individual tracking)
- ✅ Short-lived tokens (automatic expiry)
- ✅ Cryptographically signed (can't be forged)
- ✅ Wallet-based identity (decentralized)
- ✅ Per-user rate limiting possible
- ❌ Requires Privy API call to validate (slower)
- ❌ Adds dependency on Privy service

## When to Use Which Method?

### Use Service API Key when:

- ✅ Asset-Forge backend publishes after generation
- ✅ Centralized control over uploads
- ✅ Backend can enforce business logic (quotas, validation)
- ✅ Fast, simple authentication needed
- ✅ **This is the current/recommended approach**

### Use Privy JWT when:

- ✅ Users upload directly from browser (bypassing backend)
- ✅ Need per-user tracking/quotas
- ✅ Want decentralized authentication
- ✅ Building user-facing upload features
- ✅ **Future feature - not currently needed**

## Implementation Details

### CDN Authentication Middleware

The CDN now has a flexible `requireAuth()` middleware that accepts **both** methods:

```typescript
// src/middleware/auth.ts

export function requireAuth() {
  return new Elysia().derive(async ({ request, set }) => {
    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");

    // Try service API key first
    if (apiKeyHeader || (authHeader && !authHeader.includes("."))) {
      const key = apiKeyHeader || authHeader?.substring(7);
      if (key === process.env.CDN_API_KEY) {
        return {
          authenticated: true,
          authType: "service",
          userId: "asset-forge-backend",
        };
      }
    }

    // Try Privy JWT (if configured)
    if (authHeader?.startsWith("Bearer ") && authHeader.includes(".")) {
      const token = authHeader.substring(7);
      const privyUser = await validatePrivyToken(token);
      if (privyUser) {
        return {
          authenticated: true,
          authType: "privy",
          userId: privyUser.userId,
          walletAddress: privyUser.walletAddress,
        };
      }
    }

    // Authentication failed
    throw new Error("UNAUTHORIZED");
  });
}
```

### Detecting Auth Type

The middleware automatically detects which auth method is being used:

- **X-API-Key header** → Service API Key
- **Short Bearer token (no dots)** → Service API Key
- **Long Bearer token (with dots)** → Privy JWT

### Using requireAuth vs requireApiKey

```typescript
// Use requireApiKey() for service-only endpoints
.use(requireApiKey())  // Only accepts service API key

// Use requireAuth() for flexible endpoints
.use(requireAuth())    // Accepts both service key and Privy JWT
```

## Current Upload Route

The upload route currently uses `requireApiKey()` (service-only):

```typescript
// src/routes/upload.ts
export function createUploadRoute(rootDir: string) {
  return new Elysia()
    .use(requireApiKey()) // Service API key only
    .use(uploadRateLimit) // 10 uploads/hour
    .post("/upload", handler);
}
```

To enable direct user uploads, change to:

```typescript
// src/routes/upload.ts
export function createUploadRoute(rootDir: string) {
  return new Elysia()
    .use(requireAuth()) // Accept both methods
    .use(uploadRateLimit) // 10 uploads/hour
    .post("/upload", handler);
}
```

## Environment Configuration

### Asset-Forge Backend

```bash
# .env
CDN_URL=<your-cdn-url>
CDN_API_KEY=ioKpjOt02sIDBtRE77Z7zDDwzmjHw6_jIHLuYZ8lzX8
```

### CDN

```bash
# .env

# Service API Key (required)
CDN_API_KEY=ioKpjOt02sIDBtRE77Z7zDDwzmjHw6_jIHLuYZ8lzX8

# Privy JWT (optional - for direct user uploads)
PRIVY_APP_ID=cmhr5kvfp00hxl40c5aebrci5
PRIVY_APP_SECRET=4YQTtAxEojLLfdpDwbvozo4gUPA368ZHMvR4ejVFB4VJQDLbjh9zJX72ZJqVZMG4nc51fgJHdBYNuudDc7ZbEjhA
```

## FAQ

### Q: Do users need to generate API keys?

**A:** No! Users authenticate with Privy (wallet signature). No separate keys needed.

### Q: What is CDN_API_KEY for?

**A:** It's for Asset-Forge **backend** to securely talk to CDN. Not for users.

### Q: Can users upload directly to CDN?

**A:** Not currently, but the CDN supports it via Privy JWT if enabled.

### Q: Why not just use Privy everywhere?

**A:** Service keys are faster and simpler for backend-to-backend. Privy is better for user-facing features.

### Q: Is the service API key secure?

**A:** Yes, it's only stored in backend environment variables, never exposed to browsers.

### Q: How do I rotate the API key?

**A:**

1. Generate new key: `bun -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. Update both Asset-Forge and CDN .env files
3. Restart both servers

### Q: What if the API key leaks?

**A:** Rotate it immediately. Only the CDN upload endpoint is affected (read access is public).

## Summary

✅ **Current Architecture (Correct):**

- Users authenticate with Privy in Asset-Forge
- Backend uses service API key to publish to CDN
- Users read from CDN publicly (no auth)

✅ **Future Architecture (Optional):**

- Users can also upload directly to CDN
- CDN validates their Privy JWT token
- Per-user tracking and quotas possible

🔐 **Security:**

- Service key never exposed to browsers
- Privy JWT validated cryptographically
- Both methods supported by CDN
- Rate limiting on all uploads

The CDN is now **flexible** - it can handle both backend-to-backend (current) and user-to-CDN (future) authentication seamlessly!
