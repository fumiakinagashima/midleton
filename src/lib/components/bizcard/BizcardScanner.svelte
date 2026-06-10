<script lang="ts">
	import type { BizcardResult } from '../../../routes/api/bizcard/+server';
	import CameraScanner from './CameraScanner.svelte';

	type State = 'idle' | 'loading' | 'done' | 'error';
	type Mode = 'file' | 'camera';

	const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

	let state = $state<State>('idle');
	let errorMsg = $state('');
	let results = $state<BizcardResult[]>([]);
	let previewUrl = $state<string | null>(null);
	let dragging = $state(false);
	let mode: Mode = $state('camera');
	let scanResetSignal = $state(0);

	const fields: { key: keyof BizcardResult; label: string; icon: string }[] = [
		{ key: 'name',    label: '氏名',     icon: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z' },
		{ key: 'company', label: '会社名',   icon: 'M4 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4zm0 4h10v2H4zm12 0h4v6h-4zm1 1v4h2v-4z' },
		{ key: 'title',   label: '役職',     icon: 'M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9 8H5v-2h6v2zm4-4H5V9h10v2zm3 4h-2v-2h2v2z' },
		{ key: 'email',   label: 'メール',   icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z' },
		{ key: 'phone',   label: '電話',     icon: 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z' },
		{ key: 'address', label: '住所',     icon: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z' },
		{ key: 'website', label: 'Web',      icon: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 17.9c-3.9-.5-7-3.9-7-7.9 0-.6.1-1.2.2-1.8L9 15v1c0 1.1.9 2 2 2v1.9zm6.9-2.6c-.3-.8-1-1.3-1.9-1.3h-1v-3c0-.6-.4-1-1-1H8v-2h2c.6 0 1-.4 1-1V7h2c1.1 0 2-.9 2-2v-.4c2.9 1.2 5 4 5 7.4 0 2.1-.8 4-2.1 5.3z' }
	];

	function isHeic(file: File): boolean {
		if (file.type === 'image/heic' || file.type === 'image/heif') return true;
		const ext = file.name.split('.').pop()?.toLowerCase();
		return ext === 'heic' || ext === 'heif';
	}

	function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		if (isHeic(file)) {
			state = 'error';
			errorMsg = 'heic';
			return;
		}
		if (!file.type.startsWith('image/')) {
			state = 'error';
			errorMsg = '画像ファイルを選択してください。';
			return;
		}
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(file);
		upload(file);
	}

	// 長辺 1600px・品質 0.85 にリサイズ（複数枚でも各カードの文字が読める解像度）
	function resizeImage(file: File, maxPx = 1600): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(file);
			img.onload = () => {
				URL.revokeObjectURL(url);
				const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
				const w = Math.round(img.width * scale);
				const h = Math.round(img.height * scale);
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
				canvas.toBlob(
					(blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
					'image/jpeg',
					0.85
				);
			};
			img.onerror = () => reject(new Error('image load failed'));
			img.src = url;
		});
	}

	async function upload(input: Blob | File) {
		state = 'loading';
		results = [];
		errorMsg = '';

		let blob: Blob;
		if (input instanceof File) {
			try {
				blob = await resizeImage(input);
			} catch {
				state = 'error';
				errorMsg = '画像の処理に失敗しました。';
				return;
			}
		} else {
			blob = input;
		}

		const fd = new FormData();
		fd.append('image', blob, 'bizcard.jpg');

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 25000);

		try {
			const res = await fetch('/api/bizcard', { method: 'POST', body: fd, signal: controller.signal });
			clearTimeout(timer);
			const data = await res.json() as { results?: BizcardResult[]; error?: string };
			if (!res.ok || data.error) {
				state = 'error';
				errorMsg = data.error ?? '抽出に失敗しました。';
			} else {
				results = data.results ?? [];
				state = 'done';
			}
		} catch (e) {
			clearTimeout(timer);
			state = 'error';
			errorMsg = e instanceof Error && e.name === 'AbortError'
				? 'タイムアウトしました。画像を小さくして再試行してください。'
				: 'ネットワークエラーが発生しました。';
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function onDragOver(e: DragEvent) { e.preventDefault(); dragging = true; }
	function onDragLeave() { dragging = false; }

	function reset() {
		state = 'idle';
		results = [];
		errorMsg = '';
		if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
		scanResetSignal += 1;
	}

	function setMode(next: Mode) {
		if (mode === next) return;
		mode = next;
		reset();
	}

	function handleCameraCapture(blob: Blob) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(blob);
		upload(blob);
	}

	function registerUrl(r: BizcardResult): string {
		const p = new URLSearchParams();
		if (r.company) p.set('name', r.company);
		else if (r.name) p.set('name', r.name);
		if (r.name)    p.set('contactName', r.name);
		if (r.email)   p.set('email', r.email);
		if (r.phone)   p.set('phone', r.phone);
		if (r.address) p.set('address', r.address);
		const notes: string[] = [];
		if (r.title)   notes.push(`役職: ${r.title}`);
		if (r.website) notes.push(`Web: ${r.website}`);
		if (notes.length) p.set('notes', notes.join('\n'));
		return `/database/customers/new?${p.toString()}`;
	}
</script>

<div class="scanner">
	<!-- Upload zone -->
	{#if mode === 'camera'}
		<div class="capture-area">
			<div class="upload-zone camera-zone">
				<CameraScanner onCapture={handleCameraCapture} onCancel={() => setMode('file')} resetSignal={scanResetSignal} />
				{#if previewUrl}
					<div class="capture-overlay">
						<img src={previewUrl} alt="名刺プレビュー" class="preview-img" />
						{#if state === 'loading'}
							<div class="overlay">
								<div class="spinner"></div>
								<p>AIが情報を読み取っています…</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<button type="button" class="mode-link" onclick={() => setMode('file')}>ファイルで読み込む</button>
		</div>
	{:else}
		<div class="capture-area">
			<div
				class="upload-zone"
				class:dragging
				class:has-preview={!!previewUrl}
				ondrop={onDrop}
				ondragover={onDragOver}
				ondragleave={onDragLeave}
				role="button"
				tabindex="0"
				aria-label="名刺画像をアップロード"
			>
				{#if previewUrl}
					<img src={previewUrl} alt="名刺プレビュー" class="preview-img" />
					{#if state === 'loading'}
						<div class="overlay">
							<div class="spinner"></div>
							<p>AIが情報を読み取っています…</p>
						</div>
					{/if}
				{:else}
					<div class="placeholder">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
							<rect x="3" y="5" width="18" height="14" rx="2"/>
							<path d="M3 9h18"/>
							<circle cx="8" cy="7" r="0.5" fill="currentColor"/>
							<circle cx="10" cy="7" r="0.5" fill="currentColor"/>
						</svg>
						<p class="ph-title">名刺をドロップ</p>
						<p class="ph-sub">または</p>
						<label class="upload-btn">
							ファイルを選択
							<input type="file" accept="image/*" onchange={(e) => handleFiles((e.target as HTMLInputElement).files)} />
						</label>
						<p class="ph-hint">JPEG・PNG・WEBP 対応・複数枚同時対応</p>
					</div>
				{/if}
			</div>
			{#if cameraSupported}
				<button type="button" class="mode-link" onclick={() => setMode('camera')}>カメラで読み取る</button>
			{/if}
		</div>
	{/if}

	<!-- Result cards -->
	{#if state === 'done' && results.length > 0}
		<div class="results-wrap">
			<div class="result-header">
				<span class="result-badge">{results.length}件 抽出完了</span>
				<button class="reset-btn" onclick={reset}>{mode === 'camera' ? '別の名刺をスキャン' : '別の画像を読み込む'}</button>
			</div>

			<div class="result-cards">
				{#each results as r, i}
					<div class="result-card">
						{#if results.length > 1}
							<p class="card-index">名刺 {i + 1}</p>
						{/if}
						<div class="fields">
							{#each fields as f}
								{#if r[f.key]}
									<div class="field-row">
										<span class="field-icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="currentColor">
												<path d={f.icon}/>
											</svg>
										</span>
										<span class="field-label">{f.label}</span>
										<span class="field-value">{r[f.key]}</span>
									</div>
								{/if}
							{/each}
						</div>
						<div class="actions">
							<a href={registerUrl(r)} class="action-btn primary">顧客として登録</a>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if state === 'error'}
		<div class="error-box">
			<p>{errorMsg === 'heic' ? 'HEIC形式は非対応です。JPEG または PNG に変換してください。' : errorMsg}</p>
			<button onclick={reset}>閉じる</button>
		</div>
	{/if}
</div>

<style>
	.scanner {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* ---- Capture area ---- */
	.capture-area {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		max-width: 480px;
	}

	.mode-link {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.mode-link:hover { color: var(--color-text); }

	/* ---- Upload zone ---- */
	.upload-zone {
		max-width: 480px;
		min-height: 220px;
		border: 2px dashed var(--color-border);
		border-radius: 16px;
		background: var(--color-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		transition: border-color 0.15s, background 0.15s;
		cursor: pointer;
	}

	.upload-zone.dragging {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
	}

	.upload-zone.has-preview {
		min-height: 220px;
		cursor: default;
	}

	.camera-zone {
		display: block;
	}

	.capture-overlay {
		position: absolute;
		inset: 0;
		background: #000;
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		max-height: 320px;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--color-background) 70%, transparent);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
	}

	.overlay p {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 32px;
		text-align: center;
	}

	.placeholder svg {
		width: 48px;
		height: 48px;
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	.ph-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.ph-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.ph-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.upload-btn {
		display: inline-block;
		padding: 7px 18px;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.upload-btn:hover { opacity: 0.88; }

	.upload-btn input {
		display: none;
	}

	/* ---- Spinner ---- */
	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ---- Results ---- */
	.results-wrap {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.result-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.result-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-radius: 20px;
		padding: 4px 12px;
	}

	.reset-btn {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.reset-btn:hover { color: var(--color-text); }

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		overflow: hidden;
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.field-row:last-child {
		border-bottom: none;
	}

	.field-icon {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		color: var(--color-text-muted);
	}

	.field-icon svg {
		width: 18px;
		height: 18px;
	}

	.field-label {
		flex-shrink: 0;
		width: 72px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.field-value {
		font-size: 0.9375rem;
		color: var(--color-text);
		word-break: break-all;
	}

	.result-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 16px;
	}

	.result-card {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.card-index {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.action-btn {
		display: inline-block;
		padding: 9px 20px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.action-btn.primary {
		background: var(--color-primary);
		color: #fff;
	}

	.action-btn:hover { opacity: 0.88; }

	/* ---- Error ---- */
	.error-box {
		max-width: 480px;
		background: color-mix(in srgb, var(--color-danger) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
		border-radius: 10px;
		padding: 16px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.error-box p {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--color-danger);
	}

	.error-box button {
		font-size: 0.875rem;
		background: none;
		border: 1px solid var(--color-danger);
		color: var(--color-danger);
		border-radius: 6px;
		padding: 5px 14px;
		cursor: pointer;
		white-space: nowrap;
	}
</style>
