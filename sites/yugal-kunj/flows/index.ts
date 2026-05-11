import type { FlowDefinition } from '@qa-platform/playwright-core';
import { browseFlow } from './browse.js';
import { registrationFlow } from './registration.js';
import { checkoutFlow } from './checkout.js';

export const flows: Record<string, FlowDefinition> = {
  browse: browseFlow,
  registration: registrationFlow,
  checkout: checkoutFlow,
};

export { browseFlow, registrationFlow, checkoutFlow };
