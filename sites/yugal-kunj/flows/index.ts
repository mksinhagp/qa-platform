import type { FlowDefinition } from '@qa-platform/playwright-core';
import { browseFlow } from './browse.js';
import { registrationFlow } from './registration.js';
import { checkoutFlow } from './checkout.js';
import { adminLoginFlow } from './admin-login.js';
import { bookingLookupFlow } from './booking-lookup.js';
import { registrationLookupFlow } from './registration-lookup.js';
import { adminEditFlow } from './admin-edit.js';
import { reportingScreensFlow } from './reporting-screens.js';
import { apiEndpoints } from '../api-endpoints.js';

export const flows: Record<string, FlowDefinition> = {
  browse: browseFlow,
  registration: registrationFlow,
  checkout: checkoutFlow,
  // Phase 7: Admin and back-office flows
  'admin-login': adminLoginFlow,
  'booking-lookup': bookingLookupFlow,
  'registration-lookup': registrationLookupFlow,
  'admin-edit': adminEditFlow,
  'reporting-screens': reportingScreensFlow,
};

export { browseFlow, registrationFlow, checkoutFlow };
export { adminLoginFlow, bookingLookupFlow, registrationLookupFlow, adminEditFlow, reportingScreensFlow };

// Phase 6: API endpoint definitions for the API testing layer
export { apiEndpoints };
