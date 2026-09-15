import { describe, it, expect } from 'vitest';
import { generatePowerpointPresentation } from './powerpoint';
import { extractZipText } from './test-utils';

describe('generatePowerpointPresentation', () => {
	it('generates a valid pptx with content', async () => {
		const buffer = await generatePowerpointPresentation({
			title: 'Proposal',
			slides: [
				{
					title: 'Benefits of Adoption',
					body: ['Reduces work time', 'Prevents input errors']
				},
				{
					title: 'Pricing Plans',
					table: {
						columns: [
							{ key: 'plan', label: 'Plan Name' },
							{ key: 'price', label: 'Price' }
						],
						rows: [{ plan: 'Standard', price: '$500' }]
					}
				}
			]
		});

		const bytes = new Uint8Array(buffer);
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);

		const text = await extractZipText(buffer);
		expect(text).toContain('Proposal');
		expect(text).toContain('Benefits of Adoption');
		expect(text).toContain('Plan Name');
	});
});
