import { test, expect } from '@playwright/test';

test.describe('Dashboard navigation', () => {
  test('User can see login options', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('text=Team Member Login').first()).toBeVisible();
  });
});

test.describe('Public pages load successfully', () => {
  test('Home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
