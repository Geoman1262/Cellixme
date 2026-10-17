# Cellix Me

Cloudflare Worker + static frontend starter. All source files are kept in the repository root (no `public`, `src`, or `db` folders).

## Cloudflare Workers Builds
- Root directory: `/` (repository root)
- Build command: leave empty
- Deploy command: `npx wrangler deploy`
- Static assets directory is `.` in `wrangler.toml`; `.assetsignore` excludes `node_modules` and project/config files from public assets.
- Create a Cloudflare D1 database named `cellix-me-db`, then replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with the actual database ID.
- Apply `schema.sql` to that D1 database before using registration/card features.
- Set Worker secret `SESSION_SECRET` in Cloudflare before using API routes. Optional `ADMIN_EMAIL` makes the matching registered email an admin.

Do not commit secrets to GitHub. The ZIP has not been deployed to the user's Cloudflare account; deploy logs must confirm the result.
