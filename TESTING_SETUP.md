# Testing Flow Setup Guide

## 🎯 Goal
Test the complete OAuth → Docker scraping flow locally before deploying everything.

## 📋 Architecture
```
User Browser → Frontend → Backend (Render) → ngrok → Webhook Server (Local) → Docker (Local)
```

## 🚀 Step-by-Step Setup

### Step 1: Start Local Webhook Server
```bash
cd /Users/shashwatsaxena/Desktop/scraping-app
node webhook_server.js
```

You should see:
```
🎯 Webhook Server Started!
📡 Listening on port 3001
💡 Ready to receive scraping requests!
```

### Step 2: Install and Start ngrok
```bash
# If you don't have ngrok, install it:
brew install ngrok

# Start ngrok tunnel
ngrok http 3001
```

ngrok will show you a URL like:
```
Forwarding: https://abc123.ngrok.io -> http://localhost:3001
```

**Copy this URL!** You'll need it in the next step.

### Step 3: Update Backend Environment Variable

On Render (your deployed backend), add this environment variable:
```
SCRAPER_WEBHOOK_URL=https://abc123.ngrok.io/webhook
```

Replace `abc123.ngrok.io` with your actual ngrok URL.

### Step 4: Test the Flow

#### Option A: Test with actual Facebook OAuth
1. Open your frontend: `http://localhost:3000`
2. Click "Login with Facebook"
3. Complete Facebook OAuth
4. Watch the webhook server console for activity!

#### Option B: Test webhook directly
```bash
# In a new terminal
cd /Users/shashwatsaxena/Desktop/scraping-app
./test_webhook.sh
```

## 📊 What to Watch

### Webhook Server Console
You should see:
```
🎯 Webhook received!
User: test_user
Access Token: test_token_EAABsbCS...
🚀 Starting Docker container: facebook-scraper-test_user_123
✅ Container started successfully!
📊 Container facebook-scraper-test_user_123: Up 3 seconds
```

### Check Docker Container
```bash
# List running containers
docker ps | grep facebook-scraper

# View logs
docker logs facebook-scraper-test_user_123
```

### Check Output
```bash
# View scraped data
ls -la scraper_output/test_user_123/
cat scraper_output/test_user_123/facebook_integrated_output.csv
```

## 🔍 API Endpoints

### Check Job Status
```bash
curl http://localhost:3001/webhook/status/scraper_test_user_123_1234567890
```

### Get Job Logs
```bash
curl http://localhost:3001/webhook/logs/scraper_test_user_123_1234567890
```

### Stop Job
```bash
curl -X POST http://localhost:3001/webhook/stop/scraper_test_user_123_1234567890
```

### Health Check
```bash
curl http://localhost:3001/webhook/health
```

## ✅ Success Indicators

1. **Webhook receives request** ✓
2. **Docker container starts** ✓
3. **Container runs successfully** ✓
4. **CSV output is created** ✓
5. **User sees dashboard immediately** ✓

## 🐛 Troubleshooting

### Webhook server not receiving requests
- Check ngrok is running: `ngrok http 3001`
- Verify SCRAPER_WEBHOOK_URL is set in Render
- Check Render backend logs for webhook calls

### Docker container not starting
- Verify image exists: `docker images | grep facebook-scraper`
- Pull if needed: `docker pull shashwats500/facebook-scraper:latest`
- Check Docker is running: `docker ps`

### No output files
- Check output directory permissions
- View container logs: `docker logs <container-name>`
- Ensure container finished successfully

## 🔄 Complete Flow

1. User clicks "Login with Facebook"
2. Facebook OAuth completes
3. Backend receives access token
4. Backend calls webhook (via ngrok)
5. Webhook server receives request
6. Docker container starts locally
7. User redirected to dashboard immediately
8. Scraping continues in background
9. Results saved to `scraper_output/<userId>/`

## 📝 Notes

- ngrok URL changes each time you restart it (use paid version for static URLs)
- For production, replace webhook with direct Docker execution on server
- Keep webhook server running while testing
- Check Render logs to see webhook calls from backend
