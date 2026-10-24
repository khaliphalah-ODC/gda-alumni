# Excellence showcase

The homepage renders `ExcellenceShowcase.vue` immediately after the institutional introduction. `AchievementFlipCard.vue` owns each card's state and focus. Motion for Vue provides one-time scroll entrances; scoped CSS provides the 600 ms 3D rotation, hover elevation and image zoom. Reduced motion removes transforms/transitions while preserving the same controls. Inactive faces use `inert` and `aria-hidden`, and focus moves to the newly active face's button.

The two editorial selections and their source metadata live in `frontend/src/assets/excellence.ts`. They are separate from Admin-published HISTORY records. Existing announcements, stories, events and history API calls remain in place. There is no separate Achievements route or achievement-specific backend model in this repository, so the section links to the existing About/history destination and the existing Swiper photo gallery. No swipe gestures are nested inside the flip cards. Future school-published milestones remain managed by the existing History workflow.

Sources:

- 2017: [Ministry of National Defense, National Flag Day report](https://mod.gov.lr/liberia-celebrates-170th-national-flag-day/) confirms third place and 29 participating schools.
- September 2026: [Ministry Facebook post supplied in the implementation brief](https://www.facebook.com/modliberia/posts/1492531776241236/). Facebook could not be fetched during implementation. The brief's statement is preserved as a ministry-attributed *reported* WASSCE result; it is not presented as independently verified examination data.

Photographs:

- `images/image4.jpg` → `frontend/src/assets/excellence/parade.webp` (960 × 538, approximately 70 KB).
- `images/graduaimage1.jpg` → `frontend/src/assets/excellence/graduation.webp` (768 × 1024, approximately 107 KB).

Both originals were visually inspected. Derivatives use Sharp resizing and WebP quality 82; no synthetic imagery or content replacement was used. Original photographs remain intact. Full photographs are contained in their frames and lazy-loaded with explicit dimensions. Their dates and the identities of participants are not asserted.

Validation commands:

```sh
npm --prefix frontend run build
node --import ./backend/node_modules/tsx/dist/loader.mjs --test frontend/tests/*.test.ts
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm --prefix frontend run test:e2e:excellence
```

The dedicated browser configuration starts only the built frontend and intercepts public API responses. It requires no database and does not change records. Tests cover independent flips, keyboard and touch, focus/inert behavior, sources, reduced motion, accessibility, existing homepage request paths, and layouts at 375, 390, 768, 1024 and 1440 pixels. This does not establish live backend availability or independently verify external-source contents.

## Completed verification — 2026-10-23

- Production build passed, including Vue/TypeScript checking and Vite asset generation.
- All six existing frontend test files passed.
- All four dedicated Chrome tests passed on the production build (1.1 minutes). All five requested viewport widths passed checks for layout, face clipping and horizontal overflow.
- The section's WCAG A/AA accessibility scan returned no violations. Keyboard, touch, independent state, source-link opening and reduced-motion focus transfer passed.
- The browser test captures a native CSS transition at 200 ms and resumes it before continuing. The captured frame was visually reviewed and shows the card's projected 3D rotation; front/back and responsive screenshots were also reviewed.
- Reduced-motion mode disables transitions throughout each card, including inherited visibility transitions from the site's global rule, so the new face can receive focus immediately.

No deployment was performed. No authentic photograph is missing for the selected parade and graduation categories; exact event dates for those photos remain unidentified. The Facebook-source and live-backend verification limitations above still apply.
