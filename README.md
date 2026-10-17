# Cellix Me — flat package

All project files are placed in the repository root (no src, public, or db folders).

## Cloudflare Workers deployment
1. Upload every file in this ZIP directly to the root of your GitHub repository.
2. Use the Workers deployment flow with deploy command `npx wrangler deploy`.
3. Create a D1 database named `cellix-me-db`, then replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with its actual ID.
4. Run the SQL in `schema.sql` against that D1 database.
5. Add a secret named `SESSION_SECRET` in Worker settings (use a long random value).
6. Deploy again.

The Worker entry point is `worker.js`; static assets are the root files `index.html`, `app.js`, `styles.css`, and `manifest.webmanifest`. The Worker allowlists static files so source/config/database files are not served as website assets.

Note: this package is a starter and must be tested in your Cloudflare account before public launch.


Cloudflare build note: `.assetsignore` excludes `node_modules` from static asset uploads. In Cloudflare, create a D1 database named `cellix-me-db`, then replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with its actual database ID before expecting database features to work. The Worker name is set to `cellixme` to match the Cloudflare build setting.
