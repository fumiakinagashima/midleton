import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export type BizcardResult = {
	name: string | null;
	company: string | null;
	title: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	website: string | null;
};

const PROMPT = `Read all the business cards shown in this image, extract the information for each one, and return a JSON array.
Even if there is only one business card, always return an array (with one element).
Set any missing fields to null. No explanatory text or markdown formatting is needed.

[
  {
    "name": "Full name",
    "company": "Company / organization name",
    "title": "Job title / position",
    "email": "Email address",
    "phone": "Phone number (first one only)",
    "address": "Address",
    "website": "Website URL"
  }
]`;

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) {
		return json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 });
	}

	const formData = await request.formData();
	const file = formData.get('image') as File | null;
	if (!file || !file.type.startsWith('image/')) {
		return json({ error: 'Please select an image file.' }, { status: 400 });
	}

	const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	if (!allowed.includes(file.type)) {
		return json({ error: 'Only JPEG, PNG, GIF, and WEBP are supported.' }, { status: 400 });
	}

	// Convert to base64 (chunked for speed)
	const arrayBuffer = await file.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);
	const CHUNK = 8192;
	const parts: string[] = [];
	for (let i = 0; i < bytes.length; i += CHUNK) {
		parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
	}
	const base64 = btoa(parts.join(''));

	// Call the Claude API (20 second timeout)
	const anthropic = new Anthropic({ apiKey, timeout: 20000 });
	let text = '';
	try {
		const message = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 512,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
								data: base64
							}
						},
						{ type: 'text', text: PROMPT }
					]
				}
			]
		});
		text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AI error: ${msg}` }, { status: 500 });
	}

	const jsonMatch = text.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return json({ error: `Failed to extract information. (response: ${text.slice(0, 100)})` }, { status: 500 });
	}

	try {
		const results = JSON.parse(jsonMatch[0]) as BizcardResult[];
		return json({ results });
	} catch {
		return json({ error: 'Failed to parse the response.' }, { status: 500 });
	}
};
