# CLAUDE.md

Interactive ad units built with **plain HTML, vanilla JS, and three.js**. No
framework, no bundler, no npm dependencies at runtime. Each ad is a self-contained
folder that renders inside a device-frame showcase.

## Layout

```
ads/
├── CLAUDE.md          this file
├── README.md          human-facing build notes
├── serve.js           static server WITH Range support — always use this
├── showcase.html      host shell: MacBook frame + calibrated iframe + theme toggle
├── macbook.png        mockup renders (not in repo — see "Missing assets")
├── macbook-light.png
└── miss_dior/         ad unit #1
    ├── screen.html    the ad; loaded into the showcase iframe
    ├── top.png        masthead        1920 × 230
    ├── content.png    publisher mock   960 × 7000
    ├── left.mp4       left rail        484 × 1080, 10s, 30fps
    ├── right.mp4      right rail       484 × 1080, 10s, 30fps
    ├── Layout.png     design comp      1920 × 1080  (reference only, not shipped)
    └── Button.png     CTA comp         1920 × 1080  (reference only, not shipped)
```

New ad units get their own sibling folder with a `screen.html` at its root.
Point `showcase.html`'s iframe `src` at it to preview.

## Run

```bash
node serve.js          # → http://localhost:8080/showcase.html
```

**Never suggest `python3 -m http.server` for this project.** Python's
`SimpleHTTPRequestHandler` does not implement HTTP Range requests. Without Range
the browser reports `video.seekable` as `[0, 0]`, every `currentTime` seek fails
**silently**, and scroll-scrubbed video sits frozen on frame 0 with nothing in
the console. `file://` has the same failure mode in some browsers. `serve.js`
exists solely to avoid this — it is ~60 lines, zero dependencies.

## Conventions

- Vanilla JS in a `<script>` at the end of `<body>`, wrapped in an IIFE with `'use strict'`.
- Plain CSS in a `<style>` in `<head>`. No Tailwind, no preprocessor.
- Layout in `vw` units derived from the design comp so the whole stage **scales**
  rather than reflows. Put the ratios in `:root` custom properties with the
  comp-pixel source in a comment, e.g. `--rail-w: 25.2083vw; /* 484 / 1920 */`.
- Comments explain *why*, not *what*. Non-obvious constraints (asset dimensions
  that must match, decoder quirks, event-timing reasons) get a comment.
- Ads are self-contained: relative asset paths, no cross-folder imports.

## Showcase calibration — do not change these numbers

Lifted verbatim from the reference showcase's `/dist/app.css`:

```css
--disp-left: 28.28%;  --disp-top: 23.22%;
--disp-w: 0.4305;     --disp-h: 0.4065;
--screen-w: 1280px;
--mockup-w: calc(var(--screen-w) / var(--disp-w));   /* 2973.29px */
```

Stage aspect is `4600 / 3068` → renders 2973.29 × 1982.87 → the iframe lands on
exactly **1280 × 806**. That is the canvas every ad composes against.

`--mockup-scale` (inline on `.stage`, currently `0.75`) is a **pure visual zoom**.
It must never affect the iframe's CSS pixel size. The theme toggle is a
body-level sibling of `.stage`, not a descendant — `.stage`'s `transform` would
otherwise trap and scale a `position: fixed` child. Theme persists in
`localStorage` under `metads:host-theme`, restored by an inline pre-paint script
so there's no flash on load.

## miss_dior — pin + scrub

Geometry, measured from `Layout.png` (1920 × 1080):

| region | comp x | width | vw | @1280 |
|---|---|---|---|---|
| left rail | 0 – 490 | 484 | 25.2083 | 322.7 |
| content column | 518 – 1401 | 884 | 46.0417 | 589.3 |
| right rail | 1418 – 1919 | 484 | 25.2083 | 322.7 |
| masthead | full width | 230 tall | 11.9792 | 153.3 |

The 484px rails match `left.mp4` / `right.mp4` native width **exactly** — the
split is baked into the video dimensions. Do not reflow rails independently; if
the composition needs to change, rescale the whole stage.

Masthead and both rails are `position: fixed`. Only the content column scrolls,
and its progress drives both videos:

```js
currentTime = (scrollY / (scrollHeight - innerHeight)) * duration
```

Nothing ever *plays* — every displayed frame is a seek. That's what makes
scrolling back up run the animation backwards for free.

Time is eased toward the scroll target inside a `requestAnimationFrame` loop
rather than assigned in the scroll handler. Two reasons, both load-bearing:
wheel events arrive in coarse jumps that look steppy, and the rAF loop throttles
seeks to roughly one per frame instead of one per event. Tuning constants live
at the top of the script in `screen.html` (`EASE`, `SNAP`, `SEEK_EPS`).

Verified mapping — preserve this behaviour if you refactor:

| progress | 0 | 0.25 | 0.50 | 0.75 | 1.0 | ↑ 0.50 | ↑ 0 |
|---|---|---|---|---|---|---|---|
| currentTime | 0 | 2.48 | 4.99 | 7.49 | 9.96 | 5.01 | 0 |

## Known issues

**Source videos need re-encoding before ship.** `left.mp4` / `right.mp4` carry
only 10 keyframes across 300 frames, so every seek decodes forward from the
nearest I-frame and the scrub is visibly chunky. All-intra fixes it:

```bash
ffmpeg -i left.mp4 -c:v libx264 -g 1 -crf 20 -pix_fmt yuv420p \
       -movflags +faststart -an left_scrub.mp4
```

**Missing assets.** `macbook.png` and `macbook-light.png` are the reference
showcase's own renders and aren't in the repo. `showcase.html` falls back to a
CSS-drawn laptop on the identical calibration when they're absent, so nothing
breaks — the frame just isn't photoreal.

**Open question.** `content.png` is 960px wide natively but sits at 884 in
`Layout.png`. Current build assumes the comp is imprecise and fills the 884-wide
column. If 960 was intended, widen `--content-w` to `50vw` and narrow the rails
to match.

## Gotchas worth remembering

- Percentage units are invalid in `box-shadow`; the whole declaration is dropped
  silently. Use px — the stage is `transform`-scaled anyway, so px still scales.
- Muted inline video can autoplay in some browsers. Scrubbed videos should
  `pause()` on load and re-`pause()` on the `play` event.
- Don't seek to exactly `duration` — some decoders park on a blank frame. Stop
  ~0.02s short.
- Playwright's bundled Chromium has **no H.264 decoder** (`canPlayType` returns
  `""`). To verify scrub logic headlessly, transcode a VP9/WebM test copy first;
  the real `.mp4`s will not load there and that is not a bug in the page.

## Testing

Verify in a real browser via `serve.js`. For headless checks, assert:

- iframe computes to exactly 1280 × 806
- rail / content / banner widths match the table above at a 1280 viewport
- `currentTime` tracks scroll progress linearly and returns to 0 on scroll-up
- no console errors other than 404s for the two absent mockup PNGs
