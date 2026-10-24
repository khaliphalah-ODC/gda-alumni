# Project review — 23 October 2026

This is the baseline review before the requested feature work. See [release verification](release-verification.md) for subsequent implementation, migration and verification results.

The core Vue/Express/Prisma application is implemented. Public launch setup and several feature extensions remain incomplete. A passing unit test or a configured key does not prove that a complete hosted workflow works.

This review inspected source, ran local checks, and read database configuration and aggregate counts. It did not change application records, send email, make paid chatbot calls, or upload images to an external provider.

## Current configuration, checked directly

| Item | Observed state | Meaning |
| --- | --- | --- |
| PostgreSQL/Neon | Connection/authentication and required tables/columns passed `db:check` | The earlier database error is not reproduced by today's probe. This is a point-in-time result, not a guarantee of continuous connectivity. |
| Accounts | Active SuperAdmin, Admin and Alumni accounts exist | The role setup exists. No real user's password was used to test a login. |
| Email | `ACTIVATION_DELIVERY=development`; SMTP host, sender and credentials absent; database `emailEnabled=false` | Real invitations, Admin invites and email-change confirmations are not available with these settings. Development activation links are supported locally. |
| Images | `MEDIA_STORAGE=local`; database `mediaEnabled=true` | Local server uploads are selected and enabled. Image processing/storage/serving is covered by tests. |
| Cloudinary | Credentials present and provider authentication check passed | Available as an external storage option. No real upload/delete cycle was run during this review. |
| Chatbot | Groq key present; database chatbot switch off; no current published FAQs | The assistant is deliberately unavailable. Key presence is not a verified provider response or quality evaluation. |
| Published content | No published Post records of any type | Announcements, stories, events, history and both leadership groups have no database-published content to display. Their empty states are expected. |
| Website origin | Local HTTP development origin | QR codes and activation links still target development. Configure the actual HTTPS frontend address before distributing them. |
| Vercel | Backend configuration exists locally; Vercel changes remain uncommitted; no authenticated account or live API URL verified here | Backend hosting preparation is done, but deployment and function bundling remain unverified. |

## Implemented features and their practical limits

| Area | Implemented | Remaining setup or limitation |
| --- | --- | --- |
| Public website | Home/About/Services/Contact, local school gallery, carousel controls, responsive routes, announcements/stories/events lists and detail pages | Publish verified database content. The curated gallery is sourced from local assets rather than an Admin gallery CMS. |
| Excellence showcase | Independent animated flip cards, keyboard/touch controls, focus handling, reduced motion, source links and optimized photographs | The two featured achievements are static editorial selections in source code, not Admin-editable achievements. The 2026 Facebook claim was not independently verified in the earlier implementation report. |
| Membership | Public application, visible optional Location/Address field, private tracking receipt, pending corrections, Admin review, approval/rejection and activation token handling | Complete real email configuration and test a hosted application-to-inbox-to-activation cycle. Address uses the existing `location` field and is copied into the activated alumni profile. |
| Membership QR | Admin sidebar and application-page links to `/admin/membership/qr`; preview, PNG/SVG download, copy and print; QR decoding test | It opens `${FRONTEND_ORIGIN}/register`. A localhost QR is unsuitable for public sharing. SuperAdmin does not receive school Admin permissions. |
| Authentication | Password hashing, cookie sessions, current database role/session checks, role-based routes, logout, CSRF/origin checks and request throttling | Real hosted browser sessions remain to be verified. Student access and direct public account registration are intentionally blocked; alumni apply for membership first. |
| Account settings | Profile updates, pictures/URLs, password change with current password, email-change verification | Email changes require SMTP and the email switch. There is no self-service forgotten-password recovery endpoint or UI. |
| Alumni | Approved alumni profiles/directory, search/filtering, account enable/disable and CSV export of the current page | Fresh database-backed end-to-end verification was not run in this review. Current-page export is not a whole-registry export. |
| Administration | Separate school Admin and platform SuperAdmin dashboards, content moderation/publication, history, school/alumni leadership and account/platform controls | Populate and approve real content. SuperAdmin handles platform settings rather than school-content operations. |
| Document requests | Submission, personal tracking, registrar notes, permitted status transitions, optimistic concurrency and restricted deletion | This manages requests and pickup status. It does not generate/deliver certificate PDFs, accept payments, or register event attendees. These are absent capabilities, not failing buttons. |
| Image handling | JPEG/PNG/WebP checks, processing to WebP, local disk or Cloudinary, HTTPS URL alternative, optimistic image versions and durable cleanup queue | Vercel cannot use persistent local disk uploads. Select Cloudinary and a 4 MiB limit there; existing localhost image URLs/files will not move automatically. |
| Chatbot | Public assistant/FAQ routes, extractive source answers, input checks, budgets, Admin FAQs and SuperAdmin settings | Publish school-approved FAQs, evaluate actual provider answers, and enable the switch. The tests mock Groq. No live inference was performed in this review. |

