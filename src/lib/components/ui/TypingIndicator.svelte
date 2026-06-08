<div class="typing">
	<span></span>
	<span></span>
	<span></span>
</div>

<style>
	.typing {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 12px 16px;
		background: var(--color-surface);
		border-radius: 12px;
		border-bottom-left-radius: 4px;
		width: fit-content;
	}

	span {
		display: block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-text-muted);
		animation: bounce 1.2s ease-in-out infinite;
	}

	span:nth-child(2) { animation-delay: 0.2s; }
	span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes bounce {
		0%, 60%, 100% { transform: translateY(0); }
		30%            { transform: translateY(-6px); }
	}
</style>
