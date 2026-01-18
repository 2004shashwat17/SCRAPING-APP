# Node.js Express Backend

This backend is designed for the existing frontend app, using Node.js, Express, and MongoDB.

## Features
- User authentication (register, login)
- Social OAuth endpoints (structure ready)
- Endpoints for posts, dashboard, and settings
- RESTful API structure with controllers, routes, and models
- Environment variable support via `.env`

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```
2. Copy `.env.template` to `.env` and fill in your values:
   ```sh
   cp .env.template .env
   ```
3. Start MongoDB locally or provide a remote URI in `.env`.
4. Start the server:
   ```sh
   npm run dev
   ```

## Folder Structure
- `src/server.js` - Main server entry point
- `src/routes/` - Express route definitions
- `src/controllers/` - Route handler logic
- `src/models/` - Mongoose models

## Next Steps
- Implement route files for auth, posts, dashboard, settings
- Add controllers and models as needed
- Integrate with frontend

## ML service integration (optional)

When a scraper finishes and writes `scraper_output/<userId>/...csv`, you can either have the scraper call the ML service directly (recommended for speed) or have the backend call it when the job status becomes `completed`.

Example: call ML service directly

```bash
curl -X POST http://ml-service:5000/predict \
   -H "Content-Type: application/json" \
   -H "X-ML-TOKEN: ${ML_TOKEN}" \
   -d '{"csv_path":"scraper_output/test_user_123/facebook_integrated_output.csv","userId":"test_user_123"}'
```

The ML service should return a JSON result which the backend can save in the database and mark the analysis status = DONE.

Security: require a shared token via `X-ML-TOKEN` header (or use mTLS / internal networking) so only authorized callers can request predictions.

## Facebook cookie capture (Puppeteer)

- New endpoints:
   - `POST /api/facebook/start` — start a Puppeteer session and attempt login with `{ userId, fbEmail, fbPassword }`. If 2FA is required, responds with `{ status: '2fa_required', sessionId }`.
   - `POST /api/facebook/submit-2fa` — submit `{ sessionId, code, userId }` to complete login and save cookies.

- **Authentication:** Both endpoints now require a valid **Bearer JWT** (set via `Authorization: Bearer <token>`). The server uses the token to identify the user—do not pass `userId` in the request body.

- Environment variables:
   - `COOKIE_ENCRYPTION_KEY` — base64 32-byte key used to encrypt cookie JSON before storing in MongoDB.
   - `COOKIE_CAPTURE_TIMEOUT_MS` — timeout for Puppeteer waiting (default 45000 ms).

- Saved cookies are written to `backend/cookies/<userId>_<timestamp>.json` and an encrypted blob is stored in the user document.

**Security note:** Do not store user passwords long-term. Use HTTPS and explicit consent when capturing cookies.
