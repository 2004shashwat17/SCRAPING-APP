# Cookie Manual Setup (one-cookie quickstart)

This file explains how to manually add a single cookie file to the server and register it so the worker can use it.

Steps
1. Copy your cookie file (e.g. `cookie.json`) to the server cookie directory. By default that is `cookies/` at repo root. You can override via env `COOKIE_DIR`.

   Example (from project root):
   ```bash
   mkdir -p cookies
   cp /path/to/cookie.json cookies/shashwat_1.json
   chmod 600 cookies/shashwat_1.json
   ```

2. Register the cookie in the server's DB (two options):

   A) Use the HTTP register endpoint (requires an auth token):
   ```bash
   curl -X POST https://your.server/api/cookies/register \
     -H "Authorization: Bearer <ADMIN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"filename":"shashwat_1.json"}'
   ```

   B) Use the local CLI helper (works when run on the server or dev machine with DB access):
   ```bash
   # from repo root
   node backend/scripts/register_cookie.js shashwat_1.json
   ```

   The script will register the cookie with `status: ready` and ensure file perms are `600`.

3. Verify cookie is registered:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_JWT>" https://your.server/api/cookies
   # or inspect DB: db.cookies.find().pretty()
   ```

4. Trigger a job for a user (ensure the user has facebookAccessToken saved in DB):
   ```bash
   curl -X POST https://your.server/api/scraper/run \
     -H "Authorization: Bearer <USER_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"fbid":"<TARGET_FRIENDLIST_USER_ID>"}'
   ```

5. Check job progress:
   - Inspect job record: `GET /api/scraper/job/:userId/:jobId`
   - Check container logs (worker attaches logs to job doc).
   - You can also `docker ps` and `docker logs <containerName>` to inspect the running container.

Troubleshooting
- If job stays `queued`, worker couldn't find a ready cookie (check `/api/cookies` status). If cookie is `disabled`, inspect `lastError`.
- If the container fails with auth errors, check job logs for `login required` or `invalid cookie` messages; worker disables cookie on such errors.
- If you need to replace the cookie, overwrite the file in `cookies/` and re-run the register script or call `/api/cookies/:id/enable`.

Security
- Keep cookie files out of version control. Do not commit them to git.
- Use `chmod 600` and run worker as a non-root user.
- Use HTTPS and a rotated admin/service token to call `/api/cookies/register`.
