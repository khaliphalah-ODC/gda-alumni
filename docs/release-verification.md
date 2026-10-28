# Recovery, editable collections and deployment verification

This release implements the requested password recovery, announcement/event categories, editable curated content, shared rate limits and scheduled media cleanup. Neither frontend nor backend is deployed yet, so Vercel behavior and hosted browser checks remain unverified.

## Using the features

- **Password recovery:** Login → Forgot your password. Eligible active accounts receive a private link that expires in 30 minutes and works once. Resetting ends previous sessions. Student access and unapproved/unactivated alumni remain blocked. Public responses do not reveal whether an address exists. Configure Brevo HTTPS or SMTP, select `EMAIL_PROVIDER=brevo` or `EMAIL_PROVIDER=smtp`, and enable email in SuperAdmin platform settings first. See [email delivery](email-delivery.md) for required variables and guarded diagnostics.
- **Categories:** Admin announcement and event forms save a category. Public announcement buttons and the event category selector filter database records before pagination, alongside search, publication status and event dates. Existing uncategorized records remain available under All.
- **Gallery:** School Admin → Manage Gallery. Add/edit photographs, alt text, captions, dimensions, category and order. Save drafts, then publish. File upload and HTTPS image URL options use the existing media pipeline.
- **Achievements:** School Admin → Featured Achievements. Edit the image, front description, reverse-side details, heading, date, source link and order. Publishing requires an image and complete source details. Editing returns the card to draft.
- Only school **Admin** manages these school collections. SuperAdmin retains platform management. Concurrent edits use versions and return a conflict instead of overwriting newer changes.
- The first publication switches a collection from its bundled fallback to database content. Once managed, an empty/unpublished collection stays empty. Failed API requests show a retry instead of silently resurrecting bundled cards.

## Serverless operation

Apply `20261023000100_recovery_and_managed_content` before running the updated API. Vercel and production default to atomic PostgreSQL rate counters; client identifiers are HMAC hashes. `RATE_LIMIT_STORAGE=memory` is rejected on Vercel. Database failures do not bypass limits.

Set an independent random `CRON_SECRET` of at least 32 characters. Vercel configuration schedules `GET /api/cron/maintenance` at 03:00 UTC daily. It requires `Authorization: Bearer <CRON_SECRET>`. The handler drains bounded batches, records failures with exponential retry delays, and removes expired counters and old verification tokens. Overlapping workers claim different jobs; leases expire after two minutes if a worker stops. Immediate cleanup and reset-email delivery use Vercel `waitUntil`.

Daily scheduling fits Hobby's frequency. It is not a promise of instant deletion or guaranteed platform delivery: inspect cron execution logs and the `remaining` result. Use a more frequent authenticated scheduler when daily retries are insufficient. Invalid managed asset identifiers are retained for review instead of deleting arbitrary assets.

## Resumable image migration

From `backend`, against the intended database:

```bash
npm run media:migrate -- --import-curated --manifest backups/curated-media.json
npm run media:migrate -- --apply --manifest backups/curated-media.json
```

The first command is a dry run. Back up and restore-test an existing database before applying its schema migration. Cloudinary credentials are required for the second command. If more than one active school Admin exists, add `--admin-id <id>` to the dry run. Omit `--import-curated` to migrate only saved local profile/content images.

The private manifest records planned asset IDs, old references, versions and checkpoints. Each image is uploaded and retrieved over HTTPS before committing a reference. Existing local files are retained. The importer preserves the current curated gallery and achievement metadata as published database entries and then enables managed collections. It does not overwrite collections already under Admin management. Version checks stop a migration when a record has changed. Resume with the same manifest after interruption; do not create another plan for a partially completed migration.

Backups and manifests are ignored by Git and stored with private permissions. There is no automatic destructive rollback: keep the dump, manifest and original files for review and restoration. Bundled hero/decorative assets may remain part of the frontend build; these do not depend on writable backend disk.

## Reproduce local checks

Use a separate local PostgreSQL database named `gda_phase1_test`; never use school data for tests. Apply all migrations first. Set `PHASE1_TEST_DATABASE_URL` and `DATABASE_URL` to that local database.

```bash
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:excellence
npm --prefix frontend run test:e2e:release
```

Run database suites and browser suites sequentially because they intentionally manage isolated fixture aggregates. The release browser suite starts its own API and frontend, uses private temporary local images and a guarded test-only SMTP outbox, and removes fixtures afterward. That mail fixture is never loaded by the production entry point and is excluded from Vercel deployment inputs.

The existing opt-in real-provider browser suite uses `GDA_LIVE_MEDIA_TEST=1` and `GDA_TEST_CLOUDINARY_CLOUD_NAME`, `GDA_TEST_CLOUDINARY_API_KEY`, `GDA_TEST_CLOUDINARY_API_SECRET`, then `npm --prefix frontend run test:e2e:uploads`. Only synthetic pixels are uploaded; temporary provider assets are deleted afterward. Real provider tests from local services do not prove Vercel upload behavior.

## Hosted checks after deployment

Set `GDA_HOSTED_FRONTEND_URL` and `GDA_HOSTED_API_URL` to the HTTPS origins and run:

```bash
npm --prefix frontend run test:e2e:hosted
```

This checks deployed schema readiness, public collections, frontend category requests, recovery UI, image loading and anonymous permissions. Trace, video and screenshots are disabled to avoid capturing private tokens or credentials.

A hosted multipart write check is opt-in. Use an explicitly designated staging account whose email begins `e2e-`, with a saved profile and no image. Set `GDA_HOSTED_TEST_ALLOW_WRITES=1`, `GDA_HOSTED_TEST_EMAIL`, and `GDA_HOSTED_TEST_PASSWORD` privately. The check uploads synthetic pixels, reloads the image and removes it in `finally`; it refuses to overwrite an existing image. Do not point this fixture at a real user's account.

Still required on the deployed services: verify Vercel function bundling, cookie/proxy behavior, real reset-email inbox delivery, cron authentication/execution and uploads under the function request limit. Keep `IMAGE_MAX_BYTES=4194304` for Vercel.

## References

- [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Vercel function background work](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
