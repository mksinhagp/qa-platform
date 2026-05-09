import type { Page } from '@playwright/test';
import type { Persona } from '@qa-platform/shared-types';
import { AssistiveTech, MotorProfile } from '@qa-platform/shared-types';

export interface AccessibilityViolation {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element?: string;
  description: string;
}

export interface AccessibilityResult {
  passed: boolean;
  violations: AccessibilityViolation[];
  warnings: AccessibilityViolation[];
}

// Minimum tap target size per WCAG 2.5.5 (pixels)
const MIN_TARGET_PX = 44;

// Simplified Flesch-Kincaid grade calculation
// FK Grade = 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  const vowelGroups = word.match(/[aeiouy]+/g) ?? [];
  let count = vowelGroups.length;
  if (word.endsWith('e')) count--;
  return Math.max(1, count);
}

export function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
}

/**
 * Checks that all interactive elements have accessible labels.
 * Used for screen_reader_user persona.
 */
export async function checkAccessibleLabels(page: Page): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  // Check inputs, selects, textareas for labels
  const formControls = await page.locator('input, select, textarea').all();
  for (const control of formControls) {
    const type = await control.getAttribute('type');
    if (type === 'hidden' || type === 'submit' || type === 'button') continue;

    const id = await control.getAttribute('id');
    const ariaLabel = await control.getAttribute('aria-label');
    const ariaLabelledby = await control.getAttribute('aria-labelledby');

    let hasLabel = !!(ariaLabel || ariaLabelledby);
    if (!hasLabel && id) {
      const label = await page.locator(`label[for="${id}"]`).count();
      hasLabel = label > 0;
    }

    if (!hasLabel) {
      const selector = id ? `#${id}` : (await control.getAttribute('name') ?? 'unknown');
      violations.push({
        rule: 'label-missing',
        severity: 'critical',
        element: selector,
        description: `Form control missing accessible label: ${selector}`,
      });
    }
  }

  // Check buttons for accessible text
  const buttons = await page.locator('button, [role="button"]').all();
  for (const btn of buttons) {
    const text = (await btn.textContent() ?? '').trim();
    const ariaLabel = await btn.getAttribute('aria-label');
    const title = await btn.getAttribute('title');
    if (!text && !ariaLabel && !title) {
      violations.push({
        rule: 'button-name-missing',
        severity: 'serious',
        description: 'Button has no accessible name (text, aria-label, or title)',
      });
    }
  }

  return violations;
}

/**
 * Checks focus order matches visual DOM order for keyboard navigation.
 */
export async function checkFocusOrder(page: Page): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  // Get all focusable elements in DOM order
  const focusable = await page.locator(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ).all();

  let prevTabIndex = -Infinity;
  for (const el of focusable) {
    const tabIndexAttr = await el.getAttribute('tabindex');
    const tabIndex = tabIndexAttr !== null ? parseInt(tabIndexAttr, 10) : 0;

    // tabindex > 0 overrides natural order and is a best-practice violation
    if (tabIndex > 0 && tabIndex < prevTabIndex) {
      violations.push({
        rule: 'focus-order-tabindex',
        severity: 'moderate',
        description: `Element has tabindex="${tabIndex}" which may disrupt natural focus order`,
      });
    }
    prevTabIndex = tabIndex;
  }

  return violations;
}

/**
 * Checks that all interactive elements meet the minimum tap target size.
 * Required for motor_impaired_tremor and elderly_first_time personas.
 */
export async function checkTapTargets(page: Page): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  const interactive = await page.locator(
    'button, a, input[type="submit"], input[type="button"], [role="button"], [role="link"]'
  ).all();

  for (const el of interactive) {
    const box = await el.boundingBox();
    if (!box) continue;

    if (box.width < MIN_TARGET_PX || box.height < MIN_TARGET_PX) {
      const text = ((await el.textContent()) ?? '').trim().slice(0, 40);
      violations.push({
        rule: 'target-size-min',
        severity: 'serious',
        element: text || 'interactive element',
        description: `Tap target too small: ${Math.round(box.width)}×${Math.round(box.height)}px (min ${MIN_TARGET_PX}×${MIN_TARGET_PX})`,
      });
    }
  }

  return violations;
}

/**
 * Checks copy readability for low-comprehension personas.
 * Scans visible text blocks (headings, labels, CTAs, error messages).
 */
export async function checkReadability(
  page: Page,
  maxGrade: number,
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  const textSelectors = ['h1', 'h2', 'h3', 'label', 'button', '[role="alert"]', 'p'];
  for (const sel of textSelectors) {
    const elements = await page.locator(sel).all();
    for (const el of elements) {
      const text = ((await el.textContent()) ?? '').trim();
      if (text.split(/\s+/).length < 5) continue; // Skip very short text

      const grade = fleschKincaidGrade(text);
      if (grade > maxGrade) {
        violations.push({
          rule: 'readability-grade',
          severity: 'moderate',
          element: sel,
          description: `Text scored FK grade ${grade.toFixed(1)}, exceeds max ${maxGrade} for this persona: "${text.slice(0, 60)}…"`,
        });
      }
    }
  }

  return violations;
}

/**
 * Runs the full persona-aware accessibility check for a page.
 * The checks run depend on the persona's assistive tech and motor profile.
 */
export async function runPersonaAccessibilityCheck(
  page: Page,
  persona: Persona,
): Promise<AccessibilityResult> {
  const violations: AccessibilityViolation[] = [];
  const warnings: AccessibilityViolation[] = [];

  // Screen reader: check labels and focus order
  if (persona.assistive_tech === AssistiveTech.SCREEN_READER) {
    violations.push(...await checkAccessibleLabels(page));
    warnings.push(...await checkFocusOrder(page));
  }

  // Motor impaired or zoom_400 seniors: check tap targets
  if (
    persona.motor_profile === MotorProfile.TREMOR ||
    persona.motor_profile === MotorProfile.SINGLE_HANDED ||
    persona.assistive_tech === AssistiveTech.ZOOM_400
  ) {
    violations.push(...await checkTapTargets(page));
  }

  // Low comprehension: check readability
  if (persona.comprehension_grade_level <= 6) {
    const maxGrade = 7; // WCAG 3.1.5 / master plan §3.4
    warnings.push(...await checkReadability(page, maxGrade));
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
  };
}
