import * as THREE from 'three';

/**
 * Procedural texture library for the 3D home planner.
 * Every texture is generated on a 2D canvas at runtime, so no binary
 * image assets need to be shipped. Each texture represents a fixed
 * real-world tile size (see TEXTURE_TILE_METERS) and is paired with
 * world-space UVs in houseBuilder.ts so patterns keep a true scale.
 */

type Ctx = CanvasRenderingContext2D;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const makeCanvas = (size = 512): [HTMLCanvasElement, Ctx] => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
};

const toTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

const toDataTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

/** Adds monochrome grain so surfaces don't look like flat vector fills. */
const grain = (ctx: Ctx, size: number, amount: number) => {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
};

/** Real-world size (meters) one texture repeat covers. */
export const TEXTURE_TILE_METERS = {
  wood: 2,
  marble: 1.2,
  slate: 1.2,
  carpet: 1,
  paint: 2,
  brick: 1,
  cedar: 1,
  concrete: 2.4,
  grass: 4,
  paving: 2,
  deck: 2,
  roof: 2,
  tile: 1.2,
  asphalt: 4,
  water: 3,
} as const;

export function woodPlanks(h: number, s: number, l: number, rows = 8, gapAlpha = 0.35): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand(0, 220);
    while (x < size) {
      const w = rand(150, 320);
      const ll = l + rand(-6, 6);
      ctx.fillStyle = `hsl(${h + rand(-3, 3)}, ${s}%, ${ll}%)`;
      ctx.fillRect(x, r * rowH, w, rowH);
      for (let g = 0; g < 9; g++) {
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${ll - rand(8, 16)}%, ${rand(0.08, 0.22)})`;
        ctx.lineWidth = rand(0.5, 1.6);
        ctx.beginPath();
        const y0 = r * rowH + rand(2, rowH - 2);
        ctx.moveTo(x, y0);
        for (let k = 1; k <= 6; k++) ctx.lineTo(x + (w * k) / 6, y0 + rand(-2, 2));
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(25,14,6,${gapAlpha})`;
      ctx.fillRect(x, r * rowH, 2, rowH);
      x += w;
    }
    ctx.fillStyle = `rgba(25,14,6,${gapAlpha})`;
    ctx.fillRect(0, r * rowH, size, 2);
  }
  grain(ctx, size, 10);
  return toTexture(c);
}

export function marble(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#ecebe7';
  ctx.fillRect(0, 0, size, size);
  ctx.filter = 'blur(1px)';
  for (let v = 0; v < 16; v++) {
    ctx.strokeStyle = `rgba(110,112,118,${rand(0.08, 0.3)})`;
    ctx.lineWidth = rand(0.6, 2.6);
    ctx.beginPath();
    let x = rand(0, size);
    let y = rand(0, size);
    ctx.moveTo(x, y);
    for (let k = 0; k < 24; k++) {
      x += rand(-10, 30);
      y += rand(-22, 22);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.filter = 'none';
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 256, 0);
    ctx.lineTo(i * 256, size);
    ctx.moveTo(0, i * 256);
    ctx.lineTo(size, i * 256);
    ctx.stroke();
  }
  grain(ctx, size, 5);
  return toTexture(c);
}

export function slate(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  const n = 4;
  const t = size / n;
  ctx.fillStyle = '#15181c';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = `hsl(210, 7%, ${rand(17, 25)}%)`;
      ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }
  grain(ctx, size, 20);
  return toTexture(c);
}

export function carpet(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = 'hsl(30, 10%, 66%)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `hsla(30, 10%, ${rand(52, 78)}%, 0.5)`;
    ctx.fillRect(rand(0, size), rand(0, size), 1.5, 1.5);
  }
  grain(ctx, size, 24);
  return toTexture(c);
}

export function paint(hex: string): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  grain(ctx, size, 6);
  return toTexture(c);
}

export function brick(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#cfc6b8';
  ctx.fillRect(0, 0, size, size);
  const rows = 16;
  const rowH = size / rows;
  const bw = size / 4;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let x = -bw; x < size + bw; x += bw) {
      ctx.fillStyle = `hsl(${rand(6, 18)}, ${rand(40, 58)}%, ${rand(30, 42)}%)`;
      ctx.fillRect(x + off + 3, r * rowH + 3, bw - 6, rowH - 6);
    }
  }
  grain(ctx, size, 22);
  return toTexture(c);
}

