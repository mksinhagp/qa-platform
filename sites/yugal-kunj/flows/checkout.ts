/**
 * Flow: checkout
 * Site: Yugal Kunj QA Portal
 *
 * Covers: proceed from cart/registration summary → payment form → submit (approval-gated).
 * Approval category: checkout_submit (strong strength per §8.1).
 *
 * This flow validates:
 * - Payment form renders with expected fields (card number, expiry, CVV)
 * - Persona-aware card fill (typing speed, hesitation)
 * - Submit is paused for operator approval (strong confirm) before execution
 * - On approval: payment confirmation / booking confirmation page appears
 * - On rejection: step is recorded as skipped_by_approval
 * - Post-checkout email is validated by the email module (Phase 5)
 *
 * Sandbox cards: stored in vault as payment_profiles.
 * The runner decrypts the sandbox card details via brokered access before
 * passing them to this flow through the execution context.
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

/**
 * Sandbox Stripe test card — placeholder.
 * The runner injects real card data from the vault-stored payment profile
 * at execution time via the `paymentProfile` field in the execution context.
 */
const FALLBACK_SANDBOX_CARD = {
  number: '4242424242424242',
  expiry: '12/29',
  cvv: '123',
  zip: '90210',
  name: 'QA Tester',
};

export const checkoutFlow: FlowDefinition = {
  id: 'checkout',
  name: 'Checkout (Approval-Gated Payment)',
  steps: [
    {
      name: 'navigate_to_cart',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('navigate_to_cart');

        // The cart/checkout is typically reached after registration selection.
        // Navigate to the portal root; the cart icon or checkout link should be visible.
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org');
        await runner.page.waitForFunction(
          '() => document.querySelector("#root")?.children.length > 0',
          { timeout: 15000 },
        );
        await runner.hesitate(300);
      },
    },

    {
      name: 'find_checkout_entry',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('find_checkout_entry');
        await runner.hesitate(200);

        // Look for cart / checkout link
        const checkoutEntry = await runner.page.$(
          'a[href*="checkout"], button:has-text("Checkout"), ' +
          'button:has-text("Proceed"), [class*="cart"], [class*="Cart"], ' +
          'a:has-text("Cart"), a:has-text("checkout")',
        );

        if (!checkoutEntry) {
          // Cart may already be inline — log a friction signal and continue
          runner.collector.record('repeated_click_on_non_interactive', {
            selector: 'cart_not_found',
          });
          return;
        }

        await checkoutEntry.click();
        await runner.page.waitForTimeout(2000);
      },
    },

    {
      name: 'verify_order_summary',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_order_summary');
        await runner.hesitate(300);

        // Confirm there is a summary / total visible
        const total = await runner.page.$(
          '[class*="total"], [class*="Total"], [class*="order-summary"], ' +
          '[class*="OrderSummary"], [class*="cart-total"]',
        );

        if (!total) {
          throw new Error(
            'Checkout order summary not found — page may not have navigated to checkout',
          );
        }

        await runner.checkAccessibility();
      },
    },

    {
      name: 'fill_payment_form',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('fill_payment_form');

        // Use card details from the execution context (injected by runner from vault)
        // Fall back to the static sandbox card if no profile was provided.
        const card =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (runner as any).executionContext?.paymentProfile ?? FALLBACK_SANDBOX_CARD;

        await runner.page.waitForSelector(
          'input[name="cardNumber"], input[placeholder*="card"], ' +
          'input[data-elements-stable-field-name="cardNumber"], ' +
          'iframe[title*="card"], [class*="card-element"]',
          { timeout: 15000 },
        );

        await runner.hesitate(400);

        // Try to fill card number — may be in an iframe (Stripe Elements)
        const cardFrame = runner.page.frameLocator('iframe[title*="card"], iframe[name*="card"]');
        const cardInput = cardFrame.locator('input[name="cardnumber"], input[autocomplete="cc-number"]');

        if (await cardInput.count() > 0) {
          await cardInput.fill(card.number);
          await runner.hesitate(200);

          const expInput = cardFrame.locator('input[name="exp-date"], input[autocomplete="cc-exp"]');
          if (await expInput.count() > 0) {
            await expInput.fill(card.expiry);
            await runner.hesitate(150);
          }

          const cvvInput = cardFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]');
          if (await cvvInput.count() > 0) {
            await cvvInput.fill(card.cvv);
            await runner.hesitate(150);
          }
        } else {
          // Fallback: plain input fields outside an iframe
          const plainCardInput = await runner.page.$(
            'input[name="cardNumber"], input[placeholder*="card number"]',
          );
          if (plainCardInput) {
            await runner.type(
              'input[name="cardNumber"], input[placeholder*="card number"]',
              card.number,
            );
            await runner.hesitate(150);
          }

          const expiryInput = await runner.page.$(
            'input[name="expiry"], input[name="exp"], input[placeholder*="MM/YY"]',
          );
          if (expiryInput) {
            await runner.type(
              'input[name="expiry"], input[name="exp"], input[placeholder*="MM/YY"]',
              card.expiry,
            );
            await runner.hesitate(100);
          }

          const cvvInput = await runner.page.$(
            'input[name="cvc"], input[name="cvv"], input[placeholder*="CVC"], input[placeholder*="CVV"]',
          );
          if (cvvInput) {
            await runner.type(
              'input[name="cvc"], input[name="cvv"], input[placeholder*="CVC"], input[placeholder*="CVV"]',
              card.cvv,
            );
          }
        }

        // Cardholder name
        const nameInput = await runner.page.$(
          'input[name="name"], input[name="cardholder"], input[placeholder*="name on card"]',
        );
        if (nameInput) {
          await runner.type(
            'input[name="name"], input[name="cardholder"], input[placeholder*="name on card"]',
            card.name,
          );
        }

        // ZIP / postal code
        const zipInput = await runner.page.$(
          'input[name="zip"], input[name="postal"], input[placeholder*="ZIP"], input[placeholder*="Postal"]',
        );
        if (zipInput) {
          await runner.type(
            'input[name="zip"], input[name="postal"], input[placeholder*="ZIP"], input[placeholder*="Postal"]',
            card.zip,
          );
        }

        await runner.hesitate(500);
      },
    },

    {
      name: 'review_order_before_submit',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('review_order_before_submit');
        await runner.hesitate(600); // persona reading time
        await runner.checkAccessibility();
      },
    },

    {
      name: 'await_checkout_approval',
      type: 'approval',
      approval_category: 'checkout_submit',
      fn: async (runner: PersonaRunner) => {
        // Strong approval gate — operator must type a reason before the payment submits.
        // The ExecutionManager intercepts this step type and posts an approvals row
        // with category=checkout_submit (strong strength per §8.1).
        runner.collector.setStep('await_checkout_approval');
        await runner.hesitate(100);
      },
    },

    {
      name: 'submit_payment',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('submit_payment');

        const submitBtn = await runner.page.$(
          'button[type="submit"], button:has-text("Pay"), button:has-text("Complete"), ' +
          'button:has-text("Place Order"), button:has-text("Confirm")',
        );

        if (!submitBtn) {
          throw new Error('Payment submit button not found');
        }

        await runner.click(
          'button[type="submit"], button:has-text("Pay"), button:has-text("Complete"), ' +
          'button:has-text("Place Order"), button:has-text("Confirm")',
        );

        // Wait for payment processing (may take a few seconds with sandbox)
        await runner.page.waitForTimeout(5000);
      },
    },

    {
      name: 'verify_payment_confirmation',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_payment_confirmation');

        const confirmation = await runner.page.$(
          '[class*="success"], [class*="Success"], [class*="confirm"], [class*="Confirm"], ' +
          '[class*="thank"], [class*="Thank"], [class*="receipt"], [class*="Receipt"]',
        );

        if (!confirmation) {
          const error = await runner.page.$(
            '[class*="error"], [class*="Error"], .alert-danger, [role="alert"]',
          );
          if (error) {
            const errorText = await error.textContent();
            throw new Error(`Payment failed with error: ${errorText?.trim() ?? 'unknown'}`);
          }
          throw new Error(
            'Payment submitted but no confirmation or error message found',
          );
        }
      },
    },
  ],
};
