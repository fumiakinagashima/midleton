import { describe, it, expect } from 'vitest';
import { generateWordDocument } from './word';
import { extractZipText } from './test-utils';

describe('generateWordDocument', () => {
	it('generates a valid docx with content', async () => {
		const buffer = await generateWordDocument({
			title: 'Meeting Materials',
			blocks: [
				{ type: 'heading', level: 1, text: 'Progress Overview' },
				{ type: 'paragraph', text: 'The number of deals this month increased compared to last month.' },
				{
					type: 'table',
					columns: [
						{ key: 'name', label: 'Deal Name' },
						{ key: 'status', label: 'Status' }
					],
					rows: [{ name: 'New Adoption Deal', status: 'In Negotiation' }]
				}
			]
		});

		const bytes = new Uint8Array(buffer);
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);

		const text = await extractZipText(buffer);
		expect(text).toContain('Meeting Materials');
		expect(text).toContain('Progress Overview');
		expect(text).toContain('Deal Name');
	});
});
