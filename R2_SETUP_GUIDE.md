# Cloudflare R2 Setup Guide for Cookie Storage

## Why Cloudflare R2?
- ✅ **Zero egress fees** (free data transfer out)
- ✅ **S3-compatible** API (easy to use)
- ✅ **$0.015/GB/month** storage (cheaper than S3)
- ✅ **Persistent** across container restarts
- ✅ **Scalable** for multi-container deployments

---

## Step 1: Create Cloudflare R2 Bucket

1. **Log in to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com/
   - Select your account

2. **Navigate to R2**
   - Click **R2** in the left sidebar
   - Click **Create bucket**

3. **Create Bucket**
   - **Name:** `osint-cookies` (or any name you prefer)
   - **Location:** Choose closest to your deployment (or leave as auto)
   - Click **Create bucket**

---

## Step 2: Generate R2 API Token

1. **Go to R2 API Tokens**
   - In R2 dashboard, click **Manage R2 API Tokens**
   - Or go to: Account Home → R2 → Settings → API Tokens

2. **Create API Token**
   - Click **Create API Token**
   - **Token name:** `osint-dashboard-cookies`
   - **Permissions:** 
     - ✅ **Object Read & Write** (for your bucket)
   - **TTL:** No expiry (or set as needed)
   - Click **Create API Token**

3. **Save Credentials** (shown only once!)
   - **Access Key ID:** `<your-access-key-id>`
   - **Secret Access Key:** `<your-secret-access-key>`
   - **Endpoint URL:** `https://<account-id>.r2.cloudflarestorage.com`
   
   ⚠️ **Copy these now — you won't see the secret again!**

---

## Step 3: Configure Backend Environment

Add these to your `backend/.env`:

```bash
# Enable cloud storage
USE_CLOUD_STORAGE=true

# Cloudflare R2 credentials
R2_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your-access-key-id>
R2_SECRET_ACCESS_KEY=<your-secret-access-key>
R2_BUCKET=osint-cookies

# Optional: still save .pkl format
SAVE_PLAINTEXT_COOKIES=true
```

**Replace:**
- `<your-account-id>` - your Cloudflare account ID (in R2 settings)
- `<your-access-key-id>` - the Access Key ID from step 2
- `<your-secret-access-key>` - the Secret Access Key from step 2

---

## Step 4: Install Dependencies

```bash
cd backend
npm install
```

This installs the AWS SDK for S3 (`@aws-sdk/client-s3`) which is R2-compatible.

---

## Step 5: Test R2 Connection

Create a quick test script:

```bash
cat > backend/test_r2_connection.js << 'EOF'
require('dotenv').config();
const { isCloudStorageEnabled, saveCookieToCloud, getCookieFromCloud } = require('./src/utils/cookieStorage');

async function test() {
  console.log('🧪 Testing Cloudflare R2 connection...');
  console.log('USE_CLOUD_STORAGE:', process.env.USE_CLOUD_STORAGE);
  console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT);
  console.log('R2_BUCKET:', process.env.R2_BUCKET);
  console.log('Cloud storage enabled:', isCloudStorageEnabled());
  
  if (!isCloudStorageEnabled()) {
    console.error('❌ Cloud storage not enabled. Check your .env file.');
    process.exit(1);
  }
  
  // Test save
  const testCookies = [
    { name: 'c_user', value: 'test123', domain: '.facebook.com' },
    { name: 'xs', value: 'test456', domain: '.facebook.com' },
  ];
  const filename = `test_${Date.now()}.json`;
  
  console.log('\n📤 Testing upload...');
  const path = await saveCookieToCloud(filename, testCookies);
  console.log('✅ Uploaded to:', path);
  
  console.log('\n📥 Testing download...');
  const retrieved = await getCookieFromCloud(filename);
  console.log('✅ Retrieved:', retrieved.length, 'cookies');
  console.log('✅ First cookie:', retrieved[0]);
  
  console.log('\n🎉 R2 connection test passed!');
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
EOF

node backend/test_r2_connection.js
```

**Expected output:**
```
🧪 Testing Cloudflare R2 connection...
Cloud storage enabled: true
📤 Testing upload...
✅ Saved cookie to R2: r2://osint-cookies/cookies/test_1234567890.json
✅ Uploaded to: r2://osint-cookies/cookies/test_1234567890.json
📥 Testing download...
✅ Retrieved: 2 cookies
✅ First cookie: { name: 'c_user', value: 'test123', domain: '.facebook.com' }
🎉 R2 connection test passed!
```

---

## Step 6: Deploy with R2 Storage

### Option A: Docker Compose

Update your `docker-compose.yml` environment section:

```yaml
services:
  backend:
    environment:
      - USE_CLOUD_STORAGE=true
      - R2_ENDPOINT=${R2_ENDPOINT}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET=${R2_BUCKET:-osint-cookies}
      - SAVE_PLAINTEXT_COOKIES=true
```

Then deploy:
```bash
docker-compose up -d
```

### Option B: Docker Run

```bash
docker run -d \
  -p 8080:8080 -p 6080:6080 \
  -e USE_CLOUD_STORAGE=true \
  -e R2_ENDPOINT="https://YOUR-ACCOUNT.r2.cloudflarestorage.com" \
  -e R2_ACCESS_KEY_ID="your-key" \
  -e R2_SECRET_ACCESS_KEY="your-secret" \
  -e R2_BUCKET="osint-cookies" \
  -e SAVE_PLAINTEXT_COOKIES=true \
  your-image-name
```

### Option C: Local Development

Just set the env vars in `backend/.env` and run:
```bash
cd backend
npm start
```

