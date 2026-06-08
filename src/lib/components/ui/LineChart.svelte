<script lang="ts">
	type DataPoint = { label: string; value: number };

	type Props = {
		data: DataPoint[];
		title?: string;
		color?: string;
	};

	let { data, title, color = 'var(--chart-1)' }: Props = $props();

	const W = 420;
	const H = 240;
	const PL = 48;
	const PR = 16;
	const PT = 16;
	const PB = 40;
	const plotW = W - PL - PR;
	const plotH = H - PT - PB;

	const maxVal = $derived(Math.max(...data.map((d) => d.value), 1));

	function px(i: number) {
		if (data.length === 1) return PL + plotW / 2;
		return PL + (i / (data.length - 1)) * plotW;
	}
	function py(v: number) { return PT + (1 - v / maxVal) * plotH; }

	const linePath = $derived(
		data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.value)}`).join(' ')
	);

	const areaPath = $derived(
		data.length > 1
			? `${linePath} L ${px(data.length - 1)} ${PT + plotH} L ${px(0)} ${PT + plotH} Z`
			: ''
	);

	const yTicks = $derived(
		[0, 0.25, 0.5, 0.75, 1].map((t) => ({
			y: PT + plotH * (1 - t),
			label: Math.round(maxVal * t).toLocaleString()
		}))
	);

	const gradId = `lg-${Math.random().toString(36).slice(2, 7)}`;
</script>

<figure class="chart">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
		<defs>
			<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color={color} stop-opacity="0.2" />
				<stop offset="100%" stop-color={color} stop-opacity="0.02" />
			</linearGradient>
		</defs>

		{#each yTicks as t}
			<line x1={PL} y1={t.y} x2={W - PR} y2={t.y}
				stroke="var(--color-border)" stroke-width="1" />
			<text x={PL - 6} y={t.y + 4} text-anchor="end"
				fill="var(--color-text-muted)" font-size="11">{t.label}</text>
		{/each}

		{#if data.length > 1}
			<path d={areaPath} fill="url(#{gradId})" />
		{/if}
		<path d={linePath} fill="none" stroke={color}
			stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

		{#each data as d, i}
			<circle cx={px(i)} cy={py(d.value)} r="4" fill={color} />
			<text x={px(i)} y={H - PB + 16}
				text-anchor="middle" fill="var(--color-text-muted)" font-size="11">{d.label}</text>
		{/each}

		<line x1={PL} y1={PT} x2={PL} y2={PT + plotH}
			stroke="var(--color-border)" stroke-width="1" />
		<line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH}
			stroke="var(--color-border)" stroke-width="1" />
	</svg>
</figure>

<style>
	.chart { display: flex; flex-direction: column; gap: 6px; margin: 0; }
	figcaption { font-size: 0.9375rem; font-weight: 600; color: var(--color-text); }
	svg { width: 100%; height: auto; }
</style>
