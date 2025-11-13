# Asset-Forge CDN

Production-ready Elysia.js TypeScript CDN for serving stable game assets from Asset-Forge.

## Architecture

```
Asset-Forge (Creation) → CDN (Buffer/Stable) → Game Servers (Consumption)
```

This CDN acts as a buffer between asset creation and production consumption, ensuring:

- Stable, versioned asset delivery
- High-performance static file serving with Bun + Elysia
- Separation of concerns between creation and serving
- Type-safe API with runtime validation

## Features

- **Static Asset Serving**: Fast delivery of GLB models, textures, audio, metadata via Bun.file()
- **File Upload API**: Type-safe push of assets from Asset-Forge with TypeBox validation
- **Audio Support**: Full support for music, SFX, and voice files (MP3, WAV, OGG, WebM)
- **Asset Listing**: Query available assets with metadata
- **Asset Browser**: Web-based dashboard for browsing CDN contents
- **CORS Enabled**: Cross-origin support for game clients
- **Swagger Documentation**: Auto-generated API docs at `/swagger`
- **Kubernetes-Ready**: Health probes for liveness and readiness
- **Graceful Shutdown**: Clean handling of in-flight requests
- **Error Handling**: Global error middleware with structured responses
- **Railway Volume Support**: Persistent storage in production

## Setup

### Local Development

1. Install dependencies:

```bash
bun install
```

2. Create `.env` from example:

```bash
cp .env.example .env
```

3. Start server:

```bash
bun run dev
```

Server runs at `http://localhost:3005`

### Production (Railway)

1. Create new Railway project
2. Connect this repository
3. Add a volume:
   - Mount path: `/data`
   - This persists the `models/` directory

4. Set environment variables:

```
PORT=3005
DATA_DIR=/data
CORS_ORIGIN=https://yourgame.com
```

5. Deploy!

## API Endpoints

### Swagger Documentation

```bash
GET /swagger
```

Interactive API documentation with request/response schemas.

### Health Checks

```bash
# Kubernetes liveness probe
GET /api/health/live

# Kubernetes readiness probe
GET /api/health/ready

# Legacy health check (backward compatible)
GET /api/health
```

### List Assets

```bash
GET /api/assets
```

Returns all files in the CDN with metadata (path, size, modified date, type).

### Upload Assets

```bash
POST /api/upload
Content-Type: multipart/form-data

files: <File>[]            # Required - One or more files (max 100MB each)
directory: "models"        # Optional - Target directory (default: "models")
```

Supported file types:
- `model/gltf-binary` - GLB 3D models
- `image/*` - PNG, JPG, WebP images
- `application/json` - Metadata files
- `text/plain` - Text files
- `audio/mpeg` - MP3 audio (music, SFX, voice)
- `audio/wav` - WAV audio
- `audio/ogg` - OGG Vorbis audio
- `audio/webm` - WebM audio

### Serve Assets

```bash
GET /models/{assetId}/{file}
GET /emotes/{emoteId}/{file}
GET /music/{category}/{file}
```

Both GET and HEAD requests supported. Returns files with immutable cache headers.

Examples:

```bash
# Models
GET /models/pickaxe-steel/pickaxe-steel.glb
GET /models/pickaxe-steel/metadata.json
GET /models/pickaxe-steel/concept-art.png
HEAD /models/pickaxe-steel/pickaxe-steel.glb

# Music & Audio
GET /music/normal/1.mp3
GET /music/combat/battle-theme.mp3
GET /music/draft/sfx/sword-clash-001.mp3
GET /models/npc_gareth_guard/voice/greeting.mp3

# Emotes
GET /emotes/emote-jump.glb
```

### Asset Browser Dashboard

```bash
GET /dashboard
```

Interactive web UI for browsing all CDN assets. Useful for development and QA.

## Integration with Asset-Forge

Asset-Forge can push assets to the CDN after creation:

```typescript
// In Asset-Forge
async function publishToCDN(assetId: string) {
  const assetPath = `gdd-assets/${assetId}`;
  const files = await fs.readdir(assetPath);

  const formData = new FormData();
  for (const file of files) {
    const blob = await Bun.file(`${assetPath}/${file}`).blob();
    formData.append("files", blob, `${assetId}/${file}`);
  }

  await fetch("https://cdn.asset-forge.com/api/upload", {
    method: "POST",
    body: formData,
  });
}
```

## Directory Structure

```
asset-forge-cdn/
├── src/
│   ├── index.ts                # Main Elysia application
│   ├── routes/
│   │   ├── health.ts           # Kubernetes-ready health checks
│   │   ├── assets.ts           # Asset listing endpoint
│   │   └── upload.ts           # File upload with validation
│   ├── types/
│   │   └── models.ts           # TypeBox schemas
│   ├── middleware/
│   │   └── errorHandler.ts    # Global error handling
│   ├── plugins/
│   │   └── graceful-shutdown.ts # Lifecycle management
│   └── utils/
│       └── file-helpers.ts     # File system utilities
├── models/                     # Model storage (volume-backed in production)
│   ├── pickaxe-steel/
│   │   ├── pickaxe-steel.glb
│   │   ├── metadata.json
│   │   └── concept-art.png
│   ├── npc_gareth_guard/
│   │   ├── npc_gareth_guard.glb
│   │   └── voice/              # NPC voice files
│   │       ├── greeting.mp3
│   │       └── accept_quest.mp3
│   └── bow-oak/
│       ├── bow-oak.glb
│       └── metadata.json
├── emotes/                     # Emote/animation storage
│   ├── emote-jump.glb
│   └── emote-run.glb
├── music/                      # Music and audio storage
│   ├── normal/                 # Background music
│   │   ├── 1.mp3
│   │   └── 2.mp3
│   ├── combat/                 # Battle music
│   └── draft/                  # WIP audio
│       ├── music/
│       └── sfx/                # Sound effects
├── dashboard/                  # Asset browser web UI
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── package.json                # Dependencies (Elysia 1.4.15)
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Environment template
└── README.md
```

## Performance

- **Bun Runtime**: Native performance with zero-overhead HTTP
- **Elysia Framework**: 22x faster than Express, optimized for Bun
- **Immutable Cache Headers**: 1 year cache for stable assets
- **Direct File Serving**: Uses Bun.file() pattern (no plugin overhead)
- **TypeScript**: Full type safety with zero runtime cost
- **Handles 100K+ req/sec**: On modern hardware

## Security

- CORS configurable via `CORS_ORIGIN`
- No authentication by default (CDN is public)
- Add auth via Railway service tokens if needed
- Path traversal protection built-in

## Monitoring

### Health Checks

```bash
# Basic health (legacy)
curl https://cdn.asset-forge.com/api/health

# Kubernetes liveness
curl https://cdn.asset-forge.com/api/health/live

# Kubernetes readiness
curl https://cdn.asset-forge.com/api/health/ready
```

### Metrics

- View API documentation: `https://cdn.asset-forge.com/swagger`
- Monitor upload activity via server logs
- Check asset count: `curl https://cdn.asset-forge.com/api/assets | jq '.files | length'`

## Development

### Type Checking

```bash
bun run typecheck
```

### Running Tests

Visit the Swagger UI at `/swagger` to test endpoints interactively.

## Technology Stack

- **Runtime**: Bun 1.1.38+
- **Framework**: Elysia 1.4.15
- **Validation**: TypeBox (via Elysia)
- **TypeScript**: 5.9.3 with strict mode
- **CORS**: @elysiajs/cors 1.4.0
- **Documentation**: @elysiajs/swagger 1.3.1

## License

MIT
