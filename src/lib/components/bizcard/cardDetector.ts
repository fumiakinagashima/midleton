/// <reference types="vite/client" />
import type { CV } from '@techstark/opencv-js';
import opencvScriptUrl from '@techstark/opencv-js/dist/opencv.js?url';
import { OPENCV_LOAD_TIMEOUT_MS } from '$lib/constants';

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

export type DetectionResult = {
	quad: Quad | null; // working-canvas coordinates
	area: number; // contour area in working-canvas px^2
};

type Disposable = { delete(): void };

/**
 * Runs `fn`, tracking every Mat/MatVector created via `track()` and deleting
 * them all (in a `finally`) once `fn` returns or throws. Plain JS return
 * values (Quad, HTMLCanvasElement, etc.) are unaffected.
 */
function withMats<T>(fn: (track: <M extends Disposable>(m: M) => M) => T): T {
	const tracked: Disposable[] = [];
	const track = <M extends Disposable>(m: M): M => {
		tracked.push(m);
		return m;
	};
	try {
		return fn(track);
	} finally {
		for (const m of tracked) m.delete();
	}
}

type CvModule = CV & { onRuntimeInitialized?: () => void; Mat?: unknown };

declare global {
	interface Window {
		cv?: CvModule;
	}
}

let cvPromise: Promise<CV> | null = null;

/**
 * Lazily loads `@techstark/opencv-js` via a classic `<script>` tag, caching the
 * resolved module. Loading it through `import('@techstark/opencv-js')` instead
 * makes Vite/Rollup wrap the CommonJS export in an ESM-interop snapshot taken
 * before the WASM runtime finishes initializing in production builds; the real
 * Emscripten runtime then fires `onRuntimeInitialized` on the original object,
 * never on that snapshot, so a listener attached to it hangs forever. A classic
 * script avoids the interop step and exposes the live object as `window.cv`.
 */
export function loadOpenCv(): Promise<CV> {
	if (!cvPromise) {
		const load = new Promise<CV>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = opencvScriptUrl;
			script.onload = () => {
				const cv = window.cv;
				if (!cv) {
					reject(new Error('OpenCV script loaded but window.cv is missing.'));
					return;
				}
				if (cv.Mat) {
					resolve(cv as CV);
					return;
				}
				cv.onRuntimeInitialized = () => resolve(cv as CV);
			};
			script.onerror = () => reject(new Error('Failed to load OpenCV script.'));
			document.head.appendChild(script);
		});
		const timeout = new Promise<CV>((_, reject) => {
			setTimeout(() => reject(new Error('OpenCV の読み込みがタイムアウトしました。')), OPENCV_LOAD_TIMEOUT_MS);
		});
		cvPromise = Promise.race([load, timeout]);
	}
	return cvPromise;
}

