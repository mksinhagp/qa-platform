import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test';
import { AssistiveTech, DeviceClass, NetworkProfileType, type Persona } from '@qa-platform/shared-types';

// Viewport presets keyed by device class (fallback if no DeviceProfile is supplied)
const DEVICE_VIEWPORTS: Record<DeviceClass, { width: number; height: number }> = {
  [DeviceClass.DESKTOP]: { width: 1920, height: 1080 },
  [DeviceClass.LAPTOP]: { width: 1440, height: 900 },
  [DeviceClass.TABLET]: { width: 820, height: 1180 },
  [DeviceClass.MOBILE]: { width: 393, height: 852 },
  [DeviceClass.LOW_END_MOBILE]: { width: 360, height: 740 },
};

// Default user agents by device class
const DEVICE_UAS: Partial<Record<DeviceClass, string>> = {
  [DeviceClass.MOBILE]: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  [DeviceClass.TABLET]: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  [DeviceClass.LOW_END_MOBILE]: 'Mozilla/5.0 (Linux; Android 10; SM-A115M) AppleWebKit/537.36 Mobile Safari/537.36',
};

// Network throttle settings (matching Playwright CDPSession throttling format)
export interface NetworkThrottle {
  downloadThroughput: number; // bytes/sec
  uploadThroughput: number;   // bytes/sec
  latency: number;            // ms
}

const NETWORK_THROTTLES: Record<NetworkProfileType, NetworkThrottle> = {
  [NetworkProfileType.FAST]: {
    downloadThroughput: 102400 * 1024 / 8, // 100 Mbps in bytes/s
    uploadThroughput: 51200 * 1024 / 8,
    latency: 5,
  },
  [NetworkProfileType.NORMAL]: {
    downloadThroughput: 20480 * 1024 / 8, // 20 Mbps
    uploadThroughput: 10240 * 1024 / 8,
    latency: 20,
  },
  [NetworkProfileType.SLOW_3G]: {
    downloadThroughput: 400 * 1024 / 8, // 400 kbps
    uploadThroughput: 200 * 1024 / 8,
    latency: 300,
  },
  [NetworkProfileType.FLAKY]: {
    downloadThroughput: 5120 * 1024 / 8, // 5 Mbps with loss
    uploadThroughput: 2560 * 1024 / 8,
    latency: 100,
  },
};

export interface PersonaContextOptions {
  persona: Persona;
  /** Override viewport from DeviceProfile if available */
  viewportOverride?: { width: number; height: number };
  /** Override user agent from DeviceProfile */
  userAgentOverride?: string;
}

/**
 * Creates a Playwright BrowserContext configured for a specific persona.
 * Applies: viewport, device scaling, touch emulation, forced-colors for high contrast,
 * reduced-motion for accessibility, and 400% zoom for zoom_400 personas.
 */
export async function createPersonaContext(
  browser: Browser,
  options: PersonaContextOptions,
): Promise<BrowserContext> {
  const { persona } = options;

  const isMobile =
    persona.device_class === DeviceClass.MOBILE ||
    persona.device_class === DeviceClass.LOW_END_MOBILE ||
    persona.device_class === DeviceClass.TABLET;

  const viewport =
    options.viewportOverride ?? DEVICE_VIEWPORTS[persona.device_class];

  // For zoom_400 personas, we emulate 400% zoom by shrinking the viewport
  // to 25% of its logical size, forcing the browser to reflow content
  const effectiveViewport =
    persona.assistive_tech === AssistiveTech.ZOOM_400
      ? { width: Math.round(viewport.width / 4), height: Math.round(viewport.height / 4) }
      : viewport;

  const contextOptions: BrowserContextOptions = {
    viewport: effectiveViewport,
    hasTouch: isMobile,
    isMobile,
    userAgent: options.userAgentOverride ?? DEVICE_UAS[persona.device_class],
    // High contrast: force forced-colors media feature
    forcedColors:
      persona.assistive_tech === AssistiveTech.HIGH_CONTRAST ? 'active' : 'none',
    // Reduce motion for users who may be sensitive
    reducedMotion:
      persona.assistive_tech === AssistiveTech.SCREEN_READER ? 'reduce' : 'no-preference',
    // Record video and traces for every execution
    recordVideo: { dir: '/tmp/qa-platform-videos' },
  };

  const context = await browser.newContext(contextOptions);

  // Apply network throttling at the context route layer for all browsers.
  // CDP network emulation is page/session-scoped; applying it to a temporary
  // page would not affect the real execution page created later by the runner.
  try {
    await applyRouteThrottle(context, persona.network_profile);
  } catch (err) {
    // If throttle setup throws unexpectedly, close the context to avoid leaking
    // it before re-throwing.
    await context.close().catch(() => undefined);
    throw err;
  }

  return context;
}

/**
 * Applies a simple route-level delay as a fallback throttle for non-Chromium browsers.
 */
async function applyRouteThrottle(
  context: BrowserContext,
  profile: NetworkProfileType,
): Promise<void> {
  const delayMs = {
    [NetworkProfileType.FAST]: 0,
    [NetworkProfileType.NORMAL]: 20,
    [NetworkProfileType.SLOW_3G]: 300,
    [NetworkProfileType.FLAKY]: 100,
  }[profile] ?? 0;

  if (delayMs === 0) return;

  await context.route('**/*', async (route) => {
    // Simulate packet loss for flaky profile: ~5% chance of aborting
    if (profile === NetworkProfileType.FLAKY && Math.random() < 0.05) {
      await route.abort('connectionreset');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/**
 * Returns the network throttle settings for a given persona.
 */
export function getNetworkThrottle(persona: Persona): NetworkThrottle {
  return NETWORK_THROTTLES[persona.network_profile];
}
