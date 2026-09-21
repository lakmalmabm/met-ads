# Miss Dior bottle — complete material reference

Everything below is read live out of
`~/Downloads/Miss Dior_Mobile_Mobile Takeover/Miss Dior_Mobile_Mobile Takeover_3.blend`
(Blender 5.2 LTS, Cycles) via the Blender MCP bridge. Nothing here is inferred
from the exported `.glb` — the exporter mangles nine of the ten bottle
materials, so the `.blend` node graph is the only source of truth.

Re-read it rather than trusting this file if the artist has touched the scene.

---

## 0. Scene settings the materials are authored against

| setting | value |
|---|---|
| engine | Cycles |
| resolution | 1080 × 1920 @ 100% |
| samples | 600 |
| max bounces / transmission / transparent / glossy | 12 / 12 / 8 / 4 |
| caustics reflective + refractive | **both on** |
| blur glossy | 1.0 |
| **view transform** | **Filmic** |
| **look** | **Medium High Contrast** |
| exposure / gamma | 0 / 1 |
| display device | sRGB |
| world | `EasyHDR` → `studio_small_08_2k`, Mapping rotates Z by 16.8° |
| film transparent | no |

Two consequences for three.js:

1. **Every colour value in this document is linear scene-referred.** Write them
   with `new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)`. A hex
   literal will be wrong — it goes through an sRGB decode you do not want.
2. The reference frames were tone-mapped with **Filmic + Medium High Contrast**,
   not AgX and not ACES. `ACESFilmicToneMapping` is the closest three.js
   built-in; it rolls highlights off harder than Filmic does, which matters
   because this creative is deliberately high-key.

---

## 1. The `Mx White` wrapper — a no-op that eats the exporter

Nine of the ten bottle materials route their BSDF through a node group called
**`Mx White`** before `Material Output`. Inside it:

```
Group Input.Shader ─┐
                    ├─ Mix Shader (Factor = 0) ─→ Group Output
   Principled BSDF ─┘   base 0.8 grey · metallic 0.213636 · roughness 0.5 · IOR 1.5
```

**Factor is 0, so the mix passes input A through at 100% and the internal
Principled contributes literally nothing.** At render time `Mx White` is an
identity function. It is dead weight the artist left in the file.

It is not harmless, though. The glTF exporter only understands a Principled BSDF
wired *straight* into Material Output. It sees a Group, gives up silently, and
writes a default of **base `[0.8, 0.8, 0.8]`, metallic `0.214`, roughness `0.5`** —
which are, exactly, the numbers on the Principled node *inside* `Mx White`.
That match is the proof of where the mangling comes from.

**Every bottle material except `Material.021` is affected.** `Material.021` is the
one wired directly to a Principled BSDF, and the one that exports correctly. It
is the control case.

`bottle.glb` in this folder is therefore exported with `export_materials='EXPORT'`
purely to preserve the **per-slot primitive split and the material names**; every
value in it is garbage and is replaced at load time by the table in
`materials.js`.

---

## 2. Object → material map

The bottle is the Blender collection `Product`, 11 meshes under an empty
`YSL_LIBRE_SMALL_NULL.002` (rot X 90°, uniform scale **−1.738855** — note the
negative, the whole product is mirrored).

| object | material(s) | tris (source → shipped) | UVs |
|---|---|---|---|
| ` base glass.002` *(leading space in the name)* | slot 0 `glass.004`, slot 1 `with pattern.002` | 388,608 → 19,430 · 486,912 → 146,072 | UVMap, automap |
| `cap.002` | `glass.005` | 23,808 → 4,760 | UVMap |
| `inner part.002` | `Water 02.002` | 2,240 → 2,240 *(kept whole)* | UVMap, automap |
| `label.002` | `Material.021` | 29,696 → 8,908 | UVMap, automap |
| `neck.003` | `Material.020` | 16,384 → 2,456 | UVMap |
| `neck.005` | `glass.004` | 9,472 → 1,204 | UVMap |
| `neck round.002` | `Ribbon.001` | 256 → 88 | UVMap |
| `spray cap.002` | `Material.020` | 37,590 → 5,638 | UVMap, automap |
| `arrayed.002` | `Ribbon.001` | 17,672 → 6,184 | UVMap |
| `Plane.013` | slot 0 `RIBBONZ`, slot 1 `Material.026` | 72,896 → 16,037 · 2,736 → 1,368 | UVMap |
| `Plane.014` | slot 0 `RIBBONZ`, slot 1 `Material.029` | 384 → 84 · 284 → 284 | UVMap |

