import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Loads one asset URL into a scene graph. */
export type AssetFetcher = (url: string) => Promise<THREE.Object3D>;

interface Entry {
  promise: Promise<THREE.Object3D>;
  scene?: THREE.Object3D;
  refs: number;
  lastUsed: number;
}

/**
 * Reference-counted cache of loaded glTF scenes, shared by every avatar on
 * the page (the editor and the home designer can be open together). Each
 * avatar gets its own clone with its own materials; geometry and textures
 * stay shared. Unreferenced scenes are kept for quick swaps and evicted
 * least-recently-used beyond `maxIdle`.
 */
export class AssetCache {
  private entries = new Map<string, Entry>();
  private clock = 0;
  private fetcher: AssetFetcher;
  private maxIdle: number;

  constructor(fetcher: AssetFetcher, maxIdle = 24) {
    this.fetcher = fetcher;
    this.maxIdle = maxIdle;
  }

  /** Resolves a private copy of the asset; pair every call with release(url). */
  async acquire(url: string): Promise<THREE.Object3D> {
    let e = this.entries.get(url);
    if (!e) {
      const entry: Entry = { refs: 0, lastUsed: 0, promise: this.fetcher(url) };
      entry.promise.then((s) => (entry.scene = s), () => this.entries.delete(url));
      this.entries.set(url, entry);
      e = entry;
    }
    e.refs++;
    e.lastUsed = ++this.clock;
    try {
      return instantiate(await e.promise);
    } catch (err) {
      e.refs--;
      throw err;
    }
  }

  release(url: string) {
    const e = this.entries.get(url);
    if (!e || e.refs === 0) return;
    e.refs--;
    e.lastUsed = ++this.clock;
    this.evict();
  }

  refCount(url: string) {
    return this.entries.get(url)?.refs ?? 0;
  }

  get size() {
    return this.entries.size;
  }

  private evict() {
    const idle = [...this.entries].filter(([, e]) => e.refs === 0 && e.scene).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (let i = 0; i < idle.length - this.maxIdle; i++) {
      const [url, e] = idle[i];
      disposeShared(e.scene!);
      this.entries.delete(url);
    }
  }
}

/** A per-avatar copy: skeleton re-bound, materials cloned, geometry shared. */
function instantiate(source: THREE.Object3D): THREE.Object3D {
  const copy = cloneSkinned(source);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    mesh.userData.ownsMaterial = true;
  });
  return copy;
}

/** Disposes a cached scene's geometry, materials and textures. */
function disposeShared(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
      m.dispose();
    }
  });
}

/** Frees what an avatar owns in a copy from AssetCache (its materials). */
export function disposeInstance(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.userData.ownsMaterial) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  });
}

// ─── Default glTF fetcher ───────────────────────────────────────────────────

/** Basis transcoder (public/basis, a copy of three's examples/jsm/libs/basis). */
export const BASIS_TRANSCODER_PATH = '/basis/';

let gltfLoader: Promise<{ loadAsync(url: string): Promise<{ scene: THREE.Group }> }> | null = null;

function getGltfLoader() {
  gltfLoader ??= (async () => {
    const [{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/KTX2Loader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    ]);
    const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH);
    detectCompressedTextureSupport(ktx2);
    return new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  })();
  return gltfLoader;
}

/**
 * KTX2Loader picks a GPU texture format from a renderer's extensions. Avatars
 * load before (and independently of) any one renderer, so probe a throwaway
 * WebGL2 context instead; all of a device's contexts report the same formats.
 */
function detectCompressedTextureSupport(ktx2: { detectSupport(r: unknown): unknown }) {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return;
  const probe = { extensions: { has: (n: string) => gl.getExtension(n) !== null, get: (n: string) => gl.getExtension(n) } };
  ktx2.detectSupport(probe);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
}

export const fetchGltf: AssetFetcher = async (url) => (await (await getGltfLoader()).loadAsync(url)).scene;

/** The page-wide cache used by every avatar. */
export const avatarAssets = new AssetCache(fetchGltf);
