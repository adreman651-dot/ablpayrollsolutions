// Face-api.js loader + helpers for face descriptor extraction and comparison.
// Uses CDN-hosted models (matching the ones already loaded in TimeIn).

let loadingPromise: Promise<any> | null = null;

const MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";

export async function loadFaceApi(): Promise<any> {
  if ((window as any).faceapi?.nets?.faceRecognitionNet?.params) {
    return (window as any).faceapi;
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`) as HTMLScriptElement | null;
    const ready = async () => {
      try {
        const faceapi = (window as any).faceapi;
        if (!faceapi) throw new Error("face-api not on window");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        resolve(faceapi);
      } catch (e) {
        reject(e);
      }
    };
    if (existing) {
      if ((window as any).faceapi) ready();
      else existing.addEventListener("load", ready);
    } else {
      const s = document.createElement("script");
      s.src = SCRIPT_URL;
      s.async = true;
      s.onload = ready;
      s.onerror = () => reject(new Error("Failed to load face-api script"));
      document.body.appendChild(s);
    }
  });

  return loadingPromise;
}

export async function computeDescriptorFromImage(imgOrVideo: HTMLImageElement | HTMLVideoElement): Promise<Float32Array | null> {
  const faceapi = await loadFaceApi();
  const det = await faceapi
    .detectSingleFace(imgOrVideo, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det?.descriptor ?? null;
}

export async function countFaces(imgOrVideo: HTMLImageElement | HTMLVideoElement): Promise<number> {
  const faceapi = await loadFaceApi();
  const dets = await faceapi.detectAllFaces(imgOrVideo, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }));
  return dets.length;
}

/** Euclidean distance -> percentage match (0..1). 0.6 threshold = ~85% match. */
export function descriptorMatchPercentage(a: Float32Array | number[], b: Float32Array | number[]): number {
  const A = a instanceof Float32Array ? a : Float32Array.from(a);
  const B = b instanceof Float32Array ? b : Float32Array.from(b);
  if (A.length !== B.length) return 0;
  let sum = 0;
  for (let i = 0; i < A.length; i++) {
    const d = A[i] - B[i];
    sum += d * d;
  }
  const dist = Math.sqrt(sum);
  // Map distance -> similarity. face-api convention: <0.6 = same person.
  // Convert to a 0..100% similarity: 0.0 -> 100%, 0.6 -> 70%, 1.0 -> 0%
  const pct = Math.max(0, Math.min(100, (1 - dist) * 100));
  return pct;
}

export function descriptorToArray(d: Float32Array): number[] {
  return Array.from(d);
}
