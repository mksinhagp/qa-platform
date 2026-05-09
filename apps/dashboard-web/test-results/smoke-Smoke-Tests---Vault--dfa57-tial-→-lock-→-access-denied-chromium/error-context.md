# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Smoke Tests - Vault and Auth Flow >> complete vault lifecycle: bootstrap → login → unlock → create credential → lock → access denied
- Location: e2e/smoke.spec.ts:44:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input[type="password"][placeholder*="confirm"]')

```

```
TypeError: fetch failed
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | // Test data
  4   | const TEST_OPERATOR = {
  5   |   login: 'e2e-test-operator',
  6   |   password: 'TestPassword123!',
  7   |   full_name: 'E2E Test Operator',
  8   |   email: 'e2e@test.com',
  9   | };
  10  | 
  11  | const MASTER_PASSWORD = 'MasterVaultPassword123!';
  12  | 
  13  | // API base URL for test setup
  14  | const API_BASE = 'http://localhost:3000';
  15  | 
  16  | // Helper function to create operator via API
  17  | async function createTestOperator() {
  18  |   // Use direct DB call via API endpoint or server action
  19  |   const response = await fetch(`${API_BASE}/api/test/setup`, {
  20  |     method: 'POST',
  21  |     headers: { 'Content-Type': 'application/json' },
  22  |     body: JSON.stringify({
  23  |       action: 'createOperator',
  24  |       operator: TEST_OPERATOR
  25  |     }),
  26  |   });
  27  |   if (!response.ok) {
  28  |     console.log('Operator may already exist, continuing...');
  29  |   }
  30  | }
  31  | 
  32  | // Helper to reset vault state
  33  | async function resetVaultState() {
> 34  |   await fetch(`${API_BASE}/api/test/setup`, {
      |   ^ TypeError: fetch failed
  35  |     method: 'POST',
  36  |     headers: { 'Content-Type': 'application/json' },
  37  |     body: JSON.stringify({ action: 'resetVault' }),
  38  |   });
  39  | }
  40  | 
  41  | test.describe('Smoke Tests - Vault and Auth Flow', () => {
  42  |   test.setTimeout(60000);
  43  | 
  44  |   test('complete vault lifecycle: bootstrap → login → unlock → create credential → lock → access denied', async ({ page }) => {
  45  |     // Step 1: Navigate to vault bootstrap page
  46  |     await page.goto('/dashboard/settings/vault/bootstrap');
  47  |     
  48  |     // Wait for page to load
  49  |     await expect(page.locator('h1')).toContainText('Bootstrap Vault');
  50  |     
  51  |     // Step 2: Bootstrap vault with master password
  52  |     await page.fill('input[type="password"][placeholder*="password"]', MASTER_PASSWORD);
  53  |     await page.fill('input[type="password"][placeholder*="confirm"]', MASTER_PASSWORD);
  54  |     await page.click('button:has-text("Bootstrap Vault")');
  55  |     
  56  |     // Should redirect to dashboard after successful bootstrap
  57  |     await expect(page).toHaveURL('/dashboard');
  58  |     
  59  |     // Step 3: Navigate to login page
  60  |     await page.goto('/login');
  61  | 
  62  |     // Login with operator credentials
  63  |     await page.fill('input#login', TEST_OPERATOR.login);
  64  |     await page.fill('input#password', TEST_OPERATOR.password);
  65  |     await page.click('button:has-text("Login")');
  66  |     
  67  |     // Should redirect to dashboard
  68  |     await expect(page).toHaveURL('/dashboard');
  69  |     
  70  |     // Step 4: Unlock vault
  71  |     await page.goto('/unlock');
  72  |     await expect(page.locator('h1')).toContainText('Unlock Vault');
  73  | 
  74  |     await page.fill('input#masterPassword', MASTER_PASSWORD);
  75  |     await page.click('button:has-text("Unlock")');
  76  |     
  77  |     // Should redirect to dashboard
  78  |     await expect(page).toHaveURL('/dashboard');
  79  |     
  80  |     // Verify vault is unlocked (vault pill should show "unlocked")
  81  |     const vaultPill = page.locator('[data-testid="vault-state-pill"]').first();
  82  |     await expect(vaultPill).toContainText('unlocked');
  83  |     
  84  |     // Step 5: Create a saved credential
  85  |     await page.goto('/dashboard/settings/credentials/new');
  86  |     await expect(page.locator('h1')).toContainText('New Credential');
  87  |     
  88  |     // Fill credential form
  89  |     await page.fill('input#login', 'test-credential');
  90  |     await page.fill('input#password', 'credential-value-123');
  91  |     await page.fill('input#confirmPassword', 'credential-value-123');
  92  |     await page.fill('input#full_name', 'Test Credential');
  93  |     await page.fill('input#email', 'credential@test.com');
  94  |     
  95  |     // Create credential
  96  |     await page.click('button:has-text("Create Credential")');
  97  |     
  98  |     // Should redirect to credentials list
  99  |     await expect(page).toHaveURL('/dashboard/settings/credentials');
  100 |     
  101 |     // Verify credential appears in list
  102 |     await expect(page.locator('text=test-credential')).toBeVisible();
  103 |     
  104 |     // Step 6: Lock vault
  105 |     // Click lock button on vault pill
  106 |     await page.locator('[data-testid="lock-vault-button"]').click();
  107 | 
  108 |     // Verify vault shows as locked
  109 |     await expect(vaultPill).toContainText('locked');
  110 |     
  111 |     // Step 7: Attempt to reveal credential - should be denied
  112 |     // Try to view the credential
  113 |     await page.goto('/dashboard/settings/credentials');
  114 |     
  115 |     // Click reveal button (eye icon)
  116 |     await page.click('button[title="Reveal"]').first();
  117 |     
  118 |     // Should show error or redirect to unlock page
  119 |     // The UI should show an error message
  120 |     await expect(page.locator('text=Vault is locked')).toBeVisible();
  121 |     
  122 |     // Or should redirect to unlock page
  123 |     // await expect(page).toHaveURL('/unlock');
  124 |   });
  125 | 
  126 |   test('login with invalid credentials shows error', async ({ page }) => {
  127 |     await page.goto('/login');
  128 | 
  129 |     await page.fill('input#login', 'invalid-user');
  130 |     await page.fill('input#password', 'wrong-password');
  131 |     await page.click('button:has-text("Login")');
  132 | 
  133 |     // Should show error message
  134 |     await expect(page.locator('text=Invalid login or password')).toBeVisible();
```