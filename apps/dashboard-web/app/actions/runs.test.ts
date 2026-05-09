import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listRuns,
  getRun,
  listRunExecutions,
  createRun,
  updateRunStatus,
  abortRun,
  listPersonaOptions,
  listDeviceProfileOptions,
  listNetworkProfileOptions,
} from './runs';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcWrite: vi.fn(),
}));

vi.mock('@qa-platform/auth', () => ({
  requireCapability: vi.fn(),
}));

const AUTH_CTX = { operatorId: 42, sessionId: 1 };

// ─── Sample rows ─────────────────────────────────────────────────────────────

const RUN_LIST_ROW = {
  o_id: 1,
  o_name: 'Smoke run – staging',
  o_description: null,
  o_site_id: 10,
  o_site_name: 'Demo Site',
  o_site_environment_id: 20,
  o_site_env_name: 'staging',
  o_status: 'draft',
  o_started_by: '42',
  o_started_at: null,
  o_completed_at: null,
  o_total_executions: 0,
  o_successful_executions: 0,
  o_failed_executions: 0,
  o_skipped_executions: 0,
  o_notes: null,
  o_is_pinned: false,
  o_created_date: '2026-05-09T00:00:00Z',
  o_updated_date: '2026-05-09T00:00:00Z',
};

const RUN_DETAIL_ROW = {
  ...RUN_LIST_ROW,
  o_config: JSON.stringify({
    persona_ids: ['confident_desktop'],
    device_profile_ids: [1],
    network_profile_ids: [1],
    browsers: ['chromium'],
    flow_names: ['registration'],
  }),
  o_created_by: '42',
  o_updated_by: '42',
};

const EXECUTION_ROW = {
  o_id: 100,
  o_run_id: 1,
  o_persona_id: 'confident_desktop',
  o_persona_display_name: 'Alex, 34 – Tech-savvy desktop user',
  o_device_profile_id: 1,
  o_device_profile_name: 'Desktop 1920×1080',
  o_network_profile_id: 1,
  o_network_profile_name: 'Fast (100 Mbps)',
  o_browser: 'chromium',
  o_flow_name: 'registration',
  o_status: 'queued',
  o_started_at: null,
  o_completed_at: null,
  o_friction_score: null,
  o_error_message: null,
  o_artifact_path: null,
  o_created_date: '2026-05-09T00:00:00Z',
  o_updated_date: '2026-05-09T00:00:00Z',
};

const PERSONA_ROW = {
  o_id: 'confident_desktop',
  o_display_name: 'Alex, 34 – Tech-savvy desktop user',
  o_age_band: 'adult',
  o_device_class: 'desktop',
  o_assistive_tech: 'none',
  o_motor_profile: 'normal',
  o_network_profile: 'fast',
  o_typing_wpm: 75,
  o_typing_error_rate: '0.01',
  o_reading_wpm: 250,
  o_comprehension_grade_level: 12,
  o_hesitation_ms_per_decision: 300,
  o_retry_tolerance: 5,
  o_distraction_probability: '0.02',
  o_language_proficiency: 'native',
  o_payment_familiarity: 'high',
  o_abandons_on: [],
  o_description: 'Baseline persona.',
  o_is_system: true,
  o_created_date: '2026-01-01T00:00:00Z',
  o_updated_date: '2026-01-01T00:00:00Z',
  o_created_by: 'system',
  o_updated_by: 'system',
};

const DEVICE_PROFILE_ROW = {
  o_id: 1,
  o_name: 'Desktop 1920×1080',
  o_device_type: 'desktop',
  o_viewport_width: 1920,
  o_viewport_height: 1080,
  o_device_pixel_ratio: '1.0',
  o_user_agent: null,
  o_is_touch: false,
  o_screen_orientation: 'landscape',
  o_description: 'Standard desktop Chrome',
  o_is_system: true,
  o_created_date: '2026-01-01T00:00:00Z',
  o_updated_date: '2026-01-01T00:00:00Z',
  o_created_by: 'system',
  o_updated_by: 'system',
};