**Total 1,088,938 → 214,753 tris; 37.8 MB → 1.9 MB** after meshopt compression.

World bounds (Blender Z-up): `(-0.3046, -0.3628, -0.2689)` to
`(0.3260, 0.1026, 0.3768)`, size `0.631 × 0.465 × 0.646`.

`label.002` carries a **Subdivision** modifier; it is the only modifier in the
collection and is applied on export.

---

## 3. Materials

### 3.1 `glass.004` — main body glass + neck ring

`base glass.002` slot 0, `neck.005`

```
Bump ──(Normal)──→ Glass BSDF ──→ Mx White ──→ Output
                   MULTI_GGX
```

| socket | value |
|---|---|
| Color | **(1.808749, 1.808749, 1.808749)** |
| Roughness | 0 |
| IOR | 1.45 |
| Normal | ← Bump (**Height unconnected, constant 1.0 → a flat no-op**) |

The colour is **above 1.0**. That is not a tint, it is a brightener: the Glass
BSDF multiplies transmitted radiance by 1.809, which the artist used to claw back
the light lost across several stacked layers of glass. Physically nonsense,
visually load-bearing.

**three.js**

```js
{ transmission: 1, ior: 1.45, roughness: 0, metalness: 0,
  thickness: 0.06, color: lin(1.809, 1.809, 1.809) }
```

`THREE.Color` stores unclamped floats and `MeshPhysicalMaterial` multiplies the
transmission sample by `material.color`, so a >1 colour **does** reproduce the
brightener. It also multiplies the diffuse and specular terms, which is not what
Blender does — if the rim highlights blow out, pull the colour to 1.0 and raise
`envMapIntensity` on this material instead. Do **not** compensate with
`toneMappingExposure`; that hits the whole scene.

The Bump node is wired but has nothing feeding Height. It renders as a flat
normal. Do not port it.

---

### 3.2 `with pattern.002` — the embossed houndstooth

`base glass.002` slot 1 — the single heaviest primitive in the bottle.

**The houndstooth is real geometry, not a normal map.** 486,912 triangles of
sculpted relief. That is why this primitive is decimated to 30% while the smooth
body next to it goes to 5%.

```
Image Texture ─┬─→ Mix (MULTIPLY, Fac 1) ─┬─→ Mix Shader.Factor
(houndstooth)  │        ↑ B = Mix.001     └─→ Bump.Normal
               └─→ Bump.Height

Bevel(r 0.09) ──→ Glass BSDF     ─────→ Mix Shader.A ─→ Mx White ─→ Output
Bump(0.375)  ──→ Glass BSDF.001  ─────→ Mix Shader.B
```

| leg | value |
|---|---|
| Glass A `Glass BSDF` | Color **1.448172** (again >1), Roughness **0.172222**, IOR 1.45, Normal ← **Bevel radius 0.09** |
| Glass B `Glass BSDF.001` | Color **(0.850204, 0.901198, 0.969930)**, Roughness 0, IOR 1.45, Normal ← Bump strength **0.375** |
| Mix factor | the houndstooth image, greyscale |

