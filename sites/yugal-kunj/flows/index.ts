import type { FlowDefinition } from '@qa-platform/playwright-core';
import { browseFlow } from './browse.js';
import { registrationFlow } from './registration.js';

export const flows: Record<string, FlowDefinition> = {
  browse: browseFlow,
  registration: registrationFlow,
};

export { browseFlow, registrationFlow };
