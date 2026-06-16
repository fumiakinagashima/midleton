<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { CV } from '@techstark/opencv-js';
	import {
		loadOpenCv,
		detectCard,
		createStabilityTracker,
		captureWarpedCard,
		captureFullFrame,
		getCoverCrop,
		type Quad
	} from './cardDetector';

	type ScanState = 'init' | 'starting' | 'live' | 'captured' | 'error';
	type CropRect = { sx: number; sy: number; sw: number; sh: number };

	type Props = {
		onCapture: (blob: Blob) => void;
		onCancel?: () => void;
		resetSignal: number;
	};
	let { onCapture, onCancel, resetSignal }: Props = $props();

	let scanState = $state<ScanState>('init');
	let statusMsg = $state('');
	let errorMsg = $state('');

	let viewportEl: HTMLDivElement;
	let videoEl: HTMLVideoElement;
	let overlayCanvas: HTMLCanvasElement;
	let workingCanvas: HTMLCanvasElement;

	let stream: MediaStream | null = null;
	let cv: CV | null = null;
	let detectionRaf = 0;
	let lastDetectTime = 0;
	let stabilityTracker: ReturnType<typeof createStabilityTracker> | null = null;
	let currentQuad: Quad | null = null;
	let currentCrop: CropRect | null = null;
	let currentWorkingSize = { width: 0, height: 0 };
	let primaryColor = '#705446';

	const WORKING_WIDTH = 400;

	onMount(() => {
		const computed = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
		if (computed) primaryColor = computed;

		return () => {
			if (detectionRaf) cancelAnimationFrame(detectionRaf);
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
		};
	});

	$effect(() => {
		resetSignal;
		if (scanState === 'captured') {
			scanState = 'live';
			statusMsg = cv ? '名刺を枠内に置いてください' : '自動検出は利用できません。シャッターボタンで撮影してください。';
			stabilityTracker?.reset();
		}
	});

	async function startCamera() {
		scanState = 'starting';
		statusMsg = 'カメラを起動しています…';
		errorMsg = '';
		await tick();

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' } },
				audio: false
			});
			videoEl.srcObject = stream;
			await videoEl.play();
		} catch (e) {
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
			scanState = 'error';
			const name = e instanceof Error ? e.name : '';
			if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
				errorMsg = 'カメラの使用が許可されていません。';
			} else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
				errorMsg = 'カメラが見つかりません。';
			} else {
				errorMsg = 'カメラの起動に失敗しました。';
			}
			return;
		}

		statusMsg = '読み取り機能を準備しています…';
		try {
			cv = await loadOpenCv();
			stabilityTracker = createStabilityTracker();
		} catch {
			cv = null;
		}

		scanState = 'live';
		statusMsg = cv ? '名刺を枠内に置いてください' : '自動検出は利用できません。シャッターボタンで撮影してください。';
		detectionRaf = requestAnimationFrame(detectionLoop);
	}

	function detectionLoop(timestamp: number) {
		detectionRaf = requestAnimationFrame(detectionLoop);
		if (scanState !== 'live' || !cv || !videoEl.videoWidth) return;
		if (timestamp - lastDetectTime < 125) return;
		lastDetectTime = timestamp;

		const containerW = viewportEl.clientWidth;
		const containerH = viewportEl.clientHeight;
		const crop = getCoverCrop(videoEl.videoWidth, videoEl.videoHeight, containerW, containerH);
		const wW = WORKING_WIDTH;
		const wH = Math.round(WORKING_WIDTH * (crop.sh / crop.sw));

		workingCanvas.width = wW;
		workingCanvas.height = wH;
		workingCanvas
			.getContext('2d')!
			.drawImage(videoEl, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, wW, wH);

		const { quad, area } = detectCard(cv, workingCanvas);
		currentQuad = quad;
		currentCrop = crop;
		currentWorkingSize = { width: wW, height: wH };
		drawOverlay(quad, wW, wH, containerW, containerH);

		const stable = stabilityTracker!.push(quad, area);
		statusMsg = quad
			? '名刺を検出しました。動かさずにお待ちください…'
			: '名刺を枠内に置いてください';

		if (stable) {
			stabilityTracker!.reset();
			try {
				const canvas = captureWarpedCard(cv, videoEl, quad!, currentWorkingSize, crop);
				emitCapture(canvas);
			} catch {
				// keep live, allow retry / manual shutter
			}
		}
	}

	function drawOverlay(quad: Quad | null, wW: number, wH: number, containerW: number, containerH: number) {
		overlayCanvas.width = containerW;
		overlayCanvas.height = containerH;
		const ctx = overlayCanvas.getContext('2d')!;
		ctx.clearRect(0, 0, containerW, containerH);

		if (quad) {
			const kx = containerW / wW;
			const ky = containerH / wH;
			ctx.lineWidth = 3;
			ctx.strokeStyle = primaryColor;
			ctx.beginPath();
			ctx.moveTo(quad[0].x * kx, quad[0].y * ky);
			for (let i = 1; i < quad.length; i++) {
				ctx.lineTo(quad[i].x * kx, quad[i].y * ky);
			}
			ctx.closePath();
			ctx.stroke();
		} else {
			const guideW = containerW * 0.85;
			const guideH = guideW / 1.585;
			const x = (containerW - guideW) / 2;
			const y = (containerH - guideH) / 2;
			ctx.save();
			ctx.setLineDash([10, 8]);
			ctx.lineWidth = 2;
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
			ctx.strokeRect(x, y, guideW, guideH);
			ctx.restore();
		}
	}

	function emitCapture(canvas: HTMLCanvasElement) {
		scanState = 'captured';
		canvas.toBlob(
			(blob) => {
				if (blob) {
					onCapture(blob);
				} else {
					scanState = 'live';
				}
			},
			'image/jpeg',
			0.9
		);
	}

	function manualCapture() {
		if (scanState !== 'live' || !videoEl.videoWidth) return;
		try {
			let canvas: HTMLCanvasElement;
			if (cv && currentQuad && currentCrop) {
				canvas = captureWarpedCard(cv, videoEl, currentQuad, currentWorkingSize, currentCrop);
			} else {
				const crop =
					currentCrop ??
					getCoverCrop(videoEl.videoWidth, videoEl.videoHeight, viewportEl.clientWidth, viewportEl.clientHeight);
				canvas = captureFullFrame(videoEl, crop);
			}
			emitCapture(canvas);
		} catch {
			// ignore, stay live
		}
	}