function dist(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Orders 4 arbitrary corners as [TL, TR, BR, BL]. */
export function orderCorners(quad: Quad): Quad {
	const sorted = [...quad];
	const bySum = [...sorted].sort((a, b) => a.x + a.y - (b.x + b.y));
	const byDiff = [...sorted].sort((a, b) => a.x - a.y - (b.x - b.y));
	const tl = bySum[0];
	const br = bySum[bySum.length - 1];
	const tr = byDiff[byDiff.length - 1];
	const bl = byDiff[0];
	return [tl, tr, br, bl];
}

const MIN_AREA_RATIO = 0.15;

/**
 * Detects the largest convex quadrilateral in `srcCanvas` (downscaled video
 * frame) likely to be a business card edge.
 */
export function detectCard(cv: CV, srcCanvas: HTMLCanvasElement): DetectionResult {
	return withMats((track) => {
		const src = track(cv.imread(srcCanvas));
		const gray = track(new cv.Mat());
		cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

		const blurred = track(new cv.Mat());
		cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

		const edges = track(new cv.Mat());
		cv.Canny(blurred, edges, 50, 150);

		const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
		const dilated = track(new cv.Mat());
		cv.dilate(edges, dilated, kernel);

		const contours = track(new cv.MatVector());
		const hierarchy = track(new cv.Mat());
		cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

		const minArea = srcCanvas.width * srcCanvas.height * MIN_AREA_RATIO;

		let best: { quad: Quad; area: number } | null = null;
		for (let i = 0; i < contours.size(); i++) {
			const contour = track(contours.get(i));
			const peri = cv.arcLength(contour, true);
			const approx = track(new cv.Mat());
			cv.approxPolyDP(contour, approx, 0.02 * peri, true);

			if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue;
			const area = cv.contourArea(approx);
			if (area < minArea) continue;
			if (best && area <= best.area) continue;

			const quad: Quad = [
				{ x: approx.data32S[0], y: approx.data32S[1] },
				{ x: approx.data32S[2], y: approx.data32S[3] },
				{ x: approx.data32S[4], y: approx.data32S[5] },
				{ x: approx.data32S[6], y: approx.data32S[7] }
			];
			best = { quad, area };
		}

		return best ?? { quad: null, area: 0 };
	});
}

export type StabilityOptions = {
	historySize?: number;
	cornerTolerancePx?: number;
	areaTolerancePct?: number;
};

/**
 * Tracks recent detections and reports `true` once the quad has stayed
 * within tolerance for `historySize` consecutive frames (auto-capture cue).
 */
export function createStabilityTracker(opts: StabilityOptions = {}) {
	const historySize = opts.historySize ?? 6;
	const cornerTolerancePx = opts.cornerTolerancePx ?? 8;
	const areaTolerancePct = opts.areaTolerancePct ?? 0.1;

	let history: { quad: Quad; area: number }[] = [];

	return {
		push(quad: Quad | null, area: number): boolean {
			if (!quad) {
				history = [];
				return false;
			}

			history.push({ quad: orderCorners(quad), area });
			if (history.length > historySize) history.shift();
			if (history.length < historySize) return false;

			const avg: Quad = [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			];
			for (const entry of history) {
				for (let i = 0; i < 4; i++) {
					avg[i].x += entry.quad[i].x / history.length;
					avg[i].y += entry.quad[i].y / history.length;
				}
			}
			for (const entry of history) {
				for (let i = 0; i < 4; i++) {
					if (dist(entry.quad[i], avg[i]) > cornerTolerancePx) return false;
				}
			}

			const areas = history.map((h) => h.area);
			const maxArea = Math.max(...areas);
			const minArea = Math.min(...areas);
			if (maxArea === 0 || (maxArea - minArea) / maxArea > areaTolerancePct) return false;

			return true;
		},
		reset() {
			history = [];
		}
	};
}

/** Crops the cover-fit `cropRect` of the video at native resolution, no perspective correction. */
export function captureFullFrame(
	videoEl: HTMLVideoElement,
	cropRect: { sx: number; sy: number; sw: number; sh: number },
	outputLongEdge = 1600
): HTMLCanvasElement {
	const scale = Math.min(1, outputLongEdge / Math.max(cropRect.sw, cropRect.sh));
	const outW = Math.max(1, Math.round(cropRect.sw * scale));
	const outH = Math.max(1, Math.round(cropRect.sh * scale));

	const canvas = document.createElement('canvas');
	canvas.width = outW;
	canvas.height = outH;
	canvas
		.getContext('2d')!
		.drawImage(videoEl, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, outW, outH);
	return canvas;
}

/**
 * Perspective-corrects and crops the card from the full-resolution video
 * frame. `quad` is in working-canvas coordinates (the cover-cropped region
 * described by `cropRect`, downscaled to `workingSize`).
 */
export function captureWarpedCard(
	cv: CV,
	videoEl: HTMLVideoElement,
	quad: Quad,
	workingSize: { width: number; height: number },
	cropRect: { sx: number; sy: number; sw: number; sh: number },
	outputLongEdge = 1600
): HTMLCanvasElement {
	const toVideoCoords = (p: Point): Point => ({
		x: cropRect.sx + (p.x / workingSize.width) * cropRect.sw,
		y: cropRect.sy + (p.y / workingSize.height) * cropRect.sh
	});

	const [tl, tr, br, bl] = orderCorners(quad.map(toVideoCoords) as Quad);

	const w = (dist(tl, tr) + dist(bl, br)) / 2;
	const h = (dist(tl, bl) + dist(tr, br)) / 2;
	const scale = outputLongEdge / Math.max(w, h);
	const outW = Math.max(1, Math.round(w * scale));
	const outH = Math.max(1, Math.round(h * scale));

	return withMats((track) => {
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = videoEl.videoWidth;
		tempCanvas.height = videoEl.videoHeight;
		tempCanvas.getContext('2d')!.drawImage(videoEl, 0, 0);

		const src = track(cv.imread(tempCanvas));
		const srcTri = track(
			cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y])
		);
		const dstTri = track(
			cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH])
		);
		const M = track(cv.getPerspectiveTransform(srcTri, dstTri));
		const dst = track(new cv.Mat());
		cv.warpPerspective(
			src,
			dst,
			M,
			new cv.Size(outW, outH),
			cv.INTER_LINEAR,
			cv.BORDER_CONSTANT
		);

		const outputCanvas = document.createElement('canvas');
		outputCanvas.width = outW;
		outputCanvas.height = outH;
		cv.imshow(outputCanvas, dst);
		return outputCanvas;
	});
}

/** Computes the source rect of `videoEl` visible under `object-fit: cover` for a `containerW x containerH` box. */
export function getCoverCrop(
	videoW: number,
	videoH: number,
	containerW: number,
	containerH: number
): { sx: number; sy: number; sw: number; sh: number } {
	const videoRatio = videoW / videoH;
	const containerRatio = containerW / containerH;
	if (videoRatio > containerRatio) {
		const sh = videoH;
		const sw = sh * containerRatio;
		return { sx: (videoW - sw) / 2, sy: 0, sw, sh };
	}
	const sw = videoW;
	const sh = sw / containerRatio;
	return { sx: 0, sy: (videoH - sh) / 2, sw, sh };
}