export function cedar(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = 'hsl(25, 40%, 12%)';
  ctx.fillRect(0, 0, size, size);
  const slatW = 48;
  for (let x = 0; x < size; x += slatW) {
    const l = rand(36, 46);
    ctx.fillStyle = `hsl(27, 52%, ${l}%)`;
    ctx.fillRect(x + 4, 0, slatW - 8, size);
    for (let g = 0; g < 6; g++) {
      ctx.strokeStyle = `hsla(27, 50%, ${l - 12}%, 0.25)`;
      ctx.lineWidth = rand(0.6, 1.4);
      ctx.beginPath();
      const gx = x + rand(6, slatW - 6);
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + rand(-3, 3), size);
      ctx.stroke();
    }
  }
  grain(ctx, size, 12);
  return toTexture(c);
}

export function concrete(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = 'hsl(210, 4%, 62%)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const r = rand(20, 90);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = Math.random() > 0.5;
    g.addColorStop(0, light ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size / 2 - 2);
  ctx.strokeRect(1, size / 2 + 1, size - 2, size / 2 - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(64 + i * 128, 64 + j * 256, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  grain(ctx, size, 20);
  return toTexture(c);
}

export function grass(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = 'hsl(96, 38%, 33%)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const len = rand(3, 8);
    const a = rand(-0.5, 0.5) - Math.PI / 2;
    ctx.strokeStyle = `hsl(${rand(80, 105)}, ${rand(35, 55)}%, ${rand(24, 46)}%)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  grain(ctx, size, 12);
  return toTexture(c);
}

export function paving(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#8f897e';
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const t = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = `hsl(35, ${rand(6, 14)}%, ${rand(62, 74)}%)`;
      ctx.fillRect(i * t + 4, j * t + 4, t - 8, t - 8);
    }
  }
  grain(ctx, size, 16);
  return toTexture(c);
}

export function roofShingles(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#1d2024';
  ctx.fillRect(0, 0, size, size);
  const rows = 16;
  const rowH = size / rows;
  const w = 64;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (w / 2);
    for (let x = -w; x < size + w; x += w) {
      ctx.fillStyle = `hsl(210, 6%, ${rand(22, 30)}%)`;
      ctx.fillRect(x + off + 1, r * rowH + 1, w - 2, rowH - 3);
    }
  }
  grain(ctx, size, 14);
  return toTexture(c);
}

export function ceramicTile(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#c9c6c0';
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const t = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = `hsl(40, 8%, ${rand(84, 89)}%)`;
      ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }
  grain(ctx, size, 6);
  return toTexture(c);
}

export function asphalt(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#3b3e43';
  ctx.fillRect(0, 0, size, size);
  grain(ctx, size, 30);
  return toTexture(c);
}

export function water(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = 'hsl(192, 70%, 52%)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${rand(0.08, 0.22)})`;
    ctx.lineWidth = rand(1, 2.2);
    ctx.beginPath();
    const x = rand(0, size);
    const y = rand(0, size);
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + rand(-40, 40), y + rand(-40, 40), x + rand(-40, 40), y + rand(-40, 40), x + rand(-50, 50), y + rand(-50, 50));
    ctx.stroke();
  }
  return toTexture(c);
}

/** Vertical sky gradient used as the scene background. */
export function skyGradient(top: string, horizon: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Bump, Normal, and Contact Shadow Generators (Phase 1 Visual Depth)
// ---------------------------------------------------------------------------

export function woodPlanksBump(rows = 8): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  const rowH = size / rows;
  ctx.fillStyle = '#b5b5b5';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < rows; r++) {
    let x = -rand(0, 200);
    while (x < size) {
      const w = rand(150, 320);
      // Plank face with subtle height variation
      ctx.fillStyle = `rgb(${rand(190, 220)}, ${rand(190, 220)}, ${rand(190, 220)})`;
      ctx.fillRect(x + 2, r * rowH + 2, w - 4, rowH - 4);

      // Fine wood grain ridges
      for (let g = 0; g < 7; g++) {
        ctx.strokeStyle = `rgba(130, 130, 130, ${rand(0.12, 0.28)})`;
        ctx.lineWidth = rand(0.8, 1.8);
        ctx.beginPath();
        const y0 = r * rowH + rand(4, rowH - 4);
        ctx.moveTo(x + 2, y0);
        ctx.lineTo(x + w - 2, y0 + rand(-1.5, 1.5));
        ctx.stroke();
      }

      // Recessed bevel groove at the end of each plank
      ctx.fillStyle = '#181818';
      ctx.fillRect(x, r * rowH, 2.5, rowH);
      x += w;
    }
    // Deep horizontal plank seam
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, r * rowH, size, 2.5);
  }
  grain(ctx, size, 8);
  return toDataTexture(c);
}

