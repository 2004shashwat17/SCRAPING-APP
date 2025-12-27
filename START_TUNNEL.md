# How to Start LocalTunnel for Reddit OAuth

## The Problem
Reddit's OAuth callback needs to reach your **backend server on port 8001**, but your tunnel might be pointing to the wrong port.

## Solution: Start LocalTunnel for Backend

### Step 1: Install LocalTunnel (if not installed)
```powershell
npm install -g localtunnel
```

### Step 2: Start the Backend Server (Port 8001)
In one terminal:
```powershell
cd C:\Users\91828\Desktop\osint-platform\backend
python start_server.py
```

### Step 3: Start LocalTunnel for Backend (Port 8001)
In a **NEW** terminal:
```powershell
lt --port 8001 --subdomain silver-eyes-brush
```

**IMPORTANT:** The tunnel MUST point to port **8001** (backend), NOT 3000 (frontend)!

### Step 4: Verify the Tunnel
You should see output like:
```
your url is: https://silver-eyes-brush.loca.lt
```

Test it by opening: https://silver-eyes-brush.loca.lt/api/v1/docs

If you see the API docs, the tunnel is working correctly!

### Step 5: Start the Frontend (Port 3000)
In a **THIRD** terminal:
```powershell
cd C:\Users\91828\Desktop\osint-platform\frontend
npm start
```

## How It Works

```
Reddit OAuth → https://silver-eyes-brush.loca.lt/api/v1/oauth/reddit/callback
                    ↓ (LocalTunnel forwards to)
               http://localhost:8001/api/v1/oauth/reddit/callback
                    ↓ (Backend processes and redirects to)
               https://silver-eyes-brush.loca.lt (Frontend)
```

## Common Mistakes

❌ **WRONG:** `lt --port 3000` (This tunnels the frontend, not the backend!)
✅ **CORRECT:** `lt --port 8001` (This tunnels the backend where OAuth callback is!)

## Troubleshooting

**If Reddit shows "bad request":**
- Make sure the tunnel subdomain matches what's in Reddit app settings
- Verify the tunnel is pointing to port 8001
- Check that backend server is running on port 8001

**If callback doesn't work:**
- Open https://silver-eyes-brush.loca.lt/api/v1/docs in browser
- If you see API docs, tunnel is working
- If you see "Application Error" or timeout, restart the tunnel

**Check terminal logs:**
Look for this line when you click "Connect Reddit":
```
OAuth Config for reddit: ENV=tunnel, BASE_URL=https://silver-eyes-brush.loca.lt
```

Then after Reddit redirects, you should see:
```
Request started - GET /api/v1/oauth/reddit/callback
```

If you don't see the callback request, the tunnel isn't working!
