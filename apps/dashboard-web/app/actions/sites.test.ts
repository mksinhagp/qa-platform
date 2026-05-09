import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listSites,
  getSite,
  createSite,
  updateSite,
  listSiteEnvironments,
  createSiteEnvironment,
  updateSiteEnvironment,
  listSiteCredentialBindings,
  createSiteCredentialBinding,
  deleteSiteCredentialBinding,
  listPaymentProfileBindings,
  createPaymentProfileBinding,
  deletePaymentProfileBinding,
  listEmailInboxBindings,
  createEmailInboxBinding,
  deleteEmailInboxBinding,
} from './sites';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcWrite: vi.fn(),
}));

vi.mock('@qa-platform/auth', () => ({
  requireOperator: vi.fn(),
}));

// Default auth context returned by requireOperator
const AUTH_CTX = { operatorId: 42, sessionId: 1 };

// ─── Site rows ────────────────────────────────────────────────────────────────

const SITE_ROW = {
  o_id: 1,
  o_name: 'Demo Site',
  o_base_url: 'https://demo.example.com',
  o_description: 'A demo site',
  o_is_active: true,
  o_env_count: '2',
  o_created_date: '2026-05-09T00:00:00Z',
  o_updated_date: '2026-05-09T00:00:00Z',
  o_created_by: '42',
  o_updated_by: '42',
};

const ENV_ROW = {
  o_id: 10,
  o_site_id: 1,
  o_name: 'staging',
  o_base_url: 'https://staging.example.com',
  o_description: null,
  o_is_active: true,
  o_created_date: '2026-05-09T00:00:00Z',
  o_updated_date: '2026-05-09T00:00:00Z',
  o_created_by: '42',
  o_updated_by: '42',
};

// ─── Sites ────────────────────────────────────────────────────────────────────

