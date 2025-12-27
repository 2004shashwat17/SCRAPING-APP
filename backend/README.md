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