**How Glass B's colour was derived.** `Color Ramp` (LINEAR, `0 →
(0.753069, 0.760491, 0.999928)`, `1 → (0.753069, 0.955932, 0.999928)`) has its
**Factor input unconnected at 0.5**, so it evaluates to the constant midpoint
`(0.753069, 0.858212, 0.999928)`. That goes through Hue/Saturation/Value with
Hue 0.5 (no shift), **Saturation 0.5**, **Value 0.97**, Fac 1 → halve the
saturation, scale value by 0.97 → **(0.850204, 0.901198, 0.969930)**, a barely
cool near-white.

**Two dead branches worth deleting from the .blend.** `Mix.001` is a MIX at
**factor 1**, so it returns its B input — a constant white — and discards A
entirely. A is the whole Voronoi chain (`Texture Coordinate → Mapping → Voronoi
Texture` scale 46.6, detail 0.93 → `Color Ramp.001`). Four nodes that compute a
value nothing ever reads. The outer `Mix` then multiplies the houndstooth by that
white, so **the shader factor is just the houndstooth image**.

**three.js.** three has no shader-graph mix, so the two glass legs collapse into
one material with the houndstooth driving roughness instead of a shader blend:

```js
{ transmission: 1, ior: 1.45, metalness: 0,
  roughness: 0.172222,              // Glass A; the map pulls it toward Glass B's 0
  roughnessMap: houndstoothInverted, // white areas → smooth, matching Glass B
  bumpMap: houndstooth, bumpScale: 0.004,   // Blender Bump strength 0.375
  color: lin(1.448, 1.448, 1.448), thickness: 0.06 }
```

`roughnessMap` multiplies, so the map must be **inverted** relative to the
Blender factor (factor 1 = Glass B = smooth). `materials.js` builds the inverted
copy on a canvas at load rather than shipping a second PNG.

**The Bevel node has no three.js equivalent.** It rounds the facet edges at shade
time — a Cycles-only trick. The decimation softens those edges slightly, which
happens to work in the same direction, but expect the relief to read a touch
sharper in the browser.

---

### 3.3 `glass.005` — the cap

`cap.002`

| socket | value |
|---|---|
| Color | **(1.0, 0.904090, 0.916651)** |
| Roughness | 0 |
| **IOR** | **2.06** |

IOR 2.06 is nowhere near real glass (1.45–1.55). It is an art choice: a high IOR
bends light hard and hardens the cap's edge into a bright, sharply-defined rim.
**three clamps `MeshPhysicalMaterial.ior` to [1.0, 2.333], so 2.06 goes in
verbatim** — unlike the glass panel elsewhere in this project, which needed the
Fresnel-matching trick because its IOR was 0.84.

The colour pulls green and blue down ~9%, a faint warm pink. Bump is a no-op
again (Height unconnected).

```js
{ transmission: 1, ior: 2.06, roughness: 0, metalness: 0,
  thickness: 0.05, color: lin(1.0, 0.90409, 0.916651) }
