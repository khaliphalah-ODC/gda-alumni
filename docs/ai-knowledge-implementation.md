# Groq assistant and PDF knowledge base — 27 October 2026

This extends the existing Express/Prisma/Vue assistant. It preserves authentication, HTTP-only sessions, CSRF protection, Cloudinary image handling, school workflows and role permissions. No production migration or deployment was performed.

## What changed

- Official `groq-sdk` 1.6.0 provides generated, evidence-grounded answers, strict JSON output, a 15-second timeout and zero automatic retries.
- `unpdf` 1.9.1, using its bundled Mozilla PDF.js parser, extracts genuine PDFs at upload/reprocess time.
- Node **22.13+** is now required by the backend. `.nvmrc`, the package engine and CI agree with the existing Node 22 Railway Docker image. Netlify already selects Node 22.
- Admin `/admin/ai-knowledge` manages PDF upload, progress, search, category/status filtering, metadata, extracted passages, review, public-original authorization, replacement, archiving, permanent removal and reprocessing.
- Existing Admin `/admin/chatbot` continues to manage approved FAQs; SuperAdmin `/super-admin/chatbot` owns enablement, supported model selection, daily allowances, output token limits and credential-presence/usage status.
- The existing floating `SchoolChatbot.vue` adds the school-assistant welcome, retry action and message display. Conversations remain in page memory; no chat-history table or browser persistence was introduced.
- `/help/knowledge/:id` displays approved passages and their page references. Citation links include the correct passage-list page and anchor.

## Server configuration

```dotenv
GROQ_API_KEY=YOUR_SERVER_ONLY_KEY
GROQ_MODEL=openai/gpt-oss-20b
AI_CHAT_ENABLED=true
AI_PDF_MAX_BYTES=10485760
```

Never add the credential to a `VITE_*` variable. `GROQ_MODEL` supplies the initial default; a saved SuperAdmin model selection takes precedence. Models are allowlisted centrally in `backend/src/config/ai.ts`. The environment switch can force chat off; SuperAdmin's database switch also must be enabled. Existing database settings are preserved and an unconfigured assistant defaults off.

Existing rate-limit storage configuration is reused, including the database-backed store for production/serverless deployments. Public chat accepts up to 600 characters and six requests per IP per minute. PDF upload/reprocessing allows ten attempts per IP per hour and at most two recent processing jobs globally. The library holds at most 200 PDFs. SuperAdmin controls 1–10,000 daily provider calls, the estimated cost allowance and 256–2,048 output tokens (default 1,024). Daily counters contain no messages or identifiers; failed provider calls retain their reservations.

## Database and original storage

Additive migration: `20261026000100_ai_pdf_knowledge`.

- `AiKnowledgeDocument`: metadata, private `BYTEA` original, hash, size, filename, category, processing and approval states, quality warnings, empty pages, uploader/reviewer, review time, edition, optimistic version and replacement relationship.
- `AiKnowledgeChunk`: text, document relationship, page, ordering and edition. Removing a document cascades to its passages.
- Existing `ChatbotSettings`: adds `outputTokenLimit`; existing FAQ and usage models are reused.
- SQL GIN expression indexes support English full-text search on PDF chunks and FAQs.

No private object store is configured in this repository. Originals therefore use the existing private PostgreSQL database, with no public bucket, local persistence, extra credentials or dependency on a serverless filesystem. Metadata queries exclude original bytes. Database capacity and backups must include PDF storage; for a large library, migrate this storage adapter to a configured private object service. The 200-document ceiling is an application bound, not a guarantee that every database plan has capacity for 2 GiB of originals.

Railway accepts the configured 10 MiB default. Vercel's effective application cap is 4 MiB to leave room for multipart overhead under its request-body limit. The UI receives the effective limit from the API. Runtime-copy and Vercel inclusion rules ship the parser worker and bundled parser assets.

## PDF safety and processing

