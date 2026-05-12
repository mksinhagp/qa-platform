/**
 * Flow: checkout
 * Site: REPLACE_ME — Site Display Name
 *
 * Covers: cart / registration summary → payment form → submit (approval-gated).
 * Approval category: checkout_submit (strong strength per §8.1).
 *
 * This flow validates:
 * - Payment form renders with the expected fields (card number, expiry, CVV)
 * - Persona-aware card fill (typing speed, hesitation)
 * - Submit is paused for operator approval (strong confirm) before execution
 * - On approval: payment confirmation / booking confirmation page appears
 * - On rejection: step is recorded as skipped_by_approval
 * - Post-checkout confirmation email is validated by the email module (Phase 5)
 *
 * Sandbox card details: stored in vault as payment_profiles.
 * The runner decrypts them from the vault and injects them into
 * runner.executionContext.paymentProfile before calling this flow.
 *
 * TODO: Identify whether the site uses Stripe Elements (iframes), Authorize.net,
 *       Braintree, or plain card input fields, and uncomment the appropriate
 *       fill block in fill_payment_form.
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

/**
 * Fallback sandbox card used only if no payment profile was injected by the
 * runner from the vault.  Replace with a card number valid for this site's
 * payment sandbox (Stripe, Authorize.net, Braintree, etc.).
 *
 * Common sandbox card numbers:
 *   Stripe:        4242 4242 4242 4242
 *   Authorize.net: 4111 1111 1111 1111
 *   Braintree:     4111 1111 1111 1111
 *
 * TODO: Replace with a card appropriate for this site's payment processor.
 */
