# Photo uploads and presentation fixes — 26 October 2026

The app identity is **GRAY D ALLISON ALUMNI AND INFORMATION SYSTEM**, supplied by one frontend branding constant. Public navigation, login, the homepage, dashboard branding, footer heading and browser titles use it. School names in historical content and photograph descriptions remain unchanged.

The homepage slideshow fills its frame using cover cropping. Other photographs retain their existing fit, including uncropped gallery previews. Achievement cards are centered, at most 448px wide, with 192px photograph frames, smaller text and spacing, and content-driven height. Flip controls, source links, keyboard focus and reduced motion remain supported.

## Upload behavior

### File chooser correction — 28 October 2026

The shared content button **Upload image file** now opens the device file chooser directly. Previously it only switched the editor to file mode. The input stays mounted so the chooser opens during the original click or keyboard/touch gesture. Reopening the chooser preserves the current selection. Profile screens also expose a **Choose photo** button; **Upload selected image** submits the chosen file.

The chooser works independently of backend upload availability. Saving still checks the existing permissions, profile and storage prerequisites. The frontend must be redeployed before hosted users receive this change.

After building the frontend, run `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npx playwright test --config playwright.file-picker.config.ts` from `frontend`. These browser checks mock API responses and make no database or storage writes. They cover all eight content editors, all three account roles, the alumni profile, keyboard/touch activation and retaining a selection when reopening the chooser.

File pickers allow local selection and preview while availability is loading or unavailable, or before a profile exists. Upload submission stays blocked until its existing prerequisites are satisfied. Availability refreshes preserve the selected file, and uploading from Account Settings preserves unsaved personal-profile fields.

The account response adds optional `media.unavailableReason` text. Missing backend storage and a disabled SuperAdmin upload switch have separate messages. Older backend responses remain supported by a generic explanation. There are no new database migrations or upload endpoints.

## Railway and Netlify release

The code must reach both deployments before the hosted behavior changes. This workspace currently has no Railway/Netlify authentication, and its GitHub push dry run failed because Git credentials are unavailable; no live release was performed.

On Railway, use `MEDIA_STORAGE=cloudinary` and privately configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Never put those credentials in Netlify/frontend variables. In SuperAdmin → Platform settings, enable image uploads. Save a personal profile before submitting its picture. The API still enforces permissions, file type/size validation and image versions.

After deployment, verify an upload through `https://gda-alumni.netlify.app`, reload the image, replace it and remove it using a designated test profile. A local preview or locally configured Cloudinary account does not verify Railway's environment or storage authentication.

## Reproduce checks

- `npm --prefix backend run build`
- `npm --prefix backend test -- local-media.test.ts upload-limit.test.ts content-image.test.ts security.integration.test.ts`
- `API_PROXY_ORIGIN=https://gda-alumni-production.up.railway.app npm --prefix frontend run build:netlify`
- `npm --prefix frontend test`
- `npm --prefix frontend run test:e2e:excellence`
- `npm --prefix frontend run test:e2e:release` with `PHASE1_TEST_DATABASE_URL` pointing to an isolated local `gda_phase1_test` database with migrations applied.

The browser suites cover compact card geometry and both faces, responsive branding, full hero coverage, keyboard/touch/reduced-motion behavior, picker availability, failed refreshes, missing profiles, real local multipart uploads, persistence, replacement and cleanup. Real Cloudinary browser tests are opt-in through the existing `test:e2e:uploads` script and private `GDA_TEST_CLOUDINARY_*` variables.

## Verification results

- Backend TypeScript build passed; 19 image/storage/security regression tests passed, including distinct unavailable reasons and managed-asset cleanup.
- Frontend unit tests: 10 passed. The Netlify production build and redirect generation passed against the Railway API origin.
- Release browser checks: five passed against isolated PostgreSQL, including actual multipart storage, persisted images, failed availability refreshes, replacement/deletion cleanup, missing-profile selection and unsaved text preservation.
- Achievement interaction/layout checks passed for keyboard, touch, reduced motion and unclipped faces. Hero coverage and responsive branding were checked across mobile, tablet and desktop widths.
- Real Cloudinary authentication passed. Browser uploads passed for Alumni stories/profile screens, Admin and SuperAdmin profiles, and all six school-content editors. The first content run received one 502; the targeted rerun passed. This verifies successful provider access, not continuous availability. Registered temporary provider assets were cleaned up by the tests.
- These checks ran from local services. Railway's selected storage, its private credentials, SuperAdmin upload settings, and the final hosted browser flow still require verification after an authenticated deployment.

The final targeted reruns also passed with the native file chooser, and with desktop navigation visible at 1280px and 1440px. The final Netlify build passed. Provider cleanup manifests record zero registered assets awaiting deletion. The temporary PostgreSQL instance was stopped after verification.
