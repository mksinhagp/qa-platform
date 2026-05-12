/**
 * Email Provider Implementations — Phase 16.1
 *
 * Registers all built-in provider factories with the provider registry.
 * Import this module to ensure all providers are available.
 */

import { registerProviderFactory } from '../provider.js';
import { ImapEmailProvider } from './imap-provider.js';
import { TestEmailProvider } from './test-provider.js';

// Register built-in provider factories
registerProviderFactory('imap', (config) => new ImapEmailProvider(config));
registerProviderFactory('mailcatcher', (config) => new TestEmailProvider(config));

export { ImapEmailProvider } from './imap-provider.js';
export { TestEmailProvider } from './test-provider.js';
