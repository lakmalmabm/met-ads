/* ---------------------------------------------------------------------------
   Miss Dior bottle — hand-authored materials.

   The executable form of MATERIALS.md section 3. Every number here is read out
   of the live .blend, not out of bottle.glb: the glTF exporter only understands
   a Principled BSDF wired straight into Material Output, and nine of the ten
   bottle materials route through the "Mx White" node group instead. The
   exporter silently substitutes that group's internal Principled — base
   [0.8,0.8,0.8], metallic 0.214, roughness 0.5 — for all nine.

   bottle.glb is exported WITH materials anyway, purely so the per-slot
   primitive split survives and so each primitive carries the right material
   NAME. Every value in it is replaced below, keyed on that name.

   Blender colours are LINEAR scene-referred, hence lin() rather than hex.
   --------------------------------------------------------------------------- */

export const TEXTURE_FILES = {
  houndstooth: 'tex/houndstooth.png',   // Untitled-1-01.png.005, 1754x1241, sRGB
  label:       'tex/dior_label.png',    // dior label-01.png.002,  260x163,   sRGB
  ribbon:      'tex/ribbon_normal.png', // istockphoto-92188107,   612x407,   Non-Color
};

/* Tunables with no Blender counterpart, or whose Blender units do not convert.
   Exposed so they can be driven from the console without editing this file. */
export const TUNING = {
  /* Cycles gets depth-dependent pink for free from volumetric path tracing.
     three needs an explicit attenuation distance. Tuned against
     ref/frame_392.png; the first knob to reach for if the liquid reads too
     pale (raise) or too crimson (lower). */
  liquidAttenuationDistance: 0.42,

  /* Blender's Bump "Strength" is not in world units; these are matched by eye
     against the reference frame. */
  patternBumpScale: 0.004,   // with pattern.002, Blender Bump strength 0.375
  ribbonRibBump:    0.0015,  // RIBBONZ,           Blender Bump strength 0.2
  bandBump:         0.002,   // Material.029,      Blender Bump strength 0.45
  labelWeaveBump:   0.0008,  // Material.021,      Blender Bump strength 0.091667

  /* Voronoi scale 3000 on GENERATED coordinates has no direct UV frequency.
     Matched by eye. */
  labelWeavePitch: 220,

  /* Glass wall thickness. Blender computes this from the actual geometry each
     ray crosses; three needs one number per material. */
  bodyThickness:   0.06,
  capThickness:    0.05,
  liquidThickness: 0.19,
};

/* =========================================================================
   Procedural textures

   Three Blender node chains are procedural, not image-based: the RIBBONZ rib,
   the Material.029 band, and the Material.021 weave. Baking them onto a canvas
   is cheaper and far more controllable than patching three's shader chunks,
   and it keeps this ad free of runtime dependencies.
   ========================================================================= */