const FALLBACK_SANDBOX_CARD = {
  number: '4242424242424242',   // TODO: replace if not Stripe
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

        // Navigate to the site base URL.  The cart / checkout state is typically
        // established by a prior registration or browsing session.
        // runner.executionContext.baseUrl resolves to the environment base URL.
        await runner.goto(runner.executionContext.baseUrl);

        // TODO: Update the wait condition to match the site's loading pattern.
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

        // Look for a cart icon, Checkout button, or Proceed link.
        // TODO: Replace the has-text values and class selectors with what
        //       the site actually uses.  Common patterns:
        //         button:has-text("Checkout")
        //         button:has-text("Proceed to Payment")
        //         a[href*="checkout"]
        //         [data-testid="cart-button"]
        const checkoutEntry = await runner.page.$(
          'a[href*="checkout"], button:has-text("Checkout"), ' +
          'button:has-text("Proceed"), [class*="cart"], ' +
          'a:has-text("Cart"), REPLACE_ME',
        );

        if (!checkoutEntry) {
          // Cart may already be inline on the page (registration → payment in one step).
          // Log a friction signal and continue to the payment form fill step.
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

        // Confirm an order summary / total is visible before asking for payment.
        // TODO: Replace with the selector that wraps the order total on this site.
        const total = await runner.page.$(
          '[class*="total"], [class*="order-summary"], ' +
          '[data-testid="order-summary"], REPLACE_ME',
        );

        if (!total) {
          throw new Error(
            'Checkout order summary not found — page may not have navigated to the checkout screen',
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

        // Use card details injected from the vault; fall back to static sandbox card.
        const card = runner.executionContext.paymentProfile ?? FALLBACK_SANDBOX_CARD;

        // Wait for at least one card-related input to appear.
        // TODO: Adjust the selector to match the site's payment widget.
        await runner.page.waitForSelector(
          'input[name="cardNumber"], input[placeholder*="card"], ' +
          'iframe[title*="card"], [class*="card-element"], REPLACE_ME',
          { timeout: 15000 },
        );

        await runner.hesitate(400);

        // ── Option A: Stripe Elements (card fields inside iframes) ────────────
        // Uncomment this block if the site uses Stripe Elements.
        // TODO: Verify iframe title/name attributes in DevTools → Network / Elements.

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
          // ── Option B: Plain card input fields (no iframe) ─────────────────
          // Fallback for sites with standard HTML inputs for card data.

          // Card number
          // TODO: Replace selector with the actual card number input on this site.
          const plainCardInput = await runner.page.$(
            'input[name="cardNumber"], input[placeholder*="card number"], REPLACE_ME',
          );
          if (plainCardInput) {
            await runner.type(
              'input[name="cardNumber"], input[placeholder*="card number"], REPLACE_ME',
              card.number,
            );
            await runner.hesitate(150);
          }

          // Expiry
          // TODO: Replace selector with the actual expiry input on this site.
          const expiryInput = await runner.page.$(
            'input[name="expiry"], input[name="exp"], input[placeholder*="MM/YY"], REPLACE_ME',
          );
          if (expiryInput) {
            await runner.type(
              'input[name="expiry"], input[name="exp"], input[placeholder*="MM/YY"], REPLACE_ME',
              card.expiry,
            );
            await runner.hesitate(100);
          }

          // CVV / CVC
          // TODO: Replace selector with the actual CVV input on this site.
          const cvvInput = await runner.page.$(
            'input[name="cvc"], input[name="cvv"], input[placeholder*="CVC"], input[placeholder*="CVV"], REPLACE_ME',
          );
          if (cvvInput) {
            await runner.type(
              'input[name="cvc"], input[name="cvv"], input[placeholder*="CVC"], input[placeholder*="CVV"], REPLACE_ME',
              card.cvv,
            );
          }
        }

        // Cardholder name
        // TODO: Remove this block if the site's payment form does not ask for the name.
        const nameInput = await runner.page.$(
          'input[name="name"], input[name="cardholder"], input[placeholder*="name on card"], REPLACE_ME',
        );
        if (nameInput) {
          await runner.type(
            'input[name="name"], input[name="cardholder"], input[placeholder*="name on card"], REPLACE_ME',
            card.name,
          );
        }

        // ZIP / postal code
        // TODO: Remove this block if the site does not require a billing ZIP.
        const zipInput = await runner.page.$(
          'input[name="zip"], input[name="postal"], input[placeholder*="ZIP"], input[placeholder*="Postal"], REPLACE_ME',
        );
        if (zipInput) {
          await runner.type(
            'input[name="zip"], input[name="postal"], input[placeholder*="ZIP"], input[placeholder*="Postal"], REPLACE_ME',
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
        // Persona reading time — simulates a human reviewing the total before paying.
        await runner.hesitate(600);
        await runner.checkAccessibility();
      },
    },

    {
      name: 'await_checkout_approval',
      type: 'approval',
      approval_category: 'checkout_submit',
      fn: async (runner: PersonaRunner) => {
        // Strong approval gate — the operator must confirm before payment is submitted.
        // The ExecutionManager posts an approval row with category=checkout_submit
        // (strong strength per §8.1) and waits for an operator decision.
        //   - Approved: fn() runs (brief hesitate), then submit_payment executes.
        //   - Rejected / timed out: fn() and submit_payment are both skipped.
        runner.collector.setStep('await_checkout_approval');
        await runner.hesitate(100);
      },
    },

    {
      name: 'submit_payment',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('submit_payment');

        // TODO: Replace selector with submit_button from rules.ts, or the specific
        //       Pay / Place Order button text the site uses.
        const submitBtn = await runner.page.$(
          'button[type="submit"], button:has-text("Pay"), ' +
          'button:has-text("Complete"), button:has-text("Place Order"), ' +
          'button:has-text("Confirm"), REPLACE_ME',
        );

        if (!submitBtn) {
          throw new Error('Payment submit button not found');
        }

        await runner.click(
          'button[type="submit"], button:has-text("Pay"), ' +
          'button:has-text("Complete"), button:has-text("Place Order"), ' +
          'button:has-text("Confirm"), REPLACE_ME',
        );

        // Payment processing may take several seconds even in sandbox mode.
        // TODO: Increase timeout if the payment gateway is slower than 5 s.
        await runner.page.waitForTimeout(5000);
      },
    },

    {
      name: 'verify_payment_confirmation',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_payment_confirmation');

        // TODO: Replace selector with success_message from rules.ts.
        const confirmation = await runner.page.$(
          '[class*="success"], [class*="confirm"], ' +
          '[class*="thank"], [class*="receipt"], ' +
          '[data-testid="payment-success"], REPLACE_ME',
        );

        if (!confirmation) {
          // Check for an inline payment error before throwing a generic failure.
          // TODO: Replace selector with error_message from rules.ts.
          const error = await runner.page.$(
            '[class*="error"], .alert-danger, [role="alert"], REPLACE_ME',
          );
          if (error) {
            const errorText = await error.textContent();
            throw new Error(`Payment failed with error: ${errorText?.trim() ?? 'unknown'}`);
          }
          throw new Error(
            'Payment submitted but no confirmation or error message was found',
          );
        }
      },
    },
  ],
};
