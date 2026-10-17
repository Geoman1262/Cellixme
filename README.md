# Cellix Me — starter web app

A bilingual (Arabic/English) digital business-card platform starter built for Cloudflare Workers + D1. It includes a public landing page, account registration/login, one free card per account, editable public profiles, vCard contact download, QR display, and a minimal admin overview API. Payments are intentionally not enabled.

## Important status

This is a **starter build**, not yet a production-ready commercial service. Before public launch, complete the deployment steps below, test on mobile, and arrange security review, email verification/password reset, abuse protection/rate limits, privacy/terms pages, and robust admin controls. `ADMIN_EMAIL` is an optional Cloudflare variable: an account registered with that exact email gets the admin role. Set it before registering your own account. Do not commit secrets.

## Deploy from GitHub + Cloudflare

1. Create a **new empty GitHub repository** named `cellix-me` and upload the files from this folder (keep paths and folders intact).
2. In Cloudflare Dashboard, create a **D1 database** named `cellix-me-db`.
3. Copy the D1 database ID into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. In the repository terminal or Cloudflare build environment, run `npm install`.
5. Create the schema in D1:
   - Local dev: `npx wrangler d1 execute cellix-me-db --local --file=db/schema.sql`
   - Production: `npx wrangler d1 execute cellix-me-db --remote --file=db/schema.sql`
6. Add Worker secret `SESSION_SECRET` in Cloudflare (use a long random value, at least 32 random bytes). Example command: `npx wrangler secret put SESSION_SECRET`.
7. Optionally add Worker variable `ADMIN_EMAIL` in Cloudflare with your email address **before creating your account**.
8. Deploy with `npm run deploy`, or connect the GitHub repository in Cloudflare Workers & Pages and configure the deployment to use Wrangler. The Worker must have the D1 binding named `DB` and assets binding `ASSETS`.
9. Cloudflare will provide a `workers.dev` URL if enabled for your account. No paid custom domain is required. You can later rename the Worker or attach a custom domain if desired.

## Local development

```sh
npm install
npx wrangler d1 execute cellix-me-db --local --file=db/schema.sql
# create .dev.vars with SESSION_SECRET="a-long-random-local-secret"
npm run dev
```

## Routes

- `GET /api/health`
- `POST /api/register` — `{ "email", "password", "displayName" }`
- `POST /api/login` — `{ "email", "password" }`
- `POST /api/logout`
- `GET /api/me`
- `POST /api/cards`
- `PUT /api/cards/:id`
- `GET /api/public/slug/:slug`
- `GET /api/admin/overview` (admin role required)

Public card URL shape: `https://YOUR-WORKER-URL/username`.

## Known MVP limitations to resolve before launch

- QR image is currently rendered by a third-party QR image endpoint; replace with an in-browser QR library if you need QR generation without sending the URL to a third party.
- This starter does not yet implement email verification, password reset, account deletion UI, card deletion UI, company/team membership, paid plans, or payment processing.
- Admin overview API exists, but a full admin dashboard and account moderation actions remain to be built.
- Add rate limiting / bot protection and security review before accepting public signups.
- Review and complete validation, accessibility, privacy disclosures, and legal pages before production.
