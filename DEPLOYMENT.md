# Railway + Netlify preview deployment

Use a dedicated preview environment: Railway hosts the Express API and PostgreSQL; Netlify hosts the Vue frontend. Cloudinary stores uploaded images. A Netlify `/api` proxy keeps browser sessions and uploads on the frontend origin, avoiding dependence on third-party cookies.

## 1. Reserve the preview frontend address

Create a dedicated Netlify project, for example `gda-aims-preview`, and note its actual primary HTTPS URL. Use that exact URL as Railway's `FRONTEND_ORIGIN` (no trailing path). Using the primary URL of a separate preview project gives testers one stable address for login and activation links.

The Netlify account and Railway account must be authenticated before services can be published. Secrets go in Railway variables, never in Git or Netlify's public `VITE_*` variables.

## 2. Railway API and preview database

Create a separate Railway project/environment and a PostgreSQL service. Add an API service from this repository. For a Git-based deployment set:

| Setting | Value |
| --- | --- |
| Root directory | `/backend` |
| Config file | `/backend/railway.json` |
| Builder | Dockerfile, using `Dockerfile` in the service root |
| Pre-deploy command | `npm run prisma:deploy` |
| Start command | `npm start` |
| Healthcheck | `/api/ready` |

These build/deploy settings are already in `backend/railway.json`. The Dockerfile uses Node 22, includes OpenSSL and Sharp dependencies, generates Prisma Client, compiles TypeScript and removes development dependencies. The Prisma CLI remains a runtime dependency so migrations work before the app starts.

Set the following Railway service variables:

| Variable | Preview value |
| --- | --- |
| `NODE_ENV` | `production` (secure cookies and hosted configuration checks) |
| `DATABASE_URL` | Railway reference `${{Postgres.DATABASE_URL}}`, replacing `Postgres` with your database service name |
| `JWT_SECRET` | Unique random value, generated with `openssl rand -hex 48` |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_ORIGIN` | Exact primary HTTPS URL of your Netlify preview project |
| `TRUST_PROXY_HOPS` | `1` for the Railway edge; verify the actual forwarding chain before increasing this |
| `EMAIL_PROVIDER` | `brevo` for HTTPS production delivery; `smtp` is also supported |
| `BREVO_API_KEY` | Private API key when using Brevo |
| `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Verified Brevo sender address and display name |
| `ACTIVATION_DELIVERY` | Legacy fallback (`smtp` or `development`) only when `EMAIL_PROVIDER` is unset |
| `SMTP_HOST` | Required only for SMTP: your delivery provider hostname |
| `SMTP_PORT` | `587` for STARTTLS, or `465` for implicit TLS |
| `SMTP_SECURE` | `false` with 587; `true` with 465 |
| `SMTP_FROM` | Provider-approved sender address |
| `SMTP_USER`, `SMTP_PASSWORD` | Provider credentials, both set or both omitted for a trusted relay |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary product environment cloud name |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Server-only signed-upload credentials |
| `IMAGE_MAX_BYTES` | `5242880` (5 MB) |

Railway supplies `PORT`; the API listens on it. Do not bind this service to `localhost` or publish a development Vite server.

The pre-deploy command applies all migrations, including history and both leadership groups, to the selected preview database. Use the dedicated preview database rather than the current application's database. A readiness failure means database access/migrations or production email configuration needs attention; check deployment logs before retrying. See [email delivery](docs/email-delivery.md) for provider selection and local Gmail settings.

Generate a Railway public HTTPS domain for the API. Verify `https://YOUR-API.up.railway.app/api/ready` returns HTTP 200 before configuring the frontend proxy.

For local source deployment instead of Git, install/use the official CLI, sign in and link the intended project/service first:

```bash
npx @railway/cli login
npx @railway/cli link
npx @railway/cli up ./backend --path-as-root
```

For this CLI path the archive root is `backend`; use `/railway.json` as the config file path and leave the service root directory unset. Do not combine that archive root with a second `/backend` service root. Never use `--no-gitignore` to include local secrets.

## 3. Bootstrap the preview platform account

