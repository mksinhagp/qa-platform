/**
 * Flows Index Template
 *
 * PURPOSE
 * -------
 * Exports a FlowMap of all flows implemented for this site, plus the API
 * endpoint definitions used by the Phase 6 API testing layer.
 *
 * HOW TO USE
 * ----------
 * 1. Implement each flow file in this directory (browse.ts, registration.ts,
 *    checkout.ts at minimum).
 * 2. If you add a new flow (e.g., login.ts), follow the same pattern:
 *      a. Create the flow file with a named export.
 *      b. Import it here.
 *      c. Add it to the `flows` record with a kebab-case key.
 *      d. Add it to the named re-export line at the bottom.
 * 3. If a flow does not apply to this site (e.g., no checkout), remove its
 *    import and its entry from the `flows` record.
 *
 * KEY NAMING CONVENTION
 * ---------------------
 * Keys in the `flows` record must be lowercase kebab-case strings and must
 * match the flow id field declared inside the FlowDefinition object.
 * Example: key 'booking-lookup' → FlowDefinition { id: 'booking-lookup', ... }
 *
 * NOTE: The runner loads flows from this index via dynamic import.  The file
 * is compiled from .ts to .js by `pnpm build` before the runner reads it.
 */

import type { FlowDefinition } from '@qa-platform/playwright-core';
import { browseFlow } from './browse.js';
import { registrationFlow } from './registration.js';
import { checkoutFlow } from './checkout.js';
import { apiEndpoints } from '../api-endpoints.js';

// TODO: If you add Phase 7 admin flows, uncomment and implement each one:
// import { adminLoginFlow } from './admin-login.js';
// import { bookingLookupFlow } from './booking-lookup.js';
// import { registrationLookupFlow } from './registration-lookup.js';
// import { adminEditFlow } from './admin-edit.js';
// import { reportingScreensFlow } from './reporting-screens.js';

export const flows: Record<string, FlowDefinition> = {
  // Core flows — implement these first.
  browse: browseFlow,
  registration: registrationFlow,
  checkout: checkoutFlow,

  // TODO: Add Phase 7 admin flows here once implemented:
  // 'admin-login': adminLoginFlow,
  // 'booking-lookup': bookingLookupFlow,
  // 'registration-lookup': registrationLookupFlow,
  // 'admin-edit': adminEditFlow,
  // 'reporting-screens': reportingScreensFlow,
};

// Named re-exports — used by the runner when it imports flows individually.
export { browseFlow, registrationFlow, checkoutFlow };

// TODO: Add re-exports for any additional flows you implement:
// export { adminLoginFlow, bookingLookupFlow, registrationLookupFlow, adminEditFlow, reportingScreensFlow };

// Phase 6: API endpoint definitions for the API testing layer.
export { apiEndpoints };
