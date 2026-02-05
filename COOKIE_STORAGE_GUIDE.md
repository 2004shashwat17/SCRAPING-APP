# Cookie Storage Guide for Production Deployment

## Current Issue
Cookie files (`.json` and `.pkl`) are saved to `/app/backend/cookies` inside the Docker container by default. Without persistent storage, these files are **lost when the container restarts**.

## Solutions

### ✅ Option 1: Docker Volumes (Recommended for single server)

#### Using docker-compose (easiest)
```bash
# Start with volumes automatically mounted
docker-compose up -d

# Check that cookies directory is mounted
docker-compose exec backend ls -la /app/backend/cookies
```

The included `docker-compose.yml` mounts:
- `./backend/cookies` → `/app/backend/cookies` (cookie files)
- `./scraper_output` → `/app/scraper_output` (scraper data)
- `./backend/data` → `/app/backend/data` (geocode cache)

#### Using docker run
```bash
docker run -d \
  -p 8080:8080 -p 6080:6080 -p 5900:5900 \
  -v $(pwd)/backend/cookies:/app/backend/cookies \
  -v $(pwd)/scraper_output:/app/scraper_output \
  -e MONGODB_URI="your_mongo_uri" \
  -e JWT_SECRET="your_secret" \
  -e COOKIE_ENCRYPTION_KEY="your_key_base64" \
  -e SAVE_PLAINTEXT_COOKIES=true \
  your-image-name
```

---

### 🌩️ Option 2: Cloud Object Storage (AWS S3 / Azure Blob / Cloudflare R2)

Best for:
- Multi-container deployments
- Auto-scaling environments
- High availability setups

#### Implementation Steps:

**1. Install cloud storage SDK:**
```bash
cd backend
npm install @aws-sdk/client-s3  # for S3/R2
# or
npm install @azure/storage-blob  # for Azure
```

**2. Create storage helper** (`backend/src/utils/cookieStorage.js`):
```javascript
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // for Cloudflare R2
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.COOKIE_BUCKET || 'osint-dashboard-cookies';

async function saveCookieToCloud(filename, data) {
  const key = `cookies/${filename}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
  return `s3://${BUCKET}/${key}`;
}

async function getCookieFromCloud(filename) {
  const key = `cookies/${filename}`;
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

module.exports = { saveCookieToCloud, getCookieFromCloud };
```

**3. Update `saveCookiesSafely` in facebookCapture.js:**
```javascript
const { saveCookieToCloud } = require('../utils/cookieStorage');

// Inside saveCookiesSafely function:
if (process.env.USE_CLOUD_STORAGE === 'true') {
  const cloudPath = await saveCookieToCloud(filename, cookies);
  filepath = cloudPath; // Store cloud path in DB
} else {
  // existing local file save logic
}
```

**4. Set environment variables:**
```bash
USE_CLOUD_STORAGE=true
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com  # for R2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
COOKIE_BUCKET=osint-cookies
```

#### Cloud Provider Setup:

**Cloudflare R2** (cheapest, no egress fees):
1. Go to Cloudflare dashboard → R2
2. Create bucket `osint-cookies`
3. Generate API token with R2 permissions
4. Set `S3_ENDPOINT` to your R2 endpoint

**AWS S3:**
1. Create S3 bucket with private access
2. Create IAM user with S3 permissions
3. Use standard S3 endpoint (no custom endpoint needed)

**Azure Blob:**
1. Create storage account
2. Create container `cookies`
3. Use connection string or SAS token

---

### 📁 Option 3: Network File System (NFS/EFS)

Best for: Kubernetes, multi-node deployments

#### AWS EFS:
```yaml
# kubernetes volume
volumes:
  - name: cookie-storage
    persistentVolumeClaim:
      claimName: efs-cookies-pvc
```

#### NFS:
```bash
# Mount NFS share on host
sudo mount -t nfs nfs-server:/exports/cookies /mnt/cookies

# Then mount in docker
docker run -v /mnt/cookies:/app/backend/cookies ...
```

---

## Comparison Table

| Solution | Pros | Cons | Best For |
|----------|------|------|----------|
| **Docker Volumes** | Simple, fast, no code changes | Single server only | Development, small deployments |
| **Cloud Storage** | Scalable, HA, multi-container | Requires code changes, latency | Production, auto-scaling |
| **Network FS** | Multi-container, file-like access | Complex setup, single point of failure | Kubernetes, on-prem |

---

## Current Implementation Status

✅ **Implemented:**
- Docker volume support via `docker-compose.yml`
- `COOKIE_DIR` env var for custom storage paths
- Plaintext `.json` and `.pkl` export when `SAVE_PLAINTEXT_COOKIES=true`

🔄 **To Implement (if needed):**
- Cloud storage adapter for S3/R2/Azure
- Automatic migration from local to cloud storage
- Cookie file cleanup/rotation policies

---

## Quick Start for Production

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Set required variables in `.env`:**
   ```bash
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your-long-random-string
   COOKIE_ENCRYPTION_KEY=base64-encoded-32-byte-key
   SAVE_PLAINTEXT_COOKIES=true
   ```

3. **Deploy with docker-compose:**
   ```bash
   docker-compose up -d
   ```

4. **Verify cookie persistence:**
   ```bash
   # Save cookies via dashboard
   # Then restart container
   docker-compose restart backend
   
   # Check cookies are still there
   docker-compose exec backend ls -la /app/backend/cookies
   ```

---

## Security Notes ⚠️

- Cookie files contain live session tokens (`c_user`, `xs`)
- Always use restrictive permissions (0o600) for local files
- For cloud storage, use private buckets with encryption at rest
- Never commit cookie files to git (already in `.gitignore`)
- Rotate `COOKIE_ENCRYPTION_KEY` periodically
- Consider implementing cookie expiration/cleanup policies

---

## Troubleshooting

**"Cookies disappear after restart"**
- Check volume mounts: `docker-compose config`
- Verify host directory exists and is writable
- Check container logs: `docker-compose logs backend`

**"Permission denied" errors**
- Ensure host directory has correct permissions
- May need to run container as specific user: `user: "1000:1000"`

**Cloud storage "Access Denied"**
- Verify credentials and bucket permissions
- Check endpoint URL is correct
- Ensure bucket exists and is in the right region
