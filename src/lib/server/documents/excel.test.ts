import { describe, it, expect } from 'vitest';
import { generateExcelWorkbook } from './excel';
import { extractZipText } from './test-utils';

describe('generateExcelWorkbook', () => {
	it('generates a valid xlsx with content', async () => {
		const buffer = await generateExcelWorkbook([
			{
				name: 'Sales List',
				columns: [
					{ key: 'name', label: 'Customer Name' },
					{ key: 'amount', label: 'Amount' }
				],
				rows: [
					{ name: 'Sample Corp.', amount: 100000 },
					{ name: 'Test LLC', amount: 50000 }
				]
			}
		]);

		const bytes = new Uint8Array(buffer);
		expect(bytes[0]).toBe(0x50); // 'P'
		expect(bytes[1]).toBe(0x4b); // 'K'

		const text = await extractZipText(buffer);
		expect(text).toContain('Customer Name');
		expect(text).toContain('Sample Corp.');
	});
});
