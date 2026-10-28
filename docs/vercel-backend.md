# Deploy only the backend to Vercel

The Vercel project root is **`backend`**, not the repository root. This deploys the Express API only. The frontend stays where it is. The database remains an external PostgreSQL service, such as the existing Neon database.

## 1. Import the repository

Push the backend deployment changes to GitHub, then open <https://vercel.com/new> and import **`khaliphalah-ODC/gda-alumni`**.

| Setting | Value |
| --- | --- |
| Project name | `gda-alumni-api` (or another available name) |
| Root Directory | `backend` |
| Framework Preset | Express |
| Node.js | 22.x |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build:vercel` |
| Output Directory | Leave the Express default; do not enter `dist` |

`backend/vercel.json` supplies the framework, install/build commands, a US East function region, a 60-second maximum duration and Prisma engine inclusion. `src/app.ts` exports the Express app for Vercel. Requests retain their `/api` prefix; no catch-all rewrite is needed. `src/server.ts` remains the listener used locally and on Railway.

## 2. Add environment variables before deploying

Use [backend/.env.vercel.example](../backend/.env.vercel.example) as the list of variables. Enter real values in the **backend project's Environment Variables**. Do not paste these into chat or commit them.

- `NODE_ENV=production`
- `DATABASE_URL`: the full Neon **pooled** connection string from the Neon Connect dialog. Preserve `sslmode=require` and existing parameters. Set `connect_timeout=15`, `pool_timeout=15` and initially `connection_limit=1`, without duplicating query parameters. Increase the small pool only after checking database capacity and concurrency. Do not use Railway's `${{Postgres.DATABASE_URL}}` syntax on Vercel.
- `JWT_SECRET`: generate with `openssl rand -hex 48`. Use the same secret across instances; do not regenerate on each request.
- `JWT_EXPIRES_IN=7d`
- `FRONTEND_ORIGIN`: the actual or planned HTTPS frontend origin with no path. This controls browser access, activation links and membership QR links. The frontend does not have to be deployed by this step, but replace a temporary origin before using those flows.
- `TRUST_PROXY_HOPS=1`
- `RATE_LIMIT_STORAGE=database` (automatic on Vercel). Atomic PostgreSQL counters apply across warm instances and cold starts.
- `CRON_SECRET`: generate an independent value with `openssl rand -hex 48`. Required on Vercel; scheduled maintenance authenticates with its Bearer header.
- `EMAIL_PROVIDER=brevo`, with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` configured privately, or `EMAIL_PROVIDER=smtp` for the existing SMTP transport. See [email delivery](email-delivery.md). The legacy `ACTIVATION_DELIVERY=smtp` setting remains supported when `EMAIL_PROVIDER` is unset.
- Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, and the same complete Gmail address for `SMTP_USER` and `SMTP_FROM`. Set `SMTP_PASSWORD` to a Google app password without spaces, after enabling Google 2-Step Verification. A normal Gmail password is insufficient. Other SMTP providers can use their own settings.
- `MEDIA_STORAGE=cloudinary`
- `IMAGE_MAX_BYTES=4194304` (4 MiB, leaving room for multipart overhead)
- Optional Cloudinary credentials: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Needed before enabling uploads, not before the API can start. Optional chatbot credential: `GROQ_API_KEY`.

Vercel sets `VERCEL` automatically. Leave `MEDIA_UPLOAD_DIR` and `MEDIA_PUBLIC_ORIGIN` unset. Server disk uploads are rejected on Vercel because files would not persist. Existing local images must be uploaded to external storage before their URLs can work on this host. Vercel also limits entire function requests to 4.5 MB; the frontend may still display its general 5 MB label, so use images of 4 MiB or less for this deployment.

Configure Production variables for the main deployment. Preview deployments need their own database and matching frontend origin if used; do not point test previews at live school data.

## 3. Prepare the selected database

The build generates Prisma Client and compiles TypeScript. It **does not run database migrations**, so preview builds cannot silently change the production schema.

From the local `backend` directory, with `.env` pointing at the intended database, check the connection and apply any pending migrations before releasing the API:

```bash
npm run db:check
npm run prisma:deploy
```

