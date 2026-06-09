// AI API rate limiting using Cloudflare KV (60 req/min per IP).
// Falls back to allow if KV is not configured.

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

export async function checkRateLimit(
	kv: KVNamespace | undefined,
	ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
	if (!kv) return { allowed: true };

	const now = Math.floor(Date.now() / 1000);
	const windowStart = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;
	const key = `rl:chat:${ip}:${windowStart}`;

	const current = await kv.get(key);
	const count = current ? parseInt(current, 10) : 0;

	if (count >= MAX_REQUESTS) {
		return { allowed: false, retryAfter: windowStart + WINDOW_SECONDS - now };
	}

	await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS * 2 });
	return { allowed: true };
}