```

---

### 3.4 `Water 02.002` — the perfume, and where the pink comes from

`inner part.002` — only 2,240 triangles, and the most important material on the
bottle. **Nearly all of the bottle's colour is this liquid, not the glass.**

It is an asset node group (`Water.002`) wrapping a Principled BSDF, itself wrapped
in `Mx White`. Group inputs as set on the material:

| input | value | | input | value |
|---|---|---|---|---|
| Water Color | **(1.0, 0.044599, 0.290686)** | | Reflection Color | **(0.822925, 0.082279, 0.215845)** |
| Glowing Level | **1.1** | | Reflection Factor | **0.25** |
| Color Variation Scale | 7.200869 | | IOR | **1.45** |
| Color Variation Distortion | 1.254808 | | Roughness | **0** |
| Random Color Var | 0.831818 | | Waves Displacement | 0.15 |
| Emission Strength | 1 | | Gamma / Saturation / Hue-Sat-Value | 1 / 1 / 1 |
| Contrast, Brightness, Unpaint, Color Inverter, Dark & Bright Spot Intensity | all **0** | | Dark/Bright Threshold | 2.5 |

**Resolving the `Color Variation Ver. 3` group.** Traced node by node with those
inputs, almost all of it collapses:

| stage | result |
|---|---|
| Rainbow Saturation — Mix **HUE**, factor = `Random Color Var` remapped 0..1 → 0..0.15 = **0.1248** | **live**: a 12.5% hue nudge toward a 3D noise (scale 0.72, detail 16, distortion 1.255) |
| Dark Spots — Mix SUBTRACT, B = `Dark Spot Intensity` remapped to 0 | identity (subtracting black) |
| Hue Saturation Value — Sat and Val both = `Bright Spot Intensity` remapped 0..1 → 1..2 = **1.0** | identity |
| Bright/Contrast — both 0 | identity |
| Gamma — 1 | identity |
| Hue Saturation Value.001 — Hue 0.5, Sat 1, Val 1, Fac 1 | identity |
| **Glowing Level** — Mix MULTIPLY at factor 1 against the constant **1.1** | **live: ×1.1** |
| Unpaint — Mix at factor 0 | identity |
| Unpaint.001 — Mix DIFFERENCE at factor 0 | identity |

So the base colour is **Water Color × 1.1 = (1.1, 0.049059, 0.319755)**, with a
subtle spatially-varying hue jitter on top. The `COLOR VARIATION`,
`COLOR ADJUSTMENTS` and `BRIGHTNESS` sockets are inert section headers — nothing
inside the group reads them.

**Resolving `Micro Roughness`.** Both legs of its internal mix are
`Roughness × something`, and Roughness is 0, so the output is **0** regardless of
the Fresnel blend. Roughness is 0.

**The resolved Principled BSDF:**

| socket | value |
|---|---|
| Base Color | **(1.1, 0.049059, 0.319755)** ← the pink |
| Metallic | 0 |
| Roughness | 0 |
| IOR | 1.45 |
| **Transmission Weight** | **1.0** |
| Specular Tint | Mix(white, base, 0.5) = **(1.05, 0.524530, 0.659878)** |
| Emission Color | = base colour |
| Emission Strength | `1 × 0.01` = **0.01** |
| Normal | ← Bump strength 0.2, height = Noise 4D (scale 3.9, detail 2, roughness 0.567, W 0.005) |
| Subsurface Weight | 0 (so Subsurface IOR 1.01 never applies) |

**Then the `Reflection` group** wraps it: a Mix Shader between that Principled and
a **Glossy/Anisotropic BSDF** — colour `(0.822925, 0.082279, 0.215845)`, roughness
`(0²)^0.5 = 0` — blended by a custom Fresnel group driven by `Reflection Factor`
0.25. In other words, a mirror-sharp magenta Fresnel sheen over the liquid.

And `Displacement` runs to Material Output with `displacement_method = BOTH`, so
in Cycles the liquid surface is genuinely rippled at scale 0.15.

**three.js**

```js
{ transmission: 1, ior: 1.45, roughness: 0, metalness: 0,
  color: lin(1.1, 0.049059, 0.319755),
  attenuationColor: lin(1.0, 0.0446, 0.290686), attenuationDistance: 0.42,
  specularIntensity: 1,
  specularColor: lin(0.993231, 0.413967, 0.548869),
  emissive: lin(1.1, 0.049059, 0.319755), emissiveIntensity: 0.01,
  thickness: 0.19 }
```

Three approximations, all deliberate:

- **`specularColor` absorbs both pink reflection terms.** Blender has two: the
  Principled's Specular Tint `(1.05, 0.525, 0.660)` and the Reflection group's
  coloured Fresnel glossy `(0.823, 0.082, 0.216)` at 25%. three has one slot, so
  they are combined at that ratio:
  `0.75 × specTint + 0.25 × reflectionColor = (0.993231, 0.413967, 0.548869)`.
- **The 12.5% noise hue jitter is dropped.** Reproducing it needs a 3D noise in a
  custom shader; the payoff at ad size is close to nil.
- **The displacement ripple is dropped.** 2,240 triangles cannot carry it and the
  liquid surface is barely visible behind the houndstooth relief anyway.

`attenuationDistance` is the one number here with no Blender counterpart — Cycles
gets its depth-dependent pink for free from volumetric path tracing. 0.42 is
tuned against `ref/frame_392.png`; it is the first knob to reach for if the
liquid reads too pale or too crimson.

---

### 3.5 `Material.020` — chrome collar and spray cap

`neck.003`, `spray cap.002`

A plain Principled BSDF, everything default except:

| socket | value |
|---|---|
| Base Color | (0.8, 0.8, 0.8) |
| **Metallic** | **1.0** |
| **Roughness** | **0.1** |
| IOR | 1.45 |

Polished chrome, 1:1 mappable.

```js
{ metalness: 1, roughness: 0.1, color: lin(0.8, 0.8, 0.8) }
```

This is the material where the exporter's damage is easiest to miss — its base
colour survives by coincidence (the `Mx White` fallback is also 0.8 grey), so it
looks nearly right while being metallic 0.214 instead of 1.0.

---

### 3.6 `Material.021` — the label *(the only correct export)*

`label.002`

```
Image Texture ─→ Color Ramp.001 ─┐
(dior label-01)                  ├─→ Mix (MULTIPLY, Fac 0.5) ─→ Base Color
Voronoi ─→ Color Ramp ───────────┘
        └──→ Bump (0.091667) ────────────────────────────────→ Normal
