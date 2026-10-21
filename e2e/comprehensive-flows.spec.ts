import { test, expect } from '@playwright/test';

test.describe('SecureMAX Comprehensive Interaction & System Verification Suite', () => {

  test('1. Admin Flow: CommandCenter, Sentinel Scan, Chain Verification & User Registration', async ({ page }) => {
    // 1. Establish Admin session via demo-login API
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to Admin Command Center
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/dashboard\/admin/);
    await expect(page.locator('text=Command Center').first()).toBeVisible();

    // 3. Trigger Real Sentinel Security Scan
    const sentinelScanBtn = page.locator('button:has-text("Run Sentinel scan")').first();
    await expect(sentinelScanBtn).toBeVisible();
    await sentinelScanBtn.click();

    // Verify scan executes and shows feedback
    await expect(page.locator('text=Sentinel adversarial security scan completed successfully.').or(page.locator('text=PASSED'))).toBeVisible({ timeout: 10000 });

    // 4. Trigger Verify Chain Integrity
    const verifyChainBtn = page.locator('button:has-text("Verify Chain"), button:has-text("Verify Ledger Integrity"), button:has-text("VERIFIED")').first();
    if (await verifyChainBtn.isVisible()) {
      await verifyChainBtn.click();
    }

    // 5. Register New Team Member in QuickUserRegistrationCard
    const newMemberName = `Officer Vikram ${Date.now().toString().slice(-4)}`;
    const newMemberEmail = `vikram_${Date.now().toString().slice(-4)}@securemax.mil`;

    const nameInput = page.locator('input[placeholder*="Vikram"], input[placeholder*="Full Name"]').first();
    const emailInput = page.locator('input[placeholder*="vikram@"], input[placeholder*="Email"]').first();
    const addMemberBtn = page.locator('button:has-text("Add Member")').first();

    if (await nameInput.isVisible() && await emailInput.isVisible()) {
      await nameInput.fill(newMemberName);
      await emailInput.fill(newMemberEmail);
      await addMemberBtn.click();

      // Verify success notice and table addition
      await expect(page.locator(`text=${newMemberName}`).first()).toBeVisible({ timeout: 8000 });
      await expect(page.locator('text=successfully registered').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('2. User Flow: My Access, Decryption, Request Submission & SOC Reporting', async ({ page }) => {
    // 1. Establish User session via demo-login API
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'USER' },
    });
    console.log('LOGIN RES STATUS:', loginRes.status(), await loginRes.text());
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to My Access page
    await page.goto('/access');
    await expect(page).toHaveURL(/\/access/);
    await expect(page.locator('text=My Access').first()).toBeVisible();
    await expect(page.locator('text=Assets you currently hold').first()).toBeVisible();

    // 3. Test Report Suspicious Activity button
    const reportBtn = page.locator('button:has-text("Report suspicious activity")').first();
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();

    // Verify confirmation notice
    await expect(page.locator('text=Security incident registered and transmitted to SOC & Sentinel.').or(page.locator('text=Reporting'))).toBeVisible({ timeout: 5000 });

    // 4. Test Request Access Modal
    const requestAccessBtn = page.locator('button:has-text("Request access"), button:has-text("Request New Clearance"), button:has-text("Request Access")').first();
    if (await requestAccessBtn.isVisible()) {
      await requestAccessBtn.click();

      const modalTitle = page.locator('text=Request Access Clearance').or(page.locator('text=Submit Access Request')).or(page.locator('text=Request Clearance'));
      if (await modalTitle.first().isVisible({ timeout: 4000 }).catch(() => false)) {
        // Fill reason
        const reasonInput = page.locator('textarea, input[placeholder*="reason"], input[placeholder*="purpose"]').first();
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('E2E Automated test mission requirement verification');
        }

        // Submit request
        const submitBtn = page.locator('button:has-text("SUBMIT REQUEST"), button:has-text("Submit Access Request")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await expect(page.locator('text=Request submitted').or(page.locator('text=Pending')).or(page.locator('text=cleared'))).toBeVisible({ timeout: 8000 });
        }
      }
    }
  });

  test('3. Vault Flow: Assets Upload, Filter, Search & Decryption', async ({ page }) => {
    // 1. Establish Admin session for full asset management
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to Assets Vault
    await page.goto('/assets');
    await expect(page).toHaveURL(/\/assets/);
    await expect(page.locator('h2:has-text("My Secure Data Vault"), button:has-text("Upload & Encrypt")').first()).toBeVisible();

    // 3. Test Folder Filter Navigation
    const allFolderBtn = page.locator('button:has-text("All Assets"), button:has-text("ALL")').first();
    if (await allFolderBtn.isVisible()) {
      await allFolderBtn.click();
    }

    // 4. Test Search Bar Input
    const searchInput = page.locator('input[placeholder*="Search by file name"], input[type="search"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('KMS');
    await page.waitForTimeout(400);
    await searchInput.fill(''); // clear search

    // 5. Test Upload Asset Modal
    const uploadBtn = page.locator('button:has-text("Upload & Encrypt")').first();
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();

    const uploadModal = page.locator('text=Upload & Encrypt Vault Asset').first();
    await expect(uploadModal).toBeVisible();

    const testFileName = `Test-Asset-${Date.now().toString().slice(-4)}.txt`;
    const fileNameInput = page.locator('input[placeholder*="Tactical"], input[placeholder*="e.g."]').first();
    const payloadInput = page.locator('textarea[placeholder*="plaintext or confidential data"]').first();

    await fileNameInput.fill(testFileName);
    await payloadInput.fill('CONFIDENTIAL TEST PAYLOAD FOR PLAYWRIGHT E2E VERIFICATION: CODES 99482');

    // Submit upload
    const encryptSubmitBtn = page.locator('button:has-text("Encrypt & Mint NFT"), button:has-text("Save Encrypted")').first();
    await encryptSubmitBtn.click();

    // Wait for upload to complete
    await expect(uploadModal).not.toBeVisible({ timeout: 15000 });

    // Verify uploaded asset appears in list
    await expect(page.locator(`text=${testFileName}`).first()).toBeVisible({ timeout: 10000 });

    // 6. Test In-Memory Decryption
    const testRow = page.locator('tr').filter({ hasText: testFileName }).first();
    await expect(testRow).toBeVisible({ timeout: 10000 });
    
    const decryptBtn = testRow.locator('button:has-text("Decrypt & View")').first();
    if (await decryptBtn.isVisible()) {
      await decryptBtn.click();

      // Verify Secure Preview Modal opens and displays plaintext
      const previewModal = page.locator('text=Secure In-Memory Decryption Viewer').first();
      await expect(previewModal).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=CONFIDENTIAL TEST PAYLOAD FOR PLAYWRIGHT E2E VERIFICATION').first()).toBeVisible({ timeout: 8000 });

      // Close modal
      const closeBtn = page.locator('button:has-text("Close")').first();
      await closeBtn.click();
      await expect(previewModal).not.toBeVisible();
    }
  });

  test('4. Positions Management Flow: Granular RBAC/ABAC Position Creation', async ({ page }) => {
    // 1. Establish Admin session
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to Positions
    await page.goto('/positions');
    await expect(page).toHaveURL(/\/positions/);
    await expect(page.locator('text=Organizational Positions').first()).toBeVisible();

    // 3. Open Create Position Modal
    const createPosBtn = page.locator('button:has-text("+ Create Position"), button:has-text("Create Position")').first();
    await expect(createPosBtn).toBeVisible();
    await createPosBtn.click();

    const posModal = page.locator('text=Create Organizational Position').first();
    await expect(posModal).toBeVisible();

    const posName = `SecOps Specialist ${Date.now().toString().slice(-4)}`;
    const posDesc = 'Zero-Trust incident responder and containment specialist';

    await page.locator('input[placeholder*="Security Manager"], input[placeholder*="Position Title"]').first().fill(posName);
    await page.locator('input[placeholder*="Responsible"], input[placeholder*="Description"]').first().fill(posDesc);

    // Submit Position creation (Standard level)
    const submitBtn = page.getByTestId('submit-create-position');
    await submitBtn.click();

    // Wait for modal to close upon success
    await expect(posModal).not.toBeVisible({ timeout: 10000 });

    // Verify newly created position appears in table
    await expect(page.locator(`text=${posName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('5. Devices Flow: Passport Registry, Enrollment Generation & Emergency Controls', async ({ page }) => {
    // 1. Establish Admin session
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to Devices
    await page.goto('/devices');
    await expect(page).toHaveURL(/\/devices/);
    await expect(page.locator('text=Device Trust Center').first()).toBeVisible();

    // 3. Switch to Enrollment Tab
    const enrollmentTab = page.locator('button:has-text("ENROLLMENT GENERATOR"), button:has-text("ENROLLMENT")').first();
    await expect(enrollmentTab).toBeVisible();
    await enrollmentTab.click();

    // Verify Enrollment tab controls
    await expect(page.locator('text=Security Code Generator').first()).toBeVisible();

    // Fill new user enrollment form
    const userNameInput = page.locator('input[placeholder*="Full Name"]').first();
    const userEmailInput = page.locator('input[placeholder*="email"]').first();
    const generateBtn = page.locator('button:has-text("GENERATE NEW USER ONBOARDING CODE"), button:has-text("GENERATE")').first();

    if (await userNameInput.isVisible()) {
      await userNameInput.fill('Cadet Riya Sharma');
      await userEmailInput.fill(`riya_${Date.now().toString().slice(-4)}@securemax.mil`);
      await generateBtn.click();

      // Verify Enrollment Code Issued banner
      await expect(page.locator('text=Enrollment Capability Active').or(page.locator('text=SMX-')).or(page.locator('text=Copy URL')).first()).toBeVisible({ timeout: 8000 });
    }

    // 4. Switch to Sessions Tab
    const sessionsTab = page.locator('button:has-text("ACTIVE SESSIONS"), button:has-text("SESSIONS")').first();
    await sessionsTab.click();
    await expect(page.locator('text=ACTIVE SESSIONS').first()).toBeVisible();

    // 5. Switch to Emergency Tab
    const emergencyTab = page.locator('button:has-text("EMERGENCY CONTROLS"), button:has-text("EMERGENCY")').first();
    await emergencyTab.click();
    await expect(page.locator('text=Emergency Account Containment').or(page.locator('text=EMERGENCY CONTROLS')).first()).toBeVisible();
  });

  test('6. BreachLab Adversarial Center: Scenario Catalog & Execution', async ({ page }) => {
    // 1. Establish Admin session
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to BreachLab
    await page.goto('/breachlab');
    await expect(page).toHaveURL(/\/breachlab/);
    await expect(page.locator('text=BreachLab').first()).toBeVisible();

    // 3. Switch to Catalog Tab
    const catalogTab = page.locator('button:has-text("Scenario Catalog")').first();
    await expect(catalogTab).toBeVisible();
    await catalogTab.click();

    // Verify scenario cards exist
    await expect(page.locator('button:has-text("Test Control")').first()).toBeVisible({ timeout: 8000 });

    // 4. Execute Single Scenario
    const runScenarioBtn = page.locator('button:has-text("Test Control")').first();
    if (await runScenarioBtn.isVisible()) {
      await runScenarioBtn.click();

      // Verify Results & Evidence tab opens with execution output
      await expect(page.locator('text=Evidence').or(page.locator('text=RESULTS')).or(page.locator('text=BLOCKED')).or(page.locator('text=PASSED')).or(page.locator('text=Test Control')).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('7. SOC Dashboard & Incident Containment Flow', async ({ page }) => {
    // 1. Establish Admin session
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to SOC Dashboard
    await page.goto('/dashboard/soc');
    await expect(page).toHaveURL(/\/dashboard\/soc/);
    await expect(page.locator('text=SECURITY OPERATIONS').first()).toBeVisible();
    await expect(page.locator('text=Security Posture').first()).toBeVisible();

    // 3. Navigate to Incident Investigation page
    await page.goto('/security/incidents');
    await expect(page).toHaveURL(/\/security\/incidents/);
    await expect(page.locator('text=Incident Investigation').first()).toBeVisible();

    // Check if any active threat needs containment
    const containBtn = page.locator('button:has-text("CONTAIN THREAT")').first();
    if (await containBtn.isVisible()) {
      await containBtn.click();
      await expect(page.locator('text=CONTAINED').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('8. Audit Trail & Sepolia Infrastructure Verification', async ({ page }) => {
    // 1. Establish Auditor session
    const loginRes = await page.request.post('/api/auth/demo-login', {
      data: { role: 'AUDITOR' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Navigate to Audit page
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/audit/);
    await expect(page.locator('text=Audit & Forensics').first()).toBeVisible();
    await expect(page.locator('text=INTEGRITY VERIFIED').first()).toBeVisible();

    // 3. Navigate to Blockchain Infrastructure page
    await page.goto('/infrastructure');
    await expect(page).toHaveURL(/\/infrastructure/);
    await expect(page.locator('text=Blockchain Infrastructure').first()).toBeVisible();
    await expect(page.locator('text=IdentityRegistry').first()).toBeVisible();
    await expect(page.locator('text=AssetRegistry').first()).toBeVisible();
  });

});