export function brickBump(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  // Deep recessed mortar channels
  ctx.fillStyle = '#222222';
  ctx.fillRect(0, 0, size, size);

  const rows = 16;
  const rowH = size / rows;
  const bw = size / 4;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let x = -bw; x < size + bw; x += bw) {
      // Raised brick face with chamfered edge
      ctx.fillStyle = `rgb(${rand(210, 235)}, ${rand(210, 235)}, ${rand(210, 235)})`;
      ctx.fillRect(x + off + 3, r * rowH + 3, bw - 6, rowH - 6);
    }
  }
  grain(ctx, size, 32);
  return toDataTexture(c);
}

export function slateBump(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const t = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Cleft stone subtle gradient
      const g = ctx.createLinearGradient(i * t, j * t, (i + 1) * t, (j + 1) * t);
      g.addColorStop(0, `rgb(${rand(180, 200)}, ${rand(180, 200)}, ${rand(180, 200)})`);
      g.addColorStop(1, `rgb(${rand(210, 230)}, ${rand(210, 230)}, ${rand(210, 230)})`);
      ctx.fillStyle = g;
      ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    }
  }
  grain(ctx, size, 22);
  return toDataTexture(c);
}

export function concreteBump(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#b0b0b0';
  ctx.fillRect(0, 0, size, size);

  // Formwork joints
  ctx.strokeStyle = '#353535';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1, 1, size - 2, size / 2 - 2);
  ctx.strokeRect(1, size / 2 + 1, size - 2, size / 2 - 2);

  // Tie rod indentations
  ctx.fillStyle = '#181818';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(64 + i * 128, 64 + j * 256, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  grain(ctx, size, 26);
  return toDataTexture(c);
}

export function pavingBump(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const t = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = `rgb(${rand(195, 225)}, ${rand(195, 225)}, ${rand(195, 225)})`;
      ctx.fillRect(i * t + 4, j * t + 4, t - 8, t - 8);
    }
  }
  grain(ctx, size, 20);
  return toDataTexture(c);
}

export function plasterBump(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  grain(ctx, size, 16);
  return toDataTexture(c);
}

/** Procedural water normal map for wave ripples and specular sun glints. */
export function waterNormal(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;

  // Generate multi-octave sinusoidal wave heights
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const wx = (x / size) * Math.PI * 2;
      const wy = (y / size) * Math.PI * 2;
      h[idx] =
        Math.sin(wx * 4 + wy * 2) * 0.4 +
        Math.sin(wx * 2 - wy * 5) * 0.35 +
        Math.cos(wx * 8 + wy * 6) * 0.25;
    }
  }

  // Derive tangent-space surface normals from height differentials
  for (let y = 0; y < size; y++) {
    const yp = (y + 1) % size;
    const ym = (y - 1 + size) % size;
    for (let x = 0; x < size; x++) {
      const xp = (x + 1) % size;
      const xm = (x - 1 + size) % size;

      const dx = (h[y * size + xp] - h[y * size + xm]) * 1.8;
      const dy = (h[yp * size + x] - h[ym * size + x]) * 1.8;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = dz * invLen;

      const p = (y * size + x) * 4;
      d[p] = Math.round((nx * 0.5 + 0.5) * 255);
      d[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[p + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return toDataTexture(c);
}

/** Soft radial contact shadow texture to eliminate floating furniture. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const [c, ctx] = makeCanvas(size);
  const half = size / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half - 4);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  g.addColorStop(0.35, 'rgba(0, 0, 0, 0.48)');
  g.addColorStop(0.7, 'rgba(0, 0, 0, 0.16)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

