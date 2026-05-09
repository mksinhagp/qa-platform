import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_OPERATOR = {
  login: 'e2e-test-operator',
  password: 'TestPassword123!',
  full_name: 'E2E Test Operator',
  email: 'e2e@test.com',
};

const MASTER_PASSWORD = 'MasterVaultPassword123!';

// API base URL for test setup
const API_BASE = 'http://localhost:3000';

// Helper function to create operator via API
async function createTestOperator() {
  try {
    // Use direct DB call via API endpoint or server action
    const response = await fetch(`${API_BASE}/api/test/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createOperator',
        operator: TEST_OPERATOR
      }),
    });
    if (!response.ok) {
      console.log('Operator may already exist, continuing...');
    } else {
      const result = await response.json();
      console.log('Test operator created:', result);
    }
  } catch (error) {
    console.error('Failed to create test operator:', error);
    // Continue anyway - operator may already exist
  }
}

// Helper to reset vault state
async function resetVaultState() {
  try {
    await fetch(`${API_BASE}/api/test/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetVault' }),
    });
  } catch (error) {
    console.error('Failed to reset vault state:', error);
  }
}

test.describe('Smoke Tests - Vault and Auth Flow', () => {
  test.setTimeout(60000);

  test('complete vault lifecycle: bootstrap → login → unlock → create credential → lock → access denied', async ({ page }) => {
    // Step 1: Navigate to vault bootstrap page
    await page.goto('/dashboard/settings/vault/bootstrap');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Bootstrap Vault');
    
    // Step 2: Bootstrap vault with master password
    await page.fill('input[type="password"][placeholder*="password"]', MASTER_PASSWORD);
    await page.fill('input[type="password"][placeholder*="confirm"]', MASTER_PASSWORD);
    await page.click('button:has-text("Bootstrap Vault")');
    
    // Should redirect to dashboard after successful bootstrap
    await expect(page).toHaveURL('/dashboard');
    
    // Step 3: Navigate to login page
    await page.goto('/login');

    // Login with operator credentials
    await page.fill('input#login', TEST_OPERATOR.login);
    await page.fill('input#password', TEST_OPERATOR.password);
    await page.click('button:has-text("Login")');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Step 4: Unlock vault
    await page.goto('/unlock');
    await expect(page.locator('h1')).toContainText('Unlock Vault');

    await page.fill('input#masterPassword', MASTER_PASSWORD);
    await page.click('button:has-text("Unlock")');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify vault is unlocked (vault pill should show "unlocked")
    const vaultPill = page.locator('[data-testid="vault-state-pill"]').first();
    await expect(vaultPill).toContainText('unlocked');
    
    // Step 5: Create a saved credential
    await page.goto('/dashboard/settings/credentials/new');
    await expect(page.locator('h1')).toContainText('New Credential');
    
    // Fill credential form
    await page.fill('input#login', 'test-credential');
    await page.fill('input#password', 'credential-value-123');
    await page.fill('input#confirmPassword', 'credential-value-123');
    await page.fill('input#full_name', 'Test Credential');
    await page.fill('input#email', 'credential@test.com');
    
    // Create credential
    await page.click('button:has-text("Create Credential")');
    
    // Should redirect to credentials list
    await expect(page).toHaveURL('/dashboard/settings/credentials');
    
    // Verify credential appears in list
    await expect(page.locator('text=test-credential')).toBeVisible();
    
    // Step 6: Lock vault
    // Click lock button on vault pill
    await page.locator('[data-testid="lock-vault-button"]').click();

    // Verify vault shows as locked
    await expect(vaultPill).toContainText('locked');
    
    // Step 7: Attempt to reveal credential - should be denied
    // Try to view the credential
    await page.goto('/dashboard/settings/credentials');

    // Click reveal button (eye icon)
    await page.locator('button[title="Reveal"]').first().click();
    
    // Should show error or redirect to unlock page
    // The UI should show an error message
    await expect(page.locator('text=Vault is locked')).toBeVisible();
    
    // Or should redirect to unlock page
    // await expect(page).toHaveURL('/unlock');
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#login', 'invalid-user');
    await page.fill('input#password', 'wrong-password');
    await page.click('button:has-text("Login")');

    // Should show error message
    await expect(page.locator('text=Invalid login or password')).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('vault unlock with wrong password shows error', async ({ page }) => {
    // First bootstrap and login
    await page.goto('/dashboard/settings/vault/bootstrap');
    await page.fill('input[type="password"][placeholder*="password"]', MASTER_PASSWORD);
    await page.fill('input[type="password"][placeholder*="confirm"]', MASTER_PASSWORD);
    await page.click('button:has-text("Bootstrap Vault")');
    
    await page.goto('/login');
    await page.fill('input#login', TEST_OPERATOR.login);
    await page.fill('input#password', TEST_OPERATOR.password);
    await page.click('button:has-text("Login")');

    // Try to unlock with wrong password
    await page.goto('/unlock');
    await page.fill('input#masterPassword', 'wrong-master-password');
    await page.click('button:has-text("Unlock")');
    
    // Should show error
    await expect(page.locator('text=Invalid master password')).toBeVisible();
    
    // Should stay on unlock page
    await expect(page).toHaveURL('/unlock');
  });

  test('audit log shows vault operations', async ({ page }) => {
    // Bootstrap, login, unlock, lock
    await page.goto('/dashboard/settings/vault/bootstrap');
    await page.fill('input[type="password"][placeholder*="password"]', MASTER_PASSWORD);
    await page.fill('input[type="password"][placeholder*="confirm"]', MASTER_PASSWORD);
    await page.click('button:has-text("Bootstrap Vault")');
    
    await page.goto('/login');
    await page.fill('input#login', TEST_OPERATOR.login);
    await page.fill('input#password', TEST_OPERATOR.password);
    await page.click('button:has-text("Login")');

    await page.goto('/unlock');
    await page.fill('input#masterPassword', MASTER_PASSWORD);
    await page.click('button:has-text("Unlock")');
    
    // Navigate to audit log
    await page.goto('/dashboard/audit');
    
    // Apply filter for vault actions
    await page.fill('input#action', 'vault');
    await page.click('button:has-text("Apply Filters")');
    
    // Should see vault.bootstrap and vault.unlock entries
    await expect(page.locator('text=vault.bootstrap')).toBeVisible();
    await expect(page.locator('text=vault.unlock')).toBeVisible();
  });
});

// Setup and teardown
test.beforeAll(async () => {
  // Setup: Create test operator if needed
  console.log('Setting up E2E test environment...');
  await createTestOperator();
});

test.afterAll(async () => {
  // Cleanup: Remove test data
  console.log('Cleaning up E2E test environment...');
  await resetVaultState();
});