```

| socket | value |
|---|---|
| Metallic | **0.622727** |
| Roughness | **0.396393** |
| IOR | 1.45 |
| Base Color | Mix MULTIPLY, factor **0.5** |
| Normal | Bump strength **0.091667** |

- `Color Ramp.001` — LINEAR, black at **pos 0.28636**, white at pos 1.0. A
  contrast stretch on the label art: anything below 0.286 crushes to black.
- `Voronoi Texture` — Scale **3000**, Detail 0, **Randomness 0**, on Generated
  coordinates through a Mapping node with **rotation Y = 0.785398 rad (45°)**.
  Randomness 0 turns Voronoi into a perfectly regular lattice — this is the fine
  **woven canvas weave** visible across the label in the render, not noise.
- The MULTIPLY at factor 0.5 evaluates to `A × (0.5 + 0.5·B)`, so the weave can
  darken the label by at most 50%.

Texture: `dior label-01.png`, 260 × 163, sRGB, packed in the .blend — extracted
to `tex/dior_label.png`.

**three.js.** `materials.js` bakes the 0.286→1.0 ramp *and* the 45° weave into a
single canvas at load, then uses the same weave as a bump map:

```js
{ map: labelBaked, metalness: 0.622727, roughness: 0.396393,
  bumpMap: weave, bumpScale: 0.0008 }
```

The weave pitch is exposed as a tunable — Blender's scale 3000 on *Generated*
coordinates does not convert to a UV frequency directly, so it is matched by eye
against the reference frame.

---

### 3.7 `Ribbon.001` — bow inner band and neck ring

`arrayed.002`, `neck round.002`

| socket | value |
|---|---|
| Base Color | **(0.001758, 0.001758, 0.001758)** — near black |
| Metallic | **0.290909** |
| Roughness | **0.913182** |
| IOR | 1.45 |
| Normal | Normal Map, TANGENT space, strength **0.74** |

Normal texture: `istockphoto-92188107-612x612.jpg`, 612 × 407, colour space
**Non-Color**, packed → extracted to `tex/ribbon_normal.png`. Fed through a
Mapping node: **scale 4.56 uniform, rotation X −0.280998 rad**.

**The rotation is not what it looks like.** Blender's Mapping node rotates the
full 3-vector, and a UV arrives as `(u, v, 0)`. Rotating about **X** gives
`y' = v·cos θ`, `z' = v·sin θ` — and the Image Texture node's FLAT projection
reads only x and y. So the net effect is not a rotation at all: it is
**`v` scaled by cos(-0.280998) = 0.960779**. In three:

```js
{ color: lin(0.001758, 0.001758, 0.001758),
  metalness: 0.290909, roughness: 0.913182,
  normalMap: ribbonNormal,           // repeat (4.56, 4.38115), NO rotation
  normalScale: new THREE.Vector2(0.74, 0.74) }
