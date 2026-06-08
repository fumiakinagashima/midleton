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
	const PL = 48; // padding left
	const PR = 16; // padding right
	const PT = 16; // padding top
	const PB = 40; // padding bottom
	const plotW = W - PL - PR;
	const plotH = H - PT - PB;

	const maxVal = $derived(Math.max(...data.map((d) => d.value), 1));
	const step = $derived(plotW / Math.max(data.length, 1));
	const barW = $derived(step * 0.6);

	const yTicks = $derived(
		[0, 0.25, 0.5, 0.75, 1].map((t) => ({
			y: PT + plotH * (1 - t),
			label: Math.round(maxVal * t).toLocaleString()
		}))
	);

	function bx(i: number) { return PL + i * step + step * 0.2; }
	function bh(v: number) { return (v / maxVal) * plotH; }
	function by(v: number) { return PT + plotH - bh(v); }
</script>

<figure class="chart">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
		{#each yTicks as t}
			<line x1={PL} y1={t.y} x2={W - PR} y2={t.y}
				stroke="var(--color-border)" stroke-width="1" />
			<text x={PL - 6} y={t.y + 4} text-anchor="end"
				fill="var(--color-text-muted)" font-size="11">{t.label}</text>
		{/each}

		{#each data as d, i}
			<rect x={bx(i)} y={by(d.value)} width={barW} height={bh(d.value)}
				fill={color} rx="3" opacity="0.9" />
			<text x={bx(i) + barW / 2} y={H - PB + 16}
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