</script>

<div class="scanner">
	{#if scanState === 'init'}
		<div class="placeholder">
			<button class="primary-btn" onclick={startCamera}>カメラで読み取る</button>
		</div>
	{:else if scanState === 'error'}
		<div class="placeholder">
			<p class="error-text">{errorMsg}</p>
			{#if onCancel}
				<button class="primary-btn" onclick={() => onCancel?.()}>ファイル選択に戻る</button>
			{/if}
		</div>
	{/if}

	<div class="viewport" bind:this={viewportEl} class:hidden={scanState === 'init' || scanState === 'error'}>
		<video bind:this={videoEl} playsinline muted autoplay></video>
		<canvas bind:this={overlayCanvas} class="overlay"></canvas>
		{#if statusMsg}
			<p class="status">{statusMsg}</p>
		{/if}
		<button class="shutter" onclick={manualCapture} disabled={scanState !== 'live'} aria-label="撮影"></button>
	</div>

	<canvas bind:this={workingCanvas} hidden></canvas>
</div>

<style lang="scss">
	.scanner {
		width: 100%;
		height: 100%;
		min-width: 320px;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		width: 100%;
		height: 100%;
		min-height: 220px;
		padding: 32px;
		text-align: center;
	}

	.error-text {
		font-size: 0.9375rem;
		color: var(--color-danger);
		margin: 0;
	}

	.primary-btn {
		display: inline-block;
		padding: 9px 20px;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.primary-btn:hover {
		opacity: 0.88;
	}

	.viewport {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 220px;
		aspect-ratio: 1.585;
		background: #000;
		overflow: hidden;
	}

	.viewport.hidden {
		display: none;
	}

	.viewport video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.status {
		position: absolute;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		padding: 6px 16px;
		border-radius: 20px;
		background: color-mix(in srgb, #000 55%, transparent);
		color: #fff;
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.shutter {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: color-mix(in srgb, #fff 85%, transparent);
		border: 4px solid color-mix(in srgb, #fff 60%, transparent);
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.shutter:hover:not(:disabled) {
		opacity: 0.88;
	}

	.shutter:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
