# Gray D. Allison Alumni Portal

Vue 3/TypeScript frontend and Express/Prisma/PostgreSQL backend. Requires Node.js 22.13 or newer (`.nvmrc` selects Node 22).

## Setup

1. Run `npm ci --prefix backend` and `npm ci --prefix frontend`.
2. Copy `backend/.env.example` to `backend/.env` and configure PostgreSQL, a JWT secret, SMTP and Cloudinary as needed. Use `frontend/.env.example` for frontend overrides.
3. Run `npm --prefix backend run prisma:generate`, then `npm --prefix backend run prisma:deploy` against the intended database. Apply all migrations, including History and Leadership, before starting the API. Preserve a backup of any existing database.
4. For an initial installation, configure `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME` and `SUPER_ADMIN_PASSWORD`, then run `npm --prefix backend run super-admin:bootstrap`. Invite Admin accounts from the SuperAdmin dashboard.
5. Run `npm run dev` and open `http://localhost:3000`. The API defaults to port 4000; Vite proxies `/api` to the configured backend port.

Admin accounts manage school operations, history milestones, and separate School and Alumni leadership directories. Only published records appear on the About page. SuperAdmin manages platform settings and administrative access. Enable media in platform settings after configuring Cloudinary to use file uploads; image URLs also work.

## Checks

Run `npm run build` and `npm test` from this directory. For database and browser tests, set `PHASE1_TEST_DATABASE_URL` to an isolated local PostgreSQL database named `gda_phase1_test` with all migrations applied. Run the backend tests before browser tests.

From `frontend`, install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. The suite starts local test servers and manages its own fixtures.

`/api/health` checks the API process; `/api/ready` checks required database fields and production delivery configuration. Production requires HTTPS, configured Brevo HTTPS or SMTP delivery and server-side credentials. Never commit `.env` files or database backups. See [email delivery setup](docs/email-delivery.md) for Brevo on Railway, Gmail locally, legacy provider compatibility and guarded testing.

For database connection errors, run `npm --prefix backend run db:check` to verify connectivity and required tables without changing records. For Neon, preserve the connection string from its Connect dialog (including `sslmode=require`) and append `&connect_timeout=15&pool_timeout=15` to allow time for idle compute startup. See [Prisma's Neon timeout guidance](https://docs.prisma.io/docs/orm/v6/overview/databases/neon). Restart the backend after editing `backend/.env`. If connections still time out, check the Neon project's compute status and network access to outbound port 5432, and try another network to isolate local connectivity problems.

## Preview hosting and uploads

For **Vercel backend-only deployment**, use [docs/vercel-backend.md](docs/vercel-backend.md). Import the repository with Root Directory `backend` and the Express preset. The Vercel backend uses external PostgreSQL and Cloudinary, with a 4 MiB image limit; server disk uploads are not supported there.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Railway API/PostgreSQL and Netlify frontend configuration. The frontend uses a same-origin API proxy for hosted sessions and image uploads. Run `npm --prefix backend run media:check -- --upload` to verify Cloudinary and delete the temporary diagnostic asset.

Image files can also be stored on the API server without a Cloudinary account. Set `MEDIA_STORAGE=local`, `MEDIA_UPLOAD_DIR` to an absolute directory, and `MEDIA_PUBLIC_ORIGIN` to the API's public origin (for local development, `http://localhost:5000` if the backend uses port 5000). Restart the API, then enable **image uploads** in **SuperAdmin → Platform settings**. Existing file-upload controls work with either provider; HTTPS image links remain available. JPEG, PNG and WebP files are checked and converted to WebP before storage. `media:check -- --upload` tests the selected provider and removes its temporary image.

On hosting, server storage requires a persistent mounted disk, backups and an HTTPS `MEDIA_PUBLIC_ORIGIN`. An ephemeral deployment filesystem loses images when the instance is replaced. All API instances must share the same image volume. Keep Cloudinary credentials while there are old Cloudinary assets to clean up; cleanup identifies each asset's provider separately. No database migration is required.

Admin accounts can open **Membership QR code** in the sidebar or from **Membership Applications**. The page generates the QR locally, previews it, downloads PNG/SVG, copies the public link and prints a sharing sheet. It encodes `${FRONTEND_ORIGIN}/register`, the existing public application form. Configure the deployed frontend origin before distributing codes; a localhost code cannot be used by remote applicants. The QR contains only the public URL, with no tracking or activation credentials. The sharing page and its configuration endpoint require Admin permission.

## Public school assistant

Groq SDK integration, private PDF storage, Admin approval, PostgreSQL retrieval, setup and verification: [AI knowledge implementation](docs/ai-knowledge-implementation.md). Apply the additive knowledge migration before deploying this backend. Keep `GROQ_API_KEY` server-only; configure `GROQ_MODEL` and `AI_CHAT_ENABLED`. Admin manages PDFs at `/admin/ai-knowledge` and FAQs at `/admin/chatbot`; SuperAdmin controls enablement, models and usage at `/super-admin/chatbot`. Scanned PDFs are flagged for OCR; documents remain quarantined until manual safety and public-information review.
