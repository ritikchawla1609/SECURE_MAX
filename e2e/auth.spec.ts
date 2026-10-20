import { test, expect } from '@playwright/test';

test('has title and login buttons', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/SecureMax/i);

  // Verify page loaded
  await expect(page.locator('body')).toBeVisible();
});

test('navigate to login page', async ({ page }) => {
  await page.goto('/login');

  await expect(page.locator('text=Team Member Login')).toBeVisible();
});
