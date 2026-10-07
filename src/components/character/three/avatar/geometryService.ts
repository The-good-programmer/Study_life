import * as THREE from 'three';
import { jobKey, runGeometryJob, type GeometryJob, type JobResult } from './jobs';
import { payloadToGeometry } from './geometry';

export type Resolved = THREE.BufferGeometry | Uint32Array;

interface Entry {
  result?: Resolved;
  listeners: Array<(r: Resolved) => void>;
  refs: number;
  lastUsed: number;
}

/** A small pool of module workers running runGeometryJob off the main thread. */
class WorkerPool {
  private workers: Worker[] = [];
  private nextWorker = 0;
  private nextId = 0;
  private pending = new Map<number, { resolve: (r: JobResult) => void; reject: (e: Error) => void }>();

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./avatarWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; result?: JobResult; error?: string }>) => {
        const job = this.pending.get(e.data.id);
        if (!job) return;
        this.pending.delete(e.data.id);
        if (e.data.result) job.resolve(e.data.result);
        else job.reject(new Error(e.data.error ?? 'Avatar worker failed'));
      };
      this.workers.push(worker);
    }
  }

  run(job: GeometryJob): Promise<JobResult> {
    // Body jobs share a cached body mesh inside the worker, so keep them on one.
    let worker: Worker;
    if (job.kind === 'body' || job.kind === 'bodyCull' || this.workers.length === 1) {
      worker = this.workers[0];
    } else {
      worker = this.workers[1 + (this.nextWorker++ % (this.workers.length - 1))];
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, job });
    });
  }
}

function toResolved(r: JobResult): Resolved {
  if ('indices' in r) return r.indices;
  const geo = payloadToGeometry(r.payload);
  geo.userData.shared = true; // owned by the cache, never disposed by avatars
  return geo;
}

/**
 * Hands out avatar geometry by job, shared and reference-counted across
 * avatars. In browsers the work runs in a worker pool so the UI never
 * blocks; elsewhere (tests, SSR) it runs synchronously.
 */
export class GeometryService {
  private entries = new Map<string, Entry>();
  private clock = 0;
  private pool: WorkerPool | null = null;
  private readonly useWorkers: boolean;
  private readonly idleLimit: number;

  constructor(useWorkers: boolean, idleLimit = 48) {
    this.useWorkers = useWorkers;
    this.idleLimit = idleLimit;
  }

  /** True when results arrive later (worker mode). */
  get isAsync() {
    return this.useWorkers;
  }

  /**
   * Calls onReady with the job's result: immediately if it is cached (or in
   * synchronous mode), otherwise when the worker finishes. Returns a release
   * function: it cancels a pending request, or drops the reference taken when
   * the result was delivered.
   */
  get(job: GeometryJob, onReady: (r: Resolved) => void): () => void {
    const key = jobKey(job);
    let entry = this.entries.get(key);
    let delivered = false;
    let cancelled = false;
    const deliver = (r: Resolved) => {
      if (cancelled) return;
      delivered = true;
      entry!.refs++;
      entry!.lastUsed = ++this.clock;
      onReady(r);
    };
    const release = () => {
      if (cancelled) return;
      cancelled = true;
      if (delivered) {
        entry!.refs--;
        entry!.lastUsed = ++this.clock;
        this.evict();
      } else {
        entry!.listeners = entry!.listeners.filter((l) => l !== deliver);
      }
    };

    if (!entry) {
      entry = { listeners: [], refs: 0, lastUsed: ++this.clock };
      this.entries.set(key, entry);
      if (this.useWorkers) {
        entry.listeners.push(deliver);
        const target = entry;
        this.workerPool()
          .run(job)
          .catch(() => runGeometryJob(job)) // fall back to the main thread
          .then((r) => {
            target.result = toResolved(r);
            const listeners = target.listeners;
            target.listeners = [];
            for (const l of listeners) l(target.result);
          });
        return release;
      }
      entry.result = toResolved(runGeometryJob(job));
    }

    if (entry.result) deliver(entry.result);
    else entry.listeners.push(deliver);
    return release;
  }

  private workerPool(): WorkerPool {
    if (!this.pool) {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
      this.pool = new WorkerPool(Math.max(2, Math.min(4, cores - 1)));
    }
    return this.pool;
  }

  private evict() {
    const idle = [...this.entries.entries()].filter(([, e]) => e.refs === 0 && e.result && e.listeners.length === 0);
    if (idle.length <= this.idleLimit) return;
    idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, e] of idle.slice(0, idle.length - this.idleLimit)) {
      if (e.result instanceof THREE.BufferGeometry) e.result.dispose();
      this.entries.delete(key);
    }
  }
}

const canUseWorkers = typeof Worker !== 'undefined' && typeof window !== 'undefined';

/** Shared by every avatar in the app. */
export const geometryService = new GeometryService(canUseWorkers);