---

## Step 7: Verify Cookie Storage

1. **Connect Facebook** via your dashboard

2. **Check R2 bucket:**
   - Go to Cloudflare R2 dashboard
   - Open your `osint-cookies` bucket
   - You should see folder `cookies/` with files:
     - `<userId>_<timestamp>.json`
     - `<userId>_<timestamp>.pkl` (if SAVE_PLAINTEXT_COOKIES=true)

3. **Check database:**
   - Query your user document
   - `facebookCookiesPath` should show: `r2://osint-cookies/cookies/<file>.json`

---

## How It Works 🔧

### Storage Flow

```
User connects Facebook
       ↓
Browser cookies captured
       ↓
saveCookiesSafely() called
       ↓
[Check if R2 enabled?]
       ↓
    YES: Upload to R2
         - Save .json to R2
         - Save .pkl to R2 (if enabled)
         - Store path: r2://bucket/cookies/file.json
       ↓
    NO: Save locally
        - Write to backend/cookies/
        - Store path: /app/backend/cookies/file.json
       ↓
Update DB with path + encrypted blob
```

### Fallback Behavior

If R2 upload fails (network issue, wrong credentials, etc.), the system automatically falls back to local filesystem storage and logs a warning.

---

## Viewing/Downloading Cookies from R2

### Option 1: Cloudflare Dashboard
- Go to R2 → Your bucket → Browse files
- Click on a file → Download

### Option 2: AWS CLI (S3-compatible)

Install AWS CLI, then configure for R2:

```bash
aws configure --profile r2
# Access Key: <your-r2-access-key>
# Secret Key: <your-r2-secret-key>
# Region: auto
```

List files:
```bash
aws s3 ls s3://osint-cookies/cookies/ \
  --endpoint-url https://YOUR-ACCOUNT.r2.cloudflarestorage.com \
  --profile r2
```

Download a file:
```bash
aws s3 cp s3://osint-cookies/cookies/USER_123456.json ./local-cookies/ \
  --endpoint-url https://YOUR-ACCOUNT.r2.cloudflarestorage.com \
  --profile r2
```

### Option 3: Code (using cookieStorage util)

```javascript
const { getCookieFromCloud } = require('./src/utils/cookieStorage');

// Retrieve cookies
const cookies = await getCookieFromCloud('userId_timestamp.json');
console.log(cookies);
```

---

## Cost Estimation 💰

### Cloudflare R2 Pricing (as of 2026)
- **Storage:** $0.015 per GB/month
- **Class A operations** (writes): $4.50 per million
- **Class B operations** (reads): $0.36 per million
- **Egress:** FREE ✅

### Example Usage
- 1000 users × 50KB cookie file = **50MB storage = $0.00075/month**
- 1000 cookie saves/month = **1000 writes = $0.0045/month**
- 10,000 cookie reads/month = **10,000 reads = $0.0036/month**

**Total: ~$0.01/month** for small scale

Compare to AWS S3:
- Same storage: $0.023/month
- Same operations: similar
- Egress (10GB/month): **$0.90** 🚨

**R2 saves ~$11/year on egress alone!**

---

## Troubleshooting

### "Failed to save to R2: Access Denied"
- Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are correct
- Verify API token has read+write permissions for the bucket
- Ensure bucket name matches R2_BUCKET env var

### "Failed to save to R2: Network error"
- Check R2_ENDPOINT is correct format: `https://<account-id>.r2.cloudflarestorage.com`
- Ensure your server can reach Cloudflare (not blocked by firewall)
- Try the test script to isolate the issue

### "Cloud storage not enabled"
- Verify `USE_CLOUD_STORAGE=true` in .env
- Check all R2_* env vars are set
- Restart backend after changing .env

### Files not appearing in R2
- Check backend logs for upload errors
- Verify cookies have c_user and xs (required for save)
- Try the test_r2_connection.js script

### Want to migrate existing local cookies to R2?
Create a migration script:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const { saveCookieToCloud } = require('./src/utils/cookieStorage');

async function migrate() {
  const dir = './backend/cookies';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('session_'));
  
  for (const file of files) {
    const cookies = JSON.parse(fs.readFileSync(path.join(dir, file)));
    await saveCookieToCloud(file, cookies);
    console.log('Migrated:', file);
  }
}
migrate();
"
```

---

## Security Best Practices ⚠️

1. **Never commit R2 credentials** to git
   - Add `.env` to `.gitignore` (already done)

2. **Use environment-specific tokens**
   - Dev environment: separate R2 token
   - Production: separate R2 token with stricter permissions

3. **Bucket access control**
   - Keep bucket private (not public)
   - Use API tokens with minimum required permissions

4. **Rotate credentials periodically**
   - Generate new R2 API tokens every 90 days
   - Revoke old tokens after migration

5. **Enable R2 bucket logging** (optional)
   - Track access to cookie files
   - Monitor for unusual activity

---

## Next Steps

✅ R2 storage is now configured and ready to use!

When you connect Facebook through the dashboard with `USE_CLOUD_STORAGE=true`, cookies will automatically be saved to Cloudflare R2 instead of the local filesystem.

**Quick checklist:**
- [ ] R2 bucket created
- [ ] API token generated and saved
- [ ] Environment variables configured
- [ ] Dependencies installed (`npm install`)
- [ ] Test script passed
- [ ] Backend restarted with new env vars
- [ ] First cookie save tested through dashboard
- [ ] Files visible in R2 bucket

Need help? Check the logs: `docker-compose logs backend` or `pm2 logs` or check the console output.
