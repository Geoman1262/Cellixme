# Cellix Me

Cloudflare Worker + static frontend starter.

## Cloudflare deployment
- Set the build/deploy command to `npx wrangler deploy`.
- The Worker entry point is `worker.js` at repository root.
- Static website files are in `public/`; Wrangler serves only this directory as assets, so `node_modules` is never uploaded as website assets.
- Create a Cloudflare D1 database and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with its ID.
- Apply `schema.sql` to that D1 database before using database features.

Do not commit secrets to GitHub.
