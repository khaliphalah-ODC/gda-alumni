# Membership email and tracking engineering report — 5 November 2026

The source implementation replaces staff-shared invitations with private applicant email delivery and one permanent numeric tracking code. It does not repair external credentials, enable a production flag, deploy code, migrate production, change DNS, or establish inbox receipt. Existing unrelated CI/animation changes in the workspace were preserved.

## Confirmed operational findings

The read-only audit on 4 November used the database and Brevo configuration selected by `backend/.env`. Credential values, recipients, private records and activation tokens were not printed.

| Finding | Evidence and implication |
| --- | --- |
| Platform email delivery is disabled | `PlatformSettings.emailEnabled=false`. The invitation gate at `backend/src/services/activation-delivery.service.ts:13` correctly prevents sending. This is a confirmed blocker in the locally configured database; no flag was changed. |
| Brevo rejects the configured credential | Read-only `GET /v3/account`, `/v3/senders` and `/v3/smtp/statistics/events` each returned HTTP **401 unauthorized**. This confirms failed authorization, not whether the key was expired, revoked, mistyped or restricted. No sender/log data could be retrieved. |
| Brevo wins over saved Gmail settings | Local `EMAIL_PROVIDER=brevo` overrides legacy `ACTIVATION_DELIVERY=smtp` at `backend/src/config/email.ts:3`. SMTP credentials being present therefore does not make this installation send through Gmail. No fallback silently changes providers. |
| Earlier development approvals did not send external invitations | Aggregate audit: four approved applications had `DEVELOPMENT`, one had `NONE`, one had `SENT`. Historical `SENT` records indicate provider acceptance only. The former development path returned a private link to Admin and sent no email. That API/UI path is now removed. |
| Local invitation origin is local | `FRONTEND_ORIGIN` is the local frontend. This is correct for local development; it is not evidence of the hosted origin. Production validation now requires HTTPS and rejects loopback frontend origins. |
| Hosted API runs, but is not ready | The documented Railway `/api/health` returned **200**. Its `/api/ready` and the Netlify `/api/ready` proxy both returned **503** with the database readiness failure message. This does not distinguish connectivity from missing schema; hosted logs and configuration are needed. |
| Authorized live diagnostic | The application-guarded diagnostic stopped before sending because email is disabled. A separate, explicitly authorized one-message transport diagnostic then selected the saved Gmail SMTP configuration in that process only. Gmail accepted the message; inbox receipt awaits user confirmation. No provider setting, platform flag or application record was changed. |
| Gmail SMTP works from this machine | A real SMTP connection/authentication check passed. The diagnostic required the configured sender to match the authenticated Gmail mailbox, then reused the application shared transport. Hosted SMTP connectivity is still unverified. |
| Sender/domain verification is unverified | The selected sender uses a consumer mailbox domain. Brevo's 401 prevented sender/account/log verification. No suppression, bounce, spam, quota or DNS cause is established. |

The former transport collapsed failures into a generic error and the membership service sent only within the approval/reissue request. There was no durable invitation queue. These were reliability/diagnostic gaps in addition to the confirmed configuration blockers. The new safe error classification is in `backend/src/services/email.service.ts:79`; queue processing and interrupted-send handling are in `backend/src/services/membership-invitation.service.ts`.

Hosted environment variables, hosted SMTP connectivity and real inbox placement were not verified. Local Gmail SMTP connection/authentication and acceptance of one authorized diagnostic were verified. The public readiness probes perform no record mutation and send no email. A key present in a file, a successful build, or an accepted provider request is insufficient evidence of delivery.

## Updated workflow and storage

