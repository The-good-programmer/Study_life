/**
 * Web Worker that sculpts and meshes avatar geometry off the main thread.
 * Results are posted back with their ArrayBuffers transferred (no copies).
 */
import { runGeometryJob, type GeometryJob } from './jobs';
import { payloadTransferables } from './geometry';

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ id: number; job: GeometryJob }>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const result = runGeometryJob(job);
    const transfer = 'payload' in result ? payloadTransferables(result.payload) : [result.indices.buffer as ArrayBuffer];
    scope.postMessage({ id, result }, transfer);
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