Preserve a backup before migrating an existing database. Do not run `prisma migrate dev`, reset or seed against live records. If a separate direct migration URL is needed, use it only for the migration command and retain the pooled URL for the hosted application.

## 4. Deploy and check the API

Click **Deploy**. Vercel supplies an HTTPS address. Open:

```text
https://YOUR-API.vercel.app/api/health
https://YOUR-API.vercel.app/api/ready
```

`/api/health` should return JSON with `success: true`. `/api/ready` should return HTTP 200 with `database: connected`. The `/` URL has no website; a JSON 404 there is expected. `/api/ready` validates database access/schema and the production delivery selection, but does not verify SMTP credentials or inbox delivery.

If `/api/health` fails, inspect Vercel's runtime logs for missing/invalid environment variables or bundling errors. If only `/api/ready` fails, check Neon connectivity and pending migrations; production also requires configured Brevo or SMTP delivery. Fix environment variables and redeploy after changes.

If Vercel Deployment Protection returns a login page instead of API JSON, make the production API accessible to its intended clients in the project protection settings. Keep authentication on the app's private routes.

## 5. Enable application features

Keep the existing SuperAdmin if using the existing database. For a new database, bootstrap once from the local backend against that database with `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME`, and `SUPER_ADMIN_PASSWORD`, using `npm run super-admin:bootstrap`. There is no public bootstrap endpoint or interactive shell in a Vercel Function.

Check Gmail authentication locally with `npm run smtp:check` using the same SMTP settings; it sends no email and does not prove connectivity from Vercel. Then enable **email delivery** in **SuperAdmin → Platform settings** and test an intended invitation from the hosted app. Enable **image uploads** there only after configuring Cloudinary.

When connecting the frontend later, keep its `/api` proxy and change the proxy destination to this Vercel API origin. The existing Netlify configuration accepts the Vercel origin through `API_PROXY_ORIGIN`. That step belongs to the frontend deployment and is not performed by this backend setup.

## Runtime notes

Prisma is instantiated at module scope and reused within a warm function instance. There is no database connection or disconnection on every request. Each additional instance can still create its own pool, so use Neon's pooled endpoint and a small per-instance limit.

Vercel and production use shared PostgreSQL rate-limit counters. Database errors fail closed; IP/email keys are HMAC hashes. Local development and tests default to memory. Apply the new migration before starting the updated API.

`vercel.json` schedules `/api/cron/maintenance` daily at 03:00 UTC, compatible with Hobby cron frequency. The endpoint requires the configured `CRON_SECRET`, drains bounded batches of leased image-deletion jobs, retries failures with backoff, and prunes expired rate counters and old verification tokens. Upload/update/delete requests also use Vercel `waitUntil` for immediate cleanup attempts. Interrupted workers lose their lease after two minutes, allowing a later run to retry. Delivery of a cron invocation is still controlled by Vercel: inspect cron logs, monitor the returned remaining job count, and use an external authenticated scheduler or more frequent paid-plan cron if a daily retry is insufficient.

## Initial deployment-preparation checks (23 October 2026)

These initial results preceded the recovery, editable collections and Cloudinary migration work. See [release verification](release-verification.md) for the latest results and remaining hosted checks.

`npm --prefix backend run build:vercel` passed, including Prisma generation and TypeScript compilation. The targeted backend regression run passed 49 tests across seven files (environment checks, configured upload boundaries, health/readiness, authentication, security, invitation delivery and local media compatibility), using mocked database/provider access. The eight authentication/API tests also passed using the default Express export used by Vercel. The tests needed localhost networking for their temporary HTTP servers.

This verifies the application build, not Vercel's function bundle. A temporary Vercel CLI installation failed with an npm installation error, so the platform bundling step still needs verification on Vercel.

No hosted deployment, live SMTP delivery, Cloudinary upload or live database migration has been performed by this setup. Hosting still requires Vercel authentication and the real environment values above.

## Official references

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Prisma 6 on Vercel](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel)
- [Vercel function request limits](https://vercel.com/docs/functions/limitations)
- [Vercel function filesystem](https://vercel.com/docs/functions/runtimes)
- [Email from Vercel](https://vercel.com/kb/guide/sending-emails-from-an-application-on-vercel)
- [Google app passwords](https://support.google.com/accounts/answer/185833?hl=en)