1. Current-session Admin authorization and CSRF checks run before multipart parsing.
2. Multer bounds file bytes, fields, field lengths and part count. The service checks `.pdf`, `application/pdf`, `%PDF-x.x` and the EOF marker, computes SHA-256 and strips paths/control characters from the filename.
3. Original bytes are stored privately with `PENDING` approval and `PROCESSING` extraction. No upload is automatically public or approved.
4. A worker has no inherited environment credentials, a 128 MiB old-generation heap limit, a 20-second timeout, a 200-page ceiling, bounded image dimensions and at most one million extracted characters. Parser diagnostics are drained without logging document content or internal paths. No OCR runs during questions.
5. Evaluation/XFA are disabled. Active-action indicators, JavaScript actions, dangerous annotation links and embedded files fail processing. These checks are defense in depth, **not antivirus scanning**.
6. Pages are normalized and split into passages of at most 1,200 characters with 150-character overlap. Each passage stays on one original page and retains its edition and order.
7. No usable text yields `OCR_REQUIRED`. Partial empty pages yield `NEEDS_REVIEW`, with page numbers and warnings. Extraction failures retain the quarantined original and a safe diagnostic; Admin may retry or remove it.

**Quarantine is the implemented malware-control workflow. Automated antivirus and OCR are not installed.** Admin must review the original offline using the institution's approved security process, review extraction and explicitly attest that the content is safe, verified public school information without individual transcripts, confidential student information or private alumni records. Approval of OCR-required or failed documents is refused. For scans, use an external approved OCR process and upload the resulting text PDF, or create a verified FAQ. Partially readable documents require manual quality review; only their extracted pages can be retrieved.

Private originals can be downloaded only by authenticated Admin, as attachments with octet-stream/nosniff/sandbox headers. Public original download requires a separate explicit Admin authorization plus current approval, readable processing and completed security review. Rejection, archiving, replacement or reprocessing revokes public access. Deletion removes both bytes and passages and retains an audit action.

## Approval and replacement

`PENDING`, `REJECTED`, `ARCHIVED` and `SUPERSEDED` documents never enter retrieval. Approval requires `READY` or reviewed `NEEDS_REVIEW` text and the safety/public-information attestation. Metadata edits and reprocessing remove approval. Version checks reject stale mutations.

Replacement creates a new quarantined edition; the previous approved edition stays available during review. Approval supersedes the previous edition atomically and revokes its public-original link. Superseded editions cannot be restored directly. Audits record upload, metadata changes, review decisions, reprocessing, replacement and removal; document text and chat messages are not put in audit records.

## Retrieval and answer generation

`chatbot-retrieval.ts` tokenizes a bounded question, removes common stopwords and expands a few portal-workflow synonyms. Parameterized PostgreSQL English full-text queries rank eligible PDF passages and current published FAQs using `websearch_to_tsquery`/`ts_rank_cd`. Published announcements, historical/upcoming events, achievements and history can contribute matching public content. Curated implementation guides cover navigation and account/document procedures.

At most twelve sources, with bounded passage lengths, are sent to Groq. Entire PDFs and private original bytes are never sent. The public retrieval code does not query users, profiles, membership applications or academic document requests. No tools, generated SQL, web search, approval action or mutation endpoint is provided to the model.

Central instructions identify the Gray D. Allison School Assistant, require evidence for claims, distinguish event timing, forbid private status lookups and treat retrieved text as untrusted data. Strict provider JSON and local Zod checks validate the response. Returned citation IDs must come from retrieved evidence, with at most three sources. Evidence is rechecked after inference; withdrawn, expired, changed or superseded sources cause an unconfirmed-information response. Provider-generated URLs/HTML are refused; only server-owned citation paths reach the UI. Missing evidence does not spend a provider request.

Full-text search is lexical, not semantic; synonyms and paraphrases can be missed. Generated prose is not a mathematical guarantee of factual correctness. Admin source review, restricted context, citation validation and explicit unknown responses reduce that risk; evaluate real approved school material before public activation. Embeddings, a vector database and automatic OCR were not added.

## API routes

All paths below have the `/api` prefix.

