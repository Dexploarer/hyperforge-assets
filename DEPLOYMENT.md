# Railway Deployment Guide

## Current Status
Your CDN is returning 404 "Application not found" from Railway, indicating the service is not running or properly configured.

## Diagnosis Checklist

### 1. Railway Dashboard Checks
- [ ] Navigate to https://railway.app/dashboard
- [ ] Find the `asset-forge-cdn` service
- [ ] Check deployment status (should show "Active" or "Running")
- [ ] Review recent deployment logs for errors
- [ ] Verify the service hasn't crashed

### 2. Volume Configuration
Your CDN relies on a Railway volume to store assets (models, emotes, music).

**Required Setup:**
- [ ] Volume must be created in Railway project
- [ ] Volume must be attached to the CDN service
- [ ] Mount path should be set as `RAILWAY_VOLUME_MOUNT_PATH` env var
- [ ] Assets must be uploaded to the volume

**To check:**
```bash
# In Railway service settings, verify:
# - Volumes tab shows an attached volume
# - Volume mount path is configured
```

### 3. Environment Variables
The following environment variables **must** be set in Railway:

**Required:**
```bash
# Railway auto-sets these:
PORT=<auto-set by Railway>
RAILWAY_VOLUME_MOUNT_PATH=<path to volume>

# You must set these:
CDN_API_KEY=<your-api-key>
NODE_ENV=production
CORS_ORIGIN=*  # or specific domain
```

**Optional (for Privy auth):**
```bash
PRIVY_APP_ID=<your-privy-app-id>
PRIVY_APP_SECRET=<your-privy-app-secret>
```

**Optional (for webhooks):**
```bash
ENABLE_WEBHOOK=true
ASSET_FORGE_API_URL=https://hyperforge-production.up.railway.app
WEBHOOK_SECRET=<your-webhook-secret>
```

### 4. Build Configuration
This repo now includes `railway.toml` which tells Railway:
- Use Bun runtime
- Start command: `bun run start`
- Healthcheck: `/api/health`

**Verify in Railway:**
- [ ] Build logs show Bun being installed
- [ ] Start command is `bun run start` (or `bun src/index.ts`)
- [ ] No build errors

### 5. Common Issues & Solutions

#### Issue: "Application not found" (404)
**Symptoms:** All endpoints return 404 with `x-railway-fallback: true` header

**Solutions:**
1. Service may have crashed - check logs
2. Service may not be deployed - trigger new deployment
3. Domain may be pointing to wrong service - verify Railway domain settings
4. Service may have been deleted/paused - check Railway dashboard

#### Issue: Service crashes on startup
**Check logs for:**
- Missing environment variables
- Port binding issues (ensure binding to `0.0.0.0`, not `localhost`)
- Volume mount path not found
- Permission issues with volume

#### Issue: Files not found (404 on /models/*, /emotes/*, etc.)
**Causes:**
1. Volume not mounted - check `RAILWAY_VOLUME_MOUNT_PATH`
2. Assets not uploaded to volume
3. Wrong directory structure in volume

**Solution:**
```bash
# Volume should have this structure:
/volume/
  models/
    *.glb
  emotes/
    *.glb
  music/
    *.mp3
```

### 6. Deployment Steps

#### First-Time Deployment:
1. **Connect repo to Railway:**
   ```bash
   # In Railway dashboard:
   # 1. Create new project
   # 2. Connect GitHub repo
   # 3. Select this repo
   ```

2. **Create and attach volume:**
   ```bash
   # In Railway project:
   # 1. Go to Volumes tab
   # 2. Create new volume (e.g., "cdn-assets")
   # 3. Attach to service
   # 4. Set mount path (e.g., /data)
   ```

3. **Set environment variables:**
   ```bash
   # In service settings > Variables:
   CDN_API_KEY=<generate with: bun -e "console.log(require('crypto').randomBytes(32).toString('base64url'))">
   NODE_ENV=production
   CORS_ORIGIN=*
   RAILWAY_VOLUME_MOUNT_PATH=/data  # or your volume mount path
   ```

4. **Deploy:**
   ```bash
   # Railway auto-deploys on push to main
   # Or manually trigger deployment in dashboard
   ```

5. **Upload assets to volume:**
   ```bash
   # You'll need to upload your models/emotes/music to the volume
   # Options:
   # A) Use the upload API: POST /api/upload
   # B) Use Railway CLI to copy files
   # C) Use an admin script
   ```

#### Redeployment:
```bash
# Option 1: Push to main branch (auto-deploys)
git push origin main

# Option 2: Manual redeploy in Railway dashboard
# Click "Deploy" button in service

# Option 3: Railway CLI
railway up
```

### 7. Verification

After deployment, verify:

```bash
# Health check
curl https://cdn-production-4e4b.up.railway.app/api/health
# Should return: {"status":"healthy",...}

# Assets listing (requires API key)
curl -H "X-API-Key: YOUR_KEY" https://cdn-production-4e4b.up.railway.app/api/assets
# Should return: {"files":[...]}

# File serving
curl -I https://cdn-production-4e4b.up.railway.app/models/some-model.glb
# Should return: HTTP/2 200 (if file exists in volume)
```

### 8. Debugging

**View logs:**
```bash
# Railway CLI
railway logs

# Or in dashboard: Service > Deployments > View Logs
```

**Common log patterns to look for:**
```bash
# Success:
✅ CDN server ready!
Asset-Forge CDN started successfully

# Errors:
⚠️ No CDN_API_KEY configured
Error: ENOENT: no such file or directory
Port already in use
```

## Quick Fix for Current Issue

Since your deployment shows "Application not found":

1. **Go to Railway dashboard** → Find your service
2. **Check Deployments tab** → Is there a recent failed deployment?
3. **Click on latest deployment** → Read the logs
4. **Look for errors** → Most common: missing env vars, volume issues, build failures
5. **Trigger redeploy** → Click "Redeploy" button
6. **Monitor logs** → Watch for startup messages

If service doesn't exist at all:
1. You may need to create a new service in Railway
2. Connect this GitHub repo
3. Railway will auto-detect Bun from `package.json`
4. Use the railway.toml config committed to this repo
