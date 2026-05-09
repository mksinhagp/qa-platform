import { describe, expect, it, vi } from 'vitest';
import type { Browser, BrowserContext } from '@playwright/test';
import {
  AgeBand,
  AssistiveTech,
  DeviceClass,
  LanguageProficiency,
  MotorProfile,
  NetworkProfileType,
  PaymentFamiliarity,
  type Persona,
} from '@qa-platform/shared-types';
import { createPersonaContext } from './context';

const PERSONA: Persona = {
  id: 'slow-mobile',
  display_name: 'Slow Mobile',
  age_band: AgeBand.ADULT,
  device_class: DeviceClass.MOBILE,
  network_profile: NetworkProfileType.SLOW_3G,
  typing_wpm: 40,
  typing_error_rate: 0.01,
  reading_wpm: 200,
  comprehension_grade_level: 10,
  hesitation_ms_per_decision: 500,
  retry_tolerance: 3,
  distraction_probability: 0,
  assistive_tech: AssistiveTech.NONE,
  motor_profile: MotorProfile.NORMAL,
  language_proficiency: LanguageProficiency.NATIVE,
  payment_familiarity: PaymentFamiliarity.HIGH,
  abandons_on: [],
  created_date: new Date('2026-01-01T00:00:00Z'),
  updated_date: new Date('2026-01-01T00:00:00Z'),
  created_by: 'test',
  updated_by: 'test',
};

describe('createPersonaContext', () => {
  it('uses context-level route throttling instead of configuring a temporary CDP page', async () => {
    const route = vi.fn();
    const newPage = vi.fn();
    const context = {
      route,
      newPage,
      close: vi.fn(),
    } as unknown as BrowserContext;
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
    } as unknown as Browser;

    const created = await createPersonaContext(browser, { persona: PERSONA });

    expect(created).toBe(context);
    expect(newPage).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledWith('**/*', expect.any(Function));
  });
});