1. Applying creates a pending application and exactly one backend-generated **12-digit** code using `crypto.randomInt`. The unique database index enforces uniqueness; the service retries numeric/reference collisions up to five times. An email-scoped transaction lock prevents simultaneous duplicate applications. Rejected applications may be followed by a genuinely new application.
2. Only the existing school **ADMIN** permission can approve/reject, resend or revoke. SUPER_ADMIN owns platform settings and does not acquire school approval rights. ALUMNI/STUDENT are denied. REGISTRAR is not an existing database role; the permission policy denies unrecognized roles.
3. Approval and a 48-hour single-use invitation/outbox row commit atomically. The first dispatch is awaited after commit; dispatch failure cannot undo approval. A persistent worker can resume a queued job if that request ends early.
4. The outbox job UUID and server-only `JWT_SECRET` derive the token through a domain-separated HMAC. Only its SHA-256 hash is persisted; neither raw nor encrypted activation credentials are stored in jobs or attempt records. Retries regenerate the same token. Rotating the signing secret invalidates outstanding derivations; the worker detects a mismatch instead of emailing a broken link. Admin must issue a replacement after such a rotation.
5. Sending reads the recipient from the approved application's registered email, uses the configured frontend origin, and sends escaped branded HTML plus plain text. The message gives the actual expiry timestamp and a private activation CTA. No unverified school contacts are invented.
6. A transaction-scoped application lock serializes approval/resend, worker claims and completion without relying on timestamp precision. Each attempt has a durable status/timestamp and a sanitized diagnostic. Admin sees recipient details, activation state, queue/provider status, recent attempt history and Resend Invitation. The API selects safe fields explicitly; it never returns job token hashes, private URLs or raw tokens. The Admin view contains no invitation-link field or sharing/copy control.
7. The activation page validates the emailed token before presenting password creation. The password must have at least 12 characters and fit the existing bcrypt byte bound; confirmation is checked in the UI. Atomic token consumption prevents concurrent reuse and duplicate account creation. Expired, revoked, superseded or consumed tokens fail. The new account uses the approved email; the applicant can then log in.

Application IDs, historical references and review relationships are retained. Numeric codes are backfilled without changing historical receipt hashes. New receipt responses contain the numeric code, status and submission time, with no second public identifier or tracking secret. Approval, delivery attempts, resend/revoke and activation never change the numeric code.

## Tracking and success screens

The success screen displays the requested heading, the backend-returned numeric code, Copy Tracking Code with feedback/fallback, tracking instructions, Track Application and Return to Homepage. It clearly separates application tracking from the later activation invitation. Refresh/repeated submission cannot create another active application for the same email.

`/membership/status` remains the canonical route; `/track-application` is an alias. New tracking requires the numeric code and registered email, followed by a six-digit email verification code. The request response is generic for absent/mismatched applications and disabled mail. A lost-code option verifies the email before returning the most recent application's numeric code. Earlier reference/secret receipts remain supported in a separate compatibility form.

Verification codes expire after ten minutes, work once, and allow at most five guesses. Their hashes use HMAC with the challenge UUID; raw codes are not stored. Requests have a per-application cooldown plus the existing shared/IP membership limit. Successful verification issues a random 30-minute proof, stored as a hash and held only in page memory by the frontend. Code-only, invalid or expired proof requests cannot retrieve private status or submit corrections. Codes/proofs never enter URL query strings.

Public responses omit email, verification information, Admin notes, invitation credentials and private account records. The timeline displays real submission/review/decision, provider acceptance or local capture, and activation events. It does not invent an IN_REVIEW state or mark a rejected application's activation stages complete. Historical DEVELOPMENT rows are not presented as mail captures unless an accepted outbox job exists. A local capture is labeled distinctly from external provider acceptance; neither is called confirmed inbox delivery.

## Delivery states, recovery and scheduling

| Status | Meaning and next action |
| --- | --- |
| QUEUED | Durable invitation awaits a worker. |
| SENDING | One worker has an atomic claim. Repeated requests cannot claim the same send. |
| SENT | The configured external provider accepted the message; inbox delivery is unconfirmed. |
| DEVELOPMENT | An explicitly enabled loopback mail catcher accepted the message. No external delivery occurred. |
| FAILED | A definite rejection or local configuration failure occurred. Safe retries use bounded exponential backoff, up to five attempts. |
| UNKNOWN | Timeout, ambiguous connection failure or interrupted worker leaves acceptance uncertain. No automatic resend; inspect provider logs, then use authorized replacement if needed. |
| CANCELLED | Invitation was revoked, superseded or expired before dispatch. |

Brevo retries reuse its deterministic idempotency key and payload. SMTP has no general exactly-once guarantee; ambiguous outcomes are deliberately held for review. Resend has a cooldown and invalidates older tokens. A new request cannot overwrite a later invitation's result. Completed/uncertain attempts remain auditable.

