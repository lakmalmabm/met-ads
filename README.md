# Miss Dior — Site Takeover

Recreation of the met-ads desktop showcase: a MacBook device frame wrapping a
1280×806 iframe, with a scroll-scrubbed site takeover inside it.

```
ads/
├── serve.js            static server with Range support (see below)
├── showcase.html       host shell — device frame, iframe, theme toggle
├── macbook.png         ← you need to add these two
├── macbook-light.png   ←
└── miss_dior/
    ├── screen.html     the ad itself
    ├── top.png         masthead        1920 × 230
    ├── content.png     publisher mock   960 × 7000
    ├── left.mp4        left rail        484 × 1080, 10s
    └── right.mp4       right rail       484 × 1080, 10s
```

## Run it

```bash
node serve.js
# → http://localhost:8080/showcase.html
```

**Do not use `python3 -m http.server`.** Python's `SimpleHTTPRequestHandler`
has never implemented HTTP Range requests. Without Range the browser reports
`video.seekable` as `[0, 0]`, every scrub seek silently fails, and both rails
sit frozen on frame 0 with no error anywhere. This cost me a debugging round —
`serve.js` exists purely to avoid it.

## The two mockup renders

`showcase.html` looks for `macbook.png` and `macbook-light.png` in the same
folder. They're the reference's own renders, so grab them from
`desktop-showcase.met-ads.com` and drop them in.

Until they're there the stage falls back to a CSS-drawn laptop on the identical
calibration, so nothing breaks — the frame just isn't photoreal.

## Calibration

Lifted verbatim from the reference's `app.css`:

```css
--disp-left: 28.28%;  --disp-top: 23.22%;
--disp-w: 0.4305;     --disp-h: 0.4065;
--screen-w: 1280px;
--mockup-w: calc(1280px / 0.4305);   /* 2973.29px */
```

The stage is `4600 / 3068`, so it renders at 2973.29 × 1982.87 and the iframe
lands on exactly **1280 × 806**. `--mockup-scale` (inline on `.stage`, currently
`0.75`) is a pure visual zoom — the iframe's CSS pixel size never changes, so
the campaign always composes against the same 1280×806 canvas.

## Takeover geometry

Authored against the 1920×1080 comp in `Layout.png`, expressed in `vw` so the
whole thing scales rather than reflows:

| region | comp x | width | vw | @1280 |
|---|---|---|---|---|
| left rail | 0 – 490 | 484 | 25.2083 | 322.7 |
| content column | 518 – 1401 | 884 | 46.0417 | 589.3 |
| right rail | 1418 – 1919 | 484 | 25.2083 | 322.7 |
| masthead | full width | 230 tall | 11.9792 | 153.3 |

The 484px rails match `left.mp4` / `right.mp4` **exactly** — the split is baked
into the video dimensions, so don't reflow the rails independently. If you need
a different composition, rescale the whole stage.

## Scroll model — pin + scrub

The masthead and both rails are `position: fixed`. Only the content column
moves. Its scroll progress maps linearly onto `video.currentTime`:

```
currentTime = (scrollY / (scrollHeight - innerHeight)) * duration
```

Nothing ever *plays* — every frame is a seek, which is what makes scrolling back
up run the animation backwards for free.

The displayed time is eased toward the scroll target inside a `requestAnimationFrame`
loop rather than assigned on the scroll event. Wheel events arrive in coarse
jumps that would look steppy, and the rAF loop also throttles seeks to about one
per frame instead of one per event. Tuning constants are at the top of the
script in `screen.html` (`EASE`, `SNAP`, `SEEK_EPS`).

Verified mapping:

| progress | 0 | 0.25 | 0.50 | 0.75 | 1.0 | ↑ 0.50 | ↑ 0 |
|---|---|---|---|---|---|---|---|
| currentTime | 0 | 2.48 | 4.99 | 7.49 | 9.96 | 5.01 | 0 |

## ⚠️ Re-encode the videos before you ship

`left.mp4` and `right.mp4` carry only **10 keyframes across 300 frames**
(10s @ 30fps). Every seek has to decode forward from the nearest I-frame, so
scrubbing is visibly chunky. Re-encode all-intra:

```bash
ffmpeg -i left.mp4  -c:v libx264 -g 1 -crf 20 -pix_fmt yuv420p -an left_scrub.mp4
ffmpeg -i right.mp4 -c:v libx264 -g 1 -crf 20 -pix_fmt yuv420p -an right_scrub.mp4
```

Files get bigger, but at 484×1080 on a near-white scene it's cheap, and it's the
difference between a smooth scrub and a slideshow. Also consider `-movflags
+faststart` so the moov atom is at the front.

## Open question

`content.png` is 960px wide natively but sits at 884 in `Layout.png`. This build
assumes the comp is imprecise and renders it to fill the 884-wide column. If 960
was intentional, widen `--content-w` to `50vw` and narrow the rails to match.
