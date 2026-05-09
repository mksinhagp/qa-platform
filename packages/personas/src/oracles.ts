import { AssistiveTech, MotorProfile, type Persona } from '@qa-platform/shared-types';

// Target size thresholds (WCAG 2.5.5)
export const MIN_TARGET_PX = 44;

// Flesch-Kincaid grade threshold for low-comprehension personas
export const MAX_FK_GRADE_SIMPLE = 7;

// Time budget multiplier — flow taking > 2x expected time = friction, not failure
export const FRICTION_TIME_MULTIPLIER = 2.0;

/**
 * Returns true if this persona requires accessibility-tree / keyboard-only navigation
 */
export function requiresKeyboardOnly(persona: Persona): boolean {
  return persona.assistive_tech === AssistiveTech.SCREEN_READER;
}

/**
 * Returns true if this persona requires minimum 44×44 CSS px tap targets
 */
export function requiresLargeTargets(persona: Persona): boolean {
  return (
    persona.assistive_tech === AssistiveTech.ZOOM_400 ||
    persona.motor_profile === MotorProfile.TREMOR ||
    persona.motor_profile === MotorProfile.SINGLE_HANDED
  );
}

/**
 * Returns true if this persona requires simplified copy (grade ≤ 7)
 */
export function requiresSimpleCopy(persona: Persona): boolean {
  return persona.comprehension_grade_level <= 6;
}

/**
 * Calculates expected completion time in ms for a given flow step count.
 * Based on: hesitation per decision + reading time per step.
 */
export function expectedCompletionMs(persona: Persona, stepCount: number): number {
  const readingTimePerStep = (500 / persona.reading_wpm) * 60 * 1000; // avg 500-word page
  return stepCount * (persona.hesitation_ms_per_decision + readingTimePerStep);
}

/**
 * Returns true if actual elapsed time exceeds the friction threshold
 */
export function isFrictionTimeout(persona: Persona, stepCount: number, elapsedMs: number): boolean {
  return elapsedMs > expectedCompletionMs(persona, stepCount) * FRICTION_TIME_MULTIPLIER;
}

/**
 * Returns the abandonment triggers for a persona
 */
export function getAbandonmentTriggers(persona: Persona): string[] {
  return persona.abandons_on;
}

/**
 * Check if a given trigger should cause this persona to abandon
 */
export function wouldAbandon(persona: Persona, trigger: string): boolean {
  return persona.abandons_on.includes(trigger);
}