const NETWORK_PROFILE_ROW = {
  o_id: 1,
  o_name: 'Fast (100 Mbps)',
  o_download_kbps: 102400,
  o_upload_kbps: 51200,
  o_latency_ms: 5,
  o_packet_loss_percent: '0.00',
  o_description: 'Fast broadband / Wi-Fi connection.',
  o_is_system: true,
  o_created_date: '2026-01-01T00:00:00Z',
  o_updated_date: '2026-01-01T00:00:00Z',
  o_created_by: 'system',
  o_updated_by: 'system',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireCapability).mockResolvedValue(AUTH_CTX);
});

// ─── listRuns ─────────────────────────────────────────────────────────────────

describe('listRuns', () => {
  it('returns mapped run list on success', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([RUN_LIST_ROW]);

    const result = await listRuns();

    expect(result.success).toBe(true);
    expect(result.runs).toHaveLength(1);
    expect(result.runs![0]).toMatchObject({
      id: 1,
      name: 'Smoke run – staging',
      site_name: 'Demo Site',
      site_env_name: 'staging',
      status: 'draft',
      total_executions: 0,
    });
  });

  it('passes siteId and status filters to proc', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    await listRuns(10, 'running');

    expect(invokeProc).toHaveBeenCalledWith('sp_runs_list', expect.objectContaining({
      i_site_id: 10,
      i_status: 'running',
    }));
  });

  it('sanitizes invalid page values before calculating offset', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    await listRuns(undefined, undefined, -1);

    expect(invokeProc).toHaveBeenCalledWith('sp_runs_list', expect.objectContaining({
      i_offset: 0,
    }));
  });

  it('floors fractional positive page values before calculating offset', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    await listRuns(undefined, undefined, 2.7);

    expect(invokeProc).toHaveBeenCalledWith('sp_runs_list', expect.objectContaining({
      i_offset: 100,
    }));
  });

  it('returns error on failure', async () => {
    vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB error'));

    const result = await listRuns();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('enforces run.read capability', async () => {
    vi.mocked(requireCapability).mockRejectedValueOnce(new Error('Forbidden'));

    const result = await listRuns();

    expect(result.success).toBe(false);
  });
});

// ─── getRun ───────────────────────────────────────────────────────────────────

describe('getRun', () => {
  it('returns run detail with parsed config', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([RUN_DETAIL_ROW]);

    const result = await getRun(1);

    expect(result.success).toBe(true);
    expect(result.run?.config.persona_ids).toEqual(['confident_desktop']);
    expect(result.run?.config.browsers).toEqual(['chromium']);
  });

  it('returns error when run not found', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    const result = await getRun(999);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles DB error gracefully', async () => {
    vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB error'));

    const result = await getRun(1);

    expect(result.success).toBe(false);
  });
});

// ─── listRunExecutions ────────────────────────────────────────────────────────

describe('listRunExecutions', () => {
  it('returns enriched execution list', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([EXECUTION_ROW]);

    const result = await listRunExecutions(1);

    expect(result.success).toBe(true);
    expect(result.executions).toHaveLength(1);
    expect(result.executions![0]).toMatchObject({
      id: 100,
      persona_id: 'confident_desktop',
      persona_display_name: 'Alex, 34 – Tech-savvy desktop user',
      browser: 'chromium',
      flow_name: 'registration',
      status: 'queued',
      friction_score: null,
    });
  });

  it('parses numeric friction score', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([
      { ...EXECUTION_ROW, o_friction_score: '42.50' },
    ]);

    const result = await listRunExecutions(1);

    expect(result.executions![0].friction_score).toBe(42.5);
  });

  it('returns error on failure', async () => {
    vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB error'));

    const result = await listRunExecutions(1);

    expect(result.success).toBe(false);
  });
});

// ─── createRun ────────────────────────────────────────────────────────────────