On the API service set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME` and a unique `SUPER_ADMIN_PASSWORD`. Open a Railway service shell and run:

```bash
npm run super-admin:bootstrap:production
```

The command is initial-only; it never promotes existing accounts or replaces an existing SuperAdmin. Remove the bootstrap password from service variables afterward.

Log in on the Netlify preview URL, open SuperAdmin → Platform settings, enable email delivery and Cloudinary uploads, and confirm with the SuperAdmin password. Admins retain school-content management; SuperAdmin retains platform management.

From the Railway service shell these checks are available:

```bash
npm run email:check:production
npm run media:check:production
npm run media:check:production -- --upload
```

The email check validates configuration without making a network request or sending mail. Sending a single diagnostic message requires an explicitly configured recipient, user confirmation and both guarded flags described in [email delivery](docs/email-delivery.md). `smtp:check:production` remains available for SMTP-only connection checks. The first media check verifies Cloudinary credentials and the upload switch. `--upload` creates one tiny temporary image and immediately deletes it. Use `npm run media:cleanup:production` to retry queued cleanup jobs if needed.

## 4. Netlify frontend

The repository includes root `netlify.toml`. Use these project settings:

| Setting | Value |
| --- | --- |
| Base directory | Repository root (`.`), so root `images/` stays available to Vite |
| Build command | From `netlify.toml`: installs frontend dependencies and runs `build:netlify` |
| Publish directory | `frontend/dist` |
| Node | `22`, already set in the config |
| `API_PROXY_ORIGIN` build variable | Actual public HTTPS origin of the preview Railway API, without `/api` |
| `VITE_API_URL` | `/api`, already set in the config |

The build writes `frontend/dist/_redirects` with the API rule first and the Vue Router fallback second:

```text
/api/*  https://YOUR-API.up.railway.app/api/:splat  200!
/*  /index.html  200
```

The generator rejects missing API configuration, non-HTTPS origins, embedded credentials and accidental `/api` path duplication. It fails the build instead of publishing a frontend with a broken API target. Express marks API responses `Cache-Control: no-store`; hashed frontend assets can be cached safely.

To build locally after installing frontend dependencies:

```bash
API_PROXY_ORIGIN=https://YOUR-API.up.railway.app npm --prefix frontend run build:netlify
```

To publish the built frontend to your dedicated preview project:

```bash
npx netlify-cli login
npx netlify-cli link
npx netlify-cli deploy --prod --dir frontend/dist --no-build
```

Here `--prod` publishes the primary URL of the **separate preview project**, not the real school production project. Check the linked project before running it. Draft/PR preview URLs have different origins: full authentication and mutations require a matching isolated Railway environment and matching `FRONTEND_ORIGIN`. Do not loosen CORS/CSRF protections to allow arbitrary preview domains.

## 5. Preview checks

On the Netlify URL check `/api/health` and `/api/ready`; both must return API JSON, not the Vue HTML fallback. Refresh a nested route such as `/about` or `/login` to verify SPA routing.

Test a complete alumni application/approval/activation cycle, then a profile photo upload. As Admin test announcement, story, event, history and both leadership photo uploads. Photos appear after **Save content / Save draft** completes, then publication controls determine public visibility. A file preview alone is not an uploaded image. Save a personal profile first when adding a staff profile picture.

If uploads are disabled, use **Refresh upload availability** and verify the server variables plus the SuperAdmin switch. JPEG, PNG and WebP are supported up to 5 MB. When an upload fails, the saved draft remains available for retry. Run `media:check:production -- --upload` to distinguish provider/configuration problems from frontend issues.

Netlify's proxy has a documented 26-second timeout. Keep the Railway API awake during preview testing when testing larger uploads, and verify provider latency if an upload reaches that timeout. The browser helper uses proper multipart form data with the existing CSRF header and version checks.

## Local validation

```bash
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

The upload browser test uses an isolated local database named `gda_phase1_test`. It refuses other databases. Standard browser suites leave Cloudinary disabled. The optional real-provider upload suite is enabled only by `GDA_LIVE_MEDIA_TEST=1` plus explicit test credentials; it uploads only a generated solid-color test image and deletes its own temporary assets and records after the run. Cleanup retries transient failures and records unresolved asset IDs in a private `/tmp/gda-uploads-*-assets.json` manifest and the isolated database cleanup queue. No live school records are used.

## Verified locally (22 October 2026)

- Frontend unit tests: 9 passed, including multipart transport and Netlify proxy configuration.
- Backend upload, account, alumni, environment and permission regressions: 32 passed against isolated PostgreSQL.
- Backend TypeScript build and frontend production build: passed.
- Browser visual suite: 6 passed, including six screen widths and light/dark footer accessibility.
- Configured application readiness passed earlier with HTTP 200 after applying the missing History/Leadership migration with a backup. The latest probe failed because the configured Neon database host could not be reached; stable external connectivity is still required.
- Cloudinary direct synthetic upload and deletion: passed. Provider connectivity has been intermittent during verification.
- Real-provider browser checks: alumni story and both alumni profile screens passed; the final targeted Admin/SuperAdmin account-photo test also passed. The Admin content upload test still encountered provider HTTP 502. All captured temporary assets were deleted. Full live-provider verification remains incomplete.
- Docker image build: attempted twice, including host networking; npm downloads failed with `ETIMEDOUT`. The production image has not yet been smoke-tested. Retry `docker build -t gda-aims-preview:local backend` with working registry connectivity.
- Hosting publication requires authenticated Railway and Netlify accounts; no hosted preview URL has been created.

## Official references

- [Railway configuration as code](https://docs.railway.com/config-as-code)
- [Railway monorepos](https://docs.railway.com/deployments/monorepo)
- [Railway CLI path deployments](https://docs.railway.com/cli/deploying)
- [Netlify monorepos](https://docs.netlify.com/build/configure-builds/monorepos/)
- [Netlify rewrites and API proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
- [Netlify CLI deploy](https://cli.netlify.com/commands/deploy/)