describe('sites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOperator).mockResolvedValue(AUTH_CTX);
  });

  // ── listSites ──────────────────────────────────────────────────────────────

  describe('listSites', () => {
    it('returns enriched site list with env_count', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([SITE_ROW]);

      const result = await listSites();

      expect(result.success).toBe(true);
      expect(result.sites).toHaveLength(1);
      expect(result.sites![0].name).toBe('Demo Site');
      expect(result.sites![0].env_count).toBe(2);
      expect(invokeProc).toHaveBeenCalledWith('sp_sites_list_with_counts', { i_is_active: null });
    });

    it('passes activeOnly filter', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([]);
      await listSites(true);
      expect(invokeProc).toHaveBeenCalledWith('sp_sites_list_with_counts', { i_is_active: true });
    });

    it('returns error on exception', async () => {
      vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB error'));
      const result = await listSites();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ── getSite ────────────────────────────────────────────────────────────────

  describe('getSite', () => {
    it('returns a site by id', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([SITE_ROW]);
      const result = await getSite(1);
      expect(result.success).toBe(true);
      expect(result.site!.id).toBe(1);
      expect(invokeProc).toHaveBeenCalledWith('sp_sites_get_by_id', { i_id: 1 });
    });

    it('returns not-found when proc returns no rows', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([]);
      const result = await getSite(999);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  // ── createSite ─────────────────────────────────────────────────────────────

  describe('createSite', () => {
    it('creates a site and returns the row', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([SITE_ROW]);

      const result = await createSite({ name: 'Demo Site', base_url: 'https://demo.example.com', description: 'A demo site' });

      expect(result.success).toBe(true);
      expect(result.site!.name).toBe('Demo Site');
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_sites_insert', expect.objectContaining({
        i_name: 'Demo Site',
        i_base_url: 'https://demo.example.com',
        i_created_by: '42',
      }));
    });

    it('returns error when proc returns empty', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([]);
      const result = await createSite({ name: 'X', base_url: 'https://x.com' });
      expect(result.success).toBe(false);
    });
  });

  // ── updateSite ─────────────────────────────────────────────────────────────

  describe('updateSite', () => {
    it('updates a site', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ ...SITE_ROW, o_name: 'Updated' }]);
      const result = await updateSite({ id: 1, name: 'Updated', base_url: 'https://demo.example.com', is_active: true });
      expect(result.success).toBe(true);
      expect(result.site!.name).toBe('Updated');
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_sites_update', expect.objectContaining({
        i_id: 1,
        i_updated_by: '42',
      }));
    });

    it('returns error when site not found', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([]);
      const result = await updateSite({ id: 999, name: 'X', base_url: 'https://x.com', is_active: true });
      expect(result.success).toBe(false);
    });
  });

  // ── Site Environments ──────────────────────────────────────────────────────

  describe('listSiteEnvironments', () => {
    it('lists environments for a site', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([ENV_ROW]);
      const result = await listSiteEnvironments(1);
      expect(result.success).toBe(true);
      expect(result.environments![0].name).toBe('staging');
      expect(invokeProc).toHaveBeenCalledWith('sp_site_environments_list', { i_site_id: 1, i_is_active: null });
    });
  });

  describe('createSiteEnvironment', () => {
    it('creates an environment', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([ENV_ROW]);
      const result = await createSiteEnvironment({ site_id: 1, name: 'staging', base_url: 'https://staging.example.com' });
      expect(result.success).toBe(true);
      expect(result.environment!.name).toBe('staging');
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_environments_insert', expect.objectContaining({
        i_site_id: 1,
        i_name: 'staging',
        i_created_by: '42',
      }));
    });

    it('surfaces unique constraint error as friendly message', async () => {
      vi.mocked(invokeProcWrite).mockRejectedValueOnce(new Error('unique constraint violation'));
      const result = await createSiteEnvironment({ site_id: 1, name: 'staging', base_url: 'https://staging.example.com' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already exists/i);
    });
  });

  describe('updateSiteEnvironment', () => {
    it('updates an environment', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ ...ENV_ROW, o_is_active: false }]);
      const result = await updateSiteEnvironment({ id: 10, name: 'staging', base_url: 'https://staging.example.com', is_active: false });
      expect(result.success).toBe(true);
      expect(result.environment!.is_active).toBe(false);
    });

    it('returns error when environment not found', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([]);
      const result = await updateSiteEnvironment({ id: 999, name: 'x', base_url: 'https://x.com', is_active: true });
      expect(result.success).toBe(false);
    });
  });

  // ── Credential Bindings ────────────────────────────────────────────────────

  const CRED_BINDING_ROW = {
    o_id: 100,
    o_site_id: 1,
    o_site_environment_id: 10,
    o_site_env_name: 'staging',
    o_secret_id: 5,
    o_secret_name: 'Admin password',
    o_role_name: 'admin',
    o_description: null,
    o_is_active: true,
  };

  describe('listSiteCredentialBindings', () => {
    it('returns enriched credential bindings', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([CRED_BINDING_ROW]);
      const result = await listSiteCredentialBindings(1);
      expect(result.success).toBe(true);
      expect(result.bindings![0].secret_name).toBe('Admin password');
      expect(result.bindings![0].site_env_name).toBe('staging');
    });
  });

  describe('createSiteCredentialBinding', () => {
    it('creates a credential binding', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 100 }]);
      const result = await createSiteCredentialBinding({
        site_id: 1, site_environment_id: 10, secret_id: 5, role_name: 'admin',
      });
      expect(result.success).toBe(true);
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_credentials_insert', expect.objectContaining({
        i_site_id: 1,
        i_role_name: 'admin',
        i_secret_id: 5,
        i_created_by: '42',
      }));
    });

    it('surfaces duplicate binding as friendly message', async () => {
      vi.mocked(invokeProcWrite).mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
      const result = await createSiteCredentialBinding({
        site_id: 1, site_environment_id: 10, secret_id: 5, role_name: 'admin',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already exists/i);
    });
  });

  describe('deleteSiteCredentialBinding', () => {
    it('deletes a credential binding', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_deleted_id: 100 }]);
      const result = await deleteSiteCredentialBinding(100);
      expect(result.success).toBe(true);
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_credentials_delete', { i_id: 100 });
    });
  });

  // ── Payment Profile Bindings ───────────────────────────────────────────────

  const PAY_BINDING_ROW = {
    o_id: 200,
    o_site_id: 1,
    o_site_environment_id: 10,
    o_site_env_name: 'staging',
    o_payment_profile_id: 7,
    o_payment_profile_name: 'Visa Test Card',
    o_payment_type: 'card',
    o_last_4: '4242',
    o_role_tag: 'registrant',
    o_description: null,
    o_is_active: true,
  };

  describe('listPaymentProfileBindings', () => {
    it('returns payment profile bindings', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([PAY_BINDING_ROW]);
      const result = await listPaymentProfileBindings(1);
      expect(result.success).toBe(true);
      expect(result.bindings![0].payment_profile_name).toBe('Visa Test Card');
      expect(result.bindings![0].last_4).toBe('4242');
    });
  });

  describe('createPaymentProfileBinding', () => {
    it('creates a payment profile binding', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 200 }]);
      const result = await createPaymentProfileBinding({
        site_id: 1, site_environment_id: 10, payment_profile_id: 7, role_tag: 'registrant',
      });
      expect(result.success).toBe(true);
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_env_payment_bindings_insert', expect.objectContaining({
        i_payment_profile_id: 7,
        i_role_tag: 'registrant',
        i_created_by: '42',
      }));
    });
  });

  describe('deletePaymentProfileBinding', () => {
    it('deletes a payment profile binding', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_deleted_id: 200 }]);
      const result = await deletePaymentProfileBinding(200);
      expect(result.success).toBe(true);
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_env_payment_bindings_delete', { i_id: 200 });
    });
  });

  // ── Email Inbox Bindings ───────────────────────────────────────────────────

  const EMAIL_BINDING_ROW = {
    o_id: 300,
    o_site_id: 1,
    o_site_environment_id: 10,
    o_site_env_name: 'staging',
    o_email_inbox_id: 3,
    o_email_inbox_name: 'Test Inbox',
    o_provider: 'gmail',
    o_username: 'test@example.com',
    o_role_tag: 'registrant',
    o_description: null,
    o_is_active: true,
  };

  describe('listEmailInboxBindings', () => {
    it('returns email inbox bindings', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([EMAIL_BINDING_ROW]);
      const result = await listEmailInboxBindings(1);
      expect(result.success).toBe(true);
      expect(result.bindings![0].email_inbox_name).toBe('Test Inbox');
      expect(result.bindings![0].provider).toBe('gmail');
    });
  });

  describe('createEmailInboxBinding', () => {
    it('creates an email inbox binding', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 300 }]);
      const result = await createEmailInboxBinding({
        site_id: 1, site_environment_id: 10, email_inbox_id: 3, role_tag: 'registrant',
      });
      expect(result.success).toBe(true);
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_env_email_bindings_insert', expect.objectContaining({
        i_email_inbox_id: 3,
        i_role_tag: 'registrant',
        i_created_by: '42',
      }));
    });
  });

  describe('deleteEmailInboxBinding', () => {
    it('deletes an email inbox binding', async () => {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_deleted_id: 300 }]);
      const result = await deleteEmailInboxBinding(300);
      expect(result.success).toBe(true);
      expect(invokeProcWrite).toHaveBeenCalledWith('sp_site_env_email_bindings_delete', { i_id: 300 });
    });
  });
});
