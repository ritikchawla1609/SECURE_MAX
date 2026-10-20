import { test, expect } from '@playwright/test';

test.describe('SecureMAX System Smoke E2E Suite', () => {

  test('1. Public Login & Authentication UI verification', async ({ page }) => {
    await page.goto('/login');

    // Branding and headers
    await expect(page).toHaveTitle(/SecureMax/i);
    await expect(page.locator('body')).toBeVisible();

    // Verify authentication options are displayed
    await expect(page.locator('text=Team Member').first()).toBeVisible();
    await expect(page.locator('text=Authenticate with Enrolled Device').first()).toBeVisible();
  });

  test('2. Unauthenticated Protected Route Redirection (Zero-Trust Enforcement)', async ({ page }) => {
    // Attempting to access protected assets without session must redirect to /login
    await page.goto('/assets');
    await expect(page).toHaveURL(/\/login/);

    // Attempting to access protected audit trail without session must redirect to /login
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/login/);

    // Attempting to access protected positions config without session must redirect to /login
    await page.goto('/positions');
    await expect(page).toHaveURL(/\/login/);

    // Attempting to access dashboard route directly without session must redirect to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('3. Device Registration & Hardware Detection Flow', async ({ page }) => {
    await page.goto('/register-device');

    // Page loads successfully
    await expect(page.locator('body')).toBeVisible();

    // Verify enrollment input exists
    const codeInput = page.locator('input[placeholder*="SEC-"], input[placeholder*="code"], input[type="text"]').first();
    await expect(codeInput).toBeVisible();

    // Verify submission button exists
    const verifyButton = page.locator('button:has-text("Verify"), button:has-text("Continue"), button:has-text("Submit")').first();
    await expect(verifyButton).toBeVisible();
  });

  test('4. Mobile Viewport Responsive Navigation Rendering', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=SecureMax').first()).toBeVisible();
  });

});
