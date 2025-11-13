# Asset-Forge CDN

Lightweight CDN for serving stable game assets from Asset-Forge.

## Architecture

```
Asset-Forge (Creation) → CDN (Buffer/Stable) → Game Servers (Consumption)
```

This CDN acts as a buffer between asset creation and production consumption, ensuring:

- Stable, versioned asset delivery
- High-performance static file serving
- Separation of concerns between creation and serving

## Features

- **Static Asset Serving**: Fast delivery of GLB models, textures, metadata
- **File Upload API**: Push assets from Asset-Forge
- **Asset Listing**: Query available assets
- **CORS Enabled**: Cross-origin support for game clients
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

### Health Check

```bash
GET /api/health
```

### List Assets

```bash
GET /api/assets
```

Returns all files in the CDN with metadata.

### Upload Assets

```bash
POST /api/upload
Content-Type: multipart/form-data

files: <File>[]
directory: "models" (optional)
```

### Serve Assets

```bash
GET /models/{assetId}/{file}
```

Example:

```
GET /models/pickaxe-steel/pickaxe-steel.glb
GET /models/pickaxe-steel/metadata.json
GET /models/pickaxe-steel/concept-art.png
```

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
├── server.js           # Main CDN server
├── package.json        # Dependencies
├── .env.example        # Environment template
├── models/             # Asset storage (gitignored, volume-backed)
│   ├── pickaxe-steel/
│   │   ├── pickaxe-steel.glb
│   │   ├── metadata.json
│   │   └── concept-art.png
│   └── bow-oak/
│       ├── bow-oak.glb
│       └── metadata.json
└── README.md
```

## Performance

- Uses Bun for high-performance serving
- Immutable cache headers (1 year)
- Minimal overhead - pure static serving
- Handles 100K+ req/sec on modern hardware

## Security

- CORS configurable via `CORS_ORIGIN`
- No authentication by default (CDN is public)
- Add auth via Railway service tokens if needed
- Path traversal protection built-in

## Monitoring

Check CDN health:

```bash
curl https://cdn.asset-forge.com/api/health
```

## License

MIT