| Route | Access and behavior |
| --- | --- |
| `GET /chatbot/availability` | Public enablement status |
| `POST /chatbot/messages` | Existing public validated/rate-limited RAG endpoint |
| `GET /chatbot/faqs` | Current approved FAQs |
| `GET/PATCH /super-admin/chatbot` | SuperAdmin configuration; writes confirm current password |
| `GET/POST /admin/chatbot/faqs`, `PATCH/DELETE /admin/chatbot/faqs/:id` | Existing Admin FAQ management |
| `GET /admin/ai-knowledge` | Admin paginated library, filters, categories and effective upload limit |
| `POST /admin/ai-knowledge` | Admin multipart upload: `document`, `title`, `description`, `category` |
| `GET /admin/ai-knowledge/:id?page=1` | Admin metadata and paginated extracted passages |
| `PATCH /admin/ai-knowledge/:id` | Admin metadata edit with numeric `version` |
| `POST /admin/ai-knowledge/:id/review` | Admin `decision`, `version`, `confirmedPublicAndSafe`, `publicOriginal` |
| `POST /admin/ai-knowledge/:id/replace` | Admin replacement multipart, including previous `version` |
| `POST /admin/ai-knowledge/:id/reprocess` | Admin reprocessing with `version` |
| `DELETE /admin/ai-knowledge/:id` | Admin permanent removal with `version` |
| `GET /admin/ai-knowledge/:id/original` | Admin-only private attachment |
| `GET /chatbot/documents/:id?page=1` | Public approved source metadata and passages |
| `GET /chatbot/documents/:id/original` | Public only with explicit, current original-download authorization |

SUPER_ADMIN has platform permissions, not school-management permissions. ALUMNI cannot manage knowledge. The existing STUDENT role remains disabled; the repository has no separate REGISTRAR role to extend. Existing role definitions were preserved.

## Local setup and release instructions

