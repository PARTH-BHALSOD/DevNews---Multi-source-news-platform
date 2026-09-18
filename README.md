# DevNews Backend

A production-minded Express + MongoDB backend for a MERN tech-news application.

## Included functionality

- User registration and login
- Signed, HTTP-only authentication cookie
- Logout and current-user endpoint
- Admin authorization middleware
- Profile update and password change
- Account deletion for normal users
- Post creation, reading, updating and deletion
- Search, tag filtering and pagination
- Favorite/unfavorite posts
- Click tracking
- NewsAPI + DEV Community ingestion
- Hourly news synchronization
- Duplicate-link protection
- Central 404/error handling
- Health endpoint
- No secrets committed to the project

## Setup

1. Install dependencies:

   `npm install`

2. Copy `.env.example` to `.env`.

3. Fill in `MONGO_URI`, `COOKIE_SECRET`, `ADMIN_ID`, and `NEWS_API_KEY`.

4. Set `FRONTEND_URL` (or `CORS_ORIGINS`) to the exact frontend origin(s), separated by commas. Origins are normalized automatically, so either `https://example.com` or `https://example.com/` is valid. On Vercel, the current deployment URL is also allowed automatically.

5. Install the Python dependencies (used by the admin-promotion script and the news worker):

   `pip install -r requirements.txt`

6. Create a normal account, then promote it to admin:

   `python3 scripts/promote_admin.py your-email@example.com` (or `npm run promote-admin -- your-email@example.com`)

7. Start development server:

   `npm run dev`

## News worker (Python)

Live article ingestion (NewsAPI + DEV Community) runs as its own process, separate from the Express server, so the two can be started, stopped, and deployed independently.

- Run once: `python3 workers/news_worker.py --once`
- Run continuously, syncing every hour on the hour: `python3 workers/news_worker.py` (or `npm run worker`)

## Health check (Python)

A small smoke-test script that pings the running server: `python3 scripts/health_check.py` (or `npm run health-check`). Pass `--base-url` if the server isn't on `http://localhost:5001`.

## Important security notes

- Do not put `.env` in Git or share it.
- `COOKIE_SECRET` must be a long random secret (32+ characters).
- Public registration always creates a normal user unless `ADMIN_REGISTRATION_KEY` is explicitly configured and supplied through the `x-admin-registration-key` header.
- Existing old unsigned `userId` cookies are intentionally rejected; users must log in again after upgrading.

## API

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me` (auth)
- `GET /api/auth/admin` (admin)
- `PATCH /api/auth/profile` (auth)
- `PATCH /api/auth/password` (auth)
- `DELETE /api/auth/account` (auth, non-admin)

### Posts

- `GET /api/posts/getPosts?page=1&limit=20` (auth)
- `GET /api/posts/getPosts?search=react` (auth)
- `GET /api/posts/getPosts?tag=javascript` (auth)
- `GET /api/posts/:postId` (auth)
- `POST /api/posts/:postId/click` (auth)
- `POST /api/posts/favorites/:postId` (auth)
- `GET /api/posts/favorites` (auth)
- `POST /api/posts/create` (admin)
- `PATCH /api/posts/:postId` (admin)
- `DELETE /api/posts/:postId` (admin)
- `DELETE /api/posts/delete` (admin, backwards-compatible)

## Post list response

`GET /api/posts/getPosts` returns:

```json
{
  "posts": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0
  }
}
```

## Frontend cookie requirement

When calling the API from a browser, send credentials so the authentication cookie is included:

```js
fetch('http://localhost:5001/api/auth/me', {
  credentials: 'include'
});
```
