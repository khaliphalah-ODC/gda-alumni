# Frontend visual enhancements

The existing navy palette, local fonts, branding, public layouts, forms and role permissions are retained. School photographs replace static illustrative photos. User uploads and publication images continue to use their saved API URLs.

## Photographs

The centralized mapping is `src/assets/school-photos.ts`. All original files stay in the root `images/` folder. Production imports preserve their bytes, resolution and proportions; SHA-256 comparisons verified all 11 selected assets. `SchoolPhoto.vue` supplies descriptive alt text, intrinsic dimensions, contained presentation, lazy loading and asynchronous decoding. Only the first hero photograph loads eagerly with high priority.

| Original source | Usage |
| --- | --- |
| `images/heroimage1.jpg` | Hero and school gallery |
| `images/image2.jpg` | Home school preview, registration and gallery |
| `images/image4.jpg` | Hero, About and gallery |
| `images/paraimage4.jpg` | Hero, login decoration, registration and gallery |
| `images/sectionimage1.jpg` | Services and gallery |
| `images/upcoming1.jpg` | Generic community decoration on Services and gallery |
| `images/graduaimage1.jpg` | Registration and gallery |
| `images/graduaimage2.jpg` | Gallery |
| `images/image3.jpg` | Gallery |
| `images/paraimage.jpg` | Gallery |
| `images/paraimage2.jpg` | Gallery |

All 27 source images were visually reviewed. Unidentified portraits, official portraits and promotional posters were excluded from generic profiles and factual event/achievement content. Captions describe visible content without asserting names, event dates or accomplishments. There was no suitable authentic exam-document photograph, so the WAEC card uses a neutral document icon. Published records without images retain a neutral school icon. The previously recovered low-resolution `images/image1.jpg` is unused.

## Pages and components

Updated Home, About, Services, Login, Registration, Stories and Events; added `/gallery` with header/footer links. The existing About page still contains separate school and alumni leadership groups. Shared dashboard stat cards receive restrained motion without animated counters or delayed status values.

New components: `SchoolPhoto`, `ContentCarousel`, `HeroCarousel`, `MotionCard`, `AchievementCard`, `SchoolGallery`. Updated `AboutContentSection`, `PublicationImage`, `DashboardStatCard`, `PublicHeader`, `SiteFooter`, `App`, router scroll handling and `usePublicContent`.

- [Swiper **14.3.0**](https://swiperjs.com/vue) uses official Vue components. Modules: A11y, Navigation, Pagination, Keyboard, Autoplay and EffectFade. Card carousels use ordinary horizontal sliding. Only the hero uses a fade effect and optional autoplay, initially paused.
- [Motion for Vue **2.8.0**](https://motion.dev/docs/vue-animation) provides viewport entrances, bounded stagger, small hover elevation, desktop timeline direction changes, marker entrances, user-triggered milestone flips, gallery/menu entrances and short route opacity transitions.
- Reduced motion disables autoplay and movement, makes transitions immediate and keeps flip descriptions readable. Autoplay stops on manual controls, swipes, content focus, hidden tabs and leaving the viewport; hovering pauses it.
- Gallery preview uses a native modal dialog with focus trapping, Escape/close controls, focus restoration, full contained images, arrow keys and swipe navigation.
- Existing authentication, membership, activation, profiles, document workflows and role guards remain connected to their original services. SuperAdmin retains platform management.

## Published content and API compatibility

Stories, events and school milestones use actual public API responses. Empty, loading, retry, search and pagination states are preserved. No sample records are added to the application database.

The events list accepts optional `period=upcoming|past|all`; its default remains upcoming. Historical lists still require published records and exclude undated entries. The public history timeline requests `historyOrder=chronological`, sorting verified year/date strings before pagination. The default API/admin order remains display order, with display order also breaking equal-date ties.

## Performance and dependencies

Vite hashes and shares original image imports, splits public routes/carousel code and serves photos only when their image elements request them. Reserved aspect boxes prevent image loading shifts. Animations use transform/opacity; originals are not recompressed or resized. A single general motion library is installed. Compatible dependency patches update Vite to **6.4.5** and follow-redirects to **1.16.1**; npm audit reports zero vulnerabilities.

## Validation

Final results:

| Check | Result |
| --- | --- |
| Frontend `vue-tsc --build` | Passed on final source |
| Frontend production `vite build` | Passed on final source |
| Backend build and final `tsc --noEmit` | Passed |
| Frontend utility tests (`npm test`) | 7 passed |
| Backend content, About, validators and permissions tests | 19 passed across 4 files, using real local PostgreSQL |
| Existing Admin history / school leadership / alumni leadership lifecycle | Passed |
| Existing content image upload failure / retry / URL preservation workflow | Passed |
| Existing services tracking / private login redirect / document submission workflow | Passed |
| Existing membership review / activation / profile / story / event / document completion workflow | Passed |
| Final isolated `npm run test:e2e:visual` | 5 passed |
| Production photo SHA-256 comparisons | All 11 match original bytes |
| Dependency audit after compatible patches | 0 vulnerabilities |

The five final visual tests verify hero arrows, pagination, keyboard controls, opt-in autoplay, focus pause and real Chromium touch gestures; gallery filtering, full-image preview, focus trapping/restoration and Escape; actual published API records, chronological milestones, flips, history-anchor navigation, historical events, draft exclusion and retained image URLs; reduced motion; and eight public pages at 375, 390, 768, 1024, 1280 and 1440 pixels. Home, About and Gallery also pass automated WCAG 2 A/AA and 2.1 AA checks at 390 and 1440 pixels. The final sweep finds no horizontal overflow, failed assets, unexpected console errors or JavaScript exceptions. Anonymous session probes returning the expected 401 are excluded from console-error assertions.

There are **9 distinct successful browser checks** across the four existing regression workflows and five final visual tests. A combined run exceeded the unchanged API limit of 300 requests per 15 minutes; the visual suite now runs in a separate Playwright invocation with a fresh local server. No production rate limit was relaxed.

Browser fixtures are confined to an isolated local PostgreSQL database and cleaned after tests. This describes the original visual-enhancement run. In the subsequent upload repair, the pending additive History/Leadership migration was backed up and applied to the configured database; no school content records were changed. Hosted publication is still pending account access.

Screenshots used for manual comparison with the restored Stitch Home/About references are saved in `/tmp/gda-visual-validation/`. The comparison confirms retained typography, palette and section structure; photo content and the requested carousel/gallery additions intentionally differ.

## Limits

There is no separate backend gallery; the gallery is curated from local school photographs. Record-specific photos, names, dates and claims require administrator verification and publication through the existing content tools. Original photos are delivered at their original resolution to honor the instruction not to alter them. Only Chromium is available for automated browser validation. The existing history/leadership database migration must be applied in any environment that has not already received it; the upload-repair follow-up also applied this migration to the configured application database after backing up its Post table and migration metadata.
