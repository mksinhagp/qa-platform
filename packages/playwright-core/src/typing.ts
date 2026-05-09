import type { Page } from '@playwright/test';
import type { Persona } from '@qa-platform/shared-types';

// Common typo substitutions that mimic real keyboard errors
const ADJACENT_KEYS: Record<string, string[]> = {
  a: ['q', 'w', 's', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 'r', 'd', 's'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'o', 'k', 'j'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'p', 'l', 'k'],
  p: ['o', 'l'],
  q: ['w', 'a'],
  r: ['e', 't', 'f', 'd'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'y', 'g', 'f'],
  u: ['y', 'i', 'j', 'h'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'e', 's', 'a'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'u', 'h', 'g'],
  z: ['a', 's', 'x'],
};

/**
 * Calculates keystroke delay in ms from typing WPM.
 * Average word length = 5 chars + 1 space = 6 keystrokes.
 */
function wpmToDelayMs(wpm: number): number {
  return Math.round((60 * 1000) / (wpm * 6));
}

/**
 * Returns a random adjacent key for a given character, or the same char if none.
 */
function getAdjacentKey(char: string): string {
  const lower = char.toLowerCase();
  const candidates = ADJACENT_KEYS[lower];
  if (!candidates || candidates.length === 0) return char;
  const typo = candidates[Math.floor(Math.random() * candidates.length)];
  return char === char.toUpperCase() ? typo.toUpperCase() : typo;
}

/**
 * Persona-aware typing: simulates realistic speed, hesitation, and errors.
 * - Types each character with a delay derived from WPM.
 * - Randomly inserts adjacent-key typos then backspaces to correct.
 * - Adds jitter (±20%) to keystroke delay for naturalism.
 */
export async function personaType(
  page: Page,
  selector: string,
  text: string,
  persona: Persona,
): Promise<void> {
  const baseDelay = wpmToDelayMs(persona.typing_wpm);
  const element = page.locator(selector).first();
  await element.click();

  for (const char of text) {
    const jitter = baseDelay * 0.4 * (Math.random() - 0.5); // ±20% jitter
    const delay = Math.max(50, Math.round(baseDelay + jitter));

    const makeTypo = Math.random() < persona.typing_error_rate;
    if (makeTypo && /[a-z]/i.test(char)) {
      // Type the wrong key then immediately backspace
      const typoChar = getAdjacentKey(char);
      await page.keyboard.type(typoChar, { delay: delay });
      await page.keyboard.press('Backspace');
      // Slight pause before correction (mirrors real correction behavior)
      await page.waitForTimeout(delay * 0.5);
    }

    await page.keyboard.type(char, { delay: delay });
  }
}

/**
 * Persona-aware hesitation pause before interacting with an element.
 * Models reading time based on visible text length and reading WPM.
 */
export async function personaHesitate(
  page: Page,
  visibleTextLength: number,
  persona: Persona,
): Promise<void> {
  // Reading time: words × (60000 ms / readingWpm), avg 5 chars/word
  const wordCount = visibleTextLength / 5;
  const readingMs = (wordCount / persona.reading_wpm) * 60_000;
  const hesitationMs = persona.hesitation_ms_per_decision;
  const totalMs = Math.round(readingMs + hesitationMs);
  // Cap at 8 seconds per interaction to prevent runaway waits in tests
  await page.waitForTimeout(Math.min(totalMs, 8_000));
}

/**
 * Persona-aware click with optional coordinate jitter for tremor simulation.
 */
export async function personaClick(
  page: Page,
  selector: string,
  persona: Persona,
): Promise<void> {
  const element = page.locator(selector).first();

  if (persona.motor_profile === 'tremor') {
    // Apply slight random offset within the element bounding box
    const box = await element.boundingBox();
    if (box) {
      const jitterX = (Math.random() - 0.5) * 8; // ±4px horizontal
      const jitterY = (Math.random() - 0.5) * 8; // ±4px vertical
      await page.mouse.click(box.x + box.width / 2 + jitterX, box.y + box.height / 2 + jitterY);
      return;
    }
  }

  await element.click();
}