describe('createRun', () => {
  const VALID_DATA = {
    site_id: 10,
    site_environment_id: 20,
    name: 'Smoke run',
    persona_ids: ['confident_desktop', 'average_mobile'],
    device_profile_ids: [1],
    network_profile_ids: [1],
    browsers: ['chromium' as const],
    flow_names: ['registration'],
  };

  it('creates run and returns runId', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 5, o_status: 'draft' }]);

    const result = await createRun(VALID_DATA);

    expect(result.success).toBe(true);
    expect(result.runId).toBe(5);
    expect(invokeProcWrite).toHaveBeenCalledWith('sp_runs_insert', expect.objectContaining({
      i_site_id: 10,
      i_site_environment_id: 20,
      i_name: 'Smoke run',
      i_created_by: '42',
    }));
  });

  it('stores config as JSON string', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 5, o_status: 'draft' }]);

    await createRun(VALID_DATA);

    const call = vi.mocked(invokeProcWrite).mock.calls[0];
    const params = call[1] as Record<string, unknown>;
    const config = JSON.parse(params.i_config as string);
    expect(config.persona_ids).toEqual(['confident_desktop', 'average_mobile']);
    expect(config.browsers).toEqual(['chromium']);
  });

  it('returns fieldErrors for invalid input', async () => {
    const result = await createRun({
      site_id: 0, // invalid
      site_environment_id: 20,
      name: '',
      persona_ids: [],
      device_profile_ids: [1],
      network_profile_ids: [1],
      browsers: ['chromium'],
      flow_names: ['registration'],
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(result.fieldErrors!['site_id']).toBeTruthy();
  });

  it('returns error on DB failure', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(new Error('DB error'));

    const result = await createRun(VALID_DATA);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── updateRunStatus ──────────────────────────────────────────────────────────

describe('updateRunStatus', () => {
  it('calls sp_runs_update_status with correct args', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 1, o_status: 'running' }]);

    const result = await updateRunStatus(1, 'running');

    expect(result.success).toBe(true);
    expect(invokeProcWrite).toHaveBeenCalledWith('sp_runs_update_status', expect.objectContaining({
      i_id: 1,
      i_status: 'running',
    }));
  });

  it('returns error on failure', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(new Error('DB error'));

    const result = await updateRunStatus(1, 'running');

    expect(result.success).toBe(false);
  });
});

// ─── abortRun ─────────────────────────────────────────────────────────────────

describe('abortRun', () => {
  it('calls sp_runs_update_status with aborted status', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([{ o_id: 1, o_status: 'aborted' }]);

    const result = await abortRun(1);

    expect(result.success).toBe(true);
    expect(invokeProcWrite).toHaveBeenCalledWith('sp_runs_update_status', expect.objectContaining({
      i_id: 1,
      i_status: 'aborted',
    }));
  });
});

// ─── listPersonaOptions ───────────────────────────────────────────────────────

describe('listPersonaOptions', () => {
  it('returns persona options list', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([PERSONA_ROW]);

    const result = await listPersonaOptions();

    expect(result.success).toBe(true);
    expect(result.personas).toHaveLength(1);
    expect(result.personas![0]).toMatchObject({
      id: 'confident_desktop',
      display_name: 'Alex, 34 – Tech-savvy desktop user',
      age_band: 'adult',
      device_class: 'desktop',
    });
  });

  it('enforces run.execute capability', async () => {
    vi.mocked(requireCapability).mockRejectedValueOnce(new Error('Forbidden'));

    const result = await listPersonaOptions();

    expect(result.success).toBe(false);
  });
});

// ─── listDeviceProfileOptions ─────────────────────────────────────────────────

describe('listDeviceProfileOptions', () => {
  it('returns device profile list', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([DEVICE_PROFILE_ROW]);

    const result = await listDeviceProfileOptions();

    expect(result.success).toBe(true);
    expect(result.profiles![0]).toMatchObject({
      id: 1,
      name: 'Desktop 1920×1080',
      device_type: 'desktop',
      viewport_width: 1920,
    });
  });
});

// ─── listNetworkProfileOptions ────────────────────────────────────────────────

describe('listNetworkProfileOptions', () => {
  it('returns network profile list', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([NETWORK_PROFILE_ROW]);

    const result = await listNetworkProfileOptions();

    expect(result.success).toBe(true);
    expect(result.profiles![0]).toMatchObject({
      id: 1,
      name: 'Fast (100 Mbps)',
      download_kbps: 102400,
      latency_ms: 5,
    });
  });

  it('returns error on DB failure', async () => {
    vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB error'));

    const result = await listNetworkProfileOptions();

    expect(result.success).toBe(false);
  });
});
