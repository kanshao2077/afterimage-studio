# AFTERIMAGE changes / 2026-10-16

## 2026-10-19 — GitHub Pages

- Added automatic testing, static builds and deployment through GitHub Actions.
- Added configurable Vite base paths; made the demo image and home link relative to the build base.
- Prepared Pages metadata, a static 404 fallback and `.nojekyll` for distribution.
- Excluded local QA files and account-specific hosting state from the public repository.

Based on Oslonline/dithering-studio, upstream commit `9298a44c54a8d02a5b5b5956c1c1c7f9785fda59`.

- Added a new AFTERIMAGE interface by 马路Milo, with warm bone-white and charcoal colors, oxide-red accents, local Chinese pixel typography, image/video modes, comparison, a compact desktop control panel, and a stacked mobile layout.
- Reused the original image/video dithering hooks, algorithm registry, palettes, frame exports, preset utilities and video encoders.
- Fixed initial paused video rendering and re-rendering after paused seeks; made timeline seeking immediately reflect pointer input.
- Resolved infinite duration metadata in local MediaRecorder WebM files; used native video looping so recording can stop at the end.
- Added custom diffusion-kernel updates for both image and video previews.
- Added abort support for GIF recording and cleaned up playback, exported object URLs and capture streams.
- Replaced the default application entry and metadata, removed the analytics component from the active application, and changed the production build to a static application without upstream SEO prerendering.
- Retained upstream license and notices in source and production static assets. The user-facing interface carries AFTERIMAGE branding.

Modified upstream files: `src/main.tsx`, `src/hooks/useDithering.ts`, `src/hooks/useVideoDithering.ts`, `src/hooks/useVideoRecording.ts`, `src/utils/gifEncoder.ts`, `index.html`, `package.json`, `package-lock.json`, `README.md`.