```

Setting `texture.rotation = -0.280998` instead would visibly skew the weave.

---

### 3.8 `RIBBONZ` — the black satin bow

`Plane.013` slot 0 (the big bow), `Plane.014` slot 0

| socket | value |
|---|---|
| Base Color | **(0.010998, 0.009164, 0.009164)** — near black, faintly warm |
| Metallic | 0 |
| **Specular IOR Level** | **0.1375** |
| IOR | 1.45 |
| Roughness | ← `Color Ramp.003`, **EASE**, `0.19545 → 0.20208`, `0.49545 → 1.0` |
| Normal | ← Bump strength **0.2**, height ← `Color Ramp.002`, EASE, 0 → 0, 1 → 1 |

Both ramps read the same **Wave Texture**: Scale **2000**, Distortion **0.17**,
Detail 0 — on UV through a Mapping node with **rotation Z 0.837758 rad (48°)** and
**scale ← a Value node = 0.025** uniform.

Net: `0.025 × 2000` = **50 bands per UV unit, running at 48°**. That is the fine
diagonal rib you can see catching light across the bow in `ref/frame_392.png`.

Specular IOR Level 0.1375 (against Blender's 0.5 default, which corresponds to
IOR 1.5) is a *much* weaker specular than a default dielectric — reflectance
drops from 0.04 to about 0.011. It is what keeps the black satin from reading
plasticky.

**Three dead nodes and two 4K textures.** `Carpet_2_height.png` (4096²) runs to
`Color Ramp.001` → `Hue/Saturation/Value` → **nothing**; `Carpet_2_normal.png`
(4096²) connects to **nothing**; the first `Color Ramp` (CONSTANT) also outputs
to **nothing**. 33 MB of PNG in the .blend that never reaches a render. Do not
export them.

**three.js.** The rib is generated as a tiling canvas (sine bands at 48°) and used
as both roughness map and bump map — cheaper and more controllable than a wave
texture in a shader patch:

```js
{ color: lin(0.010998, 0.009164, 0.009164), metalness: 0,
  roughness: 1.0, roughnessMap: ribBands,   // ramp 0.202 → 1.0 baked into the canvas
  bumpMap: ribBands, bumpScale: 0.0015,
  specularIntensity: 0.275 }                // 0.1375 / 0.5, three's default being 1.0
```

`specularIntensity` in three is normalised so that 1.0 == Blender's 0.5; hence the
doubling.

---

### 3.9 `Material.026` — bow underside

`Plane.013` slot 1. A bare Principled BSDF, no maps, no groups other than
`Mx White`.

| socket | value |
|---|---|
| Base Color | **(0.008343, 0.008343, 0.008343)** |
| Metallic | 0 |
| Roughness | **0.666667** |
| IOR | **1.5** |

```js
{ color: lin(0.008343, 0.008343, 0.008343), metalness: 0, roughness: 0.666667, ior: 1.5 }
```

---

### 3.10 `Material.029` — the ribbed black band under the cap

`Plane.014` slot 1. Only 284 triangles, kept at full resolution.

| socket | source |
|---|---|
| Base Color | ← `Color Ramp` **CONSTANT**: pos 0 → **(0.020015)**, pos 0.50455 → **(0.0)** |
| Roughness | ← `Color Ramp.002` **CONSTANT**: pos 0 → **0.565085**, pos 0.50909 → **0.166606** |
| Normal | ← Bump strength **0.45** |
| Metallic / IOR | 0 / 1.45 |

All three read one **Wave Texture**: Scale **2000**, Distortion 0, Detail 0, on UV
through Mapping with **location (0.4, 0, 0)** and **scale ← Value = 0.007**.

Net: `0.007 × 2000` = **14 hard-edged stripes per UV unit**, no rotation.
CONSTANT ramp interpolation is what makes them hard-edged rather than a gradient:
the band alternates between *(0.0200 grey, roughness 0.565)* and *(black,
roughness 0.167)* — a matte stripe next to a glossy one.

```js
{ color: lin(0.010007, 0.010007, 0.010007),   // mean of the two ramp stops
  metalness: 0, roughness: 1.0,
  roughnessMap: bandStripes, bumpMap: bandStripes, bumpScale: 0.002 }