## Incomplete features and release work

1. **Finish hosting:** push the Vercel backend changes, authenticate/import with root `backend`, enter production variables, verify the real function bundle and `/api/health` plus `/api/ready`. Follow [the backend guide](vercel-backend.md). No frontend deployment was performed as part of the backend-only request.
2. **Finish email:** create the Gmail app password or use another SMTP provider; configure the backend; verify transport; enable email as SuperAdmin; test real invitation delivery and activation. Production approval intentionally refuses development delivery.
3. **Connect the public frontend:** choose its HTTPS origin and API proxy, then check hosted cookies, CORS/CSRF, private routes, QR URLs and invitation links. Keep secrets out of frontend build variables.
4. **Prepare Vercel images:** switch from local storage to Cloudinary, set `IMAGE_MAX_BYTES=4194304`, and test upload/save/reload/delete from the actual host. Transfer any needed local images rather than assuming the deployment contains them.
5. **Publish school content:** the current database has no published content or current FAQs. Add approved announcements, history, leadership and events so public sections can display them.
6. **Complete optional product features:** announcement category buttons are disabled because categories are not modeled; event-type categories, event registration/ticketing, contact-message delivery, verified school phone/email publication, self-service password recovery and online payments are absent. Confirm priorities before expanding scope.
7. **Finish serverless operations:** Express rate-limit counters live in process memory and do not provide a shared quota across Vercel instances. Image cleanup is queued durably but launched without waiting; no Vercel scheduled cleanup job is configured. Establish shared throttling and a reliable cleanup runner for production operation.
8. **Close verification/documentation gaps:** run database-backed tests and full browser workflows against an isolated test database, then test the actual hosted environment. CI exists, but its default browser command does not include the dedicated excellence suite. README setup references `backend/.env.example` and `frontend/.env.example`, which are absent; the new Vercel example does exist.

## Checks performed during this review

- Backend tests: **93 passed, 59 skipped**, across 26 files (15 passed files, 11 skipped files). The database suites were deliberately skipped because no isolated test database was configured; these results do not verify fresh writes against PostgreSQL.
- Frontend unit tests: **10 passed**, including QR decoding, membership normalization, login redirects, multipart upload transport, API proxy configuration and document transitions.
- Read-only live database connection/schema check: **passed**.
- Read-only platform flags and aggregate counts: **retrieved successfully**.
- Cloudinary authentication/status check: **passed**, without uploading an image.
- Backend TypeScript and frontend production builds: **passed** through `npm run build`.
- Local API probes against the configured database: **10 public GET checks returned HTTP 200**, covering health/readiness, announcements, stories, events, history, both leadership groups, chatbot availability and FAQs. Anonymous account and membership-QR access correctly returned **HTTP 401**. The probes used non-production mode and did not validate production SMTP readiness or deployed routing.
- Dedicated showcase Chromium checks: **4 passed** on the fresh frontend build, covering independent flips, keyboard focus/inert faces, source links, scoped accessibility, six viewport widths, reduced motion and touch controls. These tests mock API responses and are not full portal/database workflow tests.

The first frontend test attempt was prevented by sandbox IPC restrictions; rerunning with local IPC enabled passed. No product bug is inferred from that environment restriction. Credentials and personal records were not printed.

## Evidence in the repository

- [Membership form](../frontend/src/components/ApplicationFields.vue), [validation](../backend/src/validators/membership.validator.ts), [activation/profile persistence](../backend/src/repositories/membership.repository.ts)
- [Admin navigation](../frontend/src/components/DashboardSidebar.vue), [QR page](../frontend/src/views/MembershipQrView.vue), [QR decoding test](../frontend/tests/membership-qr.test.ts)
- [Role policy](../backend/src/policies/permission.policy.ts), [authentication](../backend/src/services/auth.service.ts), [account settings](../backend/src/services/account.service.ts)
- [Email delivery](../backend/src/services/activation-delivery.service.ts), [platform settings](../backend/src/services/platform.service.ts)
- [Image providers/cleanup](../backend/src/services/media.service.ts), [Vercel configuration](../backend/vercel.json)
- [Chatbot implementation](../backend/src/services/chatbot.service.ts), [chatbot report](chatbot-implementation.md)
- [Disabled announcement categories](../frontend/src/views/AnnouncementsView.vue), [contact limitations](../frontend/src/views/ContactView.vue), [help and collection limitations](../frontend/src/views/GuidanceView.vue)
- [Static achievements](../frontend/src/assets/excellence.ts), [gallery implementation](../frontend/src/components/SchoolGallery.vue)
- [CI workflow](../.github/workflows/ci.yml), [frontend test scripts](../frontend/package.json)