Use Node 22.13+ (`.nvmrc` selects 22), then:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run prisma:generate --prefix backend
```

For local development, point `backend/.env` at the intended development database and run `npm run prisma:deploy --prefix backend`. For deployment, back up the intended database and apply the additive migration through the existing release process **before** starting this backend, because readiness checks require the new tables/column. Do not reset or seed production.

```bash
npm run build --prefix backend
npm run build --prefix frontend
npm run chatbot:check --prefix backend
```

`chatbot:check` uses one synthetic public registration question; it performs no database writes and prints only connection/model/citation-check metrics. It requires the server credential and can incur a small provider charge. Admin can then upload/inspect/approve public knowledge; SuperAdmin can enable the assistant after setting allowances. Publishing code and changing production data remain operator steps.

For automated integration tests, set both `DATABASE_URL` and `PHASE1_TEST_DATABASE_URL` to an isolated `localhost`/`127.0.0.1` PostgreSQL database named **gda_phase1_test**, with migrations applied. The integration/browser harness rejects hosted or differently named databases. Clear provider credentials for automated runs. Existing frontend Playwright configuration starts local backend and frontend servers; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using a system browser.

## Verification record

See the final verification entry below for executed commands and results. Provider responses are mocked in automated suites. No production database mutation, hosted browser test, antivirus installation or OCR success is claimed.

## Implementation files

New: `backend/src/config/ai.ts`; `services/groq-provider.ts`; `services/chatbot-retrieval.ts`; `services/ai-knowledge/{pdf.ts,pdf.worker.cjs,service.ts}`; `routes/ai-knowledge.routes.ts`; `scripts/{copy-runtime-files.cjs,check-ai.ts}`; the additive migration; PDF fixtures and knowledge/provider tests; `frontend/src/views/{AiKnowledgeView.vue,KnowledgeSourceView.vue}`; `frontend/e2e/ai-knowledge.spec.ts`; `.nvmrc`.

Updated: existing chatbot service/validation/routes/tests, app route mounting, environment schema/example, database readiness, Prisma schema, backend dependencies/build script, Vercel worker inclusion, CI Node version, frontend navigation/router/chat component/settings and browser-test script. Existing Cloudinary image services and school business workflows were not changed.

References: [Groq TypeScript SDK](https://github.com/groq/groq-typescript), [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [unpdf extraction and untrusted-PDF guidance](https://github.com/unjs/unpdf), [Vercel function configuration](https://vercel.com/docs/project-configuration/vercel-json).


## Final verification — 27 October 2026

All automated database writes used a newly initialized local PostgreSQL 16 database named `gda_phase1_test` on port 55433. All twelve migrations applied successfully. Automated provider responses were mocked and live credentials cleared for integration/browser server processes.

| Executed verification | Result |
| --- | --- |
| Complete backend `npm test` with `DATABASE_URL` and `PHASE1_TEST_DATABASE_URL` set to the isolated database | **191 tests passed, 32 files** |
| Focused `ai-knowledge.database.test.ts` run after the final review/race assertions | **12 passed**, including real multipart PDF upload/extraction, role/CSRF rejection, size/type validation, original privacy, approval, metadata invalidation, stale edits, processing-review protection, OCR flags, unsafe-content rejection, retries, replacement, supersession, archive, FAQ/public-post retrieval, deletion/audit and rate limits |
| Final `ai-knowledge.test.ts` rerun after worker-exit hardening | **6 passed**, including real two-page extraction, blank pages, active-script rejection, validation and chunk/page/edition preservation |
| Official SDK and RAG unit suites, plus existing chatbot database suite | Passed in the complete backend run; provider responses mocked |
| Frontend `npm test` | **10 passed** |
| `npm run build` in backend and frontend using Node 22.23.4 | Both passed, including TypeScript checks and runtime worker copying |
| `chatbot.spec.ts` Chromium scenarios | **3 passed**: desktop/mobile chat, focus/Escape, sources, errors/clearing, accessibility, disabled state and role-specific management |
| `ai-knowledge.spec.ts` Chromium scenarios, rerun after correcting fixture email normalization | **2 passed**: real upload/approval/source/privacy/archive/removal with desktop/mobile layout and axe checks; SuperAdmin exclusion and output-token settings |
| `npm run chatbot:check` with the configured local Groq credential | **Passed**: one synthetic public registration request using `openai/gpt-oss-20b`, verified citation ID, approximately 2.2 seconds in this single check |
| Frontend production bundle credential scan | **63 JS/HTML files checked; configured server Groq credential absent** |
| `git diff --check` | Passed |

The initial focused test expected disabled STUDENT sessions to return 403; the fixture assertion was corrected to the existing 401 behavior. The initial browser fixtures stored uppercase emails although login normalizes them; the fixtures were corrected and both PDF browser scenarios passed. Authentication behavior was not changed. These were test-fixture/expectation corrections, not suppressed application failures.

The full unrelated frontend browser collection was not rerun. The final five relevant browser scenarios passed across their runs. The one live provider check establishes connectivity for a synthetic question, not school-corpus answer quality or hosted service health. No production migration, hosted browser verification or deployment was performed. The temporary PostgreSQL instance was stopped after verification.

## Changed-file manifest

- `.github/workflows/ci.yml`
- `README.md`
- `backend/.env.vercel.example`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/prisma/schema.prisma`
- `backend/src/__tests__/chatbot.database.test.ts`
- `backend/src/__tests__/chatbot.test.ts`
- `backend/src/app.ts`
- `backend/src/config/env.ts`
- `backend/src/repositories/health.repository.ts`
- `backend/src/routes/chatbot.routes.ts`
- `backend/src/services/chatbot-knowledge.ts`
- `backend/src/services/chatbot.service.ts`
- `backend/vercel.json`
- `docs/chatbot-implementation.md`
- `frontend/package.json`
- `frontend/src/components/DashboardSidebar.vue`
- `frontend/src/components/SchoolChatbot.vue`
- `frontend/src/router/index.ts`
- `frontend/src/views/ChatbotManagementView.vue`
- `package.json`
- `.nvmrc`
- `backend/prisma/migrations/20261026000100_ai_pdf_knowledge/migration.sql`
- `backend/scripts/check-ai.ts`
- `backend/scripts/copy-runtime-files.cjs`
- `backend/src/__tests__/ai-knowledge.database.test.ts`
- `backend/src/__tests__/ai-knowledge.test.ts`
- `backend/src/__tests__/fixtures/pdf.ts`
- `backend/src/__tests__/groq-provider.test.ts`
- `backend/src/config/ai.ts`
- `backend/src/routes/ai-knowledge.routes.ts`
- `backend/src/services/ai-knowledge/pdf.ts`
- `backend/src/services/ai-knowledge/pdf.worker.cjs`
- `backend/src/services/ai-knowledge/service.ts`
- `backend/src/services/chatbot-retrieval.ts`
- `backend/src/services/groq-provider.ts`
- `docs/ai-knowledge-implementation.md`
- `frontend/e2e/ai-knowledge.spec.ts`
- `frontend/src/views/AiKnowledgeView.vue`
- `frontend/src/views/KnowledgeSourceView.vue`
