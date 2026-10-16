# Cadence Studio

**Visualizer · Mini DJ Studio · Music Video Player**

A dark, responsive browser-based music studio. Upload audio/video/images, play with live Web Audio visualizations, EQ + delay, generate beat-synced scene plans, and record the canvas + mix straight to `.webm`.

### Live demo
**https://cadence-studio-ohnoitstamara-4066.vercel.app**

### Features
- Built-in synth demo track (“Night Circuit”)
- Drag-and-drop or file picker for audio / video / stills
- Real-time canvas visualizer (orbit, bars, tunnel, ink, horizon, constellation, bloom)
- Auto mode that switches looks with energy & beats
- Prompt-driven music-video scene planner
- Module generator for custom visualizer presets
- Deck EQ (low / mid / high), filter, delay
- Transport: play/pause, seek, volume, prev/next
- One-click frame snapshot (PNG)
- Live stage recording (canvas + audio → downloadable WebM)

### How to run locally
Just open `index.html` in a modern browser (Chrome / Edge / Firefox recommended).  
No build step required — pure HTML + Web Audio + Canvas.

### Deploy
Already live on Vercel. Push to `main` and it stays synced if you connect the repo.

---
Cadence — form follows the beat.


### Performance controls

Every entry page includes full-app and preview fullscreen controls, with an expanded view when the browser does not support fullscreen. Escape or the visible Exit button returns to the editor. Use Random look or the 12-second automatic shuffle to change visualization styles.

For music videos, open **Music video: mute & sync**, choose the loaded replacement audio, mute original video audio, and enable linked playback. A positive video delay keeps the video behind the soundtrack. Playback, seeking, and drift correction follow the replacement audio clock. Browser codec support still determines which audio and video files can play.

The v3 Dub panel also offers a dedicated video-master workflow: load video on one deck and replacement audio on the other, then Play Dub. It mutes original video audio and routes the fader to the selected replacement. Render controls support the new mirror and spiral looks.
