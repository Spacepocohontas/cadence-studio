# GalaXia AutoCut Studio

Beat-synced music video editing inside the existing [Cadence Studio](../README.md) repository, deployed independently as a Vercel static app from the folder `autocut/`.

## Features
- Local file imports (the original audio & footage never leave the browser).
- Web Audio soundtrack decoding, RMS/transient analysis & estimated BPM/beat grid.
- Six video edit templates and a natural-language **local direction parser**.
- Editable scene-to-clip mapping and per-scene video effects.
- **Audio duration lock (ON by default):** the edit plan always covers exactly the decoded soundtrack duration; clips repeat or trim to fill without gaps.
- Preview follows the audio clock; visual source tracks are muted.
- Capture the canvas with browser MediaRecorder, muxing decoded audio into a WebM.
- Download JSON edit decision list as a lossless backup.

## Important limits
- The director is a local rule-based interpreter, **not the ChatGPT model**. Model-powered editing requires a configured provider, which is not bundled.
- BPM is an estimate: complex/quiet tracks can need manual adjustments.
- MediaRecorder WebM support varies; modern Chromium desktop browsers work best. Export timing may differ by a video frame, even with an exact edit plan. For frame-accurate output, a future encoder/remux pipeline is needed.
- No remote server processing for uploaded media. Files do not persist after the page reloads.
- Large or long video projects can exhaust browser memory, especially on iOS.

## Run
Open `autocut/index.html` on a local development server (ES modules require HTTP), e.g. `python3 -m http.server` from the repository root and visit /autocut/. 

Test: `cd autocut && npm test`.

License: same terms as parent repository.
