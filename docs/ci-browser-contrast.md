# Recurring Portal checks failure

The latest run on `fb5346b` and the previous run on `200f9dc` both passed installation, Prisma generation/migrations, backend/frontend builds and unit tests. Both failed at `npm run test:e2e`, before the later animation and release checks could run.

GitHub's annotations identify two failures in `frontend/e2e/portal.spec.ts`: the mobile public-page accessibility audit and the full membership/document workflow's dashboard audit. Both report serious `color-contrast` violations.

The route wrapper faded the entire public page from opacity 0 to 1. Dashboard cards did the same for their labels. A fast browser audit could inspect those temporary translucent states; on a slower local run, animations could finish before the same assertion. Repeated pushes retained the cause, so each new workflow could fail again. These results do not identify a Brevo/SMTP, migration or build failure.

## Correction

- Keep route, card, achievement, mobile-navigation and gallery content fully opaque during entrance effects. Movement, scale, hover behavior and reduced-motion support remain.
- Keep the existing WCAG/axe contrast assertions enabled.

- Add `frontend/e2e/accessibility-motion.spec.ts`. It records    mutations from the first render with normal motion enabled, checks public and dashboard text, and runs axe afterward. It is included in the existing animation/accessibility CI stage.
- Retain browser traces and screenshots on functional-test failures. The existing artifact-upload step collects them.
- Name the browser workflow stage and split animation/accessibility and release checks into separately identified CI steps.
- Explicitly select development delivery in functional browser servers and mocked SMTP in release browser servers, clearing Brevo credentials in both. A developer's local provider selection cannot override those fixtures.

The new public-page regression failed against the previous build, recording opacity 0. It does not rely on a fixed sleep or turn off accessibility rules.

## Reproduce

Use Node 22, install the locked dependencies, and apply existing migrations to an isolated local PostgreSQL database named `gda_phase1_test`. Set `DATABASE_URL` and `PHASE1_TEST_DATABASE_URL` to that test database. Use test-only credentials, no live provider keys, and development email delivery. Build both packages first.

From `frontend`, run:

```bash
npm run test:e2e
npm run test:e2e:excellence
npm run test:e2e:release
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed Chrome/Chromium executable locally; CI installs Playwright's Chromium. Backend test data and browser fixtures must never target production.

Past failed runs remain red because they belong to older commits. Push the corrected code and inspect a new run; re-running an old commit does not apply workspace changes. This workspace task does not itself push a commit or establish a green hosted run.

## Local verification — 3 November 2026

- Backend and frontend builds passed.
- Complete backend suite: **240 tests passed across 34 files**, on Node 22.23.4 with a freshly migrated, isolated PostgreSQL 16 database.
- Frontend unit suite: **10 passed** on Node 22.23.4.
- Functional browser coverage: **32 distinct tests passed** across the grouped workflow runs, including the two previously failing portal tests and responsive dashboard accessibility. The dashboard check was rerun successfully after a local build interrupted its preview server.
- Animation/accessibility suite: **9 passed**, including the three new first-render opacity regressions.
- Release browser suite: **5 passed**, including captured-email password reset and actual local image upload/replacement.

That is **46 distinct browser checks**. These are local Chromium results across grouped runs, not a new hosted GitHub run. The final PDF and release browser checks used Node 22.23.4. Backend and browser suites used separate temporary databases when run concurrently. All email delivery was mocked or captured by the local fixture; no real email was sent.

The final release run deliberately inherited dummy Brevo settings in its parent process. Its browser server explicitly selected the SMTP fixture instead, and the password-reset flow passed. See [email delivery](email-delivery.md) for provider setup, membership flow and the guarded real-test command.

Sources: [latest run](https://github.com/khaliphalah-ODC/gda-alumni/actions/runs/40719471131), [latest annotations](https://api.github.com/repos/khaliphalah-ODC/gda-alumni/check-runs/123133303789/annotations), [previous annotations](https://api.github.com/repos/khaliphalah-ODC/gda-alumni/check-runs/121888077163/annotations).
