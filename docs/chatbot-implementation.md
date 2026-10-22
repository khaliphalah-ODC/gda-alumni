# Public Groq assistant — 22 October 2026

Implemented inside the existing Express/Vue application. No private account, directory, membership or document lookups are delegated to the model. SuperAdmin retains platform-only permissions.

## Features

- Public `/api/chatbot/availability`, `POST /api/chatbot/messages`, `/api/chatbot/faqs` and Vue assistant in PublicLayout.
- Keyboard focus/Escape, suggested questions, loading/errors, clearing, mobile layout, text-only answers and source links. Each question is independent; ten exchanges maximum remain in page memory. No conversation database or browser storage.
- Public `/help/faqs` shows approved, unexpired school answers, with direct citation anchors.
- Admin `/admin/chatbot`: FAQ create/edit/approve/unpublish/delete, review dates within one year, optimistic version checks and audits. Maximum 200 entries.
- SuperAdmin `/super-admin/chatbot`: enabled switch, allowlisted model, daily requests, estimated daily cost allowance, key-presence status and aggregate usage. Changes require current password and are audited. Admin/Alumni cannot access configuration; SuperAdmin cannot edit school FAQs.

## Grounding

Built-in implementation guidance covers registration, approval/activation, tracking, documents, events and navigation. It does not invent school fees, history or processing promises. Admin supplies approved school policy/FAQ answers. Published announcements and future published events contribute current public passages. No queries target accounts, profiles, requests or membership applications.

Groq selects relevant source IDs from a bounded candidate set. The server returns the corresponding stored passages, never generated prose or links. This extractive approach provides verifiable answers rather than conversational rewriting. Unknown questions receive an explicit missing-information response and Contact link. Sources are rechecked after inference for publication/expiry/content changes. FAQs are cited at `/help/faqs#faq-ID`.

Questions and sources are treated as data. There are no tools, browsing or generated database queries. Common email/phone/URL/credential formats are rejected before provider calls; this is not comprehensive personal-data redaction. Users are instructed to ask general questions only.

## Privacy and usage

No conversation text is persisted or logged by the chatbot. Groq receives only the current question and public passages, never previous messages or account/session credentials. Keep reverse-proxy request-body logging disabled as well.

UTC-day request counts and conservative cost reservations contain no identifiers. Aggregate records older than 30 days are removed on the next assistant request. Page memory is cleared by navigation, closing the page or Clear chat; merely hiding the panel retains the current page's chat.

[Groq's data policy](https://console.groq.com/docs/your-data) describes reliability/abuse retention exceptions up to 30 days and operator-controlled Zero Data Retention. Configure that in Groq Data Controls if required; the portal does not configure it remotely. The Privacy page discloses provider processing.

Six requests/IP/minute apply in each process, alongside the existing API limiter. Atomic database-backed global daily request and estimated-cost reservations survive restarts and apply across instances. Shared per-IP rate limiting remains an infrastructure extension. Inputs are limited to 600 characters; source context is bounded; completions are capped at 1,024 tokens; timeout is 15 seconds; no automatic retries. Errors expose no provider bodies/credentials. Provider limits return retry-later guidance.

Reservations bound input tokens conservatively by UTF-8 bytes plus framing allowance, and reserve the full output cap. Failures retain reservations. Catalog-based estimates are application allowances, not guaranteed invoice caps: configure Groq project spending limits and review pricing before deployment.

## Models and evaluation

[Groq model catalog](https://console.groq.com/docs/models), checked 22 October 2026:

| Model | Published speed | USD/million input/output tokens | Estimate for 1,000 input + 100 output |
|---|---|---|---|
| `openai/gpt-oss-20b` | 1,000 tokens/sec | 0.075 / 0.30 | $0.000105 |
| `openai/gpt-oss-120b` | 500 tokens/sec | 0.15 / 0.60 | $0.000210 |

20B is the provisional default for passage selection due to lower published cost and higher generation speed. These are provider figures, not measured end-to-end latency. Model size alone does not establish superior application accuracy.

`cd backend && npm run chatbot:evaluate` makes eight paid synthetic public evaluation calls across both models and reports exact-selection scores, mean latency and estimated token cost. It requires GROQ_API_KEY. The local environment has no key, so no measured quality/latency winner or real provider success is claimed. Evaluate actual school FAQ examples before release and select the model through SuperAdmin settings.

[Text API](https://console.groq.com/docs/text-chat) · [Rate limits](https://console.groq.com/docs/rate-limits). Exact provider limits depend on the operator's project.

## Activation

1. Take the normal backup, apply additive migration `20261022000100_public_chatbot` using `npm run prisma:deploy` from backend, then run `npm run prisma:generate`. It adds three chatbot tables and defaults availability off. The new tables are required by readiness, so migrate before deploying the updated backend.
2. Set GROQ_API_KEY in the backend environment and restart/redeploy. Never put it in VITE variables.
3. Admin prepares and publishes school-approved answers with review dates. No fictional school data is seeded.
4. Run live evaluation, configure Groq spending/data controls, then SuperAdmin enables the assistant and sets allowances.

The hosted database and production deployment were not changed. All ten migrations were replayed successfully in a new isolated local PostgreSQL database.

## Verification

- `backend/src/__tests__/chatbot.test.ts`: source allowlisting, sensitive input, unknown questions, malformed responses, provider errors/timeouts, publication/expiry queries and quota handling.
- `chatbot.database.test.ts`: actual API role restrictions, password confirmation, audit records, publication, expired FAQs, stale edits and atomic concurrent quotas.
- `frontend/e2e/chatbot.spec.ts`: desktop/mobile panel, focus/Escape, clearing, source routes, provider errors, WCAG checks, disabled state and management forms.

Automated provider responses are mocked. Browser test servers explicitly clear GROQ_API_KEY so local credentials cannot be spent. Live Groq quality/latency testing and hosted activation remain operator steps.

Final verification: backend and frontend production builds passed; 24 focused backend tests passed across three files; all three chatbot Chromium scenarios passed, including desktop/mobile accessibility with zero scoped axe violations. The full unrelated regression suite was not rerun.
