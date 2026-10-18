// Runs matchLook off the main thread so the editor stays responsive.
import type { ImageStats } from "./analyze";
import { matchLook } from "./match";

export interface MatchRequest {
  target: Float32Array;
  reference: ImageStats;
}

self.onmessage = (e: MessageEvent<MatchRequest>) => {
  self.postMessage(matchLook(e.data.target, e.data.reference));
};