function canvasTexture(THREE, canvas, { srgb = false, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  /* glTF UVs have a top-left origin, so anything applied to geometry from a
     .glb must NOT be flipped. Getting this wrong mirrors the 48-degree rib. */
  t.flipY = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/* RIBBONZ: Wave Texture scale 2000 through a Mapping node scaled 0.025 and
   rotated 48 degrees about Z -> 50 sine bands per UV unit at 48 degrees.
   Color Ramp.003 (EASE) then remaps the wave to roughness 0.20208..1.0. */
function makeRibBands(THREE, { bands = 50, angleDeg = 48, size = 1024,
                              lo = 0.20208, hi = 1.0, distortion = 0.17 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const th = (angleDeg * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const p = u * ct - v * st;
      /* Blender's Wave "bands" profile is a sine; Distortion 0.17 with Detail 0
         warps the phase slightly rather than adding octaves. */
      const phase = p * bands * Math.PI * 2 +
                    Math.sin(p * bands * Math.PI * 0.7) * distortion;
      const w = 0.5 + 0.5 * Math.sin(phase);
      /* Color Ramp.003 is EASE, i.e. smoothstep, between its two stops. */
      const e = w * w * (3 - 2 * w);
      const val = Math.round((lo + (hi - lo) * e) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(THREE, c);
}

/* Material.029: Wave scale 2000 through Mapping scaled 0.007 -> 14 bands per UV
   unit, no rotation. Both its ramps are CONSTANT interpolation, which is what
   makes the stripes hard-edged instead of a gradient. */
function makeBandStripes(THREE, { bands = 14, size = 512,
                                  roughA = 0.565085, roughB = 0.166606 } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = 8;
  const ctx = c.getContext('2d');
  for (let x = 0; x < size; x++) {
    const u = x / size;
    const w = 0.5 + 0.5 * Math.sin((u + 0.4) * bands * Math.PI * 2);
    const val = Math.round((w < 0.50909 ? roughA : roughB) * 255);
    ctx.fillStyle = `rgb(${val},${val},${val})`;
    ctx.fillRect(x, 0, 1, 8);
  }
  return canvasTexture(THREE, c);
}

/* Material.021: Voronoi scale 3000, Detail 0, RANDOMNESS 0 on Generated coords,
   rotated 45 degrees about Y. Randomness 0 turns Voronoi into a perfectly
   regular lattice - this is the woven canvas weave on the label, not noise. */
function makeWeave(THREE, { pitch = TUNING.labelWeavePitch, size = 1024 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const k = Math.PI * 2 * pitch, r2 = Math.SQRT1_2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const a = (u + v) * r2, b = (u - v) * r2;          // the 45-degree rotation
      const w = 0.5 + 0.25 * (Math.sin(a * k) + Math.sin(b * k));
      const val = Math.round(w * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(THREE, c);
}

/* Material.021 base colour is Mix(MULTIPLY, factor 0.5) of the ramped label art
   and the weave, i.e. A * (0.5 + 0.5*B). Color Ramp.001 first stretches the art:
   black below 0.28636, ramping to white at 1.0. Baked into one canvas. */
function bakeLabel(THREE, labelImage, { rampLo = 0.28636, weavePitch = TUNING.labelWeavePitch } = {}) {
  const W = labelImage.width * 4, H = labelImage.height * 4;   // upsample; the source is only 260x163
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(labelImage, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const k = Math.PI * 2 * weavePitch, r2 = Math.SQRT1_2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const u = x / W, v = y / H;
      const a = (u + v) * r2, b = (u - v) * r2;
      const weave = 0.5 + 0.25 * (Math.sin(a * k) + Math.sin(b * k));
      const mul = 0.5 + 0.5 * weave;                    // the MULTIPLY at factor 0.5
      for (let ch = 0; ch < 3; ch++) {
        const s = img.data[i + ch] / 255;
        const ramped = Math.min(1, Math.max(0, (s - rampLo) / (1 - rampLo)));
        img.data[i + ch] = Math.round(ramped * mul * 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(THREE, c, { srgb: true });
}

/* with pattern.002 mixes two Glass BSDFs by the houndstooth image: factor 1 is
   the smooth leg (roughness 0), factor 0 the rough leg (0.172222). three's
   roughnessMap MULTIPLIES, so the map has to be inverted relative to Blender's
   mix factor. Built here rather than shipped as a second PNG. */
function invert(THREE, image) {
  const c = document.createElement('canvas');
  c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 255 - img.data[i];
    img.data[i + 1] = 255 - img.data[i + 1];
    img.data[i + 2] = 255 - img.data[i + 2];
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(THREE, c);
}

/* =========================================================================
   Texture loading
   ========================================================================= */

export function loadBottleTextures(THREE, base = '') {
  const loader = new THREE.TextureLoader();
  const load = (url, srgb) => new Promise((res, rej) => {
    loader.load(base + url, (t) => {
      t.flipY = false;                       // glTF UV convention, see canvasTexture()
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      res(t);
    }, undefined, rej);
  });
  return Promise.all([
    load(TEXTURE_FILES.houndstooth, false),  // read as a height/mix factor, not colour
    load(TEXTURE_FILES.label, true),
    load(TEXTURE_FILES.ribbon, false),       // Non-Color in Blender
  ]).then(([houndstooth, label, ribbon]) => {
    const tex = {
      houndstooth,
      houndstoothInverted: invert(THREE, houndstooth.image),
      label,
      labelBaked: bakeLabel(THREE, label.image),
      weave: makeWeave(THREE),
      ribbonNormal: ribbon,
      ribBands: makeRibBands(THREE),
      bandStripes: makeBandStripes(THREE),
    };
    /* Ribbon.001's Mapping node scales UV by 4.56 and "rotates -0.280998 about
       X". A UV arrives as (u, v, 0); rotating about X gives y' = v*cos(theta)
       and pushes the rest into z, which the FLAT projection discards. So it is
       NOT a rotation - it is v scaled by cos(-0.280998) = 0.960779. Setting
       texture.rotation here instead would visibly skew the weave. */
    tex.ribbonNormal.repeat.set(4.56, 4.56 * Math.cos(-0.280998));
    return tex;
  });
}

/* =========================================================================
   The material table
   ========================================================================= */

export function createBottleMaterials(THREE, tex) {
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const T = TUNING;

  return {
    /* ---- glass.004: body + neck ring -------------------------------------
       Glass BSDF, colour 1.808749 (ABOVE 1 - a brightener, not a tint),
       roughness 0, IOR 1.45. Its Bump node has nothing feeding Height, so it
       renders flat; not ported. THREE.Color holds unclamped floats and
       MeshPhysicalMaterial multiplies the transmission sample by material.color,
       so the >1 value does reproduce the brightening. It also scales the
       diffuse and specular terms, which Blender does not - if the rim
       highlights blow out, drop this to 1.0 and raise envMapIntensity instead
       of touching toneMappingExposure, which would hit the whole scene. */
    'glass.004': P({
      color: lin(1.808749, 1.808749, 1.808749),
      metalness: 0, roughness: 0, ior: 1.45,
      transmission: 1, thickness: T.bodyThickness,
      transparent: true, side: THREE.DoubleSide,
    }),

    /* ---- with pattern.002: the embossed houndstooth ----------------------
       Two Glass BSDFs mixed by the houndstooth image. Leg A: colour 1.448172,
       roughness 0.172222, normal from a Bevel node (radius 0.09 - Cycles-only,
       no three equivalent). Leg B: colour (0.850204, 0.901198, 0.969930),
       roughness 0, normal from Bump strength 0.375.
       The Voronoi chain feeding Mix.001 is dead: Mix.001 is a MIX at factor 1,
       so it returns its B input (constant white) and discards the Voronoi
       entirely. The shader factor is therefore just the houndstooth image.
       Collapsed here into one material with the map driving roughness. */
    'with pattern.002': P({
      color: lin(1.448172, 1.448172, 1.448172),
      metalness: 0,
      roughness: 0.172222,
      roughnessMap: tex.houndstoothInverted,
      bumpMap: tex.houndstooth, bumpScale: T.patternBumpScale,
      ior: 1.45, transmission: 1, thickness: T.bodyThickness,
      transparent: true, side: THREE.DoubleSide,
    }),

    /* ---- glass.005: the cap ----------------------------------------------
       IOR 2.06 is nowhere near real glass. It is an art choice: a high IOR
       bends light hard and hardens the cap's edge into a bright rim. three
       clamps ior to [1.0, 2.333], so 2.06 goes in verbatim. */
    'glass.005': P({
      color: lin(1.0, 0.904090, 0.916651),
      metalness: 0, roughness: 0, ior: 2.06,
      transmission: 1, thickness: T.capThickness,
      transparent: true, side: THREE.DoubleSide,
    }),

    /* ---- Water 02.002: the perfume ---------------------------------------
       Nearly all of the bottle's pink is this liquid, not the glass.
       Resolved out of the Water.002 asset group: base colour is
       Water Color (1, 0.044599, 0.290686) x Glowing Level 1.1. Every other
       stage of its Color Variation chain (contrast, gamma, HSV, unpaint,
       invert, dark/bright spots) evaluates to identity with the inputs this
       material sets. Roughness resolves to 0 through Micro Roughness.

       specularColor carries BOTH of Blender's pink reflection terms: the
       Principled's Specular Tint (1.05, 0.52453, 0.659878) and the Reflection
       group's Fresnel-mixed Glossy BSDF (0.822925, 0.082279, 0.215845) at its
       0.25 factor, combined at that ratio -> (0.993231, 0.413967, 0.548869).

       Dropped: a 12.5% hue jitter from a 3D noise, and a real displacement
       ripple at scale 0.15 that 2,240 triangles could not carry anyway. */
    'Water 02.002': P({
      color: lin(1.1, 0.049059, 0.319755),
      metalness: 0, roughness: 0, ior: 1.45,
      transmission: 1, thickness: T.liquidThickness,
      attenuationColor: lin(1.0, 0.044599, 0.290686),
      attenuationDistance: T.liquidAttenuationDistance,
      specularIntensity: 1,
      specularColor: lin(0.993231, 0.413967, 0.548869),
      emissive: lin(1.1, 0.049059, 0.319755), emissiveIntensity: 0.01,
      transparent: true, side: THREE.DoubleSide,
    }),

    /* ---- Material.020: chrome collar + spray cap -------------------------
       A plain Principled BSDF, 1:1 mappable. This is the material where the
       exporter's damage is easiest to miss - its base colour survives by
       coincidence, since the Mx White fallback is also 0.8 grey, so it looks
       nearly right while being metallic 0.214 instead of 1.0. */
    'Material.020': P({
      color: lin(0.8, 0.8, 0.8),
      metalness: 1.0, roughness: 0.1, ior: 1.45,
    }),

    /* ---- Material.021: the label ----------------------------------------
       The ONE material wired straight into a Principled BSDF, and the one that
       exports correctly - the control case that proves the Mx White diagnosis.
       Base colour is the label art through a 0.28636->1.0 contrast ramp,
       multiplied at factor 0.5 by a regular Voronoi lattice (Randomness 0,
       45 degrees) - the woven canvas weave. Both baked into labelBaked. */
    'Material.021': P({
      map: tex.labelBaked,
      metalness: 0.622727, roughness: 0.396393, ior: 1.45,
      bumpMap: tex.weave, bumpScale: T.labelWeaveBump,
    }),

    /* ---- Ribbon.001: bow inner band + neck ring -------------------------- */
    'Ribbon.001': P({
      color: lin(0.001758, 0.001758, 0.001758),
      metalness: 0.290909, roughness: 0.913182, ior: 1.45,
      normalMap: tex.ribbonNormal,
      normalScale: new THREE.Vector2(0.74, 0.74),
    }),

    /* ---- RIBBONZ: the black satin bow ------------------------------------
       Wave Texture scale 2000 through a Mapping node scaled 0.025 and rotated
       48 degrees -> 50 diagonal ribs per UV unit, baked into ribBands with
       Color Ramp.003's EASE remap (0.20208..1.0) already applied.
       Blender's Specular IOR Level is 0.1375 against a 0.5 default; three's
       specularIntensity is normalised so 1.0 == Blender 0.5, hence 0.275.
       That weak specular is what keeps the satin from reading plasticky.
       Not ported, because nothing reads them: Carpet_2_height.png and
       Carpet_2_normal.png, both 4096x4096, both dead ends in this graph. */
    'RIBBONZ': P({
      color: lin(0.010998, 0.009164, 0.009164),
      metalness: 0, roughness: 1.0,
      roughnessMap: tex.ribBands,
      bumpMap: tex.ribBands, bumpScale: T.ribbonRibBump,
      specularIntensity: 0.275, ior: 1.45,
    }),

    /* ---- Material.026: bow underside ------------------------------------- */
    'Material.026': P({
      color: lin(0.008343, 0.008343, 0.008343),
      metalness: 0, roughness: 0.666667, ior: 1.5,
    }),

    /* ---- Material.029: ribbed black band under the cap -------------------
       Wave scale 2000 through Mapping scaled 0.007 -> 14 stripes per UV unit.
       Both its ramps use CONSTANT interpolation, which is what makes the
       stripes hard-edged: a matte band (0.0200 grey, roughness 0.565) next to a
       glossy one (black, roughness 0.167). */
    'Material.029': P({
      color: lin(0.010007, 0.010007, 0.010007),
      metalness: 0, roughness: 1.0,
      roughnessMap: tex.bandStripes,
      bumpMap: tex.bandStripes, bumpScale: T.bandBump,
      ior: 1.45,
    }),
  };
}

/* =========================================================================
   Application
   ========================================================================= */

export function applyBottleMaterials(root, materials) {
  /* Carry the Blender name onto the override so __bottle.only() and any
     later debugging can still identify a surface by it. */
  for (const [name, m] of Object.entries(materials)) m.name = name;

  const applied = {}, missed = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      const spec = materials[m?.name];
      if (!spec) { if (m?.name) missed.push(m.name); return m; }
      applied[m.name] = (applied[m.name] || 0) + 1;
      return spec;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
    /* RectAreaLight cannot cast shadows in three, and this bottle-only export
       carries no baked contact shadow, so neither flag does anything here. */
    o.castShadow = o.receiveShadow = false;
  });
  return { applied, missed: [...new Set(missed)] };
}
