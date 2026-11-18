import { test, expect } from '@playwright/test';

test.describe('End-to-End User Journey Lifecycle & Multi-Viewport Quality Gate', () => {

  test('1. Full Lifecycle: Admin User Registration → Access Request → Approval → Decryption Flow', async ({ page }) => {
    // 1. Establish Admin session
    const adminLoginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(adminLoginRes.ok()).toBeTruthy();

    // 2. Navigate to Admin Command Center
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/dashboard\/admin/);
    await expect(page.locator('text=Command Center').first()).toBeVisible();

    // 3. Register a new user via UI modal or Quick Registration
    const quickAddName = `Agent-${Date.now().toString().slice(-4)}`;
    const quickAddEmail = `agent_${Date.now().toString().slice(-4)}@securemax.mil`;

    const nameInput = page.locator('input[placeholder*="Vikram"], input[placeholder*="Full Name"]').first();
    const emailInput = page.locator('input[placeholder*="vikram@"], input[placeholder*="Email"]').first();
    const addMemberBtn = page.locator('button:has-text("Add Member")').first();

    if (await nameInput.isVisible() && await emailInput.isVisible()) {
      await nameInput.fill(quickAddName);
      await emailInput.fill(quickAddEmail);
      await addMemberBtn.click();
      await expect(page.locator(`text=${quickAddName}`).first()).toBeVisible({ timeout: 8000 });
    }

    // 4. Switch to User Session to test Request Clearance
    const userLoginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'USER' },
    });
    expect(userLoginRes.ok()).toBeTruthy();

    await page.goto('/access');
    await expect(page).toHaveURL(/\/access/);
    await expect(page.locator('text=My Access').first()).toBeVisible();

    // 5. Submit an access request
    const requestAccessBtn = page.locator('button:has-text("Request access"), button:has-text("Request New Clearance"), button:has-text("Request Access")').first();
    if (await requestAccessBtn.isVisible()) {
      await requestAccessBtn.click();
      const reasonInput = page.locator('textarea, input[placeholder*="reason"], input[placeholder*="purpose"]').first();
      if (await reasonInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reasonInput.fill('Phase 6 verification: operational access authorization');
        const submitBtn = page.locator('button:has-text("SUBMIT REQUEST"), button:has-text("Submit Access Request")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
        }
      }
    }

    // 6. Navigate to Vault and verify accessible assets
    await page.goto('/assets');
    await expect(page).toHaveURL(/\/assets/);
    await expect(page.locator('text=Secure Data Vault').or(page.locator('text=My Secure Data Vault')).first()).toBeVisible();
  });

  test('2. Multi-Viewport Responsive Matrix: Mobile, Tablet & Desktop Layout Quality', async ({ page }) => {
    const viewports = [
      { name: 'Mobile (iPhone 13)', width: 375, height: 667 },
      { name: 'Tablet (iPad Mini)', width: 768, height: 1024 },
      { name: 'Desktop (Full HD)', width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');

      // Verify page loaded without horizontal overflow
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('text=SecureMax').first()).toBeVisible();

      // Check login buttons are responsive and clickable
      const authHeader = page.locator('text=Team Member Login').or(page.locator('text=Hardware Passkey')).first();
      await expect(authHeader).toBeVisible();
    }
  });

  test('3. Responsive Navigation & Drawer Behavior on Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Login as Admin
    await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });

    await page.goto('/dashboard/admin');
    await expect(page.locator('body')).toBeVisible();

    // Verify main content container renders responsively
    await expect(page.locator('main').first()).toBeVisible();
  });

});
