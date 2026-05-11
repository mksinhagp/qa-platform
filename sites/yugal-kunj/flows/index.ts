import type { FlowDefinition } from '@qa-platform/playwright-core';
import { browseFlow } from './browse.js';
import { registrationFlow } from './registration.js';
import { checkoutFlow } from './checkout.js';
import { apiEndpoints } from '../api-endpoints.js';

export const flows: Record<string, FlowDefinition> = {
  browse: browseFlow,
  registration: registrationFlow,
  checkout: checkoutFlow,
};

export { browseFlow, registrationFlow, checkoutFlow };

// Phase 6: API endpoint definitions for the API testing layer
export { apiEndpoints };
