# Handy Waveform Animation

## What This Is

A rework of the recording overlay waveform animation in Handy, a Tauri-based voice-to-text desktop app. The current filled-blob-with-Catmull-Rom-splines approach looks static and inelegant. Replacing it with a Siri-style multi-wave flowing animation that responds sensitively to voice input.

## Core Value

The recording waveform must feel alive, responsive, and elegant — a flowing multi-wave animation where even quiet speech produces visible movement, and silence shows gentle organic motion.

## Requirements

### Validated

- Overlay window system works correctly (172x36px, transparent, always-on-top, cross-platform)
- FFT pipeline delivers 16 frequency buckets at 400-4000Hz, normalized 0-1
- Tauri `mic-level` event carries Vec<f32> to frontend at variable rate (50-200ms)
- Canvas element (90x24px) renders in the overlay middle section
- requestAnimationFrame loop with lerp smoothing architecture (refs, no React re-renders)
- Mic icon, cancel button, transcribing/processing text states all work

### Active

- [ ] Siri-style multi-wave animation (2-3 overlapping sine waves with phase offsets)
- [ ] Quiet speech sensitivity (soft voice should visibly move the waves, not look idle)
- [ ] Organic idle state (waves gently ripple even when silent — always feels alive)
- [ ] Smooth voice response (waves grow naturally with volume, no discrete jumps)
- [ ] Pink/white color theme (match existing overlay aesthetic, with layered opacity for depth)
- [ ] Graceful transitions (idle → active → idle should feel continuous, not switched)

### Out of Scope

- Rust FFT changes — the backend data is good enough, this is purely a frontend rendering problem
- New overlay dimensions — keep 172x36px window, 90x24px canvas
- Automated visual testing — verification is human-visual only

### Future Milestone Ideas

- **Light orange color system**: Change whole system color (menu bar + voice bar) to a light orange theme. Push to fork only, NOT a PR to upstream.
- **Voice bar positioning fixes**: Review and fix any positioning issues with the voice bar. Could be coupled with the orange color change as one milestone.


### PR Strategy

- **This milestone (waveform animation)**: Create PR to the original upstream repo
- **Orange color change**: Push to fork only, no upstream PR

## Context

- **Current state**: RecordingOverlay.tsx uses Catmull-Rom spline interpolation to draw a filled blob shape from 16 FFT buckets. The result looks static, doesn't respond well to quiet speech, and lacks the flowing elegance of tools like Siri's voice indicator.
- **Target aesthetic**: Siri-style — multiple overlapping sinusoidal waves that shift amplitude/frequency with voice. Always moving, layered for depth, pink/white palette.
- **FFT data quality**: Good. Hann window, logarithmic spacing, DC removal, dB normalized. The problem is purely in how the data is visualized, not the data itself.
- **Variable update rate**: FFT updates arrive every 50-200ms (buffer-driven, not fixed rate). The animation must interpolate smoothly regardless of input timing.
- **Quiet speech threshold**: Current idle detection (totalEnergy < 0.15) may be too aggressive. Quiet speech that produces small but non-zero levels should still animate.
- **Canvas constraints**: 90x24px is small. Waves need to be simple and readable at this size — no fine detail.

## Constraints

- **Frontend-only**: No Rust/backend changes. Only modify RecordingOverlay.tsx and RecordingOverlay.css.
- **Performance**: Must maintain 60fps in the rAF loop. Canvas is tiny (90x24) so this should be easy.
- **Existing architecture**: Keep the refs-based approach (targetLevelsRef, smoothedLevelsRef, rafRef). No React state for animation data.
- **Color**: Pink/white theme to match overlay's dark background (#000000cc).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Siri-style multi-wave over filled blob | User finds current blob static and inelegant. Siri wave is always moving, responds well to voice. | -- Pending |
| 2-3 overlapping waves with phase offsets | Creates depth and visual richness. Single wave looks too simple at 90x24px. | -- Pending |
| Keep pink/white color palette | Matches existing overlay theme. No need to change brand. | -- Pending |
| Frontend-only changes | FFT data quality is good. Problem is rendering, not data. | -- Pending |
| Lower idle threshold for quiet speech visibility | Current 0.15 threshold hides soft speech. Need to let small levels through. | -- Pending |

---
*Last updated: 2026-02-15 after initialization*