Long-running deployments use a worker in `server.ts` every 15 seconds. `npm --prefix backend run invitations:process` drains a bounded batch manually; built deployments use `npm run invitations:process:production`. On serverless hosts configure an authenticated scheduler calling `GET /api/cron/invitations` every minute with `Authorization: Bearer <CRON_SECRET>`. The existing daily maintenance route provides a slower fallback and removes expired tracking challenges. The repository does not install an external scheduler or change a hosting plan. Stable signing secrets must be shared by API instances and workers.

Password recovery, Admin invitations and email-change verification retain their existing workflows and shared transport. The new durable outbox is scoped to membership invitations. Tracking-code email uses the existing bounded background delivery helper; a lost verification message is recovered by requesting another after the cooldown. Failed tracking mail never grants a proof or exposes application existence.

## Local testing and provider configuration

Use Node **22.13+**. Validation here uses the cached Node **22.23.4** runtime and PostgreSQL **16**, with a separate `/tmp` cluster and no real alumni fixtures. Test providers are mocked or captured locally. The live configured database was read only. The only external send was the one separately authorized, token-free Gmail SMTP diagnostic; automated tests used mock/local providers.

Real local email: explicitly choose `EMAIL_PROVIDER=smtp` with the existing Gmail/app-password settings, or `EMAIL_PROVIDER=brevo` with a valid API key and verified sender. The platform switch must be enabled in the intended environment. Gmail app passwords require two-step verification and supported account policy; using Gmail SMTP with its own verified mailbox does not require purchasing a custom domain. See [Google app passwords](https://support.google.com/mail/answer/185833?hl=en).

For development-only capture, use the loopback Mailpit settings in [email delivery](email-delivery.md#read-only-provider-check-and-local-mail-capture). The actual SMTP transport can deliver to the catcher without external recipients. Production rejects this mode. Existing external SMTP retains verified TLS/mandatory STARTTLS; the deliberately insecure local catcher is strictly opt-in and loopback-only.

Read-only diagnostics:

```bash
npm --prefix backend run email:check
npm --prefix backend run email:check -- --verify-provider
```

The second command checks the platform flag and Brevo account/sender authorization or SMTP connection/authentication. Do not paste credentials into issue reports. Correct the locally configured Brevo key privately; it currently returns 401. Enabling email alone cannot fix failed provider authorization.

For Brevo, verify the configured sender and follow the account's domain instructions. Free mailbox senders cannot authenticate domains they do not own; Brevo documents sender-domain rewriting for such configurations. A custom domain is not an application requirement, but provider verification/policy still applies. If using an owned domain, follow Brevo's generated DKIM/DMARC records and provider SPF/return-path guidance; do not add speculative SPF records or change another mailbox provider's DNS. See [Brevo sender/domain setup](https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability) and [domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).

After provider access is restored, inspect [Brevo transactional logs](https://help.brevo.com/hc/en-us/articles/360021533839-Manage-your-transactional-logs-and-email-previews) for sender rejection, bounce, blocking, suppression and delivery events. Acceptance is not inbox placement. No delivery-confirmation webhook is installed. Brevo's [idempotency window](https://developers.brevo.com/docs/heterogenous-versions-batch-emails) is 30 minutes; this does not establish an indefinite exactly-once guarantee.

## Migration and hosted rollout steps

No production migration or deployment was performed. Before deploying:

1. Back up the intended database and verify restoration. Resolve the hosted `/api/ready` 503 using service logs and the read-only database diagnostic; do not assume the live environment matches local `.env`.
2. On the intended backend, privately set the correct explicit provider/key/sender, `NODE_ENV=production`, and `FRONTEND_ORIGIN=https://gda-alumni.netlify.app` if that is still the intended deployed frontend. Confirm SMTP outbound connectivity if choosing SMTP. No `VITE_*` value may contain mail credentials.
3. Apply the three November 4 migrations through the authorized release process, then generate/build the backend and frontend. Coordinate the API/frontend rollout because new submission receipts intentionally use the single-code contract; refresh older open browser tabs. The first migration extends enum states; the second backfills codes and adds the outbox/challenge tables; the third adds attempt history. All existing IDs, references and audit relationships remain intact. Backfill uses PostgreSQL's built-in random UUID source and retries unique collisions; no extension is installed.
4. Start the long-running worker or configure the authenticated serverless scheduler. Verify the new readiness schema check and public API proxy return 200.
5. Verify provider access/sender status, then have SuperAdmin enable platform email through the existing authenticated settings page. No flag is toggled by this implementation.
6. Use a designated synthetic staging applicant and the user's explicitly authorized test inbox. Confirm application → Admin approval → provider acceptance → actual mailbox receipt → activation → login. Confirm tracking/recovery and password-reset/email-change regressions on staging. Do not send tests to real alumni.
7. Once email works, Admin can resend invitations for affected approved/unactivated historical applications. This retains the application and code and invalidates the older unused token. No private link-sharing fallback exists.

The guarded one-message diagnostic requires a privately configured `EMAIL_TEST_RECIPIENT` and both `--send-test --confirm-send`; it still enforces the email switch. The application-guarded check stopped before sending; a separate authorized SMTP transport diagnostic submitted exactly one token-free message without changing application settings. The one-message authorization has now been used. Any additional live message requires further authorization; inbox receipt has not yet been confirmed.

## Validation results

Final checks on 5 November used Node 22.23.4 and isolated PostgreSQL 16:

| Check | Result |
| --- | --- |
| Final backend email/membership/environment/permission/local-SMTP suites | **98 passed**, 10 files, no skipped tests. Includes simultaneous expired-invitation resend, durable claims/retries, no Admin token leakage, recipient correctness, code persistence, legacy receipts, OTP limits, activation, password reset and email verification. |
| Frontend unit checks | **12 passed**, none skipped. |
| Production backend and frontend builds | **Passed** through root `npm run build`, including TypeScript checks. |
| Chromium public mobile/accessibility workflow | **Passed**, covering the new tracking and activation pages. |
| Chromium application → tracking/email verification → approval/private mail → activation/login → profile/stories/events/document completion | **Passed**, including mobile success-screen accessibility, actual Copy/clipboard behavior, stable numeric code and no Admin invitation-link control. |
| Chromium password recovery | **Passed**, including captured reset mail, password replacement, old-session invalidation and rejection of token reuse. All three final browser checks passed. |

The earlier full 253-test backend run recorded **250 passed and 3 failed** before the final fixes. The expired-queue resend and historical development-status cases were corrected, and the module-import timeout was increased for the busy local machine. All three failed suites are included in the final successful 98-test rerun. The complete 253-test command was not repeated after those fixes; this report does not claim a new all-suite green run.

The November 4 migration/backfill check verified an existing synthetic application's numeric code and preservation of its original ID, reference, tracking hash and review record. The three migrations were applied successfully again to the fresh temporary test database on November 5. `git diff --check` passed. No production data, hosted secrets or DNS records were changed, and no deployment/push was performed.

## Files changed by this task

- Schema/migrations: `backend/prisma/schema.prisma`; `20261104000100_membership_delivery_tracking`, `20261104000200_membership_outbox_tracking`, `20261104000300_invitation_attempts` migration directories.
- Transport/configuration: `backend/src/config/env.ts`, `backend/src/services/email.service.ts`, `activation-delivery.service.ts`, `backend/scripts/check-email.ts`, `backend/.env.example`.
- Membership/delivery/tracking: `backend/src/services/membership.service.ts`; new `membership-invitation.service.ts` and `membership-tracking.service.ts`; `backend/src/repositories/membership.repository.ts`; membership controller/routes/validator; new `backend/src/utils/membership-lock.ts`.
- Operations: maintenance routes, readiness repository, `server.ts`, new `backend/scripts/process-invitations.ts`, backend package scripts.
- Applicant/Admin UI: `RegisterView.vue`, `MembershipStatusView.vue`, `MembershipAdminView.vue`, `ActivateView.vue`; shared API types/router; new clipboard/progress utilities.
- Guidance: `GuidanceView.vue`, chatbot's bundled workflow guidance, README, email delivery guide and this report.
- Verification: updated membership/email/environment/backend suites, new outbox and real loopback capture tests, new frontend timeline tests; updated portal browser flow and functional/release Playwright mail fixtures; isolated backend Vitest provider/media defaults. Existing unrelated animation/CI edits were preserved.
