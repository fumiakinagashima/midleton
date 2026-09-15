import { expect, test } from '@playwright/test';

test('chat page loads with input box', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'MIDLETON' })).toBeVisible();
	await expect(page.getByPlaceholder('Type a message (Shift+Enter for a new line)')).toBeVisible();
});
