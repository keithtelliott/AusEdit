import type { ImageStats } from "./analyze";
import type { MatchResult } from "./match";
import type { MatchRequest } from "./matchWorker";

// Runs look matching for many photos at once across several workers.

const SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));

export interface MatchJob {
  id: string;
  target: Float32Array;
}

export function matchMany(
  jobs: MatchJob[],
  reference: ImageStats,
  onResult: (id: string, result: MatchResult) => void,
): Promise<void> {
  const queue = [...jobs];
  const workers = Array.from(
    { length: Math.min(SIZE, queue.length) },
    () => new Worker(new URL("./matchWorker.ts", import.meta.url), { type: "module" }),
  );
  const run = (worker: Worker): Promise<void> =>
    new Promise((resolve, reject) => {
      const next = () => {
        const job = queue.shift();
        if (!job) return resolve();
        worker.onmessage = (e: MessageEvent<MatchResult>) => {
          onResult(job.id, e.data);
          next();
        };
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage({ target: job.target, reference } satisfies MatchRequest);
      };
      next();
    });
  return Promise.all(workers.map(run))
    .then(() => undefined)
    .finally(() => workers.forEach((w) => w.terminate()));
}