```

---

## 4. Summary table

| material | base colour (linear) | metal | rough | IOR | transmission | maps |
|---|---|---|---|---|---|---|
| `glass.004` | 1.8087 · 1.8087 · 1.8087 | 0 | 0 | 1.45 | ✔ | — |
| `with pattern.002` | 1.4482 (A) / 0.850 · 0.901 · 0.970 (B) | 0 | 0.1722 → 0 | 1.45 | ✔ | houndstooth → rough + bump |
| `glass.005` | 1.0 · 0.9041 · 0.9167 | 0 | 0 | **2.06** | ✔ | — |
| `Water 02.002` | **1.1 · 0.0491 · 0.3198** | 0 | 0 | 1.45 | ✔ | — |
| `Material.020` | 0.8 · 0.8 · 0.8 | **1.0** | 0.1 | 1.45 | — | — |
| `Material.021` | label art × weave | 0.6227 | 0.3964 | 1.45 | — | `dior_label.png`, weave bump |
| `Ribbon.001` | 0.0018 · 0.0018 · 0.0018 | 0.2909 | 0.9132 | 1.45 | — | `ribbon_normal.png` @ 0.74 |
| `RIBBONZ` | 0.0110 · 0.0092 · 0.0092 | 0 | 0.202 → 1.0 | 1.45 | — | 48° rib, 50/UV |
| `Material.026` | 0.0083 · 0.0083 · 0.0083 | 0 | 0.6667 | 1.5 | — | — |
| `Material.029` | 0.0200 / 0.0 striped | 0 | 0.565 / 0.167 | 1.45 | — | 14 stripes/UV |

---

## 5. Textures

Extracted from the packed .blend with the copy-datablock → save → remove trick,
so the .blend is never marked dirty. All original paths are dead `D:/` Windows
paths.

| file | source datablock | size | colour space | used by |
|---|---|---|---|---|
| `tex/houndstooth.png` | `Untitled-1-01.png.005` | 1754 × 1241 | sRGB | `with pattern.002` |
| `tex/dior_label.png` | `dior label-01.png.002` | 260 × 163 | sRGB | `Material.021` |
| `tex/ribbon_normal.png` | `istockphoto-92188107-612x612.jpg.001` | 612 × 407 | **Non-Color** | `Ribbon.001` |

Not extracted, because nothing reads them: `Carpet_2_height.png` and
`Carpet_2_normal.png`, both 4096 × 4096, both dead ends in `RIBBONZ`.

---

## 6. What cannot be carried across

| Blender feature | where | status in three.js |
|---|---|---|
| Glass BSDF colour > 1.0 | `glass.004` 1.809, `with pattern.002` 1.448 | reproduced by an unclamped `THREE.Color`, but it also scales diffuse/specular |
| Bevel node, radius 0.09 | `with pattern.002` | **no equivalent** — shading-time edge rounding is Cycles-only |
| Fresnel-mixed coloured Glossy layer | `Water 02.002` Reflection group | folded into `specularColor` at the 0.25 mix ratio |
| 12.5% hue jitter from 3D noise | `Water 02.002` | dropped |
| True displacement, scale 0.15 | `Water 02.002` | dropped — 2,240 tris cannot carry it |
| Volumetric depth-dependent absorption | all glass | approximated with `attenuationColor` / `attenuationDistance` |
| Caustics (both kinds on) | scene-wide | **no equivalent** — the bright pink pool the bottle casts has to be faked or baked |
| Filmic + Medium High Contrast | view transform | `ACESFilmicToneMapping`, which rolls off harder |

And the standing three.js limitation from the rest of this project:
**transmissive objects do not appear in each other's transmission buffer.** The
liquid, the body glass and the cap are all transmissive, so they will not refract
*each other* — the liquid reads through the body glass as if the glass were
absent. On this bottle that is mostly invisible, because the liquid fills the
body almost exactly. It stops being invisible if you ever separate them.

---

*Generated 2026-08-28 from the live .blend. `materials.js` in this folder is the
executable form of section 3; keep the two in step.*
